"use client";

import * as React from "react";
import { FlaskConical, LogOut } from "lucide-react";
import { esciDallaDemo } from "@/lib/dati/demo-isolata";
import { useArchivioScelto } from "@/components/dati/guardia-archivio";
import { PREZZO_SCRITTO } from "@/lib/sito/acquisto";
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
 *
 * ─────────────────────────────────────────────────────────────────────────
 * E porta la via per comprare
 * ─────────────────────────────────────────────────────────────────────────
 *
 * La demo si apre nella stessa scheda, di proposito: aprirne una nuova aiuta
 * chi guarda le schede e su un telefono non aiuta nessuno. Ma finché questa
 * barra portava solo «Esci dalla demo», chi si convinceva provando il prodotto
 * non aveva **nessun modo di comprarlo** senza tornare indietro a mano: il buco
 * più caro possibile, perché perde chi era già convinto.
 *
 * Quindi qui ci sono due strade, e sono diverse per peso: comprare è un
 * pulsante pieno, uscire è un collegamento. Chi ha finito di guardare trova la
 * prima cosa, non la seconda.
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
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {/*
          `<a>` e non `<Link>`: si esce dalla demo, e uscire vuol dire ricaricare
          la pagina davvero. Una navigazione interna terrebbe in piedi lo stesso
          documento — e con lui l'archivio della demo, che deve restare chiuso
          alle spalle di chi va a comprare.
        */}
        <a
          href={SITO.acquisto}
          onClick={(e) => {
            e.preventDefault();
            esciDallaDemo(SITO.acquisto);
          }}
          className="rounded-campo bg-accento px-3 py-1.5 text-etichetta font-medium text-white transition-colors hover:bg-[#3D4CE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accento focus-visible:ring-offset-2"
        >
          Acquista — {PREZZO_SCRITTO.imponibile} + IVA
        </a>
        {/*
          Uscire riporta alla pagina di vendita, non al cruscotto: chi esce da
          una vetrina torna in negozio, non in un magazzino vuoto.
        */}
        <button
          type="button"
          onClick={() => esciDallaDemo(SITO.vendita)}
          className="-my-1 flex items-center gap-1.5 rounded-campo px-2 py-1 text-etichetta font-medium text-accento underline underline-offset-2 hover:bg-accento/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accento"
        >
          <LogOut className="size-4" aria-hidden />
          Esci dalla demo
        </button>
      </div>
    </div>
  );
}
