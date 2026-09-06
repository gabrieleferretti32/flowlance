"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { euro, percentuale } from "@/lib/format";
import type { RigaProspetto } from "@/lib/fisco/spiegazioni";

/**
 * Una riga del prospetto, con l'icona che apre la spiegazione.
 *
 * La spiegazione contiene i numeri reali di questa persona, non una nota
 * generica: serve a fidarsi del totale, o ad accorgersi che un'impostazione
 * è sbagliata.
 */
export function RigaDelProspetto({ riga }: { riga: RigaProspetto }) {
  const valore =
    riga.formato === "euro"
      ? euro(Number(riga.valore))
      : riga.formato === "percentuale"
        ? percentuale(Number(riga.valore))
        : String(riga.valore);

  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 px-4 py-2.5 sm:gap-4 sm:px-6",
        riga.totale && "bg-superficie-alt/70 font-medium",
      )}
    >
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className={cn("text-corpo", riga.totale && "font-medium")}>{riga.etichetta}</span>
        {(riga.formula || riga.nota) && <Spiegazione riga={riga} valore={valore} />}
      </span>
      <span
        className={cn(
          "cifre shrink-0 whitespace-nowrap text-corpo",
          riga.totale && "text-kpi-sm font-semibold",
          riga.formato === "testo" && "text-corpo font-normal",
        )}
      >
        {valore}
      </span>
    </div>
  );
}

function Spiegazione({ riga, valore }: { riga: RigaProspetto; valore: string }) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={`Come si calcola: ${riga.etichetta}`}
          /* 44 px sul telefono, dove si preme col pollice: da 30 si mancava e
             si finiva sulla riga. I margini negativi tengono la riga alta come
             prima — il bersaglio cresce, il prospetto no. Da 640 in su torna il
             segno piccolo, che con un mouse basta. */
          className="-my-2.5 flex size-11 shrink-0 items-center justify-center rounded-full text-inchiostro-tenue/70 transition-colors hover:bg-superficie-alt hover:text-accento focus-visible:text-accento sm:-my-0.5 sm:size-auto sm:p-0.5"
        >
          <HelpCircle className="size-3.5" aria-hidden />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={6}
          collisionPadding={16}
          className="z-50 w-[min(24rem,calc(100vw-2rem))] rounded-interna border border-bordo bg-superficie p-4 shadow-sollevato"
        >
          <p className="text-etichetta font-medium">{riga.etichetta}</p>
          <p className="cifre mt-0.5 text-kpi-sm font-semibold">{valore}</p>
          {riga.formula && <p className="mt-2 text-etichetta">{riga.formula}</p>}
          {riga.nota && (
            <p className="mt-2 border-t border-bordo pt-2 text-etichetta text-inchiostro-tenue">
              {riga.nota}
            </p>
          )}
          <PopoverPrimitive.Arrow className="fill-superficie" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
