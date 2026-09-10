/**
 * Il marchio Flowlance disegnato dentro un PDF, **dal file SVG**.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché si legge il file invece di ridisegnarlo
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `src/app/icon.svg` è quattro rettangoli arrotondati: la tessera scura, l'asta
 * e il braccio della «F» in bianco, la barra centrale in accento. Sono forme
 * che pdfkit sa disegnare esattamente com'è, senza approssimare niente e senza
 * passare da un'immagine.
 *
 * Ricopiare quelle coordinate qui dentro sarebbe stato più corto e sarebbe
 * stata la solita seconda copia: il marchio dell'app e il marchio del contratto
 * che divergono il giorno in cui uno dei due si ritocca, e nessuno se ne accorge
 * perché sono due file che nessuno guarda insieme. Qui il disegno è lo stesso
 * file, letto a ogni build.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Un lettore severo, come il renderer del Markdown
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Conosce `<svg viewBox>` e `<rect>`, e **fallisce** su qualunque altra forma —
 * un `<path>`, un gradiente, un `<circle>`. Il giorno in cui il marchio diventa
 * un disegno vero, il build si ferma e lo dice, invece di stampare in testa a un
 * contratto un logo con dentro un pezzo in meno.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Dove sta il disegno. Lo stesso file che il browser usa come favicon. */
export const SORGENTE_MARCHIO = "src/app/icon.svg";

export type RettangoloMarchio = {
  x: number;
  y: number;
  larghezza: number;
  altezza: number;
  raggio: number;
  colore: string;
};

export type Marchio = { lato: number; rettangoli: RettangoloMarchio[] };

const numero = (attributi: string, nome: string, predefinito: number | null = null): number => {
  const m = attributi.match(new RegExp(`\\b${nome}\\s*=\\s*"([^"]*)"`));
  if (!m) {
    if (predefinito !== null) return predefinito;
    throw new Error(`${SORGENTE_MARCHIO}: a un <rect> manca l'attributo «${nome}».`);
  }
  const v = Number(m[1]);
  if (!Number.isFinite(v)) {
    throw new Error(`${SORGENTE_MARCHIO}: «${nome}="${m[1]}"» non è un numero.`);
  }
  return v;
};

/**
 * Legge il marchio dal file SVG.
 *
 * Il `viewBox` deve essere quadrato e partire dall'origine: il marchio è una
 * tessera, e le proporzioni con cui viene messo nel PDF partono da lì. Un
 * viewBox diverso disegnerebbe un marchio deformato senza dirlo.
 */
export function leggiMarchio(radice = process.cwd()): Marchio {
  const svg = readFileSync(join(radice, SORGENTE_MARCHIO), "utf8");

  const viewBox = svg.match(/viewBox\s*=\s*"([^"]*)"/)?.[1]?.trim().split(/\s+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || viewBox[0] !== 0 || viewBox[1] !== 0) {
    throw new Error(`${SORGENTE_MARCHIO}: il viewBox deve essere «0 0 lato lato».`);
  }
  if (viewBox[2] !== viewBox[3]) {
    throw new Error(
      `${SORGENTE_MARCHIO}: il viewBox non è quadrato (${viewBox[2]}×${viewBox[3]}).\n`
        + "Il marchio nel PDF viene messo in una tessera quadrata: con proporzioni diverse\n"
        + "uscirebbe deformato, e nessuno se ne accorgerebbe guardando solo il sito.",
    );
  }

  /*
    Tutto ciò che disegna, non solo i `<rect>`: se un giorno il marchio contiene
    un `<path>`, questo elenco lo trova e il build si ferma. Cercare i soli
    `<rect>` avrebbe ignorato in silenzio la parte nuova.
  */
  const disegnano = [...svg.matchAll(/<\s*([a-zA-Z][\w-]*)/g)]
    .map((m) => m[1])
    .filter((t) => !["svg", "title", "desc", "metadata"].includes(t));
  const estranei = [...new Set(disegnano.filter((t) => t !== "rect"))];
  if (estranei.length > 0) {
    throw new Error(
      `${SORGENTE_MARCHIO}: contiene <${estranei.join(">, <")}>, che il disegnatore del PDF non sa fare.\n`
        + "Conosce solo <rect>. Aggiungi la forma a src/lib/contenuti/marchio-pdf.ts oppure\n"
        + "cambia il modo in cui il marchio finisce nel contratto — ma non lasciarlo uscire\n"
        + "con un pezzo in meno.",
    );
  }

  const rettangoli = [...svg.matchAll(/<rect\b([^>]*)\/?>/g)].map(([, attributi]) => {
    const colore = attributi.match(/\bfill\s*=\s*"([^"]*)"/)?.[1];
    if (!colore) throw new Error(`${SORGENTE_MARCHIO}: a un <rect> manca «fill».`);
    return {
      x: numero(attributi, "x", 0),
      y: numero(attributi, "y", 0),
      larghezza: numero(attributi, "width"),
      altezza: numero(attributi, "height"),
      raggio: numero(attributi, "rx", 0),
      colore,
    };
  });

  if (rettangoli.length === 0) {
    throw new Error(`${SORGENTE_MARCHIO}: nessun <rect>. Il marchio uscirebbe come un quadrato vuoto.`);
  }

  return { lato: viewBox[2], rettangoli };
}

/**
 * Disegna il marchio su un documento pdfkit, a `(x, y)`, largo `lato` punti.
 *
 * `y` è il bordo superiore, come in SVG e come nel resto di pdfkit: qui il
 * sistema di coordinate è già quello del documento, e il chiamante non deve
 * ribaltare niente.
 */
export function disegnaMarchio(
  doc: PDFKit.PDFDocument,
  marchio: Marchio,
  x: number,
  y: number,
  lato: number,
): void {
  const k = lato / marchio.lato;
  doc.save();
  for (const r of marchio.rettangoli) {
    doc
      .roundedRect(x + r.x * k, y + r.y * k, r.larghezza * k, r.altezza * k, r.raggio * k)
      .fill(r.colore);
  }
  doc.restore();
}
