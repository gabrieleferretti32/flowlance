/**
 * Il presidio sull'immagine di anteprima, in fase di build.
 *
 * Apre `public/anteprima.png`, ne legge la firma lasciata dal generatore e la
 * confronta con l'apertura della landing di adesso e con il marchio di adesso.
 * Le ragioni stanno in `anteprima.ts`; qui c'è solo il pezzo che tocca il
 * disco, tenuto separato perché quello lo legge anche la pagina, e una pagina
 * non può importare `node:fs`.
 *
 * Come gli altri presidi: restituisce il messaggio invece di lanciarlo, così un
 * test può leggerlo senza far fallire niente.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SORGENTE_MARCHIO } from "../contenuti/marchio-pdf";
import { CHIAVE_FIRMA, FILE_ANTEPRIMA, type Firma, differenzaAnteprima, messaggioAnteprima } from "./anteprima";
import { testiPng } from "./png";

/**
 * L'impronta del marchio: il contenuto del file, non la sua data.
 *
 * Dodici cifre esadecimali bastano a distinguere due disegni e stanno su una
 * riga di messaggio d'errore accanto all'altra.
 */
export function improntaMarchio(radice = process.cwd()): string {
  const svg = readFileSync(join(radice, SORGENTE_MARCHIO));
  return createHash("sha256").update(svg).digest("hex").slice(0, 12);
}

/** La firma dentro il PNG, o `null` se il file non c'è o non ne porta una. */
export function leggiFirma(radice = process.cwd()): Firma | null {
  const percorso = join(radice, FILE_ANTEPRIMA);
  if (!existsSync(percorso)) return null;
  const testi = testiPng(readFileSync(percorso));
  const grezza = testi[CHIAVE_FIRMA];
  if (!grezza) return null;
  try {
    return JSON.parse(grezza) as Firma;
  } catch {
    return null;
  }
}

/** `null` se si può procedere, altrimenti il messaggio con cui fermare il build. */
export function controlloAnteprima(radice = process.cwd()): string | null {
  return messaggioAnteprima(differenzaAnteprima(leggiFirma(radice), improntaMarchio(radice)));
}
