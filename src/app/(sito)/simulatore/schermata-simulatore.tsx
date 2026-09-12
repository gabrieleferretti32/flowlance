"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { SITO, rottaDemo } from "@/lib/rotte";
import { euro, euroTondo, dataEstesa, percentuale } from "@/lib/format";
import { parametriDi } from "@/lib/fisco/parametri";
import { prospettoDettagliato, type RigaProspetto } from "@/lib/fisco/spiegazioni";
import { derivato } from "@/lib/fisco/derivati/registro";
import { GESTIONI } from "@/lib/fisco/tipi";
import type { Gestione, Regime } from "@/lib/fisco/tipi";
import { EVENTO_SIMULATORE, tracciaEvento } from "@/lib/sito/eventi";
import {
  ANNO,
  INGRESSO_INIZIALE,
  RICAVI_MASSIMI,
  righeMostrate,
  simula,
  type IngressoSimulatore,
} from "@/lib/sito/simulatore";

const GESTIONE_DETTA: Record<Gestione, string> = {
  separata: "Gestione Separata INPS — la più comune fra i freelance senza albo",
  artigiani: "Artigiani INPS — contributi fissi più il percentuale sull'eccedenza",
  commercianti: "Commercianti INPS — come gli artigiani, più lo 0,48 %",
  cassa: "Cassa professionale — avvocati, ingegneri, commercialisti, giornalisti",
};

const REGIME_DETTO: Record<Regime, string> = {
  forfettario: "Forfettario",
  ordinario: "Ordinario (semplificato)",
};

export function SchermataSimulatore() {
  const [ing, setIng] = React.useState<IngressoSimulatore>(INGRESSO_INIZIALE);
  const par = parametriDi(ANNO);

  const esito = React.useMemo(() => simula(ing), [ing]);
  const { prospetto, impostazioni, confronto, scadenze } = esito;

  /*
    L'evento parte una volta sola, non a ogni battuta sulla tastiera: chi
    trascina il cursore dei ricavi produrrebbe quaranta «risultato calcolato»
    in dieci secondi, e il numero misurerebbe la nervosità del dito invece
    dell'uso della pagina.
  */
  const contato = React.useRef(false);
  React.useEffect(() => {
    if (contato.current) return;
    contato.current = true;
    tracciaEvento(EVENTO_SIMULATORE);
  }, []);

  const righe = React.useMemo(() => {
    const tutte = prospettoDettagliato(prospetto, impostazioni, par)
      .flatMap((s) => s.righe);
    return righeMostrate(ing.gestione, ing.regime)
      .map((id) => tutte.find((r) => r.id === id))
      .filter(
      (r): r is RigaProspetto => Boolean(r),
    );
  }, [prospetto, impostazioni, par, ing.gestione, ing.regime]);

  const cambia = <K extends keyof IngressoSimulatore>(campo: K, valore: IngressoSimulatore[K]) =>
    setIng((p) => ({ ...p, [campo]: valore }));

  const coefficiente = derivato("coefficienteRedditivita", impostazioni, par);
  const limite = derivato("limiteForfettario", impostazioni, par);
  const oltreIlLimite = limite.valore !== null && ing.ricavi > limite.valore;

  return (
    <main className="mx-auto w-full max-w-[52rem] px-5 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-kpi font-semibold tracking-tight">
        Quanto lascia al fisco un freelance
      </h1>
      <p className="mt-3 max-w-[54ch] text-corpo leading-relaxed text-inchiostro-tenue">
        Tre risposte e il conto è fatto, con lo stesso motore che c&apos;è dentro Flowlance.
        Parametri {ANNO}.
      </p>
      {/*
        La promessa sta in alto e non nel piede, perché è la cosa che decide se
        una persona scrive il proprio fatturato in un campo di un sito che non
        conosce. Ed è vera: il conto gira qui, e `verifica-import-simulatore`
        controlla che da questa pagina non si arrivi nemmeno all'archivio.
      */}
      <p className="mt-4 inline-flex items-center gap-2 rounded-campo border border-bordo bg-superficie-alt/60 px-3 py-2 text-etichetta text-inchiostro-tenue">
        <Lock className="size-4 shrink-0" aria-hidden />
        I numeri che scrivi restano in questa pagina: non partono, non si salvano, non li vede
        nessuno.
      </p>

      {/* ——— Le tre domande ——— */}
      <section aria-labelledby="domande" className="mt-10">
        <h2 id="domande" className="sr-only">
          I tuoi dati
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-etichetta font-medium">Quanto pensi di fatturare in un anno</span>
            <span className="mt-1 flex items-center gap-2 rounded-campo border border-bordo px-3 py-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={RICAVI_MASSIMI}
                step={1000}
                value={ing.ricavi}
                onChange={(e) =>
                  cambia("ricavi", Math.max(0, Math.min(RICAVI_MASSIMI, Number(e.target.value) || 0)))
                }
                className="cifre w-full bg-transparent text-corpo outline-none"
              />
              <span aria-hidden className="text-inchiostro-tenue">€</span>
            </span>
            <span className="mt-1 block text-etichetta text-inchiostro-tenue">
              Imponibile, IVA esclusa.
            </span>
          </label>

          <label className="block">
            <span className="text-etichetta font-medium">Che lavoro fai</span>
            <select
              value={ing.gruppoAteco}
              onChange={(e) => cambia("gruppoAteco", e.target.value)}
              className="mt-1 w-full rounded-campo border border-bordo bg-superficie px-3 py-2 text-corpo"
            >
              {par.gruppiAteco.map((g) => (
                <option key={g.codice} value={g.codice}>
                  {g.descrizione}
                </option>
              ))}
            </select>
            {/*
              Il coefficiente si chiede al registro, non si legge dal campo:
              `derivato` restituisce il valore **insieme al motivo**, e il motivo
              è esattamente la nota «da dove viene il numero» che questa pagina
              deve dare. Leggere il campo grezzo avrebbe dato lo stesso numero e
              nessuna spiegazione — e un test di struttura del progetto lo
              rifiuta, perché è così che un'aliquota agevolata è rimasta accesa
              per anni.
            */}
            <span className="mt-1 block text-etichetta leading-relaxed text-inchiostro-tenue">
              {coefficiente.motivo}
            </span>
          </label>

          <label className="block sm:col-span-2">
            <span className="text-etichetta font-medium">Dove versi i contributi</span>
            <select
              value={ing.gestione}
              onChange={(e) => cambia("gestione", e.target.value as Gestione)}
              className="mt-1 w-full rounded-campo border border-bordo bg-superficie px-3 py-2 text-corpo"
            >
              {GESTIONI.map((g) => (
                <option key={g} value={g}>
                  {GESTIONE_DETTA[g]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* ——— Il risultato, nella forma onesta ——— */}
      <section
        aria-labelledby="risultato"
        className="mt-10 rounded-campo border border-accento/30 bg-accento-tenue px-5 py-6"
      >
        <h2 id="risultato" className="text-etichetta font-semibold uppercase tracking-wide text-inchiostro-tenue">
          Il conto
        </h2>
        {/*
          Due frasi e non una percentuale sola. «Pressione fiscale 38 %» è il
          numero che si cita e quello che non si sa spendere: quello che serve a
          chi lavora è quanto costa l'anno e quanto togliere da ogni bonifico
          perché a giugno i soldi ci siano. Le date esatte stanno sotto, dietro
          «affina il calcolo»: qui direbbero a una persona che non ha ancora
          aperto la partita IVA che ha una scadenza il 30 giugno.
        */}
        <p className="mt-3 text-corpo leading-relaxed">
          Su <strong className="font-semibold">{euroTondo(ing.ricavi)}</strong> fatturati in un anno,
          fra imposte e contributi lasci{" "}
          <strong className="font-semibold cifre">{euro(prospetto.caricoTotale)}</strong> — il{" "}
          {percentuale(prospetto.pressione, 1)} di quello che incassi.
        </p>
        <p className="mt-2 text-corpo leading-relaxed">
          Per arrivarci senza sorprese metti da parte{" "}
          <strong className="font-semibold cifre">{euro(prospetto.accantonamentoMensile)}</strong> al
          mese.
        </p>
        <p className="mt-3 text-etichetta text-inchiostro-tenue">
          Ti restano {euro(prospetto.nettoDisponibile)} all&apos;anno, al netto dei costi che hai
          dichiarato.
        </p>

        {oltreIlLimite && impostazioni.regime === "forfettario" && (
          <p className="mt-4 rounded-campo border border-attenzione/40 bg-attenzione-tenue px-4 py-3 text-etichetta leading-relaxed">
            Con {euroTondo(ing.ricavi)} sei oltre il limite del forfettario
            ({euroTondo(limite.valore)}): questo conto è quello che pagheresti se
            potessi restarci, e non ci puoi restare. Guarda l&apos;ordinario qui sotto.
          </p>
        )}
      </section>

      {/* ——— Da dove vengono i numeri ——— */}
      <section aria-labelledby="righe" className="mt-10">
        <h2 id="righe" className="font-display text-titolo font-semibold tracking-tight">
          Da dove viene
        </h2>
        <dl className="mt-4 divide-y divide-bordo border-y border-bordo">
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
      </section>

      {/* ——— Affina il calcolo ——— */}
      <details className="mt-8 rounded-campo border border-bordo px-5 py-4">
        <summary className="cursor-pointer text-corpo font-medium">Affina il calcolo</summary>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-etichetta font-medium">Regime</span>
            <select
              value={ing.regime}
              onChange={(e) => cambia("regime", e.target.value as Regime)}
              className="mt-1 w-full rounded-campo border border-bordo bg-superficie px-3 py-2 text-corpo"
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
            <span className="mt-1 flex items-center gap-2 rounded-campo border border-bordo px-3 py-2">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={500}
                value={ing.costiAnnui}
                onChange={(e) => cambia("costiAnnui", Math.max(0, Number(e.target.value) || 0))}
                className="cifre w-full bg-transparent text-corpo outline-none"
              />
              <span aria-hidden className="text-inchiostro-tenue">€</span>
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
              className="cifre mt-1 w-full rounded-campo border border-bordo bg-superficie px-3 py-2 text-corpo"
            />
            <span className="mt-1 block text-etichetta text-inchiostro-tenue">
              I cinque anni dell&apos;aliquota agevolata si contano da qui.
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
              Ho i requisiti di novità: non ho svolto la stessa attività nei tre anni precedenti e
              non ne proseguo una di altri.
            </span>
          </label>
        </div>

        {/* Le date, che stanno qui e non in cima. */}
        <h3 className="mt-8 text-etichetta font-semibold">Quando esce dal conto</h3>
        <ul className="mt-2 space-y-1">
          {scadenze
            .filter((s) => s.importo !== null && s.importo > 0)
            .map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-4 text-etichetta">
                <span className="text-inchiostro-tenue">
                  {dataEstesa(s.data)} — {s.titolo}
                </span>
                <span className="cifre shrink-0">{euro(s.importo)}</span>
              </li>
            ))}
        </ul>
        <p className="mt-3 max-w-[62ch] text-etichetta leading-relaxed text-inchiostro-tenue">
          Sono le date del primo anno pieno. Chi apre adesso non le ha tutte: gli acconti nascono
          dall&apos;anno prima, e un anno prima non c&apos;è.
        </p>
      </details>

      {/* ——— Il confronto fra i regimi, dopo ——— */}
      <section aria-labelledby="confronto" className="mt-12">
        <h2 id="confronto" className="font-display text-titolo font-semibold tracking-tight">
          Forfettario o ordinario
        </h2>
        <p className="mt-2 max-w-[60ch] text-corpo leading-relaxed text-inchiostro-tenue">
          Stessi ricavi, stessi costi, le due strade a confronto.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(
            [
              ["Forfettario", confronto.forfettario, confronto.forfettarioApplicabile],
              ["Ordinario", confronto.ordinario, true],
            ] as const
          ).map(([nome, s, applicabile]) => (
            <div
              key={nome}
              className={
                confronto.convenienza.toLowerCase() === nome.toLowerCase() && applicabile
                  ? "rounded-campo border border-accento/40 bg-accento-tenue px-4 py-4"
                  : "rounded-campo border border-bordo px-4 py-4"
              }
            >
              <p className="text-etichetta font-semibold">{nome}</p>
              <p className="cifre mt-2 text-titolo font-semibold">{euro(s.nettoInTasca)}</p>
              <p className="text-etichetta text-inchiostro-tenue">ti restano in un anno</p>
              <p className="mt-3 text-etichetta text-inchiostro-tenue">
                {euro(s.caricoTotale)} fra imposte e contributi — il {percentuale(s.pressione, 1)}.
              </p>
              {!applicabile && (
                <p className="mt-2 text-etichetta text-attenzione">
                  Non applicabile a questi ricavi.
                </p>
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-[62ch] text-corpo leading-relaxed">{confronto.verdetto}</p>
        <p className="mt-3 max-w-[62ch] text-etichetta leading-relaxed text-inchiostro-tenue">
          Il confronto non è solo fiscale: nel forfettario non addebiti l&apos;IVA — un vantaggio
          verso i privati, niente verso le imprese — non detrai l&apos;IVA sugli acquisti, non usi
          le detrazioni personali e non deduci il fondo pensione.
        </p>
      </section>

      {/*
        ——— Il posto del prospetto in PDF ———

        Qui andrà «scarica il prospetto», ed è l'unica cosa di questa pagina
        che starà dietro un indirizzo email. Il posto è segnato e vuoto di
        proposito: un pulsante che non scarica niente, o un «presto
        disponibile», è una promessa presa in cambio di un'attesa — e chi la
        legge oggi non tornerà a controllare domani.

        Quando si farà, va fatto con `prospettoDettagliato` e il disegnatore
        che stampa già i Termini (`src/lib/contenuti/marchio-pdf.ts`), non con
        una seconda impaginazione.
      */}

      {/* ——— Le due uscite ——— */}
      <section aria-labelledby="dopo" className="mt-14 border-t border-bordo pt-8">
        <h2 id="dopo" className="font-display text-titolo font-semibold tracking-tight">
          E adesso
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Link
            href={rottaDemo("vetrina")}
            className="group rounded-campo border border-bordo px-5 py-5 transition-colors hover:border-accento/50"
          >
            <p className="text-corpo font-medium">
              Prova Flowlance con dati veri{" "}
              <ArrowRight className="inline size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </p>
            <p className="mt-1 text-etichetta leading-relaxed text-inchiostro-tenue">
              La demo è l&apos;applicazione intera, con un anno di fatture già dentro. Non chiede
              niente.
            </p>
          </Link>
          <Link
            href={SITO.acquisto}
            className="group rounded-campo border border-accento/40 bg-accento-tenue px-5 py-5 transition-colors hover:border-accento"
          >
            <p className="text-corpo font-medium">
              Acquista Flowlance{" "}
              <ArrowRight className="inline size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </p>
            <p className="mt-1 text-etichetta leading-relaxed text-inchiostro-tenue">
              I tuoi numeri veri, non una simulazione: scadenze, IVA, accantonamento.
            </p>
          </Link>
        </div>
        <p className="mt-6 max-w-[62ch] text-etichetta leading-relaxed text-inchiostro-tenue">
          Questo simulatore è una stima su un anno pieno e regolare.{" "}
          <Link href={SITO.approssimazioni} className="underline underline-offset-2">
            Cosa Flowlance non calcola
          </Link>{" "}
          vale anche qui, e conviene leggerlo adesso.
        </p>
      </section>
    </main>
  );
}
