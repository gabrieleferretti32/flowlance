#!/usr/bin/env node
/**
 * Le icone dell'app installata, **derivate dal marchio** e non disegnate a mano.
 *
 *   node strumenti/icone.mjs
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché uno strumento e non quattro file
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `src/app/icon.svg` è il marchio, ed è l'unico posto in cui esiste. Le icone
 * che servono a installare l'app sono quattro rasterizzazioni di quello, a
 * misure e con regole diverse — e quattro PNG disegnati a mano sono quattro
 * copie che il giorno in cui il marchio cambia restano indietro. Restano
 * indietro in silenzio, per giunta: nessuno riapre l'icona di un'app già
 * installata per controllare se somiglia ancora al logo del sito.
 *
 * Qui si generano tutte e quattro dallo stesso SVG, e `icone.test.mjs`
 * fallisce se il marchio cambia senza che siano state rifatte.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le quattro, e perché sono diverse fra loro
 * ─────────────────────────────────────────────────────────────────────────
 *
 * — **192 e 512, `purpose: "any"`.** Il marchio così com'è, angoli arrotondati
 *   compresi. Sono le misure che Chrome cerca nel manifest; un SVG `sizes:
 *   "any"` non basta a tutti i sistemi.
 *
 * — **512 `maskable`.** Android ritaglia l'icona nella forma del suo tema —
 *   cerchio, goccia, quadrato stondato — e quello che sta fuori sparisce.
 *   Quindi lo sfondo riempie **tutto** il quadrato, senza angoli arrotondati
 *   (li aggiunge il sistema), e il marchio sta dentro la zona sicura: il
 *   cerchio centrale con l'80 % del lato. Senza questa, Android incolla
 *   l'icona con i suoi angoli dentro un cerchio bianco, e si vede.
 *
 * — **`apple-icon.png`, 180.** iOS non arrotonda niente e non aggiunge
 *   margine: maschera a squircle quasi al vivo. Quindi di nuovo sfondo pieno,
 *   ma il marchio più grande di quello maskable. Il nome è una convenzione di
 *   Next — verificata in `node_modules/next/dist/lib/metadata/is-metadata-route.js`,
 *   dove `apple-icon` è fra le immagini di metadati riconosciute — e da lì
 *   esce il `<link rel="apple-touch-icon">` su tutte le pagine.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const MARCHIO = "src/app/icon.svg";
const STAMPO = "strumenti/icone.json";

/** Il riquadro del glifo dentro il viewBox 32×32 del marchio. */
const GLIFO = { x: 9, y: 8, larghezza: 14, altezza: 16 };
/** Lo sfondo del marchio, ripetuto qui perché le maskable lo stendono a tutto campo. */
const SFONDO = "#141A33";

/**
 * Il marchio a tutto campo, con il glifo centrato e grande `quota` del lato.
 *
 * `quota` è la frazione del lato che il glifo occupa in altezza: 0,55 per
 * Android, che ritaglia parecchio, 0,62 per iOS, che ritaglia poco.
 */
function marchioPieno(lato, quota) {
  const rette = readFileSync(resolve(MARCHIO), "utf8")
    .split("\n")
    .filter((r) => r.includes("<rect") && !r.includes('width="32"'))
    .join("\n");
  const scala = (lato * quota) / GLIFO.altezza;
  // Porta il centro del glifo (16,16 nel viewBox) al centro del quadrato.
  const sposta = lato / 2 - 16 * scala;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lato}" height="${lato}" viewBox="0 0 ${lato} ${lato}">
  <rect width="${lato}" height="${lato}" fill="${SFONDO}"/>
  <g transform="translate(${sposta},${sposta}) scale(${scala})">
${rette}
  </g>
</svg>`;
}

const DA_FARE = [
  { file: "public/icona-192.png", lato: 192, svg: () => readFileSync(resolve(MARCHIO)) },
  { file: "public/icona-512.png", lato: 512, svg: () => readFileSync(resolve(MARCHIO)) },
  { file: "public/icona-maskable-512.png", lato: 512, pieno: true, svg: () => Buffer.from(marchioPieno(512, 0.55)) },
  { file: "src/app/apple-icon.png", lato: 180, pieno: true, svg: () => Buffer.from(marchioPieno(180, 0.62)) },
];

const marchio = readFileSync(resolve(MARCHIO));
const impronta = createHash("sha256").update(marchio).digest("hex");

for (const { file, lato, pieno, svg } of DA_FARE) {
  /*
    Le due a tutto campo escono **senza canale alfa**. Visivamente non cambia
    niente — lo sfondo copre già ogni pixel — ma iOS, davanti a un
    apple-touch-icon con trasparenza, compone su nero invece che sul colore
    dichiarato: un'icona giusta al 100 % di opacità che diventa sbagliata il
    giorno che un pixel del bordo non lo è.
  */
  const disegno = sharp(svg(), { density: 512 })
    .resize(lato, lato, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const png = await (pieno ? disegno.flatten({ background: SFONDO }) : disegno)
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(resolve(file), png);
  console.log(`  ${String(lato).padStart(3)}×${String(lato).padEnd(3)}  ${file}  (${png.length} byte)`);
}

writeFileSync(
  resolve(STAMPO),
  `${JSON.stringify({ sorgente: MARCHIO, impronta, file: DA_FARE.map((d) => d.file) }, null, 2)}\n`,
);
console.log(`\nMarchio: ${impronta.slice(0, 16)}… — scritto in ${STAMPO}.`);
