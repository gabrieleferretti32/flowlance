/**
 * L'apertura della pagina di vendita: l'occhiello e il titolo, in un posto solo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché non stanno più dentro il JSX
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Sono le due righe che si leggono per prime, e da oggi non si leggono solo
 * sulla pagina: la stessa frase finisce **dentro l'immagine di anteprima**,
 * quella che compare quando qualcuno incolla flowlance.it in una chat.
 *
 * Scritta due volte — una nel JSX, una nel generatore dell'immagine — sarebbe
 * la seconda copia di sempre: si ritocca il titolo della landing, l'immagine
 * continua a mostrare quello di prima, e non se ne accorge nessuno perché
 * l'anteprima non si vede mai aprendo il sito. Qui la frase è una, la pagina la
 * stampa e l'immagine la disegna leggendola dalla pagina costruita.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Niente import
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Come `impostazioni.ts`: questo file lo legge anche il presidio che gira
 * dentro `next.config.ts`, e la configurazione compilata sta alla radice del
 * progetto, dove gli alias `@/` non si risolvono. Un import di troppo qui
 * ferma il build con un errore che non nomina né l'immagine né la landing.
 */

/** Una riga del titolo. `accento` è quella colorata: nel disegno è la seconda. */
export type RigaApertura = { testo: string; accento?: boolean };

export const APERTURA: {
  occhiello: string;
  titolo: RigaApertura[];
} = {
  occhiello: "Flowlance · per freelance italiani con partita IVA",
  /*
    Le righe sono separate qui e non da un a capo dentro una stringa unica: la
    pagina le manda a capo con un <br>, l'immagine le impagina in un riquadro
    di larghezza diversa. Tenerle distinte evita che il generatore debba
    indovinare dove spezzare una frase scritta per un'altra misura.
  */
  titolo: [
    { testo: "Sul conto hai 30.000 €." },
    { testo: "Tuoi ne sono 17.000.", accento: true },
  ],
};
