"use client";

import * as React from "react";
import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import type { PaginaTesto } from "@/lib/contenuti/pagine";
import {
  DICHIARAZIONE_PROFESSIONALE,
  PAYMENT_LINK,
  PREZZO_SCRITTO,
  pagamentoConfigurato,
} from "@/lib/sito/acquisto";
import { SITO } from "@/lib/rotte";
import { CONTENUTO, VALORE, tracciaMeta } from "@/lib/sito/pixel";

/**
 * Comprare Flowlance: dichiarare, pagare, e — se vuoi — leggere tutto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché il contratto sta in fondo e non in mezzo
 * ─────────────────────────────────────────────────────────────────────────
 *
 * I Termini erano fra il prezzo e il pulsante: tredici articoli scritti per
 * necessità — esclusioni, limitazioni di responsabilità, foro competente — da
 * attraversare prima di poter comprare. Chi arriva da un annuncio non li
 * attraversa: chiude.
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
 * Cosa **non** è cambiato, e non poteva
 * ─────────────────────────────────────────────────────────────────────────
 *
 * La casella della dichiarazione resta obbligatoria e resta prima del
 * pagamento: è l'art. 1 dei Termini, ed è una condizione dell'acquisto. Le
 * clausole degli artt. 1341-1342 continuano a **non** approvarsi qui. Il PDF e
 * la sua impronta restano dove si vedono senza aprire niente: è il documento
 * opponibile, e un'impronta da cercare dietro un clic non verifica più niente.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le due righe sotto il pulsante
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Rimborso entro 30 giorni e chiave entro 24 ore lavorative erano scritti —
 * tutti e due — ma nei posti in cui non si leggono: il rimborso nell'art. 7,
 * in fondo a un contratto, e la chiave nel quarto punto di un elenco. Sono le
 * due cose che una persona vuole sapere **mentre decide**, ed è l'unico
 * momento in cui servono.
 */
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

      <PagaConStripe dichiara={dichiara} onDichiara={setDichiara} />

      {/* ——— 2 · Come arriva la chiave ——— */}
      <section
        aria-labelledby="come-funziona"
        className="mt-10 rounded-campo border border-bordo bg-superficie-alt/60 px-5 py-4"
      >
        <h2 id="come-funziona" className="text-etichetta font-semibold">
          Come arriva la chiave
        </h2>
        {/*
          I quattro passi restano identici, e restano prima del pagamento: il
          punto 3 dei Termini dice che il contratto si conclude alla consegna
          della chiave, non al pagamento, e chi paga senza saperlo si aspetta un
          download immediato e trova un'attesa — il modo più veloce di far
          sembrare rotto un prodotto che funziona.

          Quello che cambia è che adesso si leggono **dopo** aver visto che si
          può comprare, non come pedaggio per arrivarci.
        */}
        <ol className="mt-3 space-y-2 text-etichetta text-inchiostro-tenue">
          <li>
            <strong className="font-medium text-inchiostro">1.</strong> Paghi con Stripe, che
            raccoglie i tuoi dati di fatturazione.
          </li>
          <li>
            <strong className="font-medium text-inchiostro">2.</strong> Ricevi per email questi
            Termini in PDF, versione {versione}, e la richiesta di approvare le clausole indicate
            al punto 13.
          </li>
          <li>
            <strong className="font-medium text-inchiostro">3.</strong> Rispondi dallo stesso
            indirizzo.
          </li>
          <li>
            <strong className="font-medium text-inchiostro">4.</strong> Ricevi la chiave, di norma
            entro 24 ore lavorative. Il contratto si conclude in quel momento.
          </li>
        </ol>
        <p className="mt-3 text-etichetta text-inchiostro-tenue">
          Se non rispondi entro 14 giorni il contratto non si conclude e l&apos;importo ti viene
          rimborsato per intero.
        </p>
      </section>

      {/* ——— 4 · Il contratto, per intero, in fondo ——— */}
      <section aria-labelledby="termini" className="mt-12 border-t border-bordo pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="termini" className="font-display text-titolo font-semibold tracking-tight">
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
          I tredici articoli, chiusi.

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

        <p className="mt-6 text-etichetta text-inchiostro-tenue">
          Prima di comprare vale la pena leggere anche{" "}
          <Link href={SITO.approssimazioni} className="underline underline-offset-2">
            cosa Flowlance non calcola
          </Link>
          : è l&apos;elenco delle semplificazioni, e sta lì apposta perché tu lo veda adesso e non
          dopo.
        </p>
      </section>
    </main>
  );
}

/**
 * La dichiarazione e il pagamento, in un blocco solo.
 *
 * Stanno insieme in un componente perché sono una cosa sola: la casella è la
 * condizione del pulsante, non un passo che viene prima. Separarli in due
 * sezioni faceva perdere il legame — e faceva scorrere.
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
function PagaConStripe({
  dichiara,
  onDichiara,
}: {
  dichiara: boolean;
  onDichiara: (v: boolean) => void;
}) {
  const pronto = pagamentoConfigurato();

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

      <label className="flex cursor-pointer items-start gap-3 rounded-campo border border-bordo px-4 py-4">
        <input
          type="checkbox"
          checked={dichiara}
          onChange={(e) => onDichiara(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-accento"
        />
        <span className="text-corpo leading-relaxed">{DICHIARAZIONE_PROFESSIONALE}</span>
      </label>

      {pronto ? (
        <a
          href={dichiara ? PAYMENT_LINK : undefined}
          aria-disabled={!dichiara}
          /*
            `InitiateCheckout` sul clic che porta davvero a Stripe. Senza la
            spunta il collegamento non ha indirizzo e non si apre: l'evento non
            deve partire neanche lì, o conterebbe un tentativo che non è mai
            diventato un checkout.
          */
          onClick={() => {
            if (dichiara) tracciaMeta("InitiateCheckout", { ...CONTENUTO, ...VALORE });
          }}
          /*
            Senza la spunta il collegamento non ha un `href`: un `<a>` senza
            indirizzo non è raggiungibile con il tabulatore e non si apre in
            nessun modo, mentre un pulsante «disabilitato» via CSS resta
            cliccabile da chi naviga da tastiera. La condizione dell'acquisto
            dev'essere una condizione, non un aspetto.
          */
          className={
            dichiara
              ? "mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-campo bg-accento px-6 text-corpo font-medium text-white transition-colors hover:bg-[#3D4CE8] sm:w-auto"
              : "mt-4 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-campo bg-bordo px-6 text-corpo font-medium text-inchiostro-tenue sm:w-auto"
          }
        >
          Paga {PREZZO_SCRITTO.totale} con Stripe
          {dichiara && <ExternalLink className="size-4" aria-hidden />}
        </a>
      ) : (
        <p className="mt-4 rounded-campo border border-attenzione/40 bg-attenzione-tenue px-4 py-3 text-corpo">
          Il pagamento non è ancora attivo su questo sito. Scrivi a{" "}
          <a href="mailto:info@flowlance.it" className="font-medium underline underline-offset-2">
            info@flowlance.it
          </a>{" "}
          e ti mando io il collegamento.
        </p>
      )}

      {pronto && !dichiara && (
        <p className="mt-2 text-etichetta text-inchiostro-tenue" role="status">
          Spunta la dichiarazione per proseguire.
        </p>
      )}

      {/*
        Le due promesse, subito sotto il pulsante. Sono nei Termini — art. 7 il
        rimborso, punto 3 la chiave — ma là si leggono dopo aver deciso, che è
        troppo tardi perché servano a decidere.
      */}
      <p className="mt-4 text-corpo leading-relaxed">
        <strong className="font-medium">Rimborso entro 30 giorni</strong>, senza spiegare perché.
        <br />
        <strong className="font-medium">Chiave entro 24 ore lavorative.</strong>
      </p>

      {/* ——— 3 · La nota sull'IVA, in corpo piccolo, attaccata al pulsante ——— */}
      <p className="mt-3 max-w-[52ch] text-etichetta leading-relaxed text-inchiostro-tenue">
        Su Stripe l&apos;IVA compare dopo che hai inserito i dati di fatturazione: il totale che
        vedi all&apos;inizio è imponibile.
      </p>

      <p className="mt-3 max-w-[52ch] text-etichetta leading-relaxed text-inchiostro-tenue">
        Le clausole indicate al punto 13 si approvano separatamente, per email, prima della
        consegna della chiave: qui non si approva niente.
      </p>
    </section>
  );
}
