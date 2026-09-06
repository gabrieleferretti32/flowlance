"use client";

import * as React from "react";
import { CheckCheck, FilePlus2, FileText, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottoneImport } from "@/components/tabella/bottone-import";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Stato } from "@/components/ui/stato";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import {
  ElencoSchede,
  Scheda,
  SchedaTesta,
  SchedaTotale,
  SchedaVoci,
} from "@/components/tabella/schede";
import { Vuoto } from "@/components/ui/vuoto";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Guscio } from "@/components/guscio/guscio";
import { BarraStrumenti } from "@/components/tabella/barra-strumenti";
import { CellaModificabile } from "@/components/tabella/cella-modificabile";
import { IntestazioneOrdinabile } from "@/components/tabella/intestazione-ordinabile";
import { ordinaPer, prossimoOrdinamento, type Ordinamento } from "@/components/tabella/ordinamento";
import {
  annullaIncasso,
  eliminaFattura,
  salvaFattura,
  segnaIncassata,
} from "@/lib/dati/azioni";
import { useCalcoloAnno, useDati } from "@/lib/dati/hooks";
import { usePreferenze } from "@/lib/stato/preferenze";
import { useRichiesta } from "@/lib/stato/comandi";
import { dentroPeriodo, etichettaPeriodo } from "@/lib/periodo";
import { data as fmtData, euro, iniziali, coloreDaNome } from "@/lib/format";
import { fatturaGrezza } from "@/lib/fisco/documenti";
import { stornoPerFattura } from "@/lib/fisco/note";
import type { FatturaCalcolata } from "@/lib/fisco/tipi";
import type { Fattura } from "@/lib/dati/tipi";
import { ModuloFattura } from "./modulo-fattura";

type Colonna =
  | "emissione" | "numero" | "cliente" | "descrizione" | "tipo"
  | "imponibile" | "iva" | "totale" | "incasso" | "stato";

type FiltroStato = "tutte" | "daIncassare" | "scadute" | "incassate";

const CHIAVI_STATO = ["tutte", "daIncassare", "scadute", "incassate"];

const TIPI_RICAVO = [
  { valore: "ricorrente", etichetta: "Ricorrente" },
  { valore: "progetto", etichetta: "Progetto" },
  { valore: "unaTantum", etichetta: "Una tantum" },
];

export function SchermataFatture() {
  const periodo = usePreferenze((s) => s.periodo);
  const oggi = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dati = useDati();
  const calcolo = useCalcoloAnno(periodo.anno, oggi);

  const [ricerca, setRicerca] = React.useState("");
  const [filtroStato, setFiltroStato] = React.useState<FiltroStato>("tutte");
  const [filtroCliente, setFiltroCliente] = React.useState("tutti");
  const [ordinamento, setOrdinamento] = React.useState<Ordinamento<Colonna>>({
    colonna: "emissione",
    verso: "decrescente",
  });
  const [moduloAperto, setModuloAperto] = React.useState(false);

  // Gli avvisi del cruscotto portano qui già filtrati. Leggo la query a mano
  // invece di useSearchParams: è un riempimento iniziale, non una navigazione,
  // e così la pagina resta generabile staticamente senza confini di Suspense.
  React.useEffect(() => {
    const richiesto = new URLSearchParams(window.location.search).get("stato");
    if (richiesto && CHIAVI_STATO.includes(richiesto)) {
      setFiltroStato(richiesto as FiltroStato);
    }
  }, []);

  // Quello che chiede la palette: «nuova fattura» apre il modulo, «apri
  // fattura 2026/03» porta qui con la ricerca già compilata e i filtri aperti,
  // altrimenti la fattura cercata resterebbe nascosta da un filtro di ieri.
  useRichiesta("nuovaFattura", () => setModuloAperto(true));
  useRichiesta("cercaFatture", (r) => {
    setRicerca(r.testo);
    setFiltroStato("tutte");
    setFiltroCliente("tutti");
  });

  // Il netto di ogni fattura viste le note: calcolato, non salvato. Si legge
  // qui e sulla nota, e da nessuna delle due parti sta in archivio.
  const storni = React.useMemo(
    () => stornoPerFattura(dati?.note ?? [], calcolo?.prospetto.fattureCalcolate ?? []),
    [dati, calcolo],
  );

  const clienti = React.useMemo(() => dati?.clienti ?? [], [dati]);
  const nomeCliente = React.useCallback(
    (id: string) => clienti.find((c) => c.id === id)?.nome ?? "",
    [clienti],
  );

  const ordinario = calcolo?.impostazioni.regime === "ordinario";
  const mostraIva = ordinario;

  const righe = React.useMemo(() => {
    const tutte = calcolo?.prospetto.fattureCalcolate ?? [];
    const testo = ricerca.trim().toLowerCase();
    const filtrate = tutte.filter((f) => {
      if (!dentroPeriodo(f.dataEmissione, periodo)) return false;
      if (filtroCliente !== "tutti" && f.clienteId !== filtroCliente) return false;
      if (filtroStato === "incassate" && f.stato !== "incassato") return false;
      if (filtroStato === "scadute" && f.stato !== "scaduto") return false;
      if (filtroStato === "daIncassare" && f.stato === "incassato") return false;
      if (testo) {
        const pagliaio = `${f.numero} ${f.descrizione} ${nomeCliente(f.clienteId)}`.toLowerCase();
        if (!pagliaio.includes(testo)) return false;
      }
      return true;
    });

    const chiavi: Record<Colonna, (f: FatturaCalcolata) => string | number | null> = {
      emissione: (f) => f.dataEmissione,
      numero: (f) => f.numero,
      cliente: (f) => nomeCliente(f.clienteId),
      descrizione: (f) => f.descrizione,
      tipo: (f) => f.tipoRicavo,
      imponibile: (f) => f.imponibile,
      iva: (f) => f.iva,
      totale: (f) => f.totale,
      incasso: (f) => f.dataIncasso ?? null,
      stato: (f) => (f.stato === "scaduto" ? 0 : f.stato === "daIncassare" ? 1 : 2),
    };
    return ordinaPer(filtrate, chiavi[ordinamento.colonna], ordinamento.verso);
  }, [calcolo, periodo, ricerca, filtroStato, filtroCliente, ordinamento, nomeCliente]);

  const totali = React.useMemo(
    () =>
      righe.reduce(
        (acc, f) => ({
          imponibile: acc.imponibile + f.imponibile,
          iva: acc.iva + f.iva,
          totale: acc.totale + f.totale,
        }),
        { imponibile: 0, iva: 0, totale: 0 },
      ),
    [righe],
  );

  const daIncassare = righe.filter((f) => f.stato !== "incassato");
  const scadute = righe.filter((f) => f.stato === "scaduto");

  function ordina(colonna: Colonna) {
    setOrdinamento((o) =>
      prossimoOrdinamento(o, colonna, colonna === "emissione" ? "decrescente" : "crescente"),
    );
  }

  function aggiorna(fattura: FatturaCalcolata, modifiche: Partial<Fattura>) {
    void salvaFattura({ ...fatturaGrezza(fattura), ...modifiche });
  }

  const vuotoTotale = (calcolo?.prospetto.fattureCalcolate.length ?? 0) === 0;
  const filtriAttivi = ricerca !== "" || filtroStato !== "tutte" || filtroCliente !== "tutti";

  return (
    <Guscio
      titolo="Fatture"
      descrizione={`Registro per data di emissione · ${etichettaPeriodo(periodo)}`}
      azioni={
        <span className="flex flex-wrap items-center gap-2">
          <BottoneImport destinazione="fattura" etichetta="Da CSV" />
          <Button scrive onClick={() => setModuloAperto(true)}>
            <FilePlus2 className="size-4" aria-hidden />
            Nuova fattura
          </Button>
        </span>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Chip tono="neutro" className="cifre">
          {righe.length} {righe.length === 1 ? "fattura" : "fatture"}
        </Chip>
        {daIncassare.length > 0 && (
          <Chip tono="attenzione" className="cifre">
            {euro(daIncassare.reduce((a, f) => a + f.nettoIncasso, 0))} da incassare
          </Chip>
        )}
        {scadute.length > 0 && (
          <Chip tono="negativo" className="cifre">
            {euro(scadute.reduce((a, f) => a + f.nettoIncasso, 0))} scaduti
          </Chip>
        )}
      </div>

      <BarraStrumenti
        ricerca={ricerca}
        onRicerca={setRicerca}
        segnaposto="Cerca per numero, cliente o descrizione"
        className="mb-4"
      >
        <Select value={filtroStato} onValueChange={(v) => setFiltroStato(v as FiltroStato)}>
          <SelectTrigger className="w-44" aria-label="Filtra per stato">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutte">Tutti gli stati</SelectItem>
            <SelectItem value="daIncassare">Da incassare</SelectItem>
            <SelectItem value="scadute">Scadute</SelectItem>
            <SelectItem value="incassate">Incassate</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroCliente} onValueChange={setFiltroCliente}>
          <SelectTrigger className="w-52" aria-label="Filtra per cliente">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti i clienti</SelectItem>
            {clienti.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </BarraStrumenti>

      <Card className="overflow-hidden">
        {dati === undefined ? (
          <CaricamentoTabella />
        ) : vuotoTotale ? (
          <Vuoto
            icona={FileText}
            titolo="Registra la prima fattura per vedere il calcolo delle imposte, oppure carica lo storico da un CSV."
            azione={
              <div className="flex flex-wrap justify-center gap-2">
                <Button scrive onClick={() => setModuloAperto(true)}>Nuova fattura</Button>
                <BottoneImport destinazione="fattura" />
              </div>
            }
          />
        ) : righe.length === 0 ? (
          <Vuoto
            icona={FileText}
            titolo={`Nessuna fattura ${filtriAttivi ? "con questi filtri" : `in ${etichettaPeriodo(periodo)}`}.`}
            azione={
              filtriAttivi ? (
                <Button
                  variante="contorno"
                  taglia="sm"
                  onClick={() => {
                    setRicerca("");
                    setFiltroStato("tutte");
                    setFiltroCliente("tutti");
                  }}
                >
                  Azzera i filtri
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Da tablet in su: la tabella. */}
            <ContenitoreTabella
              data-scroll-ok
              classeGuscio="hidden md:block"
              className="max-h-[calc(100dvh-21rem)]"
            >
              <Tabella>
                <TabellaTesta>
                  <tr>
                    <IntestazioneOrdinabile colonna="emissione" ordinamento={ordinamento} onOrdina={ordina}>
                      Emissione
                    </IntestazioneOrdinabile>
                    <IntestazioneOrdinabile colonna="numero" ordinamento={ordinamento} onOrdina={ordina}>
                      Numero
                    </IntestazioneOrdinabile>
                    <IntestazioneOrdinabile colonna="cliente" ordinamento={ordinamento} onOrdina={ordina}>
                      Cliente
                    </IntestazioneOrdinabile>
                    <IntestazioneOrdinabile colonna="descrizione" ordinamento={ordinamento} onOrdina={ordina}>
                      Descrizione
                    </IntestazioneOrdinabile>
                    <IntestazioneOrdinabile colonna="tipo" ordinamento={ordinamento} onOrdina={ordina}>
                      Tipo
                    </IntestazioneOrdinabile>
                    <IntestazioneOrdinabile colonna="imponibile" ordinamento={ordinamento} onOrdina={ordina} numerica>
                      Imponibile
                    </IntestazioneOrdinabile>
                    {mostraIva && (
                      <IntestazioneOrdinabile colonna="iva" ordinamento={ordinamento} onOrdina={ordina} numerica>
                        IVA
                      </IntestazioneOrdinabile>
                    )}
                    <IntestazioneOrdinabile colonna="totale" ordinamento={ordinamento} onOrdina={ordina} numerica>
                      Totale
                    </IntestazioneOrdinabile>
                    <IntestazioneOrdinabile colonna="incasso" ordinamento={ordinamento} onOrdina={ordina}>
                      Incasso
                    </IntestazioneOrdinabile>
                    <IntestazioneOrdinabile colonna="stato" ordinamento={ordinamento} onOrdina={ordina}>
                      Stato
                    </IntestazioneOrdinabile>
                    <TabellaIntestazione ancorata>
                      <span className="sr-only">Azioni</span>
                    </TabellaIntestazione>
                  </tr>
                </TabellaTesta>

                <TabellaCorpo>
                  {righe.map((f) => (
                    <TabellaRiga key={f.id}>
                      <TabellaCella className="p-1">
                        <CellaModificabile
                          tipo="data" etichetta="Data di emissione" valore={f.dataEmissione}
                          onSalva={(v) => { if (v) aggiorna(f, { dataEmissione: String(v) }); }}
                        />
                      </TabellaCella>
                      <TabellaCella className="p-1">
                        <CellaModificabile
                          tipo="testo" etichetta="Numero" valore={f.numero} className="cifre"
                          onSalva={(v) => aggiorna(f, { numero: String(v ?? "") })}
                        />
                      </TabellaCella>
                      <TabellaCella className="min-w-44 p-1">
                        <div className="flex items-center gap-2 pl-1">
                          <Avatar nome={nomeCliente(f.clienteId)} />
                          <CellaModificabile
                            tipo="scelta" etichetta="Cliente" valore={f.clienteId}
                            opzioni={clienti.map((c) => ({ valore: c.id, etichetta: c.nome }))}
                            onSalva={(v) => aggiorna(f, { clienteId: String(v) })}
                          />
                        </div>
                      </TabellaCella>
                      <TabellaCella className="min-w-44 p-1">
                        <CellaModificabile
                          tipo="testo" etichetta="Descrizione" valore={f.descrizione}
                          onSalva={(v) => aggiorna(f, { descrizione: String(v ?? "") })}
                        />
                      </TabellaCella>
                      <TabellaCella className="min-w-32 p-1">
                        <CellaModificabile
                          tipo="scelta" etichetta="Tipo di ricavo" valore={f.tipoRicavo}
                          opzioni={TIPI_RICAVO}
                          onSalva={(v) => aggiorna(f, { tipoRicavo: v as Fattura["tipoRicavo"] })}
                        />
                      </TabellaCella>
                      <TabellaCella className="p-1">
                        <CellaModificabile
                          tipo="valuta" etichetta="Imponibile" valore={f.imponibile}
                          onSalva={(v) => aggiorna(f, { imponibile: Number(v) })}
                        />
                        {/* Il netto dopo le note: sta sotto l'imponibile e non
                            al posto suo, perché l'imponibile della fattura non
                            cambia — cambia quanto ne resta. */}
                        <Storno storno={storni.get(f.id)} />
                      </TabellaCella>
                      {mostraIva && (
                        <TabellaCella numerica className="text-inchiostro-tenue">
                          {euro(f.iva)}
                        </TabellaCella>
                      )}
                      <TabellaCella
                        numerica
                        className="whitespace-nowrap font-medium"
                        title={f.bollo > 0 ? `Compreso il bollo di ${euro(f.bollo)}` : undefined}
                      >
                        {euro(f.totale)}
                      </TabellaCella>
                      <TabellaCella className="p-1">
                        <CellaModificabile
                          tipo="data" etichetta="Data di incasso" valore={f.dataIncasso ?? null}
                          className="whitespace-nowrap"
                          onSalva={(v) => aggiorna(f, { dataIncasso: v ? String(v) : null })}
                        />
                      </TabellaCella>
                      <TabellaCella className="whitespace-nowrap">
                        <StatoFattura f={f} />
                        <span className="mt-0.5 block text-micro text-inchiostro-tenue">
                          {f.stato === "incassato"
                            ? f.giorniIncasso !== null
                              ? `in ${f.giorniIncasso} giorni`
                              : ""
                            : f.stato === "scaduto"
                              ? `da ${f.giorniRitardo} giorni`
                              : `scade il ${fmtData(f.scadenza)}`}
                        </span>
                      </TabellaCella>
                      <TabellaCella ancorata className="w-24">
                        <div className="flex items-center justify-end gap-1">
                          {f.stato === "incassato" ? (
                            <Button scrive
                              variante="quieto" taglia="icona"
                              aria-label={`Annulla l'incasso della fattura ${f.numero}`}
                              onClick={() => void annullaIncasso(f)}
                            >
                              <Undo2 className="size-4" />
                            </Button>
                          ) : (
                            <Button scrive
                              variante="quieto" taglia="icona"
                              aria-label={`Segna la fattura ${f.numero} come incassata oggi`}
                              onClick={() => void segnaIncassata(f)}
                            >
                              <CheckCheck className="size-4" />
                            </Button>
                          )}
                          <Button scrive
                            variante="quieto" taglia="icona"
                            aria-label={`Elimina la fattura ${f.numero}`}
                            onClick={() => void eliminaFattura(f)}
                            className="hover:bg-negativo-tenue hover:text-negativo"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TabellaCella>
                    </TabellaRiga>
                  ))}
                </TabellaCorpo>

                <TabellaPiede>
                  <tr>
                    <TabellaCella colSpan={5}>
                      Totale · {righe.length} {righe.length === 1 ? "fattura" : "fatture"}
                    </TabellaCella>
                    <TabellaCella numerica>{euro(totali.imponibile)}</TabellaCella>
                    {mostraIva && <TabellaCella numerica>{euro(totali.iva)}</TabellaCella>}
                    <TabellaCella numerica>{euro(totali.totale)}</TabellaCella>
                    <TabellaCella colSpan={3} />
                  </tr>
                </TabellaPiede>
              </Tabella>
            </ContenitoreTabella>

            {/* Su telefono la tabella diventa un elenco di schede leggibili. */}
            <ElencoSchede>
              {righe.map((f) => (
                <Scheda key={f.id}>
                  <SchedaTesta
                    sopra={f.numero}
                    titolo={nomeCliente(f.clienteId)}
                    sotto={f.descrizione}
                    valore={euro(f.totale)}
                    notaValore={f.ritenuta > 0 ? `${euro(f.nettoIncasso)} netti` : undefined}
                  />
                  <SchedaVoci
                    voci={[
                      { etichetta: "Emissione", valore: fmtData(f.dataEmissione) },
                      { etichetta: "Imponibile", valore: euro(f.imponibile) },
                      {
                        etichetta: "Netto dopo le note",
                        valore: euro(storni.get(f.id)?.netto ?? f.imponibile),
                        mostra: (storni.get(f.id)?.stornato ?? 0) > 0,
                      },
                      { etichetta: "IVA", valore: euro(f.iva), mostra: f.iva > 0 },
                      { etichetta: "Ritenuta", valore: euro(f.ritenuta), mostra: f.ritenuta > 0 },
                    ]}
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <StatoFattura f={f} />
                    <span className="text-micro text-inchiostro-tenue">
                      {f.stato === "incassato"
                        ? `incassata il ${fmtData(f.dataIncasso)}`
                        : f.stato === "scaduto"
                          ? `scaduta da ${f.giorniRitardo} giorni`
                          : `scade il ${fmtData(f.scadenza)}`}
                    </span>
                  </div>
                  {/* L'azione inversa c'era sulla riga della tabella e non
                      qui: sul telefono una fattura segnata per sbaglio non si
                      poteva più rimettere a posto. */}
                  {f.stato !== "incassato" ? (
                    <Button scrive
                      variante="contorno"
                      taglia="sm"
                      className="mt-3 w-full"
                      onClick={() => void segnaIncassata(f)}
                    >
                      <CheckCheck className="size-4" aria-hidden />
                      Segna come incassata oggi
                    </Button>
                  ) : (
                    <Button scrive
                      variante="quieto"
                      taglia="sm"
                      className="mt-3 w-full"
                      onClick={() => void annullaIncasso(f)}
                    >
                      <Undo2 className="size-4" aria-hidden />
                      Annulla l&apos;incasso
                    </Button>
                  )}
                </Scheda>
              ))}
              <SchedaTotale
                valore={euro(totali.totale)}
                nota={`${righe.length} ${righe.length === 1 ? "fattura" : "fatture"}`}
              />
            </ElencoSchede>
          </>
        )}
      </Card>

      <ModuloFattura
        aperto={moduloAperto}
        onChiudi={() => setModuloAperto(false)}
        clienti={clienti}
        fatture={dati?.fatture ?? []}
        anno={periodo.anno}
        ordinario={ordinario}
        aliquotaIvaPredefinita={calcolo?.impostazioni.aliquotaIva ?? 0.22}
      />
    </Guscio>
  );
}

function StatoFattura({ f }: { f: FatturaCalcolata }) {
  if (f.stato === "incassato") return <Stato tono="positivo">Incassata</Stato>;
  if (f.stato === "scaduto") return <Stato tono="negativo">Scaduta</Stato>;
  return <Stato tono="attenzione">Da incassare</Stato>;
}

function Avatar({ nome }: { nome: string }) {
  if (!nome) return null;
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-full text-micro font-semibold text-white"
      style={{ backgroundColor: coloreDaNome(nome) }}
    >
      {iniziali(nome)}
    </span>
  );
}

/**
 * Quanto resta di una fattura dopo le note di credito che la rettificano.
 *
 * Non compare quando non c'è niente da stornare: una riga in più su ogni
 * fattura, per dire «nessuno storno», sarebbe rumore su tutta la tabella.
 */
function Storno({ storno }: { storno?: { stornato: number; netto: number; note: { numero: string }[] } }) {
  if (!storno || storno.stornato === 0) return null;
  return (
    <span className="mt-0.5 block px-2 text-right text-micro text-inchiostro-tenue">
      <span className="text-negativo">− {euro(storno.stornato)}</span> ·{" "}
      <span title={storno.note.map((n) => n.numero).join(", ")}>netto {euro(storno.netto)}</span>
    </span>
  );
}
