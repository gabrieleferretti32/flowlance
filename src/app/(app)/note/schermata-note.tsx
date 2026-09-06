"use client";

import * as React from "react";
import { FileMinus2, Link2, Link2Off, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { Guscio } from "@/components/guscio/guscio";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Stato } from "@/components/ui/stato";
import { Vuoto } from "@/components/ui/vuoto";
import {
  ContenitoreTabella,
  Tabella,
  TabellaCella,
  TabellaCorpo,
  TabellaIntestazione,
  TabellaPiede,
  TabellaRiga,
  TabellaTesta,
} from "@/components/ui/tabella";
import { ElencoSchede, Scheda, SchedaTesta, SchedaTotale, SchedaVoci } from "@/components/tabella/schede";
import { CellaModificabile } from "@/components/tabella/cella-modificabile";
import { BottoneImport } from "@/components/tabella/bottone-import";
import {
  annullaRimborso,
  creaNota,
  eliminaNota,
  salvaNota,
  segnaRimborsata,
} from "@/lib/dati/azioni";
import { useCalcoloAnno, useDati } from "@/lib/dati/hooks";
import { controlliNote, notaGrezza } from "@/lib/fisco/note";
import { dentroPeriodo, etichettaPeriodo } from "@/lib/periodo";
import { usePreferenze } from "@/lib/stato/preferenze";
import { useRichiesta } from "@/lib/stato/comandi";
import { euro, data as fmtData } from "@/lib/format";
import type { NotaCredito } from "@/lib/dati/tipi";
import { ModuloNota } from "./modulo-nota";
import { DialogoRiconciliazione } from "./riconciliazione";

/**
 * Il registro delle note di credito.
 *
 * Separato dalle fatture perché è un documento diverso: numerazione propria,
 * effetto opposto, e una colonna che le fatture non hanno — a cosa si
 * riferisce. Il residuo si legge qui e sulla fattura, e da nessuna delle due
 * parti è salvato.
 */
export function SchermataNote() {
  const periodo = usePreferenze((s) => s.periodo);
  const oggi = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dati = useDati();
  const calcolo = useCalcoloAnno(periodo.anno, oggi);
  const [moduloAperto, setModuloAperto] = React.useState(false);
  const [inModifica, setInModifica] = React.useState<NotaCredito | null>(null);

  // Quello che chiede la palette. La voce mancava: il vocabolario è stato
  // scritto quando le note di credito non esistevano ancora.
  useRichiesta("nuovaNota", () => {
    setInModifica(null);
    setModuloAperto(true);
  });
  const [daRiconciliare, setDaRiconciliare] = React.useState<NotaCredito | null>(null);

  const clienti = React.useMemo(() => dati?.clienti ?? [], [dati]);
  const nomeCliente = React.useCallback(
    (id: string) => clienti.find((c) => c.id === id)?.nome ?? "Senza cliente",
    [clienti],
  );

  const note = React.useMemo(
    () => (calcolo?.prospetto.noteCalcolate ?? []).filter((n) => dentroPeriodo(n.dataDocumento, periodo)),
    [calcolo, periodo],
  );
  const fatture = React.useMemo(
    () => calcolo?.prospetto.fattureCalcolate ?? [],
    [calcolo],
  );
  const avvisi = React.useMemo(
    () => controlliNote(dati?.note ?? [], fatture),
    [dati, fatture],
  );
  const avvisiDi = (id: string) => avvisi.filter((a) => a.notaId === id);

  const totale = note.reduce((a, n) => a + n.imponibile, 0);
  const daRimborsare = note.filter((n) => !n.dataRimborso).reduce((a, n) => a + n.imponibile, 0);
  const nonRiconciliato = note.reduce((a, n) => a + n.residuo, 0);

  if (!dati || !calcolo) {
    return (
      <Guscio titolo="Note di credito">
        <Card>
          <CaricamentoTabella righe={5} />
        </Card>
      </Guscio>
    );
  }

  const aggiorna = (n: NotaCredito, modifiche: Partial<NotaCredito>) =>
    void salvaNota({ ...notaGrezza(n), ...modifiche });

  return (
    <Guscio
      titolo="Note di credito"
      descrizione={`Storni sulle fatture emesse · ${etichettaPeriodo(periodo)}`}
      azioni={
        <span className="flex flex-wrap items-center gap-2">
          <BottoneImport destinazione="nota" etichetta="Da CSV" />
          <Button scrive onClick={() => { setInModifica(null); setModuloAperto(true); }}>
            <FileMinus2 className="size-4" aria-hidden />
            Nuova nota
          </Button>
        </span>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Chip tono="neutro" className="cifre">
          {note.length} note · {euro(totale)}
        </Chip>
        {daRimborsare > 0 && (
          <Chip tono="attenzione" className="cifre">
            {euro(daRimborsare)} non ancora rimborsati
          </Chip>
        )}
        {nonRiconciliato > 0 && (
          <Chip tono="accento" className="cifre">
            {euro(nonRiconciliato)} senza fattura
          </Chip>
        )}
      </div>

      <Card>
        {note.length === 0 ? (
          <Vuoto
            icona={FileMinus2}
            titolo="Nessuna nota di credito. Se ne hai emesse, registrale: senza, il fatturato e l'IVA a debito restano più alti del reale."
            azione={
              <div className="flex flex-wrap justify-center gap-2">
                <Button scrive onClick={() => { setInModifica(null); setModuloAperto(true); }}>
                  Nuova nota
                </Button>
                <BottoneImport destinazione="nota" />
              </div>
            }
          />
        ) : (
          <>
            <ContenitoreTabella data-scroll-ok classeGuscio="hidden md:block">
              <Tabella>
                <TabellaTesta>
                  <tr>
                    <TabellaIntestazione>Data</TabellaIntestazione>
                    <TabellaIntestazione>Numero</TabellaIntestazione>
                    <TabellaIntestazione className="min-w-40">Cliente</TabellaIntestazione>
                    <TabellaIntestazione className="min-w-48">Descrizione</TabellaIntestazione>
                    <TabellaIntestazione numerica>Storno</TabellaIntestazione>
                    <TabellaIntestazione numerica>IVA</TabellaIntestazione>
                    <TabellaIntestazione className="min-w-52">Riferita a</TabellaIntestazione>
                    <TabellaIntestazione>Rimborso</TabellaIntestazione>
                    <TabellaIntestazione ancorata className="w-20">
                      <span className="sr-only">Azioni</span>
                    </TabellaIntestazione>
                  </tr>
                </TabellaTesta>
                <TabellaCorpo>
                  {note.map((n) => {
                    const problemi = avvisiDi(n.id);
                    return (
                      <TabellaRiga key={n.id}>
                        <TabellaCella className="p-1">
                          <CellaModificabile
                            tipo="data"
                            etichetta={`Data della nota ${n.numero}`}
                            valore={n.dataDocumento}
                            onSalva={(v) => { if (v) aggiorna(n, { dataDocumento: String(v) }); }}
                          />
                        </TabellaCella>
                        <TabellaCella className="p-1">
                          <CellaModificabile
                            tipo="testo"
                            etichetta={`Numero della nota ${n.numero}`}
                            valore={n.numero}
                            onSalva={(v) => aggiorna(n, { numero: String(v ?? "") })}
                          />
                        </TabellaCella>
                        <TabellaCella>{nomeCliente(n.clienteId)}</TabellaCella>
                        <TabellaCella className="p-1">
                          <CellaModificabile
                            tipo="testo"
                            etichetta={`Descrizione della nota ${n.numero}`}
                            valore={n.descrizione}
                            vuoto="Aggiungi una descrizione"
                            onSalva={(v) => aggiorna(n, { descrizione: String(v ?? "") })}
                          />
                        </TabellaCella>
                        <TabellaCella numerica className="p-1">
                          <CellaModificabile
                            tipo="valuta"
                            etichetta={`Storno della nota ${n.numero}`}
                            valore={n.imponibile}
                            onSalva={(v) => aggiorna(n, { imponibile: Math.abs(Number(v)) })}
                          />
                        </TabellaCella>
                        <TabellaCella numerica className="text-inchiostro-tenue">
                          {n.iva > 0 ? euro(n.iva) : "—"}
                        </TabellaCella>
                        <TabellaCella>
                          <Riferimenti
                            nota={n}
                            fatture={fatture}
                            problemi={problemi.map((a) => a.messaggio)}
                            onRiconcilia={() => setDaRiconciliare(notaGrezza(n))}
                          />
                        </TabellaCella>
                        <TabellaCella className="p-1">
                          <CellaModificabile
                            tipo="data"
                            etichetta={`Data di rimborso della nota ${n.numero}`}
                            valore={n.dataRimborso ?? null}
                            vuoto="Non rimborsata"
                            onSalva={(v) => aggiorna(n, { dataRimborso: v ? String(v) : null })}
                          />
                        </TabellaCella>
                        <TabellaCella ancorata>
                          <div className="flex items-center justify-end gap-1">
                            {n.dataRimborso ? (
                              <Button
                                scrive
                                variante="quieto"
                                taglia="icona"
                                aria-label={`Annulla il rimborso della nota ${n.numero}`}
                                onClick={() => void annullaRimborso(notaGrezza(n))}
                              >
                                <Undo2 className="size-4" />
                              </Button>
                            ) : (
                              <Button
                                scrive
                                variante="quieto"
                                taglia="icona"
                                aria-label={`Segna la nota ${n.numero} come rimborsata oggi`}
                                onClick={() => void segnaRimborsata(notaGrezza(n))}
                              >
                                <RotateCcw className="size-4" />
                              </Button>
                            )}
                            <Button
                              scrive
                              variante="quieto"
                              taglia="icona"
                              aria-label={`Elimina la nota ${n.numero}`}
                              onClick={() => void eliminaNota(notaGrezza(n))}
                              className="hover:bg-negativo-tenue hover:text-negativo"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TabellaCella>
                      </TabellaRiga>
                    );
                  })}
                </TabellaCorpo>
                <TabellaPiede>
                  <tr>
                    <TabellaCella colSpan={4}>Totale · {note.length} note</TabellaCella>
                    <TabellaCella numerica className="font-semibold">{euro(totale)}</TabellaCella>
                    <TabellaCella colSpan={4} />
                  </tr>
                </TabellaPiede>
              </Tabella>
            </ContenitoreTabella>

            <ElencoSchede>
              {note.map((n) => (
                <Scheda key={n.id}>
                  <SchedaTesta
                    sopra={fmtData(n.dataDocumento)}
                    titolo={`${n.numero || "Senza numero"} · ${nomeCliente(n.clienteId)}`}
                    sotto={n.descrizione}
                    valore={`− ${euro(n.imponibile)}`}
                    notaValore={n.iva > 0 ? `IVA ${euro(n.iva)}` : undefined}
                  />
                  <SchedaVoci
                    voci={[
                      {
                        etichetta: "Rimborso",
                        valore: n.dataRimborso ? fmtData(n.dataRimborso) : "non ancora",
                      },
                      {
                        etichetta: "Riconciliata",
                        valore: n.residuo === 0 ? "del tutto" : `${euro(n.residuo)} senza fattura`,
                      },
                    ]}
                  />
                  {/*
                    Un residuo senza fattura è un problema che la scheda sa
                    mostrare e non sa risolvere: riconciliare è lavoro, non
                    consultazione, e l'aggancio sta nella tabella, da 768 in su.
                    Dire dove si rimedia costa una riga; non dirlo lascia in mano
                    un numero rosso e nessuna via d'uscita.
                  */}
                  {n.residuo > 0 && (
                    <p className="mt-2 text-micro text-inchiostro-tenue">
                      La riconciliazione — decidere su quali fatture cade lo storno — si fa da
                      computer.
                    </p>
                  )}
                  {!n.dataRimborso ? (
                    <Button
                      scrive
                      variante="contorno"
                      taglia="sm"
                      className="mt-3 w-full"
                      onClick={() => void segnaRimborsata(notaGrezza(n))}
                    >
                      Segna come rimborsata oggi
                    </Button>
                  ) : (
                    <Button
                      scrive
                      variante="quieto"
                      taglia="sm"
                      className="mt-3 w-full"
                      onClick={() => void annullaRimborso(notaGrezza(n))}
                    >
                      <Undo2 className="size-4" aria-hidden />
                      Annulla il rimborso
                    </Button>
                  )}
                </Scheda>
              ))}
              <SchedaTotale valore={euro(totale)} nota={`${note.length} note`} />
            </ElencoSchede>
          </>
        )}
      </Card>

      <DialogoRiconciliazione
        nota={daRiconciliare}
        fatture={fatture}
        altreNote={(dati.note ?? []).filter((x) => x.id !== daRiconciliare?.id)}
        onChiudi={() => setDaRiconciliare(null)}
        onSalva={async (righe) => {
          if (!daRiconciliare) return;
          await salvaNota({ ...daRiconciliare, riconciliazioni: righe }, "Riconciliazione aggiornata");
        }}
      />

      <ModuloNota
        aperto={moduloAperto}
        nota={inModifica ?? undefined}
        clienti={clienti}
        fatture={fatture}
        onChiudi={() => setModuloAperto(false)}
        onSalva={async (n) => {
          if (inModifica) await salvaNota({ ...n, id: inModifica.id });
          else await creaNota(n);
        }}
      />
    </Guscio>
  );
}

/**
 * A cosa si riferisce la nota, e cosa resta.
 *
 * Le fatture agganciate con l'importo, più il residuo quando c'è. Il numero
 * non è salvato da nessuna parte: `stornoPerFattura` lo ricava ogni volta.
 */
function Riferimenti({
  nota,
  fatture,
  problemi,
  onRiconcilia,
}: {
  nota: { id: string; residuo: number; riconciliazioni?: { fatturaId: string; imponibile: number }[] };
  fatture: { id: string; numero: string; imponibile: number; clienteId: string }[];
  problemi: string[];
  onRiconcilia: () => void;
}) {
  const agganci = nota.riconciliazioni ?? [];
  const numeroDi = (id: string) => fatture.find((f) => f.id === id)?.numero;

  return (
    <div className="space-y-1">
      {agganci.length === 0 ? (
        <span className="flex items-center gap-1.5 text-etichetta text-inchiostro-tenue">
          <Link2Off className="size-3.5 shrink-0" aria-hidden />
          Nessuna fattura
        </span>
      ) : (
        agganci.map((r) => (
          <span key={r.fatturaId} className="flex items-center gap-1.5 text-etichetta">
            <Link2 className="size-3.5 shrink-0 text-inchiostro-tenue" aria-hidden />
            <span className="cifre">{numeroDi(r.fatturaId) ?? "fattura sparita"}</span>
            <span className="cifre text-inchiostro-tenue">{euro(r.imponibile)}</span>
          </span>
        ))
      )}
      {nota.residuo > 0 && (
        <Stato tono="attenzione">{euro(nota.residuo)} da riconciliare</Stato>
      )}
      <Button scrive variante="quieto" taglia="sm" className="-ml-2 h-7" onClick={onRiconcilia}>
        {agganci.length > 0 ? "Modifica gli agganci" : "Riconcilia"}
      </Button>
      {problemi
        .filter((m) => m.includes("non esiste più") || m.includes("superano"))
        .map((m) => (
          <span key={m} className="block text-micro text-negativo">
            {m}
          </span>
        ))}
    </div>
  );
}
