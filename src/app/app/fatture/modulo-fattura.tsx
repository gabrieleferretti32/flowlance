"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Campo, Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { creaCliente, creaFattura, prossimoNumero } from "@/lib/dati/azioni";
import type { Cliente, Fattura } from "@/lib/dati/tipi";
import { analizzaNumero, euro } from "@/lib/format";

const NUOVO = "__nuovo__";

/**
 * Modulo di inserimento. I campi calcolati non ci sono: si scrive l'imponibile
 * e il totale si legge sotto, aggiornato mentre si digita.
 */
export function ModuloFattura({
  aperto,
  onChiudi,
  clienti,
  fatture,
  anno,
  ordinario,
  aliquotaIvaPredefinita,
}: {
  aperto: boolean;
  onChiudi: () => void;
  clienti: Cliente[];
  fatture: Fattura[];
  anno: number;
  ordinario: boolean;
  aliquotaIvaPredefinita: number;
}) {
  const oggi = new Date().toISOString().slice(0, 10);
  const [dataEmissione, setDataEmissione] = React.useState(oggi);
  const [numero, setNumero] = React.useState("");
  const [clienteId, setClienteId] = React.useState("");
  const [nuovoCliente, setNuovoCliente] = React.useState("");
  const [descrizione, setDescrizione] = React.useState("");
  const [tipoRicavo, setTipoRicavo] = React.useState<Fattura["tipoRicavo"]>("progetto");
  const [imponibile, setImponibile] = React.useState("");
  const [salvando, setSalvando] = React.useState(false);

  // Alla riapertura il modulo riparte pulito, con il numero successivo pronto.
  React.useEffect(() => {
    if (!aperto) return;
    setDataEmissione(oggi);
    setNumero(prossimoNumero(fatture, anno));
    setClienteId(clienti[0]?.id ?? NUOVO);
    setNuovoCliente("");
    setDescrizione("");
    setTipoRicavo("progetto");
    setImponibile("");
  }, [aperto, anno, clienti, fatture, oggi]);

  const valore = analizzaNumero(imponibile) ?? 0;
  const aliquota = ordinario ? aliquotaIvaPredefinita : 0;
  const iva = Math.round(valore * aliquota * 100) / 100;
  const bollo = aliquota === 0 && valore > 77.47 ? 2 : 0;
  const totale = valore + iva + bollo;

  const nomeCliente = clienteId === NUOVO ? nuovoCliente.trim() : "";
  const valido = valore > 0 && (clienteId !== NUOVO || nomeCliente.length > 0);

  async function salva() {
    if (!valido || salvando) return;
    setSalvando(true);
    try {
      const id = clienteId === NUOVO ? await creaCliente(nomeCliente) : clienteId;
      await creaFattura({
        dataEmissione,
        numero,
        clienteId: id,
        descrizione,
        tipoRicavo,
        imponibile: valore,
        dataIncasso: null,
      });
      onChiudi();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aperto} onOpenChange={(v) => !v && onChiudi()}>
      <DialogContent
        titolo="Nuova fattura"
        descrizione="IVA, bollo e scadenza si calcolano da soli dalle impostazioni."
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void salva();
          }}
        >
          <Campo etichetta="Data di emissione" htmlFor="f-data">
            <Input id="f-data" type="date" value={dataEmissione}
              onChange={(e) => setDataEmissione(e.target.value)} />
          </Campo>
          <Campo etichetta="Numero" htmlFor="f-numero">
            <Input id="f-numero" value={numero} onChange={(e) => setNumero(e.target.value)}
              className="cifre" />
          </Campo>

          <Campo etichetta="Cliente" htmlFor="f-cliente" className="sm:col-span-2">
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger id="f-cliente">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {clienti.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
                <SelectItem value={NUOVO}>Nuovo cliente…</SelectItem>
              </SelectContent>
            </Select>
          </Campo>

          {clienteId === NUOVO && (
            <Campo etichetta="Nome del nuovo cliente" htmlFor="f-nuovo" className="sm:col-span-2">
              <Input id="f-nuovo" autoFocus value={nuovoCliente}
                onChange={(e) => setNuovoCliente(e.target.value)}
                placeholder="Ragione sociale o nome e cognome" />
            </Campo>
          )}

          <Campo etichetta="Descrizione" htmlFor="f-descrizione" className="sm:col-span-2">
            <Input id="f-descrizione" value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              placeholder="Che cosa hai fatturato" />
          </Campo>

          <Campo etichetta="Tipo di ricavo" htmlFor="f-tipo">
            <Select value={tipoRicavo} onValueChange={(v) => setTipoRicavo(v as Fattura["tipoRicavo"])}>
              <SelectTrigger id="f-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ricorrente">Ricorrente</SelectItem>
                <SelectItem value="progetto">Progetto</SelectItem>
                <SelectItem value="unaTantum">Una tantum</SelectItem>
              </SelectContent>
            </Select>
          </Campo>

          <Campo etichetta="Imponibile" htmlFor="f-imponibile" aiuto="Senza IVA, rivalsa e bollo">
            <Input id="f-imponibile" numerico inputMode="decimal" value={imponibile}
              onChange={(e) => setImponibile(e.target.value)} placeholder="0,00" />
          </Campo>

          <div className="rounded-interna bg-superficie-alt p-3 sm:col-span-2">
            <dl className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <dt className="text-micro text-inchiostro-tenue">Imponibile</dt>
                <dd className="cifre text-corpo">{euro(valore)}</dd>
              </div>
              {ordinario && (
                <div>
                  <dt className="text-micro text-inchiostro-tenue">IVA</dt>
                  <dd className="cifre text-corpo">{euro(iva)}</dd>
                </div>
              )}
              {bollo > 0 && (
                <div>
                  <dt className="text-micro text-inchiostro-tenue">Bollo</dt>
                  <dd className="cifre text-corpo">{euro(bollo)}</dd>
                </div>
              )}
              <div className="text-right">
                <dt className="text-micro text-inchiostro-tenue">Totale fattura</dt>
                <dd className="cifre text-kpi-sm font-semibold">{euro(totale)}</dd>
              </div>
            </dl>
          </div>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variante="quieto" onClick={onChiudi}>Annulla</Button>
            <Button scrive type="submit" disabled={!valido || salvando}>Salva la fattura</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
