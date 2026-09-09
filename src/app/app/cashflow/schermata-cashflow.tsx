"use client";

import * as React from "react";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import {
  ElencoSchede,
  Scheda,
  SchedaTesta,
  SchedaTotale,
  SchedaVoci,
} from "@/components/tabella/schede";
import { Campo, Input } from "@/components/ui/input";
import { BloccoScrittura } from "@/components/ui/blocco-scrittura";
import { Kpi } from "@/components/ui/kpi";
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
import { CellaModificabile } from "@/components/tabella/cella-modificabile";
import { AndamentoCassa } from "@/components/grafici/andamento-cassa";
import { Guscio } from "@/components/guscio/guscio";
import {
  assegnaAnnoImposta,
  creaVersamento,
  eliminaVersamento,
  salvaMovimentoAttivita,
  salvaMovimentoPersonale,
} from "@/lib/dati/azioni";
import { useCalcoloAnno, useDati } from "@/lib/dati/hooks";
import { usePreferenze } from "@/lib/stato/preferenze";
import { analizzaNumero, data as fmtData, euro, nomeMese } from "@/lib/format";
import type { VersamentoF24 } from "@/lib/dati/tipi";

const TIPI_F24: { valore: VersamentoF24["tipo"]; etichetta: string }[] = [
  { valore: "imposte", etichetta: "Imposte" },
  { valore: "contributi", etichetta: "Contributi" },
  { valore: "iva", etichetta: "IVA" },
];

export function SchermataCashflow() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const dati = useDati();
  const calcolo = useCalcoloAnno(anno, oggi);

  // Il cashflow arriva dalla catena degli anni, non ricalcolato qui: è l'unico
  // modo perché apra con il saldo e l'accantonato lasciati dall'anno prima.
  const cashflow = calcolo?.cashflow ?? null;

  if (!dati || !calcolo || !cashflow) {
    return (
      <Guscio titolo="Cashflow">
        <Card>
          <CaricamentoTabella righe={6} />
        </Card>
      </Guscio>
    );
  }

  const versamentiAnno = dati.versamenti
    .filter((v) => v.data.startsWith(String(anno)))
    .sort((a, b) => a.data.localeCompare(b.data));

  return (
    <Guscio
      titolo="Cashflow"
      descrizione={`Anno ${anno} · conta quando il denaro si muove davvero`}
    >
      <div className="space-y-4">
        <section aria-label="Sintesi di cassa" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            sfondo="indaco"
            etichetta="Entrate totali"
            valore={euro(cashflow.totaleEntrate)}
            nota={`saldo iniziale ${euro(cashflow.saldoIniziale)}`}
          />
          <Kpi sfondo="ambra" etichetta="Uscite totali" valore={euro(cashflow.totaleUscite)} nota="costi, F24 e prelievi" />
          <Kpi etichetta="Saldo di cassa" valore={euro(cashflow.saldoFinale)} nota="a fine anno" />
          <Kpi
            sfondo="scuro"
            etichetta="Liquidità netta"
            valore={euro(cashflow.liquiditaNettaFinale)}
            nota={`al netto di ${euro(cashflow.accantonatoTotale)} accantonati`}
          />
        </section>

        {cashflow.meseNegativo && (
          <Card className="border border-negativo/25 bg-negativo-tenue">
            <CardCorpo className="flex items-start gap-3 py-4">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-negativo" aria-hidden />
              <p className="text-corpo text-[#C13237]">
                La cassa va sotto zero a {nomeMese(cashflow.meseNegativo.mese)}, fino a{" "}
                {euro(cashflow.meseNegativo.saldoCassa)}. Rivedi i prelievi o sposta un
                versamento: è il mese da cui ci si accorge dei problemi.
              </p>
            </CardCorpo>
          </Card>
        )}

        <Card className="overflow-hidden">
          <CardCorpo className="pb-3">
            <CardTitolo>Saldo e liquidità netta</CardTitolo>
            <CardSottotitolo>
              La distanza fra le due linee è il denaro che sta sul conto ma non è tuo.
            </CardSottotitolo>
          </CardCorpo>
          <AndamentoCassa mesi={cashflow.mesi} />
        </Card>

        <Card className="overflow-hidden">
          <CardCorpo className="pb-2">
            <CardTitolo>Flusso mensile</CardTitolo>
            <CardSottotitolo>
              Le colonne chiare arrivano dai registri. Le altre entrate, le altre uscite e i
              prelievi li scrivi tu: bastano un clic e Invio.
            </CardSottotitolo>
          </CardCorpo>
          {/*
            Alta abbastanza da contenere l'apertura, i dodici mesi e il totale
            senza scorrere: un anno di cassa in cui l'ultimo trimestre resta
            sotto il bordo è un anno che non si legge.
          */}
          <ContenitoreTabella
            data-scroll-ok
            classeGuscio="hidden md:block"
            className="max-h-[48rem] px-2 pb-2"
          >
            <Tabella>
              <TabellaTesta>
                <tr>
                  <TabellaIntestazione>Mese</TabellaIntestazione>
                  <TabellaIntestazione numerica>Incassi</TabellaIntestazione>
                  <TabellaIntestazione numerica>Altre entrate</TabellaIntestazione>
                  <TabellaIntestazione numerica>Costi</TabellaIntestazione>
                  <TabellaIntestazione numerica>IVA versata</TabellaIntestazione>
                  <TabellaIntestazione numerica className="whitespace-nowrap">
                    Imposte e contributi
                  </TabellaIntestazione>
                  <TabellaIntestazione numerica>Prelievi</TabellaIntestazione>
                  <TabellaIntestazione numerica>Altre uscite</TabellaIntestazione>
                  <TabellaIntestazione numerica>Flusso</TabellaIntestazione>
                  <TabellaIntestazione numerica>Saldo</TabellaIntestazione>
                  <TabellaIntestazione numerica className="whitespace-nowrap">
                    Liquidità netta
                  </TabellaIntestazione>
                </tr>
              </TabellaTesta>
              <TabellaCorpo>
                {/*
                  La riga di apertura non è decorativa: è il punto in cui si vede
                  che il 1° gennaio la liquidità netta non risale. Senza il
                  riporto dell'accantonato, questa riga mostrerebbe l'intero
                  saldo come disponibile.
                */}
                <TabellaRiga className="bg-superficie-alt/60">
                  <TabellaCella className="whitespace-nowrap font-medium">
                    1° gennaio
                  </TabellaCella>
                  <TabellaCella numerica colSpan={7} className="text-inchiostro-tenue">
                    {cashflow.accantonatoIniziale > 0
                      ? `riporto dal ${anno - 1}, di cui ${euro(cashflow.accantonatoIniziale)} già accantonati`
                      : `saldo di apertura del ${anno}`}
                  </TabellaCella>
                  <TabellaCella numerica className="text-inchiostro-tenue">
                    —
                  </TabellaCella>
                  <TabellaCella numerica>{euro(cashflow.saldoIniziale)}</TabellaCella>
                  <TabellaCella numerica>{euro(cashflow.liquiditaNettaIniziale)}</TabellaCella>
                </TabellaRiga>
                {cashflow.mesi.map((m) => (
                  <TabellaRiga key={m.mese}>
                    <TabellaCella className="whitespace-nowrap capitalize">
                      {nomeMese(m.mese)}
                    </TabellaCella>
                    <TabellaCella numerica>{euro(m.incassiClienti)}</TabellaCella>
                    <TabellaCella className="p-1">
                      <CellaModificabile
                        tipo="valuta"
                        etichetta={`Altre entrate di ${nomeMese(m.mese)}`}
                        valore={m.altreEntrate}
                        onSalva={(v) => void salvaMovimentoAttivita(anno, m.mese, { altreEntrate: Number(v) })}
                      />
                    </TabellaCella>
                    <TabellaCella numerica>{euro(m.costiPagati)}</TabellaCella>
                    <TabellaCella numerica>{euro(m.ivaVersata)}</TabellaCella>
                    <TabellaCella numerica>{euro(m.imposteEContributi)}</TabellaCella>
                    <TabellaCella className="p-1">
                      <CellaModificabile
                        tipo="valuta"
                        etichetta={`Prelievi di ${nomeMese(m.mese)}`}
                        valore={m.prelieviPersonali}
                        onSalva={(v) => void salvaMovimentoPersonale(anno, m.mese, { prelievi: Number(v) })}
                      />
                    </TabellaCella>
                    <TabellaCella className="p-1">
                      <CellaModificabile
                        tipo="valuta"
                        etichetta={`Altre uscite di ${nomeMese(m.mese)}`}
                        valore={m.altreUscite}
                        onSalva={(v) => void salvaMovimentoAttivita(anno, m.mese, { altreUscite: Number(v) })}
                      />
                    </TabellaCella>
                    <TabellaCella
                      numerica
                      className={m.flussoNetto < 0 ? "text-negativo" : undefined}
                    >
                      {euro(m.flussoNetto)}
                    </TabellaCella>
                    <TabellaCella
                      numerica
                      className={m.saldoCassa < 0 ? "font-medium text-negativo" : "font-medium"}
                    >
                      {euro(m.saldoCassa)}
                    </TabellaCella>
                    <TabellaCella
                      numerica
                      className={m.liquiditaNetta < 0 ? "text-negativo" : "text-inchiostro-tenue"}
                    >
                      {euro(m.liquiditaNetta)}
                    </TabellaCella>
                  </TabellaRiga>
                ))}
              </TabellaCorpo>
              <TabellaPiede>
                <tr>
                  <TabellaCella>Totale</TabellaCella>
                  <TabellaCella numerica>
                    {euro(cashflow.mesi.reduce((a, m) => a + m.incassiClienti, 0))}
                  </TabellaCella>
                  <TabellaCella numerica>
                    {euro(cashflow.mesi.reduce((a, m) => a + m.altreEntrate, 0))}
                  </TabellaCella>
                  <TabellaCella numerica>
                    {euro(cashflow.mesi.reduce((a, m) => a + m.costiPagati, 0))}
                  </TabellaCella>
                  <TabellaCella numerica>
                    {euro(cashflow.mesi.reduce((a, m) => a + m.ivaVersata, 0))}
                  </TabellaCella>
                  <TabellaCella numerica>
                    {euro(cashflow.mesi.reduce((a, m) => a + m.imposteEContributi, 0))}
                  </TabellaCella>
                  <TabellaCella numerica>
                    {euro(cashflow.mesi.reduce((a, m) => a + m.prelieviPersonali, 0))}
                  </TabellaCella>
                  <TabellaCella numerica>
                    {euro(cashflow.mesi.reduce((a, m) => a + m.altreUscite, 0))}
                  </TabellaCella>
                  <TabellaCella numerica>
                    {euro(cashflow.totaleEntrate - cashflow.totaleUscite)}
                  </TabellaCella>
                  <TabellaCella numerica>{euro(cashflow.saldoFinale)}</TabellaCella>
                  <TabellaCella numerica>{euro(cashflow.liquiditaNettaFinale)}</TabellaCella>
                </tr>
              </TabellaPiede>
            </Tabella>
          </ContenitoreTabella>

          {/* Sul telefono ogni mese è una scheda. In testa il saldo, che è la
              domanda («a fine mese quanto c'era?»), e sotto le voci; i tre
              campi che si compilano a mano restano modificabili. */}
          <ElencoSchede>
            <Scheda className="bg-superficie-alt/60">
              <SchedaTesta
                titolo="1° gennaio"
                sotto={
                  cashflow.accantonatoIniziale > 0
                    ? `riporto dal ${anno - 1}, di cui ${euro(cashflow.accantonatoIniziale)} già accantonati`
                    : `saldo di apertura del ${anno}`
                }
                valore={euro(cashflow.saldoIniziale)}
                notaValore={`${euro(cashflow.liquiditaNettaIniziale)} disponibili`}
              />
            </Scheda>
            {cashflow.mesi.map((m) => (
              <Scheda key={m.mese}>
                <SchedaTesta
                  titolo={<span className="capitalize">{nomeMese(m.mese)}</span>}
                  sotto={`${euro(m.liquiditaNetta)} di liquidità netta`}
                  valore={
                    <span className={m.saldoCassa < 0 ? "text-negativo" : undefined}>
                      {euro(m.saldoCassa)}
                    </span>
                  }
                  notaValore="saldo di cassa"
                />
                <SchedaVoci
                  voci={[
                    { etichetta: "Incassi", valore: euro(m.incassiClienti), mostra: m.incassiClienti > 0 },
                    { etichetta: "Costi pagati", valore: euro(m.costiPagati), mostra: m.costiPagati > 0 },
                    { etichetta: "IVA versata", valore: euro(m.ivaVersata), mostra: m.ivaVersata > 0 },
                    {
                      etichetta: "Imposte e contributi",
                      valore: euro(m.imposteEContributi),
                      mostra: m.imposteEContributi > 0,
                    },
                    {
                      etichetta: "Flusso",
                      valore: (
                        <span className={m.flussoNetto < 0 ? "text-negativo" : undefined}>
                          {euro(m.flussoNetto)}
                        </span>
                      ),
                    },
                  ]}
                />
                <div className="mt-3 grid gap-1.5 min-[360px]:grid-cols-3">
                  <CampoMese
                    etichetta="Altre entrate"
                    valore={m.altreEntrate}
                    nome={`Altre entrate di ${nomeMese(m.mese)}`}
                    onSalva={(v) => void salvaMovimentoAttivita(anno, m.mese, { altreEntrate: v })}
                  />
                  <CampoMese
                    etichetta="Altre uscite"
                    valore={m.altreUscite}
                    nome={`Altre uscite di ${nomeMese(m.mese)}`}
                    onSalva={(v) => void salvaMovimentoAttivita(anno, m.mese, { altreUscite: v })}
                  />
                  <CampoMese
                    etichetta="Prelievi"
                    valore={m.prelieviPersonali}
                    nome={`Prelievi di ${nomeMese(m.mese)}`}
                    onSalva={(v) => void salvaMovimentoPersonale(anno, m.mese, { prelievi: v })}
                  />
                </div>
              </Scheda>
            ))}
            <SchedaTotale
              etichetta="A fine anno"
              valore={euro(cashflow.saldoFinale)}
              nota={`${euro(cashflow.liquiditaNettaFinale)} disponibili`}
            />
          </ElencoSchede>
        </Card>

        <ElencoVersamenti anno={anno} versamenti={versamentiAnno} />
      </div>
    </Guscio>
  );
}

/**
 * L'anno d'imposta di un versamento, e il modo di assegnarlo se manca.
 *
 * Chi ha registrato F24 prima che il campo esistesse li vede contrassegnati:
 * il numero non è cambiato, ma è una supposizione basata sulla data, e finché
 * resta tale va detto qui — dove il versamento si vede — e non solo nel
 * prospetto.
 */
function AnnoImposta({ versamento }: { versamento: VersamentoF24 }) {
  const annoDellaData = Number(versamento.data.slice(0, 4));
  if (versamento.annoImposta !== undefined) {
    return (
      <span className="text-micro text-inchiostro-tenue">
        anno d&apos;imposta {versamento.annoImposta}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="rounded-full bg-attenzione-tenue px-2 py-0.5 text-micro text-inchiostro">
        anno d&apos;imposta da assegnare
      </span>
      {[annoDellaData - 1, annoDellaData].map((a) => (
        <Button
          scrive
          key={a}
          variante="contorno"
          taglia="sm"
          onClick={() => void assegnaAnnoImposta(versamento, a)}
        >
          {a}
        </Button>
      ))}
    </span>
  );
}

function ElencoVersamenti({ anno, versamenti }: { anno: number; versamenti: VersamentoF24[] }) {
  const [data, setData] = React.useState(`${anno}-06-30`);
  const [tipo, setTipo] = React.useState<VersamentoF24["tipo"]>("imposte");
  const [importo, setImporto] = React.useState("");
  /*
    L'anno d'imposta non si deduce dalla data: il 30 giugno escono insieme il
    saldo dell'anno prima e il primo acconto di quello in corso. Si propone
    l'anno della data — scritto, non nascosto — e l'altro è una scelta sola.
  */
  const [annoScelto, setAnnoScelto] = React.useState<number | null>(null);
  const annoDellaData = Number(data.slice(0, 4)) || anno;
  const annoImposta = annoScelto ?? annoDellaData;

  const valore = analizzaNumero(importo) ?? 0;
  const totale = versamenti.reduce((a, v) => a + v.importo, 0);

  return (
    <Card>
      <CardCorpo className="pb-3">
        <CardTitolo>Versamenti F24 dell&apos;anno</CardTitolo>
        <CardSottotitolo>
          Quello che hai davvero pagato. I contributi registrati qui vengono dedotti per
          cassa nel prospetto fiscale, al posto di quelli di competenza. L&apos;anno
          d&apos;imposta è un&apos;altra cosa dalla data: il 30 giugno si versa insieme il
          saldo dell&apos;anno prima e il primo acconto di quello in corso, e solo il
          secondo abbassa il dovuto dell&apos;anno in corso.
        </CardSottotitolo>
      </CardCorpo>

      <ul className="divide-y divide-bordo/70 border-y border-bordo">
        {versamenti.length === 0 ? (
          <li className="px-4 py-4 text-corpo text-inchiostro-tenue sm:px-6">
            Nessun F24 registrato per il {anno}.
          </li>
        ) : (
          versamenti.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="cifre text-etichetta text-inchiostro-tenue">{fmtData(v.data)}</span>
                <span className="text-corpo">
                  {TIPI_F24.find((t) => t.valore === v.tipo)?.etichetta}
                </span>
                <AnnoImposta versamento={v} />
              </span>
              <span className="flex items-center gap-3">
                <span className="cifre text-corpo font-medium">{euro(v.importo)}</span>
                <Button scrive
                  variante="quieto"
                  taglia="icona"
                  aria-label={`Elimina il versamento del ${fmtData(v.data)}`}
                  onClick={() => void eliminaVersamento(v)}
                  className="hover:bg-negativo-tenue hover:text-negativo"
                >
                  <Trash2 className="size-4" />
                </Button>
              </span>
            </li>
          ))
        )}
        {versamenti.length > 0 && (
          <li className="flex items-center justify-between bg-superficie-alt/70 px-4 py-2.5 sm:px-6">
            <span className="text-etichetta font-medium">Totale versato</span>
            <span className="cifre pr-11 text-corpo font-semibold">{euro(totale)}</span>
          </li>
        )}
      </ul>

      <CardCorpo className="pt-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (valore <= 0) return;
            void creaVersamento({ data, tipo, importo: valore, annoImposta });
            setImporto("");
          }}
        >
          <BloccoScrittura className="contents">
          <Campo etichetta="Data" htmlFor="f24-data" className="w-44">
            <Input id="f24-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo etichetta="Tipo" htmlFor="f24-tipo" className="w-44">
            <Select value={tipo} onValueChange={(v) => setTipo(v as VersamentoF24["tipo"])}>
              <SelectTrigger id="f24-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPI_F24.map((t) => (
                  <SelectItem key={t.valore} value={t.valore}>{t.etichetta}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo etichetta="Anno d'imposta" htmlFor="f24-anno" className="w-44">
            <Select
              value={String(annoImposta)}
              onValueChange={(v) => setAnnoScelto(Number(v))}
            >
              <SelectTrigger id="f24-anno">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[annoDellaData - 1, annoDellaData].map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo etichetta="Importo" htmlFor="f24-importo" className="w-44">
            <Input
              id="f24-importo"
              numerico
              inputMode="decimal"
              value={importo}
              onChange={(e) => setImporto(e.target.value)}
              placeholder="0,00"
            />
          </Campo>
          <Button type="submit" disabled={valore <= 0}>
            <Plus className="size-4" aria-hidden />
            Registra
          </Button>
          </BloccoScrittura>
        </form>
      </CardCorpo>
    </Card>
  );
}

/**
 * Un campo mensile nella scheda del telefono.
 * L'etichetta va scritta: nella tabella la dava la colonna, qui no.
 */
function CampoMese({
  etichetta,
  nome,
  valore,
  onSalva,
}: {
  etichetta: string;
  nome: string;
  valore: number;
  onSalva: (valore: number) => void;
}) {
  return (
    <div>
      <p className="text-micro text-inchiostro-tenue">{etichetta}</p>
      <CellaModificabile
        tipo="valuta"
        etichetta={nome}
        valore={valore}
        className="border-bordo"
        onSalva={(v) => onSalva(Number(v))}
      />
    </div>
  );
}
