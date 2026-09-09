"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Stato } from "@/components/ui/stato";
import { analizzaNumero, euro, perCampo, data as fmtData } from "@/lib/format";
import { round2 } from "@/lib/fisco/aritmetica";
import { stornoPerFattura } from "@/lib/fisco/note";
import type { NotaCredito } from "@/lib/dati/tipi";
import type { FatturaCalcolata } from "@/lib/fisco/tipi";
import { cn } from "@/lib/utils";

/**
 * Spalmare una nota su più fatture.
 *
 * Serve perché uno storno può coprire due mesi di retainer: se l'app non lo
 * permettesse, si finirebbe per inserire due note finte pur di farle stare —
 * cioè per sporcare i dati aggirando il vincolo.
 *
 * Ogni riga mostra quanto resta della fattura tenuto conto delle *altre* note,
 * così non si aggancia più di quanto ci sia da stornare. Il residuo in testa si
 * ricalcola a ogni cifra digitata: da nessuna parte è salvato.
 */
export function DialogoRiconciliazione({
  nota,
  fatture,
  altreNote,
  onChiudi,
  onSalva,
}: {
  nota: NotaCredito | null;
  fatture: FatturaCalcolata[];
  /** Tutte le note tranne questa: servono a sapere quanto è già stornato altrove. */
  altreNote: NotaCredito[];
  onChiudi: () => void;
  onSalva: (righe: { fatturaId: string; imponibile: number }[]) => void | Promise<void>;
}) {
  const [importi, setImporti] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!nota) return;
    setImporti(
      Object.fromEntries(
        (nota.riconciliazioni ?? []).map((r) => [r.fatturaId, perCampo(Math.abs(r.imponibile))]),
      ),
    );
  }, [nota]);

  if (!nota) return null;

  const delCliente = fatture
    .filter((f) => f.clienteId === nota.clienteId)
    .sort((a, b) => b.dataEmissione.localeCompare(a.dataEmissione));
  const stornoAltrove = stornoPerFattura(altreNote, delCliente);

  const righe = Object.entries(importi)
    .map(([fatturaId, testo]) => ({ fatturaId, imponibile: analizzaNumero(testo) ?? 0 }))
    .filter((r) => r.imponibile > 0);
  const agganciato = round2(righe.reduce((a, r) => a + r.imponibile, 0));
  const residuo = round2(nota.imponibile - agganciato);
  const eccede = residuo < -0.005;

  return (
    <Dialog open onOpenChange={(v) => !v && onChiudi()}>
      <DialogContent
        titolo={`Riconcilia la nota ${nota.numero || "senza numero"}`}
        descrizione={`${euro(nota.imponibile)} di storno da distribuire sulle fatture del cliente.`}
        className="w-[min(40rem,calc(100vw-2rem))]"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Stato tono={eccede ? "negativo" : residuo > 0 ? "attenzione" : "positivo"}>
            {eccede
              ? `${euro(-residuo)} oltre l'importo della nota`
              : residuo > 0
                ? `${euro(residuo)} ancora da riconciliare`
                : "Riconciliata del tutto"}
          </Stato>
          <span className="text-etichetta text-inchiostro-tenue">
            Una nota non riconciliata resta valida: riduce comunque ricavi e IVA.
          </span>
        </div>

        {delCliente.length === 0 ? (
          <p className="py-6 text-center text-etichetta text-inchiostro-tenue">
            Questo cliente non ha fatture in archivio.
          </p>
        ) : (
          <ul className="max-h-[45vh] divide-y divide-bordo overflow-y-auto">
            {delCliente.map((f) => {
              const giaStornata = stornoAltrove.get(f.id)?.stornato ?? 0;
              const disponibile = round2(Math.max(0, f.imponibile - giaStornata));
              const messo = analizzaNumero(importi[f.id] ?? "") ?? 0;
              const troppo = messo > disponibile + 0.005;
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="min-w-40 flex-1">
                    <span className="block text-corpo">
                      <span className="cifre">{f.numero}</span> · {euro(f.imponibile)}
                    </span>
                    <span className="text-micro text-inchiostro-tenue">
                      {fmtData(f.dataEmissione)}
                      {giaStornata > 0 && ` · ${euro(giaStornata)} già stornati da altre note`}
                      {` · ${euro(disponibile)} stornabili`}
                    </span>
                  </span>
                  <span className="w-32 shrink-0">
                    <Input
                      numerico
                      inputMode="decimal"
                      aria-label={`Importo da stornare sulla fattura ${f.numero}`}
                      aria-invalid={troppo || undefined}
                      value={importi[f.id] ?? ""}
                      onChange={(e) => setImporti((m) => ({ ...m, [f.id]: e.target.value }))}
                      placeholder="0,00"
                      className={cn(troppo && "border-negativo ring-2 ring-negativo/20")}
                    />
                  </span>
                  <Button
                    variante="quieto"
                    taglia="sm"
                    onClick={() =>
                      setImporti((m) => ({
                        ...m,
                        // Il minore fra quanto resta della nota e quanto resta
                        // della fattura: il gesto più frequente, un clic.
                        [f.id]: perCampo(Math.max(0, Math.min(disponibile, round2(residuo + messo)))),
                      }))
                    }
                  >
                    Tutto il possibile
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variante="quieto" onClick={onChiudi}>
            Annulla
          </Button>
          <Button
            scrive
            disabled={eccede}
            onClick={() => {
              void Promise.resolve(onSalva(righe)).then(onChiudi);
            }}
          >
            Salva la riconciliazione
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
