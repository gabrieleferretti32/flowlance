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
import { euro } from "@/lib/format";
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
// Controlli
// ————————————————————————————————————————————————————————————

export type AvvisoNota = {
  notaId: string;
  numero: string;
  gravita: "avviso" | "errore";
  messaggio: string;
};

/**
 * Cosa non torna nelle note.
 *
 * Nessuno di questi casi ferma il calcolo: la nota è emessa e conta comunque.
 * Sono cose da sistemare, non da bloccare.
 */
export function controlliNote(
  note: readonly NotaCredito[],
  fatture: readonly Pick<Fattura, "id" | "imponibile">[],
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
          gravita: "errore",
          messaggio: "È agganciata a una fattura che non esiste più.",
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
          gravita: "errore",
          messaggio: `Le note agganciate superano l'imponibile della fattura: ${euro(voce.stornato)} su ${euro(originale.imponibile)}.`,
        });
      }
    }
  }

  return avvisi;
}
