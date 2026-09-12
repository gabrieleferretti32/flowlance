#!/usr/bin/env node
/**
 * Il simulatore pubblico non arriva all'archivio. Per costruzione, non per
 * buona volontà.
 *
 *   npm run verifica:import-simulatore
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Che cosa promette la pagina, e chi la tiene
 * ─────────────────────────────────────────────────────────────────────────
 *
 * In cima a `/simulatore` c'è scritto che i numeri restano lì: non partono,
 * non si salvano. È la frase che decide se una persona scrive il proprio
 * fatturato in un campo di un sito che non conosce, ed è quindi la frase che
 * va tenuta da qualcosa di più solido di un'intenzione.
 *
 * Basterebbe un import distratto — un helper comodo che sta in `@/lib/dati`,
 * una funzione di formattazione presa dal file sbagliato — perché Dexie
 * finisca nel bundle della pagina. E Dexie, appena importato, **apre il
 * database**: la promessa diventerebbe falsa senza che una riga di
 * interfaccia cambi, senza che un test sui numeri se ne accorga, e senza che
 * nessuno lo veda guardando lo schermo.
 *
 * Perciò qui si legge il grafo degli import a partire dalla pagina, si segue
 * fino in fondo, e si fallisce se si arriva all'archivio o a Dexie. È un
 * controllo statico: non prova che a runtime non succeda nulla — quello lo
 * dice `verifica-consenso` sulla rete — prova che il codice per farlo
 * succedere non è nemmeno arrivato nella pagina.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Prima di misurare, si misura la misura
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un risolutore di percorsi che sbaglia un'estensione visita zero file e
 * dichiara tutto pulito, con la stessa faccia. Quindi il controllo prima
 * verifica di **vedere** l'archivio quando c'è: parte da una schermata
 * dell'applicazione, che a `@/lib/dati/db` ci arriva davvero, e pretende di
 * trovarcelo. Se non lo trova lì, non ha senso credergli altrove.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const RADICE = resolve(".");
const SORGENTE = join(RADICE, "src");

/** Da dove si parte, e che cosa non si deve poter raggiungere. */
const PAGINA = "src/app/(sito)/simulatore/page.tsx";
const VIETATI = [
  { frammento: "src/lib/dati/db", perche: "è l'archivio IndexedDB" },
  { frammento: "src/lib/dati/azioni", perche: "scrive nell'archivio" },
  { frammento: "src/lib/licenza", perche: "è la chiave di licenza" },
];
/** Pacchetti che non devono entrare: Dexie apre il database appena importato. */
const PACCHETTI_VIETATI = ["dexie", "dexie-react-hooks"];

/** Una schermata dell'app, che all'archivio ci arriva: serve a provare la misura. */
const CONTROPROVA = "src/app/app/fatture/page.tsx";

const ESTENSIONI = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

function risolvi(specificatore, daFile) {
  if (specificatore.startsWith("@/")) {
    return candidati(join(SORGENTE, specificatore.slice(2)));
  }
  if (specificatore.startsWith(".")) {
    return candidati(resolve(dirname(daFile), specificatore));
  }
  return null; // un pacchetto: non si segue, si guarda soltanto il nome
}

function candidati(base) {
  for (const e of ESTENSIONI) {
    if (existsSync(base + e) && statSync(base + e).isFile()) return base + e;
  }
  for (const e of ESTENSIONI) {
    const indice = join(base, `index${e}`);
    if (existsSync(indice)) return indice;
  }
  if (existsSync(base) && statSync(base).isFile()) return base;
  return null;
}

const IMPORT = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g;
const IMPORT_SECCO = /(?:^|\n)\s*import\s*["']([^"']+)["']/g;
const DINAMICO = /import\(\s*["']([^"']+)["']\s*\)/g;

/**
 * Tutto quello che una pagina si porta dietro, in profondità.
 *
 * Restituisce i file visitati e i pacchetti nominati: i secondi servono perché
 * `dexie` non è un file del progetto e non comparirebbe fra i primi.
 */
function chiusura(ingresso) {
  const visti = new Set();
  const pacchetti = new Set();
  const coda = [resolve(RADICE, ingresso)];

  while (coda.length > 0) {
    const file = coda.pop();
    if (!file || visti.has(file)) continue;
    visti.add(file);
    let testo;
    try {
      testo = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const re of [IMPORT, IMPORT_SECCO, DINAMICO]) {
      re.lastIndex = 0;
      for (const m of testo.matchAll(re)) {
        const spec = m[1];
        const risolto = risolvi(spec, file);
        if (risolto) coda.push(risolto);
        else if (!spec.startsWith(".") && !spec.startsWith("@/")) pacchetti.add(spec.split("/")[0]);
      }
    }
  }
  return { file: [...visti].map((f) => relative(RADICE, f).replaceAll("\\", "/")), pacchetti };
}

const problemi = [];
const fatti = [];

// ————————————————————————————————————————————————————————————
// 0 · La misura vede l'archivio quando c'è
// ————————————————————————————————————————————————————————————

const prova = chiusura(CONTROPROVA);
const provaVede =
  prova.file.some((f) => f.includes("src/lib/dati/db")) || prova.pacchetti.has("dexie");
if (!provaVede) {
  console.log(
    `\n  ┌─ La misura non funziona\n`
      + `  │  Partendo da ${CONTROPROVA} — una schermata dell'applicazione, che\n`
      + `  │  all'archivio ci arriva — non ho trovato né src/lib/dati/db né dexie.\n`
      + `  │  Ho visitato ${prova.file.length} file.\n`
      + `  │\n`
      + `  │  Finché è così, «il simulatore non tocca l'archivio» non vorrebbe dire\n`
      + `  │  che non lo tocca: vorrebbe dire che non so vederlo. Non misuro altro.\n`
      + `  └─`,
  );
  process.exit(2);
}
fatti.push(
  `la misura vede l'archivio dove c'è: da ${CONTROPROVA} ci arriva (${prova.file.length} file letti)`,
);

// ————————————————————————————————————————————————————————————
// 1 · E dal simulatore non ci arriva
// ————————————————————————————————————————————————————————————

const sim = chiusura(PAGINA);
fatti.push(`dal simulatore si raggiungono ${sim.file.length} file del progetto`);

for (const { frammento, perche } of VIETATI) {
  const trovati = sim.file.filter((f) => f.includes(frammento));
  if (trovati.length > 0) {
    problemi.push(
      `${PAGINA} arriva a ${frammento} (${perche}), passando per: ${trovati.join(", ")}`,
    );
  } else {
    fatti.push(`non arriva a ${frammento}, che ${perche}`);
  }
}

for (const p of PACCHETTI_VIETATI) {
  if (sim.pacchetti.has(p)) {
    problemi.push(`${PAGINA} importa il pacchetto «${p}»: basta l'import perché il database si apra.`);
  } else {
    fatti.push(`non importa «${p}»`);
  }
}

for (const f of fatti) console.log(`  ok   ${f}`);
for (const p of problemi) console.log(`  NO   ${p}`);
console.log(
  problemi.length === 0
    ? `\n${fatti.length} verificate, 0 fuori posto. Il simulatore non può scrivere da nessuna parte.`
    : `\n${problemi.length} fuori posto: la frase in cima al simulatore non è più vera.`,
);
process.exit(problemi.length === 0 ? 0 : 1);
