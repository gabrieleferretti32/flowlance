import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PREZZO, PREZZO_SCRITTO } from "./acquisto";
import { euro, euroTondo, percentuale } from "@/lib/format";

/**
 * Il prezzo si scrive in un modo solo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il difetto che questa tagliola esiste per rendere impossibile
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il pulsante della testata diceva «97,00 € + IVA»; due schermate più giù, la
 * sezione del prezzo diceva «97 € all'anno». Stesso numero, due formati, due
 * chiamate diverse a due formatter diversi.
 *
 * Il controllo che c'era confrontava i **valori** — 97 di qua, 97 di là — e
 * passava, perché di valori sbagliati non ce n'erano. È la stessa forma di
 * sempre, spostata di un passo: non due numeri che divergono, ma due modi di
 * scrivere lo stesso numero. Da fuori si legge come un rincaro o come un
 * refuso, e in una pagina che chiede dei soldi non è un dettaglio.
 *
 * La risposta è quella di sempre: **una strada sola**. `PREZZO_SCRITTO` decide
 * una volta come si scrive ciascuna voce, e le pagine non scelgono più. Questi
 * test sorvegliano che nessuno riapra la seconda strada.
 */

const PAGINE = [
  "src/app/(sito)/page.tsx",
  "src/app/(sito)/acquista/schermata-acquisto.tsx",
];

/** Il sorgente senza commenti: lì i numeri si citano per raccontare, e va bene. */
function codiceDi(percorso: string): string {
  return readFileSync(percorso, "utf8")
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("il prezzo scritto", () => {
  it("è il prezzo, formattato come si mostra", () => {
    expect(PREZZO_SCRITTO.imponibile).toBe(euroTondo(PREZZO.imponibile));
    expect(PREZZO_SCRITTO.totale).toBe(euro(PREZZO.totale));
    expect(PREZZO_SCRITTO.aliquota).toBe(percentuale(PREZZO.aliquotaIva, 0));
  });

  it("l'imponibile non porta centesimi, il totale sì", () => {
    // Le due forme sono diverse per scelta, e la scelta è qui dentro: se un
    // giorno cambia, cambia in un posto e in tutte le pagine insieme.
    expect(PREZZO_SCRITTO.imponibile).not.toMatch(/,/);
    expect(PREZZO_SCRITTO.totale).toMatch(/,\d{2}\s*€$/);
  });

  it("nessuna pagina formatta il prezzo per conto suo", () => {
    const colpevoli: string[] = [];
    for (const percorso of PAGINE) {
      const codice = codiceDi(percorso);
      /*
        Qualunque formatter applicato a un campo di `PREZZO` è una seconda
        strada: `euro(PREZZO.totale)`, `euroTondo(PREZZO.imponibile)`,
        `percentuale(PREZZO.aliquotaIva, 0)`. Il prezzo si prende già scritto.
      */
      const seconde = codice.match(/\b(euro|euroTondo|percentuale|interoIt\.format)\s*\(\s*PREZZO\./g);
      if (seconde) colpevoli.push(`${percorso}: ${seconde.join(", ")}`);
    }
    expect(
      colpevoli,
      `Il prezzo viene formattato fuori da PREZZO_SCRITTO:\n${colpevoli.join("\n")}\n\n`
        + "È così che la testata ha finito per dire «97,00 € + IVA» mentre la sezione del\n"
        + "prezzo diceva «97 €»: stesso numero, due strade, due formati.",
    ).toEqual([]);
  });

  it("le cifre del prezzo non sono scritte a mano in nessuna pagina", () => {
    const acaso = [
      String(PREZZO.imponibile),
      PREZZO_SCRITTO.totale.replace(/\s*€$/, ""),
      String(PREZZO.aliquotaIva * 100),
    ];
    const colpevoli: string[] = [];
    for (const percorso of PAGINE) {
      const codice = codiceDi(percorso);
      // Fuori da un identificatore e fuori da un numero più lungo: `1140` non
      // è il prezzo, e nemmeno `97` dentro `1970`.
      for (const cifra of acaso) {
        const dentro = new RegExp(`(^|[^\\w.,])${cifra.replace(".", "[.,]")}(?![\\w.,])`);
        if (dentro.test(codice)) colpevoli.push(`${percorso}: «${cifra}»`);
      }
    }
    expect(
      colpevoli,
      `Cifre del prezzo scritte a mano:\n${colpevoli.join("\n")}\n\n`
        + "Il prezzo cambia una volta sola, in src/lib/sito/acquisto.ts.",
    ).toEqual([]);
  });
});
