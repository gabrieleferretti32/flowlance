"use client";

import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { Card, CardCorpo } from "@/components/ui/card";
import { useSituazione } from "@/lib/dati/hooks";
import { contestoSuggerito, NOME_CONTESTO } from "@/lib/onboarding/percorso";
import { ROTTE } from "@/lib/rotte";

/**
 * L'invito al percorso di configurazione, quando ce n'è uno in sospeso.
 *
 * Compare da solo perché i tre momenti in cui serve — archivio vuoto, anno
 * appena chiuso, soglia superata — sono situazioni in cui l'utente non sa di
 * dover fare qualcosa. Una voce di menu non basta: chi non sa che gli manca
 * una configurazione non va a cercarla.
 */
export function InvitoPercorso({ anno, oggi }: { anno: number; oggi: string }) {
  const situazione = useSituazione(anno, oggi);
  if (!situazione) return null;

  const { contesto, motivo } = contestoSuggerito(situazione);
  if (!contesto) return null;

  return (
    <Card className="border border-accento/25 bg-accento-tenue">
      <CardCorpo className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <Compass className="mt-0.5 size-4 shrink-0 text-accento" aria-hidden />
          <div className="min-w-0">
            <p className="text-corpo font-medium">{NOME_CONTESTO[contesto]}</p>
            <p className="text-etichetta text-inchiostro-tenue">{motivo}</p>
          </div>
        </div>
        <Link
          href={ROTTE.avvio}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accento px-4 py-2 text-etichetta font-medium text-white transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accento focus-visible:ring-offset-2"
        >
          Comincia
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </CardCorpo>
    </Card>
  );
}
