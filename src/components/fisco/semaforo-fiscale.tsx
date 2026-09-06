"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { euro, percentuale } from "@/lib/format";

export type SegmentoSemaforo = {
  chiave: string;
  etichetta: string;
  valore: number;
  colore: string;
  /** Riga di dettaglio mostrata al passaggio del mouse. */
  dettaglio: string;
};

/**
 * Il semaforo fiscale: l'unico punto del prodotto in cui spendiamo audacia.
 *
 * Scompone tutto l'incassato dell'anno in quattro segmenti proporzionali.
 * Al passaggio del mouse il segmento si alza e mostra il dettaglio; al cambio
 * di anno o di regime i segmenti si ridistribuiscono con una transizione fluida.
 * Tutto il resto del prodotto — tabelle, form, grafici — resta quieto:
 * è il contrasto a rendere memorabile questa barra.
 */
export function SemaforoFiscale({
  totale,
  segmenti,
  titolo = "Di questi soldi, quanti sono davvero tuoi",
  className,
}: {
  totale: number;
  segmenti: SegmentoSemaforo[];
  titolo?: string;
  className?: string;
}) {
  const [attivo, setAttivo] = React.useState<string | null>(null);
  const visibili = segmenti.filter((s) => s.valore > 0);
  const somma = visibili.reduce((acc, s) => acc + s.valore, 0);
  const base = somma > 0 ? somma : 1;
  const principale = segmenti[0];
  const segmentoAttivo = visibili.find((s) => s.chiave === attivo) ?? null;

  if (totale <= 0) {
    return (
      <div
        className={cn(
          "rounded-card bg-superficie p-6 text-center shadow-riposo",
          className,
        )}
      >
        <p className="text-corpo text-inchiostro-tenue">
          Registra la prima fattura incassata per vedere come si divide il tuo anno.
        </p>
      </div>
    );
  }

  return (
    <section
      className={cn("rounded-card bg-superficie p-4 shadow-riposo sm:p-6", className)}
      aria-label="Composizione dell'incassato dell'anno"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-etichetta text-inchiostro-tenue">{titolo}</p>
          <p className="cifre mt-1 text-semaforo font-semibold tracking-tight">
            {euro(principale.valore)}
          </p>
          {/*
            «Incassati» da solo era ambiguo: qui il totale è il denaro entrato
            in cassa, IVA compresa, mentre la card «Incassato» poco sotto mostra
            l'imponibile. Stessa parola, due grandezze, stessa schermata: ogni
            volta che compare va detto di quale delle due si parla.
          */}
          <p className="mt-1 text-etichetta text-inchiostro-tenue">
            {percentuale(principale.valore / base, 1)} di {euro(totale)} entrati in cassa, IVA
            compresa
          </p>
        </div>

        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          {visibili.map((s) => (
            <div key={s.chiave} className="min-w-24">
              <dt className="flex items-center gap-1.5 text-micro text-inchiostro-tenue">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: s.colore }}
                  aria-hidden
                />
                {s.etichetta}
              </dt>
              <dd className="cifre mt-0.5 text-etichetta font-semibold">{euro(s.valore)}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* La barra. Ogni segmento è un bottone: si può raggiungere da tastiera. */}
      <div
        className="mt-5 flex h-16 w-full items-end gap-1"
        onMouseLeave={() => setAttivo(null)}
      >
        {visibili.map((s) => {
          const quota = s.valore / base;
          const acceso = attivo === s.chiave;
          return (
            <button
              key={s.chiave}
              type="button"
              onMouseEnter={() => setAttivo(s.chiave)}
              onFocus={() => setAttivo(s.chiave)}
              onBlur={() => setAttivo(null)}
              /* Il tocco fa quello che fa il passaggio del mouse: senza, su un
                 telefono il dettaglio di ogni voce era irraggiungibile. */
              onClick={() => setAttivo(s.chiave)}
              aria-label={`${s.etichetta}: ${euro(s.valore)}, ${percentuale(quota, 1)}`}
              className={cn(
                "group relative flex min-w-2 items-center justify-center overflow-hidden rounded-[10px]",
                "transition-[width,height,filter] duration-500 ease-quieto",
                acceso ? "h-16 brightness-105" : "h-[3.25rem]",
              )}
              style={{ width: `${quota * 100}%`, backgroundColor: s.colore }}
            >
              {quota > 0.11 && (
                <span className="cifre px-2 text-center text-etichetta font-semibold text-white">
                  {percentuale(quota, 0)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Il dettaglio occupa sempre lo stesso spazio: nessun salto di layout. */}
      <p
        className="mt-3 min-h-5 text-etichetta text-inchiostro-tenue"
        aria-live="polite"
      >
        {segmentoAttivo ? (
          segmentoAttivo.dettaglio
        ) : (
          <>
            {/* Il verbo cambia con l'apparecchio: sul telefono si tocca, e dirgli
                di passare col mouse è una bugia in caratteri piccoli. */}
            <span className="md:hidden">Tocca un segmento per il dettaglio di ogni voce.</span>
            <span className="hidden md:inline">
              Passa sui segmenti per il dettaglio di ogni voce.
            </span>
          </>
        )}
      </p>
    </section>
  );
}

export const COLORI_SEMAFORO = {
  netto: "#0E1330",
  imposte: "#4C5BF5",
  contributi: "#F5A524",
  iva: "#6B7392",
} as const;
