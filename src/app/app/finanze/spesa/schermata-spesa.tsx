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
import { useCalcoloAnno, useDati } from "@/lib/dati/hooks";
import { usePreferenze } from "@/lib/stato/preferenze";
import { salvaImpostazioniPf } from "@/lib/dati/azioni";
import { parametriDi } from "@/lib/fisco/parametri";
import { quotaAccantonamento } from "@/lib/fisco/accantonamento";
import { quantoResta, tabellaLimite } from "@/lib/finanze/limite";
import { saldoTotale } from "@/lib/finanze/saldo";
import { limiteEffettivo, tettoDalConto } from "@/lib/finanze/tetto";
import { IMPOSTAZIONI_PF_PREDEFINITE } from "@/lib/finanze/tipi";
import { analizzaNumero, euro, nomeMese } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SchermataSpesa() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const dati = useDati();
  const calcolo = useCalcoloAnno(anno, oggi);
  const precedente = useCalcoloAnno(anno - 1, oggi);

  const conto = React.useMemo(() => {
    if (!dati || !calcolo) return null;
    const impostazioni = dati.pfImpostazioni[0] ?? IMPOSTAZIONI_PF_PREDEFINITE;
    const meseCorrente = Number(oggi.slice(5, 7));

    /*
      La quota del mese e il fisco non ancora versato vengono dallo stesso
      calcolo del cruscotto: una fonte sola per due schermate, altrimenti
      sono due numeri che prima o poi smettono di essere d'accordo.
    */
    const quota = quotaAccantonamento({
      prospetto: calcolo.prospetto,
      impostazioni: calcolo.impostazioni,
      parametri: parametriDi(anno),
      iva: calcolo.iva,
      versamenti: dati.versamenti,
      precedente: precedente?.prospetto ?? null,
      oggi,
    });

    const righe = tabellaLimite({
      anno,
      meseCorrente,
      movimenti: dati.pfMovimenti,
      categorie: dati.pfCategorie,
      budget: dati.pfBudget,
      accantonamentoMensile: quota.alMese,
      riportoAttivo: impostazioni.riportoAttivo,
    });
    const riga = righe[meseCorrente - 1];
    const dalMese = quantoResta(riga, oggi);

    const tetto = tettoDalConto({
      saldoConti: saldoTotale(dati.pfConti, dati.pfMovimenti, oggi),
      cuscinetto: impostazioni.cuscinetto,
      impegniDelMese: riga.fisse + riga.risparmi + riga.rate,
      fiscoNonVersato: quota.imposte.daAccantonare + quota.iva.daAccantonare,
    });

    const effettivo = limiteEffettivo(dalMese.resta, tetto.tetto - riga.speso);

    /*
      Un mese senza movimenti e senza budget **non è un mese a zero**.

      `tabellaLimite` lo dice — `conMovimenti` — e la prima stesura di questa
      schermata non lo guardava: sul dataset di vetrina, che ha il motore
      fiscale pieno e il registro personale vuoto, il numero grande diceva
      «puoi ancora spendere −1.026,45 €». Era l'accantonamento sottratto a zero
      entrate: una cifra sicura di sé costruita sul niente, che è peggio di
      nessuna cifra — perché nessuno la mette in dubbio.

      Quando il mese non ha dati resta valido l'altro vincolo: il conto esiste
      e il suo saldo pure. Si mostra quello, e si dice che è quello.
    */
    const budgetDelMese = dati.pfBudget.some(
      (b) => b.anno === anno && (b.importi[meseCorrente - 1] ?? 0) !== 0,
    );
    const meseSenzaDati = !riga.conMovimenti && !budgetDelMese;

    return { impostazioni, quota, riga, dalMese, tetto, effettivo, meseCorrente, meseSenzaDati };
  }, [dati, calcolo, precedente, anno, oggi]);

  if (!dati || !calcolo || !conto) {
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

  const { impostazioni, riga, dalMese, tetto, effettivo, meseCorrente, meseSenzaDati } = conto;
  const stretto = effettivo.vincolo === "conto";
  /* Senza dati del mese vale il solo tetto: vedi il commento nel calcolo. */
  const mostrato = meseSenzaDati ? tetto.tetto - riga.speso : effettivo.limite;

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
              stretto && !meseSenzaDati ? "text-attenzione" : "text-inchiostro-tenue",
            )}
          >
            {meseSenzaDati ? (
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
              <Voce etichetta="Accantonamento per il fisco" valore={-riga.accantonamento} />
              <Voce etichetta="Spese fisse" valore={-riga.fisse} />
              <Voce etichetta="Risparmi" valore={-riga.risparmi} />
              <Voce etichetta="Rate" valore={-riga.rate} />
              {riga.riporto !== 0 && <Voce etichetta="Riporto dal mese prima" valore={riga.riporto} />}
              <Voce etichetta="Limite del mese" valore={riga.limite} forte />
              <Voce etichetta="Già speso" valore={-riga.speso} />
              <Voce etichetta="Resta" valore={dalMese.resta} forte />
            </dl>
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
              <Voce etichetta="Fisco da versare, già in banca" valore={-tetto.fiscoNonVersato} />
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
            <CardCorpo className="pt-3">
              <ImpostazioniSpesa impostazioni={impostazioni} />
            </CardCorpo>
          </Card>
        </div>

        <p className="text-micro text-inchiostro-tenue">
          L&apos;accantonamento del mese è {euro(conto.quota.alMese)} e arriva dal motore fiscale,
          lo stesso numero della card del cruscotto: qui non si ricalcola niente. Il fisco ancora
          da versare — {euro(tetto.fiscoNonVersato)} — è quello che resta da mettere da parte per
          imposte, contributi e IVA.
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
      <dd className={cn("cifre", valore < 0 && "text-inchiostro-tenue", forte && "text-inchiostro")}>
        {euro(valore)}
      </dd>
    </div>
  );
}

function ImpostazioniSpesa({
  impostazioni,
}: {
  impostazioni: { id: "unico"; cuscinetto: number; riportoAttivo: boolean };
}) {
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
