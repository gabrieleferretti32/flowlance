"use client";

import * as React from "react";
import { ArrowDown, Lock, ShieldCheck, FileText, UserX } from "lucide-react";
import { euroTondo } from "@/lib/format";
import { parametriDi } from "@/lib/fisco/parametri";
import { derivato } from "@/lib/fisco/derivati/registro";
import { GESTIONI } from "@/lib/fisco/tipi";
import type { Gestione } from "@/lib/fisco/tipi";
import { EVENTO_SIMULATORE, tracciaEvento } from "@/lib/sito/eventi";
import { PROMEMORIA_ATTIVI } from "@/lib/sito/impostazioni";
import { appuntamentiFiscali, type Appuntamenti } from "@/lib/sito/appuntamenti";
import {
  ANNO,
  INGRESSO_INIZIALE,
  RICAVI_MASSIMI,
  simula,
  type IngressoSimulatore,
} from "@/lib/sito/simulatore";
import { Risultato } from "./risultato";
import { Promemoria, PromemoriaSpenti, ANCORA_PROMEMORIA } from "./promemoria";
import { Chiusura, Confronto, Domande, Offerta, Ponte } from "./sezioni";
import { BarraMobile } from "./barra-mobile";

const NASCOSTO_A_CLARITY = { "data-clarity-mask": "True" } as const;

const GESTIONE_DETTA: Record<Gestione, string> = {
  separata: "Gestione Separata INPS — la più comune fra i freelance senza albo",
  artigiani: "Artigiani INPS — contributi fissi più il percentuale sull'eccedenza",
  commercianti: "Commercianti INPS — come gli artigiani, più lo 0,48 %",
  cassa: "Cassa professionale — avvocati, ingegneri, commercialisti, giornalisti",
};

const FIDUCIA = [
  { icona: UserX, testo: "Nessuna registrazione" },
  { icona: ShieldCheck, testo: "I numeri restano sul tuo dispositivo" },
  { icona: FileText, testo: "Calcolo spiegato voce per voce" },
] as const;

/**
 * Il simulatore pubblico: una pagina che risponde, e poi vende.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Che giorno è oggi, e perché non si sa subito
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il riquadro della prossima scadenza ha bisogno della data vera: a dicembre,
 * «il 30 novembre» è una data che non esiste più. Ma questo sito è un export
 * statico, e l'HTML lo scrive il build: un `new Date()` letto durante il
 * rendering darebbe il giorno della pubblicazione, che resterebbe scritto in
 * pagina per tutte le settimane fino al build successivo — e sarebbe diverso da
 * quello che il browser calcola, cioè un'idratazione che non combacia.
 *
 * Perciò si parte dal 1° gennaio dell'anno simulato — un valore deterministico,
 * identico sul server e al primo rendering del client, e vero per il calendario
 * che il motore ha costruito — e si passa alla data vera in un effetto, subito
 * dopo il montaggio. Chi guarda vede il numero giusto; nessuno vede una data
 * passata; e l'idratazione combacia perché il primo rendering dei due lati usa
 * lo stesso valore.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Lo scorrimento al risultato, una volta e su richiesta
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il conto si rifà a ogni battuta sulla tastiera, com'è sempre stato. Lo
 * scorrimento no: legato al ricalcolo, trascinare il fatturato porterebbe la
 * pagina a saltare quaranta volte in dieci secondi. Parte da un pulsante —
 * «Vedi il tuo conto» — che è un gesto deliberato, mentre i numeri sotto
 * restano vivi: nessuno aspetta un calcolo, e nessuno viene trascinato.
 */
export function SchermataSimulatore() {
  const [ing, setIng] = React.useState<IngressoSimulatore>(INGRESSO_INIZIALE);
  const par = parametriDi(ANNO);

  /* Vedi il commento in cima: deterministico al primo rendering, vero dopo. */
  const [oggi, setOggi] = React.useState(`${ANNO}-01-01`);
  React.useEffect(() => {
    setOggi(new Date().toISOString().slice(0, 10));
  }, []);

  const esito = React.useMemo(() => simula(ing), [ing]);
  const { prospetto, impostazioni, scadenze } = esito;

  /*
    L'evento parte una volta sola, non a ogni battuta: chi trascina il campo
    dei ricavi produrrebbe quaranta «risultato calcolato» in dieci secondi, e
    il numero misurerebbe la nervosità del dito invece dell'uso della pagina.
  */
  const contato = React.useRef(false);
  React.useEffect(() => {
    if (contato.current) return;
    contato.current = true;
    tracciaEvento(EVENTO_SIMULATORE);
  }, []);

  const cambia = React.useCallback(
    <K extends keyof IngressoSimulatore>(campo: K, valore: IngressoSimulatore[K]) =>
      setIng((p) => ({ ...p, [campo]: valore })),
    [],
  );

  const coefficiente = derivato("coefficienteRedditivita", impostazioni, par);

  /*
    Gli appuntamenti si calcolano qui e non in due posti: li usa il riquadro
    della scadenza, e li usa il modulo dei promemoria per sapere quali date
    mandare. Due calcoli identici in due componenti sarebbero due date nel
    giorno in cui uno dei due cambia — e la seconda, quella che finisce in
    un'email, è quella che nessuno riguarda.
  */
  const appuntamenti: Appuntamenti | null = React.useMemo(() => {
    const giugno = scadenze.find((s) => s.id === "saldo-e-primo-acconto")?.data;
    const novembre = scadenze.find((s) => s.id === "secondo-acconto")?.data;
    if (!giugno || !novembre) return null;
    return appuntamentiFiscali({
      carico: prospetto.caricoTotale,
      acconti: prospetto.acconti,
      dataGiugno: giugno,
      dataNovembre: novembre,
      primoAnno: ing.annoAperturaPiva === ANNO,
      oggi,
    });
  }, [scadenze, prospetto.caricoTotale, prospetto.acconti, ing.annoAperturaPiva, oggi]);

  // ——— La barra fissa del telefono ———
  const ancoraRisultato = React.useRef<HTMLDivElement>(null);
  const [vistoIlConto, setVistoIlConto] = React.useState(false);
  const [optInAVista, setOptInAVista] = React.useState(false);
  const [iscritto, setIscritto] = React.useState(false);

  React.useEffect(() => {
    if (typeof IntersectionObserver !== "function") return;
    const bersagli = [
      ancoraRisultato.current,
      document.getElementById(ANCORA_PROMEMORIA),
    ].filter((n): n is HTMLElement => n !== null);
    if (bersagli.length === 0) return;

    const osservatore = new IntersectionObserver(
      (voci) => {
        for (const v of voci) {
          if (v.target === ancoraRisultato.current) {
            if (v.isIntersecting) setVistoIlConto(true);
          } else {
            setOptInAVista(v.isIntersecting);
          }
        }
      },
      { threshold: 0.12 },
    );
    for (const b of bersagli) osservatore.observe(b);
    return () => osservatore.disconnect();
  }, []);

  function vaiAlRisultato() {
    const nodo = ancoraRisultato.current;
    if (!nodo) return;
    const fermi = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    nodo.scrollIntoView({ behavior: fermi ? "auto" : "smooth", block: "start" });
    setVistoIlConto(true);
  }

  return (
    <>
      {/*
        Il margine in fondo lascia il posto alla barra fissa del telefono: senza,
        l'ultima riga resta sotto e non si legge. Solo fino a `sm`, dove la barra
        non c'è.
      */}
      <main className="mx-auto w-full max-w-[64rem] px-5 pt-10 pb-28 sm:px-6 sm:pt-14 sm:pb-20">
        {/* ——— 1 · L'eroe, con il simulatore dentro ——— */}
        <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:items-start lg:gap-12">
          <div>
            <p className="text-micro font-semibold uppercase tracking-[0.14em] text-accento">
              {/* L'anno non è scritto a mano: è quello su cui il motore simula. */}
              Per freelance e partite IVA · Parametri {ANNO}
            </p>
            <h1 className="mt-3 max-w-[26ch] font-display text-kpi font-semibold leading-[1.1] tracking-tight sm:text-semaforo lg:text-[2.75rem]">
              Quanto pagherai di tasse quest&apos;anno, e quanto devi mettere da parte ogni mese
            </h1>
            <p className="mt-4 max-w-[52ch] text-corpo leading-relaxed text-inchiostro-tenue">
              Tre risposte e hai il conto: imposte, contributi e scadenze, con lo stesso motore di
              Flowlance.
            </p>

            <ul className="mt-6 flex flex-wrap gap-2">
              {FIDUCIA.map(({ icona: Icona, testo }) => (
                <li
                  key={testo}
                  className="inline-flex items-center gap-1.5 rounded-full border border-bordo bg-superficie px-3 py-1.5 text-etichetta text-inchiostro-tenue"
                >
                  <Icona className="size-3.5 shrink-0 text-positivo" aria-hidden />
                  {testo}
                </li>
              ))}
            </ul>

            {/*
              La riga sulla riservatezza sta in alto e non nel piede, perché è
              la cosa che decide se una persona scrive il proprio fatturato in
              un campo di un sito che non conosce. Ed è vera alla lettera: il
              conto gira qui, `verifica-import-simulatore` controlla che da
              questa pagina non si arrivi nemmeno all'archivio, e l'unica cosa
              che esce sono i sei attributi del promemoria — al submit, e solo
              se l'hai chiesto.
            */}
            <p className="mt-6 flex max-w-[58ch] gap-2 rounded-campo border border-bordo bg-superficie-alt px-3 py-2.5 text-etichetta leading-relaxed text-inchiostro-tenue">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                I numeri che scrivi restano in questa pagina: non si salvano e non li vede nessuno.
                Partono solo se chiedi i promemoria delle scadenze, e solo quelli che servono a
                mandarteli.
              </span>
            </p>
          </div>

          {/* ——— La card del simulatore ——— */}
          <section
            aria-labelledby="domande"
            className="rounded-card border border-bordo bg-superficie px-5 py-6 shadow-sollevato sm:px-6"
          >
            <h2 id="domande" className="text-corpo font-semibold">
              Tre domande
            </h2>

            <div className="mt-5 space-y-5">
              <label className="block">
                <span className="text-etichetta font-medium">
                  Quanto pensi di fatturare in un anno
                </span>
                <span className="mt-1.5 flex items-center gap-2 rounded-campo border border-bordo px-3 py-2.5 focus-within:border-accento">
                  <input
                    {...NASCOSTO_A_CLARITY}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={RICAVI_MASSIMI}
                    step={1000}
                    value={ing.ricavi}
                    onChange={(e) =>
                      cambia(
                        "ricavi",
                        Math.max(0, Math.min(RICAVI_MASSIMI, Number(e.target.value) || 0)),
                      )
                    }
                    className="cifre w-full bg-transparent text-campo outline-none"
                  />
                  <span aria-hidden className="text-inchiostro-tenue">
                    €
                  </span>
                </span>
                <span className="mt-1.5 block text-etichetta text-inchiostro-tenue">
                  Imponibile, IVA esclusa. Fino a {euroTondo(RICAVI_MASSIMI)}.
                </span>
              </label>

              <label className="block">
                <span className="text-etichetta font-medium">Che lavoro fai</span>
                <select
                  value={ing.gruppoAteco}
                  onChange={(e) => cambia("gruppoAteco", e.target.value)}
                  className="mt-1.5 w-full rounded-campo border border-bordo bg-superficie px-3 py-2.5 text-campo"
                >
                  {par.gruppiAteco.map((g) => (
                    <option key={g.codice} value={g.codice}>
                      {g.descrizione}
                    </option>
                  ))}
                </select>
                {/*
                  Il coefficiente si chiede al registro, non si legge dal campo:
                  `derivato` restituisce il valore **insieme al motivo**, e il
                  motivo è esattamente la nota «da dove viene il numero» che
                  questa pagina deve dare. Leggere il campo grezzo avrebbe dato
                  lo stesso numero e nessuna spiegazione — e un test di struttura
                  del progetto lo rifiuta, perché è così che un'aliquota
                  agevolata è rimasta accesa per anni.
                */}
                <span
                  {...NASCOSTO_A_CLARITY}
                  className="mt-1.5 block text-etichetta leading-relaxed text-inchiostro-tenue"
                >
                  {coefficiente.motivo}
                </span>
              </label>

              <label className="block">
                <span className="text-etichetta font-medium">Dove versi i contributi</span>
                <select
                  value={ing.gestione}
                  onChange={(e) => cambia("gestione", e.target.value as Gestione)}
                  className="mt-1.5 w-full rounded-campo border border-bordo bg-superficie px-3 py-2.5 text-campo"
                >
                  {GESTIONI.map((g) => (
                    <option key={g} value={g}>
                      {GESTIONE_DETTA[g]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={vaiAlRisultato}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-campo bg-accento px-6 py-3.5 text-campo font-semibold text-white transition-opacity hover:opacity-90"
            >
              Vedi il tuo conto
              <ArrowDown className="size-4" aria-hidden />
            </button>
          </section>
        </section>

        {/* ——— 2 · Il risultato ——— */}
        <div className="mt-12 sm:mt-16">
          <Risultato
            esito={esito}
            ing={ing}
            oggi={oggi}
            cambia={cambia}
            ancora={ancoraRisultato}
          />
        </div>

        {/* ——— 3 · I due regimi ——— */}
        <Confronto esito={esito} />

        {/* ——— 4 · I promemoria, o il loro posto ——— */}
        <div className="mt-16">
          {PROMEMORIA_ATTIVI ? (
            <Promemoria
              ing={ing}
              appuntamenti={appuntamenti}
              accantonamentoMensile={prospetto.accantonamentoMensile}
              onIscritto={() => setIscritto(true)}
            />
          ) : (
            <PromemoriaSpenti />
          )}
        </div>

        {/* ——— 5, 6, 7, 8 ——— */}
        <Ponte />
        <Offerta />
        <Domande />
        {/*
          La riga sulle approssimazioni sta **dentro** `Chiusura` e non anche
          qui: erano due paragrafi di seguito che dicevano la stessa cosa con
          parole diverse — «stima su un anno pieno e regolare» due volte, a
          quattro righe di distanza. Si vede solo guardando il fondo della
          pagina su un telefono, che è il posto in cui si guarda meno.
        */}
        <Chiusura />
      </main>

      <BarraMobile
        visibile={vistoIlConto && !optInAVista && !iscritto}
        attiva={PROMEMORIA_ATTIVI}
      />
    </>
  );
}
