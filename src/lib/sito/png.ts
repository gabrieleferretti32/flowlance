/**
 * Un lettore di PNG, quel poco che serve per **misurare** un'immagine.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché leggere i pixel e non fidarsi
 * ─────────────────────────────────────────────────────────────────────────
 *
 * L'immagine di anteprima è l'ultimo artefatto di questo progetto che nessuno
 * guarda mai: si vede solo incollando un indirizzo in una chat, e se esce
 * sbagliata lo scopre chi riceve il link. La verifica che aveva — «il file
 * esiste, e le due costanti dicono 1200 × 630» — non apriva il file: due
 * numeri scritti in un `export` non sono le misure di un PNG, sono
 * un'intenzione. E un'intenzione l'abbiamo già vista discostarsi dal file due
 * volte, con il piede del contratto.
 *
 * Qui si aprono i byte: le misure vere stanno nell'IHDR, il testo che il
 * generatore ci ha lasciato negli iTXt, e i pixel — decompressi e sfiltrati —
 * permettono di misurare **quanto è alto l'inchiostro del titolo**, che è
 * l'unica domanda che somigli a «si legge».
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Quel poco: cosa conosce e cosa rifiuta
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Otto bit per canale, RGB o RGBA, non interlacciato: è quello che scrive
 * Chromium quando fotografa una pagina, ed è tutto quello che serve. Su
 * qualunque altra forma **fallisce dicendolo**, come il lettore del marchio e
 * come il renderer del Markdown: un decodificatore tollerante restituirebbe
 * pixel plausibili e sbagliati, e la misura che ne esce sarebbe peggio di
 * nessuna misura.
 */
import { inflateSync } from "node:zlib";

const FIRMA = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export type PezzoPng = { tipo: string; dati: Uint8Array };

/** I pezzi del file, in ordine. Un PNG è una firma e poi una fila di chunk. */
export function pezziPng(file: Uint8Array): PezzoPng[] {
  for (let i = 0; i < FIRMA.length; i += 1) {
    if (file[i] !== FIRMA[i]) throw new Error("Non è un PNG: manca la firma di otto byte in testa.");
  }
  const vista = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const pezzi: PezzoPng[] = [];
  let p = 8;
  while (p + 8 <= file.length) {
    const lunghezza = vista.getUint32(p);
    const tipo = String.fromCharCode(file[p + 4], file[p + 5], file[p + 6], file[p + 7]);
    const inizio = p + 8;
    if (inizio + lunghezza > file.length) throw new Error(`PNG troncato dentro il pezzo «${tipo}».`);
    pezzi.push({ tipo, dati: file.subarray(inizio, inizio + lunghezza) });
    p = inizio + lunghezza + 4; // + CRC
    if (tipo === "IEND") break;
  }
  return pezzi;
}

export type MisurePng = {
  larghezza: number;
  altezza: number;
  profondita: number;
  tipoColore: number;
  interlacciato: boolean;
};

/** Le misure vere, lette dall'IHDR: quelle che ha il file, non quelle dichiarate. */
export function misurePng(file: Uint8Array): MisurePng {
  const ihdr = pezziPng(file).find((p) => p.tipo === "IHDR");
  if (!ihdr) throw new Error("PNG senza IHDR: non dice nemmeno quanto è grande.");
  const v = new DataView(ihdr.dati.buffer, ihdr.dati.byteOffset, ihdr.dati.byteLength);
  return {
    larghezza: v.getUint32(0),
    altezza: v.getUint32(4),
    profondita: ihdr.dati[8],
    tipoColore: ihdr.dati[9],
    interlacciato: ihdr.dati[12] !== 0,
  };
}

const fino0 = (d: Uint8Array, da: number): number => {
  const i = d.indexOf(0, da);
  return i === -1 ? d.length : i;
};

/**
 * Il testo che il generatore ha lasciato dentro l'immagine.
 *
 * `iTXt` e non `tEXt`: il testo di `tEXt` è Latin-1, e il titolo della landing
 * contiene «€», che in Latin-1 non esiste. Un chunk che non sa scrivere il
 * proprio contenuto è il modo di perdere il carattere che conta.
 */
export function testiPng(file: Uint8Array): Record<string, string> {
  const testi: Record<string, string> = {};
  const utf8 = new TextDecoder("utf-8");
  const latin1 = new TextDecoder("latin1");
  for (const p of pezziPng(file)) {
    if (p.tipo === "tEXt") {
      const fine = fino0(p.dati, 0);
      testi[latin1.decode(p.dati.subarray(0, fine))] = latin1.decode(p.dati.subarray(fine + 1));
    } else if (p.tipo === "iTXt") {
      const fineChiave = fino0(p.dati, 0);
      const chiave = latin1.decode(p.dati.subarray(0, fineChiave));
      const compresso = p.dati[fineChiave + 1];
      if (compresso !== 0) continue; // compresso: qui non serve, e indovinarlo sarebbe peggio
      const fineLingua = fino0(p.dati, fineChiave + 3);
      const fineTradotta = fino0(p.dati, fineLingua + 1);
      testi[chiave] = utf8.decode(p.dati.subarray(fineTradotta + 1));
    }
  }
  return testi;
}

export type Immagine = { larghezza: number; altezza: number; rgba: Uint8Array };

/** Un pixel in RGBA, dentro `Immagine`. */
export function pixel(img: Immagine, x: number, y: number): [number, number, number, number] {
  const i = (y * img.larghezza + x) * 4;
  return [img.rgba[i], img.rgba[i + 1], img.rgba[i + 2], img.rgba[i + 3]];
}

/**
 * I pixel, decompressi e sfiltrati.
 *
 * Ogni riga del PNG comincia con un byte che dice come è stata predetta dalla
 * precedente: cinque filtri, tutti e cinque necessari perché il codificatore
 * sceglie riga per riga quello che comprime meglio. Saltarne uno vorrebbe dire
 * righe di rumore in mezzo all'immagine — visibile, ma non da chi legge solo
 * un numero in fondo a un test.
 */
export function pixelPng(file: Uint8Array): Immagine {
  const m = misurePng(file);
  if (m.profondita !== 8 || (m.tipoColore !== 2 && m.tipoColore !== 6) || m.interlacciato) {
    throw new Error(
      `PNG a ${m.profondita} bit, tipo colore ${m.tipoColore}`
        + `${m.interlacciato ? ", interlacciato" : ""}: questo lettore conosce solo 8 bit RGB o RGBA `
        + "non interlacciati.\nÈ quello che scrive Chromium fotografando una pagina: se il file "
        + "viene da altrove, aggiungi il caso invece di leggerlo a caso.",
    );
  }
  const canali = m.tipoColore === 6 ? 4 : 3;
  const pezzi = pezziPng(file).filter((p) => p.tipo === "IDAT");
  if (pezzi.length === 0) throw new Error("PNG senza IDAT: nessun pixel dentro.");
  const compresso = Buffer.concat(pezzi.map((p) => Buffer.from(p.dati)));
  const grezzo = inflateSync(compresso);

  const passo = m.larghezza * canali;
  const rgba = new Uint8Array(m.larghezza * m.altezza * 4);
  let precedente = new Uint8Array(passo);
  let p = 0;
  for (let y = 0; y < m.altezza; y += 1) {
    const filtro = grezzo[p];
    p += 1;
    const riga = new Uint8Array(grezzo.subarray(p, p + passo));
    p += passo;
    for (let i = 0; i < passo; i += 1) {
      const a = i >= canali ? riga[i - canali] : 0;
      const b = precedente[i];
      const c = i >= canali ? precedente[i - canali] : 0;
      switch (filtro) {
        case 0:
          break;
        case 1:
          riga[i] = (riga[i] + a) & 0xff;
          break;
        case 2:
          riga[i] = (riga[i] + b) & 0xff;
          break;
        case 3:
          riga[i] = (riga[i] + ((a + b) >> 1)) & 0xff;
          break;
        case 4: {
          const q = a + b - c;
          const da = Math.abs(q - a);
          const db = Math.abs(q - b);
          const dc = Math.abs(q - c);
          riga[i] = (riga[i] + (da <= db && da <= dc ? a : db <= dc ? b : c)) & 0xff;
          break;
        }
        default:
          throw new Error(`Filtro PNG ${filtro} sconosciuto alla riga ${y}.`);
      }
    }
    for (let x = 0; x < m.larghezza; x += 1) {
      const s = x * canali;
      const d = (y * m.larghezza + x) * 4;
      rgba[d] = riga[s];
      rgba[d + 1] = riga[s + 1];
      rgba[d + 2] = riga[s + 2];
      rgba[d + 3] = canali === 4 ? riga[s + 3] : 255;
    }
    precedente = riga;
  }
  return { larghezza: m.larghezza, altezza: m.altezza, rgba };
}

// ————————————————————————————————————————————————————————————
// Misurare l'inchiostro
// ————————————————————————————————————————————————————————————

export type Riquadro = { x: number; y: number; larghezza: number; altezza: number };

/** Quanto due colori sono lontani, in distanza euclidea su RGB (0 – 441). */
export function distanza(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Il riquadro occupato dai pixel che **non** sono il fondo, dentro una zona.
 *
 * È la misura che sostituisce «il testo c'è»: dice dove comincia e dove
 * finisce l'inchiostro davvero disegnato, quindi quanto è alta una riga di
 * testo in pixel. Da lì si risponde alla domanda vera — a dimensione di
 * miniatura si legge ancora? — invece di guardare l'immagine e dire di sì.
 */
export function inchiostro(
  img: Immagine,
  zona: Riquadro,
  fondo: readonly number[],
  soglia = 60,
): (Riquadro & { quanti: number }) | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let quanti = 0;
  const finX = Math.min(img.larghezza, zona.x + zona.larghezza);
  const finY = Math.min(img.altezza, zona.y + zona.altezza);
  for (let y = Math.max(0, zona.y); y < finY; y += 1) {
    for (let x = Math.max(0, zona.x); x < finX; x += 1) {
      if (distanza(pixel(img, x, y), fondo) < soglia) continue;
      quanti += 1;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  if (quanti === 0) return null;
  return { x: x0, y: y0, larghezza: x1 - x0 + 1, altezza: y1 - y0 + 1, quanti };
}

/** Il rapporto di contrasto WCAG fra due colori. Sotto 4,5 un testo si fatica. */
export function contrasto(a: readonly number[], b: readonly number[]): number {
  const luminanza = (c: readonly number[]) => {
    const canale = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * canale(c[0]) + 0.7152 * canale(c[1]) + 0.0722 * canale(c[2]);
  };
  const la = luminanza(a);
  const lb = luminanza(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
