"use client";

import * as React from "react";

/**
 * Una sezione che entra con un velo e due pixel di scorrimento, una volta sola.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché un osservatore e non un'animazione CSS pura
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `animation` da sola parte al caricamento della pagina: le sezioni in fondo
 * avrebbero già finito di animarsi quando chi legge le raggiunge, e
 * l'animazione sarebbe lavoro fatto per nessuno. L'osservatore fa partire
 * ciascuna quando arriva al suo turno.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Quello che resta visibile quando non si anima
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Lo stato di partenza è `opacity-0`, e questo è il punto su cui un effetto
 * d'ingresso diventa un difetto: se l'osservatore non parte — JavaScript
 * lento, un browser che non lo implementa, `prefers-reduced-motion` — il
 * contenuto resta invisibile per sempre. Qui non può succedere, per tre
 * ragioni che si sommano:
 *
 * 1. con `prefers-reduced-motion` il componente non applica affatto lo stato
 *    nascosto: nasce visibile, e nessun effetto lo tocca;
 * 2. senza `IntersectionObserver` si mostra subito;
 * 3. l'osservatore si disconnette appena ha mostrato, quindi non c'è nessun
 *    cammino che riporti il contenuto a invisibile.
 *
 * `aria-hidden` non si usa in nessuno dei due stati: il contenuto c'è, nel
 * documento, dall'inizio — chi legge con una tecnologia assistiva non deve
 * aspettare uno scorrimento per sentirlo.
 */
export function AlComparire({
  children,
  className = "",
  ritardoMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  ritardoMs?: number;
}) {
  const [visibile, setVisibile] = React.useState(false);
  const riferimento = React.useRef<HTMLDivElement>(null);
  /*
    La preferenza si legge una volta, al primo rendering del client, e decide
    anche lo stato iniziale delle classi. Letta in un effetto sarebbe arrivata
    dopo il primo fotogramma, e chi ha chiesto di non vedere animazioni
    avrebbe visto almeno quella.
  */
  const [fermi] = React.useState(
    () =>
      typeof window !== "undefined"
      && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches),
  );

  React.useEffect(() => {
    if (fermi) return;
    const nodo = riferimento.current;
    if (!nodo || typeof IntersectionObserver !== "function") {
      setVisibile(true);
      return;
    }
    const osservatore = new IntersectionObserver(
      (voci) => {
        if (!voci.some((v) => v.isIntersecting)) return;
        setVisibile(true);
        osservatore.disconnect();
      },
      // Un filo prima di entrare del tutto: l'animazione finisce mentre si guarda.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    osservatore.observe(nodo);
    return () => osservatore.disconnect();
  }, [fermi]);

  if (fermi) {
    return (
      <div ref={riferimento} className={className}>
        {children}
      </div>
    );
  }

  return (
    <div
      ref={riferimento}
      className={`${className} transition-[opacity,transform] duration-500 ease-quieto ${
        visibile ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
      style={{ transitionDelay: visibile ? `${ritardoMs}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
