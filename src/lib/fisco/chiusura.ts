/**
 * La chiusura dell'anno e i riporti verso quello successivo.
 *
 * Il 31 dicembre non azzera niente. Attraversano il confine il saldo di cassa,
 * le tasse accantonate, il credito IVA, i crediti d'imposta, e le fatture e i
 * costi rimasti in sospeso. Se uno di questi riporti si perde per strada l'app
 * non segnala nulla: mostra un numero credibile e sbagliato. È il motivo per
 * cui questo modulo è puro e testato riga per riga.
 *
 * Nota sulla persistenza: della chiusura si salvano solo le **decisioni**
 * (destinazione del credito IVA, regime confermato, data, note) più
 * un'istantanea di sola lettura. Gli importi dei riporti si ricalcolano sempre
 * dai documenti, così una fattura del 2026 registrata a marzo del 2027 si
 * propaga da sola. L'istantanea non entra mai in un calcolo: serve solo a
 * mostrare che qualcosa è cambiato dopo la chiusura.
 */
import { nonNegativo, round2, somma } from "./aritmetica";
import { annoDi } from "./documenti";
import { dateCosto, dateFattura, ripartisci } from "./competenza";
import { dateNota } from "./note";
import { aliquoteIrpefNonDichiarate, elencoInTesto } from "./parametri-utente";
import { cambiamentiDiRegime } from "./regime";
import { euro } from "../format";
import type { LiquidazioneIva } from "./iva";
import type { Prospetto } from "./motore";
import type { CostoCalcolato, FatturaCalcolata, Impostazioni, ParametriAnno, Regime } from "./tipi";

export type DestinazioneCreditoIva = "compensazione" | "rimborso";

/** Quel tanto del cashflow che serve alla chiusura: saldo e accantonato al 31 dicembre. */
export type SaldiDiFineAnno = {
  saldoFinale: number;
  accantonatoTotale: number;
};

/**
 * Fotografia dei riporti al momento della chiusura.
 * Sola lettura, mai un ingresso di calcolo: confrontarla con i valori ricalcolati
 * è l'unico modo per accorgersi che un documento è stato aggiunto dopo.
 */
export type IstantaneaChiusura = {
  saldoCassa: number;
  accantonato: number;
  creditoIva: number;
  creditoImposte: number;
  ricaviRilevanti: number;
  fattureDaIncassare: number;
  costiDaPagare: number;
  /** Facoltativo: le chiusure salvate prima delle note di credito non ce l'hanno. */
  noteDaRimborsare?: number;
};

/** La chiusura come sta nel database: decisioni, non importi calcolati. */
export type ChiusuraAnno = {
  anno: number;
  /** Data e ora della chiusura, in ISO. */
  chiusaIl: string;
  destinazioneCreditoIva: DestinazioneCreditoIva;
  /** Il regime confermato per l'anno successivo al momento della chiusura. */
  regimeAnnoSuccessivo: Regime;
  note: string;
  istantanea: IstantaneaChiusura;
};

export type Sospesi = {
  numero: number;
  importo: number;
  /**
   * Quanti sono ancora aperti alla data di oggi.
   *
   * Diverso da `numero`: al 31 dicembre una fattura di dicembre non era
   * incassata, ma a marzo può esserlo già. Il riporto conta tutte quelle che
   * attraversano il confine — è la loro cassa a spostarsi di anno — mentre
   * questo conta quelle che restano da sollecitare.
   */
  numeroAncoraAperti: number;
};

/** Quello che passa da un anno al successivo. */
export type Riporto = {
  daAnno: number;
  aAnno: number;
  /** Saldo di cassa al 31 dicembre: diventa il saldo iniziale dell'anno nuovo. */
  saldoCassa: number;
  /** Tasse accantonate e non ancora versate: servono a pagare a giugno. */
  accantonato: number;
  /** Credito IVA residuo al 31 dicembre. */
  creditoIva: number;
  destinazioneCreditoIva: DestinazioneCreditoIva;
  /** Il credito IVA entra nella liquidazione dell'anno nuovo solo se compensato. */
  creditoIvaInLiquidazione: number;
  /** Crediti d'imposta: ritenute eccedenti, versamenti in eccesso, credito non utilizzato. */
  creditoImposte: number;
  /** Fatture emesse e non ancora incassate: diventeranno ricavo dell'anno in cui rientrano. */
  fattureDaIncassare: Sospesi;
  /** Costi con documento nell'anno e non ancora pagati: si dedurranno quando li paghi. */
  costiDaPagare: Sospesi;
  /**
   * Note di credito emesse e non ancora rimborsate.
   *
   * Attraversano il confine come le fatture, con il segno opposto: hanno già
   * ridotto l'IVA a debito di quest'anno — la data del documento è di
   * quest'anno — ma i ricavi caleranno solo nell'anno in cui il denaro torna al
   * cliente. Senza questa riga il riporto direbbe che l'anno nuovo comincia con
   * più ricavi attesi di quanti ne avrà davvero.
   */
  noteDaRimborsare: Sospesi;
  /**
   * Quanto delle note emesse non è agganciato a nessuna fattura.
   *
   * Non cambia un solo numero — una nota emessa riduce ricavi e IVA comunque —
   * ma è la cosa da sistemare prima di chiudere: dopo, ricostruire a cosa si
   * riferiva uno storno di due anni fa non lo fa più nessuno.
   */
  noteNonRiconciliate: number;
};

export function riportoVuoto(daAnno: number): Riporto {
  return {
    daAnno,
    aAnno: daAnno + 1,
    saldoCassa: 0,
    accantonato: 0,
    creditoIva: 0,
    destinazioneCreditoIva: "compensazione",
    creditoIvaInLiquidazione: 0,
    creditoImposte: 0,
    fattureDaIncassare: { numero: 0, importo: 0, numeroAncoraAperti: 0 },
    noteDaRimborsare: { numero: 0, importo: 0, numeroAncoraAperti: 0 },
    noteNonRiconciliate: 0,
    costiDaPagare: { numero: 0, importo: 0, numeroAncoraAperti: 0 },
  };
}

export type IngressoRiporto = {
  anno: number;
  prospetto: Prospetto;
  iva: LiquidazioneIva;
  /** I due saldi di fine anno. Struttura minima: il motore non dipende da `analisi`. */
  cashflow: SaldiDiFineAnno;
  /** La chiusura salvata, se l'anno è stato chiuso. Ne servono solo le decisioni. */
  chiusura?: ChiusuraAnno | null;
};

/**
 * I riporti dall'anno indicato a quello successivo.
 *
 * Gli importi arrivano sempre dal ricalcolo, mai dall'istantanea salvata: se a
 * marzo salta fuori una fattura dell'anno chiuso, il riporto la incorpora senza
 * che nessuno debba ricordarsi di aggiornare qualcosa.
 */
export function calcolaRiporto(ing: IngressoRiporto): Riporto {
  const { anno, prospetto: p, iva, cashflow } = ing;
  const destinazione = ing.chiusura?.destinazioneCreditoIva ?? "compensazione";
  const creditoIva = round2(nonNegativo(iva.creditoFinale));

  // Tre crediti diversi che finiscono nello stesso posto: le ritenute che hanno
  // superato le imposte, i versamenti fatti in eccesso, e il credito dell'anno
  // ancora prima che non è servito.
  const eccedenzaVersamenti = nonNegativo(p.giaVersato - p.totaleDovuto);
  const creditoImposte = round2(
    somma(p.creditoImposta, eccedenzaVersamenti, p.acconti.creditoResiduo),
  );

  // Attraversano il confine sia i documenti la cui cassa cade in un anno
  // successivo, sia quelli che una cassa non ce l'hanno ancora: in entrambi i
  // casi il ricavo o la deduzione non è di quest'anno. Contare solo i secondi
  // farebbe sparire dal riporto la fattura di dicembre incassata a gennaio,
  // che è esattamente il caso per cui il riporto esiste.
  const rf = ripartisci(p.fattureCalcolate, anno, dateFattura);
  const rc = ripartisci(p.costiCalcolati, anno, dateCosto);
  // Le note dalla stessa funzione, con le loro due date: nessuna regola nuova.
  const rn = ripartisci(p.noteCalcolate, anno, dateNota);
  const sospese = [...rf.versoAnniSuccessivi, ...rf.sospesi] as FatturaCalcolata[];
  const daPagare = [...rc.versoAnniSuccessivi, ...rc.sospesi] as CostoCalcolato[];
  const daRimborsare = [...rn.versoAnniSuccessivi, ...rn.sospesi];

  return {
    daAnno: anno,
    aAnno: anno + 1,
    saldoCassa: cashflow.saldoFinale,
    accantonato: cashflow.accantonatoTotale,
    creditoIva,
    destinazioneCreditoIva: destinazione,
    // A rimborso il credito esce dal circuito della liquidazione: chiederlo e
    // insieme compensarlo sarebbe contarlo due volte.
    creditoIvaInLiquidazione: destinazione === "compensazione" ? creditoIva : 0,
    creditoImposte,
    fattureDaIncassare: {
      numero: sospese.length,
      importo: somma(...sospese.map((f) => f.totale)),
      numeroAncoraAperti: rf.sospesi.length,
    },
    costiDaPagare: {
      numero: daPagare.length,
      importo: somma(...daPagare.map((c) => c.totale)),
      numeroAncoraAperti: rc.sospesi.length,
    },
    noteDaRimborsare: {
      numero: daRimborsare.length,
      importo: somma(...daRimborsare.map((n) => n.totale)),
      numeroAncoraAperti: rn.sospesi.length,
    },
    // Tutte le note dell'anno, non solo quelle da rimborsare: una nota già
    // rimborsata e mai agganciata resta un buco nella ricostruzione.
    noteNonRiconciliate: somma(...rn.perCompetenza.map((n) => n.residuo)),
  };
}

export function istantaneaDa(riporto: Riporto, p: Prospetto): IstantaneaChiusura {
  return {
    saldoCassa: riporto.saldoCassa,
    accantonato: riporto.accantonato,
    creditoIva: riporto.creditoIva,
    creditoImposte: riporto.creditoImposte,
    ricaviRilevanti: p.ricaviRilevanti,
    fattureDaIncassare: riporto.fattureDaIncassare.importo,
    costiDaPagare: riporto.costiDaPagare.importo,
    noteDaRimborsare: riporto.noteDaRimborsare.importo,
  };
}

// ————————————————————————————————————————————————————————————
// Cambio di regime
// ————————————————————————————————————————————————————————————

export type MotivoRegime =
  | "nessunCambio"
  | "limiteSuperato"
  | "uscitaImmediata"
  | "rientroDaValutare";

export type PropostaRegime = {
  regimeAttuale: Regime;
  regimeProposto: Regime;
  motivo: MotivoRegime;
  /** Il cambio va proposto all'utente, non solo raccontato. */
  daProporre: boolean;
  /** Data da cui decorre il nuovo regime, in ISO. */
  decorrenza: string;
  /** La fattura che ha fatto superare la soglia di uscita immediata, se c'è. */
  fatturaCheSupera: FatturaCalcolata | null;
  titolo: string;
  spiegazione: string;
  conseguenze: string[];
};


/**
 * Le conseguenze del passaggio all'ordinario, in forma breve.
 *
 * L'elenco è quello di `cambiamentiDiRegime`: la proposta di chiusura ne
 * mostra i titoli, il percorso di configurazione anche i dettagli. Una fonte
 * sola, così le aliquote citate sono sempre quelle dell'anno.
 */
function conseguenzeOrdinario(imp: Impostazioni, par: ParametriAnno): string[] {
  return cambiamentiDiRegime("forfettario", "ordinario", imp, par).map((c) => c.titolo);
}

/**
 * Il regime dell'anno successivo, dedotto dai ricavi dell'anno che si chiude.
 *
 * Non è una tendina del Setup che qualcuno deve ricordarsi di girare a gennaio:
 * superata la soglia il cambio è automatico per legge, e l'app deve dirlo nel
 * momento in cui chiude l'anno.
 */
export function proponiRegime(
  p: Prospetto,
  imp: Impostazioni,
  par: ParametriAnno,
): PropostaRegime {
  const anno = p.anno;
  const primoGennaio = `${anno + 1}-01-01`;

  if (imp.regime === "ordinario") {
    // Il rientro nel forfettario è possibile ma dipende da requisiti che l'app
    // non conosce (spese per dipendenti, partecipazioni, redditi da lavoro
    // dipendente). Si segnala, non si propone.
    /*
      Il limite è quello delle impostazioni dell'anno, lo stesso su cui il
      motore decide `statoSoglia`. Qui si leggeva quello dei parametri: due
      fonti per la stessa soglia, e la chiusura poteva dire «saresti sotto il
      limite» misurando su un numero che il prospetto non aveva usato.
    */
    const sottoLimite = p.ricaviRilevanti <= imp.limiteForfettario;
    return {
      regimeAttuale: "ordinario",
      regimeProposto: "ordinario",
      motivo: sottoLimite ? "rientroDaValutare" : "nessunCambio",
      daProporre: false,
      decorrenza: primoGennaio,
      fatturaCheSupera: null,
      titolo: sottoLimite
        ? "Resti in ordinario, ma il forfettario tornerebbe accessibile"
        : "Nessun cambio di regime",
      spiegazione: sottoLimite
        ? `Con ${euro(p.ricaviRilevanti)} di ricavi saresti sotto il limite di ${euro(imp.limiteForfettario)}. Il rientro nel forfettario dipende anche da requisiti che l'app non conosce: valutalo con il commercialista prima di cambiare.`
        : "I ricavi non fanno scattare alcun passaggio automatico di regime.",
      conseguenze: [],
    };
  }

  if (p.soglia.stato === "uscitaImmediata") {
    const fattura = fatturaCheSupera(p, imp.sogliaUscita);
    return {
      regimeAttuale: "forfettario",
      regimeProposto: "ordinario",
      motivo: "uscitaImmediata",
      daProporre: true,
      // L'uscita immediata non aspetta gennaio: colpisce l'anno in corso.
      decorrenza: fattura?.dataIncasso ?? `${anno}-01-01`,
      fatturaCheSupera: fattura,
      titolo: `Uscita immediata dal forfettario: sei già in ordinario per il ${anno}`,
      spiegazione: `Hai superato ${euro(imp.sogliaUscita)} di ricavi: il forfettario decade nello stesso anno, non dal successivo.${
        fattura
          ? ` La soglia è stata superata con la fattura ${fattura.numero || "senza numero"} incassata il ${fattura.dataIncasso}: da quell'operazione in poi l'IVA è dovuta.`
          : ""
      } È il caso in cui conviene sentire il commercialista prima di emettere altro.`,
      conseguenze: [
        `L'IVA è dovuta sulle operazioni dal superamento in poi, anche se le fatture sono state emesse senza.`,
        ...conseguenzeOrdinario(imp, par),
      ],
    };
  }

  if (p.soglia.stato === "limiteSuperato") {
    return {
      regimeAttuale: "forfettario",
      regimeProposto: "ordinario",
      motivo: "limiteSuperato",
      daProporre: true,
      decorrenza: primoGennaio,
      fatturaCheSupera: null,
      titolo: `Dal 1° gennaio ${anno + 1} sei in regime ordinario`,
      spiegazione: `Con ${euro(p.ricaviRilevanti)} di ricavi incassati hai superato il limite di ${euro(imp.limiteForfettario)}. Il ${anno} resta forfettario fino in fondo; è l'anno successivo che cambia, e cambia per legge.`,
      conseguenze: conseguenzeOrdinario(imp, par),
    };
  }

  return {
    regimeAttuale: "forfettario",
    regimeProposto: "forfettario",
    motivo: "nessunCambio",
    daProporre: false,
    decorrenza: primoGennaio,
    fatturaCheSupera: null,
    titolo: "Resti in regime forfettario",
    spiegazione: `Con ${euro(p.ricaviRilevanti)} di ricavi sei sotto il limite di ${euro(imp.limiteForfettario)}: il ${anno + 1} parte con lo stesso regime.`,
    conseguenze: [],
  };
}

/** La fattura, in ordine di incasso, con cui i ricavi hanno passato la soglia. */
function fatturaCheSupera(p: Prospetto, soglia: number): FatturaCalcolata | null {
  const incassate = p.fattureCalcolate
    .filter((f) => f.dataIncasso && annoDi(f.dataIncasso) === p.anno)
    .sort((a, b) => (a.dataIncasso as string).localeCompare(b.dataIncasso as string));
  let cumulato = 0;
  for (const f of incassate) {
    cumulato = round2(cumulato + f.ricavoRilevante);
    if (cumulato > soglia) return f;
  }
  return null;
}

// ————————————————————————————————————————————————————————————
// Controlli prima di chiudere, e scostamenti dopo
// ————————————————————————————————————————————————————————————

export type Controllo = {
  id: string;
  gravita: "blocco" | "attenzione" | "informazione";
  titolo: string;
  dettaglio: string;
};

/**
 * Cosa guardare prima di chiudere.
 *
 * Nessuno di questi controlli impedisce la chiusura tranne i parametri
 * provvisori: chiudere un anno con documenti in sospeso è legittimo, ma è
 * meglio saperlo prima che dopo.
 */
export function controlliChiusura(ing: {
  riporto: Riporto;
  prospetto: Prospetto;
  parametri: ParametriAnno;
  oggi: string;
}): Controllo[] {
  const { riporto: r, prospetto: p, parametri: par, oggi } = ing;
  const controlli: Controllo[] = [];

  if (par.provvisorio) {
    controlli.push({
      id: "parametri-provvisori",
      gravita: "blocco",
      titolo: `I parametri del ${par.anno} sono provvisori`,
      dettaglio:
        "Aliquote e soglie sono ereditate dall'anno precedente in attesa della Legge di Bilancio. Chiudere adesso significherebbe congelare una decisione presa su numeri stimati.",
    });
  }

  if (annoDi(oggi) <= p.anno) {
    controlli.push({
      id: "anno-in-corso",
      gravita: "attenzione",
      titolo: `Il ${p.anno} non è ancora finito`,
      // «I riporti si muoveranno ancora» diceva il vero e si capiva male:
      // sembrava che un anno chiuso continuasse a cambiare da sé, e che
      // «chiuso» non volesse dire niente. Qui si dice cosa succede davvero a
      // chi chiude oggi e registra una fattura di ottobre domani.
      dettaglio:
        `Puoi chiudere lo stesso. Chiudere registra le tue decisioni sul ${p.anno} — ` +
        "destinazione del credito IVA, regime dell'anno dopo — e ne fotografa i numeri; " +
        `non congela niente e non impedisce di registrare altri documenti nel ${p.anno}. ` +
        "Se dopo la chiusura aggiungi una fattura di ottobre, i riporti la incorporano da soli " +
        `e il ${p.anno + 1} si aggiorna: l'anno non si riapre, e non devi riaprirlo tu. ` +
        "Se qualcosa si muove, in testa alla schermata compare l'elenco di cosa è cambiato rispetto alla fotografia.",
    });
  }

  /*
    Un versamento senza anno d'imposta è contato sull'anno della sua data, che
    è la ricaduta e non un dato: se qualcuno di quelli era il saldo dell'anno
    prima, il saldo residuo che si sta per fotografare è più basso del vero.
    Chiudere è il momento in cui quel numero smette di essere provvisorio.
  */
  if (p.versamentiSenzaAnno > 0) {
    controlli.push({
      id: "versamenti-senza-anno",
      gravita: "attenzione",
      titolo: `${euro(p.versamentiSenzaAnno)} di versamenti senza anno d'imposta`,
      dettaglio:
        `Sono contati sul ${p.anno} perché è l'anno in cui li hai pagati, ma a giugno si versa ` +
        `insieme il saldo del ${p.anno - 1} e il primo acconto del ${p.anno}: se qualcuno di ` +
        "questi era un saldo dell'anno prima, qui sta abbassando il dovuto dell'anno sbagliato. " +
        "Assegna l'anno d'imposta dal Cashflow, poi chiudi.",
    });
  }

  if (r.fattureDaIncassare.numero > 0) {
    controlli.push({
      id: "fatture-sospese",
      gravita: "attenzione",
      titolo: `${r.fattureDaIncassare.numero} fatture emesse e non incassate`,
      dettaglio: `${euro(r.fattureDaIncassare.importo)} che diventeranno ricavo dell'anno in cui rientrano. L'IVA, invece, è già di competenza del ${p.anno}.`,
    });
  }

  if (r.costiDaPagare.numero > 0) {
    controlli.push({
      id: "costi-sospesi",
      gravita: "attenzione",
      titolo: `${r.costiDaPagare.numero} costi registrati e non pagati`,
      dettaglio: `${euro(r.costiDaPagare.importo)} che si dedurranno nell'anno del pagamento, mentre l'IVA è detraibile già nel ${p.anno}.`,
    });
  }

  if (r.creditoIva > 0) {
    controlli.push({
      id: "credito-iva",
      gravita: "informazione",
      titolo: `Credito IVA di ${euro(r.creditoIva)}`,
      dettaglio:
        r.destinazioneCreditoIva === "compensazione"
          ? "Scelto per la compensazione: entra come credito iniziale nella liquidazione dell'anno nuovo."
          : "Scelto per il rimborso: esce dal circuito della liquidazione e non riduce i versamenti dell'anno nuovo.",
    });
  }

  if (r.accantonato > 0) {
    controlli.push({
      id: "accantonato",
      gravita: "informazione",
      titolo: `${euro(r.accantonato)} di tasse accantonate`,
      dettaglio:
        "Restano impegnate anche dopo il 1° gennaio: servono a pagare il saldo di giugno e non tornano a contarsi come liquidità libera.",
    });
  }

  return controlli;
}

export type Scostamento = {
  voce: string;
  allaChiusura: number;
  adesso: number;
  differenza: number;
};

/**
 * Cosa è cambiato dopo la chiusura.
 *
 * Non è un errore: è la fattura ritrovata a marzo. Serve a decidere se riaprire
 * l'anno e ricontrollarlo, invece di scoprirlo dal commercialista.
 */
export function scostamentiDaChiusura(
  chiusura: ChiusuraAnno,
  riportoAttuale: Riporto,
  prospetto: Prospetto,
): Scostamento[] {
  const attuale = istantaneaDa(riportoAttuale, prospetto);
  const voci: [string, keyof IstantaneaChiusura][] = [
    ["Ricavi rilevanti", "ricaviRilevanti"],
    ["Saldo di cassa", "saldoCassa"],
    ["Tasse accantonate", "accantonato"],
    ["Credito IVA", "creditoIva"],
    ["Crediti d'imposta", "creditoImposte"],
    ["Fatture da incassare", "fattureDaIncassare"],
    ["Costi da pagare", "costiDaPagare"],
    ["Note da rimborsare", "noteDaRimborsare"],
  ];

  return voci
    .map(([voce, campo]) => {
      // Le chiusure salvate prima delle note di credito non hanno quella voce
      // nell'istantanea: si legge come zero, che è quello che valeva allora.
      const allaChiusura = chiusura.istantanea[campo] ?? 0;
      const adesso = attuale[campo] ?? 0;
      return { voce, allaChiusura, adesso, differenza: round2(adesso - allaChiusura) };
    })
    .filter((s) => s.differenza !== 0);
}

// ————————————————————————————————————————————————————————————
// Blocco dell'esportazione
// ————————————————————————————————————————————————————————————

export type EsitoEsportazione =
  | { consentita: true }
  | { consentita: false; motivo: string };

/**
 * Il prospetto si può esportare?
 *
 * No, finché i parametri dell'anno sono provvisori. Un PDF ha l'aria di un
 * documento definitivo: se poggia su aliquote dell'anno prima e finisce dal
 * commercialista, l'errore non si vede più.
 */
export function esportazioneProspettoConsentita(
  par: ParametriAnno,
  imp?: Impostazioni,
): EsitoEsportazione {
  if (par.provvisorio) {
    return {
      consentita: false,
      motivo: `I parametri del ${par.anno} sono provvisori: aliquote e soglie sono ancora quelle dell'anno precedente. L'export resta bloccato finché non escono i valori definitivi.`,
    };
  }
  // Stessa ragione, altra origine: qui le aliquote non mancano all'Italia,
  // mancano all'utente. Un prospetto che finisce dal commercialista non deve
  // contenere un'addizionale che nessuno ha mai confermato — sembrerebbe un
  // dato dichiarato, e nessuno riaprirebbe la domanda.
  const mancanti = imp ? aliquoteIrpefNonDichiarate(imp) : [];
  if (mancanti.length > 0) {
    const elenco = elencoInTesto(mancanti);
    return {
      consentita: false,
      motivo: `Non hai ancora confermato ${elenco}: il calcolo usa una media, e un documento da consegnare non deve contenere aliquote che non hai dichiarato. Si sblocca dai Parametri.`,
    };
  }
  return { consentita: true };
}

