"use client";

import * as React from "react";
import Link from "next/link";
import { Database, Download, RotateCcw, Sparkles, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardCorpo, CardInterna, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { Etichetta } from "@/components/ui/etichetta";
import { Kpi } from "@/components/ui/kpi";
import { Stato } from "@/components/ui/stato";
import {
  ContenitoreTabella,
  Tabella,
  TabellaCella,
  TabellaCorpo,
  TabellaIntestazione,
  TabellaRiga,
  TabellaTesta,
} from "@/components/ui/tabella";
import { toast } from "@/components/ui/toast";
import { Vuoto } from "@/components/ui/vuoto";
import { Guscio } from "@/components/guscio/guscio";
import { archivio } from "@/lib/dati/archivio";
import { analizzaBackup } from "@/lib/dati/backup";
import { esportaBackup } from "@/lib/dati/azioni";
import { ANNO_DEMO, datiDemo } from "@/lib/dati/demo";
import { scegliFile } from "@/lib/dati/file";
import { useCalcoloAnno, useDati } from "@/lib/dati/hooks";
import { COLLEZIONI, type Dati, type IstantaneaArchivio, type NomeCollezione } from "@/lib/dati/tipi";
import { confrontaPerImport, type ConfrontoImport } from "@/lib/dati/confronto-import";
import {
  documentiDi,
  istantaneaDisponibile,
  ripristinaIstantanea,
  salvaIstantanea,
  scartaIstantanea,
} from "@/lib/dati/istantanee";
import { DialogoConfermaImport } from "./conferma-import";
import { dataEstesa, euro, interoIt, percentuale } from "@/lib/format";

const ETICHETTE: Record<NomeCollezione, string> = {
  impostazioni: "Impostazioni per anno",
  clienti: "Clienti",
  fatture: "Fatture",
  note: "Note di credito",
  costi: "Costi",
  movimentiPersonali: "Movimenti personali",
  movimentiAttivita: "Movimenti dell'attività",
  versamenti: "Versamenti F24",
  patrimonio: "Voci di patrimonio",
  spunte: "Adempimenti spuntati",
  chiusure: "Chiusure d'anno",
  percorsi: "Percorsi di configurazione",
};

export function PannelloDati() {
  // La data di riferimento è quella vera del dispositivo, fissata al montaggio
  // per non far cambiare i calcoli a metà sessione.
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const dati = useDati();
  const calcolo = useCalcoloAnno(ANNO_DEMO, oggi);
  const [avvisi, setAvvisi] = React.useState<string[]>([]);
  const [errori, setErrori] = React.useState<string[]>([]);
  const [recuperabile, setRecuperabile] = React.useState(false);
  const [inCorso, setInCorso] = React.useState(false);

  const vuoto = dati ? COLLEZIONI.every((c) => dati[c].length === 0) : false;

  const [istantanea, setIstantanea] = React.useState<IstantaneaArchivio | undefined>();
  const [daConfermare, setDaConfermare] = React.useState<
    { confronto: ConfrontoImport; dati: Dati; avvisi: string[]; nomeFile: string } | null
  >(null);

  const rileggiIstantanea = React.useCallback(() => {
    void istantaneaDisponibile().then(setIstantanea);
  }, []);
  React.useEffect(rileggiIstantanea, [rileggiIstantanea, dati]);

  /**
   * Sostituisce l'archivio, dopo averne messo da parte una copia.
   *
   * La copia sta nel database, non in memoria: di un archivio sostituito per
   * sbaglio ci si accorge riaprendo l'app, non nei tre secondi e mezzo in cui
   * un toast è a schermo. Il toast resta per dire che è successo, l'annulla no:
   * la strada per tornare indietro è la scheda qui sopra, che non scade.
   */
  const conIstantanea = React.useCallback(
    async (
      messaggio: string,
      causa: IstantaneaArchivio["causa"],
      dettaglio: string | undefined,
      azione: () => Promise<void>,
    ) => {
      setInCorso(true);
      setErrori([]);
      try {
        await salvaIstantanea(await archivio().leggiTutto(), causa, dettaglio);
        await azione();
        toast.conferma(messaggio);
      } catch (errore) {
        setErrori([errore instanceof Error ? errore.message : "Operazione non riuscita."]);
      } finally {
        setInCorso(false);
        rileggiIstantanea();
      }
    },
    [rileggiIstantanea],
  );

  async function caricaDemo() {
    await conIstantanea("Dataset dimostrativo caricato", "demo", undefined, async () => {
      await archivio().scriviTutto(datiDemo(), "sostituisci");
      setAvvisi([]);
    });
  }

  async function esporta() {
    await esportaBackup();
  }

  /**
   * Sceglie il file, lo legge, e **si ferma** se c'è qualcosa da perdere.
   *
   * Su un archivio vuoto non si ferma: è il gesto di chi ha cambiato computer,
   * e una domanda in più a chi è già in difficoltà è solo attrito. Quando
   * invece l'archivio contiene qualcosa, il file non entra finché l'utente non
   * ha letto cosa sparisce — «Importa» ed «Esporta» sono due pulsanti accanto.
   */
  async function importa() {
    const scelto = await scegliFile();
    if (scelto === null) return;
    const esito = analizzaBackup(scelto.testo);
    if (!esito.ok) {
      setErrori(esito.errori);
      setRecuperabile(esito.recuperabile);
      setAvvisi([]);
      toast.errore("Il file non è stato importato");
      return;
    }
    setErrori([]);
    const attuale = await archivio().leggiTutto();
    const confronto = confrontaPerImport(attuale, esito.backup.dati, esito.backup.esportatoIl);
    if (confronto.archivioVuoto) {
      setAvvisi(esito.avvisi);
      await conIstantanea("Backup importato", "import", scelto.nome, async () => {
        await archivio().scriviTutto(esito.backup.dati, "sostituisci");
      });
      return;
    }
    setDaConfermare({
      confronto,
      dati: esito.backup.dati,
      avvisi: esito.avvisi,
      nomeFile: scelto.nome,
    });
  }

  async function confermaImport() {
    if (!daConfermare) return;
    const { dati: entranti, avvisi: nuoviAvvisi, nomeFile } = daConfermare;
    setDaConfermare(null);
    setAvvisi(nuoviAvvisi);
    await conIstantanea("Backup importato", "import", nomeFile, async () => {
      await archivio().scriviTutto(entranti, "sostituisci");
    });
  }

  async function ripristina() {
    setInCorso(true);
    try {
      if (await ripristinaIstantanea()) toast.conferma("Archivio ripristinato");
      setAvvisi([]);
    } finally {
      setInCorso(false);
      rileggiIstantanea();
    }
  }

  async function scarta() {
    await scartaIstantanea();
    rileggiIstantanea();
    toast.conferma("Copia di sicurezza eliminata");
  }

  async function svuota() {
    await conIstantanea("Archivio svuotato", "svuota", undefined, async () => {
      await archivio().svuota();
      setAvvisi([]);
    });
  }

  return (
    <Guscio
      titolo="Dati e backup"
      descrizione="Tutto vive nel tuo browser: non esiste un server a cui questi dati possano arrivare"
      azioni={
        <>
          {/* Senza `scrive`, e apposta: l'esportazione funziona anche a licenza
              scaduta. È il punto in cui si vede che i dati sono dell'utente. */}
          <Button variante="contorno" onClick={esporta} disabled={inCorso || vuoto}>
            <Download className="size-4" aria-hidden />
            Esporta
          </Button>
          <Button scrive variante="contorno" onClick={importa} disabled={inCorso}>
            <Upload className="size-4" aria-hidden />
            Importa
          </Button>
          {/* Il CSV è un flusso a quattro passi: vive in una schermata sua. */}
          <Button variante="contorno" asChild>
            <Link href="/importa">Da CSV</Link>
          </Button>
        </>
      }
    >
      <div className="mx-auto max-w-5xl">
      {/*
        La rete sotto l'ultima sostituzione. Non è un toast e non scade: di un
        archivio sostituito per sbaglio ci si accorge riaprendo l'app, e la
        strada per tornare indietro deve essere ancora lì quando ci si torna.
      */}
      {istantanea && (
        <Card className="border border-accento/25 bg-accento-tenue">
          <CardCorpo className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-64 flex-1">
              <p className="text-etichetta font-semibold text-accento">
                {istantanea.causa === "import"
                  ? "L'archivio di prima è ancora qui"
                  : istantanea.causa === "demo"
                    ? "L'archivio che c'era prima del dataset dimostrativo è ancora qui"
                    : "L'archivio svuotato è ancora recuperabile"}
              </p>
              <p className="mt-1 text-etichetta text-inchiostro-tenue">
                {interoIt.format(documentiDi(istantanea))} righe, salvate il{" "}
                {dataEstesa(istantanea.creataIl.slice(0, 10))}
                {istantanea.dettaglio ? ` prima di importare «${istantanea.dettaglio}»` : ""}.{" "}
                {istantanea.causa === "svuota"
                  ? "Finché la copia è qui, l'archivio non è davvero sparito da questo dispositivo: se l'hai svuotato per farlo sparire, eliminala."
                  : "Resta finché non la elimini: non scade e sopravvive alla chiusura del browser."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Senza `scrive`, e apposta, come l'export: rimettere i propri
                  dati dove stavano non è inserirne di nuovi, e a licenza
                  scaduta deve restare possibile — altrimenti si esporta
                  l'archivio sbagliato con quello giusto a un pulsante spento
                  di distanza. */}
              <Button variante="contorno" taglia="sm" onClick={ripristina} disabled={inCorso}>
                <RotateCcw className="size-3.5" aria-hidden />
                Ripristina
              </Button>
              <Button variante="quieto" taglia="sm" onClick={scarta} disabled={inCorso}>
                Elimina la copia
              </Button>
            </div>
          </CardCorpo>
        </Card>
      )}

      {errori.length > 0 && (
        <Card className="border border-negativo/25 bg-negativo-tenue">
          <CardCorpo>
            <p className="text-etichetta font-medium text-[#C13237]">
              {errori.length === 1 ? "Il file non è valido" : `Il file ha ${errori.length} problemi`}
            </p>
            <ul className="mt-2 space-y-1">
              {errori.slice(0, 8).map((e) => (
                <li key={e} className="text-etichetta text-[#C13237]">{e}</li>
              ))}
              {errori.length > 8 && (
                <li className="text-etichetta text-[#C13237]">
                  …e altri {errori.length - 8}.
                </li>
              )}
            </ul>
            {/*
              Il rifiuto è in blocco di proposito: un archivio che sembra
              completo e non lo è produce calcoli fiscali sbagliati in silenzio,
              che è peggio di un file respinto. Ma respinto non vuol dire perso,
              e chi arriva qui ha appena cambiato computer: va detto che il file
              si aggiusta e come.
            */}
            {recuperabile && (
              <p className="mt-3 text-etichetta text-[#C13237]">
                <span className="font-medium">Il file non è perso.</span> È un backup vero, con
                dei guasti in righe precise: aprilo con un editor di testo, cerca le righe
                indicate qui sopra — sono nell&apos;ordine in cui stanno nel file, dentro la
                collezione che porta quel nome — correggile o cancellale, e riprova a
                importarlo. Un backup con qualche riga in meno vale molto più di nessun backup.
              </p>
            )}
          </CardCorpo>
        </Card>
      )}

      {avvisi.length > 0 && (
        <Card className="mt-6 border border-attenzione/25 bg-attenzione-tenue">
          <CardCorpo>
            <p className="text-etichetta font-medium text-[#B8791A]">Importato con riserva</p>
            <ul className="mt-2 space-y-1">
              {avvisi.map((a) => (
                <li key={a} className="text-etichetta text-[#B8791A]">{a}</li>
              ))}
            </ul>
          </CardCorpo>
        </Card>
      )}

      {dati === undefined ? (
        <Card className="mt-6">
          <CardCorpo>
            <p className="text-corpo text-inchiostro-tenue">Lettura dell&apos;archivio…</p>
          </CardCorpo>
        </Card>
      ) : vuoto ? (
        <Card className="mt-6">
          <Vuoto
            icona={Database}
            titolo="L'archivio è vuoto. Carica il dataset dimostrativo per vedere l'app piena, oppure importa un backup."
            azione={
              <div className="flex flex-wrap justify-center gap-2">
                <Button scrive onClick={caricaDemo} disabled={inCorso}>
                  <Sparkles className="size-4" aria-hidden />
                  Carica il dataset dimostrativo
                </Button>
                <Button scrive variante="contorno" onClick={importa} disabled={inCorso}>
                  Importa un backup
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <>
          {calcolo && (
            <section className="mt-6">
              <div className="mb-3">
                <h2 className="font-display text-kpi-sm font-semibold">
                  Cosa dicono questi dati
                </h2>
                <p className="text-etichetta text-inchiostro-tenue">
                  Calcolato dal vivo sull&apos;anno {ANNO_DEMO}: nessuno di questi numeri è
                  salvato nell&apos;archivio.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi
                  sfondo="indaco"
                  etichetta="Incassato"
                  valore={euro(calcolo.prospetto.ricaviRilevanti)}
                  nota={`su ${euro(calcolo.prospetto.fatturatoEmesso)} emessi`}
                />
                <Kpi
                  sfondo="ambra"
                  etichetta="Da incassare"
                  valore={euro(calcolo.prospetto.soglia.inSospeso)}
                  nota="credito verso clienti"
                />
                <Kpi
                  etichetta="Carico totale"
                  valore={euro(calcolo.prospetto.caricoTotale)}
                  nota="imposte più contributi"
                />
                <Kpi
                  sfondo="scuro"
                  etichetta="Pressione effettiva"
                  valore={percentuale(calcolo.prospetto.pressione)}
                  nota="su ogni euro incassato"
                />
              </div>
            </section>
          )}

          <section className="mt-8">
            <Card>
              <CardCorpo className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <CardTitolo>Contenuto dell&apos;archivio</CardTitolo>
                    <CardSottotitolo>
                      {COLLEZIONI.reduce((a, c) => a + dati[c].length, 0)} entità in{" "}
                      {COLLEZIONI.length} collezioni
                    </CardSottotitolo>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button scrive variante="contorno" taglia="sm" onClick={caricaDemo} disabled={inCorso}>
                      Ricarica il dataset dimostrativo
                    </Button>
                    <Button scrive variante="pericolo" taglia="sm" onClick={svuota} disabled={inCorso}>
                      <Trash2 className="size-4" aria-hidden />
                      Svuota
                    </Button>
                  </div>
                </div>
              </CardCorpo>
              <ContenitoreTabella data-scroll-ok className="px-2 pb-2">
                <Tabella>
                  <TabellaTesta>
                    <tr>
                      <TabellaIntestazione>Collezione</TabellaIntestazione>
                      <TabellaIntestazione numerica>Entità</TabellaIntestazione>
                      <TabellaIntestazione>Stato</TabellaIntestazione>
                    </tr>
                  </TabellaTesta>
                  <TabellaCorpo>
                    {COLLEZIONI.map((collezione) => (
                      <TabellaRiga key={collezione}>
                        <TabellaCella>{ETICHETTE[collezione]}</TabellaCella>
                        <TabellaCella numerica>{dati[collezione].length}</TabellaCella>
                        <TabellaCella>
                          {dati[collezione].length > 0 ? (
                            <Stato tono="positivo">Popolata</Stato>
                          ) : (
                            <Stato tono="neutro">Vuota</Stato>
                          )}
                        </TabellaCella>
                      </TabellaRiga>
                    ))}
                  </TabellaCorpo>
                </Tabella>
              </ContenitoreTabella>
            </Card>
          </section>

          <section className="mt-8">
            <Card>
              <CardCorpo>
                <CardTitolo>Il file di backup</CardTitolo>
                <CardSottotitolo>
                  JSON leggibile, con marcatore di formato e versione dello schema.
                </CardSottotitolo>
                <CardInterna className="mt-4 p-4">
                  <Etichetta>Anteprima della testata</Etichetta>
                  <pre className="mt-2 overflow-x-auto text-micro text-inchiostro-tenue">
{`{
  "formato": "flowlance",
  "versioneSchema": 1,
  "esportatoIl": "${new Date().toISOString()}",
  "dati": { … }
}`}
                  </pre>
                </CardInterna>
                <p className="mt-4 text-etichetta text-inchiostro-tenue">
                  In lettura il file viene convalidato riga per riga: una data nel formato
                  sbagliato o un importo non numerico fermano l&apos;import e vengono elencati,
                  invece di lasciare l&apos;archivio a metà. I campi calcolati che si trovassero
                  nel file vengono scartati: nell&apos;archivio non entra nulla che si possa
                  ricalcolare.
                </p>
              </CardCorpo>
            </Card>
          </section>
        </>
      )}
      </div>

      <DialogoConfermaImport
        confronto={daConfermare?.confronto ?? null}
        nomeFile={daConfermare?.nomeFile ?? ""}
        inCorso={inCorso}
        onEsporta={esporta}
        onConferma={confermaImport}
        onAnnulla={() => setDaConfermare(null)}
      />
    </Guscio>
  );
}

