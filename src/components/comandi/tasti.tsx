"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ROTTE_PER_TASTO } from "@/lib/comandi/scorciatoie";
import { useComandi } from "@/lib/stato/comandi";
import { useSolaLettura } from "@/lib/stato/licenza";
import { ROTTE } from "@/lib/rotte";

/** Quanto tempo si ha per premere la lettera dopo `g`. */
const ATTESA_SEQUENZA = 2000;

/**
 * Vero se si sta scrivendo da qualche parte.
 *
 * È la distinzione che rende usabili le scorciatoie a tasto singolo: `n` in un
 * campo descrizione deve scrivere una «n», non aprire una fattura nuova. Senza
 * questo controllo la funzione è attiva ma inservibile.
 */
function staScrivendo(bersaglio: EventTarget | null): boolean {
  if (!(bersaglio instanceof HTMLElement)) return false;
  if (bersaglio.isContentEditable) return true;
  const tag = bersaglio.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Le scorciatoie globali.
 *
 * Non rende nulla: sta nel guscio e ascolta. Le combinazioni sono quelle
 * dichiarate in `lib/comandi/scorciatoie`, che è anche ciò che la schermata di
 * aiuto mostra — così non possono divergere.
 */
export function ScorciatoieGlobali() {
  const router = useRouter();
  const apri = useComandi((s) => s.apriPaletta);
  const chiudi = useComandi((s) => s.chiudiPaletta);
  const paletta = useComandi((s) => s.paletta);
  const chiedi = useComandi((s) => s.chiedi);
  // A licenza scaduta `n` non apre niente: aprire un modulo che poi non salva
  // è peggio che non aprirlo. La palette fa lo stesso, togliendo le voci.
  const bloccato = useSolaLettura();
  const attesaG = React.useRef<number | null>(null);

  const stato = React.useRef({ paletta, apri, chiudi, chiedi, router, bloccato });
  stato.current = { paletta, apri, chiudi, chiedi, router, bloccato };

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const { paletta, apri, chiudi, chiedi, router, bloccato } = stato.current;

      // ⌘K funziona ovunque, anche dentro un campo: è il modo di uscire da una
      // schermata senza staccare le mani dalla tastiera.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (paletta) chiudi();
        else apri();
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (paletta) return; // dentro la palette comanda la palette
      if (staScrivendo(e.target)) return;
      // Un modulo aperto è modale: sotto non deve succedere niente.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;

      // La seconda metà di `g` + lettera.
      if (attesaG.current !== null) {
        window.clearTimeout(attesaG.current);
        attesaG.current = null;
        const href = ROTTE_PER_TASTO[e.key.toLowerCase()];
        if (href) {
          e.preventDefault();
          router.push(href);
        }
        return;
      }

      switch (e.key) {
        case "g":
          e.preventDefault();
          attesaG.current = window.setTimeout(() => {
            attesaG.current = null;
          }, ATTESA_SEQUENZA);
          return;
        case "n":
          e.preventDefault();
          if (bloccato) return;
          router.push(ROTTE.fatture);
          chiedi({ tipo: "nuovaFattura" });
          return;
        case "/": {
          e.preventDefault();
          // La ricerca della schermata, se ne ha una: cercare fra le proprie
          // fatture è più frequente che cercare un comando. Altrimenti la
          // palette, che cerca dappertutto.
          const campo = document.querySelector<HTMLInputElement>("[data-ricerca]");
          if (campo) {
            campo.focus();
            campo.select();
          } else {
            apri();
          }
          return;
        }
        case "?":
          e.preventDefault();
          router.push(ROTTE.scorciatoie);
          return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (attesaG.current !== null) window.clearTimeout(attesaG.current);
    };
  }, []);

  return null;
}
