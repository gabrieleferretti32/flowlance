/**
 * Da quale conto escono le tasse: misurato, non chiesto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché questa domanda esiste
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il limite del mese parte dalle entrate del conto personale e ne toglie la
 * quota di accantonamento. Il conto regge a una condizione sola: che su quel
 * conto le tasse **debbano ancora uscire**. Se invece le paga il conto
 * dell'attività, il prelievo che arriva è già netto del fisco, e la quota
 * toglie una seconda volta lo stesso carico.
 *
 * Non è un caso di nicchia: è chiunque tenga un conto per l'attività e uno
 * personale e si versi ogni mese quello che resta, cioè il modo normale di
 * fare le cose. Misurato sul dataset di vetrina, prima del 23 settembre 2026:
 * il limite di settembre diceva −9.753,05 €, e 9.238,05 € di quel rosso erano
 * solo la doppia sottrazione. E peggiorava al crescere del fatturato, perché
 * il carico cresce più in fretta del margine.
 *
 * Nessuno se ne accorgeva, perché **un limite negativo non sembra un errore
 * dell'app: sembra un rimprovero.**
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Tre segnali, e poi una domanda sola
 * ─────────────────────────────────────────────────────────────────────────
 *
 * La risposta si può chiedere — ed è una domanda sola, «gli F24 da quale conto
 * li paghi?» — ma chiederla a freddo vuol dire farsi rispondere a caso. Qui si
 * misura quello che l'archivio già dice, così la domanda arriva con la
 * risposta proposta e diventa una conferma.
 *
 * I tre segnali non votano a maggioranza: se sono discordi il risultato è
 * «non si sa», e chi guarda lo legge insieme ai motivi. Una maggioranza di
 * due contro uno su una cifra che decide quanto puoi spendere è un modo
 * elegante di sbagliare in silenzio.
 */
import type { Adempimento } from "@/lib/fisco/scadenze";
import type { VersamentoF24 } from "@/lib/fisco/tipi";
import type { CategoriaPf, ChiPagaIlFisco, ContoDelFisco, MovimentoPf } from "./tipi";

export type { ChiPagaIlFisco, ContoDelFisco };

export type Indizio = {
  id: "f24-nel-registro" | "conto-degli-f24" | "entrate-e-carico";
  /** Da che parte tira. `null` quando l'indizio non sa dire niente. */
  verso: ChiPagaIlFisco | null;
  testo: string;
};

export type LetturaChiPaga = {
  /** Quello che i segnali misurano. `null` quando non bastano o si contraddicono. */
  misurato: ChiPagaIlFisco | null;
  indizi: Indizio[];
};

export type IngressoChiPaga = {
  anno: number;
  oggi: string;
  movimenti: MovimentoPf[];
  categorie: CategoriaPf[];
  versamenti: VersamentoF24[];
  scadenze: Adempimento[];
  /** Dal prospetto: quello che l'attività lascia dopo il fisco. */
  nettoDisponibile: number;
  /** Dal prospetto: imposte più contributi dell'anno. */
  caricoTotale: number;
};

const annoDi = (data: string) => Number(data.slice(0, 4));
const meseDi = (data: string) => Number(data.slice(5, 7));

/**
 * Il primo segnale: nel registro personale non esce un F24.
 *
 * È il più forte perché non misura un importo, misura **un'assenza in un posto
 * dove qualcosa doveva esserci**. Ma vale solo dentro una finestra che
 * contenga almeno una scadenza già passata: chi ha importato gennaio-aprile
 * non ha nessun F24 nel registro per la ragione più semplice del mondo, cioè
 * che in quei mesi non scadeva niente.
 */
function f24NelRegistro(ing: IngressoChiPaga): Indizio {
  const dellAnno = ing.movimenti.filter(
    (m) => annoDi(m.data) === ing.anno && m.tipo !== "giroconto",
  );
  if (dellAnno.length === 0) {
    return {
      id: "f24-nel-registro",
      verso: null,
      testo: "Del registro di quest'anno non c'è ancora niente.",
    };
  }

  const date = dellAnno.map((m) => m.data).sort();
  const dal = date[0];
  const al = date[date.length - 1];
  const mesiCoperti = new Set(dellAnno.map((m) => meseDi(m.data)));

  const coperte = new Set(
    ing.categorie.filter((c) => c.pagataDallAccantonamento).map((c) => c.id),
  );
  const quanti = dellAnno.filter((m) => coperte.has(m.categoriaId)).length;
  if (quanti > 0) {
    return {
      id: "f24-nel-registro",
      verso: "personale",
      testo:
        quanti === 1
          ? "Nel registro c'è un pagamento in una categoria del fisco: è uscito da un conto tuo."
          : `Nel registro ci sono ${quanti} pagamenti in categorie del fisco: sono usciti da conti tuoi.`,
    };
  }

  /*
    Un mese solo non basta a dire un'assenza: è la forma di un primo import,
    e chi ha caricato l'estratto conto di giugno per provare non ha ancora
    raccontato niente del suo modo di pagare.
  */
  if (mesiCoperti.size < 2) {
    return {
      id: "f24-nel-registro",
      verso: null,
      testo: "Il registro copre un mese solo: troppo poco per dire che gli F24 non ci sono.",
    };
  }

  const passate = ing.scadenze.filter(
    (s) => s.importo !== null && s.importo > 0 && s.data <= ing.oggi && s.data >= dal && s.data <= al,
  );
  if (passate.length === 0) {
    return {
      id: "f24-nel-registro",
      verso: null,
      testo:
        "Nel periodo che il registro copre non è ancora scaduto nessun F24: che non ce ne siano non dice niente.",
    };
  }
  return {
    id: "f24-nel-registro",
    verso: "attivita",
    testo:
      passate.length === 1
        ? `Una scadenza è passata nel periodo che il registro copre — ${passate[0].titolo.toLowerCase()} — e nel registro non c'è il pagamento.`
        : `${passate.length} scadenze sono passate nel periodo che il registro copre, e nel registro non c'è nessuno dei pagamenti.`,
  };
}

/**
 * Il secondo segnale: il conto da cui gli F24 registrati sono usciti.
 *
 * Lo dice il campo `pagatoDa` del versamento, e **parla in un verso solo**.
 *
 * Quel campo risponde a un'altra domanda: «è uscito dalla cassa
 * dell'attività?», che è quello che serve al Cashflow per il saldo di cassa.
 * Le due domande hanno la stessa risposta soltanto se il conto dell'attività
 * **non** è fra i conti registrati qui. Quando invece c'è — sei conti, uno dei
 * quali è quello della partita IVA — un F24 marcato «attività» è uscito dalla
 * cassa dell'attività *e* dal mucchio che il limite guarda: la quota va tolta
 * lo stesso, e l'indizio che tirasse verso «non toglierla» tirerebbe dalla
 * parte sbagliata.
 *
 * Quindi: `personale` è inequivocabile — è uscito da un conto tracciato, e lo
 * dice. `attivita` non lo è, e l'indizio tace. Il verso che si perde lo dice
 * già il primo indizio, che lo misura sulla domanda giusta: l'F24 che nel
 * registro non c'è.
 */
function contoDegliF24(ing: IngressoChiPaga): Indizio {
  /*
    Solo gli F24 su cui il conto è stato **detto**.

    Il campo assente non vuol dire «attività»: vuol dire che nessuno ci ha
    messo mano, e su ogni archivio nato prima del campo sono tutti così.
    Contarli come dichiarazioni vorrebbe dire leggere un valore di default come
    una risposta, che è lo stesso difetto che questo modulo esiste per evitare.
  */
  const dellAnno = ing.versamenti.filter(
    (v) => annoDi(v.data) === ing.anno && v.pagatoDa !== undefined,
  );
  if (dellAnno.length === 0) {
    return {
      id: "conto-degli-f24",
      verso: null,
      testo: "Di nessun F24 di quest'anno è stato detto da quale conto è uscito.",
    };
  }
  const personali = dellAnno.filter((v) => v.pagatoDa === "personale").length;
  if (personali === dellAnno.length) {
    return {
      id: "conto-degli-f24",
      verso: "personale",
      testo: `Tutti gli F24 di quest'anno su cui l'hai detto (${dellAnno.length}) escono da un conto tuo.`,
    };
  }
  if (personali === 0) {
    return {
      id: "conto-degli-f24",
      verso: null,
      testo:
        `Gli F24 di quest'anno su cui l'hai detto (${dellAnno.length}) escono dalla cassa dell'attività: `
        + "da solo non dice niente, perché il conto dell'attività può essere uno di quelli registrati qui.",
    };
  }
  return {
    id: "conto-degli-f24",
    verso: null,
    testo: `Degli F24 di quest'anno ${personali} su ${dellAnno.length} escono da un conto tuo: i conti sono mescolati.`,
  };
}

/**
 * Il terzo segnale: quanto entra sul conto personale, confrontato col netto.
 *
 * Entrate ≈ netto disponibile vuol dire prelievo netto; entrate ≈ netto più
 * carico vuol dire prelievo lordo. Le due cifre distano il 40-50 %, quindi il
 * segnale è netto — ma è il più fragile dei tre, perché basta un altro reddito
 * sul conto o un prelievo a strappi per sporcarlo. Serve da conferma, e infatti
 * parla solo quando una delle due ipotesi è **molto** più vicina dell'altra.
 */
function entrateECarico(ing: IngressoChiPaga): Indizio {
  const zitto = (testo: string): Indizio => ({ id: "entrate-e-carico", verso: null, testo });
  if (ing.nettoDisponibile <= 0 || ing.caricoTotale <= 0) {
    return zitto("Il prospetto di quest'anno non ha ancora un netto da confrontare.");
  }

  const dallAttivita = new Set(
    ing.categorie.filter((c) => c.arrivaDallAttivita).map((c) => c.id),
  );
  const entrate = ing.movimenti.filter(
    (m) => m.tipo === "entrata" && annoDi(m.data) === ing.anno && dallAttivita.has(m.categoriaId),
  );
  const mesi = new Set(entrate.map((m) => meseDi(m.data)));
  if (mesi.size < 3) {
    return zitto("Servono almeno tre mesi di prelievi registrati per confrontarli col netto.");
  }

  const media = entrate.reduce((t, m) => t + m.importo, 0) / mesi.size;
  const seNetto = ing.nettoDisponibile / 12;
  const seLordo = (ing.nettoDisponibile + ing.caricoTotale) / 12;
  const distanzaNetto = Math.abs(media - seNetto);
  const distanzaLordo = Math.abs(media - seLordo);

  /*
    «Molto più vicina» vuol dire: la distanza dall'ipotesi scelta è meno di un
    terzo di quella dall'altra. In mezzo alle due non si sceglie — è la zona in
    cui un prelievo irregolare somiglia a tutte e due le cose.
  */
  const vicino = Math.min(distanzaNetto, distanzaLordo);
  const lontano = Math.max(distanzaNetto, distanzaLordo);
  if (lontano === 0 || vicino > lontano / 3) {
    return zitto("Quello che entra sui tuoi conti non somiglia né al netto né al lordo.");
  }
  return distanzaNetto < distanzaLordo
    ? {
        id: "entrate-e-carico",
        verso: "attivita",
        testo: "Quello che entra sui tuoi conti somiglia al netto dell'attività: il fisco è già uscito prima.",
      }
    : {
        id: "entrate-e-carico",
        verso: "personale",
        testo: "Quello che entra sui tuoi conti somiglia al netto più il carico fiscale: è un prelievo lordo.",
      };
}

/**
 * I tre segnali, letti insieme.
 *
 * Concordi: si propone. Discordi, o tutti muti: `misurato` resta `null` e la
 * schermata mostra i motivi invece di una risposta.
 */
export function chiPagaIlFisco(ing: IngressoChiPaga): LetturaChiPaga {
  const indizi = [f24NelRegistro(ing), contoDegliF24(ing), entrateECarico(ing)];
  const versi = new Set(indizi.map((i) => i.verso).filter((v): v is ChiPagaIlFisco => v !== null));
  return { misurato: versi.size === 1 ? [...versi][0] : null, indizi };
}

/**
 * La risposta salvata, letta da un archivio di qualunque età.
 *
 * Fra il 23 e il 26 settembre 2026 la domanda era un sì/no e la risposta si
 * chiamava `fiscoPagatoDa`. Quelle righe esistono, e vanno lette per quello che
 * dicevano: «dal conto dell'attività» voleva dire *da un conto che qui non c'è*
 * — `"fuori"` —, «da questo conto» voleva dire *da un conto di questi*, senza
 * dire quale: `"dentro"`.
 *
 * La conversione sta qui e non in un campo riscritto in archivio perché una
 * migrazione che riscrive dati è una migrazione che può sbagliarli; questa
 * invece non tocca niente e si può togliere il giorno che nessuna riga vecchia
 * gira più.
 */
export function contoDelFiscoDi(imp: {
  contoDelFisco?: ContoDelFisco | null;
  fiscoPagatoDa?: ChiPagaIlFisco | null;
}): ContoDelFisco | null {
  if (imp.contoDelFisco) return imp.contoDelFisco;
  if (imp.fiscoPagatoDa === "attivita") return "fuori";
  if (imp.fiscoPagatoDa === "personale") return "dentro";
  return null;
}

/** L'id del conto indicato, quando la risposta ne indica uno. */
export function idDelConto(conto: ContoDelFisco | null): string | null {
  if (conto === null || conto === "fuori" || conto === "dentro") return null;
  return conto;
}

/**
 * Da una risposta col nome del conto al verso che il calcolo usa.
 *
 * Un id — qualunque id, **anche di un conto cancellato** — vale «esce da qui»,
 * e non è una svista: se il conto indicato sparisce, il numero a schermo non
 * si deve muovere. Trattare l'id penzolante come «non lo so» farebbe salire il
 * limite di tutta la quota, in silenzio, per una cancellazione che parlava
 * d'altro. Che il conto non ci sia più lo dice la schermata, e chiede di
 * ridirlo.
 */
export function versoDichiarato(conto: ContoDelFisco | null): ChiPagaIlFisco | null {
  if (conto === null) return null;
  return conto === "fuori" ? "attivita" : "personale";
}

/**
 * La risposta che vale, e da dove viene.
 *
 * L'ordine è: quello che hai dichiarato, poi quello che i segnali misurano,
 * poi «personale».
 *
 * L'ultimo non è una moneta lanciata: è il verso prudente. Sbagliare verso
 * «personale» fa spendere **meno** del dovuto; sbagliare verso «attività» fa
 * spendere i soldi del fisco, che è l'unico dei due errori che si paga a
 * giugno.
 */
export type FonteRisposta = "dichiarato" | "misurato" | "predefinito";

export function rispostaChiPaga(
  /** `null` se non l'ha detto, `undefined` se l'archivio è nato prima del campo. */
  dichiarato: ChiPagaIlFisco | null | undefined,
  lettura: LetturaChiPaga,
): { chiPaga: ChiPagaIlFisco; fonte: FonteRisposta } {
  if (dichiarato) return { chiPaga: dichiarato, fonte: "dichiarato" };
  if (lettura.misurato) return { chiPaga: lettura.misurato, fonte: "misurato" };
  return { chiPaga: "personale", fonte: "predefinito" };
}

/**
 * La dichiarazione salvata dice il contrario di quello che i segnali misurano.
 *
 * Una risposta data a gennaio resta vera finché resta vero il modo di pagare,
 * e quello cambia: si apre un conto, si smette di girare l'F24 al
 * commercialista, si comincia a prelevarsi il lordo. Una dichiarazione vecchia
 * è indistinguibile da una giusta, e nessuno torna in configurazione a
 * ricontrollarla: tocca all'app accorgersene e dirlo.
 */
export function dichiarazioneContraddetta(
  dichiarato: ChiPagaIlFisco | null | undefined,
  lettura: LetturaChiPaga,
): boolean {
  /*
    `!dichiarato` e non `dichiarato !== null`.

    Un archivio salvato prima che il campo esistesse non porta `null`: non
    porta niente. Con il confronto secco su `null`, `undefined` passava per una
    dichiarazione, e la prima volta che i segnali dicevano qualcosa compariva
    l'avviso in ambra «hai risposto X, ma adesso l'archivio dice il contrario»
    a qualcuno che non aveva mai risposto.
  */
  return Boolean(dichiarato) && lettura.misurato !== null && lettura.misurato !== dichiarato;
}
