import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";

/**
 * Le icone dell'app installata sono ancora quelle del marchio.
 *
 * Il difetto da prendere non è «manca un file»: è che qualcuno ritocchi
 * `src/app/icon.svg` e le quattro PNG restino quelle di prima. Nessuno riapre
 * l'icona di un'app già installata per controllare se somiglia ancora al logo
 * del sito, quindi la divergenza starebbe lì per mesi.
 *
 * Il confronto è sull'**impronta del marchio**, non sui byte dei PNG: la
 * rasterizzazione dipende dalla versione della libreria che la fa, e un
 * confronto byte a byte fallirebbe su una macchina diversa dicendo «le icone
 * sono vecchie» quando invece sono giuste. Qui si verifica l'unica cosa che
 * conta davvero — che siano state rifatte dopo l'ultima modifica al marchio —
 * più forma e misura di quello che è stato scritto.
 */
const stampo = JSON.parse(readFileSync("strumenti/icone.json", "utf8"));

describe("le icone dell'app installata", () => {
  it("sono state rifatte dopo l'ultima modifica al marchio", () => {
    const adesso = createHash("sha256").update(readFileSync(stampo.sorgente)).digest("hex");
    expect(
      adesso,
      `${stampo.sorgente} è cambiato dopo l'ultima generazione delle icone.\n`
        + "Rilancia «node strumenti/icone.mjs» e ricommetti i PNG.",
    ).toBe(stampo.impronta);
  });

  const attese = [
    { file: "public/icona-192.png", lato: 192, pieno: false },
    { file: "public/icona-512.png", lato: 512, pieno: false },
    { file: "public/icona-maskable-512.png", lato: 512, pieno: true },
    { file: "src/app/apple-icon.png", lato: 180, pieno: true },
  ];

  it("sono tutte e quattro quelle che il manifest e Next si aspettano", () => {
    expect(stampo.file.sort()).toEqual(attese.map((a) => a.file).sort());
  });

  it.each(attese)("$file è un PNG di $lato px", async ({ file, lato }) => {
    const m = await sharp(file).metadata();
    expect(m.format).toBe("png");
    expect([m.width, m.height]).toEqual([lato, lato]);
  });

  /*
    Le due a tutto campo devono esserlo davvero.

    Android ritaglia la maskable nella forma del suo tema: un angolo
    trasparente diventa un angolo bianco dentro il cerchio, ed è esattamente
    l'effetto che questa icona esiste per evitare. iOS, davanti a una
    trasparenza, compone su nero. In tutti e due i casi il difetto si vede solo
    sul dispositivo, dopo l'installazione.
  */
  it.each(attese.filter((a) => a.pieno))("$file non ha un solo pixel trasparente", async ({ file }) => {
    const { data } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let trasparenti = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) trasparenti += 1;
    expect(trasparenti).toBe(0);
  });

  /*
    E il marchio dentro la maskable deve stare nella zona sicura: il cerchio
    centrale con l'80 % del lato. Si misura dove arriva il bianco — il glifo è
    l'unica cosa chiara sullo sfondo scuro — e si verifica che stia dentro.
  */
  it("il marchio della maskable sta dentro la zona sicura di Android", async () => {
    const file = "public/icona-maskable-512.png";
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const chiaro = (i) => data[i] + data[i + 1] + data[i + 2] > 380;
    let piuLontano = 0;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        if (!chiaro((y * info.width + x) * 4)) continue;
        const dx = x - info.width / 2;
        const dy = y - info.height / 2;
        piuLontano = Math.max(piuLontano, Math.hypot(dx, dy));
      }
    }
    const raggioSicuro = (info.width * 0.8) / 2;
    expect(
      piuLontano,
      `il marchio arriva a ${Math.round(piuLontano)} px dal centro, la zona sicura ne ha ${Math.round(raggioSicuro)}`,
    ).toBeLessThan(raggioSicuro);
  });
});
