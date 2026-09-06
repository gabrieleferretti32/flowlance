"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { euro, euroTondo } from "@/lib/format";

/**
 * Coppia di colori per due identità, non per due stadi: qui i regimi sono due
 * alternative, e la separazione va spinta. Indaco e ocra passano tutti i
 * controlli, contrasto e daltonismo compresi, con ampio margine.
 */
export const COLORE_FORFETTARIO = "#4C5BF5";
export const COLORE_ORDINARIO = "#B45309";

export type PuntoCurva = { ricavi: number; forfettario: number; ordinario: number };

/**
 * Dove si incrociano le due linee. È la domanda che ogni freelance si fa una
 * volta l'anno, e la risposta è un numero solo.
 */
export function CurvaRegimi({
  punti,
  incrocio,
  ricaviAttuali,
  limiteForfettario,
  aRiposo,
}: {
  punti: PuntoCurva[];
  incrocio: number | null;
  ricaviAttuali: number;
  limiteForfettario: number;
  /** Che cosa leggere quando il cursore non è sulla curva. */
  aRiposo: { forfettario: number; ordinario: number };
}) {
  const [attivo, setAttivo] = React.useState<number | null>(null);
  const puntoAttivo = attivo !== null ? punti[attivo] : null;
  // A riposo la legenda mostra i valori del fatturato scelto con lo slider:
  // due trattini non dicono niente a nessuno.
  const punto = puntoAttivo ?? { ricavi: ricaviAttuali, ...aRiposo };

  const differenza = punto.forfettario - punto.ordinario;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 pb-2">
        <dl className="flex gap-6">
          <Voce
            colore={COLORE_FORFETTARIO}
            etichetta="Netto in forfettario"
            valore={punto.forfettario}
          />
          <Voce colore={COLORE_ORDINARIO} etichetta="Netto in ordinario" valore={punto.ordinario} />
        </dl>
        <p className="max-w-64 text-right text-etichetta text-inchiostro-tenue">
          A {euroTondo(punto.ricavi)} di ricavi la differenza è {euro(Math.abs(differenza))} a
          favore del {differenza >= 0 ? "forfettario" : "ordinario"}.
          {/* L'invito sparisce sotto i 768: descrive un gesto che su un vetro non
              esiste, e il numero che promette è già scritto qui sopra. */}
          {puntoAttivo === null && (
            <span className="hidden md:inline"> Passa sulla curva per esplorare altri fatturati.</span>
          )}
        </p>
      </div>

      <div className="h-72 px-2 pb-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={punti}
            margin={{ top: 12, right: 16, bottom: 0, left: 4 }}
            accessibilityLayer
            onMouseMove={(stato) => {
              const indice = stato?.activeTooltipIndex;
              setAttivo(typeof indice === "number" ? indice : null);
            }}
            onMouseLeave={() => setAttivo(null)}
          >
            <CartesianGrid vertical={false} stroke="#E4E8F0" />
            {/*
              Le tacche si diradano da sole. Con un intervallo fisso a 375 px ne
              uscivano dieci larghe 46 px ogni 27: si sovrapponevano tutte, e
              l'asse non si leggeva più. `minTickGap` dice la distanza minima fra
              due etichette e lascia decidere allo spazio quante ne stanno: sul
              telefono restano quattro o cinque, sul desktop tornano tutte.
            */}
            <XAxis
              dataKey="ricavi"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#6B7392", fontSize: 11 }}
              tickFormatter={(v: number) => euroTondo(v)}
              interval="preserveStartEnd"
              minTickGap={52}
              dy={4}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={64}
              tick={{ fill: "#6B7392", fontSize: 11 }}
              tickFormatter={(v: number) => euroTondo(v)}
            />
            <Tooltip cursor={{ stroke: "#6B7392", strokeDasharray: "3 3" }} content={() => null} />

            {ricaviAttuali > 0 && (
              <ReferenceLine
                x={arrotondaAlPunto(ricaviAttuali, punti)}
                stroke="#6B7392"
                strokeDasharray="4 4"
                /*
                  Una riga più in basso della soglia rossa. Le due etichette
                  partono da linee diverse e crescono l'una verso l'altra: su uno
                  schermo stretto si incontravano a metà — «dove seilimite
                  85.000 €». Sfalsate in verticale non possono più toccarsi,
                  qualunque sia la distanza fra le due linee.
                */
                label={{
                  value: "dove sei",
                  position: "insideTopLeft",
                  fill: "#6B7392",
                  fontSize: 11,
                  dy: 15,
                }}
              />
            )}
            <ReferenceLine
              x={arrotondaAlPunto(limiteForfettario, punti)}
              stroke="#E5484D"
              strokeDasharray="2 4"
              label={{
                value: `limite ${euroTondo(limiteForfettario)}`,
                position: "insideTopRight",
                fill: "#E5484D",
                fontSize: 11,
              }}
            />
            {incrocio !== null && (
              <ReferenceDot
                x={arrotondaAlPunto(incrocio, punti)}
                y={valoreAlPunto(incrocio, punti)}
                r={5}
                fill="#0E1330"
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            )}

            <Line
              type="monotone"
              dataKey="forfettario"
              name="Forfettario"
              stroke={COLORE_FORFETTARIO}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#FFFFFF" }}
            />
            <Line
              type="monotone"
              dataKey="ordinario"
              name="Ordinario"
              stroke={COLORE_ORDINARIO}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: "#FFFFFF" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Voce({
  colore,
  etichetta,
  valore,
}: {
  colore: string;
  etichetta: string;
  valore: number;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-micro text-inchiostro-tenue">
        <span className="size-2 rounded-full" style={{ backgroundColor: colore }} aria-hidden />
        {etichetta}
      </dt>
      <dd className="cifre mt-0.5 text-kpi-sm font-semibold">{euro(valore)}</dd>
    </div>
  );
}

/** Il punto della serie più vicino al valore: le linee guida stanno sui punti. */
function arrotondaAlPunto(valore: number, punti: PuntoCurva[]): number {
  if (punti.length === 0) return valore;
  return punti.reduce((migliore, p) =>
    Math.abs(p.ricavi - valore) < Math.abs(migliore.ricavi - valore) ? p : migliore,
  ).ricavi;
}

function valoreAlPunto(ricavi: number, punti: PuntoCurva[]): number {
  const p = punti.find((x) => x.ricavi === arrotondaAlPunto(ricavi, punti));
  return p ? (p.forfettario + p.ordinario) / 2 : 0;
}
