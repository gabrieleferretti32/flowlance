/**
 * Che alfabeto parla questo file.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché non basta leggere come UTF-8
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Molte banche esportano ancora in ANSI — Windows-1252, l'alfabeto di Excel su
 * Windows — e in quell'alfabeto la È è **un byte solo**, 0xC8. Letto come
 * UTF-8, quel byte da solo non vuol dire niente: il browser lo sostituisce con
 * il carattere di sostituzione, e «PERCHÉ ADDEBITO» diventa «PERCH? ADDEBITO».
 *
 * Non è un problema estetico. Le regole di categoria confrontano testo: una
 * regola su «caffè» smette di riconoscere «caff?», e la riga che ieri finiva
 * in «Bar e ristoranti» oggi finisce in «Non definito» — senza che niente sia
 * cambiato, tranne il file. Il difetto si vede come una categorizzazione che
 * peggiora da sola.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Come si riconosce, senza indovinare
 * ─────────────────────────────────────────────────────────────────────────
 *
 * UTF-8 è un alfabeto **verificabile**: le sequenze multibyte hanno una forma
 * precisa, e un testo Windows-1252 con accenti quasi sempre la viola. Quindi
 * si prova a leggerlo come UTF-8 in modo severo: se passa, è UTF-8; se lancia,
 * è 1252. Nessuna statistica, nessuna soglia: una domanda con una risposta.
 *
 * Il caso che resta ambiguo è il file **senza nessun accento**, che è valido
 * in tutti e due gli alfabeti — e lì non importa, perché i due danno lo stesso
 * testo.
 */
export type Codifica = "utf-8" | "windows-1252";

export type TestoDecodificato = {
  testo: string;
  codifica: Codifica;
};

/** Il segno d'ordine dei byte che Excel mette in testa ai CSV «UTF-8». */
const BOM = [0xef, 0xbb, 0xbf];

export function decodificaRendiconto(bytes: ArrayBuffer | Uint8Array): TestoDecodificato {
  const dati = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const conBom = BOM.every((b, i) => dati[i] === b);
  const utili = conBom ? dati.subarray(3) : dati;

  try {
    const testo = new TextDecoder("utf-8", { fatal: true }).decode(utili);
    return { testo, codifica: "utf-8" };
  } catch {
    /*
      Non è UTF-8 valido. L'unica altra cosa che arriva davvero da una banca
      italiana è Windows-1252: prenderla per buona è meglio che restituire un
      testo pieno di caratteri di sostituzione, perché 1252 decodifica
      qualunque byte — non fallisce mai — e le lettere accentate tornano al
      loro posto.
    */
    return { testo: new TextDecoder("windows-1252").decode(utili), codifica: "windows-1252" };
  }
}

/** Come si chiama l'alfabeto, per dirlo a chi carica. */
export function nomeCodifica(codifica: Codifica): string {
  return codifica === "utf-8" ? "UTF-8" : "ANSI (Windows-1252)";
}
