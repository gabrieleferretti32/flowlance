"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  Info,
  LockOpen,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BloccoScrittura } from "@/components/ui/blocco-scrittura";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CardInterna } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Chip } from "@/components/ui/chip";
import { Etichetta } from "@/components/ui/etichetta";
import { Input } from "@/components/ui/input";
import { Kpi } from "@/components/ui/kpi";
import { Segmenti } from "@/components/ui/segmenti";
import { Guscio } from "@/components/guscio/guscio";
import { AvvisoParametri } from "@/components/fisco/avviso-parametri";
import { cambiaDestinazioneCreditoIva, chiudiAnno, riapriAnno } from "@/lib/dati/azioni";
import { useCalcoloAnno } from "@/lib/dati/hooks";
import { istantaneaDa, type ChiusuraAnno, type Riporto } from "@/lib/fisco/chiusura";
import { usePreferenze } from "@/lib/stato/preferenze";
import { data as fmtData, euro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ROTTE } from "@/lib/rotte";

export function SchermataChiusura() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const calcolo = useCalcoloAnno(anno, oggi);
  const [note, setNote] = React.useState("");

  if (!calcolo) {
    return (
      <Guscio titolo="Chiusura d'anno">
        <Card>
          <CaricamentoTabella righe={5} />
        </Card>
      </Guscio>
    );
  }

  const { riportoInUscita: r, regime, controlli, chiusura, scostamenti } = calcolo;
  // In forfettario non esiste liquidazione IVA: né credito da destinare, né
  // scelta da registrare. La card sparisce invece di mostrare zeri.
  const mostraCreditoIva = calcolo.iva.applicabile;
  const bloccanti = controlli.filter((c) => c.gravita === "blocco");
  const puoChiudere = bloccanti.length === 0;

  async function conferma() {
    if (!calcolo) return;
    const nuova: ChiusuraAnno = {
      anno: calcolo.anno,
      chiusaIl: new Date().toISOString(),
      destinazioneCreditoIva: r.destinazioneCreditoIva,
      regimeAnnoSuccessivo: calcolo.regime.regimeProposto,
      note: note.trim(),
      istantanea: istantaneaDa(calcolo.riportoInUscita, calcolo.prospetto),
    };
    await chiudiAnno(nuova, {
      applicaRegime: calcolo.regime.daProporre
        ? {
            // L'uscita immediata colpisce l'anno in corso, non il successivo.
            anno:
              calcolo.regime.motivo === "uscitaImmediata" ? calcolo.anno : calcolo.anno + 1,
            regime: calcolo.regime.regimeProposto,
          }
        : undefined,
    });
    setNote("");
  }

  return (
    <Guscio
      titolo="Chiusura d'anno"
      descrizione={`${anno} → ${anno + 1} · ${chiusura ? `chiuso il ${fmtData(chiusura.chiusaIl.slice(0, 10))}` : "anno aperto"}`}
    >
      <div className="mx-auto max-w-4xl space-y-4">
        <AvvisoParametri anno={anno} />

        {scostamenti.length > 0 && (
          <Card className="border border-attenzione/25 bg-attenzione-tenue">
            <CardCorpo className="py-4">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#B8791A]" aria-hidden />
                <div className="min-w-0 space-y-2">
                  <p className="text-etichetta font-semibold text-[#B8791A]">
                    Qualcosa è cambiato dopo la chiusura
                  </p>
                  <p className="text-etichetta text-[#B8791A]">
                    I riporti si sono già aggiornati da soli. Riapri l&apos;anno se vuoi
                    ricontrollarlo prima di considerarlo definitivo.
                  </p>
                  <ul className="space-y-1">
                    {scostamenti.map((s) => (
                      <li key={s.voce} className="text-etichetta text-[#B8791A]">
                        <span className="font-medium">{s.voce}</span>: {euro(s.allaChiusura)} →{" "}
                        {euro(s.adesso)}{" "}
                        <span className="cifre">
                          ({s.differenza > 0 ? "+" : ""}
                          {euro(s.differenza)})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardCorpo>
          </Card>
        )}

        <section aria-label="Riporti" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            etichetta="Saldo di cassa"
            valore={euro(r.saldoCassa)}
            nota={`apre il ${anno + 1}`}
            taglia="kpiSm"
          />
          <Kpi
            sfondo="scuro"
            etichetta="Tasse accantonate"
            valore={euro(r.accantonato)}
            nota="impegnate anche a gennaio"
            taglia="kpiSm"
          />
          <Kpi
            etichetta={mostraCreditoIva ? "Credito IVA" : "Da incassare"}
            valore={euro(mostraCreditoIva ? r.creditoIva : r.fattureDaIncassare.importo)}
            nota={
              mostraCreditoIva
                ? r.destinazioneCreditoIva === "compensazione"
                  ? "in compensazione"
                  : "chiesto a rimborso"
                : `${r.fattureDaIncassare.numero} fatture a cavallo d'anno`
            }
            taglia="kpiSm"
          />
          <Kpi
            etichetta="Crediti d'imposta"
            valore={euro(r.creditoImposte)}
            nota={`si scomputano dal saldo ${anno + 1}`}
            taglia="kpiSm"
          />
        </section>

        <Card>
          <CardCorpo>
            <CardTitolo>Cosa passa al {anno + 1}</CardTitolo>
            <CardSottotitolo>
              Nessuno di questi numeri viene salvato: si ricalcolano dai documenti a ogni
              apertura, così una fattura registrata in ritardo si propaga da sola.
            </CardSottotitolo>

            <div className="mt-4 space-y-2">
              <RigaRiporto
                voce="Saldo di cassa al 31 dicembre"
                valore={euro(r.saldoCassa)}
                nota={`diventa il saldo iniziale del ${anno + 1}`}
              />
              <RigaRiporto
                voce="Tasse accantonate e non versate"
                valore={euro(r.accantonato)}
                nota="restano impegnate: servono a pagare il saldo di giugno"
                evidenzia
              />
              <RigaRiporto
                voce="Liquidità davvero disponibile"
                valore={euro(r.saldoCassa - r.accantonato)}
                nota={`è questa la cifra che al 1° gennaio ${anno + 1} è tua`}
              />
              {mostraCreditoIva && (
                <RigaRiporto
                  voce="Credito IVA residuo"
                  valore={euro(r.creditoIva)}
                  nota={
                    r.destinazioneCreditoIva === "compensazione"
                      ? `entra come credito iniziale nella liquidazione ${anno + 1}`
                      : "esce dalla liquidazione: lo chiedi a rimborso"
                  }
                />
              )}
              <RigaRiporto
                voce="Crediti d'imposta"
                valore={euro(r.creditoImposte)}
                nota="ritenute eccedenti, versamenti in eccesso e credito non utilizzato"
              />
              <RigaRiporto
                voce="Fatture emesse e non ancora incassate"
                valore={euro(r.fattureDaIncassare.importo)}
                nota={`${r.fattureDaIncassare.numero} fatture · IVA già di competenza del ${anno}, ricavo nell'anno dell'incasso${
                  r.fattureDaIncassare.numeroAncoraAperti > 0
                    ? ` · ${r.fattureDaIncassare.numeroAncoraAperti} ancora da sollecitare`
                    : ""
                }`}
              />
              <RigaRiporto
                voce="Costi registrati e non ancora pagati"
                valore={euro(r.costiDaPagare.importo)}
                nota={`${r.costiDaPagare.numero} costi · IVA detraibile nel ${anno}, deduzione nell'anno del pagamento`}
              />
              {/* Compare solo quando c'è: una riga a zero su ogni chiusura, per
                  chi non emette note, sarebbe rumore. */}
              {r.noteDaRimborsare.numero > 0 && (
                <RigaRiporto
                  voce="Note di credito emesse e non ancora rimborsate"
                  valore={`− ${euro(r.noteDaRimborsare.importo)}`}
                  nota={`${r.noteDaRimborsare.numero} note · IVA già stornata nel ${anno}, i ricavi caleranno nell'anno del rimborso`}
                />
              )}
              {r.noteNonRiconciliate > 0 && (
                <RigaRiporto
                  voce="Storni non riconciliati a nessuna fattura"
                  valore={euro(r.noteNonRiconciliate)}
                  nota="I conti sono giusti lo stesso, ma a cosa si riferivano è meglio scriverlo prima di chiudere: dopo non lo ricostruisce più nessuno."
                />
              )}
            </div>
          </CardCorpo>
        </Card>

        {mostraCreditoIva && (
        <Card>
          <CardCorpo>
            <CardTitolo>Credito IVA: compensazione o rimborso</CardTitolo>
            <CardSottotitolo>
              La scelta cambia i versamenti del {anno + 1}, quindi resta registrata. In
              compensazione il credito riduce l&apos;IVA da versare; a rimborso esce dalla
              liquidazione e lo si chiede all&apos;Agenzia.
            </CardSottotitolo>
            <div className="mt-4">
              <Segmenti
                etichettaGruppo="Destinazione del credito IVA"
                valore={r.destinazioneCreditoIva}
                onChange={(v) => {
                  if (chiusura) void cambiaDestinazioneCreditoIva(chiusura, v);
                }}
                opzioni={[
                  { valore: "compensazione", etichetta: "Compensazione" },
                  { valore: "rimborso", etichetta: "Rimborso" },
                ]}
              />
              {!chiusura && (
                <p className="mt-2 text-etichetta text-inchiostro-tenue">
                  La scelta si registra chiudendo l&apos;anno. Finché è aperto, il credito si
                  considera in compensazione.
                </p>
              )}
            </div>
          </CardCorpo>
        </Card>
        )}

        <Card scura={regime.daProporre}>
          <CardCorpo>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitolo className={cn(regime.daProporre && "text-white")}>
                  {regime.titolo}
                </CardTitolo>
                <p
                  className={cn(
                    "mt-1.5 text-corpo",
                    regime.daProporre ? "text-white/70" : "text-inchiostro-tenue",
                  )}
                >
                  {regime.spiegazione}
                </p>
              </div>
              {regime.daProporre && (
                <Chip tono="chiaro" className="shrink-0">
                  dal {fmtData(regime.decorrenza)}
                </Chip>
              )}
            </div>

            {regime.conseguenze.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {regime.conseguenze.map((c) => (
                  <li
                    key={c}
                    className={cn(
                      "flex items-start gap-2 text-etichetta",
                      regime.daProporre ? "text-white/70" : "text-inchiostro-tenue",
                    )}
                  >
                    <ArrowRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {c}
                  </li>
                ))}
              </ul>
            )}

            {regime.daProporre && (
              <div className="mt-4">
                <Button variante="contorno" asChild>
                  <Link href={ROTTE.avvio}>Vedi cosa cambia, sui tuoi numeri</Link>
                </Button>
              </div>
            )}

            {regime.daProporre && (
              <p className="mt-4 text-etichetta text-white/60">
                Chiudendo l&apos;anno il regime viene applicato alle impostazioni
                {regime.motivo === "uscitaImmediata" ? ` del ${anno}` : ` del ${anno + 1}`}.
                Resta modificabile dal selettore in testa alla pagina.
              </p>
            )}
          </CardCorpo>
        </Card>

        {controlli.length > 0 && (
          <Card>
            <CardCorpo>
              <CardTitolo>Prima di chiudere</CardTitolo>
              <CardSottotitolo>
                Nessuno di questi punti impedisce la chiusura, tranne i parametri
                provvisori. Chiudere con documenti in sospeso è normale: meglio saperlo.
              </CardSottotitolo>
              <div className="mt-4 space-y-2">
                {controlli.map((c) => (
                  <CardInterna key={c.id} className="flex items-start gap-3 p-4">
                    <IconaGravita gravita={c.gravita} />
                    <div className="min-w-0">
                      <p className="text-corpo font-medium">{c.titolo}</p>
                      <p className="mt-0.5 text-etichetta text-inchiostro-tenue">
                        {c.dettaglio}
                      </p>
                    </div>
                  </CardInterna>
                ))}
              </div>
            </CardCorpo>
          </Card>
        )}

        <Card>
          <CardCorpo>
            {chiusura ? (
              <>
                <CardTitolo>Anno chiuso</CardTitolo>
                <CardSottotitolo>
                  Chiuso il {fmtData(chiusura.chiusaIl.slice(0, 10))}. La chiusura non ha
                  congelato nessun numero: riaprire riporta esattamente allo stato di prima.
                </CardSottotitolo>
                {chiusura.note && (
                  <p className="mt-3 text-corpo text-inchiostro-tenue">{chiusura.note}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button scrive variante="contorno" onClick={() => void riapriAnno(chiusura)}>
                    <LockOpen className="size-4" aria-hidden />
                    Riapri il {anno}
                  </Button>
                  <Button variante="quieto" asChild>
                    <Link href={ROTTE.fisco}>Vedi il prospetto</Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <CardTitolo>Chiudi il {anno}</CardTitolo>
                <CardSottotitolo>
                  Chiudere registra la data, la destinazione del credito IVA e il regime
                  del {anno + 1}. Gli importi restano vivi: se a marzo salta fuori una
                  fattura del {anno}, i riporti la incorporano e te lo segnalano.
                </CardSottotitolo>
                <BloccoScrittura className="mt-4 space-y-3">
                  <div>
                    <Etichetta>Nota (facoltativa)</Etichetta>
                    <Input
                      className="mt-1.5"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Es. verificato con il commercialista il 12 febbraio"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={() => void conferma()} disabled={!puoChiudere}>
                      Chiudi il {anno}
                    </Button>
                    {!puoChiudere && (
                      <p className="text-etichetta text-[#B8791A]">
                        {bloccanti[0].titolo}: {bloccanti[0].dettaglio}
                      </p>
                    )}
                  </div>
                  <p className="flex items-start gap-2 text-etichetta text-inchiostro-tenue">
                    <RotateCcw className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    Sempre annullabile: la chiusura è una riga in archivio, non uno stato
                    irreversibile.
                  </p>
                </BloccoScrittura>
              </>
            )}
          </CardCorpo>
        </Card>
      </div>
    </Guscio>
  );
}

function RigaRiporto({
  voce,
  valore,
  nota,
  evidenzia = false,
}: {
  voce: string;
  valore: string;
  nota: string;
  evidenzia?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-bordo py-2.5 last:border-0",
        evidenzia && "rounded-campo border-0 bg-accento-tenue px-3",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-corpo">{voce}</p>
        <p className="text-micro text-inchiostro-tenue">{nota}</p>
      </div>
      <p className="cifre text-corpo font-semibold tabular-nums">{valore}</p>
    </div>
  );
}

function IconaGravita({ gravita }: { gravita: "blocco" | "attenzione" | "informazione" }) {
  if (gravita === "blocco") {
    return <CircleAlert className="mt-0.5 size-4 shrink-0 text-negativo" aria-hidden />;
  }
  if (gravita === "attenzione") {
    return <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#B8791A]" aria-hidden />;
  }
  return <Info className="mt-0.5 size-4 shrink-0 text-accento" aria-hidden />;
}

export type { Riporto };
