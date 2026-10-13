#!/usr/bin/env node
/**
 * Il pacchetto da mandare al legale: quattro file in una cartella.
 *
 *   npm run legale:pacchetto
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché il contratto si **genera** e non si copia
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il legale legge quello che gli arriva, non `contenuti/termini.md`. Una copia
 * fatta a mano è un secondo contratto: diverge alla prima correzione — non
 * subito, e non in modo visibile — e il giorno in cui diverge il parere arriva
 * su un testo che non è quello pubblicato. È la stessa famiglia di difetti del
 * prezzo scritto in due posti, con una differenza: qui la copia sbagliata è
 * quella su cui qualcuno mette una firma.
 *
 * Quindi il file si rigenera da qui, e un test pretende che sia identico a
 * quello che il generatore produce adesso: se qualcuno corregge il contratto e
 * non rigenera, la griglia cade e dice quale comando lanciare.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Gli altri tre file non si generano: **vivono** qui
 * ─────────────────────────────────────────────────────────────────────────
 *
 * L'informativa dei punti (d) ed (e) e la motivazione dei cinque anni stanno
 * dentro la cartella del pacchetto, non in copia: due copie dello stesso
 * documento sono due documenti, e quello che si manda sarebbe sempre quello
 * vecchio. `LEGGIMI.md` dice in tre righe cosa c'è dentro, perché una cartella
 * con quattro file e nessuna spiegazione costringe chi la riceve a aprirli
 * tutti per capire quale riguarda cosa.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export const SORGENTE = "contenuti/termini.md";
export const DESTINAZIONE = "docs/legale/per-il-legale/termini-v3-completo.md";

/** La versione e la data, lette dalla riga in testa al contratto. */
export function versioneDi(markdown) {
  const trovata = markdown.match(/^\*Versione\s+(\d+)\s*[—–-]\s*(.+?)\s*\*$/m);
  if (!trovata) {
    throw new Error(
      `${SORGENTE}: non trovo la riga «*Versione N — data*».\n`
        + "Da lì escono il numero e la data che il pacchetto dichiara in testa.",
    );
  }
  return { numero: trovata[1], data: trovata[2] };
}

/**
 * Il contenuto del file da mandare: un cappello, e poi il contratto **intero**.
 *
 * Il contratto si incolla senza toccare niente — nemmeno i titoli, nemmeno la
 * riga della versione. Un generatore che «sistemasse» qualcosa mentre copia
 * produrrebbe un documento simile all'originale, che è la cosa peggiore che
 * possa produrre: le differenze non si vedono leggendo, si vedono solo
 * confrontando, e nessuno confronta un file che sembra giusto.
 */
export function terminiCompleti(markdown) {
  const { numero, data } = versioneDi(markdown);
  const cappello = [
    `<!-- Generato da strumenti/pacchetto-legale.mjs a partire da ${SORGENTE}.`,
    "     Non si modifica a mano: le correzioni si fanno sul contratto e si rigenera",
    "     con `npm run legale:pacchetto`. Un test verifica che i due coincidano. -->",
    "",
    `> **Termini di servizio di Flowlance — versione ${numero} del ${data}, testo integrale.**`,
    "> È il documento pubblicato su flowlance.it/termini/ e allegato in PDF a ogni",
    "> ordine. Qui sotto, dal titolo in giù, non c'è una parola diversa.",
    "",
    "---",
    "",
  ].join("\n");
  return `${cappello}${markdown}`;
}

/** Il generatore, quando questo file si lancia da solo. */
function scrivi(radice = process.cwd()) {
  const markdown = readFileSync(resolve(radice, SORGENTE), "utf8");
  const dove = resolve(radice, DESTINAZIONE);
  writeFileSync(dove, terminiCompleti(markdown));
  const { numero, data } = versioneDi(markdown);
  console.log(`  ${DESTINAZIONE} — Termini versione ${numero} del ${data}, integrali.`);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  scrivi();
}
