/**
 * Lettura di un file CSV, scritta a mano.
 *
 * Nessuna dipendenza, come per il resto del progetto: un CSV è un formato
 * piccolo, e le due cose che lo rendono insidioso — i campi fra virgolette e i
 * separatori italiani — si scrivono in meno righe di quante ne costi importare
 * una libreria.
 *
 * Quello che deve reggere, perché è quello che esce davvero da Excel e dalle
 * banche italiane:
 *  - separatore `;` (Excel italiano), `,` (tutto il resto) o tabulazione;
 *  - campi fra virgolette che contengono il separatore, un a capo, o
 *    virgolette raddoppiate;
 *  - il BOM che Excel mette in testa ai file UTF-8;
 *  - fine riga `\r\n` o `\n`;
 *  - righe vuote in coda, che non sono dati.
 */

export type Tabella = {
  /** La prima riga, se `intestazioni` è vero. Altrimenti `Colonna 1`, `Colonna 2`… */
  intestazioni: string[];
  /** Le righe di dati, già senza l'intestazione. */
  righe: string[][];
  separatore: string;
};

const SEPARATORI = [";", ",", "\t"] as const;

/**
 * Indovina il separatore.
 *
 * Conta le occorrenze *fuori dalle virgolette* nelle prime righe e prende il
 * carattere che compare più volte in modo costante. Il conteggio grezzo non
 * basterebbe: un campo «Rossi, Mario» fra virgolette farebbe vincere la virgola
 * in un file che usa il punto e virgola, cioè proprio il caso italiano.
 */
export function separatoreProbabile(testo: string): string {
  const righe = testo.replace(/^﻿/, "").split(/\r?\n/).filter((r) => r.trim() !== "").slice(0, 10);
  if (righe.length === 0) return ";";

  let migliore = ";";
  let punteggio = -1;
  for (const candidato of SEPARATORI) {
    const conteggi = righe.map((r) => contaFuoriDaVirgolette(r, candidato));
    const primo = conteggi[0];
    if (primo === 0) continue;
    // Costante da riga a riga: un separatore vero divide ogni riga allo stesso
    // modo, un carattere che capita nel testo no.
    const costante = conteggi.every((c) => c === primo);
    const valore = primo * (costante ? 100 : 1);
    if (valore > punteggio) {
      punteggio = valore;
      migliore = candidato;
    }
  }
  return migliore;
}

function contaFuoriDaVirgolette(riga: string, carattere: string): number {
  let dentro = false;
  let n = 0;
  for (let i = 0; i < riga.length; i++) {
    const c = riga[i];
    if (c === '"') {
      if (dentro && riga[i + 1] === '"') i++;
      else dentro = !dentro;
    } else if (c === carattere && !dentro) n++;
  }
  return n;
}

/**
 * Scompone il testo in righe e campi.
 *
 * @param separatore se omesso, si indovina.
 * @param conIntestazioni la prima riga contiene i nomi delle colonne.
 * @param tieniVuote le righe vuote restano nell'elenco, al loro posto.
 */
export function leggiCsv(
  testo: string,
  {
    separatore,
    conIntestazioni = true,
    tieniVuote = false,
  }: { separatore?: string; conIntestazioni?: boolean; tieniVuote?: boolean } = {},
): Tabella {
  const sep = separatore ?? separatoreProbabile(testo);
  const pulito = testo.replace(/^﻿/, "");

  const righe: string[][] = [];
  let campo = "";
  let riga: string[] = [];
  let dentro = false;

  const chiudiCampo = () => {
    riga.push(campo);
    campo = "";
  };
  const chiudiRiga = () => {
    chiudiCampo();
    /*
      Una riga di soli campi vuoti è una riga vuota, non un record — e di
      norma si butta.

      `tieniVuote` la tiene al suo posto, e serve a una cosa sola: **contare
      le righe come le conta chi apre il file**. Chi carica un rendiconto
      bancario deve poter leggere «intestazione alla riga 9» e ritrovare la
      riga 9 nel suo foglio; se per strada ne abbiamo buttate due, quel numero
      indica un'altra riga e la correzione a mano diventa un indovinello.
    */
    if (tieniVuote || riga.some((c) => c.trim() !== "")) righe.push(riga);
    riga = [];
  };

  for (let i = 0; i < pulito.length; i++) {
    const c = pulito[i];

    if (dentro) {
      if (c === '"') {
        if (pulito[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          dentro = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"' && campo.trim() === "") {
      // Le virgolette aprono solo a inizio campo: in `12" di schermo` sono
      // pollici, non una citazione aperta.
      campo = "";
      dentro = true;
    } else if (c === sep) {
      chiudiCampo();
    } else if (c === "\n") {
      chiudiRiga();
    } else if (c === "\r") {
      // parte di \r\n: il \n che segue chiude la riga
    } else {
      campo += c;
    }
  }
  if (campo !== "" || riga.length > 0) chiudiRiga();

  const intestazioni =
    conIntestazioni && righe.length > 0
      ? righe[0].map((h, i) => h.trim() || `Colonna ${i + 1}`)
      : (righe[0] ?? []).map((_, i) => `Colonna ${i + 1}`);

  return {
    intestazioni,
    righe: conIntestazioni ? righe.slice(1) : righe,
    separatore: sep,
  };
}

/** Il valore di una colonna in una riga, ripulito. Fuori indice → stringa vuota. */
export function campoDi(riga: string[], indice: number | null): string {
  if (indice === null || indice < 0 || indice >= riga.length) return "";
  return riga[indice].trim();
}
