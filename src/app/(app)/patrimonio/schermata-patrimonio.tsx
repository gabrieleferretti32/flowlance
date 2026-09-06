"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Campo, Input } from "@/components/ui/input";
import { BloccoScrittura } from "@/components/ui/blocco-scrittura";
import { Kpi } from "@/components/ui/kpi";
import { CellaModificabile } from "@/components/tabella/cella-modificabile";
import { Guscio } from "@/components/guscio/guscio";
import { calcolaPatrimonio, type VoceCalcolata } from "@/lib/analisi/pianificazione";
import {
  creaVocePatrimonio,
  eliminaVocePatrimonio,
  salvaVocePatrimonio,
} from "@/lib/dati/azioni";
import { useCalcoloAnno, useDati } from "@/lib/dati/hooks";
import { usePreferenze } from "@/lib/stato/preferenze";
import { analizzaNumero, euro, num, percentuale } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VocePatrimonio } from "@/lib/dati/tipi";

export function SchermataPatrimonio() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const dati = useDati();
  const calcolo = useCalcoloAnno(anno, oggi);

  const patrimonio = React.useMemo(() => {
    if (!dati || !calcolo) return null;
    const cashflow = calcolo.cashflow;
    const personale = dati.movimentiPersonali
      .filter((m) => m.anno === anno)
      .reduce(
        (a, m) => a + m.prelievi + m.altreEntrate - m.speseFisse - m.speseVariabili - m.risparmio,
        calcolo.impostazioni.saldoInizialePersonale,
      );
    const p = calcolo.prospetto;
    return calcolaPatrimonio({
      liquiditaAttivita: cashflow.saldoFinale,
      liquiditaPersonale: Math.round(personale * 100) / 100,
      creditiClienti: p.fattureCalcolate.filter((f) => !f.dataIncasso).reduce((a, f) => a + f.nettoIncasso, 0),
      creditoIva: calcolo.iva.creditoFinale,
      tasseAccantonate: cashflow.accantonatoTotale,
      debitiFornitori: p.costiCalcolati.filter((c) => !c.dataPagamento).reduce((a, c) => a + c.totale, 0),
      debitoIva: Math.max(0, calcolo.iva.totaleDaVersare - cashflow.mesi.reduce((a, m) => a + m.ivaVersata, 0)),
      debitoImposte: p.saldoResiduo,
      vociLibere: dati.patrimonio,
    });
  }, [dati, calcolo, anno]);

  if (!dati || !calcolo || !patrimonio) {
    return (
      <Guscio titolo="Patrimonio">
        <Card>
          <CaricamentoTabella righe={6} />
        </Card>
      </Guscio>
    );
  }

  return (
    <Guscio
      titolo="Patrimonio"
      descrizione={`Al 31 dicembre ${anno} · quello che possiedi meno quello che devi, al netto di ciò che è già impegnato`}
    >
      <div className="mx-auto max-w-4xl space-y-4">
        <section aria-label="Sintesi" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi etichetta="Totale attivo" valore={euro(patrimonio.totaleAttivo)} taglia="kpiSm" />
          <Kpi etichetta="Totale passivo" valore={euro(patrimonio.totalePassivo)} taglia="kpiSm" />
          <Kpi
            sfondo="scuro"
            etichetta="Patrimonio netto"
            valore={euro(patrimonio.patrimonioNetto)}
            taglia="kpiSm"
            nota="quello che resterebbe tuo se chiudessi oggi"
          />
          <Kpi
            etichetta="Tasse accantonate"
            valore={euro(patrimonio.tasseAccantonate)}
            taglia="kpiSm"
            nota="già dentro l'attivo, ma non spendibili"
          />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <ColonnaPatrimonio
            titolo="Attivo"
            sottotitolo="Quello che possiedi"
            voci={patrimonio.attivo}
            totale={patrimonio.totaleAttivo}
            vociLibere={dati.patrimonio.filter((v) => v.tipo === "attivo")}
            tipo="attivo"
          />
          <ColonnaPatrimonio
            titolo="Passivo"
            sottotitolo="Quello che devi"
            voci={patrimonio.passivo}
            totale={patrimonio.totalePassivo}
            vociLibere={dati.patrimonio.filter((v) => v.tipo === "passivo")}
            tipo="passivo"
          />
        </div>

        <Card>
          <CardCorpo>
            <CardTitolo>Indicatori</CardTitolo>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <Indicatore
                etichetta="Patrimonio netto liquido"
                valore={euro(patrimonio.patrimonioNettoLiquido)}
                nota="Solo cassa e crediti, senza beni durevoli."
              />
              <Indicatore
                etichetta="Incidenza dei debiti sull'attivo"
                valore={percentuale(patrimonio.incidenzaDebiti, 0)}
                nota="Quanta parte di ciò che possiedi è già di qualcun altro."
              />
              <Indicatore
                etichetta="Indice di liquidità immediata"
                valore={patrimonio.indiceLiquidita === null ? "—" : num(patrimonio.indiceLiquidita)}
                nota={
                  patrimonio.indiceLiquidita === null
                    ? "Nessun debito a breve da coprire."
                    : patrimonio.indiceLiquidita >= 1
                      ? "Sopra 1: la cassa copre i debiti a breve."
                      : "Sotto 1: la cassa non basta a coprire i debiti a breve."
                }
              />
            </dl>
          </CardCorpo>
        </Card>
      </div>
    </Guscio>
  );
}

function ColonnaPatrimonio({
  titolo,
  sottotitolo,
  voci,
  totale,
  vociLibere,
  tipo,
}: {
  titolo: string;
  sottotitolo: string;
  voci: VoceCalcolata[];
  totale: number;
  vociLibere: VocePatrimonio[];
  tipo: "attivo" | "passivo";
}) {
  const [descrizione, setDescrizione] = React.useState("");
  const [valore, setValore] = React.useState("");
  const numero = analizzaNumero(valore) ?? 0;

  return (
    <Card className="overflow-hidden">
      <CardCorpo className="pb-2">
        <CardTitolo>{titolo}</CardTitolo>
        <CardSottotitolo>{sottotitolo}</CardSottotitolo>
      </CardCorpo>

      <ul className="divide-y divide-bordo/70 border-y border-bordo">
        {voci.map((v) => {
          const libera = vociLibere.find((l) => l.id === v.id);
          return (
            <li key={v.id} className="flex items-center justify-between gap-3 py-1 pl-6 pr-2">
              <span className="min-w-0">
                {/*
                  Il nome va a capo, non si taglia. Con `truncate` «Liquidità del
                  conto attività» e «Liquidità del conto personale» leggevano tutte
                  e due «Liquidità del con…»: due righe diverse, due importi
                  diversi, lo stesso testo. Un importo attribuito a un nome che non
                  si distingue è un numero sbagliato, non un layout stretto.
                */}
                <span className="block text-corpo">{v.descrizione}</span>
                {v.nota && (
                  <span className="block text-micro text-inchiostro-tenue">{v.nota}</span>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                {libera ? (
                  <CellaModificabile
                    tipo="valuta"
                    etichetta={v.descrizione}
                    valore={libera.valore}
                    className="w-32"
                    onSalva={(nuovo) => void salvaVocePatrimonio({ ...libera, valore: Number(nuovo) })}
                  />
                ) : (
                  <span
                    className="cifre w-32 px-2 py-1 text-right text-corpo text-inchiostro-tenue"
                    title="Ricavata dagli altri dati: non si modifica a mano."
                  >
                    {euro(v.valore)}
                  </span>
                )}
                {libera ? (
                  <Button scrive
                    variante="quieto"
                    taglia="icona"
                    aria-label={`Elimina ${v.descrizione}`}
                    onClick={() => void eliminaVocePatrimonio(libera)}
                    className="hover:bg-negativo-tenue hover:text-negativo"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : (
                  <span className="size-9" aria-hidden />
                )}
              </span>
            </li>
          );
        })}
        <li className="flex items-center justify-between bg-superficie-alt/70 py-2 pl-6 pr-2">
          <span className="text-etichetta font-medium">Totale {titolo.toLowerCase()}</span>
          <span className="cifre w-32 pr-11 text-right text-corpo font-semibold">
            {euro(totale)}
          </span>
        </li>
      </ul>

      <CardCorpo className="pt-3">
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!descrizione.trim() || numero === 0) return;
            void creaVocePatrimonio({
              tipo,
              categoria: tipo === "attivo" ? "Altro attivo" : "Altro passivo",
              descrizione: descrizione.trim(),
              valore: numero,
            });
            setDescrizione("");
            setValore("");
          }}
        >
          <BloccoScrittura className="contents">
          <Campo etichetta="Nuova voce" htmlFor={`voce-${tipo}`} className="min-w-40 flex-1">
            <Input
              id={`voce-${tipo}`}
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              placeholder={tipo === "attivo" ? "Investimenti, immobili…" : "Mutuo, finanziamenti…"}
            />
          </Campo>
          <Campo etichetta="Valore" htmlFor={`valore-${tipo}`} className="w-32">
            <Input
              id={`valore-${tipo}`}
              numerico
              inputMode="decimal"
              value={valore}
              onChange={(e) => setValore(e.target.value)}
              placeholder="0,00"
            />
          </Campo>
          <Button type="submit" variante="contorno" disabled={!descrizione.trim() || numero === 0}>
            <Plus className="size-4" aria-hidden />
            Aggiungi
          </Button>
          </BloccoScrittura>
        </form>
      </CardCorpo>
    </Card>
  );
}

function Indicatore({
  etichetta,
  valore,
  nota,
}: {
  etichetta: string;
  valore: string;
  nota: string;
}) {
  return (
    <div className={cn("rounded-interna bg-superficie-alt p-3")}>
      <dt className="text-micro text-inchiostro-tenue">{etichetta}</dt>
      <dd className="cifre mt-1 text-kpi-sm font-semibold">{valore}</dd>
      <dd className="mt-1 text-micro text-inchiostro-tenue">{nota}</dd>
    </div>
  );
}
