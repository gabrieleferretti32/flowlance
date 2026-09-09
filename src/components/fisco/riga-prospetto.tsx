"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { euro, percentuale } from "@/lib/format";
import { useSchermoStretto } from "@/lib/stato/schermo";
import type { RigaProspetto } from "@/lib/fisco/spiegazioni";

/**
 * Una riga del prospetto, con l'icona che apre la spiegazione.
 *
 * La spiegazione contiene i numeri reali di questa persona, non una nota
 * generica: serve a fidarsi del totale, o ad accorgersi che un'impostazione
 * è sbagliata.
 *
 * Si apre in due modi, e non è una raffinatezza. Con un mouse il riquadro
 * compare **accanto** alla riga e non dà fastidio: c'è spazio ai lati, e il
 * puntatore sa già dove si trova. Su un telefono lo stesso riquadro finisce
 * sopra il contenuto e copre proprio la riga che sta spiegando — misurato su
 * iPhone: ha nascosto «Compensi incassati» in un caso e il titolo «Reddito
 * imponibile» con la riga degli oneri deducibili in un altro. Una spiegazione
 * che nasconde ciò che spiega non è una spiegazione.
 *
 * Sotto i 768 px, quindi, il dettaglio si apre **sotto la riga e spinge in giù
 * il resto**: la riga resta dov'è e sotto le compare l'aiuto, come una nota a
 * margine. Nessuna sovrapposizione, niente da chiudere per tornare a leggere,
 * e lo scorrimento della pagina resta l'unico gesto in gioco.
 */
export function RigaDelProspetto({ riga }: { riga: RigaProspetto }) {
  const valore =
    riga.formato === "euro"
      ? euro(Number(riga.valore))
      : riga.formato === "percentuale"
        ? percentuale(Number(riga.valore))
        : String(riga.valore);

  const spiegabile = Boolean(riga.formula || riga.nota);
  const stretto = useSchermoStretto();
  const [aperta, setAperta] = React.useState(false);
  const idDettaglio = React.useId();

  return (
    <div>
      <div
        className={cn(
          "flex items-baseline justify-between gap-3 px-4 py-2.5 sm:gap-4 sm:px-6",
          riga.totale && "bg-superficie-alt/70 font-medium",
        )}
      >
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className={cn("text-corpo", riga.totale && "font-medium")}>{riga.etichetta}</span>
          {spiegabile &&
            (stretto ? (
              <BottoneDettaglio
                etichetta={riga.etichetta}
                aperta={aperta}
                controlla={idDettaglio}
                onClick={() => setAperta((v) => !v)}
              />
            ) : (
              <Spiegazione riga={riga} valore={valore} />
            ))}
        </span>
        <span
          className={cn(
            "cifre shrink-0 whitespace-nowrap text-corpo",
            riga.totale && "text-kpi-sm font-semibold",
            riga.formato === "testo" && "text-corpo font-normal",
          )}
        >
          {valore}
        </span>
      </div>

      {/*
        Il dettaglio in linea non ripete etichetta e valore, che il riquadro
        invece porta con sé: qui la riga è **visibile due centimetri sopra**, e
        ricopiarla allungherebbe la spinta senza aggiungere niente. È l'unico
        vantaggio dell'aprirsi sotto invece che sopra, e vale la pena prenderlo.
      */}
      {spiegabile && stretto && aperta && (
        <div
          id={idDettaglio}
          className="border-l-2 border-accento/30 bg-superficie-alt/50 px-4 pb-3 pt-2 sm:px-6"
        >
          {riga.formula && <p className="text-etichetta">{riga.formula}</p>}
          {riga.nota && (
            <p
              className={cn(
                "text-etichetta text-inchiostro-tenue",
                riga.formula && "mt-2 border-t border-bordo pt-2",
              )}
            >
              {riga.nota}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Il bersaglio da premere, sul telefono.
 *
 * Resta l'icona di sempre e resta 44 px: cambia solo che adesso è un
 * interruttore, e lo dichiara con `aria-expanded` invece di fingersi un
 * pulsante che apre qualcosa altrove. Aperto si tinge d'accento, così fra
 * dieci righe si vede quale si è toccata.
 */
function BottoneDettaglio({
  etichetta,
  aperta,
  controlla,
  onClick,
}: {
  etichetta: string;
  aperta: boolean;
  controlla: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Come si calcola: ${etichetta}`}
      aria-expanded={aperta}
      aria-controls={aperta ? controlla : undefined}
      onClick={onClick}
      /* 44 px sul telefono, dove si preme col pollice: da 30 si mancava e si
         finiva sulla riga. I margini negativi tengono la riga alta come prima —
         il bersaglio cresce, il prospetto no. */
      className={cn(
        "-my-2.5 flex size-11 shrink-0 items-center justify-center rounded-full transition-colors",
        aperta ? "bg-accento-tenue text-accento" : "text-inchiostro-tenue/70",
      )}
    >
      <HelpCircle className="size-3.5" aria-hidden />
    </button>
  );
}

/** Da 768 in su: il riquadro accanto alla riga, dove lo spazio c'è. */
function Spiegazione({ riga, valore }: { riga: RigaProspetto; valore: string }) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={`Come si calcola: ${riga.etichetta}`}
          className="-my-0.5 flex shrink-0 items-center justify-center rounded-full p-0.5 text-inchiostro-tenue/70 transition-colors hover:bg-superficie-alt hover:text-accento focus-visible:text-accento"
        >
          <HelpCircle className="size-3.5" aria-hidden />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          sideOffset={6}
          collisionPadding={16}
          className="z-50 w-[min(24rem,calc(100vw-2rem))] rounded-interna border border-bordo bg-superficie p-4 shadow-sollevato"
        >
          <p className="text-etichetta font-medium">{riga.etichetta}</p>
          <p className="cifre mt-0.5 text-kpi-sm font-semibold">{valore}</p>
          {riga.formula && <p className="mt-2 text-etichetta">{riga.formula}</p>}
          {riga.nota && (
            <p className="mt-2 border-t border-bordo pt-2 text-etichetta text-inchiostro-tenue">
              {riga.nota}
            </p>
          )}
          <PopoverPrimitive.Arrow className="fill-superficie" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
