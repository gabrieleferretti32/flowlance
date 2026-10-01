#!/usr/bin/env node
/**
 * Le schermate del sito in WebP, alla misura in cui si vedono.
 *
 *   node strumenti/immagine-webp.mjs
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché a mano, e non dentro il build
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `next.config.ts` ha `images: { unoptimized: true }`, obbligatorio con
 * `output: "export"`: non c'è nessun server che ridimensioni o cambi formato a
 * runtime, quindi `next/image` consegna **il file così com'è**. Il PNG del
 * cruscotto è 2880 × 1800 e pesa 580 KB, e su una pagina che arriva dalla
 * pubblicità — cioè quasi sempre da un telefono in mezzo alla strada — è di
 * gran lunga la cosa più pesante che si scarica, per mostrarla larga 343 px.
 *
 * Questo strumento produce il file giusto una volta, e lo si versiona. Non sta
 * dentro `npm run build` di proposito: `sharp` arriva come dipendenza di Next,
 * non è dichiarata da noi, e un build che si fermasse il giorno in cui Next la
 * sostituisce sarebbe un build rotto per un'immagine. Se un giorno `sharp` non
 * c'è più, questo script lo dice quando lo si lancia — e l'immagine, intanto, è
 * già nel repository.
 *
 * Le misure: 1760 px di larghezza, cioè il doppio dei ~880 px a cui la
 * schermata si vede al massimo sul desktop. Il doppio e non il triplo: oltre il
 * 2× la differenza su uno schermo retina non si vede, e i byte sì.
 */
import { createRequire } from "node:module";
import { statSync } from "node:fs";

const require = createRequire(import.meta.url);

let sharp;
try {
  sharp = require("sharp");
} catch {
  console.error(
    "Non trovo «sharp». Arriva come dipendenza di Next: prova «npm ci».\n"
      + "Se Next non la porta più, le immagini già prodotte restano valide:\n"
      + "questo strumento serve solo a rifarle.",
  );
  process.exit(1);
}

/** Che cosa si converte, e a quale larghezza. */
const LAVORI = [
  { da: "public/schermate/cruscotto.png", a: "public/schermate/cruscotto.webp", larghezza: 1760 },
];

const kb = (percorso) => Math.round(statSync(percorso).size / 1024);

for (const { da, a, larghezza } of LAVORI) {
  const prima = kb(da);
  const info = await sharp(da)
    .resize({ width: larghezza, withoutEnlargement: true })
    /*
      Qualità 80 e `effort` al massimo: su una schermata di interfaccia — campi
      pieni di testo piccolo e di linee sottili — sotto l'80 il WebP comincia a
      sporcare i bordi delle cifre, e le cifre sono il contenuto. `effort: 6`
      costa secondi a chi lancia questo script e byte a nessuno.
    */
    .webp({ quality: 80, effort: 6 })
    .toFile(a);
  console.log(
    `${da} (${prima} KB) → ${a} (${kb(a)} KB) · ${info.width} × ${info.height}`,
  );
}
