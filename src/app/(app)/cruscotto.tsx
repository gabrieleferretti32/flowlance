"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, Check, Info, TriangleAlert } from "lucide-react";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Chip } from "@/components/ui/chip";
import { Kpi } from "@/components/ui/kpi";
import { quotaLimite } from "@/lib/fisco/spiegazioni";
import { COLORI_SEMAFORO, SemaforoFiscale } from "@/components/fisco/semaforo-fiscale";
import { GraficoAndamento } from "@/components/grafici/andamento";
import { GraficoConcentrazione } from "@/components/grafici/concentrazione";
import { Guscio } from "@/components/guscio/guscio";
import { InvitoPercorso } from "@/components/guscio/invito-percorso";
import { andamentoMensile, giorniMediIncasso, portafoglioClienti } from "@/lib/analisi/dashboard";
import { generaAvvisi, type Avviso } from "@/lib/analisi/avvisi";
import { useCalcoloAnno, useDati } from "@/lib/dati/hooks";
import { giorniAllaData } from "@/lib/fisco/calendario";
import { parametriDi } from "@/lib/fisco/parametri";
import { round2 } from "@/lib/fisco/aritmetica";
import { periodoIvaCorrente } from "@/lib/fisco/iva";
import { prossimeScadenze, scadenzeAnno, type Adempimento } from "@/lib/fisco/scadenze";
import { usePreferenze } from "@/lib/stato/preferenze";
import { coloreDaNome, data as fmtData, euro, percentuale } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * La copertura, arrotondata per difetto.
 *
 * Arrotondando per eccesso il 99,76 % diventava «100 %» sopra una nota che
 * diceva «mancano 28,64 €»: il numero grande e la riga sotto si
 * contraddicevano. Per difetto non succede mai, e nell'ultimo punto — dove la
 * differenza fra «ci sei» e «quasi» conta — si mostra il decimale.
 */
function coperturaScritta(copertura: number): string {
  const decimali = copertura >= 0.99 && copertura < 1 ? 1 : 0;
  const passo = 10 ** (decimali + 2);
  return percentuale(Math.floor(copertura * passo) / passo, decimali);
}

export function Cruscotto() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const dati = useDati();
  const calcolo = useCalcoloAnno(anno, oggi);
  // Le scadenze di giugno e novembre vengono dai numeri dell'anno prima.
  const precedente = useCalcoloAnno(anno - 1, oggi);
  /*
    E anche l'anno dopo, per una card sola: a settembre il prossimo versamento
    di un forfettario può cadere a marzo. «Nessuna scadenza in arrivo» quando
    ce n'è una fra sei mesi è la risposta sbagliata alla domanda giusta.
  */
  const successivo = useCalcoloAnno(anno + 1, oggi);

  const analisi = React.useMemo(() => {
    if (!dati || !calcolo) return null;
    const { prospetto, impostazioni, iva } = calcolo;
    const scadenze = scadenzeAnno(
      impostazioni,
      parametriDi(anno),
      prospetto,
      iva,
      precedente?.prospetto ?? null,
    );
    return {
      mesi: andamentoMensile(
        prospetto.fattureCalcolate,
        prospetto.costiCalcolati,
        anno,
        prospetto.noteCalcolate,
      ),
      portafoglio: portafoglioClienti(prospetto.fattureCalcolate, dati.clienti, anno, coloreDaNome),
      giorniMedi: giorniMediIncasso(prospetto.fattureCalcolate),
      scadenze,
      prossime: prossimeScadenze(scadenze, oggi, 4),
      // L'elenco continua nell'anno dopo: serve solo alla card del prossimo
      // versamento, che non si ferma al 31 dicembre.
      scadenzeSuccessive: successivo
        ? scadenzeAnno(
            successivo.impostazioni,
            parametriDi(anno + 1),
            successivo.prospetto,
            successivo.iva,
            prospetto,
          )
        : [],
      avvisi: generaAvvisi({
        prospetto,
        impostazioni,
        fatture: prospetto.fattureCalcolate,
        costi: prospetto.costiCalcolati,
        scadenze,
        oggi,
      }),
    };
  }, [dati, calcolo, precedente, successivo, anno, oggi]);

  const titolo = calcolo?.impostazioni.nome?.trim() || "Cruscotto";
  const descrizione = calcolo
    ? `Anno ${anno} · regime ${calcolo.impostazioni.regime} · ${nomeGestione(calcolo.impostazioni.gestione)}`
    : undefined;

  if (!calcolo || !analisi) {
    return (
      <Guscio titolo="Cruscotto">
        <Card>
          <CaricamentoTabella righe={4} />
        </Card>
      </Guscio>
    );
  }

  const { prospetto: p, iva } = calcolo;
  const nettoSemaforo = p.incassatoLordo - p.caricoTotale - p.ivaIncassata;
  const scaduto = p.fattureCalcolate
    .filter((f) => f.stato === "scaduto")
    .reduce((a, f) => a + f.nettoIncasso, 0);
  const costiAnno = p.costiPagatiTotale;
  const margine = p.ricaviRilevanti - p.costiNettiACarico;
  // La quota di limite forfettario, che finora stava solo nel prospetto: chi
  // guarda il cruscotto e basta non sapeva quanto gli restava.
  const quota = quotaLimite(p, calcolo.impostazioni);
  /*
    Il periodo IVA in corso, e la prima scadenza in arrivo. Vengono dagli
    stessi due oggetti che alimentano la schermata IVA e lo scadenzario: se un
    giorno divergessero sarebbe un difetto da correggere lì, non da aggirare
    qui con un secondo calcolo.
  */
  const periodoIva = periodoIvaCorrente(iva, oggi, anno);
  /*
    Il primo *versamento* in arrivo, non il primo adempimento: una
    dichiarazione da presentare non è denaro che esce, e in una card che
    risponde a «quanto e quando pago» sarebbe fuori posto.
  */
  const inArrivo = prossimeScadenze(
    [...analisi.scadenze, ...analisi.scadenzeSuccessive],
    oggi,
    40,
  ).filter((s) => s.categoria !== "dichiarazione");
  /*
    Tutto quello che cade nello stesso giorno, non solo la prima voce: il 16
    novembre un artigiano versa la rata INPS *e* l'IVA del trimestre, e una
    card che ne mostrasse una sola direbbe un numero più basso del vero
    proprio nel punto in cui si guarda quanto serve sul conto.
  */
  const primaData = inArrivo[0]?.data ?? null;
  const dovute = inArrivo.filter((s) => s.data === primaData);
  const conImporto = dovute.filter((s) => s.importo !== null);
  const prossima = dovute[0] ?? null;
  const importoProssima =
    conImporto.length > 0 ? round2(conImporto.reduce((a, s) => a + (s.importo ?? 0), 0)) : null;
  // Quanto del fabbisogno copre la percentuale impostata. `null` quando non
  // c'è niente da coprire: una percentuale su zero non vuol dire niente.
  // Anno contro anno: la percentuale impostata lavora su tutti i ricavi e ha
  // già finanziato i versamenti fatti. Contro il residuo mostrava il 154 %.
  const copertura = p.fabbisognoAnnuo > 0 ? p.accantonamentoAnnuo / p.fabbisognoAnnuo : null;

  return (
    <Guscio titolo={titolo} descrizione={descrizione}>
      <div className="space-y-6">
        <InvitoPercorso anno={anno} oggi={oggi} />

        <SemaforoFiscale
          totale={p.incassatoLordo}
          segmenti={[
            {
              chiave: "netto",
              etichetta: "Netto tuo",
              valore: nettoSemaforo,
              colore: COLORI_SEMAFORO.netto,
              dettaglio: `Prima dei costi dell'attività. Al netto anche di quelli restano ${euro(p.nettoDisponibile)}.`,
            },
            {
              chiave: "imposte",
              etichetta: "Imposte",
              valore: p.totaleImposte,
              colore: COLORI_SEMAFORO.imposte,
              dettaglio:
                p.regime === "forfettario"
                  ? `Imposta sostitutiva: ${euro(p.imponibile)} × ${percentuale(calcolo.impostazioni.aliquotaSostitutiva, 0)} = ${euro(p.impostaSostitutiva)}.`
                  : `IRPEF ${euro(p.irpefNetta)} più addizionali per ${euro(p.addizionaleRegionale + p.addizionaleComunale)}.`,
            },
            {
              chiave: "contributi",
              etichetta: "Contributi",
              valore: p.totaleContributi,
              colore: COLORI_SEMAFORO.contributi,
              dettaglio: `${euro(p.baseContributiva)} × ${percentuale(calcolo.impostazioni.aliquotaGestioneSeparata, 2)}, fino al massimale di ${euro(calcolo.impostazioni.massimaleGs)}.`,
            },
            {
              chiave: "iva",
              etichetta: "IVA incassata",
              valore: p.ivaIncassata,
              colore: COLORI_SEMAFORO.iva,
              dettaglio: `Riscossa dai clienti e da girare all'erario. Da versare nell'anno: ${euro(iva.totaleDaVersare)}.`,
            },
          ]}
        />

        {/*
          Sul telefono i quattro indicatori piccoli stanno a due a due: la loro
          cifra ci sta, e quattro righe intere di card prima del resto sono
          duecento pixel di scorrimento che non servono a nessuno. I cinque
          grandi restano uno per riga — «45.650,00 €» a mezza larghezza non si
          legge — e la coppia emesso/incassato si legge in verticale, nell'ordine
          in cui succedono le cose.
        */}
        <section
          aria-label="Indicatori principali"
          className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {/*
            Il fatturato emesso prima dell'incassato: è il numero con cui si
            descrive il proprio anno, e la coppia si legge nell'ordine in cui
            succedono le cose — quanto ho fatturato, quanto è entrato.
          */}
          <Kpi
            className="col-span-2 sm:col-span-1"
            etichetta="Fatturato emesso"
            valore={euro(p.fatturatoEmesso)}
            nota={
              p.note.stornoEmesso > 0
                ? `al netto di ${euro(p.note.stornoEmesso)} di storni · per data di fattura`
                : `fatture emesse nel ${p.anno}, per data di fattura`
            }
            sotto={
              quota && (
                <p className={quota.oltreProiettando ? "text-[#B8791A]" : "text-inchiostro-tenue"}>
                  {quota.testo}
                </p>
              )
            }
          />
          <Kpi
            className="col-span-2 sm:col-span-1"
            sfondo="indaco"
            etichetta="Incassato"
            valore={euro(p.ricaviRilevanti)}
            // Al netto dell'IVA: la barra qui sopra conta il lordo, e senza
            // dirlo i due numeri sembrano lo stesso numero sbagliato.
            nota={`al netto dell'IVA · su ${euro(p.fatturatoEmesso)} emessi`}
            chip={
              p.fatturatoEmesso > 0 ? (
                <Chip tono="chiaro" className="cifre">
                  {percentuale(p.ricaviRilevanti / p.fatturatoEmesso, 0)}
                </Chip>
              ) : undefined
            }
          />
          <Kpi
            className="col-span-2 sm:col-span-1"
            sfondo="ambra"
            etichetta="Da incassare"
            valore={euro(p.soglia.inSospeso)}
            nota={scaduto > 0 ? `di cui ${euro(scaduto)} già scaduti` : "tutto nei termini"}
          />
          <Kpi
            className="col-span-2 sm:col-span-1"
            etichetta="Carico totale"
            valore={euro(p.caricoTotale)}
            nota={`imposte ${euro(p.totaleImposte)} · contributi ${euro(p.totaleContributi)}`}
          />
          <Kpi
            className="col-span-2 sm:col-span-1"
            sfondo="scuro"
            etichetta="Pressione effettiva"
            valore={percentuale(p.pressione)}
            nota="su ogni euro incassato"
          />

          <Kpi taglia="kpiSm" etichetta="Costi dell'anno" valore={euro(costiAnno)} nota="uscita di cassa, IVA compresa" />
          <Kpi
            taglia="kpiSm"
            etichetta="Margine lordo"
            valore={euro(margine)}
            nota={p.ricaviRilevanti > 0 ? `${percentuale(margine / p.ricaviRilevanti, 0)} dell'incassato` : "—"}
          />
          <Kpi
            taglia="kpiSm"
            etichetta="Netto disponibile"
            valore={euro(p.nettoDisponibile)}
            nota="prima delle spese personali"
          />
        </section>

        {/*
          Quello che devi mettere da parte, e quando esce davvero dal conto.

          Stanno insieme perché rispondono alla stessa domanda da tre lati:
          quanto al mese, quanto alla prossima scadenza, e se la percentuale
          che hai impostato basta. L'IVA resta fuori dall'accantonamento — ha
          ritmo trimestrale, e mensilizzarla nasconderebbe quando esce — ma ha
          la sua card, perché nella barra in cima compare come quota non tua e
          poi non si vedeva più da nessuna parte.
        */}
        <section
          aria-label="Quanto mettere da parte, e quando esce"
          className="grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <Kpi
            taglia="kpiSm"
            etichetta="Quota mensile del fabbisogno"
            valore={euro(p.accantonamentoMensile)}
            nota="quello che resta da versare, diviso dodici"
            sotto={
              // Il carico dell'anno è un altro numero, più alto: se una parte è
              // già stata versata o trattenuta, va detto qui, dove si guarda
              // quanto mettere da parte.
              p.caricoTotale > p.fabbisognoDaAccantonare ? (
                <p className="text-inchiostro-tenue">
                  su {euro(p.caricoTotale)} di carico, il resto è già coperto
                </p>
              ) : undefined
            }
          />
          {periodoIva && (
            <Kpi
              taglia="kpiSm"
              etichetta="IVA da versare"
              valore={euro(periodoIva.totaleDaVersare)}
              // La riga deve tornare: debito meno detraibile, meno l'eventuale
              // credito riportato, più la maggiorazione del trimestrale. Se
              // manca un pezzo, la sottrazione non dà il numero grande sopra.
              nota={
                `${periodoIva.etichetta}: ${euro(periodoIva.debito)} a debito meno ` +
                `${euro(periodoIva.credito)} detraibile` +
                (periodoIva.creditoPrecedente > 0
                  ? ` e ${euro(periodoIva.creditoPrecedente)} di credito riportato`
                  : "") +
                (periodoIva.maggiorazione > 0
                  ? `, più ${euro(periodoIva.maggiorazione)} di maggiorazione`
                  : "")
              }
              sotto={
                periodoIva.scadenza ? (
                  <p className="text-inchiostro-tenue">si versa il {fmtData(periodoIva.scadenza)}</p>
                ) : undefined
              }
            />
          )}
          <Kpi
            taglia="kpiSm"
            etichetta="Prossima scadenza"
            valore={importoProssima !== null ? euro(importoProssima) : "—"}
            nota={
              !prossima
                ? "nessuna scadenza in arrivo"
                : dovute.length === 1
                  ? prossima.titolo
                  : dovute.map((s) => s.titolo).join(" · ")
            }
            sotto={
              prossima ? (
                <p className="text-inchiostro-tenue">
                  {fmtData(prossima.data)}
                  {dovute.length > 1 && ` · ${dovute.length} versamenti lo stesso giorno`}
                  {importoProssima === null &&
                    (prossima.nota ? " · importo non calcolabile" : " · importo non stimato")}
                  {importoProssima !== null &&
                    conImporto.length < dovute.length &&
                    " · uno degli importi non è stimato"}
                </p>
              ) : undefined
            }
          />
          <Kpi
            taglia="kpiSm"
            etichetta="Copertura dell'accantonamento"
            valore={copertura === null ? "—" : coperturaScritta(copertura)}
            nota={
              copertura === null
                ? "niente da mettere da parte: ritenute e crediti coprono già il carico"
                : `il ${percentuale(p.percentualeImpostata, 0)} dei ricavi fa ${euro(p.accantonamentoAnnuo)} sui ${euro(p.fabbisognoAnnuo)} che l'anno costa`
            }
            sotto={
              p.scostamentoAccantonamento < 0 ? (
                p.accantonamentoSufficiente ? (
                  <p className="text-inchiostro-tenue">
                    mancano {euro(-p.scostamentoAccantonamento)}: dentro la tolleranza, va bene così
                  </p>
                ) : (
                  <p className="text-[#B8791A]">
                    mancano {euro(-p.scostamentoAccantonamento)}: porta la percentuale almeno al{" "}
                    {Math.ceil(p.percentualeTeoricaAccantonamento * 100)}%
                  </p>
                )
              ) : undefined
            }
          />
        </section>

        <section aria-label="Cosa richiede attenzione">
          <Card>
            <CardCorpo className="pb-2">
              <CardTitolo>Cosa richiede la tua attenzione</CardTitolo>
              <CardSottotitolo>
                {analisi.giorniMedi !== null
                  ? `I tuoi clienti pagano in media in ${analisi.giorniMedi} giorni.`
                  : "Le prime fatture incassate diranno quanto ci mettono i tuoi clienti a pagare."}
              </CardSottotitolo>
            </CardCorpo>
            <ul className="divide-y divide-bordo/70">
              {analisi.avvisi.map((a) => (
                <RigaAvviso key={a.id} avviso={a} />
              ))}
            </ul>
          </Card>
        </section>

        <section aria-label="Grafici" className="grid gap-4 xl:grid-cols-2">
          <GraficoAndamento mesi={analisi.mesi} />
          <GraficoConcentrazione righe={analisi.portafoglio} />
        </section>

        <section aria-label="Prossime scadenze">
          <Card>
            <CardCorpo className="pb-2">
              <CardTitolo>Prossime scadenze</CardTitolo>
              <CardSottotitolo>
                Le date che cadono di sabato o in un festivo sono già spostate al primo
                giorno lavorativo utile.
              </CardSottotitolo>
            </CardCorpo>
            {analisi.prossime.length === 0 ? (
              <p className="px-4 pb-5 text-corpo text-inchiostro-tenue sm:px-6 sm:pb-6">
                Nessun adempimento resta nel {anno}. Il prossimo appuntamento è il saldo di
                giugno, che si calcola sulla dichiarazione di quest&apos;anno.
              </p>
            ) : (
              <ul className="divide-y divide-bordo/70">
                {analisi.prossime.map((s) => (
                  <RigaScadenza key={s.id} scadenza={s} oggi={oggi} />
                ))}
              </ul>
            )}
          </Card>
        </section>

        <p className="max-w-3xl pb-2 text-etichetta text-inchiostro-tenue">
          Strumento gestionale di pianificazione: produce stime, non dichiarazioni. Non
          considera altri redditi che in regime ordinario concorrono a formare il reddito
          complessivo e possono spostare lo scaglione IRPEF. I numeri definitivi restano
          quelli del tuo commercialista.
        </p>
      </div>
    </Guscio>
  );
}

function RigaAvviso({ avviso }: { avviso: Avviso }) {
  const Icona =
    avviso.tono === "positivo" ? Check : avviso.tono === "accento" ? Info : TriangleAlert;
  const colore = {
    positivo: "text-positivo",
    attenzione: "text-attenzione",
    negativo: "text-negativo",
    accento: "text-accento",
  }[avviso.tono];

  return (
    <li className="flex flex-wrap items-start gap-3 px-4 py-3 sm:px-6">
      <Icona className={cn("mt-0.5 size-4 shrink-0", colore)} aria-hidden />
      {/*
        Il minimo serve a far scattare il flex-wrap: con `min-w-0` il testo si
        restringeva all'infinito e su 320 px veniva fuori una parola per riga
        con il collegamento di fianco, invece di due righe pulite. 48 sul
        telefono, 64 da tablet in su.
      */}
      <p className="min-w-48 flex-1 text-corpo sm:min-w-64">{avviso.testo}</p>
      {avviso.azione && (
        <Link
          href={avviso.azione.href}
          className="shrink-0 rounded-campo px-2 py-2 text-etichetta font-medium text-accento transition-colors hover:bg-accento-tenue sm:py-1"
        >
          {avviso.azione.etichetta}
        </Link>
      )}
    </li>
  );
}

function RigaScadenza({ scadenza, oggi }: { scadenza: Adempimento; oggi: string }) {
  const giorni = giorniAllaData(scadenza.data, oggi);
  const imminente = giorni <= 15;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <span className="flex min-w-48 flex-1 items-center gap-3">
        <CalendarClock
          className={cn("size-4 shrink-0", imminente ? "text-attenzione" : "text-inchiostro-tenue")}
          aria-hidden
        />
        <span className="min-w-0">
          {/*
            A 375 px il titolo perdeva più della metà — «Secondo acconto di imposte
            e contr…» — sulla schermata che si guarda per prima. Va a capo: la riga
            cresce di una riga di testo, la scadenza conserva il nome.
          */}
          <span className="block text-corpo">{scadenza.titolo}</span>
          <span className="block text-micro text-inchiostro-tenue">
            {fmtData(scadenza.data)} · {giorni === 0 ? "oggi" : giorni === 1 ? "domani" : `fra ${giorni} giorni`}
            {scadenza.dataDiCalendario &&
              ` · spostata dal ${fmtData(scadenza.dataDiCalendario)}, festivo`}
          </span>
        </span>
      </span>
      {/* Come nello scadenzario: andando a capo l'importo resta a destra. */}
      <span className="cifre ml-auto shrink-0 text-corpo font-medium">
        {scadenza.importo === null ? (
          <span className="text-etichetta font-normal text-inchiostro-tenue">
            adempimento dichiarativo
          </span>
        ) : (
          euro(scadenza.importo)
        )}
      </span>
    </li>
  );
}

function nomeGestione(gestione: string): string {
  return gestione === "separata"
    ? "Gestione Separata INPS"
    : gestione === "artigiani"
      ? "Artigiani e commercianti"
      : "Cassa professionale";
}

