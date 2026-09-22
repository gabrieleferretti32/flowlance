/**
 * Qual è la riga d'intestazione, quando sopra la tabella c'è una copertina.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il caso che ha rotto il primo file vero
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un estratto conto di Trade Republic, foglio «Lista Operazione»: sette righe
 * di copertina — nome della banca, intestatario, numero di conto, il periodo —
 * e solo dopo la tabella. Prendendo la prima riga come intestazione uscivano
 * colonne chiamate «Colonna 1», «Colonna 4» e «Conto 1000/00065493», e **tutte
 * e 47 le righe finivano scartate con «data non leggibile»**.
 *
 * Non è un caso di nicchia: quasi tutte le banche scrivono qualcosa sopra la
 * tabella. Assumere la prima riga vuol dire fallire sulla maggioranza dei file
 * veri, e fallire in un modo che sembra colpa del file.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Come si riconosce
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Non dal contenuto — «Data», «Importo», «Descrizione» sono parole che
 * cambiano da banca a banca e da lingua a lingua — ma da **quello che c'è
 * sotto**: l'intestazione è la riga dopo la quale cominciano le righe con una
 * data dentro.
 *
 * Tre regole, in ordine:
 *
 * 1. Una riga che contiene già una data **non è un'intestazione**: è una riga
 *    di dati. È la regola che impedisce di scegliere la prima riga della
 *    tabella al posto della sua intestazione.
 * 2. Vince chi ha la **frazione più alta di righe con una data** nella
 *    finestra subito sotto. Guardare la finestra e non tutto il resto del file
 *    è quello che distingue la copertina dall'intestazione vera: sotto la
 *    prima riga della copertina ci sono altre righe di copertina, sotto
 *    l'intestazione ci sono solo dati.
 * 3. A parità, vince chi ha più celle piene — una copertina ha una cella, una
 *    intestazione ne ha cinque — e poi la più in alto.
 *
 * Quando nessuna candidata ha dati sotto di sé si ripiega sulla prima riga e
 * **lo si dichiara** (`certa: false`): la schermata lo scrive, e la riga si
 * cambia a mano. Un ripiego silenzioso qui è il difetto di partenza, di nuovo.
 */
import { analizzaData } from "@/lib/format";

/** Quante righe si guardano sotto una candidata per giudicarla. */
const FINESTRA = 10;

/** Fin dove si cerca: una copertina più lunga di così non è una copertina. */
export const RIGHE_ESAMINATE = 25;

export type SceltaIntestazione = {
  /** La riga scelta, contata da 1 come la vede chi apre il file. */
  riga: number;
  intestazioni: string[];
  righe: string[][];
  /** Quante delle righe sotto hanno una data, e su quante. */
  conData: number;
  esaminate: number;
  /** Trovata guardando i dati; `false` vuol dire ripiego sulla prima riga. */
  certa: boolean;
};

const piene = (riga: string[]) => riga.filter((c) => c.trim() !== "").length;

/** La riga contiene qualcosa che è una data. */
export function contieneData(riga: string[]): boolean {
  return riga.some((c) => analizzaData(c) !== null);
}

/**
 * Taglia la tabella a una riga d'intestazione scelta, contata da 1.
 *
 * Le righe vuote **sotto** l'intestazione se ne vanno: sono la riga bianca fra
 * la tabella e un totale, o la coda di un foglio, e passandole più avanti
 * diventerebbero altrettante righe scartate per «data non leggibile» — un
 * elenco di errori che non sono errori. Quelle **sopra** restano, perché
 * servono a contare: «intestazione alla riga 9» deve indicare la riga 9 del
 * foglio, non la nona riga piena.
 */
export function conIntestazioneAllaRiga(
  tutte: string[][],
  riga: number,
): { intestazioni: string[]; righe: string[][] } {
  const indice = Math.min(Math.max(1, riga), Math.max(1, tutte.length)) - 1;
  return {
    intestazioni: tutte[indice] ?? [],
    righe: tutte.slice(indice + 1).filter((r) => r.some((c) => c.trim() !== "")),
  };
}

export function trovaIntestazione(
  tutte: string[][],
  esaminate = RIGHE_ESAMINATE,
): SceltaIntestazione {
  const fino = Math.min(esaminate, tutte.length);
  let migliore: { indice: number; quota: number; conData: number; piene: number } | null = null;

  for (let i = 0; i < fino; i += 1) {
    const candidata = tutte[i];
    // Regola 1: una riga con una data dentro è un movimento, non un titolo.
    if (contieneData(candidata)) continue;
    // Una colonna sola non è una tabella: è una riga di copertina.
    if (piene(candidata) < 2) continue;

    const sotto = tutte.slice(i + 1, i + 1 + FINESTRA);
    if (sotto.length === 0) continue;
    const conData = sotto.filter(contieneData).length;
    const quota = conData / sotto.length;
    if (conData === 0) continue;

    const meglio =
      migliore === null ||
      quota > migliore.quota ||
      (quota === migliore.quota && piene(candidata) > migliore.piene);
    if (meglio) migliore = { indice: i, quota, conData, piene: piene(candidata) };
  }

  if (migliore === null) {
    const { intestazioni, righe } = conIntestazioneAllaRiga(tutte, 1);
    return { riga: 1, intestazioni, righe, conData: 0, esaminate: 0, certa: false };
  }

  const { intestazioni, righe } = conIntestazioneAllaRiga(tutte, migliore.indice + 1);
  return {
    riga: migliore.indice + 1,
    intestazioni,
    righe,
    conData: migliore.conData,
    esaminate: Math.min(FINESTRA, tutte.length - migliore.indice - 1),
    certa: true,
  };
}
