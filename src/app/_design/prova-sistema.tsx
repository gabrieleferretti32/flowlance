"use client";

import * as React from "react";
import { FileText, Receipt, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardCorpo, CardInterna, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { Chip, ChipVariazione } from "@/components/ui/chip";
import { Cifra, Etichetta } from "@/components/ui/etichetta";
import { Campo, Input } from "@/components/ui/input";
import { Kpi } from "@/components/ui/kpi";
import { Segmenti } from "@/components/ui/segmenti";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Stato } from "@/components/ui/stato";
import { Switch } from "@/components/ui/switch";
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
import { toast } from "@/components/ui/toast";
import { Vuoto } from "@/components/ui/vuoto";
import { SemaforoFiscale, segmentiSemaforo } from "@/components/fisco/semaforo-fiscale";
import { calcolaProspetto } from "@/lib/fisco/motore";
import { calcolaIva } from "@/lib/fisco/iva";
import { PARAMETRI_2026 } from "@/lib/fisco/parametri/2026";
import {
  COSTI_FIXTURE,
  FATTURE_FIXTURE,
  OGGI_FIXTURE,
  impostazioniForfettario,
  impostazioniOrdinario,
} from "@/lib/fisco/fixture";
import { data, euro, percentuale } from "@/lib/format";
import type { Regime } from "@/lib/fisco/tipi";

export function ProvaSistema() {
  const [regime, setRegime] = React.useState<Regime>("forfettario");

  // Il toggle di regime ricalcola tutto: è il motore, non una finzione visiva.
  const { prospetto, iva, impostazioni } = React.useMemo(() => {
    const impostazioni =
      regime === "forfettario" ? impostazioniForfettario() : impostazioniOrdinario();
    const p = calcolaProspetto({
      impostazioni,
      parametri: PARAMETRI_2026,
      fatture: FATTURE_FIXTURE,
      costi: COSTI_FIXTURE,
      oggi: OGGI_FIXTURE,
    });
    return {
      prospetto: p,
      impostazioni,
      iva: calcolaIva(p.fattureCalcolate, p.costiCalcolati, impostazioni, PARAMETRI_2026),
    };
  }, [regime]);


  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-etichetta text-inchiostro-tenue">Flowlance</p>
          <h1 className="mt-1 font-display text-kpi font-semibold tracking-tight">
            Sistema visivo
          </h1>
          <p className="mt-1 max-w-xl text-corpo text-inchiostro-tenue">
            Token, tipografia e componenti di base. Il toggle di regime ricalcola con il
            motore fiscale reale, sui numeri dei due casi di prova.
          </p>
        </div>
        <Segmenti
          etichettaGruppo="Regime fiscale"
          valore={regime}
          onChange={setRegime}
          opzioni={[
            { valore: "forfettario", etichetta: "Forfettario" },
            { valore: "ordinario", etichetta: "Ordinario" },
          ]}
        />
      </header>

      <Sezione titolo="L'elemento firma" nota="Il semaforo fiscale, alimentato dal motore.">
        <SemaforoFiscale
          totale={prospetto.incassatoLordo}
          segmenti={segmentiSemaforo(prospetto, impostazioni, PARAMETRI_2026, iva)}
        />
      </Sezione>

      <Sezione
        titolo="Tessere KPI"
        nota="Due gradienti soltanto, sulle card di testa. Una sola card scura per schermata."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi
            sfondo="indaco"
            etichetta="Incassato"
            valore={euro(prospetto.ricaviRilevanti)}
            nota="entrato davvero in cassa"
            chip={<ChipVariazione valore={0.184} chiaro />}
          />
          <Kpi
            sfondo="ambra"
            etichetta="Da incassare"
            valore={euro(2502)}
            nota="credito verso clienti"
            chip={<ChipVariazione valore={-0.062} chiaro />}
          />
          <Kpi
            etichetta="Carico totale"
            valore={euro(prospetto.caricoTotale)}
            nota="imposte più contributi"
          />
          <Kpi
            sfondo="scuro"
            etichetta="Pressione effettiva"
            valore={percentuale(prospetto.pressione)}
            nota="su ogni euro incassato"
          />
        </div>
      </Sezione>

      <Sezione titolo="Scala tipografica" nota="Sentence case, mai maiuscoletto spaziato.">
        <Card>
          <CardCorpo className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-3">
              {[
                ["40 · semaforo fiscale", "semaforo"],
                ["28 · KPI principali", "kpi"],
                ["20 · KPI secondari", "kpiSm"],
              ].map(([nome, taglia]) => (
                <div key={nome}>
                  <Etichetta>{nome}</Etichetta>
                  <Cifra taglia={taglia as "semaforo"}>{euro(4306.56)}</Cifra>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div>
                <Etichetta>15 · testo corrente</Etichetta>
                <p className="text-corpo">
                  In regime forfettario i costi non sono deducibili analiticamente: il
                  reddito si determina applicando il coefficiente ATECO ai compensi.
                </p>
              </div>
              <div>
                <Etichetta>13 · etichette</Etichetta>
                <p className="text-etichetta text-inchiostro-tenue">Reddito imponibile</p>
              </div>
              <div>
                <Etichetta>11 · micro-label</Etichetta>
                <p className="text-micro text-inchiostro-tenue">prima delle spese personali</p>
              </div>
              <CardInterna className="p-3">
                <Etichetta>Cifre tabellari: le colonne si incolonnano</Etichetta>
                <div className="cifre mt-1 space-y-0.5 text-right text-corpo tabular-nums">
                  <p>{euro(1111.11)}</p>
                  <p>{euro(88_888.88)}</p>
                  <p>{euro(4306.56)}</p>
                </div>
              </CardInterna>
            </div>
          </CardCorpo>
        </Card>
      </Sezione>

      <Sezione titolo="Colore, forma e ombra" nota="Tre raggi per la gerarchia, due soli livelli di ombra.">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardCorpo>
              <CardTitolo>Tavolozza</CardTitolo>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  ["Fondo pagina", "#F2F4F9"],
                  ["Superficie", "#FFFFFF"],
                  ["Superficie alt", "#F7F9FC"],
                  ["Inchiostro", "#0E1330"],
                  ["Inchiostro tenue", "#6B7392"],
                  ["Bordo", "#E4E8F0"],
                  ["Accento", "#4C5BF5"],
                  ["Positivo", "#10B981"],
                  ["Attenzione", "#F5A524"],
                  ["Negativo", "#E5484D"],
                ].map(([nome, hex]) => (
                  <div key={hex} className="flex items-center gap-2">
                    <span
                      className="size-7 shrink-0 rounded-[8px] border border-bordo"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-micro">{nome}</span>
                      <span className="cifre block text-micro text-inchiostro-tenue">{hex}</span>
                    </span>
                  </div>
                ))}
              </div>
            </CardCorpo>
          </Card>

          <Card>
            <CardCorpo>
              <CardTitolo>Raggi</CardTitolo>
              <CardSottotitolo>Differenziati, non uno solo su tutto.</CardSottotitolo>
              <div className="mt-4 space-y-3">
                {[
                  ["24 · card contenitore", "rounded-card"],
                  ["16 · card interna", "rounded-interna"],
                  ["10 · input e bottoni", "rounded-campo"],
                  ["pillola · chip e tab", "rounded-full"],
                ].map(([nome, classe]) => (
                  <div key={nome} className="flex items-center gap-3">
                    <span className={`h-9 w-16 shrink-0 bg-superficie-alt ${classe}`} />
                    <span className="text-etichetta text-inchiostro-tenue">{nome}</span>
                  </div>
                ))}
              </div>
            </CardCorpo>
          </Card>

          <Card>
            <CardCorpo>
              <CardTitolo>Ombre</CardTitolo>
              <CardSottotitolo>
                Il sollevamento è riservato a ciò che si può cliccare.
              </CardSottotitolo>
              <div className="mt-4 space-y-4">
                <div className="rounded-interna bg-superficie p-4 shadow-riposo">
                  <p className="text-etichetta">A riposo</p>
                  <p className="text-micro text-inchiostro-tenue">card informative, ferme</p>
                </div>
                <div className="rounded-interna bg-superficie p-4 shadow-sollevato">
                  <p className="text-etichetta">Sollevato</p>
                  <p className="text-micro text-inchiostro-tenue">popover, menu, card cliccabili</p>
                </div>
              </div>
            </CardCorpo>
          </Card>
        </div>
      </Sezione>

      <Sezione titolo="Controlli" nota="Focus da tastiera sempre visibile, contrasto AA.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardCorpo className="space-y-5">
              <div>
                <Etichetta className="mb-2">Bottoni</Etichetta>
                <div className="flex flex-wrap gap-2">
                  <Button>Nuova fattura</Button>
                  <Button variante="contorno">Esporta</Button>
                  <Button variante="quieto">Annulla</Button>
                  <Button variante="scuro">Segna come incassata</Button>
                  <Button variante="pericolo" taglia="sm">Elimina</Button>
                  <Button disabled>Non disponibile</Button>
                </div>
              </div>
              <div>
                <Etichetta className="mb-2">Chip e stati</Etichetta>
                <div className="flex flex-wrap items-center gap-2">
                  <ChipVariazione valore={0.124} />
                  <ChipVariazione valore={-0.043} />
                  <ChipVariazione valore={0.089} invertito />
                  <Chip tono="accento">Ricorrente</Chip>
                  <Stato tono="positivo">Incassato</Stato>
                  <Stato tono="attenzione">Da incassare</Stato>
                  <Stato tono="negativo">Scaduto</Stato>
                </div>
              </div>
              <div>
                <Etichetta className="mb-2">Notifiche con annulla</Etichetta>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variante="contorno"
                    taglia="sm"
                    onClick={() =>
                      toast.conferma("Fattura 2026/003 segnata come incassata", () => {
                        toast.avviso("Modifica annullata");
                      })
                    }
                  >
                    Conferma con annulla
                  </Button>
                  <Button
                    variante="contorno"
                    taglia="sm"
                    onClick={() => toast.avviso("Sei oltre l'85% del limite forfettario")}
                  >
                    Avviso
                  </Button>
                </div>
              </div>
            </CardCorpo>
          </Card>

          <Card>
            <CardCorpo className="grid gap-4 sm:grid-cols-2">
              <Campo etichetta="Imponibile" aiuto="Senza IVA, rivalsa e bollo" htmlFor="imponibile">
                <Input id="imponibile" numerico defaultValue="3.000,00" />
              </Campo>
              <Campo etichetta="Numero fattura" htmlFor="numero">
                <Input id="numero" defaultValue="2026/004" />
              </Campo>
              <Campo etichetta="Tipo di ricavo" htmlFor="tipo">
                <Select defaultValue="ricorrente">
                  <SelectTrigger id="tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ricorrente">Ricorrente</SelectItem>
                    <SelectItem value="progetto">Progetto</SelectItem>
                    <SelectItem value="unaTantum">Una tantum</SelectItem>
                  </SelectContent>
                </Select>
              </Campo>
              <Campo etichetta="Cliente" htmlFor="cliente">
                <Input id="cliente" placeholder="Cerca o crea…" />
              </Campo>
              <div className="flex items-center justify-between gap-3 sm:col-span-2">
                <div>
                  <p className="text-etichetta font-medium">Bollo addebitato al cliente</p>
                  <p className="text-micro text-inchiostro-tenue">
                    Se disattivato, i 2 € restano un tuo costo.
                  </p>
                </div>
                <Switch defaultChecked aria-label="Bollo addebitato al cliente" />
              </div>
            </CardCorpo>
          </Card>
        </div>
      </Sezione>

      <Sezione titolo="Tabella" nota="Righe alternate, totali fissi, importi incolonnati.">
        <Card className="overflow-hidden">
          <CardCorpo className="pb-0">
            <CardTitolo>Fatture</CardTitolo>
            <CardSottotitolo>
              Gli stessi tre documenti dei casi di prova, calcolati in regime{" "}
              {regime === "forfettario" ? "forfettario" : "ordinario"}.
            </CardSottotitolo>
          </CardCorpo>
          <ContenitoreTabella className="mt-4 max-h-80 px-2 pb-2">
            <Tabella>
              <TabellaTesta>
                <tr>
                  <TabellaIntestazione>Emissione</TabellaIntestazione>
                  <TabellaIntestazione>Numero</TabellaIntestazione>
                  <TabellaIntestazione>Descrizione</TabellaIntestazione>
                  <TabellaIntestazione numerica>Imponibile</TabellaIntestazione>
                  <TabellaIntestazione numerica>IVA</TabellaIntestazione>
                  <TabellaIntestazione numerica>Bollo</TabellaIntestazione>
                  <TabellaIntestazione numerica>Totale</TabellaIntestazione>
                  <TabellaIntestazione>Scadenza</TabellaIntestazione>
                  <TabellaIntestazione>Stato</TabellaIntestazione>
                </tr>
              </TabellaTesta>
              <TabellaCorpo>
                {prospetto.fattureCalcolate.map((f) => (
                  <TabellaRiga key={f.id}>
                    <TabellaCella>{data(f.dataEmissione)}</TabellaCella>
                    <TabellaCella className="cifre">{f.numero}</TabellaCella>
                    <TabellaCella>{f.descrizione}</TabellaCella>
                    <TabellaCella numerica>{euro(f.imponibile)}</TabellaCella>
                    <TabellaCella numerica>{euro(f.iva)}</TabellaCella>
                    <TabellaCella numerica>{euro(f.bollo)}</TabellaCella>
                    <TabellaCella numerica>{euro(f.totale)}</TabellaCella>
                    <TabellaCella>{data(f.scadenza)}</TabellaCella>
                    <TabellaCella>
                      <Stato
                        tono={
                          f.stato === "incassato"
                            ? "positivo"
                            : f.stato === "scaduto"
                              ? "negativo"
                              : "attenzione"
                        }
                      >
                        {f.stato === "incassato"
                          ? "Incassato"
                          : f.stato === "scaduto"
                            ? `Scaduto da ${f.giorniRitardo} giorni`
                            : "Da incassare"}
                      </Stato>
                    </TabellaCella>
                  </TabellaRiga>
                ))}
              </TabellaCorpo>
              <TabellaPiede>
                <tr>
                  <TabellaCella colSpan={3}>Totale</TabellaCella>
                  <TabellaCella numerica>
                    {euro(prospetto.fattureCalcolate.reduce((a, f) => a + f.imponibile, 0))}
                  </TabellaCella>
                  <TabellaCella numerica>
                    {euro(prospetto.fattureCalcolate.reduce((a, f) => a + f.iva, 0))}
                  </TabellaCella>
                  <TabellaCella numerica>
                    {euro(prospetto.fattureCalcolate.reduce((a, f) => a + f.bollo, 0))}
                  </TabellaCella>
                  <TabellaCella numerica>
                    {euro(prospetto.fattureCalcolate.reduce((a, f) => a + f.totale, 0))}
                  </TabellaCella>
                  <TabellaCella colSpan={2} />
                </tr>
              </TabellaPiede>
            </Tabella>
          </ContenitoreTabella>
        </Card>
      </Sezione>

      <Sezione titolo="Stati vuoti" nota="Indicano l'azione, non la mancanza.">
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <Vuoto
              icona={FileText}
              titolo="Registra la prima fattura per vedere il calcolo delle imposte."
              azione={<Button taglia="sm">Nuova fattura</Button>}
            />
          </Card>
          <Card>
            <Vuoto
              icona={Receipt}
              titolo="Nessun costo registrato: aggiungine uno per leggere il margine reale."
              azione={
                <Button taglia="sm" variante="contorno">
                  Nuovo costo
                </Button>
              }
            />
          </Card>
          <Card>
            <Vuoto
              icona={Users}
              titolo="I clienti nascono dalle fatture: qui vedrai concentrazione e scaduto."
            />
          </Card>
        </div>
      </Sezione>

      <p className="mt-10 max-w-2xl text-etichetta text-inchiostro-tenue">
        Strumento gestionale di pianificazione: produce stime, non dichiarazioni. Non
        considera altri redditi che in regime ordinario concorrono al reddito complessivo
        e possono spostare lo scaglione IRPEF.
      </p>
    </main>
  );
}

function Sezione({
  titolo,
  nota,
  children,
}: {
  titolo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-4">
        <h2 className="font-display text-kpi-sm font-semibold">{titolo}</h2>
        {nota && <p className="text-etichetta text-inchiostro-tenue">{nota}</p>}
      </div>
      {children}
    </section>
  );
}
