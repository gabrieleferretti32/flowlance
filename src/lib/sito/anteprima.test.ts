import { deflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CHIAVE_FIRMA,
  FILE_ANTEPRIMA,
  MAIUSCOLA_MINIMA,
  MINIATURA,
  MISURA,
  PERCORSO_ANTEPRIMA,
  differenzaAnteprima,
  type Firma,
} from "./anteprima";
import { APERTURA } from "./apertura";
import { controlloAnteprima, improntaMarchio, leggiFirma } from "./presidio-anteprima";
import { IMMAGINE_ANTEPRIMA } from "./metadati";
import { contrasto, inchiostro, misurePng, pixel, pixelPng, testiPng } from "./png";

/**
 * L'immagine di anteprima è l'unica cosa del sito che non si vede mai aprendo
 * il sito: compare quando qualcuno incolla un indirizzo in una chat, e se esce
 * sbagliata lo scopre chi riceve il link.
 *
 * Quindi qui non si controlla che il file esista. Si aprono i byte.
 */

// ————————————————————————————————————————————————————————————
// Prima: il metro vede l'inchiostro quando c'è?
// ————————————————————————————————————————————————————————————

/**
 * Un PNG costruito a mano, con dentro una macchia nota.
 *
 * Serve a provare il lettore **prima** di usarlo per misurare l'immagine vera:
 * un decodificatore che sbagliasse a sfiltrare le righe restituirebbe rumore, e
 * il rumore misurato darebbe comunque un numero — un numero plausibile e falso.
 * Qui la macchia è a coordinate note, e la misura deve ritrovarle esatte.
 */
function pngFinto(
  larghezza: number,
  altezza: number,
  macchia: { x: number; y: number; larghezza: number; altezza: number },
): Uint8Array {
  const righe: number[] = [];
  for (let y = 0; y < altezza; y += 1) {
    righe.push(0); // filtro «nessuno»: qui non si comprime, si prova a leggere
    for (let x = 0; x < larghezza; x += 1) {
      const dentro =
        x >= macchia.x
        && x < macchia.x + macchia.larghezza
        && y >= macchia.y
        && y < macchia.y + macchia.altezza;
      righe.push(...(dentro ? [10, 10, 10] : [250, 250, 250]));
    }
  }

  const tavola = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tavola[n] = c >>> 0;
  }
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = tavola[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const pezzo = (tipo: string, dati: Buffer) => {
    const lunghezza = Buffer.alloc(4);
    lunghezza.writeUInt32BE(dati.length);
    const conTipo = Buffer.concat([Buffer.from(tipo, "latin1"), dati]);
    const coda = Buffer.alloc(4);
    coda.writeUInt32BE(crc(conTipo));
    return Buffer.concat([lunghezza, conTipo, coda]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(larghezza, 0);
  ihdr.writeUInt32BE(altezza, 4);
  ihdr[8] = 8; // otto bit per canale
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pezzo("IHDR", ihdr),
    pezzo("IDAT", deflateSync(Buffer.from(righe))),
    pezzo("IEND", Buffer.alloc(0)),
  ]);
}

describe("il metro, prima di misurare", () => {
  const file = pngFinto(40, 20, { x: 7, y: 4, larghezza: 9, altezza: 6 });

  it("legge le misure dall'IHDR", () => {
    expect(misurePng(file)).toMatchObject({ larghezza: 40, altezza: 20, profondita: 8 });
  });

  it("ritrova i pixel che sa che ci sono", () => {
    const img = pixelPng(file);
    expect(pixel(img, 0, 0)).toEqual([250, 250, 250, 255]);
    expect(pixel(img, 7, 4)).toEqual([10, 10, 10, 255]);
    expect(pixel(img, 15, 9)).toEqual([10, 10, 10, 255]);
    expect(pixel(img, 16, 9)).toEqual([250, 250, 250, 255]);
  });

  it("misura la macchia dove sta, e non dove non sta", () => {
    const img = pixelPng(file);
    const zona = { x: 0, y: 0, larghezza: 40, altezza: 20 };
    expect(inchiostro(img, zona, [250, 250, 250])).toEqual({
      x: 7,
      y: 4,
      larghezza: 9,
      altezza: 6,
      quanti: 54,
    });
    // E dove non c'è niente dice che non c'è niente, invece di dire zero.
    expect(inchiostro(img, { x: 0, y: 0, larghezza: 5, altezza: 3 }, [250, 250, 250])).toBeNull();
  });

  it("rifiuta quello che non sa leggere, invece di inventarlo", () => {
    const rotto = new Uint8Array(pngFinto(4, 4, { x: 0, y: 0, larghezza: 1, altezza: 1 }));
    rotto[8 + 8 + 8] = 4; // profondità 4 bit dentro l'IHDR
    expect(() => pixelPng(rotto)).toThrow(/4 bit/);
  });
});

// ————————————————————————————————————————————————————————————
// Poi: l'immagine vera
// ————————————————————————————————————————————————————————————

describe("l'immagine di anteprima, nei suoi byte", () => {
  const file = new Uint8Array(readFileSync(FILE_ANTEPRIMA));
  const misure = misurePng(file);
  const img = pixelPng(file);
  /*
    Il fondo si campiona in alto a destra, dove il disegno non mette niente: è
    il colore vero del file, non quello che credo di aver chiesto.
  */
  const fondo = pixel(img, MISURA.larghezza - 6, 6);

  it("misura davvero 1200 × 630", () => {
    // Non le due costanti: l'IHDR. Un numero in un `export` è un'intenzione.
    expect({ larghezza: misure.larghezza, altezza: misure.altezza }).toEqual({
      larghezza: MISURA.larghezza,
      altezza: MISURA.altezza,
    });
  });

  it("è il file che i metadati dichiarano, con le misure che dichiarano", () => {
    expect(IMMAGINE_ANTEPRIMA).not.toBeNull();
    expect(IMMAGINE_ANTEPRIMA?.percorso).toBe(PERCORSO_ANTEPRIMA);
    expect(`public${IMMAGINE_ANTEPRIMA?.percorso}`).toBe(FILE_ANTEPRIMA);
    expect(IMMAGINE_ANTEPRIMA?.larghezza).toBe(misure.larghezza);
    expect(IMMAGINE_ANTEPRIMA?.altezza).toBe(misure.altezza);
  });

  it("porta dentro la firma di chi l'ha disegnata", () => {
    expect(Object.keys(testiPng(file))).toContain(CHIAVE_FIRMA);
    const firma = leggiFirma();
    expect(firma?.titolo).toEqual(APERTURA.titolo);
    expect(firma?.occhiello).toBe(APERTURA.occhiello);
    expect(firma?.marchio).toBe(improntaMarchio());
  });

  it("dice ancora quello che dice la landing di oggi", () => {
    expect(controlloAnteprima()).toBeNull();
  });

  /**
   * La domanda vera: **si legge a dimensione di miniatura?**
   *
   * «Il file esiste ed è 1200 × 630» non la sfiora nemmeno: un'immagine di
   * quelle misure con il titolo a 20 px sarebbe grande uguale e illeggibile in
   * una chat. Qui si misura l'altezza dell'inchiostro della prima riga del
   * titolo — l'altezza vera dei segni disegnati, non il corpo richiesto — e si
   * confronta con quanto resta dopo che l'anteprima è stata rimpicciolita a
   * 400 px di larghezza.
   */
  it("il titolo resta leggibile quando l'immagine diventa una miniatura", () => {
    const firma = leggiFirma() as Firma;
    const quanteRighe = firma.titolo.length;
    const altezzaRiga = firma.riquadro.altezza / quanteRighe;
    const primaRiga = inchiostro(
      img,
      { ...firma.riquadro, y: firma.riquadro.y, altezza: Math.round(altezzaRiga) },
      fondo,
    );
    expect(primaRiga, "nel riquadro del titolo non c'è inchiostro").not.toBeNull();

    const alta = primaRiga!.altezza;
    const inMiniatura = (alta * MINIATURA.larghezza) / MISURA.larghezza;
    expect(
      alta,
      `l'inchiostro della prima riga è alto ${alta} px su ${MISURA.larghezza}: `
        + `a ${MINIATURA.larghezza} px di miniatura diventano ${inMiniatura.toFixed(1)} px`,
    ).toBeGreaterThanOrEqual(MAIUSCOLA_MINIMA);
  });

  it("il titolo ha contrasto sul fondo, non solo dimensione", () => {
    const firma = leggiFirma() as Firma;
    // Il pixel più lontano dal fondo dentro il titolo: il cuore pieno di un segno.
    let piuScuro = fondo;
    let quanto = 0;
    for (let y = firma.riquadro.y; y < firma.riquadro.y + firma.riquadro.altezza; y += 2) {
      for (let x = firma.riquadro.x; x < firma.riquadro.x + firma.riquadro.larghezza; x += 2) {
        const p = pixel(img, x, y);
        const d = Math.hypot(p[0] - fondo[0], p[1] - fondo[1], p[2] - fondo[2]);
        if (d > quanto) {
          quanto = d;
          piuScuro = p;
        }
      }
    }
    expect(contrasto(piuScuro, fondo)).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * I bordi restano sgombri.
   *
   * Le anteprime vengono ritagliate: chi mostra 1200 × 630 esatti è la
   * minoranza, e qualche pixel sui lati se ne va quasi sempre. Il testo deve
   * stare lontano dal taglio. La barra d'accento a sinistra è l'eccezione
   * voluta — è fatta apposta per essere tagliata.
   */
  it("niente testo appiccicato ai bordi, dove il ritaglio lo mangia", () => {
    const margine = 16;
    const barra = 12;
    const zone = {
      "in alto": { x: barra, y: 0, larghezza: MISURA.larghezza - barra, altezza: margine },
      "in basso": {
        x: barra,
        y: MISURA.altezza - margine,
        larghezza: MISURA.larghezza - barra,
        altezza: margine,
      },
      "a destra": {
        x: MISURA.larghezza - margine,
        y: 0,
        larghezza: margine,
        altezza: MISURA.altezza,
      },
    };
    for (const [dove, zona] of Object.entries(zone)) {
      expect(inchiostro(img, zona, fondo), `c'è inchiostro ${dove}, contro il bordo`).toBeNull();
    }
  });
});

// ————————————————————————————————————————————————————————————
// E il presidio: se ne accorge, quando c'è di che accorgersi?
// ————————————————————————————————————————————————————————————

describe("il presidio sull'immagine", () => {
  const buona = (): Firma => ({
    occhiello: APERTURA.occhiello,
    titolo: APERTURA.titolo.map((r) => ({ ...r })),
    marchio: improntaMarchio(),
    corpo: 74,
    riquadro: { x: 72, y: 270, larghezza: 800, altezza: 160 },
  });

  it("tace quando l'immagine è quella giusta", () => {
    expect(differenzaAnteprima(buona(), improntaMarchio())).toBeNull();
  });

  it("parla se il titolo della landing è cambiato", () => {
    const vecchia = buona();
    vecchia.titolo[0] = { testo: "Sul conto hai 40.000 €." };
    expect(differenzaAnteprima(vecchia, improntaMarchio())).toMatch(/titolo/);
  });

  it("parla anche se cambia solo quale riga è colorata", () => {
    const vecchia = buona();
    vecchia.titolo = vecchia.titolo.map((r) => ({ testo: r.testo }));
    expect(differenzaAnteprima(vecchia, improntaMarchio())).toMatch(/titolo/);
  });

  it("parla se l'occhiello è cambiato", () => {
    expect(differenzaAnteprima({ ...buona(), occhiello: "Altro" }, improntaMarchio())).toMatch(
      /occhiello/,
    );
  });

  it("parla se il marchio è stato ridisegnato dopo", () => {
    expect(differenzaAnteprima(buona(), "000000000000")).toMatch(/marchio/);
  });

  it("parla se l'immagine non c'è proprio", () => {
    expect(differenzaAnteprima(null, improntaMarchio())).toMatch(/manca/);
  });
});

/**
 * Il generatore è un `.mjs` e le costanti stanno in TypeScript: due file che
 * devono dire gli stessi numeri e gli stessi percorsi. È una seconda copia, e
 * le seconde copie di questo progetto divergono sempre — a meno che qualcuno
 * le guardi insieme. Questo è quel qualcuno.
 */
describe("il generatore e le costanti dicono la stessa cosa", () => {
  const sorgente = readFileSync("strumenti/immagine-anteprima.mjs", "utf8");

  it.each([
    ["le misure", `larghezza: ${MISURA.larghezza}, altezza: ${MISURA.altezza}`],
    ["il file da scrivere", `"${FILE_ANTEPRIMA}"`],
    ["la chiave della firma", `"${CHIAVE_FIRMA}"`],
  ])("%s", (_, atteso) => {
    expect(sorgente).toContain(atteso);
  });
});
