"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { Vuoto } from "@/components/ui/vuoto";
import { Users } from "lucide-react";
import { euro, iniziali, percentuale } from "@/lib/format";
import type { RigaCliente } from "@/lib/analisi/dashboard";
import { ROTTE } from "@/lib/rotte";

const SOGLIA_ESPOSIZIONE = 0.4;

/**
 * Concentrazione del portafoglio.
 *
 * Barre orizzontali con etichetta diretta: una sola tinta per la grandezza,
 * l'identità la porta l'avatar del cliente, che ha lo stesso colore ovunque
 * nell'applicazione. Il rischio è detto a parole sopra il grafico, non
 * ricolorando la barra più lunga: il colore segue il cliente, mai la sua
 * posizione in classifica.
 */
export function GraficoConcentrazione({ righe }: { righe: RigaCliente[] }) {
  const massimo = Math.max(...righe.map((r) => r.emesso), 1);
  const primo = righe[0];
  const esposto = primo !== undefined && primo.quota > SOGLIA_ESPOSIZIONE;

  return (
    <Card>
      <CardCorpo className="pb-3">
        <CardTitolo>Concentrazione del portafoglio</CardTitolo>
        <CardSottotitolo>Fatturato emesso per cliente nell&apos;anno</CardSottotitolo>
      </CardCorpo>

      {righe.length === 0 ? (
        <Vuoto
          icona={Users}
          titolo="I clienti nascono dalle fatture: registra la prima per vedere il tuo portafoglio."
        />
      ) : (
        <>
          {esposto && (
            <p className="mx-6 mb-4 flex items-start gap-2 rounded-interna bg-attenzione-tenue px-3 py-2 text-etichetta text-[#B8791A]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <strong className="font-medium">{primo.nome}</strong> vale il{" "}
                {percentuale(primo.quota, 0)} del tuo fatturato. Una sua disdetta ti
                toglierebbe {euro(primo.emesso)} in un colpo solo.
              </span>
            </p>
          )}

          <ul className="space-y-3 px-4 pb-5 sm:px-6 sm:pb-6">
            {righe.map((r) => (
              <li key={r.id}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-micro font-semibold text-white"
                      style={{ backgroundColor: r.colore }}
                    >
                      {iniziali(r.nome)}
                    </span>
                    <span className="truncate text-etichetta">{r.nome}</span>
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    <span className="cifre text-etichetta font-semibold">{euro(r.emesso)}</span>
                    <span className="cifre w-10 text-right text-micro text-inchiostro-tenue">
                      {percentuale(r.quota, 0)}
                    </span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-superficie-alt">
                  <div
                    className="h-full rounded-full bg-accento transition-[width] duration-500 ease-quieto"
                    style={{ width: `${Math.max((r.emesso / massimo) * 100, 2)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          <p className="border-t border-bordo px-4 py-3 text-micro text-inchiostro-tenue sm:px-6">
            La concentrazione è il rischio numero uno di chi lavora da solo.{" "}
            <Link
              href={ROTTE.fatture}
              className="py-1.5 text-accento underline underline-offset-2"
            >
              Apri il registro fatture
            </Link>{" "}
            per vedere il dettaglio.
          </p>
        </>
      )}
    </Card>
  );
}
