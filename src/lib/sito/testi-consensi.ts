/**
 * L'archivio dei testi dei consensi: che cosa c'era scritto, parola per parola.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché il testo e non il suo numero di versione
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il registro delle prove segnava la **versione** del testo mostrato:
 * `2026-10-12`. Fra due anni, davanti a una contestazione, quella stringa
 * dimostra che la persona ha spuntato una casella e non che cosa diceva la
 * casella. L'art. 7.1 del GDPR chiede di dimostrare che l'interessato ha
 * prestato il consenso **a quel trattamento**: senza il testo, la prova è
 * un'annotazione su un documento che non esiste più.
 *
 * Qui il testo c'è per intero, una volta per versione, e non si riscrive mai:
 * una versione archiviata è un documento chiuso. Il testo nuovo è una riga
 * nuova in questo elenco, con una versione nuova.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'impronta si calcola, non si scrive
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `impronta` è lo SHA-256 del testo, calcolato qui al caricamento del modulo.
 * Scritta a mano sarebbe la solita coppia che si disallinea in silenzio — il
 * testo corretto di una virgola, l'impronta rimasta quella di prima, e ogni
 * evento che la cita diventa la prova di un documento diverso.
 *
 * Calcolandola, invece, il **verso** dell'errore cambia: se qualcuno modifica
 * il testo di una versione già archiviata, l'impronta cambia e **non combacia
 * più con quella scritta negli eventi già registrati**. Il disallineamento
 * diventa visibile proprio dove conta, cioè guardando una prova.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Questo modulo non entra nel browser
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Importa `node:crypto`: in un componente client il build fallisce, e fallisce
 * forte. È la stessa separazione del registro — vedi
 * `strumenti/verifica-registro.mjs` — tenuta da un vincolo che non si può
 * dimenticare invece che da una regola da ricordare.
 */
import { createHash } from "node:crypto";

export type TestoConsensi = {
  /** La versione, nella forma `AAAA-MM-GG` del giorno in cui è entrata in vigore. */
  versione: string;
  /** Il testo integrale mostrato a schermo, caselle e frase sui dati. */
  testo: string;
  /** SHA-256 esadecimale del testo in UTF-8. Calcolato, mai scritto a mano. */
  impronta: string;
};

/**
 * I testi, uno per versione.
 *
 * Il testo è quello che la persona **vede**, non quello che il codice manda:
 * le due caselle con le loro etichette, la riga che dice che le iscrizioni
 * sono separate, e la frase che elenca i dati che partono. I collegamenti
 * diventano il loro testo — «informativa privacy» — perché una prova si legge,
 * non si clicca.
 *
 * Un test confronta questo testo con il sorgente della pagina: se la pagina
 * dicesse qualcosa che qui non c'è, il registro conserverebbe la prova di un
 * consenso dato su un testo diverso.
 */
const ARCHIVIO: { versione: string; testo: string }[] = [
  {
    versione: "2026-10-12",
    testo: [
      "Voglio i promemoria delle scadenze. Ho letto l'informativa privacy.",
      "Voglio anche le email di Flowlance: novità, cambi di regole fiscali, offerte. Facoltativo.",
      "Sono due iscrizioni separate: puoi cancellarti dall'una senza perdere l'altra, dal"
        + " collegamento in fondo a ogni email.",
      "Partono il tuo indirizzo e i numeri che servono a scrivere il promemoria: regime,"
        + " accantonamento mensile, date e importi delle due scadenze. Il fatturato che hai"
        + " digitato non lo mandiamo, ma da questi importi si può stimare: per questo li"
        + " trattiamo come dati economici. Niente altro, e solo adesso che l'hai chiesto.",
    ].join("\n\n"),
  },
];

export const TESTI_CONSENSI: readonly TestoConsensi[] = ARCHIVIO.map((t) => ({
  ...t,
  impronta: createHash("sha256").update(t.testo, "utf8").digest("hex"),
}));

/**
 * La versione in vigore: l'ultima dell'archivio.
 *
 * Non una costante scritta a parte. Aggiungere un testo nuovo e dimenticare di
 * spostare il puntatore vorrebbe dire registrare i consensi di oggi sotto il
 * testo di ieri — con l'impronta di ieri, e con la faccia di una prova giusta.
 */
export const VERSIONE_CORRENTE: TestoConsensi = TESTI_CONSENSI[TESTI_CONSENSI.length - 1];

/** Il testo di una versione, per risalire da un evento a quello che c'era scritto. */
export function testoDellaVersione(versione: string): TestoConsensi | null {
  return TESTI_CONSENSI.find((t) => t.versione === versione) ?? null;
}
