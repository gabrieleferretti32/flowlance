/**
 * Dove stanno le cose dentro un PDF. In punti, pagina per pagina.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché serve un lettore di geometria e non basta il testo
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il generatore dei Termini ha sbagliato due volte sulle pagine, e tutte e due
 * le volte il **testo era giusto**:
 *
 * - la prima stampava «pagina 1 di 1» su un documento di quattro, perché
 *   contava le pagine prima di averle;
 * - la seconda scriveva i quattro piedi su **quattro pagine nuove e vuote** in
 *   fondo al documento, in alto, perché scrivere sotto il margine inferiore fa
 *   aggiungere una pagina a pdfkit. Il PDF usciva di otto pagine: quattro col
 *   contratto e senza piede, quattro vuote con solo il piede.
 *
 * Il controllo che avevo scritto cercava le stringhe «pagina N di M» nel testo
 * estratto. Le trovava tutte e quattro, in fila, e concludeva che c'era un
 * piede per pagina. **Guardava la presenza del testo invece di dove stesse.**
 *
 * Questo modulo apre il PDF come lo apre un lettore: segue l'albero delle
 * pagine, decomprime i flussi di contenuto, e restituisce per ogni pagina il
 * suo rettangolo e le coordinate di ogni blocco di testo e di ogni colore
 * usato per riempire. Le affermazioni si fanno su quelle.
 */
import { inflateSync } from "node:zlib";

export type BloccoTesto = { x: number; y: number; testo: string };

export type PaginaPdf = {
  /** 1 per la prima. */
  numero: number;
  larghezza: number;
  altezza: number;
  /** I blocchi di testo, con l'origine in basso a sinistra come vuole il PDF. */
  testi: BloccoTesto[];
  /** I colori di riempimento usati, in ordine, come terne 0–1. */
  riempimenti: [number, number, number][];
};

/**
 * WinAnsi non è Latin-1 nella fascia 0x80–0x9F, ed è lì che stanno i caratteri
 * di un documento italiano: l'euro, le lineette, le virgolette basse.
 */
const WINANSI: Record<number, string> = {
  0x80: "€", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”",
  0x96: "–", 0x97: "—", 0xab: "«", 0xbb: "»",
};

function daWinAnsi(esadecimale: string): string {
  let fuori = "";
  for (let i = 0; i < esadecimale.length; i += 2) {
    const codice = Number.parseInt(esadecimale.slice(i, i + 2), 16);
    fuori += WINANSI[codice] ?? String.fromCharCode(codice);
  }
  return fuori;
}

/** Gli oggetti indiretti del file, per numero. */
function oggetti(byte: Buffer): Map<number, string> {
  const grezzo = byte.toString("latin1");
  const mappa = new Map<number, string>();
  for (const m of grezzo.matchAll(/(\d+)\s+0\s+obj\b([\s\S]*?)\bendobj/g)) {
    mappa.set(Number(m[1]), m[2]);
  }
  return mappa;
}

/** Il flusso di un oggetto, decompresso se serve. */
function flusso(corpo: string): string | null {
  const m = corpo.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
  if (!m) return null;
  const dati = Buffer.from(m[1], "latin1");
  if (!/\/FlateDecode/.test(corpo)) return dati.toString("latin1");
  try {
    return inflateSync(dati).toString("latin1");
  } catch {
    return null;
  }
}

/**
 * Le pagine **nell'ordine in cui si sfogliano**.
 *
 * Si segue `/Kids` dall'albero delle pagine e non l'ordine dei numeri
 * d'oggetto: coincidono quasi sempre, e «quasi sempre» è il modo in cui una
 * verifica si mette a misurare la pagina sbagliata senza dirlo.
 */
export function leggiPagine(byte: Buffer): PaginaPdf[] {
  const objs = oggetti(byte);

  const radice = [...objs].find(([, corpo]) => /\/Type\s*\/Pages\b/.test(corpo));
  if (!radice) throw new Error("Il PDF non ha un albero delle pagine.");

  const ordine: number[] = [];
  const scendi = (numero: number) => {
    const corpo = objs.get(numero);
    if (!corpo) return;
    if (/\/Type\s*\/Page[^s]/.test(corpo)) {
      ordine.push(numero);
      return;
    }
    const kids = corpo.match(/\/Kids\s*\[([^\]]*)\]/)?.[1] ?? "";
    for (const k of kids.matchAll(/(\d+)\s+0\s+R/g)) scendi(Number(k[1]));
  };
  scendi(radice[0]);

  return ordine.map((numeroOggetto, indice) => {
    const corpo = objs.get(numeroOggetto)!;
    const riquadro = (corpo.match(/\/MediaBox\s*\[([^\]]*)\]/)?.[1] ?? "0 0 595 842")
      .trim()
      .split(/\s+/)
      .map(Number);

    const contenuto = [...corpo.matchAll(/\/Contents\s+(\d+)\s+0\s+R/g)]
      .map((m) => flusso(objs.get(Number(m[1])) ?? ""))
      .filter((s): s is string => s !== null)
      .join("\n");

    /*
      pdfkit ribalta l'asse con `1 0 0 -1 0 altezza cm`, quindi la `y` scritta
      nella matrice del testo è già misurata dal basso: è la coordinata PDF, e
      qui si restituisce quella. Zero è il piede del foglio.
    */
    const testi: BloccoTesto[] = [];
    for (const m of contenuto.matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm([\s\S]*?)ET/g)) {
      const pezzi = [...m[3].matchAll(/<([0-9a-fA-F]+)>/g)].map((h) => daWinAnsi(h[1]));
      testi.push({ x: Number(m[1]), y: Number(m[2]), testo: pezzi.join("") });
    }

    const riempimenti = [...contenuto.matchAll(/([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+scn/g)].map(
      (m) => [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number],
    );

    return {
      numero: indice + 1,
      larghezza: riquadro[2] - riquadro[0],
      altezza: riquadro[3] - riquadro[1],
      testi,
      riempimenti,
    };
  });
}

/** Un colore `#rrggbb` come terna 0–1, per confrontarlo con quelli del PDF. */
export function terna(esadecimale: string): [number, number, number] {
  const n = esadecimale.replace("#", "");
  return [0, 2, 4].map((i) => Number.parseInt(n.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

/** Due colori coincidono a meno dell'arrotondamento con cui il PDF li scrive. */
export function stessoColore(a: [number, number, number], b: [number, number, number]): boolean {
  return a.every((v, i) => Math.abs(v - b[i]) < 0.004);
}
