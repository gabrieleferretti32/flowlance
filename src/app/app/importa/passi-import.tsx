"use client";

import * as React from "react";
import { CircleAlert, TriangleAlert } from "lucide-react";
import { Card, CardCorpo, CardIntestazione, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Segmenti } from "@/components/ui/segmenti";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Etichetta } from "@/components/ui/etichetta";
import { euro, data as fmtData, percentuale } from "@/lib/format";
import { campiDi, type Destinazione, type Mappatura } from "@/lib/csv/campi";
import type { Lettura, SuiDuplicati } from "@/lib/csv/importa";
import { cn } from "@/lib/utils";

/** Passo 2: a quale campo corrisponde ogni colonna. */
export function Mappa({
  destinazione,
  intestazioni,
  esempio,
  mappatura,
  onCambia,
}: {
  destinazione: Destinazione;
  intestazioni: string[];
  /** La prima riga di dati, per far vedere cosa c'è dentro la colonna. */
  esempio: string[];
  mappatura: Mappatura;
  onCambia: (chiave: string, colonna: number | null) => void;
}) {
  const campi = campiDi(destinazione);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {campi.map((campo) => {
        const colonna = mappatura[campo.chiave] ?? null;
        const mancante = campo.obbligatorio && colonna === null;
        return (
          <div
            key={campo.chiave}
            className={cn(
              "rounded-campo border p-3",
              mancante ? "border-negativo/40 bg-negativo-tenue/40" : "border-bordo",
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <Etichetta>{campo.etichetta}</Etichetta>
              {campo.obbligatorio ? (
                <span className="text-micro text-inchiostro-tenue">obbligatorio</span>
              ) : null}
            </div>
            <Select
              value={colonna === null ? "-" : String(colonna)}
              onValueChange={(v) => onCambia(campo.chiave, v === "-" ? null : Number(v))}
            >
              <SelectTrigger className="mt-1.5" aria-label={`Colonna per ${campo.etichetta}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-">— non presente nel file</SelectItem>
                {intestazioni.map((h, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Il valore predefinito è dichiarato, non scoperto dopo. */}
            <p className="mt-1.5 text-micro text-inchiostro-tenue">
              {colonna === null
                ? campo.obbligatorio
                  ? "Senza questa colonna le righe non si possono leggere."
                  : `Se manca: ${campo.predefinito}`
                : `Esempio dal file: ${esempio[colonna]?.trim() || "(vuoto)"}`}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/** Le voci della colonna «natura» da mandare fra le spese personali. */
export function ScelteNature({
  valori,
  personali,
  onCambia,
}: {
  valori: string[];
  personali: Set<string>;
  onCambia: (valore: string) => void;
}) {
  if (valori.length === 0) return null;
  return (
    <Card>
      <CardIntestazione>
        <CardTitolo>Quali sono spese personali</CardTitolo>
        <CardSottotitolo>
          Le voci spuntate non entrano fra i costi dell&apos;attività: confluiscono nel mese, fra le
          spese personali. Le altre restano costi.
        </CardSottotitolo>
      </CardIntestazione>
      <CardCorpo className="pt-0">
        <div className="flex flex-wrap gap-2">
          {valori.map((v) => {
            const attivo = personali.has(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => onCambia(v)}
                aria-pressed={attivo}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-etichetta transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accento",
                  attivo
                    ? "border-accento bg-accento-tenue font-medium text-accento"
                    : "border-bordo text-inchiostro-tenue hover:border-inchiostro-tenue/40",
                )}
              >
                {v}
              </button>
            );
          })}
        </div>
      </CardCorpo>
    </Card>
  );
}

/**
 * Fatture e note lette, mescolate nell'ordine in cui stanno nel file.
 *
 * L'anteprima di un'esportazione mista deve rispondere a «dove è finita questa
 * riga», e per rispondere le due liste vanno rimesse nell'ordine in cui sono
 * arrivate: separarle mostrerebbe due elenchi che non somigliano al file.
 */
function documentiLetti(lettura: Lettura) {
  return [
    ...lettura.fatture.map((f) => ({
      tipo: "fattura" as const,
      riga: f.riga,
      data: f.fattura.dataEmissione,
      numero: f.fattura.numero,
      cliente: f.nomeCliente,
      imponibile: f.fattura.imponibile,
      aliquota: f.fattura.aliquotaIva ?? 0,
      incassato: f.fattura.importoIncassato,
    })),
    ...lettura.note.map((n) => ({
      tipo: "nota" as const,
      riga: n.riga,
      data: n.nota.dataDocumento,
      numero: n.nota.numero,
      cliente: n.nomeCliente,
      imponibile: n.nota.imponibile,
      aliquota: n.nota.aliquotaIva ?? 0,
      incassato: undefined as number | undefined,
    })),
  ].sort((a, b) => a.riga - b.riga);
}

/** Passo 3: le prime righe già interpretate, con importi e date formattati. */
export function Anteprima({
  lettura,
  destinazione,
  suiDuplicati,
  onDuplicati,
  quante = 8,
}: {
  lettura: Lettura;
  destinazione: Destinazione;
  suiDuplicati: SuiDuplicati;
  onDuplicati: (v: SuiDuplicati) => void;
  quante?: number;
}) {
  /*
    Se anche una sola riga porta l'importo incassato, la colonna si mostra su
    tutte: una colonna che appare e scompare a seconda della riga è peggio di
    una colonna in più, e il «tutto» delle altre righe è proprio l'informazione
    che serve leggere.
  */
  const mostraIncassato =
    destinazione !== "costo"
    && (lettura.fatture.some((f) => f.fattura.importoIncassato !== undefined)
      || lettura.incassiSenzaData.length > 0);
  const senzaData = new Set(lettura.incassiSenzaData.map((r) => r.riga));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {/*
          Il conteggio della destinazione scelta si vede sempre, anche a zero:
          «0 fatture» dice che la mappatura è da correggere, e nasconderlo
          lascerebbe credere che il file fosse vuoto. Gli altri compaiono quando
          ci sono, perché in un file misto sono la notizia.
        */}
        {(destinazione !== "costo" || lettura.fatture.length > 0) && (
          <Chip tono="neutro">{lettura.fatture.length} fatture</Chip>
        )}
        {(destinazione === "nota" || lettura.note.length > 0) && (
          <Chip tono="accento">{lettura.note.length} note di credito</Chip>
        )}
        {(destinazione === "costo" || lettura.costi.length > 0) && (
          <Chip tono="neutro">{lettura.costi.length} costi</Chip>
        )}
        {lettura.personali.length > 0 && (
          <Chip tono="neutro">{lettura.personali.length} spese personali</Chip>
        )}
        {lettura.clientiDaCreare.length > 0 && (
          <Chip tono="neutro">{lettura.clientiDaCreare.length} clienti nuovi</Chip>
        )}
        {lettura.duplicati.length > 0 && (
          <Chip tono="attenzione">{lettura.duplicati.length} già presenti</Chip>
        )}
        {lettura.incassiSenzaData.length > 0 && (
          <Chip tono="attenzione">
            {lettura.incassiSenzaData.length} con l&apos;incassato ma senza data
          </Chip>
        )}
        {lettura.scartate.length > 0 && (
          <Chip tono="negativo">{lettura.scartate.length} righe non leggibili</Chip>
        )}
      </div>

      {/*
        Non è un errore e non ferma niente: quelle fatture entrano, senza
        l'importo. Ma se sono tante è la colonna della data a essere mappata
        male, e questa riga è l'unico momento in cui qualcuno può accorgersene —
        dopo, quei numeri sono semplicemente assenti, e l'assenza non si nota.
      */}
      {lettura.incassiSenzaData.length > 0 && (
        <Card>
          <CardIntestazione>
            <CardTitolo>
              {lettura.incassiSenzaData.length}{" "}
              {lettura.incassiSenzaData.length === 1 ? "riga dice" : "righe dicono"} quanto è stato
              incassato, ma non quando
            </CardTitolo>
            <CardSottotitolo>
              Entrano lo stesso, senza l&apos;importo: la cassa parte dalla data, e senza quella il
              numero non finirebbe in nessun conto. Se sono tante, è la colonna della data di
              incasso a essere associata male.
            </CardSottotitolo>
          </CardIntestazione>
          <CardCorpo className="pt-0">
            <ul className="space-y-1 text-etichetta text-inchiostro-tenue">
              {lettura.incassiSenzaData.slice(0, 10).map((r) => (
                <li key={r.riga}>
                  <span className="cifre">riga {r.riga}</span> · {r.descrizione}
                </li>
              ))}
              {lettura.incassiSenzaData.length > 10 && (
                <li>e altre {lettura.incassiSenzaData.length - 10}.</li>
              )}
            </ul>
          </CardCorpo>
        </Card>
      )}

      <Card>
        <CardIntestazione>
          <CardTitolo>Come vengono lette le prime righe</CardTitolo>
          <CardSottotitolo>
            Importi e date già nel formato dell&apos;app: se qui qualcosa non torna, la mappatura è
            da correggere.
          </CardSottotitolo>
        </CardIntestazione>
        <CardCorpo className="overflow-x-auto pt-0" data-scroll-ok>
          <table className="w-full min-w-[34rem] border-collapse text-etichetta">
            <thead>
              <tr className="border-b border-bordo text-left text-micro text-inchiostro-tenue">
                <th className="py-1.5 pr-3 font-normal">Riga</th>
                <th className="py-1.5 pr-3 font-normal">Data</th>
                <th className="py-1.5 pr-3 font-normal">
                  {destinazione === "costo" ? "Fornitore" : "Numero"}
                </th>
                <th className="py-1.5 pr-3 font-normal">
                  {destinazione === "costo" ? "Categoria" : "Cliente"}
                </th>
                {destinazione !== "costo" && (
                  <th className="py-1.5 pr-3 font-normal">Documento</th>
                )}
                <th className="py-1.5 pr-3 text-right font-normal">Imponibile</th>
                <th className="py-1.5 text-right font-normal">IVA</th>
                {/*
                  La colonna compare solo se qualcuno l'ha associata. Questa
                  tabella dice «come vengono lette le prime righe», e una
                  colonna mappata che non si vede qui è un valore che entra in
                  archivio senza essere mai passato sotto gli occhi di nessuno.
                */}
                {mostraIncassato && (
                  <th className="py-1.5 pl-3 text-right font-normal">Incassato</th>
                )}
              </tr>
            </thead>
            <tbody>
              {destinazione === "costo"
                ? lettura.costi.slice(0, quante).map((c) => (
                    <tr key={c.riga} className="border-b border-bordo/60">
                      <td className="cifre py-1.5 pr-3 text-inchiostro-tenue">{c.riga}</td>
                      <td className="cifre py-1.5 pr-3">{fmtData(c.costo.dataDocumento)}</td>
                      <td className="py-1.5 pr-3">{c.costo.fornitore}</td>
                      <td className="py-1.5 pr-3">{c.costo.categoria}</td>
                      <td className="cifre py-1.5 pr-3 text-right tabular-nums">
                        {euro(c.costo.imponibile)}
                      </td>
                      <td className="cifre py-1.5 text-right tabular-nums">
                        {percentuale(c.costo.aliquotaIva, 0)}
                      </td>
                    </tr>
                  ))
                : /*
                    Fatture e note nella stessa anteprima, nell'ordine del file:
                    su un'esportazione mista la domanda non è «come è stata
                    letta questa riga» ma «dove è finita», e due tabelle
                    separate la lascerebbero senza risposta.
                  */
                  documentiLetti(lettura)
                    .slice(0, quante)
                    .map((d) => (
                      <tr key={`${d.tipo}-${d.riga}`} className="border-b border-bordo/60">
                        <td className="cifre py-1.5 pr-3 text-inchiostro-tenue">{d.riga}</td>
                        <td className="cifre py-1.5 pr-3">{fmtData(d.data)}</td>
                        <td className="py-1.5 pr-3">{d.numero}</td>
                        <td className="py-1.5 pr-3">{d.cliente}</td>
                        <td className="py-1.5 pr-3">
                          {d.tipo === "nota" ? (
                            <Chip tono="accento">Nota di credito</Chip>
                          ) : (
                            <span className="text-inchiostro-tenue">Fattura</span>
                          )}
                        </td>
                        <td className="cifre py-1.5 pr-3 text-right tabular-nums">
                          {euro(d.imponibile)}
                        </td>
                        <td className="cifre py-1.5 text-right tabular-nums">
                          {percentuale(d.aliquota, 0)}
                        </td>
                        {mostraIncassato && (
                          <td className="cifre py-1.5 pl-3 text-right tabular-nums">
                            {/*
                              Le righe che portano l'importo ma non la data
                              devono dirlo **qui**, non solo nella scheda sopra:
                              scritto «tutto» accanto a una riga che nel file ha
                              un incasso parziale, il numero sembrerebbe letto e
                              scartato senza ragione.
                            */}
                            {senzaData.has(d.riga) ? (
                              <span className="text-[#B8791A]">senza data</span>
                            ) : d.incassato === undefined ? (
                              <span className="text-inchiostro-tenue">tutto</span>
                            ) : (
                              euro(d.incassato)
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
            </tbody>
          </table>
        </CardCorpo>
      </Card>

      {lettura.duplicati.length > 0 && (
        <Card className="border border-attenzione/25 bg-attenzione-tenue/40">
          <CardCorpo>
            <p className="flex items-start gap-2 text-corpo">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-attenzione" aria-hidden />
              <span>
                <span className="font-medium">
                  {lettura.duplicati.length} righe coincidono con qualcosa già in archivio.
                </span>{" "}
                <span className="text-inchiostro-tenue">
                  {lettura.duplicati
                    .slice(0, 4)
                    .map((d) => d.descrizione)
                    .join(", ")}
                  {lettura.duplicati.length > 4 ? " e altre" : ""}.
                </span>
              </span>
            </p>
            <div className="mt-3">
              <Segmenti
                etichettaGruppo="Cosa fare con i duplicati"
                valore={suiDuplicati}
                onChange={onDuplicati}
                opzioni={[
                  { valore: "importa", etichetta: "Importa comunque" },
                  { valore: "salta", etichetta: "Salta" },
                  { valore: "sostituisci", etichetta: "Sostituisci" },
                ]}
              />
            </div>
          </CardCorpo>
        </Card>
      )}

      {lettura.scartate.length > 0 && <Scartate scartate={lettura.scartate} />}
    </div>
  );
}

export function Scartate({ scartate }: { scartate: Lettura["scartate"] }) {
  return (
    <Card className="border border-negativo/25">
      <CardIntestazione>
        <CardTitolo>Righe non importate</CardTitolo>
        <CardSottotitolo>
          Il resto viene importato lo stesso. Il numero è quello che si legge nel foglio.
        </CardSottotitolo>
      </CardIntestazione>
      <CardCorpo className="pt-0">
        <ul className="divide-y divide-bordo">
          {scartate.slice(0, 30).map((s) => (
            <li key={s.riga} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-2">
              <CircleAlert className="size-3.5 shrink-0 self-center text-negativo" aria-hidden />
              <span className="cifre text-etichetta font-medium">Riga {s.riga}</span>
              <span className="text-etichetta">{s.motivo}</span>
              {s.anteprima && (
                <span className="w-full text-micro text-inchiostro-tenue sm:w-auto">
                  {s.anteprima}
                </span>
              )}
            </li>
          ))}
        </ul>
        {scartate.length > 30 && (
          <p className="mt-2 text-micro text-inchiostro-tenue">
            e altre {scartate.length - 30}.
          </p>
        )}
      </CardCorpo>
    </Card>
  );
}
