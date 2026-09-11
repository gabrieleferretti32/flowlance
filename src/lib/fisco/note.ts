/**
 * Note di credito: calcolo e riconciliazione.
 *
 * Modulo puro, accanto agli altri del motore. Due cose stanno qui: come una
 * nota si scompone in imponibile, IVA e totale — le stesse regole della
 * fattura, applicate a uno storno — e come si lega alle fatture che rettifica.
 *
 * La riconciliazione serve all'utente per sapere a cosa si riferisce uno
 * storno, **non al motore per calcolare**: una nota emessa riduce ricavi e IVA
 * comunque, perché il documento esiste e il fisco lo conta. Chi non aggancia
 * niente resta con i conti giusti e un avviso.
 */
import { data, euro } from "@/lib/format";
import { round2 } from "./aritmetica";
import { annoDi } from "./documenti";
import type { DateDocumento } from "./competenza";
import type { Fattura, Impostazioni, NotaCredito } from "./tipi";

/** Le due date di una nota, per `ripartisci`: identiche a quelle di una fattura. */
export function dateNota(n: Pick<NotaCredito, "dataDocumento" | "dataRimborso">): DateDocumento {
  return { documento: n.dataDocumento, cassa: n.dataRimborso ?? null };
}

export type StatoNota = "rimborsata" | "daRimborsare";

export type NotaCalcolata = NotaCredito & {
  aliquotaIvaApplicata: number;
  /** L'IVA che la nota toglie dal debito. Positiva: il segno lo dà il verso. */
  iva: number;
  totale: number;
  /** Quanto della nota è agganciato a una fattura. */
  riconciliato: number;
  /** Quanto resta senza destinazione. Calcolato, mai salvato. */
  residuo: number;
  riconciliataDelTutto: boolean;
  stato: StatoNota;
  anno: number;
};

/**
 * Scompone una nota con le regole del suo anno.
 *
 * In forfettario non c'è IVA da stornare, come non ce n'è da addebitare: il
 * regime non la espone, e una nota che ne togliesse creerebbe un credito dal
 * nulla.
 */
export function calcolaNota(n: NotaCredito, imp: Impostazioni): NotaCalcolata {
  const forfettario = imp.regime === "forfettario";
  const aliquota = forfettario ? 0 : (n.aliquotaIva ?? imp.aliquotaIva);
  // Difensivo e voluto: l'archivio tiene le note in positivo, ma un import o un
  // backup scritto a mano potrebbero portarne una col meno. Meglio normalizzare
  // qui che sommare uno storno che aumenta il fatturato.
  const imponibile = round2(Math.abs(n.imponibile));
  const iva = round2(imponibile * aliquota);

  const riconciliato = round2(
    (n.riconciliazioni ?? []).reduce((a, r) => a + Math.abs(r.imponibile), 0),
  );
  const residuo = round2(Math.max(0, imponibile - riconciliato));

  return {
    ...n,
    imponibile,
    aliquotaIvaApplicata: aliquota,
    iva,
    totale: round2(imponibile + iva),
    riconciliato,
    residuo,
    riconciliataDelTutto: residuo === 0,
    stato: n.dataRimborso ? "rimborsata" : "daRimborsare",
    anno: annoDi(n.dataDocumento),
  };
}

/** Riporta una nota calcolata alla sua forma grezza. Come `fatturaGrezza`. */
export function notaGrezza(n: NotaCredito | NotaCalcolata): NotaCredito {
  return {
    id: n.id,
    dataDocumento: n.dataDocumento,
    numero: n.numero,
    clienteId: n.clienteId,
    descrizione: n.descrizione,
    imponibile: n.imponibile,
    ...(n.aliquotaIva === undefined ? {} : { aliquotaIva: n.aliquotaIva }),
    dataRimborso: n.dataRimborso ?? null,
    riconciliazioni: (n.riconciliazioni ?? []).map((r) => ({
      fatturaId: r.fatturaId,
      imponibile: r.imponibile,
    })),
  };
}

// ————————————————————————————————————————————————————————————
// Il lato fattura
// ————————————————————————————————————————————————————————————

export type StornoSuFattura = {
  /** Quanto le note tolgono a questa fattura. */
  stornato: number;
  /** Imponibile della fattura meno lo storno. Mai sotto zero. */
  netto: number;
  /** Le note che la rettificano, con l'importo agganciato. */
  note: { notaId: string; numero: string; imponibile: number }[];
};

/**
 * Quanto resta di ogni fattura, viste le note.
 *
 * Il residuo si legge da entrambi i lati — sulla fattura «700 € netti», sulla
 * nota «200 € ancora da riconciliare» — e da nessuna delle due parti è salvato:
 * un numero derivato che finisce in archivio, prima o poi, diverge.
 */
export function stornoPerFattura(
  note: readonly NotaCredito[],
  fatture: readonly Pick<Fattura, "id" | "imponibile">[],
): Map<string, StornoSuFattura> {
  const per = new Map<string, StornoSuFattura>();
  for (const f of fatture) {
    per.set(f.id, { stornato: 0, netto: round2(f.imponibile), note: [] });
  }

  for (const n of note) {
    for (const r of n.riconciliazioni ?? []) {
      const voce = per.get(r.fatturaId);
      // Riferimento a una fattura che non c'è più: si ignora qui e si segnala
      // altrove. Far sparire l'intera nota per un aggancio morto sarebbe peggio.
      if (!voce) continue;
      const importo = round2(Math.abs(r.imponibile));
      voce.stornato = round2(voce.stornato + importo);
      voce.note.push({ notaId: n.id, numero: n.numero, imponibile: importo });
    }
  }

  for (const [id, voce] of per) {
    const originale = fatture.find((f) => f.id === id)?.imponibile ?? 0;
    voce.netto = round2(Math.max(0, originale - voce.stornato));
  }
  return per;
}

// ————————————————————————————————————————————————————————————
// Quando uno storno tocca la cassa
// ————————————————————————————————————————————————————————————

export type StornoCassa = {
  notaId: string;
  /** La fattura da cui lo storno è stato tolto, se si sa quale. */
  fatturaId: string | null;
  importo: number;
  /** Il giorno in cui il denaro si è mosso — o non è arrivato. */
  data: string;
  via: "rimborso" | "compensazione";
};

/**
 * Gli storni che hanno toccato la cassa, uno per movimento.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il difetto che questa funzione chiude
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Fino a ieri lo storno scendeva dai ricavi per cassa **solo** se la nota
 * portava una data di rimborso. È giusto quando i soldi tornano indietro
 * davvero, ed è il caso raro. Quello normale è l'altro: la nota si emette
 * prima che il cliente paghi, e il cliente **paga il netto**. Nessun rimborso,
 * nessuna data, e quindi — per l'app — nessuno storno di cassa. Intanto la
 * fattura risulta incassata per intero, perché è quello che c'è scritto sopra.
 *
 * Il risultato si vedeva sul cruscotto come «Incassato 31.166,53 €, 104 % · su
 * 29.896,04 € emessi»: l'emesso al netto della nota, l'incassato no, e la
 * differenza esattamente lo storno. Ma il numero sbagliato non era quello del
 * riquadro: `ricaviRilevanti` regge il reddito, i contributi, le imposte e
 * l'accantonamento. Uno storno che non scende gonfia tutta la colonna.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La regola, in una frase
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Uno storno tocca la cassa **una volta sola**, e quando il denaro si muove:
 *
 * — se la nota ha una data di rimborso, a quella data: i soldi sono tornati;
 * — altrimenti, se è agganciata a una fattura incassata **dopo** che la nota
 *   esisteva, alla data di quell'incasso: il cliente ha pagato il netto, e la
 *   differenza non è mai entrata;
 * — altrimenti niente. Fattura non ancora incassata: si vedrà quando sarà
 *   pagata. Fattura incassata **prima** della nota: il cliente aveva già pagato
 *   tutto, quindi c'è un rimborso che deve ancora partire, e finché non parte
 *   la cassa è quella che è. Storno non agganciato a nessuna fattura: non si sa
 *   da quale incasso togliere, e sceglierne uno a caso sposterebbe i conti di
 *   un altro committente.
 *
 * Il confronto fra le due date è ciò che distingue i due casi, e non è un
 * dettaglio: senza, lo stesso aggancio direbbe «pagato netto» anche quando il
 * bonifico era arrivato intero il mese prima.
 *
 * La somma degli importi restituiti per una nota non supera mai il suo
 * imponibile, anche quando le riconciliazioni ne coprono di più — un caso che
 * `controlliNote` segnala e che qui non deve poter gonfiare uno sconto.
 */
export function storniDiCassa(
  note: readonly NotaCredito[],
  fatture: readonly Pick<Fattura, "id" | "dataIncasso" | "importoIncassato">[],
): StornoCassa[] {
  const perId = new Map(fatture.map((f) => [f.id, f]));
  const movimenti: StornoCassa[] = [];

  for (const n of note) {
    let restante = round2(Math.abs(n.imponibile));
    const prendi = (chiesto: number): number => {
      const importo = round2(Math.min(restante, chiesto));
      restante = round2(restante - importo);
      return importo;
    };

    if (n.dataRimborso) {
      // Rimborsata: scende tutta, alla data del rimborso. Gli agganci servono
      // ancora, ma solo a dire da quale fattura togliere — la base delle
      // ritenute ne ha bisogno.
      for (const r of n.riconciliazioni ?? []) {
        const importo = prendi(Math.abs(r.imponibile));
        if (importo <= 0) break;
        movimenti.push({
          notaId: n.id,
          fatturaId: r.fatturaId,
          importo,
          data: n.dataRimborso,
          via: "rimborso",
        });
      }
      if (restante > 0) {
        movimenti.push({
          notaId: n.id,
          fatturaId: null,
          importo: restante,
          data: n.dataRimborso,
          via: "rimborso",
        });
      }
      continue;
    }

    for (const r of n.riconciliazioni ?? []) {
      const f = perId.get(r.fatturaId);
      if (!f?.dataIncasso) continue;
      /*
        Se la fattura dice **quanto** è arrivato, non c'è niente da compensare:
        quel numero è già il netto che il cliente ha pagato, e togliergli anche
        lo storno lo toglierebbe due volte. Questo ramo esiste solo per le
        fatture che non lo dicono — quelle scritte prima che il campo esistesse,
        dove «incassata» vuol dire «tutta» e la compensazione va dedotta.
      */
      if (f.importoIncassato !== undefined) continue;
      // Le date ISO si confrontano come stringhe: stesso formato, stesso ordine.
      if (f.dataIncasso < n.dataDocumento) continue;
      const importo = prendi(Math.abs(r.imponibile));
      if (importo <= 0) break;
      movimenti.push({
        notaId: n.id,
        fatturaId: f.id,
        importo,
        data: f.dataIncasso,
        via: "compensazione",
      });
    }
  }

  return movimenti;
}

// ————————————————————————————————————————————————————————————
// Controlli
// ————————————————————————————————————————————————————————————

/**
 * Di che avviso si tratta.
 *
 * Esiste perché chi lo mostra possa decidere **per genere** e non leggendo il
 * testo del messaggio. La schermata delle note filtrava così:
 *
 *     problemi.filter((m) => m.includes("non esiste più") || m.includes("superano"))
 *
 * cioè mostrava due frasi note e buttava via tutto il resto. Quando è nato
 * l'avviso sulla fattura incassata prima della nota, il motore lo calcolava e la
 * schermata lo scartava in silenzio — nessun errore, nessuna riga vuota, solo
 * un avviso che non esisteva per chi guardava. È la solita famiglia: un valore
 * calcolato e uno mostrato che non si parlano.
 */
export type GenereAvviso =
  | "residuo"
  | "fatturaSparita"
  | "incassoPrimaDellaNota"
  | "rimborsoDovuto"
  | "stornoEccessivo";

export type AvvisoNota = {
  notaId: string;
  numero: string;
  genere: GenereAvviso;
  gravita: "avviso" | "errore";
  messaggio: string;
};

/**
 * I generi che una schermata può nascondere perché li dice già in altra forma.
 *
 * Uno solo: il residuo, che sulla riga della nota è già una targhetta con
 * l'importo. Tutto il resto si mostra. La lista sta qui e non dentro il
 * componente perché è una decisione sul significato degli avvisi, e perché un
 * test possa verificare che gli altri generi arrivano davvero a schermo.
 */
export const AVVISI_DETTI_ALTROVE: readonly GenereAvviso[] = ["residuo"];

/**
 * Cosa non torna nelle note.
 *
 * Nessuno di questi casi ferma il calcolo: la nota è emessa e conta comunque.
 * Sono cose da sistemare, non da bloccare.
 */
export function controlliNote(
  note: readonly NotaCredito[],
  fatture: readonly (Pick<Fattura, "id" | "imponibile" | "dataIncasso" | "importoIncassato"> & {
    /** Da `calcolaFattura`: quanto è arrivato oltre il dovuto dopo le note. */
    rimborsoDovuto?: number;
  })[],
): AvvisoNota[] {
  const avvisi: AvvisoNota[] = [];
  const perId = new Map(fatture.map((f) => [f.id, f]));
  const storni = stornoPerFattura(note, fatture);

  for (const n of note) {
    // Qui serve solo il residuo, che non dipende dal regime né dall'aliquota.
    const c = calcolaNota(n, { regime: "ordinario", aliquotaIva: 0 } as Impostazioni);

    if (c.residuo > 0) {
      avvisi.push({
        notaId: n.id,
        numero: n.numero,
        genere: "residuo",
        gravita: "avviso",
        messaggio:
          c.riconciliato === 0
            ? "Non è riconciliata a nessuna fattura: riduce comunque ricavi e IVA."
            : `Riconciliata solo in parte: restano ${euro(c.residuo)} senza fattura.`,
      });
    }

    for (const r of n.riconciliazioni ?? []) {
      if (!perId.has(r.fatturaId)) {
        avvisi.push({
          notaId: n.id,
          numero: n.numero,
          genere: "fatturaSparita",
          gravita: "errore",
          messaggio: "È agganciata a una fattura che non esiste più.",
        });
        continue;
      }

      /*
        Il caso che l'app non sa raccontare, e che va detto invece di essere
        deciso al posto di chi legge.

        La fattura era già stata **incassata per intero** quando la nota è
        nata. O il denaro è tornato indietro — e allora la nota vuole la sua
        data di rimborso — oppure quell'incasso, in archivio, è al lordo di uno
        storno che il cliente non ha mai pagato. Nel secondo caso i ricavi per
        cassa dell'anno sono più alti del vero, e dietro ci sono reddito,
        contributi, imposte e accantonamento.

        Non si indovina: `storniDiCassa` lascia la cassa dov'è e questo avviso
        chiede la data. Dedurre un rimborso mai registrato sarebbe inventare un
        movimento di denaro dentro un registro fiscale.
      */
      const f = perId.get(r.fatturaId);
      if (!f?.dataIncasso || n.dataRimborso) continue;

      if (f.importoIncassato === undefined) {
        /*
          La fattura non dice quanto è arrivato, quindi «incassata» vuol dire
          «tutta» e l'app non può distinguere due storie: il cliente ha pagato
          tutto e aspetta un rimborso, oppure ha pagato corto e la nota è venuta
          dopo a chiudere. Dalle date si può solo sospettare. Quindi si chiede
          il fatto — quanto è arrivato — invece del rimedio.
        */
        if (f.dataIncasso < n.dataDocumento) {
          avvisi.push({
            notaId: n.id,
            numero: n.numero,
            genere: "incassoPrimaDellaNota",
            gravita: "avviso",
            messaggio:
              `La fattura era già stata incassata il ${data(f.dataIncasso)}, prima di questa nota: `
              + "scrivi sulla fattura quanto ti è arrivato davvero, così i ricavi per cassa "
              + "smettono di contare anche lo storno.",
          });
        }
        continue;
      }

      /*
        Qui invece l'importo c'è, e il rimborso non si indovina: si calcola.
        Il numero arriva da `calcolaFattura`, dove si sa che quello che è
        arrivato e quello che era dovuto stanno sulla stessa base — IVA
        compresa, ritenuta già tolta.
      */
      const eccedenza = round2(f.rimborsoDovuto ?? 0);
      if (eccedenza > 0.005) {
        avvisi.push({
          notaId: n.id,
          numero: n.numero,
          genere: "rimborsoDovuto",
          gravita: "avviso",
          messaggio:
            `Hai incassato ${euro(f.importoIncassato)}, più del dovuto dopo questa nota: `
            + `devi un rimborso di ${euro(eccedenza)}. Quando parte, segna la data qui accanto.`,
        });
      }
    }
  }

  // Una fattura stornata per più del suo imponibile: quasi sempre due note
  // sullo stesso documento, o un importo digitato con uno zero di troppo.
  for (const [id, voce] of storni) {
    const originale = perId.get(id);
    if (originale && voce.stornato > round2(originale.imponibile) + 0.005) {
      for (const nota of voce.note) {
        avvisi.push({
          notaId: nota.notaId,
          numero: nota.numero,
          genere: "stornoEccessivo",
          gravita: "errore",
          messaggio: `Le note agganciate superano l'imponibile della fattura: ${euro(voce.stornato)} su ${euro(originale.imponibile)}.`,
        });
      }
    }
  }

  return avvisi;
}
