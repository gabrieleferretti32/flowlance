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
import { creaCosto } from "@/lib/dati/azioni";
import type { Costo } from "@/lib/dati/tipi";
import { analizzaNumero, analizzaPercentuale, euro } from "@/lib/format";

export function ModuloCosto({
  aperto,
  onChiudi,
  categorie,
  forfettario,
  aliquotaIvaPredefinita,
}: {
  aperto: boolean;
  onChiudi: () => void;
  categorie: string[];
  forfettario: boolean;
  aliquotaIvaPredefinita: number;
}) {
  const oggi = new Date().toISOString().slice(0, 10);
  const [dataDocumento, setDataDocumento] = React.useState(oggi);
  const [fornitore, setFornitore] = React.useState("");
  const [categoria, setCategoria] = React.useState(categorie[0] ?? "Altro");
  const [descrizione, setDescrizione] = React.useState("");
  const [natura, setNatura] = React.useState<Costo["natura"]>("variabile");
  const [imponibile, setImponibile] = React.useState("");
  const [aliquota, setAliquota] = React.useState(String(Math.round(aliquotaIvaPredefinita * 100)));
  const [deducibilita, setDeducibilita] = React.useState("100");
  const [pagatoOggi, setPagatoOggi] = React.useState(true);
  const [salvando, setSalvando] = React.useState(false);

  React.useEffect(() => {
    if (!aperto) return;
    setDataDocumento(oggi);
    setFornitore("");
    setCategoria(categorie[0] ?? "Altro");
    setDescrizione("");
    setNatura("variabile");
    setImponibile("");
    setAliquota(String(Math.round(aliquotaIvaPredefinita * 100)));
    setDeducibilita("100");
    setPagatoOggi(true);
  }, [aperto, categorie, aliquotaIvaPredefinita, oggi]);

  const valore = analizzaNumero(imponibile) ?? 0;
  const aliquotaIva = analizzaPercentuale(aliquota) ?? 0;
  const iva = Math.round(valore * aliquotaIva * 100) / 100;
  const valido = valore > 0 && fornitore.trim().length > 0;

  async function salva() {
    if (!valido || salvando) return;
    setSalvando(true);
    try {
      await creaCosto({
        dataDocumento,
        fornitore: fornitore.trim(),
        categoria,
        descrizione,
        natura,
        imponibile: valore,
        aliquotaIva,
        percentualeDeducibilita: analizzaPercentuale(deducibilita) ?? 1,
        percentualeDetraibilitaIva: 1,
        dataPagamento: pagatoOggi ? dataDocumento : null,
      });
      onChiudi();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aperto} onOpenChange={(v) => !v && onChiudi()}>
      <DialogContent
        titolo="Nuovo costo"
        descrizione={
          forfettario
            ? "In forfettario il costo non si deduce, ma serve a leggere il margine reale."
            : "Deducibilità e IVA detraibile si applicano al singolo documento."
        }
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void salva();
          }}
        >
          <Campo etichetta="Data del documento" htmlFor="c-data">
            <Input id="c-data" type="date" value={dataDocumento}
              onChange={(e) => setDataDocumento(e.target.value)} />
          </Campo>
          <Campo etichetta="Fornitore" htmlFor="c-fornitore">
            <Input id="c-fornitore" value={fornitore} onChange={(e) => setFornitore(e.target.value)}
              placeholder="Chi ti ha emesso il documento" />
          </Campo>

          <Campo etichetta="Categoria" htmlFor="c-categoria">
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger id="c-categoria"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categorie.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo etichetta="Natura" htmlFor="c-natura" aiuto="I costi fissi entrano nel punto di pareggio">
            <Select value={natura} onValueChange={(v) => setNatura(v as Costo["natura"])}>
              <SelectTrigger id="c-natura"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fisso">Fisso</SelectItem>
                <SelectItem value="variabile">Variabile</SelectItem>
              </SelectContent>
            </Select>
          </Campo>

          <Campo etichetta="Descrizione" htmlFor="c-descrizione" className="sm:col-span-2">
            <Input id="c-descrizione" value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)} placeholder="Che cosa hai comprato" />
          </Campo>

          <Campo etichetta="Imponibile" htmlFor="c-imponibile">
            <Input id="c-imponibile" numerico inputMode="decimal" value={imponibile}
              onChange={(e) => setImponibile(e.target.value)} placeholder="0,00" />
          </Campo>
          <Campo etichetta="Aliquota IVA" htmlFor="c-iva" aiuto="In percentuale: 22, 10, 4 oppure 0">
            <Input id="c-iva" numerico inputMode="decimal" value={aliquota}
              onChange={(e) => setAliquota(e.target.value)} />
          </Campo>

          <Campo
            etichetta="Percentuale di deducibilità"
            htmlFor="c-ded"
            aiuto="100 di norma, 75 per i ristoranti, 20 per l'auto"
          >
            <Input id="c-ded" numerico inputMode="decimal" value={deducibilita}
              onChange={(e) => setDeducibilita(e.target.value)} disabled={forfettario} />
          </Campo>
          <label className="flex items-end gap-2 pb-2 text-etichetta">
            <input type="checkbox" checked={pagatoOggi}
              onChange={(e) => setPagatoOggi(e.target.checked)}
              className="size-4 rounded-[4px] accent-[#4C5BF5]" />
            Già pagato alla data del documento
          </label>

          <div className="rounded-interna bg-superficie-alt p-3 sm:col-span-2">
            <dl className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <dt className="text-micro text-inchiostro-tenue">Imponibile</dt>
                <dd className="cifre text-corpo">{euro(valore)}</dd>
              </div>
              <div>
                <dt className="text-micro text-inchiostro-tenue">IVA</dt>
                <dd className="cifre text-corpo">{euro(iva)}</dd>
              </div>
              <div className="text-right">
                <dt className="text-micro text-inchiostro-tenue">Uscita di cassa</dt>
                <dd className="cifre text-kpi-sm font-semibold">{euro(valore + iva)}</dd>
              </div>
            </dl>
          </div>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variante="quieto" onClick={onChiudi}>Annulla</Button>
            <Button scrive type="submit" disabled={!valido || salvando}>Salva il costo</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
