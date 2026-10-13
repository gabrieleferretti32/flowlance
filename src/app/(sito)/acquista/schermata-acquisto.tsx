"use client";

import * as React from "react";
import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import type { PaginaTesto } from "@/lib/contenuti/pagine";
import {
  CONSEGNA_CHIAVE_BREVE,
  DICHIARAZIONE_PROFESSIONALE,
  PREZZO_SCRITTO,
  PRIMA_DI_PAGARE,
  accettazioneTermini,
  collegamentoDiPagamento,
  pagamentoConfigurato,
} from "@/lib/sito/acquisto";
import { OFFERTA, RIMANDO_AI_TERMINI, condizioniSpezzate } from "@/lib/sito/offerta";
import { API, SITO } from "@/lib/rotte";
import { CONTENUTO, VALORE, tracciaMeta } from "@/lib/sito/pixel";

/**
 * Comprare Flowlance: dichiarare, pagare, e — se vuoi — leggere tutto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché il contratto sta in fondo e non in mezzo
 * ─────────────────────────────────────────────────────────────────────────
 *
 * I Termini erano fra il prezzo e il pulsante: tutti gli articoli, uno dopo
 * l'altro, da attraversare prima di poter comprare. Chi arriva da un annuncio
 * non li attraversa: chiude.
 *
 * Il testo non si accorcia e non si sposta altrove, perché è il contratto e
 * deve stare dove si conclude. Cambia solo **l'ordine**: prima il modo di
 * comprare, poi come arriva la chiave, poi il contratto per intero in un
 * blocco richiudibile. Il contenuto resta nel DOM anche da chiuso — quindi
 * indicizzabile, cercabile con ⌘F, e stampabile: la regola di stampa in
 * `globals.css` riapre i `<details>` sulla carta, perché un contratto stampato
 * con dentro un pezzo chiuso non è il contratto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le due caselle, e perché stanno prima del pulsante
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Dalla versione 3 il contratto si conclude **con il pagamento**: non c'è più
 * un'email da aspettare, una risposta da mandare, un contratto che si conclude
 * giorni dopo. Ne segue che tutto quello che l'acquirente deve avere davanti
 * deve stare **prima** del pulsante, perché dopo non c'è più niente da
 * leggere: i Termini per intero e in PDF, la loro accettazione, la
 * dichiarazione professionale del punto 1, e in chiaro cosa succede premendo.
 *
 * Il PDF e la sua impronta restano dove si vedono senza aprire niente: è il
 * documento che parte per email subito dopo, ed è quello su cui si verifica
 * che il file nel fascicolo sia questo. Un'impronta dietro un clic non
 * verifica più niente.
 */
/**
 * L'ancora della sezione del contratto, scritta una volta sola.
 *
 * La usano il titolo che la porta e il rimando che ci manda, accanto alle
 * caselle. Scritte a mano sarebbero due stringhe uguali per combinazione, e il
 * giorno in cui una cambia il rimando continua a non essere rotto — porta in
 * testa alla pagina, cioè a un metro dal contratto che dice di aprire.
 */
const ANCORA_TERMINI = "termini";

export function SchermataAcquisto({
  termini,
  versione,
  pdf,
  impronta,
}: {
  termini: PaginaTesto;
  versione: number;
  pdf: string;
  impronta: string;
}) {
  const [accetta, setAccetta] = React.useState(false);
  const [dichiara, setDichiara] = React.useState(false);

  return (
    <main className="mx-auto w-full max-w-[46rem] px-5 py-8 sm:px-6 sm:py-12">
      {/* ——— 1 · Il blocco d'acquisto, sopra la piega ——— */}
      <h1 className="font-display text-kpi font-semibold tracking-tight">Acquista Flowlance</h1>
      <p className="mt-3 text-corpo leading-relaxed">
        <strong className="font-semibold">
          {/*
            Il prezzo arriva già scritto: chi passa dalla landing a questa
            pagina deve trovare la stessa cifra scritta nello stesso modo,
            altrimenti si chiede quale sia quella vera.
          */}
          {PREZZO_SCRITTO.imponibile} all&apos;anno + IVA {PREZZO_SCRITTO.aliquota} —{" "}
          {PREZZO_SCRITTO.totale} in tutto
        </strong>
        <br />
        Licenza di 12 mesi, nominativa, per un titolare di partita IVA. Il rinnovo non è
        automatico.
      </p>

      <PrezzoFondatori />

      <PagaConStripe
        versione={versione}
        impronta={impronta}
        accetta={accetta}
        onAccetta={setAccetta}
        dichiara={dichiara}
        onDichiara={setDichiara}
      />

      {/* ——— 2 · Come arriva la chiave ——— */}
      <section
        aria-labelledby="come-funziona"
        className="mt-10 rounded-campo border border-bordo bg-superficie-alt/60 px-5 py-4"
      >
        <h2 id="come-funziona" className="text-etichetta font-semibold">
          Come arriva la chiave
        </h2>
        {/*
          Tre passi, e nessuno dei tre chiede di fare qualcosa dopo aver pagato.
          Prima erano quattro, e il secondo e il terzo erano un'email da leggere
          e una risposta da mandare: servivano a raccogliere l'approvazione
          delle clausole ex artt. 1341-1342, che la versione 3 non ha più. Senza
          quelle, far aspettare la chiave non proteggeva più niente.
        */}
        <ol className="mt-3 space-y-2 text-etichetta text-inchiostro-tenue">
          <li>
            <strong className="font-medium text-inchiostro">1.</strong> Paghi con Stripe, che
            raccoglie i tuoi dati di fatturazione. Il contratto si conclude in quel momento.
          </li>
          <li>
            <strong className="font-medium text-inchiostro">2.</strong> Ricevi per email la chiave
            di licenza e questi Termini in PDF, versione {versione}, con la loro impronta:{" "}
            {CONSEGNA_CHIAVE_BREVE}.
          </li>
          <li>
            <strong className="font-medium text-inchiostro">3.</strong> Incolli la chiave
            nell&apos;applicazione, e basta.
          </li>
        </ol>
        <p className="mt-3 text-etichetta text-inchiostro-tenue">
          Non devi rispondere a niente: non c&apos;è nessuna firma da rimandare indietro.
        </p>
      </section>

      {/* ——— 4 · Il contratto, per intero, in fondo ——— */}
      <section aria-labelledby={ANCORA_TERMINI} className="mt-12 border-t border-bordo pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id={ANCORA_TERMINI}
            className="scroll-mt-6 font-display text-titolo font-semibold tracking-tight"
          >
            {termini.titolo}
          </h2>
          <p className="text-etichetta text-inchiostro-tenue">
            Versione {versione} — {termini.aggiornatoIl}
          </p>
        </div>

        {/*
          Il PDF e la sua impronta restano **fuori** dal blocco richiudibile.

          È il documento opponibile: chi fra due anni deve dimostrare che il
          file nel proprio fascicolo è questo, deve poter confrontare l'impronta
          senza aprire niente. Per intero, in un blocco che si seleziona: un
          impronta troncata non verifica niente, e una nascosta dietro un clic
          nemmeno.
        */}
        <div className="mt-4 rounded-campo border border-bordo px-4 py-3">
          <a
            href={pdf}
            download
            className="inline-flex min-h-11 items-center gap-2 text-corpo font-medium text-accento underline underline-offset-2 sm:min-h-0"
          >
            <Download className="size-4 shrink-0" aria-hidden />
            Scarica i Termini in PDF (versione {versione})
          </a>
          <p className="mt-2 text-etichetta text-inchiostro-tenue">Impronta SHA-256 del file:</p>
          <p className="cifre mt-1 break-all text-etichetta text-inchiostro-tenue">{impronta}</p>
        </div>

        {/*
          Il contratto per intero, chiuso.

          `<details>` e non un pannello fatto a mano con `useState`: il
          contenuto resta nel documento anche da chiuso — lo trova ⌘F, lo trova
          un motore di ricerca, lo apre chi stampa — e il comportamento è del
          browser, quindi funziona anche se il JavaScript non parte. Un
          contratto che sparisce quando un bundle non carica sarebbe il difetto
          peggiore di questa pagina.
        */}
        <details className="mt-4 rounded-campo border border-bordo px-5 py-4">
          <summary className="cursor-pointer text-corpo font-medium">
            Leggi i Termini completi (versione {versione})
          </summary>
          <div className="prosa mt-6" dangerouslySetInnerHTML={{ __html: termini.html }} />
        </details>

      </section>
    </main>
  );
}

/**
 * Le due caselle e il pagamento, in un blocco solo.
 *
 * Stanno insieme in un componente perché sono una cosa sola: le caselle sono
 * la condizione del pulsante, non un passo che viene prima. Separarle in due
 * sezioni faceva perdere il legame — e faceva scorrere.
 *
 * Sono due e non una perché dicono due cose diverse. L'accettazione dei
 * Termini riguarda **cosa** si sta concludendo, e porta il numero di versione
 * perché il punto 12 lega la licenza alla versione accettata. La dichiarazione
 * professionale riguarda **chi** sta comprando, ed è la condizione d'acquisto
 * del punto 1. Una casella sola che dicesse tutte e due le cose sarebbe più
 * corta e direbbe di meno.
 *
 * La nota sull'IVA resta attaccata al pulsante e non alla pagina, perché parla
 * di quello che succede **dopo aver premuto lì**: Stripe non può calcolare
 * l'IVA prima di sapere il paese, quindi la sua prima schermata mostra
 * l'imponibile e il totale sale dopo l'indirizzo. È corretto, e sembra un
 * rincaro — nel momento peggiore per sembrarlo, con la carta già in mano.
 *
 * Sulla pagina di vendita non c'è: là i pulsanti dicono già «+ IVA» accanto al
 * prezzo, e nessuno sta per pagare.
 */
/**
 * L'offerta Fondatori, ripetuta dove si paga.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché questo blocco è stato aggiunto, e cosa mancava
 * ─────────────────────────────────────────────────────────────────────────
 *
 * La card sul simulatore vende tre cose: cinquanta posti, il prezzo garantito
 * anche ai rinnovi, il rimborso a trenta giorni. Chi cliccava «Acquista»
 * arrivava qui e non ne ritrovava **nessuna**: la pagina diceva il prezzo di
 * oggi, «il rinnovo non è automatico», e taceva sul resto.
 *
 * Nessuna frase sbagliata, e però la superficie dove si accetta un contratto
 * prometteva meno di quella che aveva convinto a venirci. Fra le due versioni
 * vale quella scritta nel punto 6-bis — che le dice tutte — ma farle leggere
 * qui è l'unico modo perché chi compra sappia cosa sta comprando *mentre*
 * compra, e non in un contratto di tredici articoli più in basso.
 *
 * I testi **non** sono riscritti: arrivano da `offerta.ts`, gli stessi tre
 * della card. Due stesure della stessa promessa sono due promesse, e il giorno
 * in cui il legale tocca il 6-bis una delle due resta indietro.
 */
function PrezzoFondatori() {
  const { prima, rimando, dopo } = condizioniSpezzate();
  return (
    <section
      aria-labelledby="prezzo-fondatori"
      className="mt-5 rounded-campo border border-accento/30 bg-accento-tenue px-5 py-4"
    >
      <h2 id="prezzo-fondatori" className="text-etichetta font-semibold">
        {OFFERTA.nome} · {OFFERTA.posti} posti
      </h2>
      <p className="mt-2 text-corpo leading-relaxed">{OFFERTA.sottotitolo}</p>
      <p className="mt-2 text-etichetta leading-relaxed text-inchiostro-tenue">
        {prima}
        <Link href={RIMANDO_AI_TERMINI} className="underline underline-offset-2">
          {rimando}
        </Link>
        {dopo}
      </p>
      <p className="mt-2 text-etichetta leading-relaxed text-inchiostro-tenue">
        {OFFERTA.garanzia}
      </p>
    </section>
  );
}

function PagaConStripe({
  versione,
  impronta,
  accetta,
  onAccetta,
  dichiara,
  onDichiara,
}: {
  versione: number;
  impronta: string;
  accetta: boolean;
  onAccetta: (v: boolean) => void;
  dichiara: boolean;
  onDichiara: (v: boolean) => void;
}) {
  const [inCorso, setInCorso] = React.useState(false);
  const [errore, setErrore] = React.useState("");
  const pronto = pagamentoConfigurato();
  /*
    Il pulsante si accende solo con tutte e due. Un'unica variabile, usata in
    tutti i punti che la guardano — l'`href`, l'evento, le classi, il
    messaggio: tre condizioni scritte tre volte sono tre occasioni di
    scriverne una diversa, e quella diversa sarebbe un pulsante che si apre
    senza una delle due dichiarazioni.
  */
  const puoPagare = accetta && dichiara;

  /**
   * Registra l'accettazione, poi apre il pagamento. In quest'ordine.
   *
   * ─────────────────────────────────────────────────────────────────────
   * Perché il pagamento aspetta
   * ─────────────────────────────────────────────────────────────────────
   *
   * La prova di che cosa è stato accettato si scrive **prima**: se la
   * scrittura non riesce, a Stripe non ci si va. L'ordine inverso —
   * aprire il pagamento e registrare dopo, o insieme — produrrebbe ogni
   * tanto un acquisto senza la sua prova, e di quelli ci si accorge il
   * giorno in cui qualcuno contesta di aver accettato qualcosa.
   *
   * Alla funzione si manda soltanto che cosa c'era a schermo: versione e
   * impronta dei Termini. Nessun dato della persona — l'email la raccoglie
   * Stripe, che la deve avere, e noi non la vediamo mai.
   */
  async function paga() {
    if (!puoPagare || inCorso) return;
    setInCorso(true);
    setErrore("");
    const nonRiuscito =
      "Non riesco a registrare l'accettazione dei Termini, e senza quella non apro il "
      + "pagamento. Riprova, o scrivi a info@flowlance.it.";
    try {
      const risposta = await fetch(API.accettazione, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ versioneTermini: versione, improntaTermini: impronta }),
      });
      const corpo: unknown = await risposta.json().catch(() => null);
      const id =
        typeof corpo === "object" && corpo !== null && "ok" in corpo && (corpo as { ok: unknown }).ok === true
          ? (corpo as { id?: unknown }).id
          : null;
      if (!risposta.ok || typeof id !== "string" || id === "") {
        const detto =
          typeof corpo === "object" && corpo !== null && "errore" in corpo
            ? String((corpo as { errore: unknown }).errore)
            : nonRiuscito;
        setErrore(detto);
        setInCorso(false);
        return;
      }
      /*
        `InitiateCheckout` qui e non sul clic: adesso il clic e l'apertura del
        pagamento sono due momenti diversi, e contare il clic conterebbe anche
        i tentativi finiti con un errore.
      */
      tracciaMeta("InitiateCheckout", { ...CONTENUTO, ...VALORE });
      window.location.href = collegamentoDiPagamento(id);
    } catch {
      setErrore(nonRiuscito);
      setInCorso(false);
    }
  }

  /*
    Chi è arrivato fin qui sta leggendo la scheda del prodotto: è `ViewContent`.
    Parte al montaggio e una volta sola. Se il consenso alla profilazione non
    c'è, `tracciaMeta` non trova il pixel e non succede niente — nessun ramo da
    scrivere qui, nessuna seconda definizione di quando si può misurare.
  */
  React.useEffect(() => {
    tracciaMeta("ViewContent", { ...CONTENUTO, ...VALORE });
  }, []);

  return (
    <section aria-labelledby="dichiarazione" className="mt-6">
      <h2 id="dichiarazione" className="sr-only">
        Dichiarazione e pagamento
      </h2>

      {/*
        Nessun collegamento **dentro** l'etichetta: un `<a>` in un `<label>` si
        porta dietro il clic della casella, e chi tocca «Termini di servizio»
        su un telefono si ritrova il contratto aperto e la spunta messa senza
        averla voluta. Il rimando sta fuori, subito sotto.
      */}
      <div className="space-y-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-campo border border-bordo px-4 py-4">
          <input
            type="checkbox"
            checked={accetta}
            onChange={(e) => onAccetta(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-accento"
          />
          <span className="text-corpo leading-relaxed">{accettazioneTermini(versione)}</span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-campo border border-bordo px-4 py-4">
          <input
            type="checkbox"
            checked={dichiara}
            onChange={(e) => onDichiara(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-accento"
          />
          <span className="text-corpo leading-relaxed">{DICHIARAZIONE_PROFESSIONALE}</span>
        </label>
      </div>

      <p className="mt-3 text-etichetta text-inchiostro-tenue">
        <a href={`#${ANCORA_TERMINI}`} className="underline underline-offset-2">
          Leggi i Termini e scarica il PDF
        </a>{" "}
        — sono in fondo a questa pagina, con l&apos;impronta del file.
      </p>

      {/*
        L'elenco delle semplificazioni, **prima** del pagamento e non in fondo.

        Stava sotto il contratto, dopo il pulsante: lì lo legge chi ha già
        deciso. Il punto 9 dei Termini dice che i risultati sono stime da
        verificare, e il punto 2 che l'elenco di cosa l'applicazione non
        calcola è pubblico: metterlo dove si decide è il modo di far valere
        quelle due clausole invece di limitarsi a scriverle.
      */}
      <p className="mt-2 text-etichetta text-inchiostro-tenue">
        <Link href={SITO.approssimazioni} className="underline underline-offset-2">
          Leggi cosa Flowlance non calcola
        </Link>{" "}
        — l&apos;elenco delle semplificazioni, scritto prima di vendere e non dopo.
      </p>

      {/*
        E i requisiti tecnici, prima del pagamento.

        È la pagina che il punto 8 richiama per nome, e dice due cose che vale
        la pena sapere **prima** di pagare e non dopo: per aprire l'applicazione
        serve una connessione, e i dati stanno solo nel browser di chi la usa.
      */}
      <p className="mt-2 text-etichetta text-inchiostro-tenue">
        <Link href={SITO.requisitiTecnici} className="underline underline-offset-2">
          Guarda i requisiti tecnici
        </Link>{" "}
        — che cosa serve per usarlo, e che cosa cancella i dati.
      </p>

      {/*
        Cosa succede premendo, prima di premere. Il testo sta in `acquisto.ts`
        perché lo guardi anche la tagliola: una pagina che promettesse una cosa
        diversa dal contratto — la chiave «subito», il contratto concluso
        «dopo» — sarebbe il difetto peggiore di tutto il flusso.
      */}
      <p className="mt-5 text-corpo font-medium leading-relaxed">{PRIMA_DI_PAGARE}</p>

      {pronto ? (
        /*
          Un pulsante, e non più un collegamento.

          Prima di andare su Stripe c'è una cosa da fare: registrare che cosa
          è stato accettato, e **aspettare che sia riuscita**. Un `<a href>`
          non può aspettare niente — porta via la pagina al primo clic — e per
          questo qui c'è un `<button>` che fa la chiamata, guarda com'è andata,
          e solo allora cambia pagina.

          Spento finché le due caselle non sono spuntate: un `disabled` vero,
          che non si raggiunge col tabulatore e non si preme. La condizione
          dell'acquisto dev'essere una condizione, non un aspetto.
        */
        <button
          type="button"
          disabled={!puoPagare || inCorso}
          onClick={paga}
          className={
            puoPagare && !inCorso
              ? "mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-campo bg-accento px-6 text-corpo font-medium text-white transition-colors hover:bg-[#3D4CE8] sm:w-auto"
              : "mt-4 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-campo bg-bordo px-6 text-corpo font-medium text-inchiostro-tenue sm:w-auto"
          }
        >
          {inCorso ? "Un momento…" : `Paga ${PREZZO_SCRITTO.totale} con Stripe`}
          {puoPagare && !inCorso && <ExternalLink className="size-4" aria-hidden />}
        </button>
      ) : (
        <p className="mt-4 rounded-campo border border-attenzione/40 bg-attenzione-tenue px-4 py-3 text-corpo">
          Il pagamento non è ancora attivo su questo sito. Scrivi a{" "}
          <a href="mailto:info@flowlance.it" className="font-medium underline underline-offset-2">
            info@flowlance.it
          </a>{" "}
          e ti mando io il collegamento.
        </p>
      )}

      {/*
        Se la registrazione non riesce il pagamento non parte, e la pagina lo
        dice. Non «riprova più tardi»: che cosa è successo, che cosa fare, e
        l'indirizzo a cui scrivere se riprovare non basta. Chi aveva la carta in
        mano merita di sapere perché non si è aperto niente.
      */}
      {errore !== "" && (
        <p
          role="alert"
          className="mt-3 rounded-campo border border-attenzione/40 bg-attenzione-tenue px-4 py-3 text-corpo leading-relaxed"
        >
          {errore}
        </p>
      )}

      {/*
        Il messaggio dice **quale** delle due manca. «Spunta le caselle per
        proseguire», davanti a una sola spuntata, manda a rileggerle tutte e
        due per scoprire quale: è il tipo di attrito che si prende tutto il
        guadagno di averle separate.
      */}
      {pronto && !puoPagare && (
        <p className="mt-2 text-etichetta text-inchiostro-tenue" role="status">
          {!accetta && !dichiara
            ? "Spunta l'accettazione dei Termini e la dichiarazione per proseguire."
            : !accetta
              ? "Manca l'accettazione dei Termini."
              : "Manca la dichiarazione di acquisto professionale."}
        </p>
      )}

      {/* ——— 3 · La nota sull'IVA, in corpo piccolo, attaccata al pulsante ——— */}
      <p className="mt-3 max-w-[52ch] text-etichetta leading-relaxed text-inchiostro-tenue">
        Su Stripe l&apos;IVA compare dopo che hai inserito i dati di fatturazione: il totale che
        vedi all&apos;inizio è imponibile.
      </p>

    </section>
  );
}
