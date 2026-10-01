"use client";

import * as React from "react";
import { CalendarClock, PiggyBank, Landmark, Wallet, Info } from "lucide-react";
import { euro, euroTondo, giornoEMese, dataEstesa, percentuale } from "@/lib/format";
import { parametriDi } from "@/lib/fisco/parametri";
import { prospettoDettagliato, type RigaProspetto } from "@/lib/fisco/spiegazioni";
import { derivato } from "@/lib/fisco/derivati/registro";
import type { Regime } from "@/lib/fisco/tipi";
import { NumeroAnimato } from "@/components/sito/numero-animato";
import { AlComparire } from "@/components/sito/apparizione";
import {
  appuntamentiFiscali,
  divario,
  type Appuntamenti,
  type Appuntamento,
} from "@/lib/sito/appuntamenti";
import {
  ANNO,
  RICAVI_MASSIMI,
  righeMostrate,
  type EsitoSimulazione,
  type IngressoSimulatore,
} from "@/lib/sito/simulatore";

/**
 * L'attributo con cui Clarity non registra il contenuto di un elemento.
 *
 * Il valore è «True» con la maiuscola, come lo vuole Clarity: scritto `"true"`
 * l'attributo c'è, sembra giusto guardandolo, e non maschera niente. È il
 * motivo per cui sta in una costante e non ripetuto nel JSX — e per cui
 * `verifica-derivati` lo confronta per intero invece di controllare che
 * l'attributo esista.
 *
 * Su questa pagina copre **tutto** ciò che riguarda i numeri di chi guarda:
 * i campi in cui scrive, il risultato, il dettaglio, le date e il campo di
 * quanto ha già da parte. Una registrazione di navigazione che contenesse il
 * fatturato di una persona sarebbe il profilo economico di qualcuno che stava
 * solo facendo un conto.
 */
const NASCOSTO_A_CLARITY = { "data-clarity-mask": "True" } as const;

const REGIME_DETTO: Record<Regime, string> = {
  forfettario: "Forfettario",
  ordinario: "Ordinario (semplificato)",
};

/** Le due scadenze da cui nasce il riquadro in evidenza. */
const ID_GIUGNO = "saldo-e-primo-acconto";
const ID_NOVEMBRE = "secondo-acconto";

export type ProprietaRisultato = {
  esito: EsitoSimulazione;
  ing: IngressoSimulatore;
  /** La data di oggi, vera. Vedi il commento in `schermata-simulatore.tsx`. */
  oggi: string;
  cambia: <K extends keyof IngressoSimulatore>(campo: K, valore: IngressoSimulatore[K]) => void;
  /** Dove si ancora lo scorrimento morbido dopo «vedi il tuo conto». */
  ancora: React.Ref<HTMLDivElement>;
};

/**
 * Il risultato, nell'ordine in cui serve.
 *
 * Prima quando esce dal conto, poi quanto, poi da dove viene. È l'ordine
 * inverso di come lo si calcola, ed è quello in cui lo si legge: chi arriva
 * qui non sta verificando un conto, sta cercando di sapere se a novembre avrà
 * i soldi.
 */
export function Risultato({ esito, ing, oggi, cambia, ancora }: ProprietaRisultato) {
  const { prospetto, impostazioni, scadenze, iva } = esito;
  const par = parametriDi(ANNO);

  const dataGiugno = scadenze.find((s) => s.id === ID_GIUGNO)?.data;
  const dataNovembre = scadenze.find((s) => s.id === ID_NOVEMBRE)?.data;

  /*
    Il primo anno di attività non è un interruttore nuovo: discende dall'anno
    di apertura, che «affina il calcolo» chiede già. Quando non è dichiarato
    vale «no» — il caso più comune fra chi arriva qui, e la risposta che mostra
    una scadenza in più e un numero più piccolo invece del contrario.
  */
  const primoAnno = ing.annoAperturaPiva === ANNO;

  const appuntamenti: Appuntamenti | null = React.useMemo(() => {
    if (!dataGiugno || !dataNovembre) return null;
    return appuntamentiFiscali({
      carico: prospetto.caricoTotale,
      acconti: prospetto.acconti,
      dataGiugno,
      dataNovembre,
      primoAnno,
      oggi,
    });
  }, [dataGiugno, dataNovembre, prospetto.caricoTotale, prospetto.acconti, primoAnno, oggi]);

  const righe = React.useMemo(() => {
    const tutte = prospettoDettagliato(prospetto, impostazioni, par).flatMap((s) => s.righe);
    return righeMostrate(ing.gestione, ing.regime)
      .map((id) => tutte.find((r) => r.id === id))
      .filter((r): r is RigaProspetto => Boolean(r));
  }, [prospetto, impostazioni, par, ing.gestione, ing.regime]);

  const limite = derivato("limiteForfettario", impostazioni, par);
  const oltreIlLimite = limite.valore !== null && ing.ricavi > limite.valore;

  return (
    <div ref={ancora} className="scroll-mt-6">
      {appuntamenti && <RiquadroScadenza a={appuntamenti} primoAnno={primoAnno} />}

      <TreNumeri prospetto={prospetto} />

      {oltreIlLimite && impostazioni.regime === "forfettario" && (
        /*
          Mascherato come il resto: porta dentro i ricavi che la persona ha
          scritto. Non si vedeva nel controllo perché compare solo sopra il
          limite del forfettario, e il controllo guardava la pagina appena
          aperta — ora ne guarda anche uno stato con il fatturato alto.
        */
        <p
          {...NASCOSTO_A_CLARITY}
          className="mt-4 rounded-interna border border-attenzione/40 bg-attenzione-tenue px-4 py-3 text-etichetta leading-relaxed"
        >
          Con {euroTondo(ing.ricavi)} sei oltre il limite del forfettario ({euroTondo(limite.valore)}):
          questo conto è quello che pagheresti se potessi restarci, e non ci puoi restare. Guarda
          l&apos;ordinario qui sotto.
        </p>
      )}

      {/* L'importo dell'IVA dell'anno è un numero suo: dentro la maschera. */}
      <p
        {...NASCOSTO_A_CLARITY}
        className="mt-4 max-w-[64ch] text-etichetta leading-relaxed text-inchiostro-tenue"
      >
        {iva.applicabile ? (
          <>
            Più {euro(iva.totaleDaVersare)} di IVA da versare nell&apos;anno. Non è un tuo costo —
            l&apos;hai incassata dai clienti — ma esce dal tuo conto, e ai fini
            dell&apos;accantonamento è denaro che non è mai stato tuo.
          </>
        ) : (
          <>
            Nel forfettario non addebiti l&apos;IVA: non la incassi e non la versi. Sulle fatture va
            la marca da bollo da 2 € sopra i 77,47 €.
          </>
        )}
      </p>

      {appuntamenti && <DomandaDelDivario a={appuntamenti} oggi={oggi} />}

      <DaDoveViene righe={righe} prospetto={prospetto} />

      <AffinaIlCalcolo ing={ing} cambia={cambia} />

      <QuandoEsce scadenze={scadenze} />
    </div>
  );
}

// ————————————————————————————————————————————————————————————
// a · Il riquadro della scadenza: il più visibile della pagina
// ————————————————————————————————————————————————————————————

/** «il 30 novembre», o «il 30 giugno 2027» quando l'anno non è quello di chi legge. */
function quando(a: Appuntamento): string {
  return a.rinviata ? `${giornoEMese(a.data)} ${a.anno}` : giornoEMese(a.data);
}

function RiquadroScadenza({ a, primoAnno }: { a: Appuntamenti; primoAnno: boolean }) {
  const { prossimo, seguente, senzaAcconti } = a;

  return (
    <AlComparire>
      <section
        {...NASCOSTO_A_CLARITY}
        aria-labelledby="prossima-scadenza"
        className="rounded-card border border-accento/30 bg-superficie px-5 py-6 shadow-sollevato sm:px-8 sm:py-8"
      >
        <h2
          id="prossima-scadenza"
          className="flex items-center gap-2 text-micro font-semibold uppercase tracking-[0.14em] text-accento"
        >
          <CalendarClock className="size-4 shrink-0" aria-hidden />
          {senzaAcconti ? "Il primo conto" : "La prossima scadenza"}
        </h2>

        {senzaAcconti ? (
          <>
            <p className="mt-3 font-display text-kpi font-semibold leading-tight tracking-tight sm:text-semaforo">
              {primoAnno
                ? "Quest'anno niente acconti, ma il primo conto arriva a giugno"
                : "Niente acconti: il conto arriva tutto a giugno"}
            </p>
            <p className="mt-4 max-w-[60ch] text-corpo leading-relaxed">
              Il {giornoEMese(prossimo.data)} {prossimo.anno} verserai circa{" "}
              <strong className="cifre font-semibold">
                <NumeroAnimato valore={prossimo.importo} scrivi={euro} />
              </strong>{" "}
              tra saldo e primo acconto.{" "}
              {primoAnno
                ? "Conviene iniziare ad accantonare adesso."
                : "Sotto una certa soglia gli acconti non si versano: tutto si chiude a giugno."}
            </p>
          </>
        ) : (
          <>
            <p className="mt-3 font-display text-kpi font-semibold leading-tight tracking-tight sm:text-semaforo">
              Il {quando(prossimo)} verserai circa{" "}
              <span className="cifre text-accento">
                <NumeroAnimato valore={prossimo.importo} scrivi={euro} />
              </span>
            </p>
            <p className="mt-4 max-w-[60ch] text-corpo leading-relaxed">
              {prossimo.genere === "secondo-acconto"
                ? "Secondo acconto di imposte e contributi."
                : "Saldo di imposte e contributi più il primo acconto."}
              {seguente && (
                <>
                  {" "}
                  Il prossimo appuntamento è il {quando(seguente)}: circa{" "}
                  <strong className="cifre font-semibold">{euro(seguente.importo)}</strong>{" "}
                  {seguente.genere === "saldo-e-primo-acconto"
                    ? "tra saldo e primo acconto."
                    : "di secondo acconto."}
                </>
              )}
            </p>
          </>
        )}
      </section>
    </AlComparire>
  );
}

// ————————————————————————————————————————————————————————————
// b · I tre numeri
// ————————————————————————————————————————————————————————————

function TreNumeri({ prospetto }: { prospetto: EsitoSimulazione["prospetto"] }) {
  const card = [
    {
      icona: PiggyBank,
      etichetta: "Metti da parte",
      valore: prospetto.accantonamentoMensile,
      coda: "al mese",
      forte: true,
    },
    {
      icona: Landmark,
      etichetta: "Lasci al fisco",
      valore: prospetto.caricoTotale,
      coda: `il ${percentuale(prospetto.pressione, 1)} di quello che incassi`,
      forte: false,
    },
    {
      icona: Wallet,
      etichetta: "Ti restano",
      valore: prospetto.nettoDisponibile,
      coda: "all'anno",
      forte: false,
    },
  ];

  return (
    <div {...NASCOSTO_A_CLARITY} className="mt-5 grid gap-4 sm:grid-cols-3">
      {card.map(({ icona: Icona, etichetta, valore, coda, forte }, i) => (
        <AlComparire key={etichetta} ritardoMs={i * 70}>
          <div
            className={`h-full rounded-interna border px-5 py-5 ${
              forte ? "border-accento/30 bg-accento-tenue" : "border-bordo bg-superficie"
            }`}
          >
            <p className="flex items-center gap-2 text-etichetta font-medium text-inchiostro-tenue">
              <Icona className="size-4 shrink-0" aria-hidden />
              {etichetta}
            </p>
            <p
              className={`cifre mt-2 text-kpi font-semibold tracking-tight ${
                forte ? "text-accento" : ""
              }`}
            >
              <NumeroAnimato valore={valore} scrivi={euro} />
            </p>
            <p className="mt-1 text-etichetta leading-relaxed text-inchiostro-tenue">{coda}</p>
          </div>
        </AlComparire>
      ))}
    </div>
  );
}

// ————————————————————————————————————————————————————————————
// c · La domanda facoltativa sul divario
// ————————————————————————————————————————————————————————————

/**
 * «Quanto hai già messo da parte per le tasse?»
 *
 * Il valore sta in questo componente e da nessun'altra parte: non entra nello
 * stato della simulazione, non finisce fra gli attributi che partono verso la
 * posta, e non si salva. È l'unico campo della pagina in cui una persona
 * scrive quanto ha sul conto, ed è il campo per cui la riga sulla riservatezza
 * in cima deve essere vera alla lettera.
 */
function DomandaDelDivario({ a, oggi }: { a: Appuntamenti; oggi: string }) {
  const [grezzo, setGrezzo] = React.useState("");
  const scritto = grezzo.trim() !== "";
  const d = React.useMemo(
    () => (scritto ? divario(a, Number(grezzo.replace(",", ".")) || 0, oggi) : null),
    [a, grezzo, scritto, oggi],
  );

  return (
    <AlComparire>
      <div className="mt-6 rounded-interna border border-bordo bg-superficie-alt px-5 py-5">
        <label className="block">
          <span className="text-corpo font-medium">
            Quanto hai già messo da parte per le tasse?
          </span>
          <span className="mt-2 flex max-w-[16rem] items-center gap-2 rounded-campo border border-bordo bg-superficie px-3 py-2 focus-within:border-accento">
            <input
              {...NASCOSTO_A_CLARITY}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={grezzo}
              onChange={(e) => setGrezzo(e.target.value.replace(/[^\d.,]/g, ""))}
              className="cifre w-full bg-transparent text-campo outline-none"
            />
            <span aria-hidden className="text-inchiostro-tenue">
              €
            </span>
          </span>
          <span className="mt-2 block text-etichetta text-inchiostro-tenue">
            Facoltativo, resta in questa pagina.
          </span>
        </label>

        {d && (
          <p
            {...NASCOSTO_A_CLARITY}
            aria-live="polite"
            className={`mt-4 max-w-[60ch] rounded-campo px-4 py-3 text-corpo leading-relaxed ${
              d.manca > 0
                ? "bg-attenzione-tenue text-inchiostro"
                : "bg-positivo-tenue text-inchiostro"
            }`}
          >
            {d.manca > 0 ? (
              <>
                Ti mancano <strong className="cifre font-semibold">{euro(d.manca)}</strong> per essere
                in pari con le scadenze. Sono{" "}
                <strong className="cifre font-semibold">{euro(d.alMese)}</strong> al mese da qui al{" "}
                {giornoEMese(d.giugno.data)} {d.giugno.anno}.
              </>
            ) : (
              <>Sei in pari. Ora il difficile è restarci, fattura dopo fattura, tutto l&apos;anno.</>
            )}
          </p>
        )}
      </div>
    </AlComparire>
  );
}

// ————————————————————————————————————————————————————————————
// d · Da dove viene il conto, chiuso di default
// ————————————————————————————————————————————————————————————

function DaDoveViene({
  righe,
  prospetto,
}: {
  righe: RigaProspetto[];
  prospetto: EsitoSimulazione["prospetto"];
}) {
  return (
    <details
      {...NASCOSTO_A_CLARITY}
      className="group mt-6 rounded-interna border border-bordo bg-superficie px-5 py-4"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-corpo font-medium">
        Da dove viene il conto
        <span aria-hidden className="text-etichetta text-inchiostro-tenue group-open:hidden">
          apri
        </span>
        <span
          aria-hidden
          className="hidden text-etichetta text-inchiostro-tenue group-open:inline"
        >
          chiudi
        </span>
      </summary>
      {/*
        Le righe arrivano da `prospettoDettagliato`, cioè dalla stessa funzione
        che le scrive dentro l'applicazione e nell'esportazione per il
        commercialista. La nota «da dove viene il numero» è il campo `formula`
        di quella riga: non è un testo scritto per questa pagina, è la formula
        applicata a questi numeri. Riscriverla qui sarebbe stata la seconda
        copia che diverge.
      */}
      <dl className="mt-4 divide-y divide-bordo border-t border-bordo">
        {righe.map((r) => (
          <div key={r.id} className="py-4">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-corpo">{r.etichetta}</dt>
              <dd className="cifre shrink-0 text-corpo font-medium">
                {typeof r.valore === "number" ? euro(r.valore) : r.valore}
              </dd>
            </div>
            {(r.formula ?? r.nota) && (
              <p className="mt-1 max-w-[62ch] text-etichetta leading-relaxed text-inchiostro-tenue">
                {r.formula ?? r.nota}
              </p>
            )}
          </div>
        ))}
        <div className="py-4">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-corpo font-semibold">Imposte e contributi</dt>
            <dd className="cifre shrink-0 text-corpo font-semibold">
              {euro(prospetto.caricoTotale)}
            </dd>
          </div>
          <p className="mt-1 text-etichetta text-inchiostro-tenue">
            {euro(prospetto.totaleImposte)} di imposte più {euro(prospetto.totaleContributi)} di
            contributi.
          </p>
        </div>
      </dl>
    </details>
  );
}

// ————————————————————————————————————————————————————————————
// e · Affina il calcolo, in una card secondaria
// ————————————————————————————————————————————————————————————

function AffinaIlCalcolo({
  ing,
  cambia,
}: {
  ing: IngressoSimulatore;
  cambia: ProprietaRisultato["cambia"];
}) {
  return (
    <details className="group mt-4 rounded-interna border border-bordo bg-superficie-alt px-5 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-corpo font-medium">
        Affina il calcolo
        <span aria-hidden className="text-etichetta text-inchiostro-tenue group-open:hidden">
          apri
        </span>
        <span aria-hidden className="hidden text-etichetta text-inchiostro-tenue group-open:inline">
          chiudi
        </span>
      </summary>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="text-etichetta font-medium">Regime</span>
          <select
            value={ing.regime}
            onChange={(e) => cambia("regime", e.target.value as Regime)}
            className="mt-1 w-full rounded-campo border border-bordo bg-superficie px-3 py-2 text-campo"
          >
            {(["forfettario", "ordinario"] as Regime[]).map((r) => (
              <option key={r} value={r}>
                {REGIME_DETTO[r]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-etichetta font-medium">Costi documentati in un anno</span>
          <span className="mt-1 flex items-center gap-2 rounded-campo border border-bordo bg-superficie px-3 py-2 focus-within:border-accento">
            <input
              {...NASCOSTO_A_CLARITY}
              type="number"
              inputMode="numeric"
              min={0}
              step={500}
              value={ing.costiAnnui}
              onChange={(e) => cambia("costiAnnui", Math.max(0, Number(e.target.value) || 0))}
              className="cifre w-full bg-transparent text-campo outline-none"
            />
            <span aria-hidden className="text-inchiostro-tenue">
              €
            </span>
          </span>
          <span className="mt-1 block text-etichetta text-inchiostro-tenue">
            Nel forfettario non cambiano le imposte: il reddito è forfettizzato.
          </span>
        </label>

        <label className="block">
          <span className="text-etichetta font-medium">Anno di apertura della partita IVA</span>
          <input
            type="number"
            inputMode="numeric"
            min={1970}
            max={ANNO}
            placeholder="non lo dico"
            value={ing.annoAperturaPiva ?? ""}
            onChange={(e) =>
              cambia("annoAperturaPiva", e.target.value === "" ? null : Number(e.target.value))
            }
            className="cifre mt-1 w-full rounded-campo border border-bordo bg-superficie px-3 py-2 text-campo"
          />
          <span className="mt-1 block text-etichetta leading-relaxed text-inchiostro-tenue">
            I cinque anni dell&apos;aliquota agevolata si contano da qui. Se scrivi {ANNO} il conto
            cambia forma: nel primo anno gli acconti non esistono, e il primo versamento è quello
            di giugno dell&apos;anno dopo.
          </span>
        </label>

        <label className="flex items-start gap-3 sm:mt-6">
          <input
            type="checkbox"
            checked={ing.requisitiNuovaAttivita}
            onChange={(e) => cambia("requisitiNuovaAttivita", e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-accento"
          />
          <span className="text-etichetta leading-relaxed">
            Ho i requisiti di novità: non ho svolto la stessa attività nei tre anni precedenti e non
            ne proseguo una di altri.
          </span>
        </label>
      </div>
      <p className="mt-4 text-etichetta text-inchiostro-tenue">
        Il fatturato massimo che questo simulatore accetta è {euroTondo(RICAVI_MASSIMI)}: oltre,
        il conto cambia natura e serve un commercialista, non una pagina.
      </p>
    </details>
  );
}

// ————————————————————————————————————————————————————————————
// f · Quando esce dal conto: una linea del tempo
// ————————————————————————————————————————————————————————————

function QuandoEsce({ scadenze }: { scadenze: EsitoSimulazione["scadenze"] }) {
  const conImporto = scadenze.filter((s) => s.importo !== null && s.importo > 0);
  if (conImporto.length === 0) return null;

  return (
    <AlComparire>
      <section aria-labelledby="calendario" className="mt-10">
        <h2 id="calendario" className="font-display text-titolo font-semibold tracking-tight">
          Quando esce dal conto
        </h2>
        {/*
          Verticale sul telefono e orizzontale da `sm` in su: su 375 px quattro
          tappe affiancate diventano quattro colonne da 80 px, dove un importo a
          quattro cifre va a capo in mezzo alle migliaia.
        */}
        <ol
          {...NASCOSTO_A_CLARITY}
          className="mt-5 grid gap-0 sm:grid-flow-col sm:auto-cols-fr sm:gap-4"
        >
          {conImporto.map((s, i) => (
            <li
              key={s.id}
              className="relative flex gap-4 pb-6 last:pb-0 sm:block sm:border-t sm:border-bordo sm:pt-4 sm:pb-0"
            >
              {/* Il filo e il punto: solo in verticale, dove la linea si legge. */}
              <span aria-hidden className="relative flex w-3 shrink-0 justify-center sm:hidden">
                <span className="mt-1.5 size-2.5 rounded-full bg-accento" />
                {i < conImporto.length - 1 && (
                  <span className="absolute top-5 bottom-0 w-px bg-bordo" />
                )}
              </span>
              <div className="min-w-0">
                <p className="cifre text-etichetta font-semibold text-accento">
                  {dataEstesa(s.data)}
                </p>
                <p className="cifre mt-1 text-kpi-sm font-semibold">{euro(s.importo)}</p>
                <p className="mt-1 text-etichetta leading-relaxed text-inchiostro-tenue">
                  {s.titolo}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 flex max-w-[64ch] gap-2 text-etichetta leading-relaxed text-inchiostro-tenue">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Sono le date dell&apos;anno simulato. Saldo e acconti non compaiono qui con un importo:
            dipendono dall&apos;anno precedente, e in una simulazione un anno precedente non c&apos;è
            — stanno nel riquadro in cima, dove il conto è quello di un anno a regime.
          </span>
        </p>
      </section>
    </AlComparire>
  );
}
