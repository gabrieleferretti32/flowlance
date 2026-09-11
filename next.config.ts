import type { NextConfig } from "next";
import { CHIAVE_PUBBLICA } from "./src/lib/licenza/chiave-pubblica";
import { controlloChiavePubblica } from "./src/lib/licenza/presidio";
import { generaPdfTermini } from "./src/lib/contenuti/pdf-termini";
import { CHIUSO_AI_MOTORI, PAYMENT_LINK } from "./src/lib/sito/impostazioni";
import { controlloVendita } from "./src/lib/sito/presidio";
import { controlloAnteprima } from "./src/lib/sito/presidio-anteprima";
import { scriviVersione } from "./src/lib/sito/versione";

/**
 * Nessun build di produzione senza una chiave pubblica vera.
 *
 * Qui e non in uno script `prebuild`: questo file lo legge ogni `next build`,
 * comunque lo si invochi — `npm run build`, `next build` a mano, una pipeline
 * di CI — mentre un `prebuild` si salta scavalcando npm. `next dev` lascia
 * passare il segnaposto, che in sviluppo è il comportamento voluto.
 */
const problema = controlloChiavePubblica(CHIAVE_PUBBLICA, process.env.NODE_ENV);
if (problema) throw new Error(problema);

/**
 * E nessun build di produzione che apra il sito ai motori senza saper vendere.
 *
 * Stessa forma del presidio qui sopra e stessa ragione di stare in questo file:
 * lo legge ogni `next build`, comunque lo si invochi. Le due condizioni — sito
 * indicizzabile, pagamento ancora al segnaposto — sono legittime da sole e
 * impossibili insieme.
 */
/*
  I due valori arrivano da `impostazioni.ts`, che non importa niente: Next
  compila questo file in `next.config.compiled.js` alla radice del progetto, e
  da lì gli alias `@/` non si risolvono. La prima stesura importava
  `PAYMENT_LINK` da `acquisto.ts`, che a sua volta importa `@/lib/format`, e il
  build si fermava con «Cannot find module ./src/lib/format» — un errore che
  non nomina né il presidio né la pagina d'acquisto.
*/
const vendita = controlloVendita(PAYMENT_LINK, CHIUSO_AI_MOTORI, process.env.NODE_ENV);
if (vendita) throw new Error(vendita);

/**
 * E nessun build che pubblichi un'anteprima che non è più quella del sito.
 *
 * L'immagine la disegna Chromium leggendo la landing costruita — il carattere
 * di Flowlance è un woff2 variabile, e qui dentro non c'è niente che sappia
 * rasterizzarlo — quindi non si rifà da sola a ogni build. Il presidio serve
 * proprio a questo: rilegge la firma che il generatore ha lasciato nel PNG e
 * la confronta con l'apertura della landing e con il marchio di adesso.
 *
 * `RIFACCIO_ANTEPRIMA` sospende il controllo, e lo fa una volta sola: è
 * `npm run anteprima:immagine` che lo accende per costruire il sito da cui
 * l'immagine verrà disegnata. Senza quella via d'uscita il giorno in cui il
 * titolo cambia non si costruirebbe più niente — il build vorrebbe l'immagine
 * nuova, e l'immagine nuova vorrebbe il build.
 */
if (!process.env.RIFACCIO_ANTEPRIMA) {
  const anteprima = controlloAnteprima();
  if (anteprima) throw new Error(anteprima);
}

const nextConfig: NextConfig = {
  /**
   * Export statico: nessun runtime server, nessun dato che lasci il browser.
   * È la scelta che rende vero il «local-first» del progetto — l'app si apre da
   * qualunque hosting statico e continua a funzionare offline — e che permette
   * di consegnarla come licenza una tantum.
   * Da servire con un qualsiasi server statico: `npx serve out`.
   */
  output: "export",
  images: { unoptimized: true },
  /** Percorsi con lo slash finale: file system statici e hosting semplici li gradiscono. */
  trailingSlash: true,
};

/**
 * Il PDF dei Termini si rifà a ogni build, dal Markdown.
 *
 * Qui, e non in uno script `prebuild`, per la stessa ragione del presidio sulla
 * chiave: questo file lo legge **ogni** `next build`, comunque lo si invochi —
 * `npm run build`, `next build` a mano, la pipeline di Vercel — mentre un
 * `prebuild` si salta scavalcando npm. Un PDF vecchio accanto a Termini nuovi
 * sarebbe il contratto sbagliato nel fascicolo di un ordine, ed è il genere di
 * divergenza che non si vede finché non serve.
 *
 * La configurazione diventa una funzione asincrona perché pdfkit impagina su
 * uno stream. Next la aspetta prima di cominciare: se il Markdown contiene una
 * forma che il renderer non sa impaginare, il build si ferma qui.
 */
export default async function configurazione(): Promise<NextConfig> {
  const pdf = await generaPdfTermini();
  console.log(`Termini in PDF: ${pdf.indirizzo} · ${pdf.byte} byte · sha256 ${pdf.impronta.slice(0, 16)}…`);
  /*
    E il sito dichiara da quale commit viene.

    Qui, accanto al PDF e per la stessa ragione: questo file lo legge ogni
    `next build`, quello di Vercel compreso. Un `versione.json` scritto da uno
    script che si può saltare sarebbe assente proprio nei build che nessuno ha
    guardato, cioè quelli in cui serve.
  */
  const versione = scriviVersione();
  console.log(`Versione pubblicata: ${versione.commit.slice(0, 12)} · ${versione.costruito}`);
  return nextConfig;
}
