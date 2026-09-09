"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Campo, Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { analizzaNumero, euro, perCampo } from "@/lib/format";
import type { Cliente, NotaCredito } from "@/lib/dati/tipi";
import type { FatturaCalcolata } from "@/lib/fisco/tipi";

/**
 * Il modulo di una nota di credito.
 *
 * L'importo si digita positivo: è uno storno, e il segno lo dà il tipo di
 * documento. Scriverlo negativo sarebbe un invito alla doppia negazione.
 */
export function ModuloNota({
  aperto,
  nota,
  clienti,
  fatture,
  onChiudi,
  onSalva,
}: {
  aperto: boolean;
  nota?: NotaCredito;
  clienti: Cliente[];
  fatture: FatturaCalcolata[];
  onChiudi: () => void;
  onSalva: (n: Omit<NotaCredito, "id">) => void | Promise<void>;
}) {
  const oggi = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [dataDocumento, setDataDocumento] = React.useState(nota?.dataDocumento ?? oggi);
  const [numero, setNumero] = React.useState(nota?.numero ?? "");
  const [clienteId, setClienteId] = React.useState(nota?.clienteId ?? clienti[0]?.id ?? "");
  const [descrizione, setDescrizione] = React.useState(nota?.descrizione ?? "");
  const [importo, setImporto] = React.useState(nota ? perCampo(nota.imponibile) : "");
  const [dataRimborso, setDataRimborso] = React.useState(nota?.dataRimborso ?? "");
  const [fatturaId, setFatturaId] = React.useState(nota?.riconciliazioni?.[0]?.fatturaId ?? "");
  const [salvando, setSalvando] = React.useState(false);

  const valore = analizzaNumero(importo) ?? 0;
  const valido = dataDocumento !== "" && clienteId !== "" && valore > 0;

  // Solo le fatture di quel cliente: agganciare una nota alla fattura di un
  // altro è quasi sempre un errore di battitura, e qui non serve permetterlo.
  const suggerite = fatture.filter((f) => f.clienteId === clienteId);

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    if (!valido || salvando) return;
    setSalvando(true);
    await onSalva({
      dataDocumento,
      numero: numero.trim(),
      clienteId,
      descrizione: descrizione.trim(),
      imponibile: Math.abs(valore),
      dataRimborso: dataRimborso || null,
      riconciliazioni: fatturaId ? [{ fatturaId, imponibile: Math.abs(valore) }] : [],
    });
    setSalvando(false);
    onChiudi();
  }

  return (
    <Dialog open={aperto} onOpenChange={(v) => !v && onChiudi()}>
      <DialogContent
        titolo={nota ? "Modifica la nota di credito" : "Nuova nota di credito"}
        descrizione="Uno storno su una fattura già emessa: riduce i ricavi e l'IVA a debito."
      >
        <form onSubmit={invia} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etichetta="Data del documento" htmlFor="nc-data" aiuto="Comanda sull'IVA">
              <Input
                id="nc-data"
                type="date"
                value={dataDocumento}
                onChange={(e) => setDataDocumento(e.target.value)}
              />
            </Campo>
            <Campo etichetta="Numero" htmlFor="nc-numero">
              <Input
                id="nc-numero"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="NC/2026/1"
              />
            </Campo>
          </div>

          <Campo etichetta="Cliente" htmlFor="nc-cliente">
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger id="nc-cliente">
                <SelectValue placeholder="Scegli un cliente" />
              </SelectTrigger>
              <SelectContent>
                {clienti.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <Campo etichetta="Descrizione" htmlFor="nc-descrizione">
            <Input
              id="nc-descrizione"
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              placeholder="Storno parziale retainer di giugno"
            />
          </Campo>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              etichetta="Importo dello storno"
              htmlFor="nc-importo"
              aiuto="Positivo: il segno lo dà il tipo di documento"
            >
              <Input
                id="nc-importo"
                numerico
                inputMode="decimal"
                value={importo}
                onChange={(e) => setImporto(e.target.value)}
                placeholder="0,00"
              />
            </Campo>
            <Campo
              etichetta="Data del rimborso"
              htmlFor="nc-rimborso"
              aiuto="Quando il denaro torna: comanda sui ricavi"
            >
              <Input
                id="nc-rimborso"
                type="date"
                value={dataRimborso}
                onChange={(e) => setDataRimborso(e.target.value)}
              />
            </Campo>
          </div>

          <Campo
            etichetta="Fattura di riferimento"
            htmlFor="nc-fattura"
            aiuto="Facoltativa: senza aggancio la nota vale lo stesso, e viene segnalata. Da qui se ne collega una; per spalmarla su più fatture si usa il registro."
          >
            <Select value={fatturaId || "-"} onValueChange={(v) => setFatturaId(v === "-" ? "" : v)}>
              <SelectTrigger id="nc-fattura">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-">— nessuna, per ora</SelectItem>
                {suggerite.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.numero} · {euro(f.imponibile)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variante="quieto" onClick={onChiudi}>
              Annulla
            </Button>
            <Button scrive type="submit" disabled={!valido || salvando}>
              Salva la nota
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
