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
 * Comprare Flowlance: leggere, dichiarare, pagare. In quest'ordine.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché i Termini stanno qui dentro per intero
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Non un link, non un riassunto: il testo. Un contratto letto altrove è un
 * contratto che quasi nessuno apre, e questo si conclude fra due professionisti
 * su clausole che limitano la responsabilità e scelgono il foro. Il PDF accanto
 * serve a portarselo via com'è, con la sua impronta: è lo stesso file che
 * arriva per email prima della chiave.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Cosa la casella è, e cosa non è
 * ─────────────────────────────────────────────────────────────────────────
 *
 * È **la dichiarazione del punto 1**: acquisto nell'esercizio dell'attività.
 * Non è l'approvazione delle clausole ex artt. 1341 e 1342, che il punto 13
 * vuole specifica e che avviene per email, prima della consegna della chiave.
 *
 * La differenza non è formale. Su un sito statico una spunta non lascia
 * traccia da nessuna parte — non c'è un server che la registri — e una
 * dichiarazione che nessuno conserva non è una prova. L'email dell'acquirente
 * sì: resta nel fascicolo dell'ordine. Fingere qui un'approvazione che non si
 * può conservare sarebbe peggio che non chiederla, perché farebbe credere di
 * averla.
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
    <main className="mx-auto w-full max-w-[46rem] px-5 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-kpi font-semibold tracking-tight">Acquista Flowlance</h1>
      <p className="mt-3 text-corpo leading-relaxed">
        <strong className="font-semibold">
          {/*
            Il prezzo arriva già scritto: chi passa dalla landing a questa
            pagina deve trovare la stessa cifra scritta nello stesso modo,
            altrimenti si chiede quale sia quella vera.
          */}
          {PREZZO_SCRITTO.imponibile} all&apos;anno, oltre IVA al{" "}
          {PREZZO_SCRITTO.aliquota}: {PREZZO_SCRITTO.totale} in tutto.
        </strong>{" "}
        Licenza di 12 mesi, nominativa, per un solo titolare di partita IVA. Il rinnovo non è
        automatico.
      </p>

      <section
        aria-labelledby="come-funziona"
        className="mt-8 rounded-campo border border-bordo bg-superficie-alt/60 px-5 py-4"
      >
        <h2 id="come-funziona" className="text-etichetta font-semibold">
          Come arriva la chiave
        </h2>
        {/*
          I quattro passi, detti prima del pagamento e non dopo. Il punto 3 dei
          Termini dice che il contratto si conclude alla consegna della chiave,
          non al pagamento: chi paga senza saperlo si aspetta un download
          immediato e trova un'attesa, che è il modo più veloce di far sembrare
          rotto un prodotto che funziona.
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

      {/* ——— Il contratto, per intero ——— */}
      <section aria-labelledby="termini" className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="termini" className="font-display text-titolo font-semibold tracking-tight">
            {termini.titolo}
          </h2>
          <p className="text-etichetta text-inchiostro-tenue">
            Versione {versione} — {termini.aggiornatoIl}
          </p>
        </div>

        {/*
          Il PDF e la sua impronta. L'impronta sta accanto al link e non in una
          pagina di supporto: serve a chi, fra due anni, deve dimostrare che il
          file nel proprio fascicolo è questo. Per intero, in un blocco che si
          seleziona: un'impronta troncata non verifica niente.
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
          <p className="mt-2 text-etichetta text-inchiostro-tenue">
            Impronta SHA-256 del file:
          </p>
          <p className="cifre mt-1 break-all text-etichetta text-inchiostro-tenue">{impronta}</p>
        </div>

        <div className="prosa mt-8" dangerouslySetInnerHTML={{ __html: termini.html }} />
      </section>

      {/* ——— La dichiarazione, e il pagamento ——— */}
      <section aria-labelledby="dichiarazione" className="mt-12 border-t border-bordo pt-8">
        <h2 id="dichiarazione" className="font-display text-titolo font-semibold tracking-tight">
          Prima di pagare
        </h2>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-campo border border-bordo px-4 py-4">
          <input
            type="checkbox"
            checked={dichiara}
            onChange={(e) => setDichiara(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-accento"
          />
          <span className="text-corpo leading-relaxed">{DICHIARAZIONE_PROFESSIONALE}</span>
        </label>

        <p className="mt-3 text-etichetta text-inchiostro-tenue">
          Le clausole indicate al punto 13 si approvano separatamente, per email, prima della
          consegna della chiave: qui non si approva niente.
        </p>

        <PagaConStripe dichiara={dichiara} />

        <p className="mt-8 text-etichetta text-inchiostro-tenue">
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
 * Il pulsante di pagamento, **con addosso la sua nota sull'IVA**.
 *
 * Stanno insieme in un componente e non uno sotto l'altro nella pagina, perché
 * la nota parla di quello che succede **dopo aver premuto lì**: Stripe non può
 * calcolare l'IVA prima di sapere il paese, quindi la sua prima schermata mostra
 * l'imponibile e il totale sale dopo l'indirizzo. È corretto, e sembra un
 * rincaro — nel momento peggiore per sembrarlo, con la carta già in mano.
 *
 * Scritta nella pagina invece che qui, la nota è finita sotto il riquadro del
 * segnaposto, staccata da tutto: parlava di un pulsante che stava altrove. Il
 * giorno in cui il Payment Link arriverà davvero, il riquadro sparirà e il
 * pulsante prenderà il suo posto — e la nota si sposterà con lui, perché è la
 * stessa cosa.
 *
 * Sulla pagina di vendita non c'è: là i pulsanti dicono già «+ IVA» accanto al
 * prezzo, e nessuno sta per pagare.
 */
function PagaConStripe({ dichiara }: { dichiara: boolean }) {
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
    <div className="mt-6">
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
              ? "inline-flex min-h-12 items-center justify-center gap-2 rounded-campo bg-accento px-6 text-corpo font-medium text-white transition-colors hover:bg-[#3D4CE8]"
              : "inline-flex min-h-12 cursor-not-allowed items-center justify-center gap-2 rounded-campo bg-bordo px-6 text-corpo font-medium text-inchiostro-tenue"
          }
        >
          Paga {PREZZO_SCRITTO.totale} con Stripe
          {dichiara && <ExternalLink className="size-4" aria-hidden />}
        </a>
      ) : (
        <p className="rounded-campo border border-attenzione/40 bg-attenzione-tenue px-4 py-3 text-corpo">
          Il pagamento non è ancora attivo su questo sito. Scrivi a{" "}
          <a href="mailto:info@flowlance.it" className="font-medium underline underline-offset-2">
            info@flowlance.it
          </a>{" "}
          e ti mando io il collegamento.
        </p>
      )}

      {/* Attaccata al pulsante, non alla pagina: è la riga che si legge un attimo prima di premere. */}
      <p className="mt-3 max-w-[52ch] text-etichetta leading-relaxed text-inchiostro">
        {PREZZO_SCRITTO.imponibile} l&apos;anno + IVA {PREZZO_SCRITTO.aliquota} —{" "}
        {PREZZO_SCRITTO.totale} in fattura.{" "}
        <span className="text-inchiostro-tenue">
          Su Stripe l&apos;IVA compare dopo che hai inserito i dati di fatturazione: il totale che
          vedi all&apos;inizio è imponibile.
        </span>
      </p>

      {pronto && !dichiara && (
        <p className="mt-2 text-etichetta text-inchiostro-tenue" role="status">
          Spunta la dichiarazione per proseguire.
        </p>
      )}
    </div>
  );
}
