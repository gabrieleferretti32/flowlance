"use client";

import * as React from "react";
import { FlaskConical, LogOut } from "lucide-react";
import { esciDallaDemo } from "@/lib/dati/demo-isolata";
import { useArchivioScelto } from "@/components/dati/guardia-archivio";
import { SITO } from "@/lib/rotte";

/**
 * La riga che dice, sempre, che questa non è la tua app.
 *
 * Sta sopra ogni schermata e non si chiude. Una demo che a un certo punto non
 * si distingue più dall'applicazione vera è il modo di far inserire a qualcuno
 * la sua fattura vera dentro un archivio che non è il suo — e di fargliela
 * cercare, il giorno dopo, dove non c'è.
 *
 * Dice anche **dove finiscono le cose che scrivi qui**, perché è la prima
 * domanda che si fa chi prova a toccare qualcosa, e perché la risposta è buona:
 * restano, e restano separate.
 */
export function BarraDemo() {
  const { demo } = useArchivioScelto();
  if (!demo) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-accento/25 bg-accento-tenue px-4 py-2 sm:px-5 lg:px-8 print:hidden"
    >
      <FlaskConical className="size-4 shrink-0 text-accento" aria-hidden />
      {/*
        Il nome del dataset non compare. La prima stesura scriveva «i dati sono
        di {nome.toLowerCase()}», che su «Vetrina · ordinario con IVA» dava
        «ordinario con iva»: le sigle non si minuscolano, ed è la stessa svista
        che `parametri-utente.ts` documenta da mesi. Ma il difetto vero era
        prima: a chi apre la demo il nome interno di un dataset non dice
        niente. Quello che vuole sapere è se può toccare, e dove va a finire.
      */}
      <p className="min-w-0 text-etichetta">
        <span className="font-medium">Stai guardando la demo di Flowlance.</span>{" "}
        <span className="text-inchiostro-tenue">
          I numeri sono di un&apos;attività inventata. Puoi cambiarli: restano in un archivio
          separato sul tuo dispositivo, e non toccano niente di tuo.
        </span>
      </p>
      <button
        type="button"
        onClick={() => esciDallaDemo(SITO.vendita)}
        className="-my-1 ml-auto flex shrink-0 items-center gap-1.5 rounded-campo px-2 py-1 text-etichetta font-medium text-accento underline underline-offset-2 hover:bg-accento/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accento"
      >
        <LogOut className="size-4" aria-hidden />
        Esci dalla demo
      </button>
    </div>
  );
}
