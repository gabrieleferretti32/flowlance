import type { NextConfig } from "next";
import { CHIAVE_PUBBLICA } from "./src/lib/licenza/chiave-pubblica";
import { controlloChiavePubblica } from "./src/lib/licenza/presidio";
import { generaPdfTermini } from "./src/lib/contenuti/pdf-termini";

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
  return nextConfig;
}
