import type { Metadata } from "next";
import { leggiPagina } from "@/lib/contenuti/pagine";
import { improntaPdfTermini, indirizzoPdfTermini } from "@/lib/contenuti/pdf-termini";
import { SITO } from "@/lib/rotte";
import { SchermataAcquisto } from "./schermata-acquisto";

export const metadata: Metadata = { title: "Acquista Flowlance" };

/**
 * La pagina ponte fra il pulsante d'acquisto e Stripe.
 *
 * Tutto quello che serve arriva da qui, a tempo di build: il testo integrale
 * dei Termini, il numero di versione e l'impronta del PDF. Nessuno dei tre è
 * scritto nella pagina — sono lo stesso file `contenuti/termini.md` e lo stesso
 * PDF che l'acquirente si scarica, letti una volta.
 */
export default function Acquista() {
  const termini = leggiPagina(SITO.termini);
  if (termini.versione === null) {
    throw new Error(
      "I Termini non portano un numero di versione, e la pagina d'acquisto lo mostra accanto\n"
        + "al PDF: senza, l'acquirente non saprebbe quale versione sta accettando.",
    );
  }

  return (
    <SchermataAcquisto
      termini={termini}
      versione={termini.versione}
      pdf={indirizzoPdfTermini(termini.versione)}
      impronta={improntaPdfTermini(termini.versione)}
    />
  );
}
