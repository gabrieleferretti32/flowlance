"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { euro, euroTondo } from "@/lib/format";

/**
 * Il ritmo dell'anno: dodici colonne e una riga.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché il ritmo e non la percentuale
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Una barra che si riempie dice «sei al 37 %» e si ferma lì. Dodici colonne
 * con una riga sopra dicono un'altra cosa: **quante volte quella riga è stata
 * superata**. Se non è mai successo, l'obiettivo non è ambizioso, è di
 * qualcun altro; se succede un mese sì e uno no, è questione di costanza. È la
 * domanda che chi guarda si sta facendo davvero.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La riga è quella dell'anno intero
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il ritmo necessario si calcola su dodici mesi, non su quelli che restano.
 * Con il secondo, a ottobre le ultime tre colonne si troverebbero sopra la
 * testa un'asticella irraggiungibile — 21.263 € contro 8.450 — e il disegno
 * direbbe «hai sempre fallito» invece di «sei indietro». Il ritmo che
 * servirebbe da adesso è un numero del testo, non una riga del grafico.
 *
 * Una serie sola, quindi nessuna legenda: il titolo della card dice cos'è, e
 * la lettura del mese sotto il cursore compare in testa, dove l'occhio è già —
 * la stessa scelta del grafico dell'andamento.
 */
const COLORE = "#4C5BF5";
const INIZIALI = ["G", "F", "M", "A", "M", "G", "L", "A", "S", "O", "N", "D"];
const NOMI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

export function GraficoRitmo({
  mensili,
  necessario,
  mesiChiusi,
  fuoriScala = false,
}: {
  mensili: number[];
  /** Il ritmo che l'obiettivo chiede su dodici mesi: la riga orizzontale. */
  necessario: number;
  /** Quanti mesi sono chiusi: gli altri sono mesi che non sono ancora successi. */
  mesiChiusi: number;
  /**
   * L'obiettivo è talmente più alto del ritmo vero che tenerlo dentro il
   * disegno schiaccerebbe le colonne.
   *
   * Misurato: con una riga a 40.012 € e colonne da 5.400 €, i dodici mesi
   * finiscono nel dodicesimo inferiore del grafico e non si distinguono più
   * fra loro. Allora la riga esce dal disegno e lo dice: quello che resta
   * leggibile — il ritmo vero, mese per mese — è l'informazione che serve, e
   * la cifra irraggiungibile sta nel testo sopra.
   */
  fuoriScala?: boolean;
}) {
  const [attivo, setAttivo] = React.useState<number | null>(null);
  const dati = mensili.map((valore, i) => ({ etichetta: INIZIALI[i], valore, mese: i + 1 }));
  const mese = attivo !== null ? dati[attivo] : null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-1">
        <p className="text-etichetta text-inchiostro-tenue">
          {mese ? NOMI[mese.mese - 1] : "Fatturato mese per mese"}
        </p>
        <p className="cifre text-corpo font-medium tabular-nums">
          {mese
            ? euro(mese.valore)
            : /* Senza cursore si legge la riga: è il termine di paragone. */
              `${euro(necessario)} al mese è il ritmo necessario`}
        </p>
      </div>
      <div className="mt-2 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={dati}
            margin={{ top: 8, right: 12, bottom: 0, left: 4 }}
            accessibilityLayer
            onMouseMove={(stato) => {
              const indice = stato?.activeTooltipIndex;
              setAttivo(typeof indice === "number" ? indice : null);
            }}
            onMouseLeave={() => setAttivo(null)}
          >
            <CartesianGrid vertical={false} stroke="#E4E8F0" strokeDasharray="0" />
            <XAxis
              dataKey="etichetta"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#6B7392", fontSize: 11 }}
              dy={4}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fill: "#6B7392", fontSize: 11 }}
              tickFormatter={(v: number) => (v === 0 ? "0" : euroTondo(v))}
            />
            <Tooltip cursor={{ fill: "rgba(76, 91, 245, 0.06)" }} content={() => null} />
            {/*
              La riga del ritmo necessario. Tratteggiata e grigia: è un
              riferimento, non un dato — e un riferimento che si colora quanto
              le colonne diventa una tredicesima serie.
            */}
            <ReferenceLine
              y={necessario}
              stroke="#6B7392"
              strokeDasharray="4 4"
              strokeWidth={2}
              ifOverflow={fuoriScala ? "hidden" : "extendDomain"}
            />
            <Bar dataKey="valore" name="Fatturato" fill={COLORE} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="px-1 text-micro text-inchiostro-tenue">
        {fuoriScala
          ? `Il ritmo necessario — ${euro(necessario)} al mese — resta fuori dal disegno: tenerlo dentro schiaccerebbe le dodici colonne in fondo. `
          : "La riga tratteggiata è il ritmo che l'obiettivo chiede su dodici mesi. "}
        {mesiChiusi < 12
          ? `Le colonne vuote sono i mesi che devono ancora succedere: ne restano ${12 - mesiChiusi}.`
          : "L'anno è chiuso: sono tutti e dodici."}
      </p>
    </div>
  );
}
