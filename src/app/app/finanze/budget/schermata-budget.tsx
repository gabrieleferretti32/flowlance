"use client";

/**
 * Il budget: quanto avevi previsto, quanto è successo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Una casella vuota resta vuota
 * ─────────────────────────────────────────────────────────────────────────
 *
 * La tentazione di una schermata così è riempirla: proporre la media, scriverla
 * nelle caselle, mostrare tutto compilato. Sarebbe un budget deciso da noi con
 * il nome di chi legge sopra — e la prima volta che quel numero sbaglia,
 * sbaglia per conto suo. La media si vede accanto alla casella, e ci entra solo
 * se qualcuno preme.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il budget non è il limite, e i due devono parlarsi
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Si può scrivere un budget bellissimo e non poterselo permettere: il limite
 * del mese lo decidono le entrate meno l'accantonamento fiscale, non le
 * intenzioni. La riga in cima confronta le due cose — sempre, anche quando il
 * confronto è scomodo — e usa lo stesso calcolo di «Quanto posso spendere»,
 * non una sua imitazione.
 */
import * as React from "react";
import Link from "next/link";
import { Target, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Vuoto } from "@/components/ui/vuoto";
import { CellaModificabile } from "@/components/tabella/cella-modificabile";
import { Guscio } from "@/components/guscio/guscio";
import { ROTTE } from "@/lib/rotte";
import { useDati, useSituazioneMese } from "@/lib/dati/hooks";
import { usePreferenze } from "@/lib/stato/preferenze";
import { applicaBudgetATuttoLAnno, azzeraBudget, salvaBudgetMese } from "@/lib/dati/azioni";
import { confrontoBudget, quadroDelMese, totaleDi, type RigaBudget } from "@/lib/finanze/budget";
import type { BudgetPf } from "@/lib/finanze/tipi";
import { euro, meseBreve, nomeMese, percentuale, quandoMesi } from "@/lib/format";
import { round2 } from "@/lib/fisco/aritmetica";
import { cn } from "@/lib/utils";

type Gruppo = {
  chiave: string;
  titolo: string;
  sottotitolo: string;
  /** Sulle entrate spendere di più è una buona notizia: il colore si gira. */
  verso: "entrata" | "uscita";
  tiene: (r: RigaBudget) => boolean;
};

const GRUPPI: Gruppo[] = [
  {
    chiave: "entrate",
    titolo: "Entrate",
    sottotitolo: "Quello che prevedi di incassare sul conto personale",
    verso: "entrata",
    tiene: (r) => r.categoria.tipo === "entrata",
  },
  {
    chiave: "fisse",
    titolo: "Spese fisse",
    sottotitolo: "Quelle su cui questo mese non si decide: affitto, bollette, abbonamenti",
    verso: "uscita",
    tiene: (r) => r.categoria.tipo === "spesa" && r.categoria.fissa,
  },
  {
    chiave: "variabili",
    titolo: "Spese variabili",
    sottotitolo: "Quelle che il limite del mese tiene d'occhio giorno per giorno",
    verso: "uscita",
    tiene: (r) => r.categoria.tipo === "spesa" && !r.categoria.fissa,
  },
  {
    chiave: "risparmi",
    titolo: "Risparmi",
    sottotitolo: "Quello che metti via ogni mese",
    verso: "uscita",
    tiene: (r) => r.categoria.tipo === "risparmio",
  },
  {
    chiave: "rate",
    titolo: "Rate",
    sottotitolo: "Quello che devi a scadenza fissa",
    verso: "uscita",
    tiene: (r) => r.categoria.tipo === "rata",
  },
];

export function SchermataBudget() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const dati = useDati();
  const situazione = useSituazioneMese(anno, oggi);

  /*
    Il mese da cui si parte è quello di oggi quando si guarda l'anno in corso,
    gennaio negli altri: aprire il 2025 a settembre e vedere «settembre 2025»
    sarebbe un mese scelto dall'orologio e non da chi guarda.
  */
  const annoDiOggi = Number(oggi.slice(0, 4));
  const [mese, setMese] = React.useState(() => (anno === annoDiOggi ? Number(oggi.slice(5, 7)) : 1));
  React.useEffect(() => {
    setMese(anno === annoDiOggi ? Number(oggi.slice(5, 7)) : 1);
  }, [anno, annoDiOggi, oggi]);

  const confronto = React.useMemo(
    () =>
      dati
        ? confrontoBudget({
            anno,
            mese,
            movimenti: dati.pfMovimenti,
            categorie: dati.pfCategorie,
            budget: dati.pfBudget,
          })
        : null,
    [dati, anno, mese],
  );

  if (!dati || !confronto) {
    return (
      <Guscio titolo="Budget">
        <Card>
          <CaricamentoTabella righe={8} />
        </Card>
      </Guscio>
    );
  }

  if (dati.pfCategorie.length === 0) {
    return (
      <Guscio titolo="Budget" descrizione="Quanto avevi previsto, quanto è successo">
        <div className="mx-auto max-w-4xl">
          <Card>
            <Vuoto
              icona={Target}
              titolo="Il budget si scrive sulle categorie, e categorie non ce ne sono ancora."
              azione={
                <Button asChild variante="contorno">
                  <Link href={ROTTE.finanzeCategorie}>Vai a Categorie</Link>
                </Button>
              }
            />
          </Card>
        </div>
      </Guscio>
    );
  }

  const quadro = quadroDelMese(confronto);
  const variabili = totaleDi(confronto.righe.filter(GRUPPI[2].tiene));

  return (
    <Guscio
      titolo="Budget"
      descrizione={`${nomeMese(mese)} ${anno} · quanto avevi previsto, quanto è successo`}
    >
      <div className="mx-auto max-w-5xl space-y-4">
        <SceltaMese mese={mese} onCambia={setMese} anno={anno} />

        <Card>
          <CardCorpo className="space-y-3">
            {/*
              La differenza esiste solo se esiste un'entrata da cui partire.
              Con la casella delle entrate vuota la prima stesura scriveva
              «−9.000,00 €» in rosso su un mese che aveva incassato 3.200 €:
              due numeri veri che insieme dicevano una cosa falsa.
            */}
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              {quadro.fonteEntrate !== "nessuna" && (
                <Totale
                  etichetta={
                    quadro.fonteEntrate === "previsione" ? "Entrate previste" : "Entrate registrate"
                  }
                  valore={quadro.entrate}
                />
              )}
              <Totale etichetta="Uscite previste" valore={quadro.uscite} />
              {quadro.differenza !== null && (
                <Totale etichetta="Differenza" valore={quadro.differenza} colorata />
              )}
            </div>

            {quadro.fonteEntrate === "registrate" && (
              <p className="text-etichetta text-inchiostro-tenue">
                Uso le entrate registrate: per {nomeMese(mese).toLowerCase()} non c&apos;è nessuna
                previsione. Scrivine una nelle categorie di entrata e la differenza si calcola su
                quella.
              </p>
            )}
            {quadro.fonteEntrate === "nessuna" && quadro.uscite > 0 && (
              <p className="text-etichetta text-inchiostro-tenue">
                La differenza non si può calcolare: per {nomeMese(mese).toLowerCase()} non c&apos;è
                né una previsione di entrate né un incasso registrato.{" "}
                <strong>Non vuol dire che il mese chiuda a meno {euro(quadro.uscite)}</strong>:
                vuol dire che di quel lato non si sa ancora niente.
              </p>
            )}

            {/*
              Il confronto con il limite vero. Un budget si può scrivere in
              perdita senza accorgersene: queste due righe sono il posto in cui
              il modulo lo dice, ed è lo stesso calcolo di «Quanto posso
              spendere», non una sua copia.
            */}
            {situazione && (
              <p className="text-etichetta text-inchiostro-tenue">
                {situazione.meseSenzaDati ? (
                  <>
                    Di {nomeMese(situazione.meseCorrente).toLowerCase()} non c&apos;è ancora
                    nessun movimento, quindi il limite del mese non si può calcolare: senza
                    entrate registrate non sarebbe zero, sarebbe una cifra inventata.
                  </>
                ) : mese !== situazione.meseCorrente ? (
                  <>
                    Il limite calcolato vale per {nomeMese(situazione.meseCorrente).toLowerCase()},
                    il mese in corso: {euro(situazione.riga.limite)} per le spese variabili. Qui
                    stai guardando {nomeMese(mese).toLowerCase()}.
                  </>
                ) : situazione.meseSenzaEntrate ? (
                  /*
                    Stessa distinzione di «Quanto posso spendere»: un mese con
                    movimenti ma senza incassi registrati non ha un limite
                    negativo, non ha un limite. Citare qui la cifra negativa
                    mentre l'altra schermata dice che non si può calcolare
                    sarebbe la stessa app che dice due cose diverse.
                  */
                  <>
                    Di {nomeMese(mese).toLowerCase()} ci sono movimenti ma nessuna entrata
                    registrata, quindi il limite del mese non si può calcolare e non c&apos;è
                    niente con cui confrontare questo budget.{" "}
                    <Link href={ROTTE.finanzeSpesa} className="underline underline-offset-2">
                      Vedi «Quanto posso spendere»
                    </Link>
                    .
                  </>
                ) : situazione.riga.limite <= 0 ? (
                  /*
                    Un limite negativo non è un budget sforato: è un mese in
                    cui le entrate registrate non coprono nemmeno gli impegni.
                    Dirgli «questo budget non ci sta» mentre la casella è
                    ancora vuota darebbe la colpa a una cifra che non c'è.
                  */
                  <>
                    Il limite di {nomeMese(mese).toLowerCase()} è{" "}
                    {euro(situazione.riga.limite)}: le entrate registrate non coprono
                    accantonamento, spese fisse, risparmi e rate. Finché resta così nessun budget
                    delle variabili ci sta dentro, e il numero da guardare è quello del conto.{" "}
                    <Link href={ROTTE.finanzeSpesa} className="underline underline-offset-2">
                      Vedi da dove viene il limite
                    </Link>
                    .
                  </>
                ) : variabili.previsto === 0 ? (
                  <>
                    Per le variabili non hai ancora scritto niente. Il limite di{" "}
                    {nomeMese(mese).toLowerCase()} è {euro(situazione.riga.limite)}: è la cifra
                    che il budget delle variabili deve stare a rispettare.{" "}
                    <Link href={ROTTE.finanzeSpesa} className="underline underline-offset-2">
                      Vedi da dove viene il limite
                    </Link>
                    .
                  </>
                ) : variabili.previsto > situazione.riga.limite ? (
                  <span className="text-attenzione">
                    <strong>Questo budget non ci sta nel mese.</strong> Le variabili a budget sono{" "}
                    {euro(variabili.previsto)}, il limite di {nomeMese(mese).toLowerCase()} è{" "}
                    {euro(situazione.riga.limite)}: mancano{" "}
                    {euro(round2(variabili.previsto - situazione.riga.limite))}.{" "}
                    <Link href={ROTTE.finanzeSpesa} className="underline underline-offset-2">
                      Vedi da dove viene il limite
                    </Link>
                    .
                  </span>
                ) : (
                  <>
                    Le variabili a budget sono {euro(variabili.previsto)} e il limite di{" "}
                    {nomeMese(mese).toLowerCase()} è {euro(situazione.riga.limite)}: ci stanno
                    dentro, con {euro(round2(situazione.riga.limite - variabili.previsto))} di
                    margine.{" "}
                    <Link href={ROTTE.finanzeSpesa} className="underline underline-offset-2">
                      Vedi da dove viene il limite
                    </Link>
                    .
                  </>
                )}
              </p>
            )}

            {/*
              **«Speso non misurabile» da sola non si capisce.**

              Era il rimprovero giusto: diceva che una misura manca e non
              diceva perché, a chi aveva appena importato trentasette
              movimenti. Le due cose che servono sono che cosa vuol dire —
              c'era — e **dove i movimenti di quest'anno ci sono davvero**,
              che non c'era: un mese vuoto ha due cause opposte, non l'hai
              ancora caricato, oppure l'hai caricato ed è entrato altrove, con
              altre date o su un altro conto. Senza l'elenco dei mesi, le due
              si leggono uguali.
            */}
            {!confronto.conMovimenti && (
              <p className="text-etichetta text-inchiostro-tenue">
                Di {nomeMese(mese).toLowerCase()} non ci sono movimenti registrati, quindi la
                colonna «speso» resta vuota: <strong>non è zero, è un mese che non si sa</strong>.{" "}
                {confronto.mesiConRegistro.length === 0 ? (
                  <>
                    Nel {anno} non c&apos;è nessun movimento, in nessun mese.{" "}
                    <Link href={ROTTE.finanzeRendiconto} className="underline underline-offset-2">
                      Carica il rendiconto
                    </Link>{" "}
                    o registra qualche movimento.
                  </>
                ) : (
                  <>
                    Nel {anno} i movimenti ci sono {quandoMesi(confronto.mesiConRegistro)}: se{" "}
                    {nomeMese(mese).toLowerCase()} l&apos;hai già importato, guarda in{" "}
                    <Link href={ROTTE.finanzeMovimenti} className="underline underline-offset-2">
                      Movimenti
                    </Link>{" "}
                    con che date e su che conto è entrato. Altrimenti{" "}
                    <Link href={ROTTE.finanzeRendiconto} className="underline underline-offset-2">
                      carica il rendiconto
                    </Link>
                    .
                  </>
                )}
              </p>
            )}
          </CardCorpo>
        </Card>

        {GRUPPI.map((gruppo) => {
          const righe = confronto.righe.filter(gruppo.tiene);
          if (righe.length === 0) return null;
          const totale = totaleDi(righe);
          return (
            <Card key={gruppo.chiave}>
              <CardCorpo className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1 pb-3">
                <span>
                  <CardTitolo>{gruppo.titolo}</CardTitolo>
                  <CardSottotitolo>{gruppo.sottotitolo}</CardSottotitolo>
                </span>
                <span className="text-micro text-inchiostro-tenue">
                  previsto {euro(totale.previsto)} ·{" "}
                  {confronto.conMovimenti
                    ? `${gruppo.verso === "entrata" ? "incassato" : "speso"} ${euro(totale.speso)}`
                    : `${gruppo.verso === "entrata" ? "incassato" : "speso"} non si sa: ${nomeMese(mese).toLowerCase()} non ha movimenti`}
                </span>
              </CardCorpo>
              <ul className="divide-y divide-bordo/70 border-y border-bordo">
                {righe.map((riga) => (
                  <RigaDelBudget
                    key={riga.categoria.id}
                    riga={riga}
                    anno={anno}
                    mese={mese}
                    verso={gruppo.verso}
                    budget={dati.pfBudget}
                  />
                ))}
              </ul>
            </Card>
          );
        })}

        <p className="px-1 text-micro text-inchiostro-tenue">
          Le categorie coperte dall&apos;accantonamento — F24, contributi, IVA — non hanno una
          riga: il limite di spesa le toglie da tutti i gruppi, perché quei soldi erano già stati
          messi da parte. Una casella che accetta una cifra e non la usa è peggio di una casella
          che non c&apos;è.
        </p>
      </div>
    </Guscio>
  );
}

function Totale({
  etichetta,
  valore,
  colorata = false,
}: {
  etichetta: string;
  valore: number;
  colorata?: boolean;
}) {
  return (
    <span className="flex flex-col">
      <span className="text-micro text-inchiostro-tenue">{etichetta}</span>
      <strong className={cn("text-kpi-sm", colorata && valore < 0 && "text-negativo")}>
        {euro(valore)}
      </strong>
    </span>
  );
}

/** I dodici mesi, con quello guardato in evidenza. */
function SceltaMese({
  mese,
  onCambia,
  anno,
}: {
  mese: number;
  onCambia: (m: number) => void;
  anno: number;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={`Mese del ${anno}`}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onCambia(m)}
          aria-current={m === mese || undefined}
          className={cn(
            "rounded-interna px-2.5 py-1 text-micro capitalize transition-colors",
            m === mese
              ? "bg-inchiostro text-superficie"
              : "text-inchiostro-tenue hover:bg-superficie-alt",
          )}
        >
          <span className="sr-only">{nomeMese(m)}</span>
          <span aria-hidden>{meseBreve(m)}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Una riga: la casella, quello che è successo, e dove sta il secondo rispetto
 * alla prima.
 */
function RigaDelBudget({
  riga,
  anno,
  mese,
  verso,
  budget,
}: {
  riga: RigaBudget;
  anno: number;
  mese: number;
  verso: "entrata" | "uscita";
  budget: BudgetPf[];
}) {
  const { categoria, previsto, speso, stato } = riga;
  return (
    /*
      Colonne fisse, non un flex che si adatta: in un flex ogni riga con un
      bottone in più spostava di qualche decina di pixel le cifre della riga
      accanto, e una colonna di numeri che non si incolonna non si legge —
      si controlla una riga alla volta. Sotto i 640 px le colonne cadono una
      sotto l'altra, che su un telefono è l'unica forma leggibile.
    */
    <li className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-6 py-3 sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_9rem_15rem] sm:py-2">
      <span className="col-span-2 flex items-center gap-2 sm:col-span-1">
        {categoria.icona && <span aria-hidden>{categoria.icona}</span>}
        <span className="text-corpo">{categoria.nome}</span>
        {!riga.uniforme && (
          <span
            className="text-micro text-inchiostro-tenue"
            title={`I dodici mesi non hanno tutti lo stesso importo: in tutto il ${anno} sono ${euro(riga.previstoAnno)}.`}
          >
            varia nei mesi
          </span>
        )}
      </span>

      {/*
        Sul telefono ogni cifra si porta dietro la sua parola: senza, sotto al
        nome della categoria restano due numeri incolonnati che non dicono
        quale dei due è il previsto. Le etichette spariscono da `sm` in su,
        dove a dirlo è l'intestazione della colonna.
      */}
      <Etichettina>Previsto</Etichettina>

      {/*
        La casella vuota resta vuota: `null` invece di zero. «0,00 €» e «non ho
        ancora deciso» sono due cose diverse, e la seconda non va scritta con
        il simbolo della prima.
      */}
      <CellaModificabile
        tipo="valuta"
        etichetta={`Budget di ${categoria.nome} per ${nomeMese(mese)}`}
        valore={previsto === 0 ? null : previsto}
        vuoto="—"
        className="text-right"
        onSalva={(v) => void salvaBudgetMese(categoria.id, anno, mese, Number(v ?? 0), budget)}
      />

      <Etichettina>{verso === "entrata" ? "Incassato" : "Speso"}</Etichettina>

      <span
        className={cn(
          "text-right text-corpo tabular-nums",
          stato === "senza-dati" && "text-inchiostro-tenue/70",
        )}
        title={stato === "senza-dati" ? "Nessun movimento registrato in questo mese." : undefined}
      >
        {stato === "senza-dati" ? "—" : euro(speso)}
      </span>

      <span className="col-span-2 text-right sm:col-span-1">
        <Stato riga={riga} verso={verso} mese={mese} />
      </span>

      {/*
        Le azioni stanno in una colonna di larghezza fissa: senza, ogni riga
        con un bottone in più spostava di qualche decina di pixel il previsto e
        lo speso della riga accanto, e una colonna di cifre che non si allinea
        non si legge — si controlla una riga alla volta.
      */}
      <span className="col-span-2 flex flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:col-span-1">
        {/*
          La media si propone, non si scrive da sola. E si propone solo quando
          è misurata su qualcosa: una media su zero mesi è un numero inventato
          con l'aria di un consiglio.
        */}
        {riga.media > 0 && riga.media !== previsto && (
          <Button
            scrive
            variante="quieto"
            taglia="sm"
            title={`La media dei ${riga.mesiMisurati} ${riga.mesiMisurati === 1 ? "mese" : "mesi"} con movimenti del ${anno}.`}
            onClick={() => void salvaBudgetMese(categoria.id, anno, mese, riga.media, budget)}
          >
            <Wand2 className="size-3.5" aria-hidden />
            media {euro(riga.media)}
          </Button>
        )}
        {previsto !== 0 && (
          <Button
            scrive
            variante="quieto"
            taglia="sm"
            title={`Scrive ${euro(previsto)} su tutti e dodici i mesi del ${anno}, sovrascrivendo quelli già compilati.`}
            onClick={() => void applicaBudgetATuttoLAnno(categoria.id, anno, previsto)}
          >
            tutto l&apos;anno
          </Button>
        )}
        {riga.previstoAnno !== 0 && (
          <Button
            scrive
            variante="quieto"
            taglia="sm"
            title={`Toglie il budget di ${categoria.nome} per tutto il ${anno}.`}
            onClick={() => void azzeraBudget(categoria.id, anno)}
          >
            togli
          </Button>
        )}
      </span>
    </li>
  );
}

/** La parola che accompagna una cifra sul telefono, e sparisce sul grande. */
function Etichettina({ children }: { children: React.ReactNode }) {
  return <span className="text-micro text-inchiostro-tenue sm:hidden">{children}</span>;
}

/**
 * Dove sta il consumato rispetto al previsto, in parole.
 *
 * Le stesse tre posizioni cambiano segno fra entrate e uscite: incassare più
 * del previsto è una buona notizia, spendere più del previsto no. Il calcolo
 * non lo sa e non deve saperlo — `budget.ts` dice soltanto dove sta il numero —
 * e il colore lo mette qui, che è l'unico posto che conosce il tipo.
 */
function Stato({
  riga,
  verso,
  mese,
}: {
  riga: RigaBudget;
  verso: "entrata" | "uscita";
  mese: number;
}) {
  const { stato, quota, differenza } = riga;

  if (stato === "senza-dati") {
    /* Il mese per nome: «mese senza movimenti» non dice quale mese. */
    return (
      <span className="text-micro text-inchiostro-tenue/70">
        {nomeMese(mese).toLowerCase()} senza movimenti
      </span>
    );
  }
  if (stato === "senza-budget") {
    return <span className="text-micro text-inchiostro-tenue/70">nessun budget</span>;
  }

  const buono = verso === "entrata" ? stato === "oltre" : stato !== "oltre";
  const vicino = stato === "vicino";
  return (
    <span
      className={cn(
        "text-micro tabular-nums",
        stato === "oltre" && (buono ? "text-positivo" : "text-negativo"),
        vicino && verso === "uscita" && "text-attenzione",
        !vicino && stato !== "oltre" && "text-inchiostro-tenue",
      )}
    >
      {percentuale(quota, 0)} ·{" "}
      {stato === "oltre"
        ? `${euro(Math.abs(differenza))} ${verso === "entrata" ? "in più" : "oltre"}`
        : `${verso === "entrata" ? "mancano" : "restano"} ${euro(differenza)}`}
    </span>
  );
}
