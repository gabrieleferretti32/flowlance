"use client";

import * as React from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import {
  ElencoSchede,
  Scheda,
  SchedaTesta,
  SchedaTotale,
  SchedaVoci,
} from "@/components/tabella/schede";
import { Kpi } from "@/components/ui/kpi";
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
import { CellaModificabile } from "@/components/tabella/cella-modificabile";
import { Guscio } from "@/components/guscio/guscio";
import { portafoglioClienti, scadutoPerFascia, giorniMediIncasso } from "@/lib/analisi/dashboard";
import { salvaCliente } from "@/lib/dati/azioni";
import { useCalcoloAnno, useDati } from "@/lib/dati/hooks";
import { CANALI_ACQUISIZIONE } from "@/lib/dati/categorie";
import { usePreferenze } from "@/lib/stato/preferenze";
import { useRichiesta } from "@/lib/stato/comandi";
import { toast } from "@/components/ui/toast";
import { coloreDaNome, euro, iniziali, num, percentuale } from "@/lib/format";
import { cn } from "@/lib/utils";

const SOGLIA_ESPOSIZIONE = 0.4;

export function SchermataClienti() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const dati = useDati();
  const calcolo = useCalcoloAnno(anno, oggi);

  const analisi = React.useMemo(() => {
    if (!dati || !calcolo) return null;
    const fatture = calcolo.prospetto.fattureCalcolate;
    return {
      portafoglio: portafoglioClienti(fatture, dati.clienti, anno, coloreDaNome),
      fasce: scadutoPerFascia(fatture),
      giorniMedi: giorniMediIncasso(fatture),
    };
  }, [dati, calcolo, anno]);

  // «Apri cliente» dalla palette: qui non c'è una scheda per cliente da aprire,
  // c'è una riga in un portafoglio. Portarcela sotto gli occhi ed evidenziarla
  // è quello che la voce promette; l'evidenza si spegne da sola, perché una
  // riga colorata che resta tale diventa un'informazione falsa.
  const [evidenziato, setEvidenziato] = React.useState<string | null>(null);
  useRichiesta(
    "cercaClienti",
    (r) => {
      const trovato = dati?.clienti.find((c) => c.nome === r.testo);
      if (!trovato) return;
      setEvidenziato(trovato.id);
      // Dopo il render: la riga potrebbe non essere ancora nel DOM.
      requestAnimationFrame(() => {
        const riga = document.querySelector(`[data-cliente="${trovato.id}"]`);
        // Il portafoglio è quello dell'anno scelto in testa: un cliente senza
        // fatture nell'anno scelto qui non c'è. Meglio dirlo che scorrere a vuoto.
        if (!riga) {
          toast.avviso(`${trovato.nome} non ha fatture nel ${anno}`);
          return;
        }
        riga.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    },
    // Finché Dexie non ha risposto il cliente non si può trovare: la richiesta
    // aspetta invece di essere consumata a vuoto.
    Boolean(dati),
  );

  React.useEffect(() => {
    if (!evidenziato) return;
    const t = window.setTimeout(() => setEvidenziato(null), 4000);
    return () => window.clearTimeout(t);
  }, [evidenziato]);

  if (!dati || !calcolo || !analisi) {
    return (
      <Guscio titolo="Clienti">
        <Card>
          <CaricamentoTabella righe={6} />
        </Card>
      </Guscio>
    );
  }

  const { portafoglio, fasce, giorniMedi } = analisi;
  const totaleEmesso = portafoglio.reduce((a, r) => a + r.emesso, 0);
  const daIncassare = portafoglio.reduce((a, r) => a + r.daIncassare, 0);
  const primo = portafoglio[0];
  const esposto = primo && primo.quota > SOGLIA_ESPOSIZIONE;
  const ticketMedio =
    portafoglio.reduce((a, r) => a + r.numeroFatture, 0) > 0
      ? totaleEmesso / portafoglio.reduce((a, r) => a + r.numeroFatture, 0)
      : 0;

  return (
    <Guscio titolo="Clienti" descrizione={`Portafoglio ${anno} · concentrazione, credito e ritardi`}>
      <div className="space-y-4">
        <section aria-label="Sintesi" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            etichetta="Clienti attivi"
            valore={num(portafoglio.length)}
            taglia="kpiSm"
            nota="con almeno una fattura nell'anno"
          />
          <Kpi etichetta="Ticket medio" valore={euro(ticketMedio)} taglia="kpiSm" nota="per fattura emessa" />
          <Kpi
            etichetta="Giorni medi di incasso"
            valore={giorniMedi === null ? "—" : num(giorniMedi)}
            taglia="kpiSm"
            nota="dalla fattura all'accredito"
          />
          <Kpi
            sfondo={esposto ? "scuro" : "chiaro"}
            etichetta="Concentrazione del primo cliente"
            valore={percentuale(primo?.quota ?? 0, 0)}
            taglia="kpiSm"
            nota={esposto ? "sopra il 40% sei esposto" : "portafoglio distribuito"}
          />
        </section>

        {portafoglio.length === 0 ? (
          <Card>
            <Vuoto
              icona={Users}
              titolo="I clienti nascono dalle fatture: registra la prima per vedere il tuo portafoglio."
            />
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <CardCorpo className="pb-2">
                <CardTitolo>Credito scaduto per fascia di ritardo</CardTitolo>
                <CardSottotitolo>
                  Più il credito scivola a destra, meno probabile è che rientri da solo.
                </CardSottotitolo>
              </CardCorpo>
              <div className="grid gap-px bg-bordo sm:grid-cols-5">
                <Fascia etichetta="Nei termini" valore={fasce.neiTermini} tono="neutro" />
                <Fascia etichetta="1-30 giorni" valore={fasce.entro30} tono="attenzione" />
                <Fascia etichetta="31-60 giorni" valore={fasce.entro60} tono="attenzione" />
                <Fascia etichetta="61-90 giorni" valore={fasce.entro90} tono="negativo" />
                <Fascia etichetta="Oltre 90 giorni" valore={fasce.oltre90} tono="negativo" />
              </div>
            </Card>

            <Card className="overflow-hidden">
              <CardCorpo className="pb-2">
                <CardTitolo>Dettaglio per cliente</CardTitolo>
                <CardSottotitolo>
                  Canale di acquisizione e note sono tuoi da compilare: servono a capire da
                  dove arriva il lavoro che vale.
                </CardSottotitolo>
              </CardCorpo>
              {/* Da tablet in su: la tabella, dieci colonne che si confrontano. */}
              <ContenitoreTabella
                data-scroll-ok
                classeGuscio="hidden md:block"
                className="max-h-[calc(100dvh-22rem)] px-2 pb-2"
              >
                <Tabella>
                  <TabellaTesta>
                    <tr>
                      <TabellaIntestazione>Cliente</TabellaIntestazione>
                      <TabellaIntestazione numerica>Emesso</TabellaIntestazione>
                      <TabellaIntestazione numerica>Incassato</TabellaIntestazione>
                      <TabellaIntestazione numerica>Da incassare</TabellaIntestazione>
                      <TabellaIntestazione numerica>Scaduto</TabellaIntestazione>
                      <TabellaIntestazione numerica>Fatture</TabellaIntestazione>
                      <TabellaIntestazione numerica className="whitespace-nowrap">
                        Giorni medi
                      </TabellaIntestazione>
                      <TabellaIntestazione numerica>Quota</TabellaIntestazione>
                      <TabellaIntestazione className="min-w-44">Canale</TabellaIntestazione>
                      <TabellaIntestazione className="min-w-52">Note</TabellaIntestazione>
                    </tr>
                  </TabellaTesta>
                  <TabellaCorpo>
                    {portafoglio.map((r) => {
                      const cliente = dati.clienti.find((c) => c.id === r.id);
                      return (
                        <TabellaRiga
                          key={r.id}
                          data-cliente={r.id}
                          className={evidenziato === r.id ? "bg-accento-tenue" : undefined}
                        >
                          <TabellaCella className="min-w-44">
                            <span className="flex items-center gap-2">
                              <span
                                aria-hidden
                                className="flex size-6 shrink-0 items-center justify-center rounded-full text-micro font-semibold text-white"
                                style={{ backgroundColor: r.colore }}
                              >
                                {iniziali(r.nome)}
                              </span>
                              <span className="truncate">{r.nome}</span>
                            </span>
                          </TabellaCella>
                          <TabellaCella numerica className="font-medium">{euro(r.emesso)}</TabellaCella>
                          <TabellaCella numerica>{euro(r.incassato)}</TabellaCella>
                          <TabellaCella numerica>{euro(r.daIncassare)}</TabellaCella>
                          <TabellaCella
                            numerica
                            className={r.scaduto > 0 ? "font-medium text-negativo" : "text-inchiostro-tenue"}
                          >
                            {euro(r.scaduto)}
                          </TabellaCella>
                          <TabellaCella numerica>{num(r.numeroFatture)}</TabellaCella>
                          <TabellaCella numerica>
                            {r.giorniMediIncasso === null ? "—" : num(r.giorniMediIncasso)}
                          </TabellaCella>
                          <TabellaCella
                            numerica
                            className={r.quota > SOGLIA_ESPOSIZIONE ? "font-medium text-attenzione" : undefined}
                          >
                            {percentuale(r.quota, 0)}
                          </TabellaCella>
                          <TabellaCella className="p-1">
                            {cliente && (
                              <CellaModificabile
                                tipo="scelta"
                                etichetta={`Canale di acquisizione di ${r.nome}`}
                                valore={cliente.canaleAcquisizione || "Altro"}
                                opzioni={CANALI_ACQUISIZIONE.map((c) => ({ valore: c, etichetta: c }))}
                                onSalva={(v) =>
                                  void salvaCliente({ ...cliente, canaleAcquisizione: String(v) })
                                }
                              />
                            )}
                          </TabellaCella>
                          <TabellaCella className="max-w-64 p-1 align-top">
                            {cliente && (
                              <CellaModificabile
                                tipo="testo"
                                etichetta={`Note su ${r.nome}`}
                                valore={cliente.note}
                                vuoto="Aggiungi una nota"
                                suggerimento={cliente.note || undefined}
                                className="line-clamp-2"
                                onSalva={(v) =>
                                  void salvaCliente({ ...cliente, note: String(v ?? "") })
                                }
                              />
                            )}
                          </TabellaCella>
                        </TabellaRiga>
                      );
                    })}
                  </TabellaCorpo>
                  <TabellaPiede>
                    <tr>
                      <TabellaCella>Totale</TabellaCella>
                      <TabellaCella numerica>{euro(totaleEmesso)}</TabellaCella>
                      <TabellaCella numerica>
                        {euro(portafoglio.reduce((a, r) => a + r.incassato, 0))}
                      </TabellaCella>
                      <TabellaCella numerica>{euro(daIncassare)}</TabellaCella>
                      <TabellaCella numerica>
                        {euro(portafoglio.reduce((a, r) => a + r.scaduto, 0))}
                      </TabellaCella>
                      <TabellaCella numerica>
                        {num(portafoglio.reduce((a, r) => a + r.numeroFatture, 0))}
                      </TabellaCella>
                      <TabellaCella colSpan={4} />
                    </tr>
                  </TabellaPiede>
                </Tabella>
              </ContenitoreTabella>

              {/* Sul telefono ogni cliente è una scheda: il nome e l'emesso in
                  testa, il resto come coppie. Canale e note restano modificabili. */}
              <ElencoSchede>
                {portafoglio.map((r) => {
                  const cliente = dati.clienti.find((c) => c.id === r.id);
                  return (
                    <Scheda
                      key={r.id}
                      data-cliente={r.id}
                      className={evidenziato === r.id ? "bg-accento-tenue" : undefined}
                    >
                      <SchedaTesta
                        titolo={
                          <span className="flex items-center gap-2">
                            <span
                              aria-hidden
                              className="flex size-6 shrink-0 items-center justify-center rounded-full text-micro font-semibold text-white"
                              style={{ backgroundColor: r.colore }}
                            >
                              {iniziali(r.nome)}
                            </span>
                            <span className="truncate">{r.nome}</span>
                          </span>
                        }
                        valore={euro(r.emesso)}
                        notaValore={`${percentuale(r.quota, 0)} del portafoglio`}
                      />
                      <SchedaVoci
                        voci={[
                          { etichetta: "Incassato", valore: euro(r.incassato) },
                          { etichetta: "Da incassare", valore: euro(r.daIncassare) },
                          {
                            etichetta: "Scaduto",
                            valore: (
                              <span className={r.scaduto > 0 ? "text-negativo" : undefined}>
                                {euro(r.scaduto)}
                              </span>
                            ),
                            mostra: r.scaduto > 0,
                          },
                          { etichetta: "Fatture", valore: num(r.numeroFatture) },
                          {
                            etichetta: "Giorni medi",
                            valore: r.giorniMediIncasso === null ? "—" : num(r.giorniMediIncasso),
                          },
                        ]}
                      />
                      {cliente && (
                        <div className="mt-3 space-y-1.5">
                          <CellaModificabile
                            tipo="scelta"
                            etichetta={`Canale di acquisizione di ${r.nome}`}
                            valore={cliente.canaleAcquisizione || "Altro"}
                            opzioni={CANALI_ACQUISIZIONE.map((c) => ({ valore: c, etichetta: c }))}
                            onSalva={(v) =>
                              void salvaCliente({ ...cliente, canaleAcquisizione: String(v) })
                            }
                          />
                          <CellaModificabile
                            tipo="testo"
                            etichetta={`Note su ${r.nome}`}
                            valore={cliente.note}
                            vuoto="Aggiungi una nota"
                            onSalva={(v) =>
                              void salvaCliente({ ...cliente, note: String(v ?? "") })
                            }
                          />
                        </div>
                      )}
                    </Scheda>
                  );
                })}
                <SchedaTotale
                  etichetta={`${num(portafoglio.length)} clienti`}
                  valore={euro(totaleEmesso)}
                  nota={`${euro(daIncassare)} da incassare`}
                />
              </ElencoSchede>
            </Card>

            <Card>
              <CardCorpo className="py-4">
                <p className="text-etichetta text-inchiostro-tenue">
                  La concentrazione è il rischio numero uno di chi lavora da solo: se un
                  cliente supera il 40% del fatturato, una sua disdetta ti dimezza l&apos;anno.
                  Il canale di acquisizione serve a decidere dove investire tempo
                  commerciale.{" "}
                  {/* Il padding verticale non muove la riga di testo ma allarga
                      l'area toccabile: su un collegamento dentro una frase è
                      tutto quello che si può fare senza spezzarla. */}
                  <Link
                    href="/fatture"
                    className="py-1.5 text-accento underline underline-offset-2"
                  >
                    Il registro fatture
                  </Link>{" "}
                  ha il dettaglio documento per documento.
                </p>
              </CardCorpo>
            </Card>
          </>
        )}
      </div>
    </Guscio>
  );
}

function Fascia({
  etichetta,
  valore,
  tono,
}: {
  etichetta: string;
  valore: number;
  tono: "neutro" | "attenzione" | "negativo";
}) {
  const vuota = valore === 0;
  return (
    <div className="bg-superficie px-4 py-4">
      <p className="text-micro text-inchiostro-tenue">{etichetta}</p>
      <p
        className={cn(
          "cifre mt-1 text-kpi-sm font-semibold",
          vuota
            ? "text-inchiostro-tenue"
            : tono === "negativo"
              ? "text-negativo"
              : tono === "attenzione"
                ? "text-attenzione"
                : "text-inchiostro",
        )}
      >
        {euro(valore)}
      </p>
    </div>
  );
}
