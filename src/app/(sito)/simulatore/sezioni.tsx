"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, CalendarX, Layers, Scale, Receipt } from "lucide-react";
import { SITO, rottaDemo } from "@/lib/rotte";
import { euro, euroTondo, percentuale } from "@/lib/format";
import { PREZZO_SCRITTO } from "@/lib/sito/acquisto";
import { DA_RIEMPIRE, OFFERTA } from "@/lib/sito/offerta";
import { conUtm } from "@/lib/sito/utm";
import { AlComparire } from "@/components/sito/apparizione";
import type { EsitoSimulazione } from "@/lib/sito/simulatore";

const NASCOSTO_A_CLARITY = { "data-clarity-mask": "True" } as const;

/** La schermata del cruscotto, in WebP: 90 KB al posto di 566. Vedi `strumenti/immagine-webp.mjs`. */
const CRUSCOTTO = "/schermate/cruscotto.webp";

// ————————————————————————————————————————————————————————————
// 3 · Forfettario o ordinario
// ————————————————————————————————————————————————————————————

export function Confronto({ esito }: { esito: EsitoSimulazione }) {
  const { confronto } = esito;
  const vincente = confronto.convenienza.toLowerCase();

  const card = [
    {
      nome: "Forfettario",
      s: confronto.forfettario,
      applicabile: confronto.forfettarioApplicabile,
    },
    { nome: "Ordinario", s: confronto.ordinario, applicabile: true },
  ];

  /*
    Il vantaggio come differenza fra i due netti, e non come un numero nuovo:
    è la stessa cifra che il verdetto del motore racconta a parole, e due modi
    di calcolarla sarebbero due numeri nel giorno in cui uno cambia.
  */
  const vantaggio = Math.abs(
    confronto.forfettario.nettoInTasca - confronto.ordinario.nettoInTasca,
  );

  return (
    <AlComparire>
      <section {...NASCOSTO_A_CLARITY} aria-labelledby="confronto" className="mt-16">
        <h2 id="confronto" className="font-display text-kpi font-semibold tracking-tight">
          Forfettario o ordinario
        </h2>
        <p className="mt-2 max-w-[60ch] text-corpo leading-relaxed text-inchiostro-tenue">
          Stessi ricavi, stessi costi, le due strade a confronto.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {card.map(({ nome, s, applicabile }) => {
            const conviene = vincente === nome.toLowerCase() && applicabile;
            return (
              <div
                key={nome}
                className={`relative h-full rounded-interna border px-5 py-5 ${
                  conviene
                    ? "border-accento bg-accento-tenue shadow-sollevato"
                    : "border-bordo bg-superficie"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-etichetta font-semibold">{nome}</p>
                  {conviene && vantaggio > 0 && (
                    <span className="cifre rounded-full bg-accento px-2.5 py-1 text-micro font-semibold text-white">
                      Ti restano +{euroTondo(vantaggio)} all&apos;anno
                    </span>
                  )}
                </div>
                <p className="cifre mt-3 text-kpi font-semibold tracking-tight">
                  {euro(s.nettoInTasca)}
                </p>
                <p className="text-etichetta text-inchiostro-tenue">ti restano in un anno</p>
                <p className="mt-3 text-etichetta leading-relaxed text-inchiostro-tenue">
                  {euro(s.caricoTotale)} fra imposte e contributi — il{" "}
                  {percentuale(s.pressione, 1)}.
                </p>
                {!applicabile && (
                  <p className="mt-2 text-etichetta text-attenzione">
                    Non applicabile a questi ricavi.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-5 max-w-[62ch] text-corpo leading-relaxed">{confronto.verdetto}</p>
        <p className="mt-3 max-w-[62ch] text-etichetta leading-relaxed text-inchiostro-tenue">
          Il confronto non è solo fiscale: nel forfettario non addebiti l&apos;IVA — un vantaggio
          verso i privati, niente verso le imprese — non detrai l&apos;IVA sugli acquisti, non usi
          le detrazioni personali e non deduci il fondo pensione.
        </p>
      </section>
    </AlComparire>
  );
}

// ————————————————————————————————————————————————————————————
// 5 · Il ponte: dal conto stimato ai conti veri
// ————————————————————————————————————————————————————————————

const PONTE = [
  {
    icona: Layers,
    titolo: "Le fatture non arrivano in fila",
    testo:
      "Il simulatore ragiona su un anno regolare. Il tuo non lo è: Flowlance ricalcola "
      + "l'accantonamento a ogni fattura che registri.",
  },
  {
    icona: CalendarX,
    titolo: "Gli acconti non avvisano",
    testo:
      "Scadenze e importi sempre davanti agli occhi, aggiornati sui tuoi incassi veri, non su "
      + "una stima di gennaio.",
  },
  {
    icona: Receipt,
    titolo: "Un conto solo per tutto",
    testo: "Vedi quanto dei soldi sul conto è davvero tuo e quanto è già del fisco.",
  },
] as const;

export function Ponte() {
  return (
    <AlComparire>
      <section aria-labelledby="ponte" className="mt-16">
        <h2
          id="ponte"
          className="max-w-[30ch] font-display text-kpi font-semibold tracking-tight sm:text-semaforo"
        >
          Il simulatore ti dice quanto. Flowlance ti dice se ce l&apos;hai.
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {PONTE.map(({ icona: Icona, titolo, testo }, i) => (
            <AlComparire key={titolo} ritardoMs={i * 70}>
              <div className="h-full rounded-interna border border-bordo bg-superficie px-5 py-5">
                <Icona className="size-5 text-accento" aria-hidden />
                <p className="mt-3 text-corpo font-semibold">{titolo}</p>
                <p className="mt-1.5 text-etichetta leading-relaxed text-inchiostro-tenue">
                  {testo}
                </p>
              </div>
            </AlComparire>
          ))}
        </div>

        {/*
          La cornice da finestra, e perché l'immagine è una WebP e non il PNG.

          `images: { unoptimized: true }` è obbligatorio con l'export statico:
          `next/image` consegna il file così com'è, quindi il PNG da 566 KB
          sarebbe arrivato intero su un telefono per mostrarsi largo 343 px. La
          WebP alla misura giusta pesa 90 KB — vedi `strumenti/immagine-webp.mjs`.
          Di `next/image` restano le due cose che qui servono davvero: il
          caricamento differito e le misure dichiarate, che tengono il posto
          dell'immagine e non fanno saltare la pagina quando arriva.
        */}
        <div className="mt-8 rounded-card border border-bordo bg-superficie p-2 shadow-sollevato sm:p-3">
          <div className="flex items-center gap-1.5 px-2 py-2" aria-hidden>
            {["#E5484D", "#F5A524", "#10B981"].map((c) => (
              <span key={c} className="size-2.5 rounded-full" style={{ background: c }} />
            ))}
            <span className="ml-2 h-5 flex-1 rounded-full bg-superficie-alt" />
          </div>
          <Image
            src={CRUSCOTTO}
            alt="Il cruscotto di Flowlance con un anno di fatture dentro: quanto è tuo, quanto è del fisco, le prossime scadenze."
            width={1760}
            height={1100}
            sizes="(min-width: 1024px) 880px, 100vw"
            className="block h-auto w-full rounded-interna"
          />
        </div>

        <div className="mt-6">
          <Link
            href={rottaDemo("vetrina")}
            className="inline-flex items-center justify-center gap-2 rounded-campo bg-accento px-6 py-3.5 text-campo font-semibold text-white transition-opacity hover:opacity-90"
          >
            Guarda la demo, senza registrarti
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <p className="mt-2 text-etichetta text-inchiostro-tenue">
            È l&apos;applicazione intera, con un anno di fatture già dentro. Non chiede niente.
          </p>
        </div>
      </section>
    </AlComparire>
  );
}

// ————————————————————————————————————————————————————————————
// 6 · L'offerta — testi segnaposto, visibili di proposito
// ————————————————————————————————————————————————————————————

export function Offerta() {
  return (
    <AlComparire>
      <section aria-labelledby="offerta" className="mt-16">
        <div className="mx-auto max-w-[32rem] rounded-card border border-bordo bg-superficie px-5 py-7 shadow-sollevato sm:px-8 sm:py-9">
          {DA_RIEMPIRE && (
            /*
              La fascia che dice che qui manca del testo. Si vede, e deve
              vedersi: un segnaposto invisibile è quello che finisce in
              produzione, e si scopre da uno screenshot in una chat.
            */
            <p className="mb-5 rounded-campo border border-attenzione bg-attenzione-tenue px-3 py-2 text-micro font-semibold uppercase tracking-[0.1em]">
              Testi da scrivere · src/lib/sito/offerta.ts
            </p>
          )}

          <h2 id="offerta" className="font-display text-kpi font-semibold tracking-tight">
            {OFFERTA.nome}
          </h2>
          <p className="mt-2 text-corpo leading-relaxed text-inchiostro-tenue">
            {OFFERTA.sottotitolo}
          </p>

          {/* Il prezzo arriva da `acquisto.ts`, già scritto: non si riscrive qui. */}
          <p className="mt-6 flex items-baseline gap-2">
            <span className="cifre text-semaforo font-semibold tracking-tight">
              {PREZZO_SCRITTO.imponibile}
            </span>
            <span className="text-etichetta text-inchiostro-tenue">
              + IVA all&apos;anno · {PREZZO_SCRITTO.totale} con l&apos;IVA
            </span>
          </p>

          <ul className="mt-6 space-y-3">
            {OFFERTA.include.map((voce) => (
              <li key={voce} className="flex gap-3 text-corpo leading-relaxed">
                <Check className="mt-0.5 size-4 shrink-0 text-positivo" aria-hidden />
                <span>{voce}</span>
              </li>
            ))}
          </ul>

          <p className="mt-6 rounded-campo bg-superficie-alt px-4 py-3 text-etichetta leading-relaxed">
            <strong className="font-semibold cifre">{OFFERTA.posti}</strong> posti rimasti.
          </p>

          <Link
            href={conUtm(SITO.acquisto, "simulatore")}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-campo bg-accento px-6 py-3.5 text-campo font-semibold text-white transition-opacity hover:opacity-90"
          >
            Acquista Flowlance
            <ArrowRight className="size-4" aria-hidden />
          </Link>

          <p className="mt-4 flex gap-2 text-etichetta leading-relaxed text-inchiostro-tenue">
            <Scale className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{OFFERTA.garanzia}</span>
          </p>
        </div>
      </section>
    </AlComparire>
  );
}

// ————————————————————————————————————————————————————————————
// 7 · Le domande
// ————————————————————————————————————————————————————————————

/**
 * Le risposte, e l'unico numero che non è un segnaposto.
 *
 * «di solito entro 24 ore» e non «entro [X] ore»: le ventiquattro ore
 * lavorative sono scritte nei Termini, cioè in un contratto, e ripetute in
 * altri quattro punti del sito. Un numero diverso qui — o un segnaposto
 * pubblicato — sarebbe una promessa che contraddice quella che obbliga.
 */
const DOMANDE: { d: string; r: React.ReactNode }[] = [
  {
    d: "Sostituisce il commercialista?",
    r: (
      <>
        No. Ti dice quanto mettere da parte e quando pagherai, così arrivi dal commercialista con
        i conti in ordine e senza sorprese.
      </>
    ),
  },
  {
    d: "Dove finiscono i miei dati?",
    r: (
      <>
        Sul tuo computer. Flowlance non ha un server che li raccoglie: tu li salvi, tu li esporti,
        tu fai il backup.
      </>
    ),
  },
  {
    d: "Funziona anche in regime ordinario?",
    r: <>Sì, forfettario e ordinario, con IVA, ritenute e acconti.</>,
  },
  {
    d: "Cosa succede dopo l'acquisto?",
    r: (
      <>
        Dopo il pagamento ti mando per email i Termini da approvare; appena li rimandi ricevi la
        chiave di attivazione, di solito entro 24 ore lavorative.
      </>
    ),
  },
  {
    d: "E quando cambiano le regole fiscali?",
    r: <>I parametri vengono aggiornati a ogni anno fiscale: aliquote, soglie, contributi.</>,
  },
  {
    d: "Cosa non calcola?",
    r: (
      <>
        C&apos;è un elenco pubblico delle semplificazioni, scritto prima di vendere e non dopo:{" "}
        <Link href={SITO.approssimazioni} className="underline underline-offset-2">
          cosa Flowlance non calcola
        </Link>
        .
      </>
    ),
  },
];

export function Domande() {
  return (
    <AlComparire>
      <section aria-labelledby="domande-frequenti" className="mt-16">
        <h2
          id="domande-frequenti"
          className="font-display text-kpi font-semibold tracking-tight"
        >
          Domande
        </h2>
        <div className="mt-5 divide-y divide-bordo border-y border-bordo">
          {DOMANDE.map(({ d, r }) => (
            <details key={d} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-corpo font-medium">
                {d}
                <span
                  aria-hidden
                  className="shrink-0 text-kpi-sm leading-none text-inchiostro-tenue transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-[64ch] pb-4 text-corpo leading-relaxed text-inchiostro-tenue">
                {r}
              </p>
            </details>
          ))}
        </div>
      </section>
    </AlComparire>
  );
}

// ————————————————————————————————————————————————————————————
// 8 · La fascia finale
// ————————————————————————————————————————————————————————————

export function Chiusura() {
  return (
    <AlComparire>
      <section aria-labelledby="chiusura" className="mt-16">
        <div className="rounded-card bg-inchiostro px-5 py-9 text-center sm:px-8 sm:py-12">
          <h2
            id="chiusura"
            className="mx-auto max-w-[26ch] font-display text-kpi font-semibold tracking-tight text-white sm:text-semaforo"
          >
            Quest&apos;anno l&apos;hai calcolato. L&apos;anno prossimo sappilo da gennaio.
          </h2>
          <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <Link
              href={conUtm(SITO.acquisto, "simulatore", "chiusura")}
              className="inline-flex items-center justify-center gap-2 rounded-campo bg-accento px-6 py-3.5 text-campo font-semibold text-white transition-opacity hover:opacity-90"
            >
              Acquista Flowlance
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href={rottaDemo("vetrina")}
              className="inline-flex items-center justify-center gap-2 rounded-campo border border-white/25 px-6 py-3.5 text-campo font-semibold text-white transition-colors hover:border-white/50"
            >
              Guarda la demo
            </Link>
          </div>
        </div>

        <p className="mt-8 max-w-[64ch] text-etichetta leading-relaxed text-inchiostro-tenue">
          Stima su un anno pieno e regolare. Alcune situazioni non sono coperte:{" "}
          <Link href={SITO.approssimazioni} className="underline underline-offset-2">
            ecco quali
          </Link>
          .
        </p>
      </section>
    </AlComparire>
  );
}
