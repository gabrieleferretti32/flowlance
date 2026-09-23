/**
 * Riconoscere una parola dentro un testo, senza prendere pezzi di altre parole.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il difetto che questo modulo esiste per non ripetere
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `testo.includes(parola)` è la via ovvia e mente in silenzio: «tari» sta
 * dentro «saniTARIa», e un pagamento all'azienda sanitaria locale finiva fra
 * le tasse — cioè fra le spese coperte dall'accantonamento, che il limite del
 * mese non conta. «sport» sta dentro «traSPORTi», e «in» sta dentro «saldo
 * fINale». Sono tre schermate diverse e lo stesso errore, quindi la regola
 * sta scritta una volta sola.
 *
 * Una voce dichiara che cos'è, e si legge a occhio:
 *
 * - `bar` — **parola intera**: prende «BAR CENTRALE», non «BARbiere».
 * - `supermercat*` — **inizio di parola**: prende «supermercato» e
 *   «supermercati», non un pezzo in mezzo a un'altra parola.
 * - `wind tre` — **frase**: si cerca nel testo intero, perché due parole
 *   separate da uno spazio, parole intere non sono.
 */

/** Il testo su cui si cerca: minuscolo, senza doppi spazi, senza punteggiatura. */
export function testoConfrontabile(descrizione: string): string {
  return descrizione
    .toLocaleLowerCase("it-IT")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Quali voci guardare: le frasi, le parole, o tutte. */
export type Quali = "frasi" | "parole" | "tutte";

/**
 * Il testo contiene una di queste voci.
 *
 * `quali` serve a chi ha più elenchi e vuole che le **frasi** vincano sulle
 * parole: sono più specifiche, e senza quest'ordine «eni luce» perderebbe
 * contro «eni» dei carburanti solo perché i carburanti stanno più in alto
 * nell'elenco. Chi ha un elenco solo passa «tutte» e non ci pensa.
 */
export function contieneVoce(testo: string, voci: string[], quali: Quali = "tutte"): boolean {
  const parti = testo.split(" ");
  for (const voce of voci) {
    const frase = voce.includes(" ");
    if (quali !== "tutte" && frase !== (quali === "frasi")) continue;
    if (frase) {
      if (testo.includes(voce)) return true;
    } else if (voce.endsWith("*")) {
      const inizio = voce.slice(0, -1);
      if (parti.some((p) => p.startsWith(inizio))) return true;
    } else if (parti.includes(voce)) {
      return true;
    }
  }
  return false;
}
