"use client";

import Link from "next/link";
import { ChevronRight, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Regime } from "@/lib/fisco/tipi";
import { ROTTE } from "@/lib/rotte";

/**
 * Il regime in testata: un rimando, non un interruttore.
 *
 * Prima erano due segmenti affiancati, identici a quelli del periodo che lì
 * accanto cambiano davvero le cose. Sembravano premibili e a volte non
 * facevano niente: il regime si scrive nelle impostazioni dell'anno, e in un
 * archivio che non ne ha ancora — un telefono aperto per la prima volta — il
 * tocco cadeva nel vuoto senza dire niente.
 *
 * Il cambio di regime non è un interruttore comunque: cambia l'IVA in fattura,
 * la deducibilità dei costi, l'imposta. La configurazione lo spiega prima di
 * farlo cambiare, ed è lì che va chi lo cerca. Qui resta la risposta alla
 * domanda «in che regime sto guardando questi numeri», con la freccia che dice
 * dove porta.
 */
export function RegimeAttuale({
  regime,
  className,
  onNaviga,
}: {
  regime: Regime;
  className?: string;
  /** Serve a chiudere il foglio quando il rimando parte da lì dentro. */
  onNaviga?: () => void;
}) {
  return (
    <Link
      href={`${ROTTE.avvio}?passo=regime`}
      onClick={onNaviga}
      title="Il regime si cambia dalla configurazione, che spiega cosa comporta"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-bordo bg-superficie px-2.5 py-2 text-etichetta font-medium text-inchiostro transition-colors sm:py-1",
        "hover:border-inchiostro-tenue/40 hover:bg-superficie-alt",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accento focus-visible:ring-offset-2",
        className,
      )}
    >
      <Percent className="size-3.5 shrink-0 text-inchiostro-tenue" aria-hidden />
      {regime === "forfettario" ? "Forfettario" : "Ordinario"}
      <ChevronRight className="size-3.5 shrink-0 text-inchiostro-tenue" aria-hidden />
      <span className="sr-only"> — apri la configurazione per cambiarlo</span>
    </Link>
  );
}
