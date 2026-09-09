"use client";

import * as React from "react";
import { CheckCheck, Receipt, ReceiptText, Trash2, Undo2 } from "lucide-react";
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
import { eliminaCosto, salvaCosto, segnaPagato } from "@/lib/dati/azioni";
import { useCalcoloAnno, useDati } from "@/lib/dati/hooks";
import { usePreferenze } from "@/lib/stato/preferenze";
import { useRichiesta } from "@/lib/stato/comandi";
import { dentroPeriodo, etichettaPeriodo } from "@/lib/periodo";
import { data as fmtData, euro, num, percentuale } from "@/lib/format";
import { CATEGORIE_COSTO } from "@/lib/dati/categorie";
import { costoGrezzo } from "@/lib/fisco/documenti";
import type { CostoCalcolato } from "@/lib/fisco/tipi";
import type { Costo } from "@/lib/dati/tipi";
import { ModuloCosto } from "./modulo-costo";

type Colonna =
  | "documento" | "fornitore" | "categoria" | "descrizione" | "natura"
  | "imponibile" | "iva" | "totale" | "deducibile" | "pagamento" | "stato";

type FiltroStato = "tutti" | "daPagare" | "pagati";

const CHIAVI_STATO = ["tutti", "daPagare", "pagati"];

const NATURE = [
  { valore: "fisso", etichetta: "Fisso" },
  { valore: "variabile", etichetta: "Variabile" },
];

export function SchermataCosti() {
  const periodo = usePreferenze((s) => s.periodo);
  const oggi = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const dati = useDati();
  const calcolo = useCalcoloAnno(periodo.anno, oggi);

  const [ricerca, setRicerca] = React.useState("");
  const [filtroStato, setFiltroStato] = React.useState<FiltroStato>("tutti");
  const [filtroCategoria, setFiltroCategoria] = React.useState("tutte");
  const [ordinamento, setOrdinamento] = React.useState<Ordinamento<Colonna>>({
    colonna: "documento",
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

  useRichiesta("nuovoCosto", () => setModuloAperto(true));

  const forfettario = calcolo?.impostazioni.regime === "forfettario";

  const categorieUsate = React.useMemo(() => {
    const insieme = new Set<string>(CATEGORIE_COSTO);
    for (const c of dati?.costi ?? []) if (c.categoria) insieme.add(c.categoria);
    return [...insieme].sort((a, b) => a.localeCompare(b, "it"));
  }, [dati]);

  const righe = React.useMemo(() => {
    const tutti = calcolo?.prospetto.costiCalcolati ?? [];
    const testo = ricerca.trim().toLowerCase();
    const filtrati = tutti.filter((c) => {
      if (!dentroPeriodo(c.dataDocumento, periodo)) return false;
      if (filtroCategoria !== "tutte" && c.categoria !== filtroCategoria) return false;
      if (filtroStato === "pagati" && c.stato !== "pagato") return false;
      if (filtroStato === "daPagare" && c.stato !== "daPagare") return false;
      if (testo) {
        const pagliaio = `${c.fornitore} ${c.descrizione} ${c.categoria}`.toLowerCase();
        if (!pagliaio.includes(testo)) return false;
      }
      return true;
    });

    const chiavi: Record<Colonna, (c: CostoCalcolato) => string | number | null> = {
      documento: (c) => c.dataDocumento,
      fornitore: (c) => c.fornitore,
      categoria: (c) => c.categoria,
      descrizione: (c) => c.descrizione,
      natura: (c) => c.natura,
      imponibile: (c) => c.imponibile,
      iva: (c) => c.iva,
      totale: (c) => c.totale,
      deducibile: (c) => c.costoDeducibile,
      pagamento: (c) => c.dataPagamento ?? null,
      stato: (c) => (c.stato === "daPagare" ? 0 : 1),
    };
    return ordinaPer(filtrati, chiavi[ordinamento.colonna], ordinamento.verso);
  }, [calcolo, periodo, ricerca, filtroStato, filtroCategoria, ordinamento]);

  const totali = React.useMemo(
    () =>
      righe.reduce(
        (acc, c) => ({
          imponibile: acc.imponibile + c.imponibile,
          iva: acc.iva + c.iva,
          totale: acc.totale + c.totale,
          deducibile: acc.deducibile + c.costoDeducibile,
        }),
        { imponibile: 0, iva: 0, totale: 0, deducibile: 0 },
      ),
    [righe],
  );

  const daPagare = righe.filter((c) => c.stato === "daPagare");

  function ordina(colonna: Colonna) {
    setOrdinamento((o) =>
      prossimoOrdinamento(o, colonna, colonna === "documento" ? "decrescente" : "crescente"),
    );
  }

  function aggiorna(costo: CostoCalcolato, modifiche: Partial<Costo>) {
    void salvaCosto({ ...costoGrezzo(costo), ...modifiche });
  }

  const vuotoTotale = (calcolo?.prospetto.costiCalcolati.length ?? 0) === 0;
  const filtriAttivi = ricerca !== "" || filtroStato !== "tutti" || filtroCategoria !== "tutte";

  return (
    <Guscio
      titolo="Costi"
      descrizione={`Registro per data del documento · ${etichettaPeriodo(periodo)}`}
      azioni={
        <span className="flex flex-wrap items-center gap-2">
          <BottoneImport destinazione="costo" etichetta="Da CSV" />
          <Button scrive onClick={() => setModuloAperto(true)}>
            <ReceiptText className="size-4" aria-hidden />
            Nuovo costo
          </Button>
        </span>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Chip tono="neutro" className="cifre">
          {righe.length} {righe.length === 1 ? "costo" : "costi"}
        </Chip>
        <Chip tono="neutro" className="cifre">{euro(totali.totale)} di uscita</Chip>
        {daPagare.length > 0 && (
          <Chip tono="attenzione" className="cifre">
            {euro(daPagare.reduce((a, c) => a + c.totale, 0))} da pagare
          </Chip>
        )}
        {forfettario && (
          <Chip tono="accento">
            In forfettario i costi non si deducono, ma restano tracciati per il margine reale
          </Chip>
        )}
      </div>

      <BarraStrumenti
        ricerca={ricerca}
        onRicerca={setRicerca}
        segnaposto="Cerca per fornitore, categoria o descrizione"
        className="mb-4"
      >
        <Select value={filtroStato} onValueChange={(v) => setFiltroStato(v as FiltroStato)}>
          <SelectTrigger className="w-40" aria-label="Filtra per stato">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti gli stati</SelectItem>
            <SelectItem value="daPagare">Da pagare</SelectItem>
            <SelectItem value="pagati">Pagati</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="w-60" aria-label="Filtra per categoria">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutte">Tutte le categorie</SelectItem>
            {categorieUsate.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </BarraStrumenti>

      <Card className="overflow-hidden">
        {dati === undefined ? (
          <CaricamentoTabella />
        ) : vuotoTotale ? (
          <Vuoto
            icona={Receipt}
            titolo="Nessun costo registrato: aggiungine uno per leggere il margine reale, oppure carica l'estratto conto da un CSV."
            azione={
              <div className="flex flex-wrap justify-center gap-2">
                <Button scrive onClick={() => setModuloAperto(true)}>Nuovo costo</Button>
                <BottoneImport destinazione="costo" />
              </div>
            }
          />
        ) : righe.length === 0 ? (
          <Vuoto
            icona={Receipt}
            titolo={`Nessun costo ${filtriAttivi ? "con questi filtri" : `in ${etichettaPeriodo(periodo)}`}.`}
            azione={
              filtriAttivi ? (
                <Button variante="contorno" taglia="sm" onClick={() => {
                  setRicerca(""); setFiltroStato("tutti"); setFiltroCategoria("tutte");
                }}>
                  Azzera i filtri
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <ContenitoreTabella
              data-scroll-ok
              classeGuscio="hidden md:block"
              className="max-h-[calc(100dvh-21rem)]"
            >
              <Tabella>
                <TabellaTesta>
                  <tr>
                    <IntestazioneOrdinabile colonna="documento" ordinamento={ordinamento} onOrdina={ordina}>
                      Documento
                    </IntestazioneOrdinabile>
                    <IntestazioneOrdinabile colonna="fornitore" ordinamento={ordinamento} onOrdina={ordina}>
                      Fornitore
                    </IntestazioneOrdinabile>
                    <IntestazioneOrdinabile colonna="categoria" ordinamento={ordinamento} onOrdina={ordina}>
                      Categoria
                    </IntestazioneOrdinabile>
                    <IntestazioneOrdinabile colonna="descrizione" ordinamento={ordinamento} onOrdina={ordina}>
                      Descrizione
                    </IntestazioneOrdinabile>
                    <IntestazioneOrdinabile colonna="natura" ordinamento={ordinamento} onOrdina={ordina}>
                      Natura
                    </IntestazioneOrdinabile>
                    <IntestazioneOrdinabile colonna="imponibile" ordinamento={ordinamento} onOrdina={ordina} numerica>
                      Imponibile
                    </IntestazioneOrdinabile>
                    <IntestazioneOrdinabile colonna="iva" ordinamento={ordinamento} onOrdina={ordina} numerica>
                      IVA
                    </IntestazioneOrdinabile>
                    <IntestazioneOrdinabile colonna="totale" ordinamento={ordinamento} onOrdina={ordina} numerica>
                      Totale
                    </IntestazioneOrdinabile>
                    {!forfettario && (
                      <>
                        <TabellaIntestazione numerica className="whitespace-nowrap">
                          % deduc.
                        </TabellaIntestazione>
                        <IntestazioneOrdinabile colonna="deducibile" ordinamento={ordinamento} onOrdina={ordina} numerica>
                          Deducibile
                        </IntestazioneOrdinabile>
                      </>
                    )}
                    <IntestazioneOrdinabile colonna="pagamento" ordinamento={ordinamento} onOrdina={ordina}>
                      Pagamento
                    </IntestazioneOrdinabile>
                    <TabellaIntestazione ancorata><span className="sr-only">Azioni</span></TabellaIntestazione>
                  </tr>
                </TabellaTesta>

                <TabellaCorpo>
                  {righe.map((c) => (
                    <TabellaRiga key={c.id}>
                      <TabellaCella className="p-1">
                        <CellaModificabile tipo="data" etichetta="Data del documento" valore={c.dataDocumento}
                          onSalva={(v) => { if (v) aggiorna(c, { dataDocumento: String(v) }); }} />
                      </TabellaCella>
                      <TabellaCella className="p-1">
                        <CellaModificabile tipo="testo" etichetta="Fornitore" valore={c.fornitore}
                          onSalva={(v) => aggiorna(c, { fornitore: String(v ?? "") })} />
                      </TabellaCella>
                      <TabellaCella className="min-w-52 p-1">
                        <CellaModificabile tipo="scelta" etichetta="Categoria" valore={c.categoria}
                          opzioni={categorieUsate.map((x) => ({ valore: x, etichetta: x }))}
                          onSalva={(v) => aggiorna(c, { categoria: String(v) })} />
                      </TabellaCella>
                      <TabellaCella className="min-w-44 p-1">
                        <CellaModificabile tipo="testo" etichetta="Descrizione" valore={c.descrizione}
                          onSalva={(v) => aggiorna(c, { descrizione: String(v ?? "") })} />
                      </TabellaCella>
                      <TabellaCella className="min-w-28 p-1">
                        <CellaModificabile tipo="scelta" etichetta="Natura" valore={c.natura} opzioni={NATURE}
                          onSalva={(v) => aggiorna(c, { natura: v as Costo["natura"] })} />
                      </TabellaCella>
                      <TabellaCella className="p-1">
                        <CellaModificabile tipo="valuta" etichetta="Imponibile" valore={c.imponibile}
                          onSalva={(v) => aggiorna(c, { imponibile: Number(v) })} />
                      </TabellaCella>
                      <TabellaCella className="p-1">
                        <CellaModificabile tipo="percentuale" etichetta="Aliquota IVA" valore={c.aliquotaIva}
                          className="whitespace-nowrap"
                          suggerimento={`IVA ${euro(c.iva)}${c.ivaDetraibile > 0 ? `, detraibile ${euro(c.ivaDetraibile)}` : ""}`}
                          onSalva={(v) => aggiorna(c, { aliquotaIva: Number(v) })} />
                      </TabellaCella>
                      <TabellaCella numerica className="whitespace-nowrap font-medium">{euro(c.totale)}</TabellaCella>
                      {!forfettario && (
                        <>
                          <TabellaCella className="p-1">
                            <CellaModificabile tipo="percentuale" etichetta="Percentuale di deducibilità"
                              valore={c.percentualeDeducibilita} className="whitespace-nowrap"
                              onSalva={(v) => aggiorna(c, { percentualeDeducibilita: Number(v) })} />
                          </TabellaCella>
                          <TabellaCella numerica className="whitespace-nowrap">
                            {euro(c.costoDeducibile)}
                          </TabellaCella>
                        </>
                      )}
                      <TabellaCella className="p-1">
                        <CellaModificabile tipo="data" etichetta="Data di pagamento"
                          valore={c.dataPagamento ?? null} className="whitespace-nowrap"
                          onSalva={(v) => aggiorna(c, { dataPagamento: v ? String(v) : null })} />
                      </TabellaCella>
                      <TabellaCella ancorata className="w-24">
                        <div className="flex items-center justify-end gap-1">
                          {c.stato === "pagato" ? (
                            <Button scrive variante="quieto" taglia="icona"
                              aria-label={`Annulla il pagamento del costo ${c.fornitore}`}
                              onClick={() => aggiorna(c, { dataPagamento: null })}>
                              <Undo2 className="size-4" />
                            </Button>
                          ) : (
                            <Button scrive variante="quieto" taglia="icona"
                              aria-label={`Segna il costo ${c.fornitore} come pagato oggi`}
                              onClick={() => void segnaPagato(c)}>
                              <CheckCheck className="size-4" />
                            </Button>
                          )}
                          <Button scrive variante="quieto" taglia="icona"
                            aria-label={`Elimina il costo ${c.fornitore}`}
                            onClick={() => void eliminaCosto(c)}
                            className="hover:bg-negativo-tenue hover:text-negativo">
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
                      Totale · {righe.length} {righe.length === 1 ? "costo" : "costi"}
                    </TabellaCella>
                    <TabellaCella numerica>{euro(totali.imponibile)}</TabellaCella>
                    <TabellaCella numerica>{euro(totali.iva)}</TabellaCella>
                    <TabellaCella numerica>{euro(totali.totale)}</TabellaCella>
                    {!forfettario && (
                      <>
                        <TabellaCella />
                        <TabellaCella numerica>{euro(totali.deducibile)}</TabellaCella>
                      </>
                    )}
                    <TabellaCella colSpan={2} />
                  </tr>
                </TabellaPiede>
              </Tabella>
            </ContenitoreTabella>

            <ElencoSchede>
              {righe.map((c) => (
                <Scheda key={c.id}>
                  <SchedaTesta
                    titolo={c.fornitore}
                    sotto={c.descrizione}
                    valore={euro(c.totale)}
                    notaValore={c.categoria}
                  />
                  <SchedaVoci
                    voci={[
                      { etichetta: "Documento", valore: fmtData(c.dataDocumento) },
                      {
                        etichetta: "Imponibile",
                        valore: euro(c.imponibile),
                        mostra: c.iva > 0,
                      },
                      { etichetta: "IVA", valore: euro(c.iva), mostra: c.iva > 0 },
                      {
                        etichetta: "Deducibile",
                        valore: percentuale(c.percentualeDeducibilita, 0),
                        mostra: !forfettario,
                      },
                    ]}
                  />
                  <div className="mt-3">
                    {c.stato === "pagato" ? (
                      <Stato tono="positivo">Pagato il {fmtData(c.dataPagamento)}</Stato>
                    ) : (
                      <Stato tono="attenzione">Da pagare</Stato>
                    )}
                  </div>
                  {c.stato === "daPagare" ? (
                    <Button scrive
                      variante="contorno"
                      taglia="sm"
                      className="mt-3 w-full"
                      onClick={() => void segnaPagato(c)}
                    >
                      <CheckCheck className="size-4" aria-hidden />
                      Segna come pagato oggi
                    </Button>
                  ) : (
                    <Button scrive
                      variante="quieto"
                      taglia="sm"
                      className="mt-3 w-full"
                      onClick={() => aggiorna(c, { dataPagamento: null })}
                    >
                      <Undo2 className="size-4" aria-hidden />
                      Annulla il pagamento
                    </Button>
                  )}
                </Scheda>
              ))}
              <SchedaTotale
                valore={euro(totali.totale)}
                nota={`${num(righe.length)} costi`}
              />
            </ElencoSchede>
          </>
        )}
      </Card>

      <ModuloCosto
        aperto={moduloAperto}
        onChiudi={() => setModuloAperto(false)}
        categorie={categorieUsate}
        forfettario={forfettario}
        aliquotaIvaPredefinita={calcolo?.impostazioni.aliquotaIva ?? 0.22}
      />
    </Guscio>
  );
}
