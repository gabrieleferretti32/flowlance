"use client";

import * as React from "react";
import Link from "next/link";
import { Coins } from "lucide-react";
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
import { Segmenti } from "@/components/ui/segmenti";
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
import { useCalcoloAnno } from "@/lib/dati/hooks";
import { usePreferenze } from "@/lib/stato/preferenze";
import { data as fmtData, euro } from "@/lib/format";
import type { PeriodoIva } from "@/lib/fisco/iva";

export function SchermataIva() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const calcolo = useCalcoloAnno(anno, oggi);
  const [vista, setVista] = React.useState<"mensile" | "trimestrale">("trimestrale");

  React.useEffect(() => {
    if (calcolo) setVista(calcolo.impostazioni.periodicitaIva === "mensile" ? "mensile" : "trimestrale");
  }, [calcolo]);

  if (!calcolo) {
    return (
      <Guscio titolo="IVA">
        <Card>
          <CaricamentoTabella righe={5} />
        </Card>
      </Guscio>
    );
  }

  const { iva, impostazioni: imp } = calcolo;

  // In forfettario la schermata non si nasconde e basta: spiega perché.
  if (!iva.applicabile) {
    return (
      <Guscio titolo="IVA" descrizione={`Anno ${anno} · regime forfettario`}>
        <Card className="mx-auto max-w-2xl">
          <CardCorpo className="py-10 text-center">
            <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-interna bg-superficie-alt text-inchiostro-tenue">
              <Coins className="size-5" aria-hidden />
            </span>
            <CardTitolo>In forfettario l&apos;IVA non ti riguarda</CardTitolo>
            <p className="mx-auto mt-2 max-w-md text-corpo text-inchiostro-tenue">
              Non addebiti IVA in fattura e non detrai quella sugli acquisti: non c&apos;è
              nulla da liquidare e nessun versamento periodico da fare. In cambio, l&apos;IVA
              che paghi ai fornitori resta un costo pieno.
            </p>
            <p className="mx-auto mt-3 max-w-md text-etichetta text-inchiostro-tenue">
              Se passi al regime ordinario questa schermata si popola da sola.{" "}
              <Link href="/confronto" className="py-1.5 text-accento underline underline-offset-2">
                Vedi il confronto fra i due regimi
              </Link>
              .
            </p>
          </CardCorpo>
        </Card>
      </Guscio>
    );
  }

  const periodi = vista === "mensile" ? iva.mesi : iva.trimestri;
  const quelliDelRegime = imp.periodicitaIva === vista;

  return (
    <Guscio
      titolo="IVA"
      descrizione={`Liquidazione ${anno} · segue la data del documento, non l'incasso`}
    >
      <div className="mx-auto max-w-4xl space-y-4">
        <section aria-label="Sintesi" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            etichetta="IVA a debito"
            valore={euro(iva.totaleDebito)}
            taglia="kpiSm"
            nota={
              iva.stornoNote.totale > 0
                ? `sulle fatture emesse, al netto di ${euro(iva.stornoNote.totale)} di note di credito`
                : "sulle fatture emesse"
            }
          />
          <Kpi etichetta="IVA a credito" valore={euro(iva.totaleCredito)} taglia="kpiSm" nota="sugli acquisti detraibili" />
          <Kpi etichetta="Saldo dell'anno" valore={euro(iva.saldoAnno)} taglia="kpiSm" nota="debito meno credito" />
          <Kpi
            sfondo="scuro"
            etichetta="Da versare"
            valore={euro(iva.totaleDaVersare)}
            taglia="kpiSm"
            nota={`liquidazione ${imp.periodicitaIva}`}
          />
        </section>

        <Card className="overflow-hidden">
          <CardCorpo className="flex flex-wrap items-start justify-between gap-3 pb-3">
            <div>
              <CardTitolo>
                Liquidazione {vista === "mensile" ? "mensile" : "trimestrale"}
              </CardTitolo>
              <CardSottotitolo>
                {quelliDelRegime
                  ? "È la periodicità che hai impostato: queste sono le tue scadenze."
                  : "Vista di confronto: non è la periodicità che hai impostato."}
              </CardSottotitolo>
            </div>
            <Segmenti
              etichettaGruppo="Periodicità della liquidazione"
              valore={vista}
              onChange={setVista}
              opzioni={[
                { valore: "mensile", etichetta: "Mensile" },
                { valore: "trimestrale", etichetta: "Trimestrale" },
              ]}
            />
          </CardCorpo>

          {/* Da tablet in su: nove colonne di liquidazione. */}
          {/* Le note come voce a sé, sopra la tabella: un debito che cala senza
              dire perché non si controlla, e questa è la riga che lo spiega. */}
          {iva.stornoNote.totale > 0 && (
            <CardCorpo className="pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-campo border border-bordo bg-superficie-alt px-3 py-2">
                <span className="text-etichetta">
                  Note di credito emesse nel {anno}
                  <span className="text-inchiostro-tenue">
                    {" "}
                    · già sottratte dal debito del mese in cui sono state emesse
                  </span>
                </span>
                <span className="cifre text-etichetta font-medium text-negativo">
                  − {euro(iva.stornoNote.totale)}
                </span>
              </div>
            </CardCorpo>
          )}

          <ContenitoreTabella data-scroll-ok classeGuscio="hidden md:block" className="px-2 pb-2">
            <Tabella>
              <TabellaTesta>
                <tr>
                  <TabellaIntestazione>Periodo</TabellaIntestazione>
                  <TabellaIntestazione numerica>A debito</TabellaIntestazione>
                  <TabellaIntestazione numerica>A credito</TabellaIntestazione>
                  <TabellaIntestazione numerica>Saldo</TabellaIntestazione>
                  <TabellaIntestazione numerica>Credito precedente</TabellaIntestazione>
                  {vista === "trimestrale" && (
                    <TabellaIntestazione numerica className="whitespace-nowrap">
                      Maggiorazione
                    </TabellaIntestazione>
                  )}
                  <TabellaIntestazione numerica>Da versare</TabellaIntestazione>
                  <TabellaIntestazione numerica>Credito a nuovo</TabellaIntestazione>
                  <TabellaIntestazione>Scadenza</TabellaIntestazione>
                </tr>
              </TabellaTesta>
              <TabellaCorpo>
                {periodi.map((p) => (
                  <RigaIva key={p.indice} periodo={p} trimestrale={vista === "trimestrale"} />
                ))}
              </TabellaCorpo>
              <TabellaPiede>
                <tr>
                  <TabellaCella>Totale</TabellaCella>
                  <TabellaCella numerica>{euro(iva.totaleDebito)}</TabellaCella>
                  <TabellaCella numerica>{euro(iva.totaleCredito)}</TabellaCella>
                  <TabellaCella numerica>{euro(iva.saldoAnno)}</TabellaCella>
                  <TabellaCella />
                  {vista === "trimestrale" && (
                    <TabellaCella numerica>
                      {euro(iva.trimestri.reduce((a, t) => a + t.maggiorazione, 0))}
                    </TabellaCella>
                  )}
                  <TabellaCella numerica>
                    {euro(periodi.reduce((a, p) => a + p.totaleDaVersare, 0))}
                  </TabellaCella>
                  <TabellaCella colSpan={2} />
                </tr>
              </TabellaPiede>
            </Tabella>
          </ContenitoreTabella>

          {/* Sul telefono ogni periodo è una scheda. I periodi senza movimenti
              restano visibili ma spenti: servono a far vedere che l'anno è
              coperto, non a essere letti uno per uno. */}
          <ElencoSchede>
            {periodi.map((p) => {
              const inattivo = p.debito === 0 && p.credito === 0;
              return (
                <Scheda key={p.indice} className={inattivo ? "text-inchiostro-tenue" : undefined}>
                  <SchedaTesta
                    titolo={p.etichetta}
                    sotto={p.scadenza ? `versamento il ${fmtData(p.scadenza)}` : undefined}
                    valore={euro(p.totaleDaVersare)}
                    notaValore="da versare"
                  />
                  <SchedaVoci
                    voci={[
                      { etichetta: "A debito", valore: euro(p.debito) },
                      { etichetta: "A credito", valore: euro(p.credito) },
                      { etichetta: "Saldo", valore: euro(p.saldo) },
                      {
                        etichetta: "Credito precedente",
                        valore: euro(p.creditoPrecedente),
                        mostra: p.creditoPrecedente > 0,
                      },
                      {
                        etichetta: "Maggiorazione",
                        valore: euro(p.maggiorazione),
                        mostra: vista === "trimestrale" && p.maggiorazione > 0,
                      },
                      {
                        etichetta: "Credito a nuovo",
                        valore: euro(p.creditoANuovo),
                        mostra: p.creditoANuovo > 0,
                      },
                    ]}
                  />
                </Scheda>
              );
            })}
            <SchedaTotale
              valore={euro(periodi.reduce((a, p) => a + p.totaleDaVersare, 0))}
              nota={`${euro(iva.totaleDebito)} a debito · ${euro(iva.totaleCredito)} a credito`}
            />
          </ElencoSchede>
        </Card>

        <Card>
          <CardCorpo className="space-y-2 py-4">
            <p className="text-etichetta text-inchiostro-tenue">
              La liquidazione segue la <strong className="font-medium text-inchiostro">data
              del documento</strong>: l&apos;IVA di una fattura di gennaio incassata a marzo
              resta di gennaio. È l&apos;unica parte del calcolo che non segue il principio
              di cassa.
            </p>
            <p className="text-etichetta text-inchiostro-tenue">
              Il credito di un periodo si riporta al successivo e abbatte il debito, finché
              si esaurisce. La maggiorazione dell&apos;1% sui trimestrali{" "}
              <strong className="font-medium text-inchiostro">non si applica al quarto
              trimestre</strong>, che confluisce nella dichiarazione annuale.
            </p>
            <p className="text-etichetta text-inchiostro-tenue">
              Oltre al versamento, chi è in regime ordinario invia la LIPE entro la fine del
              secondo mese successivo a ogni trimestre, e la dichiarazione IVA annuale entro
              il 30 aprile.{" "}
              <Link href="/scadenzario" className="py-1.5 text-accento underline underline-offset-2">
                Trovi tutte le date nello scadenzario
              </Link>
              .
            </p>
          </CardCorpo>
        </Card>
      </div>
    </Guscio>
  );
}

function RigaIva({ periodo, trimestrale }: { periodo: PeriodoIva; trimestrale: boolean }) {
  const inattivo = periodo.debito === 0 && periodo.credito === 0;
  return (
    <TabellaRiga className={inattivo ? "text-inchiostro-tenue" : undefined}>
      <TabellaCella className="whitespace-nowrap">{periodo.etichetta}</TabellaCella>
      <TabellaCella numerica>{euro(periodo.debito)}</TabellaCella>
      <TabellaCella numerica>{euro(periodo.credito)}</TabellaCella>
      <TabellaCella numerica>{euro(periodo.saldo)}</TabellaCella>
      <TabellaCella numerica>{euro(periodo.creditoPrecedente)}</TabellaCella>
      {trimestrale && <TabellaCella numerica>{euro(periodo.maggiorazione)}</TabellaCella>}
      <TabellaCella numerica className="font-medium">
        {euro(periodo.totaleDaVersare)}
      </TabellaCella>
      <TabellaCella numerica>{euro(periodo.creditoANuovo)}</TabellaCella>
      <TabellaCella className="whitespace-nowrap text-inchiostro-tenue">
        {periodo.scadenza ? fmtData(periodo.scadenza) : "—"}
      </TabellaCella>
    </TabellaRiga>
  );
}
