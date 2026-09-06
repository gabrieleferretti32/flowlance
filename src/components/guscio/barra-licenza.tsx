"use client";

import * as React from "react";
import Link from "next/link";
import { CircleAlert, Clock, ExternalLink } from "lucide-react";
import {
  descrizione,
  giorniInParole,
  preavviso,
  solaLettura,
  etichettaAcquisto,
  INDIRIZZO_ACQUISTO,
} from "@/lib/licenza/stato";
import { useStatoLicenza } from "@/lib/stato/licenza";

/**
 * La riga sulla licenza, sopra il contenuto.
 *
 * Compare in due soli casi: negli ultimi quindici giorni, e quando la licenza è
 * finita. Nel primo è una riga sottile che si legge e si ignora — un avviso che
 * si ripete a ogni schermata per due settimane diventa rumore, e il rumore si
 * smette di leggere proprio quando conta. Nel secondo è più netta, perché a quel
 * punto metà dei pulsanti non risponde e va detto perché.
 *
 * In stampa non c'è: il prospetto per il commercialista non parla di licenze.
 */
export function BarraLicenza() {
  const oggi = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const stato = useStatoLicenza(oggi);
  const giorni = preavviso(stato);
  const bloccata = solaLettura(stato);

  if (!bloccata && giorni === null) return null;

  if (bloccata) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-negativo/25 bg-negativo/10 px-4 py-2 sm:px-5 lg:px-8 print:hidden"
      >
        <CircleAlert className="size-4 shrink-0 text-negativo" aria-hidden />
        <p className="min-w-0 text-etichetta">
          <span className="font-medium">{descrizione(stato)}.</span>{" "}
          <span className="text-inchiostro-tenue">
            L&apos;app è in sola lettura: si consulta tutto, non si inserisce niente.
            L&apos;esportazione dei dati resta attiva.
          </span>
        </p>
        {/*
          Due strade, e servono tutte e due. «Inserisci una chiave» presuppone
          che una chiave ce l'abbia: chi vuole rinnovare non aveva dove andare,
          e la scadenza è proprio il momento in cui un cliente si perde. Il
          rinnovo viene prima perché è quello che sblocca l'app.
        */}
        <span className="-my-1 ml-auto flex shrink-0 flex-wrap items-center gap-x-4">
          <a
            href={INDIRIZZO_ACQUISTO}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center gap-1.5 text-etichetta font-medium text-accento underline underline-offset-2 sm:min-h-0 sm:py-0"
          >
            {etichettaAcquisto(stato)}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
          <Link
            href="/licenza"
            className="flex min-h-11 items-center text-etichetta font-medium text-accento underline underline-offset-2 sm:min-h-0 sm:py-0"
          >
            Inserisci una chiave
          </Link>
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-bordo bg-superficie-alt px-4 py-1.5 sm:px-5 lg:px-8 print:hidden">
      <Clock className="size-3.5 shrink-0 text-inchiostro-tenue" aria-hidden />
      {/* Va a capo a ogni larghezza. Con `truncate` sotto i 640 la frase si
          fermava a «Periodo di prova fino al 19 settembre 2026: sca…»: spariva
          proprio la parte che dice quanti giorni mancano, cioè l'unica ragione
          per cui la riga esiste. */}
      <p className="min-w-0 text-micro text-inchiostro-tenue">
        {descrizione(stato)}: {giorniInParole(giorni as number)}.
      </p>
      {/* Il testo resta minuscolo, l'area da premere no: un link alto quattordici
          pixel su un telefono si manca, e chi lo manca colpisce quello che c'è
          sotto. L'area cresce senza allargare la barra, con un margine negativo. */}
      <span className="-my-1.5 ml-auto flex shrink-0 flex-wrap items-center gap-x-3">
        {/* Anche qui, e soprattutto qui: nei quindici giorni prima si rinnova
            senza fastidio, dopo si rinnova con l'app spenta a metà. La parola
            cambia da sola — chi è in prova compra, non rinnova. */}
        <a
          href={INDIRIZZO_ACQUISTO}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center gap-1 px-1 text-micro font-medium text-accento underline underline-offset-2 sm:min-h-0 sm:py-0"
        >
          {etichettaAcquisto(stato)}
          <ExternalLink className="size-3" aria-hidden />
        </a>
        <Link
          href="/licenza"
          className="flex min-h-11 items-center px-1 text-micro text-inchiostro-tenue underline underline-offset-2 hover:text-inchiostro sm:min-h-0 sm:py-0"
        >
          Gestisci
        </Link>
      </span>
    </div>
  );
}
