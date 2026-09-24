"use client";

/**
 * Quanto posso spendere: il punto del modulo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Due vincoli, e vince il più severo
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il mese dice quanto permettono le entrate, tolti accantonamento, spese
 * fisse, risparmi e rate. Il conto dice quanto permette la giacenza, tolti il
 * cuscinetto, gli impegni del mese e **i soldi del fisco che sono in banca e
 * non sono tuoi**. Sono due domande diverse, e la risposta è la più bassa.
 *
 * Quale delle due ha vinto si dice sempre. Un numero che scende senza dire
 * perché si legge come un errore dell'app, e il mese dopo non si guarda più.
 */
import * as React from "react";
import Link from "next/link";
import { PiggyBank } from "lucide-react";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Cifra, Etichetta } from "@/components/ui/etichetta";
import { Campo, Input } from "@/components/ui/input";
import { BloccoScrittura } from "@/components/ui/blocco-scrittura";
import { Switch } from "@/components/ui/switch";
import { Vuoto } from "@/components/ui/vuoto";
import { Guscio } from "@/components/guscio/guscio";
import { ROTTE } from "@/lib/rotte";
import { Button } from "@/components/ui/button";
import { useDati, useSituazioneMese } from "@/lib/dati/hooks";
import { usePreferenze } from "@/lib/stato/preferenze";
import { salvaImpostazioniPf } from "@/lib/dati/azioni";
import type { ChiPagaIlFisco, ImpostazioniPf } from "@/lib/finanze/tipi";
import type { FiscoDelMese } from "@/lib/finanze/mese";
import { analizzaNumero, data as fmtData, euro, nomeMese } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SchermataSpesa() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const dati = useDati();

  /*
    Il calcolo non sta qui: sta in `lib/finanze/mese.ts`, e ci sta da quando
    una seconda schermata — il budget — ha avuto bisogno degli stessi numeri.
    Dentro un `useMemo` era anche logica che si poteva provare solo aprendo il
    browser; fuori ha i suoi test.
  */
  const conto = useSituazioneMese(anno, oggi);

  if (!dati || !conto) {
    return (
      <Guscio titolo="Quanto posso spendere">
        <Card>
          <CaricamentoTabella righe={6} />
        </Card>
      </Guscio>
    );
  }

  if (dati.pfConti.length === 0) {
    return (
      <Guscio titolo="Quanto posso spendere" descrizione="Il limite del mese, e quello del conto">
        <div className="mx-auto max-w-4xl">
          <Card>
            <Vuoto
              icona={PiggyBank}
              titolo="Prima servono i conti: senza saldo non c'è nessun tetto da calcolare."
              azione={
                <Button asChild variante="contorno">
                  <Link href={ROTTE.finanzeConti}>Vai a Conti e patrimonio</Link>
                </Button>
              }
            />
          </Card>
        </div>
      </Guscio>
    );
  }

  const {
    impostazioni,
    fisco,
    riga,
    dalMese,
    tetto,
    effettivo,
    meseCorrente,
    meseSenzaDati,
    meseSenzaEntrate,
  } = conto;
  /* Le tasse le paga il conto dell'attività: qui non si toglie niente. */
  const fiscoAltrove = fisco.chiPaga === "attivita";

  /*
    Due modi diversi di non avere un limite del mese, con la stessa
    conseguenza: si mostra quello che permette il conto, e si dice perché.

    Il secondo è il caso normale di chi importa solo la carta di credito: di
    quel mese si sanno le uscite e non gli incassi, e il limite esce negativo
    — l'accantonamento e le spese fisse sottratti a zero entrate. Quel numero
    non è un limite, è la misura di quanto manca all'importazione.
  */
  const senzaLimiteDelMese = meseSenzaDati || meseSenzaEntrate;

  /*
    Le scadenze che stanno dentro il fisco da versare, nominate. La più
    lontana è quasi sempre il saldo dell'anno, che si versa a giugno di
    quello dopo: è il pezzo che rende il tetto severo a gennaio.
  */
  const voci = [...conto.quota.imposte.voci, ...conto.quota.iva.voci];
  const ultimaScadenza =
    voci.length === 0 ? null : voci.map((v) => v.data).sort().slice(-1)[0];
  const elencoScadenze =
    voci.length === 0
      ? "quello che resta da mettere da parte per imposte, contributi e IVA."
      : `${voci.length === 1 ? "una scadenza" : `${voci.length} scadenze`}: ${voci
          .map((v) => v.titolo.toLowerCase())
          .join(", ")}.`;
  const stretto = effettivo.vincolo === "conto";
  /* Senza un limite del mese vale il solo tetto: vedi il commento qui sopra. */
  const mostrato = senzaLimiteDelMese ? tetto.tetto - riga.speso : effettivo.limite;

  return (
    <Guscio
      titolo="Quanto posso spendere"
      descrizione={`${nomeMese(meseCorrente)} ${anno} · quello che resta per le spese variabili`}
    >
      <div className="mx-auto max-w-4xl space-y-4">
        <Card className="p-5">
          <Etichetta>Puoi ancora spendere</Etichetta>
          <Cifra className={cn("mt-3", mostrato < 0 && "text-negativo")}>{euro(mostrato)}</Cifra>
          <p className="mt-1.5 text-micro text-inchiostro-tenue">
            {dalMese.giorniRimasti > 0
              ? `${dalMese.giorniRimasti} ${dalMese.giorniRimasti === 1 ? "giorno" : "giorni"} alla fine del mese · ${euro(mostrato / dalMese.giorniRimasti)} al giorno`
              : "il mese è finito"}
          </p>

          {/*
            Chi ha deciso, e di quanto. È la riga che rende il numero
            leggibile: senza, una cifra che scende sembra un errore.
          */}
          <p
            className={cn(
              "mt-3 text-etichetta",
              stretto && !senzaLimiteDelMese ? "text-attenzione" : "text-inchiostro-tenue",
            )}
          >
            {meseSenzaEntrate ? (
              <>
                <strong>Questo è quello che permette il conto.</strong> Di{" "}
                {nomeMese(meseCorrente).toLowerCase()} ci sono movimenti, ma{" "}
                <strong>nessuna entrata registrata</strong>: succede quando si carica solo il
                rendiconto di una carta, o di un conto su cui gli incassi non arrivano. Il limite
                del mese parte dalle entrate, quindi senza quelle non si può calcolare — uscirebbe
                negativo, e sarebbe la misura di quanto manca all&apos;importazione, non di quanto
                puoi spendere.{" "}
                <Link href={ROTTE.finanzeRendiconto} className="underline underline-offset-2">
                  Carica anche il conto dove arrivano gli incassi
                </Link>{" "}
                o registra le entrate a mano.
              </>
            ) : meseSenzaDati ? (
              <>
                <strong>Questo è quello che permette il conto.</strong> Di{" "}
                {nomeMese(meseCorrente).toLowerCase()} non c&apos;è ancora nessun movimento e
                nessun budget, quindi il limite del mese non si può calcolare: non sarebbe zero,
                sarebbe una cifra inventata.{" "}
                <Link href={ROTTE.finanzeRendiconto} className="underline underline-offset-2">
                  Carica il rendiconto
                </Link>{" "}
                o registra qualche movimento.
              </>
            ) : stretto ? (
              <>
                <strong>Te lo impone il conto, non il mese.</strong> Le entrate del mese
                permetterebbero {euro(effettivo.dalMese)}, ma sul conto — tolti il cuscinetto, gli
                impegni del mese e i soldi del fisco — ne restano {euro(effettivo.dalConto)}:{" "}
                {euro(effettivo.differenza)} di differenza.
              </>
            ) : (
              <>Il limite è quello del mese. Il conto ne permetterebbe {euro(effettivo.dalConto)}.</>
            )}
          </p>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardCorpo className="pb-2">
              <CardTitolo>Il mese</CardTitolo>
              <CardSottotitolo>Quello che permettono le entrate</CardSottotitolo>
            </CardCorpo>
            <dl className="divide-y divide-bordo/70 border-y border-bordo text-etichetta">
              <Voce etichetta="Entrate" valore={riga.entrate} />
              {/*
                «questo mese»: accanto, nella colonna del conto, c'è l'altra
                cifra del fisco — quella di tutto l'anno. Due numeri per lo
                stesso argomento sulla stessa schermata vanno distinti
                dall'etichetta, non dalla posizione.
              */}
              <Voce etichetta="Fisco da accantonare, questo mese" valore={-riga.accantonamento} />
              <Voce etichetta="Spese fisse" valore={-riga.fisse} />
              <Voce etichetta="Risparmi" valore={-riga.risparmi} />
              <Voce etichetta="Rate" valore={-riga.rate} />
              {riga.riporto !== 0 && <Voce etichetta="Riporto dal mese prima" valore={riga.riporto} />}
              <Voce etichetta="Limite del mese" valore={riga.limite} forte />
              <Voce etichetta="Già speso" valore={-riga.speso} />
              <Voce etichetta="Resta" valore={dalMese.resta} forte />
            </dl>
            {/*
              Un riporto negativo che arriva da un mese importato a metà è la
              ragione per cui un mese con i suoi incassi può avere un limite
              basso o negativo. Il calcolo non lo può distinguere da un mese in
              cui non si è incassato davvero — indovinare non si può — ma la
              riga lo dice, che è l'unica cosa onesta da fare.
            */}
            {conto.riportoDaMeseSenzaEntrate && (
              <CardCorpo className="pt-2">
                <p className="text-micro text-attenzione">
                  Il riporto negativo viene da {nomeMese(meseCorrente - 1).toLowerCase()}: quel
                  mese ha movimenti ma nessuna entrata registrata, quindi il suo avanzo è un
                  disavanzo grande quanto l&apos;accantonamento e le spese.{" "}
                  <Link href={ROTTE.finanzeRendiconto} className="underline underline-offset-2">
                    Carica anche gli incassi di quel mese
                  </Link>{" "}
                  e il riporto torna quello vero.
                </p>
              </CardCorpo>
            )}
            {/*
              La riga del fisco è a zero, e questo è il posto in cui si dice
              perché. Farla sparire sarebbe un numero cambiato senza
              spiegazione: chi ha visto la schermata il mese scorso non
              troverebbe più la voce e non saprebbe cosa è successo.
            */}
            {fiscoAltrove && (
              <CardCorpo className="pt-2">
                <p className="text-micro text-inchiostro-tenue">
                  Il fisco è a zero perché gli F24 li paga il conto
                  dell&apos;attività: quello che arriva qui è già al netto delle tasse, e
                  toglierle di nuovo le toglierebbe due volte. Il fondo si guarda nella{" "}
                  <Link href={ROTTE.cashflow} className="underline underline-offset-2">
                    liquidità netta del Cashflow
                  </Link>
                  .
                </p>
              </CardCorpo>
            )}
            {riga.stimate.length > 0 && (
              <CardCorpo className="pt-2">
                <p className="text-micro text-inchiostro-tenue">
                  {riga.stimate.length === 4 ? "Tutte le voci sono" : "Alcune voci sono"} una stima:
                  nel mese in corso vale il maggiore fra quello che è già successo e quello a
                  budget.
                </p>
              </CardCorpo>
            )}
          </Card>

          <Card>
            <CardCorpo className="pb-2">
              <CardTitolo>Il conto</CardTitolo>
              <CardSottotitolo>Quello che permette la giacenza</CardSottotitolo>
            </CardCorpo>
            <dl className="divide-y divide-bordo/70 border-y border-bordo text-etichetta">
              <Voce etichetta="Saldo dei conti, oggi" valore={tetto.saldoConti} />
              <Voce etichetta="Cuscinetto" valore={-tetto.cuscinetto} />
              <Voce etichetta="Fisse, risparmi e rate del mese" valore={-tetto.impegniDelMese} />
              {/*
                La sottrazione che il brief non aveva: a settembre, con due
                trimestri di IVA da versare e il secondo acconto a novembre,
                quel denaro è in banca e non è disponibile.
              */}
              <Voce
                etichetta="Fisco ancora da versare in tutto, già in banca"
                valore={-tetto.fiscoNonVersato}
              />
              <Voce etichetta="Tetto dal conto" valore={tetto.tetto} />
              {/*
                Il già speso anche qui, e non solo nella colonna del mese.

                Senza questa riga il pannello finiva con «tetto dal conto
                4.800,66 €» mentre la frase in alto diceva 4.660,66 €: due
                numeri per la stessa cosa sulla stessa schermata, diversi di
                quello che era già uscito. Chi li vede tutti e due non sa quale
                credere, ed è la famiglia di difetti che questo progetto
                insegue — trovata qui guardando lo schermo, non il codice.
              */}
              <Voce etichetta="Già speso" valore={-riga.speso} />
              <Voce etichetta="Resta dal conto" valore={effettivo.dalConto} forte />
            </dl>
            {/*
              Che cosa c'è dentro la sottrazione più grossa della colonna.

              Se comprende il saldo che si versa a giugno dell'anno prossimo —
              e di norma lo comprende — il tetto è severo a gennaio e si
              allenta verso dicembre, man mano che quel debito viene versato.
              È un comportamento giusto ma sorprendente, e una cifra grossa che
              si muove da sola senza spiegazione si legge come un errore.
            */}
            <CardCorpo className="pt-3 pb-0">
              {fiscoAltrove ? (
                <p className="text-micro text-inchiostro-tenue">
                  Anche qui il fisco è a zero: quei soldi da questo conto non passano. Da
                  versare restano {elencoScadenze} Le paga il conto dell&apos;attività, e sulla
                  sua cassa si vedono.
                </p>
              ) : (
              <p className="text-micro text-inchiostro-tenue">
                Il fisco da versare comprende {elencoScadenze}
                {ultimaScadenza !== null && (
                  <>
                    {" "}L&apos;ultima scade il {fmtData(ultimaScadenza)}: fino ad allora quel
                    denaro resta sul conto e il tetto lo tiene fuori, quindi si allenta a ogni
                    versamento.
                  </>
                )}
              </p>
              )}
            </CardCorpo>

            <CardCorpo className="pt-3">
              <ImpostazioniSpesa impostazioni={impostazioni} />
            </CardCorpo>
          </Card>
        </div>

        <DomandaChiPaga fisco={fisco} impostazioni={impostazioni} />

        {/* Le due cifre del fisco le spiegano già le loro righe: qui resta solo
            da dire da dove vengono, che è l'unica cosa che manca. */}
        <p className="text-micro text-inchiostro-tenue">
          Tutte e due le cifre del fisco arrivano dal motore fiscale, dallo stesso calcolo della
          card del cruscotto: qui non si ricalcola niente.
        </p>
      </div>
    </Guscio>
  );
}

function Voce({
  etichetta,
  valore,
  forte = false,
}: {
  etichetta: string;
  valore: number;
  forte?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-3 px-6 py-1.5",
        forte && "bg-superficie-alt/70 font-medium",
      )}
    >
      <dt>{etichetta}</dt>
      {/*
        `-0` è un numero, e `euro()` lo scrive «−0,00 €»: un meno davanti a
        niente, che si legge come un errore di calcolo. Sommare zero lo
        riporta allo zero normale.
      */}
      <dd className={cn("cifre", valore < 0 && "text-inchiostro-tenue", forte && "text-inchiostro")}>
        {euro(valore === 0 ? 0 : valore)}
      </dd>
    </div>
  );
}

/**
 * La domanda sola: «gli F24 da quale conto li paghi?».
 *
 * Non è una preferenza, è un fatto che chi legge ha davanti agli occhi — ed è
 * l'unico modo di chiederlo che non si faccia rispondere a caso. «Ti prelevi il
 * lordo o il netto?» sarebbe la stessa domanda posta in una lingua che nessuno
 * parla.
 *
 * La risposta arriva già proposta da quello che l'app ha misurato, e i motivi
 * stanno scritti sotto: così è una conferma, non una decisione da prendere al
 * buio. E se un giorno l'archivio dirà il contrario della risposta salvata, la
 * schermata lo dice invece di tenersi una dichiarazione vecchia.
 */
function DomandaChiPaga({
  fisco,
  impostazioni,
}: {
  fisco: FiscoDelMese;
  impostazioni: ImpostazioniPf;
}) {
  const scegli = (fiscoPagatoDa: ChiPagaIlFisco) =>
    void salvaImpostazioniPf({ ...impostazioni, fiscoPagatoDa });
  const opzioni: { valore: ChiPagaIlFisco; etichetta: string }[] = [
    { valore: "attivita", etichetta: "Dal conto dell'attività" },
    { valore: "personale", etichetta: "Da questo conto" },
  ];
  const altro: ChiPagaIlFisco = fisco.chiPaga === "attivita" ? "personale" : "attivita";
  const parlanti = fisco.lettura.indizi.filter((i) => i.verso !== null);

  return (
    <Card>
      <CardCorpo>
        <CardTitolo>Gli F24 da quale conto li paghi?</CardTitolo>
        <CardSottotitolo>
          Da qui dipende se il limite del mese toglie la quota del fisco. Se le tasse le paga
          il conto dell&apos;attività, quello che arriva sul conto personale è già netto:
          toglierla di nuovo la toglierebbe due volte, e il limite uscirebbe più basso del vero
          di tutta la quota.
        </CardSottotitolo>

        <BloccoScrittura className="mt-4 flex flex-wrap gap-2">
          {opzioni.map((o) => (
            <Button
              scrive
              key={o.valore}
              variante={fisco.chiPaga === o.valore ? "scuro" : "contorno"}
              taglia="sm"
              aria-pressed={fisco.chiPaga === o.valore}
              onClick={() => scegli(o.valore)}
            >
              {o.etichetta}
            </Button>
          ))}
        </BloccoScrittura>

        {/*
          La dichiarazione salvata contro quello che l'archivio dice adesso.
          Un modo di pagare cambia — si apre un conto, si smette di girare
          l'F24 al commercialista — e una risposta data a gennaio è
          indistinguibile da una giusta. Nessuno torna qui a ricontrollarla.
        */}
        {fisco.contraddetta && (
          <p className="mt-3 rounded-lg bg-attenzione-tenue px-3 py-2 text-micro text-inchiostro">
            Hai risposto{" "}
            <strong>
              {fisco.chiPaga === "attivita" ? "dal conto dell'attività" : "da questo conto"}
            </strong>
            , ma adesso l&apos;archivio dice il contrario:{" "}
            {parlanti.map((i) => i.testo.replace(/\.$/, "")).join("; ")}.{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => scegli(altro)}
            >
              Cambia la risposta
            </button>
            .
          </p>
        )}

        <p className="mt-3 text-micro text-inchiostro-tenue">
          {fisco.fonte === "dichiarato" && !fisco.contraddetta && "L'hai detto tu, e l'archivio non dice niente di diverso."}
          {fisco.fonte === "misurato" &&
            "Non l'hai ancora detto: questa è la risposta che l'app misura dall'archivio. Confermala, o cambiala."}
          {fisco.fonte === "predefinito" &&
            "Non l'hai ancora detto e i segnali non bastano per dirlo: vale «da questo conto», che è il verso prudente — fa spendere meno del dovuto invece di far spendere i soldi del fisco."}
        </p>

        <ul className="mt-2 space-y-1 text-micro text-inchiostro-tenue">
          {fisco.lettura.indizi.map((i) => (
            <li key={i.id} className="flex gap-2">
              <span aria-hidden className={i.verso === null ? "text-inchiostro-debole" : undefined}>
                {i.verso === null ? "·" : "→"}
              </span>
              <span>{i.testo}</span>
            </li>
          ))}
        </ul>
      </CardCorpo>
    </Card>
  );
}

function ImpostazioniSpesa({ impostazioni }: { impostazioni: ImpostazioniPf }) {
  const [cuscinetto, setCuscinetto] = React.useState(
    impostazioni.cuscinetto === 0 ? "" : String(impostazioni.cuscinetto).replace(".", ","),
  );
  const idRiporto = React.useId();

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <BloccoScrittura>
        <Campo etichetta="Cuscinetto" htmlFor="cuscinetto" className="w-36">
          <Input
            id="cuscinetto"
            numerico
            inputMode="decimal"
            value={cuscinetto}
            placeholder="0,00"
            onChange={(e) => setCuscinetto(e.target.value)}
            onBlur={() =>
              void salvaImpostazioniPf({
                ...impostazioni,
                cuscinetto: Math.max(0, analizzaNumero(cuscinetto) ?? 0),
              })
            }
          />
        </Campo>
      </BloccoScrittura>
      <span className="flex items-center gap-2">
        <Switch
          id={idRiporto}
          checked={impostazioni.riportoAttivo}
          onCheckedChange={(v) => void salvaImpostazioniPf({ ...impostazioni, riportoAttivo: v })}
        />
        <label htmlFor={idRiporto} className="cursor-pointer text-micro">
          Porta l&apos;avanzo al mese dopo
        </label>
      </span>
    </div>
  );
}
