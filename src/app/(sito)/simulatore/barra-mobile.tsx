"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BellRing } from "lucide-react";
import { rottaDemo } from "@/lib/rotte";
import { ANCORA_PROMEMORIA } from "./promemoria";

/**
 * La barra fissa in fondo, solo sul telefono.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Quando c'è, e quando se ne va
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Compare dopo che il risultato è stato visto — non dall'inizio: una barra che
 * copre venti righe della pagina prima che la pagina abbia detto qualcosa
 * chiede un'azione per una cosa che chi legge non sa ancora se gli interessa.
 *
 * Se ne va in due casi, e tutti e due sono «ha già fatto il suo mestiere»: la
 * sezione a cui porta è a schermo, oppure l'iscrizione è andata. Una barra che
 * invita a scorrere verso una cosa che si sta guardando è rumore, e un invito a
 * iscriversi dopo l'iscrizione è un dubbio su se sia andata.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Lo spazio che si prende, e perché lo chiede al `body`
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Una barra fissa copre quello che le sta sotto, e in fondo a questa pagina
 * c'è il piede — che non è dentro `<main>`: lo monta il guscio di `(sito)`,
 * come fratello. Un margine sul contenitore della pagina quindi non lo
 * protegge, e la prima stesura di questo componente ce l'aveva: a schermo si
 * vedeva «Flowlance è un prodotto di Gabriele Ferretti · P. IVA 02649540065 ·
 * REA AL-3008» con l'ultima riga tagliata a metà. Si scopre solo scorrendo
 * fino in fondo su un telefono vero, ed è il genere di cosa che nessuno fa
 * dopo la decima modifica.
 *
 * Perciò lo spazio lo chiede al `body`, che è l'unico elemento che sta sotto
 * tutti: finché la barra c'è, il documento è più alto di quanto la barra è
 * alta. `env(safe-area-inset-bottom)` è per gli iPhone con la tacca, dove gli
 * ultimi 34 px sono della barra del sistema.
 */

/** Quanto è alta la barra, bottone e margini compresi. */
const ALTEZZA = "5.25rem";
export function BarraMobile({
  visibile,
  attiva,
}: {
  visibile: boolean;
  /** I promemoria sono accesi? Da spenta, la barra porta alla demo. */
  attiva: boolean;
}) {
  React.useEffect(() => {
    /*
      Solo dove la barra esiste davvero. `sm:hidden` la toglie dalla vista ma
      questo effetto gira comunque: senza il controllo sulla larghezza, il
      desktop si ritroverebbe ottanta pixel di vuoto in fondo che nessuno ha
      chiesto.
    */
    const stretto = window.matchMedia("(max-width: 639px)");
    const applica = () => {
      document.body.style.paddingBottom =
        visibile && stretto.matches ? `calc(${ALTEZZA} + env(safe-area-inset-bottom))` : "";
    };
    applica();
    stretto.addEventListener("change", applica);
    return () => {
      stretto.removeEventListener("change", applica);
      document.body.style.paddingBottom = "";
    };
  }, [visibile]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-bordo bg-superficie/95 backdrop-blur-sm transition-transform duration-300 ease-quieto sm:hidden ${
        visibile ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      /*
        Fuori dall'albero di accessibilità quando è nascosta: un pulsante
        tradotto fuori dallo schermo resta raggiungibile con il tasto di
        tabulazione, e porterebbe il fuoco su qualcosa che non si vede.
      */
      aria-hidden={!visibile}
    >
      <div className="px-4 py-3">
        {attiva ? (
          <a
            href={`#${ANCORA_PROMEMORIA}`}
            tabIndex={visibile ? undefined : -1}
            className="flex w-full items-center justify-center gap-2 rounded-campo bg-accento px-5 py-3.5 text-campo font-semibold text-white"
          >
            <BellRing className="size-4 shrink-0" aria-hidden />
            Avvisami prima delle scadenze
          </a>
        ) : (
          <Link
            href={rottaDemo("vetrina")}
            tabIndex={visibile ? undefined : -1}
            className="flex w-full items-center justify-center gap-2 rounded-campo bg-accento px-5 py-3.5 text-campo font-semibold text-white"
          >
            Guarda la demo, senza registrarti
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}
