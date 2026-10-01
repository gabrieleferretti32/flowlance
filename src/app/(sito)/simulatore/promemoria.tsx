"use client";

import * as React from "react";
import Link from "next/link";
import { BellRing, Mail, ArrowRight } from "lucide-react";
import { API, SITO, rottaDemo } from "@/lib/rotte";
import { euro, giornoEMese } from "@/lib/format";
import { EVENTO_LEAD, tracciaClarity, tracciaEvento } from "@/lib/sito/eventi";
import type { NomeAttributo } from "@/lib/sito/promemoria";
import { AlComparire } from "@/components/sito/apparizione";
import type { Appuntamenti } from "@/lib/sito/appuntamenti";
import type { IngressoSimulatore } from "@/lib/sito/simulatore";

const NASCOSTO_A_CLARITY = { "data-clarity-mask": "True" } as const;

/** L'ancora della sezione: la barra fissa del telefono ci porta. */
export const ANCORA_PROMEMORIA = "promemoria";

type Stato = "fermo" | "invio" | "fatto" | "errore";

export type ProprietaPromemoria = {
  ing: IngressoSimulatore;
  appuntamenti: Appuntamenti | null;
  accantonamentoMensile: number;
  /** Chiamata a iscrizione riuscita: la barra fissa del telefono se ne va. */
  onIscritto: () => void;
};

/**
 * «Non segnarti le date. Te le ricordo io.»
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'unico posto in cui qualcosa esce dal browser
 * ─────────────────────────────────────────────────────────────────────────
 *
 * In cima alla pagina c'è scritto che i numeri restano lì, e che partono solo
 * se chiedi i promemoria, e solo quelli che servono a mandarteli. Questo
 * componente è quel «solo»: costruisce i sette attributi uno per uno — niente
 * gestione, niente gruppo ATECO, niente di quanto hai già da parte — e li
 * manda al **submit**, mai prima. Non c'è nessun effetto che parta digitando,
 * nessun `preconnect`, nessuno script di terzi in pagina: `verifica-consenso`
 * apre questa pagina e pretende che senza una risposta al banner non parta
 * nessuna richiesta verso nessuno.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché l'errore è un errore vero
 * ─────────────────────────────────────────────────────────────────────────
 *
 * La funzione in `api/promemoria.ts` risponde con un codice che si legge, e
 * questo componente lo guarda. È la ragione per cui l'iscrizione non passa dal
 * modulo incorporato di Brevo: quello si invia solo con `mode: "no-cors"`, che
 * manda i dati e restituisce una risposta opaca — e il «fatto» comparirebbe
 * identico anche quando Brevo ha rifiutato l'indirizzo. Un esito che conferma
 * sempre non è un esito.
 *
 * Per la stessa ragione l'evento `lead` parte **dopo** la risposta positiva, e
 * non al clic: al clic conterebbe i tentativi e li chiamerebbe iscrizioni,
 * crescendo proprio quando qualcosa è rotto.
 */
export function Promemoria({
  ing,
  appuntamenti,
  accantonamentoMensile,
  onIscritto,
}: ProprietaPromemoria) {
  const [email, setEmail] = React.useState("");
  const [consenso, setConsenso] = React.useState(false);
  const [stato, setStato] = React.useState<Stato>("fermo");
  const [errore, setErrore] = React.useState("");

  /*
    L'istante in cui il modulo è comparso: la trappola temporale. Si fissa al
    montaggio e non si tocca più — ricalcolarlo a ogni battuta misurerebbe
    l'ultimo tasto premuto invece del tempo passato sul modulo.
  */
  const apertoA = React.useRef<number>(Date.now());

  const prossimo = appuntamenti?.prossimo ?? null;
  const seguente = appuntamenti?.seguente ?? null;

  async function invia(e: React.FormEvent) {
    e.preventDefault();
    if (stato === "invio" || !prossimo) return;
    setStato("invio");
    setErrore("");

    /*
      I sette attributi, costruiti qui e nominati uno per uno. Non si parte da
      un oggetto con dentro la simulazione per poi togliere: si parte da niente
      e si aggiunge, perché una proprietà in più aggiunta un giorno al modello
      non deve potersi presentare a Brevo senza che qualcuno l'abbia scritta
      qui.
    */
    const attributi: Partial<Record<NomeAttributo, string | number>> = {
      REGIME: ing.regime,
      FATTURATO_STIMATO: ing.ricavi,
      ACCANTONAMENTO_MESE: accantonamentoMensile,
      SCAD_1_DATA: prossimo.data,
      SCAD_1_IMPORTO: prossimo.importo,
    };
    if (seguente) {
      attributi.SCAD_2_DATA = seguente.data;
      attributi.SCAD_2_IMPORTO = seguente.importo;
    }

    try {
      const risposta = await fetch(API.promemoria, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          attributi,
          compilatoIn: Date.now() - apertoA.current,
        }),
      });
      const corpo: unknown = await risposta.json().catch(() => null);
      const ok = risposta.ok && typeof corpo === "object" && corpo !== null && "ok" in corpo
        && (corpo as { ok: unknown }).ok === true;

      if (!ok) {
        const detto = typeof corpo === "object" && corpo !== null && "errore" in corpo
          ? String((corpo as { errore: unknown }).errore)
          : "";
        setErrore(detto || "Non è andata. Riprova fra un attimo.");
        setStato("errore");
        return;
      }

      setStato("fatto");
      tracciaEvento(EVENTO_LEAD);
      tracciaClarity(EVENTO_LEAD);
      onIscritto();
    } catch {
      /*
        Rete caduta, richiesta interrotta, pagina chiusa a metà: un messaggio
        che dice di riprovare, e nessun «fatto». L'alternativa — mostrare
        comunque la conferma — farebbe aspettare un'email che non arriverà.
      */
      setErrore("Non riesco a mandare la richiesta. Controlla la connessione e riprova.");
      setStato("errore");
    }
  }

  const pronto = email.trim() !== "" && consenso && Boolean(prossimo);

  return (
    <AlComparire>
      <section
        id={ANCORA_PROMEMORIA}
        aria-labelledby="titolo-promemoria"
        className="scroll-mt-6 rounded-card bg-accento-tenue px-5 py-8 sm:px-8 sm:py-10"
      >
        <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,22rem)] lg:items-start lg:gap-10">
          <div>
            <h2
              id="titolo-promemoria"
              className="flex items-start gap-3 font-display text-kpi font-semibold tracking-tight"
            >
              <BellRing className="mt-1 size-5 shrink-0 text-accento" aria-hidden />
              Non segnarti le date. Te le ricordo io.
            </h2>
            <p className="mt-3 max-w-[56ch] text-corpo leading-relaxed">
              Ricevi un&apos;email 7 giorni prima di ogni scadenza, con l&apos;importo da versare
              calcolato su questi numeri. In più ti arriva subito il riepilogo del tuo calcolo.
            </p>

            {stato === "fatto" ? (
              <p
                aria-live="polite"
                className="mt-6 rounded-interna border border-positivo/30 bg-positivo-tenue px-4 py-4 text-corpo leading-relaxed"
              >
                <strong className="font-semibold">Quasi fatto: controlla la posta.</strong> Ti ho
                mandato un&apos;email per confermare l&apos;indirizzo. Finché non la confermi, i
                promemoria non partono.
              </p>
            ) : (
              <form onSubmit={invia} className="mt-6 max-w-[34rem]" noValidate>
                <label className="block">
                  <span className="text-etichetta font-medium">Il tuo indirizzo email</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    placeholder="nome@esempio.it"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={stato === "invio"}
                    className="mt-1 w-full rounded-campo border border-bordo bg-superficie px-3 py-3 text-campo outline-none focus:border-accento disabled:opacity-60"
                  />
                </label>

                <label className="mt-4 flex items-start gap-3">
                  <input
                    type="checkbox"
                    name="consenso"
                    required
                    checked={consenso}
                    onChange={(e) => setConsenso(e.target.checked)}
                    disabled={stato === "invio"}
                    className="mt-0.5 size-5 shrink-0 accent-accento"
                  />
                  <span className="text-etichetta leading-relaxed">
                    Ho letto l&apos;
                    <Link href={SITO.privacy} className="underline underline-offset-2">
                      informativa privacy
                    </Link>{" "}
                    e voglio ricevere i promemoria e le email di Flowlance. Puoi cancellarti con un
                    clic da ogni email.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!pronto || stato === "invio"}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-campo bg-accento px-6 py-3.5 text-campo font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {stato === "invio" ? "Ti sto iscrivendo…" : "Avvisami prima delle scadenze"}
                  {stato !== "invio" && <ArrowRight className="size-4" aria-hidden />}
                </button>

                {stato === "errore" && (
                  <p
                    aria-live="polite"
                    className="mt-4 rounded-campo border border-negativo/30 bg-negativo-tenue px-4 py-3 text-etichetta leading-relaxed"
                  >
                    {errore}
                  </p>
                )}

                <p className="mt-4 text-etichetta leading-relaxed text-inchiostro-tenue">
                  Partono il tuo indirizzo e i numeri che servono a scrivere il promemoria: regime,
                  fatturato stimato, accantonamento mensile, date e importi delle due scadenze.
                  Niente altro, e solo adesso che l&apos;hai chiesto.
                </p>
              </form>
            )}
          </div>

          <AnteprimaEmail prossimo={prossimo} />
        </div>
      </section>
    </AlComparire>
  );
}

/**
 * L'anteprima dell'email, con l'importo vero di chi sta guardando.
 *
 * Non è una finta: l'oggetto che si vede è quello che arriverà, costruito dal
 * suo calcolo. È anche il motivo per cui questa card ha senso accanto al modulo
 * — mostra che il promemoria parla dei suoi numeri e non di una media.
 *
 * `aria-hidden`: per chi legge con una tecnologia assistiva è una figura, e il
 * testo intorno dice già tutto quello che questa card mostra. Letta ad alta
 * voce sarebbe un'email annunciata due volte.
 */
function AnteprimaEmail({ prossimo }: { prossimo: Appuntamenti["prossimo"] | null }) {
  if (!prossimo) return null;
  return (
    <div
      {...NASCOSTO_A_CLARITY}
      aria-hidden
      className="rounded-interna border border-bordo bg-superficie shadow-sollevato"
    >
      <div className="flex items-center gap-2 border-b border-bordo px-4 py-3">
        <Mail className="size-4 shrink-0 text-inchiostro-tenue" aria-hidden />
        <span className="text-micro font-semibold uppercase tracking-[0.14em] text-inchiostro-tenue">
          Posta in arrivo
        </span>
      </div>
      <div className="px-4 py-4">
        <p className="text-micro text-inchiostro-tenue">Flowlance</p>
        <p className="mt-1 text-corpo font-semibold leading-snug">
          Tra 7 giorni: <span className="cifre">{euro(prossimo.importo)}</span> da versare
        </p>
        <p className="mt-3 text-etichetta leading-relaxed text-inchiostro-tenue">
          Il {giornoEMese(prossimo.data)} {prossimo.anno} scade{" "}
          {prossimo.genere === "secondo-acconto"
            ? "il secondo acconto di imposte e contributi"
            : "il saldo più il primo acconto"}
          . Se hai accantonato come previsto, i soldi ci sono già.
        </p>
        <div className="mt-4 space-y-2 border-t border-bordo pt-3">
          {[
            ["Da versare", euro(prossimo.importo)],
            ["Scadenza", `${giornoEMese(prossimo.data)} ${prossimo.anno}`],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3">
              <span className="text-etichetta text-inchiostro-tenue">{k}</span>
              <span className="cifre text-etichetta font-medium">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Il posto della sezione, quando i promemoria sono spenti.
 *
 * Non un modulo disabilitato e non un «presto disponibile»: un campo email che
 * non iscrive nessuno è una promessa presa in cambio di un'attesa, e chi la
 * legge oggi non torna domani a controllare. Al suo posto l'uscita che c'è
 * davvero — il simulatore vale già da solo, e la demo è la cosa successiva che
 * si può fare adesso.
 */
export function PromemoriaSpenti() {
  return (
    <AlComparire>
      <section
        id={ANCORA_PROMEMORIA}
        aria-labelledby="titolo-promemoria"
        className="scroll-mt-6 rounded-card bg-accento-tenue px-5 py-8 sm:px-8 sm:py-10"
      >
        <h2
          id="titolo-promemoria"
          className="max-w-[34ch] font-display text-kpi font-semibold tracking-tight"
        >
          Il conto lo sai. Il difficile è averli, quei soldi, quando scadono.
        </h2>
        <p className="mt-3 max-w-[56ch] text-corpo leading-relaxed">
          Questa pagina ti ha detto quanto e quando, su un anno regolare. Flowlance lo rifà a ogni
          fattura che registri, sui tuoi incassi veri.
        </p>
        <Link
          href={rottaDemo("vetrina")}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-campo bg-accento px-6 py-3.5 text-campo font-semibold text-white transition-opacity hover:opacity-90"
        >
          Guarda la demo, senza registrarti
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>
    </AlComparire>
  );
}
