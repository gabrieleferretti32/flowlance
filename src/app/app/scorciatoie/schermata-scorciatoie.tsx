"use client";

import * as React from "react";
import { Guscio } from "@/components/guscio/guscio";
import { Card, CardCorpo, CardIntestazione, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tasto } from "@/components/comandi/paletta";
import { GRUPPI_SCORCIATOIE, type Scorciatoia } from "@/lib/comandi/scorciatoie";
import { useComandi } from "@/lib/stato/comandi";

/**
 * L'elenco delle scorciatoie.
 *
 * Legge la stessa tabella che usa il gestore dei tasti: quello che è scritto
 * qui è quello che funziona davvero. La pagina si raggiunge dal menu, dal piede
 * della palette e col tasto `?` — e la palette resta a un clic di distanza per
 * chi arriva qui col mouse e non ha voglia di imparare niente.
 */
export function SchermataScorciatoie() {
  const apri = useComandi((s) => s.apriPaletta);

  return (
    <Guscio
      titolo="Scorciatoie da tastiera"
      descrizione="Tutto quello che fanno si può fare anche col mouse"
      azioni={
        <Button onClick={apri} variante="contorno">
          Apri i comandi
        </Button>
      }
    >
      {/*
        Sotto i 768 questa schermata elenca ⌘K, N, ? e / a chi non ha una
        tastiera: si impagina benissimo e non serve a niente. Al suo posto una
        riga che dice perché, invece di un elenco di gesti impossibili. La
        schermata resta raggiungibile — dalla palette e dall'indirizzo — e
        ricompare intera appena c'è lo schermo per usarla.
      */}
      <Card className="md:hidden">
        <CardIntestazione>
          <CardTitolo>Questa schermata va usata da computer</CardTitolo>
          <CardSottotitolo>
            Sono scorciatoie da tastiera: qui non c&apos;è una tastiera a cui riferirsi
          </CardSottotitolo>
        </CardIntestazione>
        <CardCorpo className="pt-2">
          <p className="max-w-prose text-corpo text-inchiostro-tenue">
            Niente di quello che sta scritto qui è indispensabile: ogni scorciatoia fa una cosa
            che si fa anche toccando. Sul telefono la stessa ricerca sta nella lente in alto a
            sinistra, che apre la palette senza premere nulla.
          </p>
        </CardCorpo>
      </Card>

      <div className="hidden space-y-4 md:block">
        <Card>
          <CardIntestazione>
            <CardTitolo>La palette</CardTitolo>
            <CardSottotitolo>
              Un solo campo per navigare, creare, segnare incassata, cambiare anno
            </CardSottotitolo>
          </CardIntestazione>
          <CardCorpo className="pt-0">
            <p className="max-w-prose text-corpo text-inchiostro-tenue">
              <Tasto>⌘</Tasto> <Tasto>K</Tasto> apre la palette da qualsiasi schermata, anche
              mentre si sta scrivendo in un campo. Si scrive quello che si cerca — un comando, il
              nome di un cliente, un numero di fattura — e le lettere non devono essere di
              seguito: <span className="text-inchiostro">nvft</span> trova «nuova fattura».
            </p>
          </CardCorpo>
        </Card>

        {/* `items-start`: senza, le card si allungano tutte quanto la più alta e
            «Ovunque» resta mezzo riquadro vuoto accanto all'elenco delle rotte. */}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {GRUPPI_SCORCIATOIE.map((gruppo) => (
            <Card key={gruppo.titolo}>
              <CardIntestazione>
                <CardTitolo>{gruppo.titolo}</CardTitolo>
              </CardIntestazione>
              <CardCorpo className="pt-0">
                <dl className="divide-y divide-bordo">
                  {gruppo.voci.map((voce) => (
                    <Riga key={voce.tasti.join("+") + voce.descrizione} voce={voce} />
                  ))}
                </dl>
              </CardCorpo>
            </Card>
          ))}
        </div>

        <p className="max-w-prose text-etichetta text-inchiostro-tenue">
          Le scorciatoie a un tasto solo restano zitte mentre si scrive: premere{" "}
          <Tasto>N</Tasto> nella descrizione di una fattura scrive una «n», non apre niente. Fanno
          eccezione <Tasto>⌘</Tasto> <Tasto>K</Tasto> ed <Tasto>Esc</Tasto>, che servono
          soprattutto quando si è dentro un campo.
        </p>
      </div>
    </Guscio>
  );
}

function Riga({ voce }: { voce: Scorciatoia }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
      <span className="flex shrink-0 items-center gap-1">
        {voce.tasti.map((t) => (
          <Tasto key={t}>{t}</Tasto>
        ))}
      </span>
      <span className="min-w-40 flex-1 text-corpo">{voce.descrizione}</span>
      {voce.nota && (
        <span className="w-full text-etichetta text-inchiostro-tenue sm:w-auto sm:max-w-[18rem] sm:text-right">
          {voce.nota}
        </span>
      )}
    </div>
  );
}
