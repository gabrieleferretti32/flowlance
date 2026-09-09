"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import {
  CATEGORIE,
  EVENTO_PREFERENZE,
  NIENTE,
  TUTTO,
  ancoraValida,
  consensoEffettivo,
  leggiScelta,
  nuovaScelta,
  salvaScelta,
  type Consenso,
} from "@/lib/sito/consenso";
import { SITO } from "@/lib/rotte";

/**
 * Il banner dei cookie, scritto qui e non preso da una libreria.
 *
 * Le librerie di consenso pesano fra i 30 e i 100 kB, caricano da una CDN e
 * portano un pannello che non somiglia a niente del resto del sito. Quello che
 * serve qui sono due categorie, tre pulsanti e una riga in `localStorage`: sta
 * in un file, e si legge tutto.
 *
 * Quello che il banner **non** fa, ed è la parte che conta: non carica niente.
 * Gli script di statistica non esistono nella pagina finché non c'è un sì —
 * non sono caricati e messi a dormire, non ci sono proprio. Chi apre la rete
 * del browser prima di rispondere non vede partire una richiesta.
 *
 * «Rifiuta tutto» e «Accetta tutto» sono lo stesso pulsante con parole diverse:
 * stessa misura, stesso posto, stessa evidenza. La X in alto vale rifiuto,
 * perché chi chiude una finestra non sta acconsentendo a niente.
 */
export function BannerCookie({ onCambia }: { onCambia: (c: Consenso) => void }) {
  const [aperto, setAperto] = React.useState(false);
  const [dettaglio, setDettaglio] = React.useState(false);
  const [scelte, setScelte] = React.useState<Consenso>(NIENTE);

  // Alla prima apertura: si applica quello che vale, e si chiede solo se la
  // risposta manca, è scaduta, o è di quando le categorie erano altre.
  React.useEffect(() => {
    const salvata = leggiScelta();
    const adesso = new Date();
    onCambia(consensoEffettivo(salvata, adesso));
    setAperto(!ancoraValida(salvata, adesso));
  }, [onCambia]);

  // Il piede riapre il banner, da qualunque pagina.
  React.useEffect(() => {
    const riapri = () => {
      setScelte(consensoEffettivo(leggiScelta(), new Date()));
      setDettaglio(true);
      setAperto(true);
    };
    window.addEventListener(EVENTO_PREFERENZE, riapri);
    return () => window.removeEventListener(EVENTO_PREFERENZE, riapri);
  }, []);

  const rispondi = React.useCallback(
    (consenso: Consenso) => {
      salvaScelta(nuovaScelta(consenso, new Date()));
      onCambia(consenso);
      setAperto(false);
      setDettaglio(false);
    },
    [onCambia],
  );

  if (!aperto) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="titolo-cookie"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-bordo bg-superficie px-4 py-4 shadow-[0_-8px_32px_-16px_rgba(13,20,40,0.35)] sm:px-6 print:hidden"
    >
      <div className="mx-auto flex max-w-[1140px] flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p id="titolo-cookie" className="text-corpo font-semibold">
              Cookie di statistica
            </p>
            <p className="mt-1 max-w-[62ch] text-etichetta text-inchiostro-tenue">
              Questo sito può misurare quante persone lo aprono e come lo leggono. Serve a
              noi, non a te, e senza il tuo sì non parte niente.{" "}
              <strong className="font-medium text-inchiostro">
                Dentro l&apos;applicazione non c&apos;è nessuna misurazione, in nessun caso:
              </strong>{" "}
              i tuoi dati fiscali restano nel tuo browser.{" "}
              <Link href={SITO.cookie} className="text-accento underline underline-offset-2">
                Cookie policy
              </Link>
            </p>
          </div>
          {/* La X vale rifiuto, e lo dice: chiudere non è acconsentire. */}
          <button
            type="button"
            onClick={() => rispondi(NIENTE)}
            aria-label="Chiudi senza accettare"
            className="-m-2 shrink-0 rounded-campo p-2 text-inchiostro-tenue hover:bg-superficie-alt hover:text-inchiostro"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {dettaglio && (
          <fieldset className="flex flex-col gap-3 rounded-interna border border-bordo bg-superficie-alt p-4">
            <legend className="sr-only">Scegli una categoria alla volta</legend>
            {CATEGORIE.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={scelte[c.id]}
                  onChange={(e) =>
                    setScelte((s) => ({ ...s, [c.id]: e.target.checked }) as Consenso)
                  }
                  className="mt-0.5 size-4 shrink-0 accent-[var(--color-accento)]"
                />
                <span className="min-w-0">
                  <span className="block text-etichetta font-medium">{c.titolo}</span>
                  <span className="mt-0.5 block text-micro text-inchiostro-tenue">{c.cosaFa}</span>
                  <span className="mt-0.5 block text-micro text-inchiostro-tenue/80">{c.chi}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/*
            I due pulsanti principali sono gemelli: stessa variante, stessa
            misura, uno accanto all'altro. Rifiutare non deve costare un clic
            in più né sembrare la scelta sbagliata.
          */}
          <Bottone onClick={() => rispondi(NIENTE)}>Rifiuta tutto</Bottone>
          <Bottone onClick={() => rispondi(TUTTO)}>Accetta tutto</Bottone>
          {dettaglio ? (
            <Bottone onClick={() => rispondi(scelte)}>Salva le scelte</Bottone>
          ) : (
            <button
              type="button"
              onClick={() => {
                setScelte(consensoEffettivo(leggiScelta(), new Date()));
                setDettaglio(true);
              }}
              className="min-h-11 px-2 text-etichetta text-inchiostro-tenue underline underline-offset-2 hover:text-inchiostro"
            >
              Scegli una categoria alla volta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Bottone({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 rounded-campo border border-bordo bg-superficie px-4 text-etichetta font-medium transition-colors hover:border-inchiostro-tenue/40 hover:bg-superficie-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accento focus-visible:ring-offset-2"
    >
      {children}
    </button>
  );
}
