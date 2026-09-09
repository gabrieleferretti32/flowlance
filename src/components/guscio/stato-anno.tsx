"use client";

import Link from "next/link";
import { Lock, LockOpen, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROTTE } from "@/lib/rotte";

export type StatoDellAnno = "aperto" | "chiuso" | "provvisorio";

const ASPETTO: Record<
  StatoDellAnno,
  { icona: typeof Lock; etichetta: string; classe: string; titolo: string }
> = {
  aperto: {
    icona: LockOpen,
    etichetta: "Aperto",
    classe: "bg-superficie-alt text-inchiostro-tenue hover:bg-bordo/60",
    titolo: "Anno aperto: documenti e riporti si muovono ancora. Vai alla chiusura d'anno.",
  },
  chiuso: {
    icona: Lock,
    etichetta: "Chiuso",
    classe: "bg-positivo-tenue text-[#0B8A63] hover:brightness-95",
    titolo: "Anno chiuso, e riapribile in qualsiasi momento. Vai alla chiusura d'anno.",
  },
  provvisorio: {
    icona: TriangleAlert,
    etichetta: "Provvisorio",
    classe: "bg-attenzione-tenue text-[#B8791A] hover:brightness-95",
    titolo:
      "I parametri di legge di quest'anno sono ereditati dall'anno precedente: i numeri sono stime.",
  },
};

/**
 * Lo stato dell'anno mostrato, attaccato al selettore in testa alla pagina.
 *
 * Serve a rispondere a una domanda che ogni schermata deve poter risolvere in
 * un colpo d'occhio: l'anno che sto guardando è ancora in movimento, l'ho già
 * chiuso, o sto leggendo numeri calcolati su aliquote stimate? È anche la porta
 * verso la chiusura d'anno, che altrimenti sarebbe una voce di menu come le
 * altre invece del momento in cui l'anno finisce.
 */
export function StatoAnno({ stato, className }: { stato: StatoDellAnno; className?: string }) {
  const { icona: Icona, etichetta, classe, titolo } = ASPETTO[stato];
  return (
    <Link
      href={ROTTE.chiusura}
      title={titolo}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-2 text-etichetta font-medium transition-colors sm:py-1",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accento focus-visible:ring-offset-2",
        classe,
        className,
      )}
    >
      <Icona className="size-3.5" aria-hidden />
      {etichetta}
      <span className="sr-only"> — vai alla chiusura d&apos;anno</span>
    </Link>
  );
}
