import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge non conosce i token di questo progetto: senza questa
 * configurazione considera `text-kpi` (dimensione) e `text-white` (colore)
 * dello stesso gruppo e ne tiene solo l'ultimo, così i numeri grandi sulle
 * card colorate tornano alla dimensione del testo corrente.
 * Ogni scala personalizzata definita in `globals.css` va dichiarata qui.
 */
const DIMENSIONI_TESTO = ["semaforo", "kpi", "kpi-sm", "corpo", "campo", "etichetta", "micro"];

const COLORI = [
  "fondo",
  "superficie",
  "superficie-alt",
  "inchiostro",
  "inchiostro-tenue",
  "bordo",
  "accento",
  "accento-tenue",
  "positivo",
  "positivo-tenue",
  "attenzione",
  "attenzione-tenue",
  "negativo",
  "negativo-tenue",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: DIMENSIONI_TESTO }],
      "text-color": [{ text: COLORI }],
      "bg-color": [{ bg: COLORI }],
      "border-color": [{ border: COLORI }],
      "font-family": [{ font: ["display", "sans"] }],
      rounded: [{ rounded: ["card", "interna", "campo"] }],
      "shadow-color": [],
      shadow: [{ shadow: ["riposo", "sollevato"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
