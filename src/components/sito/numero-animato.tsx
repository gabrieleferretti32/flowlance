"use client";

import * as React from "react";

/**
 * Un numero che sale fino al suo valore, una volta sola e in fretta.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché non una libreria, e perché così corto
 * ─────────────────────────────────────────────────────────────────────────
 *
 * È un'interpolazione lineare su `requestAnimationFrame`: trenta righe. Una
 * libreria di animazione costerebbe fra i 15 e i 40 KB di JavaScript su una
 * pagina che arriva dalla pubblicità, cioè quasi sempre da un telefono in
 * mezzo alla strada, per fare una cosa che il browser fa da sé.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il numero che si legge è sempre quello vero
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Due cose lo tengono, e sono la ragione per cui questo componente non
 * formatta niente da sé.
 *
 * La **formattazione** la fa chi lo usa, passando `scrivi`: ogni cifra di
 * questo progetto passa dai formattatori di `format.ts`, e un componente che
 * si mettesse a scrivere numeri per conto suo sarebbe il primo a scavalcarli
 * — con il raggruppamento che cambia fra Node e browser e l'idratazione che
 * salta.
 *
 * Il **valore finale** è esatto perché l'ultimo fotogramma non interpola: si
 * assegna il valore ricevuto. Un'animazione che finisce a 966,14 invece di
 * 966,15 è un numero sbagliato stampato in pagina, e la differenza non la
 * vedrebbe nessuno guardando — che è esattamente quello che la rende grave.
 *
 * Al primo rendering si mostra già il valore intero, non lo zero: chi arriva
 * con `prefers-reduced-motion` non vede nessuna animazione, e chi ha il
 * JavaScript lento non vede uno zero lampeggiare al posto del numero.
 */

const DURATA_MS = 420;

/** Partenza morbida e arrivo lento: una rampa lineare sembra un contatore rotto. */
const facilita = (t: number) => 1 - (1 - t) * (1 - t) * (1 - t);

export function NumeroAnimato({
  valore,
  scrivi,
  className,
}: {
  valore: number;
  /** Il formattatore. Sempre uno di `format.ts`. */
  scrivi: (n: number) => string;
  className?: string;
}) {
  const [mostrato, setMostrato] = React.useState(valore);
  const partenza = React.useRef(valore);

  React.useEffect(() => {
    /*
      Il rispetto di `prefers-reduced-motion` sta qui e non in un `@media`:
      questa animazione non è una transizione CSS, è un valore che cambia a
      ogni fotogramma. Una regola di stile non la fermerebbe — mostrerebbe lo
      stesso le cifre che corrono, solo senza transizione.
    */
    const fermi = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (fermi) {
      setMostrato(valore);
      partenza.current = valore;
      return;
    }

    const da = partenza.current;
    if (da === valore) return;
    const t0 = performance.now();
    let vivo = true;

    const passo = (ora: number) => {
      if (!vivo) return;
      const t = Math.min(1, (ora - t0) / DURATA_MS);
      // L'ultimo fotogramma non interpola: assegna. Vedi il commento in cima.
      setMostrato(t >= 1 ? valore : da + (valore - da) * facilita(t));
      if (t < 1) requestAnimationFrame(passo);
      else partenza.current = valore;
    };
    requestAnimationFrame(passo);
    return () => {
      vivo = false;
      /*
        Chi interrompe lascia il numero vero, non quello a metà strada: se
        l'utente cambia il fatturato mentre il contatore sale, il prossimo
        parte da dove si vede, ma il valore buono è già quello nuovo.
      */
      partenza.current = valore;
      setMostrato(valore);
    };
  }, [valore]);

  return <span className={className}>{scrivi(mostrato)}</span>;
}
