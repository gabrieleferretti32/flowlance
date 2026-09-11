"use client";

import * as React from "react";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { correggiVersamento, creaVersamento } from "@/lib/dati/azioni";
import { analizzaNumero, data as fmtData, euro, perCampo } from "@/lib/format";
import { round2 } from "@/lib/fisco/aritmetica";
import type { PeriodoIva } from "@/lib/fisco/iva";
import type { CausaScostamento, ScostamentoPeriodo } from "@/lib/fisco/scostamento-iva";
import { versamentiPerPeriodo } from "@/lib/fisco/scostamento-iva";
import type { VersamentoF24 } from "@/lib/fisco/tipi";

/**
 * Il confronto con l'F24 vero.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché esiste
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un'ora persa a capire perché Flowlance dicesse 454,87 e l'F24 821,19. Alla
 * fine non era un errore dell'app: il commercialista non aveva ancora scaricato
 * una nota di credito, e aveva datato alcune fatture d'acquisto per ricezione
 * invece che per documento.
 *
 * Nessun cliente farà quel lavoro. Vedrà due numeri diversi e concluderà che
 * l'app sbaglia. Questa sezione fa la metà che l'app può fare da sola: **dire
 * quali righe possono spiegare la differenza, e quanto direbbe il periodo se
 * fosse quella la ragione.** Non «può capitare»: l'importo esatto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Due cose che non fa, e sono volute
 * ─────────────────────────────────────────────────────────────────────────
 *
 * — **Non corregge niente.** Gli scenari restano scenari: l'archivio non ha la
 *   data di ricezione, e spostare i documenti su un'ipotesi vorrebbe dire
 *   riscrivere un registro fiscale su un indizio.
 * — **Non promette di aver elencato tutto.** Un documento che manca
 *   dall'archivio non lascia traccia, e non c'è verso di dedurlo da qui. Sta
 *   scritto sotto, invece di lasciar credere che le due cause siano tutte.
 */

export function ConfrontoF24({
  periodi,
  scostamenti,
  versamenti,
  anno,
}: {
  periodi: PeriodoIva[];
  scostamenti: ScostamentoPeriodo[];
  versamenti: VersamentoF24[];
  anno: number;
}) {
  const perPeriodo = React.useMemo(
    () => versamentiPerPeriodo(periodi, versamenti, anno),
    [periodi, versamenti, anno],
  );

  const righe = periodi
    .map((p) => ({
      periodo: p,
      scostamento: scostamenti.find((s) => s.indice === p.indice),
      versati: perPeriodo.get(p.indice) ?? [],
    }))
    /*
      I periodi senza niente da dire non compaiono. Una riga «nessuno scarto
      possibile» su ogni trimestre di ogni archivio è rumore, e il rumore si
      impara a saltare proprio nel momento in cui comincia a dire qualcosa.
    */
    .filter(
      (r) =>
        (r.scostamento?.cause.length ?? 0) > 0 || r.versati.length > 0 || r.periodo.totaleDaVersare > 0,
    );

  if (righe.length === 0) return null;

  return (
    <Card>
      <CardCorpo className="pb-2">
        <CardTitolo>Il tuo F24 dice un altro numero?</CardTitolo>
        <CardSottotitolo>
          Scrivi quanto hai versato davvero: qui sotto ci sono le righe che possono spiegare la
          differenza, dalla più pesante.
        </CardSottotitolo>
      </CardCorpo>

      <CardCorpo className="space-y-3 pt-0">
        {righe.map(({ periodo, scostamento, versati }) => (
          <RigaConfronto
            key={periodo.indice}
            periodo={periodo}
            scostamento={scostamento}
            versati={versati}
            anno={anno}
          />
        ))}
      </CardCorpo>

      <CardCorpo className="pt-0">
        <p className="text-micro text-inchiostro-tenue">
          Resta una causa che da qui non si vede: un documento che l&apos;archivio non ha. Mancare è
          l&apos;unica cosa che non lascia traccia — se la differenza non torna con le righe qui
          sopra, è lì che conviene guardare.
        </p>
      </CardCorpo>
    </Card>
  );
}

function RigaConfronto({
  periodo,
  scostamento,
  versati,
  anno,
}: {
  periodo: PeriodoIva;
  scostamento?: ScostamentoPeriodo;
  versati: { id: string; data: string; importo: number }[];
  anno: number;
}) {
  const versato = versati.length > 0 ? round2(versati.reduce((a, v) => a + v.importo, 0)) : null;
  const differenza = versato === null ? null : round2(versato - periodo.totaleDaVersare);
  const cause = scostamento?.cause ?? [];

  return (
    <div className="rounded-campo border border-bordo bg-superficie-alt px-3 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div>
          <span className="text-etichetta font-medium">{periodo.etichetta}</span>
          <span className="text-micro text-inchiostro-tenue">
            {" · "}Flowlance dice <span className="cifre">{euro(periodo.totaleDaVersare)}</span>
            {periodo.scadenza ? ` · scadenza ${fmtData(periodo.scadenza)}` : ""}
          </span>
        </div>
        <CampoVersato
          periodo={periodo}
          versati={versati}
          anno={anno}
          versato={versato}
        />
      </div>

      {differenza !== null && differenza !== 0 && (
        <p className="mt-2 text-etichetta">
          <span className="font-medium text-[#B8791A]">
            Differenza {differenza > 0 ? "+" : "−"} {euro(Math.abs(differenza))}
          </span>
          <span className="text-inchiostro-tenue">
            {" "}
            — il tuo F24 dice {differenza > 0 ? "di più" : "di meno"} di questo calcolo.
          </span>
        </p>
      )}

      {cause.length > 0 && (
        <ul className="mt-2 space-y-2">
          {cause.map((c) => (
            <li key={c.chiave}>
              <Causa causa={c} calcolato={periodo.totaleDaVersare} differenza={differenza} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Il campo dove si scrive quanto si è versato davvero.
 *
 * Scriverlo **registra un versamento F24** vero, datato alla scadenza del
 * periodo: è quello che è, e da lì entra anche nel cashflow invece di restare
 * un numero che vive solo su questa schermata. Se il periodo ne ha già più di
 * uno il campo non scrive: sommarli in uno solo perderebbe due date vere per
 * far quadrare una casella.
 */
function CampoVersato({
  periodo,
  versati,
  anno,
  versato,
}: {
  periodo: PeriodoIva;
  versati: { id: string; data: string; importo: number }[];
  anno: number;
  versato: number | null;
}) {
  const [bozza, setBozza] = React.useState<string | null>(null);
  const troppi = versati.length > 1;
  const id = `f24-${periodo.indice}`;

  if (troppi) {
    return (
      <span className="text-micro text-inchiostro-tenue">
        {versati.length} versamenti IVA in questo periodo,{" "}
        <span className="cifre">{euro(versato ?? 0)}</span> in tutto · si modificano da «Dati»
      </span>
    );
  }

  async function salva(testo: string) {
    const valore = analizzaNumero(testo);
    setBozza(null);
    if (valore === null || valore < 0) return;
    const esistente = versati[0];
    if (esistente) {
      if (round2(valore) === round2(esistente.importo)) return;
      const completo = { id: esistente.id, data: esistente.data, importo: esistente.importo } as const;
      await correggiVersamento({ ...completo, tipo: "iva", annoImposta: anno }, valore);
      return;
    }
    if (valore === 0) return;
    await creaVersamento({
      // La data è la scadenza del periodo: è quando quell'F24 si paga.
      data: periodo.scadenza ?? `${anno}-12-31`,
      tipo: "iva",
      importo: round2(valore),
      annoImposta: anno,
    });
  }

  return (
    <label htmlFor={id} className="flex items-center gap-2">
      <span className="text-micro text-inchiostro-tenue">Versato</span>
      <Input
        id={id}
        numerico
        inputMode="decimal"
        className="h-8 w-28"
        placeholder="—"
        value={bozza ?? (versato === null ? "" : perCampo(versato))}
        onChange={(e) => setBozza(e.target.value)}
        onBlur={(e) => void salva(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

const TESTO: Record<CausaScostamento["chiave"], (n: number) => string> = {
  ricezione: (n) =>
    `${n} ${n === 1 ? "acquisto datato" : "acquisti datati"} negli ultimi giorni di questo periodo`,
  ricezioneDalPrecedente: (n) =>
    `${n} ${n === 1 ? "acquisto datato" : "acquisti datati"} negli ultimi giorni del periodo precedente`,
  note: (n) => `${n} ${n === 1 ? "nota di credito emessa" : "note di credito emesse"} nel periodo`,
};

const SPIEGA: Record<CausaScostamento["chiave"], string> = {
  ricezione:
    "Se chi compila l'F24 li ha registrati alla data di ricezione — cioè nel periodo dopo — questo periodo dice",
  ricezioneDalPrecedente:
    "Se li ha registrati alla data di ricezione sono caduti qui, e allora questo periodo dice",
  note: "Se non le ha ancora scaricate, il suo debito è più alto e l'F24 dice",
};

function Causa({
  causa,
  calcolato,
  differenza,
}: {
  causa: CausaScostamento;
  calcolato: number;
  differenza: number | null;
}) {
  const ivaInGioco = round2(causa.righe.reduce((a, r) => a + r.iva, 0));
  /*
    «Spiega la differenza» solo quando la spiega davvero: stesso verso e non più
    grande del divario. Un'ipotesi che va nella direzione sbagliata non è una
    spiegazione, ed è la cosa che chi legge deve poter scartare per prima.
  */
  const spiega =
    differenza !== null
    && differenza !== 0
    && Math.sign(causa.effetto) === Math.sign(differenza)
    && Math.abs(causa.effetto) <= Math.abs(differenza) + 0.005;

  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-etichetta [&::-webkit-details-marker]:hidden">
        <span className="font-medium">{TESTO[causa.chiave](causa.righe.length)}</span>
        <span className="text-inchiostro-tenue">
          {" · "}
          {euro(ivaInGioco)} di IVA. {SPIEGA[causa.chiave]}{" "}
        </span>
        <span className="cifre font-medium">{euro(causa.seFosse)}</span>
        <span className="text-inchiostro-tenue"> invece di </span>
        <span className="cifre">{euro(calcolato)}</span>
        {spiega && (
          <span className="text-positivo">
            {" · "}spiega {euro(Math.abs(causa.effetto))} della differenza
          </span>
        )}
        <span className="text-inchiostro-tenue"> — quali</span>
        <span className="text-accento group-open:hidden"> ▸</span>
        <span className="hidden text-accento group-open:inline"> ▾</span>
      </summary>
      <ul className="mt-1.5 space-y-1 border-l border-bordo pl-3">
        {causa.righe.map((r) => (
          <li key={`${r.etichetta}-${r.data}`} className="flex justify-between gap-3 text-micro">
            <span className="text-inchiostro-tenue">
              {fmtData(r.data)} · {r.etichetta}
            </span>
            <span className="cifre">{euro(r.iva)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
