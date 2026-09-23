"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

/**
 * L'emoji di una riga, cambiabile da lì.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché si cambia dalla riga e non da un modulo
 * ─────────────────────────────────────────────────────────────────────────
 *
 * L'emoji è una cosa che si guarda in elenco e si corregge guardando
 * l'elenco: «questa non è quella giusta» è un pensiero che nasce lì, davanti
 * alle altre diciannove. Un modulo di modifica da aprire vorrebbe dire
 * perdere di vista le altre, che sono il motivo per cui questa non va bene.
 *
 * Il bottone è l'emoji stessa. Chi non ne vuole nessuna toglie la scelta —
 * «Nessuna» è una voce, non l'assenza di voci — e la riga resta senza, che è
 * una scelta legittima e diversa dal non aver mai scelto.
 */
export function SceltaEmoji({
  valore,
  etichetta,
  emoji,
  onScegli,
  className,
}: {
  /** Quella di adesso. `undefined` quando la riga non ne ha. */
  valore: string | undefined;
  /** Per chi legge con lo screen reader: «Emoji di Palestra». */
  etichetta: string;
  /** Fra quali si sceglie. */
  emoji: string[];
  onScegli: (emoji: string | undefined) => void;
  className?: string;
}) {
  const [aperto, setAperto] = React.useState(false);

  const scegli = (e: string | undefined) => {
    setAperto(false);
    if (e !== valore) onScegli(e);
  };

  return (
    <PopoverPrimitive.Root open={aperto} onOpenChange={setAperto}>
      <PopoverPrimitive.Trigger
        aria-label={etichetta}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-[8px] text-corpo",
          "transition-[background-color,border-color] duration-150 ease-quieto",
          "hover:bg-superficie-alt focus:outline-none focus:ring-2 focus:ring-accento/20",
          /* Senza emoji il bottone deve comunque vedersi: se no non si scopre. */
          valore === undefined && "border border-dashed border-bordo text-inchiostro-tenue/70",
          className,
        )}
      >
        <span aria-hidden>{valore ?? "+"}</span>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className={cn(
            "z-50 w-64 rounded-interna border border-bordo bg-superficie p-2 shadow-sollevato",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          )}
        >
          <div className="grid grid-cols-8 gap-1">
            {emoji.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => scegli(e)}
                aria-label={e}
                aria-pressed={e === valore}
                className={cn(
                  "flex size-7 items-center justify-center rounded-[6px] text-corpo",
                  "hover:bg-superficie-alt focus:outline-none focus:ring-2 focus:ring-accento/20",
                  e === valore && "bg-superficie-alt ring-1 ring-accento/40",
                )}
              >
                <span aria-hidden>{e}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => scegli(undefined)}
            className="mt-2 w-full rounded-[6px] px-2 py-1 text-left text-micro text-inchiostro-tenue hover:bg-superficie-alt"
          >
            Nessuna emoji
          </button>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
