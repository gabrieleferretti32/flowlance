import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DESTINAZIONE, SORGENTE, terminiCompleti, versioneDi } from "../../../strumenti/pacchetto-legale.mjs";

/**
 * Il contratto che si manda al legale è quello pubblicato. Parola per parola.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il difetto che questo test rende impossibile
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il legale legge il file che gli arriva, non `contenuti/termini.md`. Finché
 * la copia la fa un comando, le due cose non possono separarsi; il giorno in
 * cui qualcuno corregge una virgola nel contratto e non rigenera il pacchetto,
 * **niente si rompe**: il file c'è, è leggibile, sembra giusto, e il parere
 * arriva su un testo che non è più quello pubblicato.
 *
 * È la stessa forma del prezzo scritto in due posti, con una differenza che
 * conta: qui la copia vecchia è quella su cui qualcuno mette una firma.
 */
describe("il pacchetto per il legale", () => {
  const contratto = readFileSync(SORGENTE, "utf8");
  const mandato = readFileSync(DESTINAZIONE, "utf8");

  it("il testo integrale coincide con il contratto pubblicato", () => {
    expect(
      mandato,
      `${DESTINAZIONE} non è più quello che il generatore produce oggi.\n`
        + "Il contratto è cambiato e il pacchetto no: rigeneralo con\n\n"
        + "    npm run legale:pacchetto\n",
    ).toBe(terminiCompleti(contratto));
  });

  /*
    E il contratto ci sta dentro **intero**, non solo uguale a quello che il
    generatore produce. Senza questa riga, un generatore che per sbaglio
    tagliasse gli ultimi articoli passerebbe il controllo qui sopra con due
    file perfettamente d'accordo e un contratto a metà.
  */
  it("e c'è tutto: il file finisce dove finisce il contratto", () => {
    expect(mandato.endsWith(contratto)).toBe(true);
    expect(mandato.length).toBeGreaterThan(contratto.length);
  });

  it("il cappello dichiara la versione e la data che il contratto porta in testa", () => {
    const { numero, data } = versioneDi(contratto);
    const cappello = mandato.slice(0, mandato.length - contratto.length);
    expect(cappello).toContain(`versione ${numero} del ${data}`);
  });

  it("e si vede che è generato, con il comando per rifarlo", () => {
    expect(mandato).toContain("pacchetto-legale.mjs");
    expect(mandato).toContain("npm run legale:pacchetto");
  });
});

/*
  La cartella contiene esattamente i file del pacchetto, e ciascuno è nominato
  dal LEGGIMI. Un file in più — una bozza vecchia, un appunto — è un documento
  che parte insieme agli altri senza che nessuno abbia deciso di mandarlo.
*/
describe("la cartella del pacchetto", () => {
  const CARTELLA = "docs/legale/per-il-legale";
  const ATTESI = [
    "LEGGIMI.md",
    "modifiche-finali.md",
    "privacy-punti-d-e.md",
    "proporzionalita-prove.md",
    "termini-v3-completo.md",
  ];

  it("contiene esattamente i file del pacchetto, e nessun altro", async () => {
    const { readdirSync } = await import("node:fs");
    expect(readdirSync(CARTELLA).sort()).toEqual(ATTESI);
  });

  it("e il LEGGIMI li nomina tutti, oltre a sé stesso", () => {
    const leggimi = readFileSync(`${CARTELLA}/LEGGIMI.md`, "utf8");
    for (const f of ATTESI.filter((f) => f !== "LEGGIMI.md")) {
      expect(leggimi, `il LEGGIMI non dice cosa contiene ${f}`).toContain(f);
    }
  });
});
