/**
 * L'archivio dei testi delle due dichiarazioni: che cosa c'era scritto nelle
 * caselle, parola per parola.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché un archivio e non il testo di adesso
 * ─────────────────────────────────────────────────────────────────────────
 *
 * L'evento dell'accettazione registra **l'impronta** delle due dichiarazioni,
 * non il loro testo: copiarlo dentro ogni acquisto sarebbe lo stesso documento
 * riscritto ogni volta. Ma un'impronta senza il documento che la genera non
 * dimostra niente — è un numero.
 *
 * La prima stesura di questo file componeva il testo da `acquisto.ts` e lo
 * chiamava «archiviato per versione». Non lo era: il giorno in cui si riscrive
 * la frase della dichiarazione professionale, il testo di ieri **non esiste
 * più da nessuna parte**, e le impronte negli eventi già registrati diventano
 * numeri che non si possono più ricalcolare. Cioè la prova si perde proprio
 * nel modo che questo archivio esiste per impedire — in silenzio, e senza che
 * niente smetta di funzionare.
 *
 * Quindi qui i testi ci sono **per esteso, uno per versione**, e una versione
 * archiviata non si riscrive mai: il testo nuovo è una riga nuova, con una
 * versione nuova. È la stessa costruzione di `testi-consensi.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché sono modelli e non stringhe
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il testo dell'accettazione **nomina la versione dei Termini** — «versione 3»
 * — e cambia quindi a ogni versione del contratto, senza che le parole della
 * casella cambino. Un archivio di stringhe fisse avrebbe quindi una riga per
 * ogni combinazione, e la versione dei Termini si sarebbe scritta due volte:
 * nel testo e nell'evento.
 *
 * `{versione}` è il segnaposto, e `riempi()` lo sostituisce **pretendendo che
 * ci sia**: una sostituzione che non trova niente restituisce la stringa
 * intera senza dirlo, e questo archivio conserverebbe per sempre un testo che
 * nomina una versione sbagliata o nessuna.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * E l'archivio non può allontanarsi dalla pagina
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il rischio di un archivio è il verso opposto: che la pagina mostri parole
 * diverse da quelle archiviate. `dichiarazioni.test.ts` riempie il modello
 * della versione corrente e lo confronta, carattere per carattere, con quello
 * che la pagina compone da `acquisto.ts`. Se qualcuno riscrive una casella e
 * non aggiunge una versione qui, cade lì.
 *
 * Questo modulo importa `node:crypto`, quindi **non entra nel browser**: in un
 * componente client il build fallirebbe, e fallirebbe forte.
 */
import { createHash } from "node:crypto";

/** Dove va il numero di versione dei Termini, dentro un modello archiviato. */
const SEGNAPOSTO = "{versione}";

export type DichiarazioniMostrate = {
  /** La versione dei Termini a cui il testo si riferisce. */
  versioneTermini: number;
  /** La versione del testo delle dichiarazioni: cambia quando cambiano le parole. */
  versione: string;
  /** Il testo integrale delle due caselle, nell'ordine in cui stanno in pagina. */
  testo: string;
  /** SHA-256 esadecimale del testo in UTF-8. Calcolato, mai scritto a mano. */
  impronta: string;
};

/**
 * I modelli, uno per versione del testo.
 *
 * Nell'ordine in cui le caselle stanno in pagina, separate da una riga vuota.
 * Una versione si **aggiunge**: quelle vecchie restano, perché un evento di
 * due anni fa le nomina ancora.
 */
const ARCHIVIO: { versione: string; modello: string }[] = [
  {
    versione: "2026-10-12",
    modello: [
      `Ho letto e accetto i Termini di servizio, versione ${SEGNAPOSTO}, che trovo per`
        + " intero e in PDF in fondo a questa pagina.",
      "Dichiaro di acquistare nell'esercizio della mia attività imprenditoriale,"
        + " commerciale, artigianale o professionale, e per finalità connesse a tale"
        + " attività. Flowlance non è destinato ai consumatori.",
    ].join("\n\n"),
  },
];

/**
 * La versione in vigore: l'ultima dell'archivio.
 *
 * Non una costante scritta a parte. Aggiungere un testo nuovo e dimenticare di
 * spostare il puntatore vorrebbe dire registrare le accettazioni di oggi sotto
 * il testo di ieri — con l'impronta di ieri, e con la faccia di una prova
 * giusta.
 */
export const VERSIONE_DICHIARAZIONI: string = ARCHIVIO[ARCHIVIO.length - 1].versione;

/** Mette la versione dei Termini nel modello, o si ferma. */
function riempi(modello: string, versioneTermini: number): string {
  if (!modello.includes(SEGNAPOSTO)) {
    throw new Error(
      `Il testo archiviato delle dichiarazioni non contiene «${SEGNAPOSTO}»:\n`
        + `  ${modello.slice(0, 120)}…\n\n`
        + "Senza quel segnaposto il testo conservato non nomina la versione dei Termini\n"
        + "accettata, e l'impronta registrata negli eventi sarebbe quella di un documento\n"
        + "che non dice *quale* contratto la persona aveva davanti.",
    );
  }
  return modello.replaceAll(SEGNAPOSTO, String(versioneTermini));
}

/** Le due dichiarazioni come la pagina le mostra, per una data versione dei Termini. */
export function dichiarazioniMostrate(versioneTermini: number): DichiarazioniMostrate {
  return dellaVersione(VERSIONE_DICHIARAZIONI, versioneTermini);
}

/**
 * Il testo di una versione, per risalire da un evento a quello che c'era scritto.
 *
 * È quello che serve per mettere nel fascicolo di una licenza il documento che
 * l'impronta nomina: vedi `CHECKOUT.md`, «Dal pagamento alla prova».
 */
export function dellaVersione(versione: string, versioneTermini: number): DichiarazioniMostrate {
  const riga = ARCHIVIO.find((d) => d.versione === versione);
  if (!riga) {
    throw new Error(
      `Delle dichiarazioni non esiste la versione «${versione}».\n`
        + `Archiviate: ${ARCHIVIO.map((d) => d.versione).join(", ")}.\n\n`
        + "Un evento che nomina una versione che non c'è è una prova che rimanda a un\n"
        + "documento perduto: la riga non va ricreata a memoria, va ritrovata in cronologia.",
    );
  }
  const testo = riempi(riga.modello, versioneTermini);
  return {
    versioneTermini,
    versione: riga.versione,
    testo,
    impronta: createHash("sha256").update(testo, "utf8").digest("hex"),
  };
}

/** Le versioni archiviate, per i controlli. */
export const VERSIONI_DICHIARAZIONI: readonly string[] = ARCHIVIO.map((d) => d.versione);
