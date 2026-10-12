#!/usr/bin/env node
/**
 * Il registro delle prove non si raggiunge da chi manda email.
 *
 *   node strumenti/verifica-registro.mjs
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Che cosa separa, e perché la separazione è il punto
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il registro contiene indirizzi email, e li contiene **per una finalità
 * sola**: dimostrare che un consenso c'è stato. L'informativa lo dice —
 * «conservati separatamente e non utilizzati per alcuna comunicazione».
 *
 * Una frase del genere la tiene la struttura o non la tiene niente. Basta un
 * import comodo — «mi serve l'elenco degli iscritti, il registro ce l'ha» —
 * perché un elenco raccolto come prova diventi una lista di invio: nessun
 * errore, nessuna riga storta, e un'informativa che dice il falso.
 *
 * Quindi si legge il grafo degli import a partire da **chi manda** e da **chi
 * sta in pagina**, e si fallisce se si arriva al registro.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Prima di misurare, si misura la misura
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un risolutore che sbaglia un'estensione visita zero file e dichiara tutto
 * pulito, con la stessa faccia. Perciò si parte anche da `api/pulizia.ts`,
 * che al registro ci arriva davvero, e si pretende di trovarcelo: se non lo
 * trova lì, non ha senso credergli altrove.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const RADICE = resolve(".");
const SORGENTE = join(RADICE, "src");

/** Chi manda email, e la pagina che le chiede. Da qui il registro non si vede. */
const ORIGINI = [
  { file: "api/promemoria.ts", cosa: "la funzione che iscrive e manda la conferma" },
  { file: "src/app/(sito)/simulatore/page.tsx", cosa: "la pagina pubblica" },
];

const VIETATI = [
  { frammento: "src/lib/sito/registro-prove", perche: "è il registro delle prove" },
  { frammento: "src/lib/sito/registro-blob", perche: "è il magazzino delle prove" },
];

/** Chi al registro ci arriva per mestiere: serve a provare che la misura vede. */
const CONTROPROVA = { file: "api/pulizia.ts", frammento: "src/lib/sito/registro-prove" };

const ESTENSIONI = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

function candidati(base) {
  const prove = [base, ...ESTENSIONI.map((e) => `${base}${e}`), ...ESTENSIONI.map((e) => join(base, `index${e}`))];
  for (const p of prove) {
    try {
      if (statSync(p).isFile()) return p;
    } catch {
      // il candidato successivo
    }
  }
  return null;
}

function risolvi(specificatore, daFile) {
  if (specificatore.startsWith("@/")) return candidati(join(SORGENTE, specificatore.slice(2)));
  if (specificatore.startsWith(".")) return candidati(resolve(dirname(daFile), specificatore));
  return null; // un pacchetto: non si segue
}

/**
 * Tutti i file raggiungibili da un punto di partenza.
 *
 * Gli import di solo tipo si saltano: `import type { X } from "..."` sparisce
 * in compilazione e non porta dentro niente. Gli altri si seguono tutti,
 * compreso `import { type X }` — che la parola `type` dentro le graffe non
 * basta a cancellare la riga.
 */
function chiusura(partenza) {
  const visti = new Set();
  const coda = [resolve(RADICE, partenza)];
  while (coda.length > 0) {
    const file = coda.pop();
    if (!file || visti.has(file) || !existsSync(file)) continue;
    visti.add(file);
    const testo = readFileSync(file, "utf8");
    const righe = [
      ...testo.matchAll(/^\s*import\s+(?!type\s)[^;]*?from\s+["']([^"']+)["']/gm),
      ...testo.matchAll(/^\s*export\s+(?!type\s)[^;]*?from\s+["']([^"']+)["']/gm),
      ...testo.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g),
    ];
    for (const m of righe) {
      const risolto = risolvi(m[1], file);
      if (risolto) coda.push(risolto);
    }
  }
  return visti;
}

const problemi = [];
const fatti = [];

// La controprova, prima di tutto.
{
  const raggiunti = [...chiusura(CONTROPROVA.file)].map((f) => relative(RADICE, f));
  const trovato = raggiunti.some((f) => f.replace(/\\/g, "/").includes(CONTROPROVA.frammento));
  if (trovato) {
    fatti.push(`la misura vede il registro dove c'è: da ${CONTROPROVA.file} ci arriva (${raggiunti.length} file letti)`);
  } else {
    problemi.push(
      `la misura NON vede il registro da ${CONTROPROVA.file}, dove ci arriva per mestiere: `
        + "il risolutore è rotto e ogni altro «ok» di questo strumento non vuol dire niente",
    );
  }
}

for (const origine of ORIGINI) {
  const raggiunti = [...chiusura(origine.file)].map((f) => relative(RADICE, f).replace(/\\/g, "/"));
  fatti.push(`da ${origine.file} (${origine.cosa}) si raggiungono ${raggiunti.length} file`);
  for (const { frammento, perche } of VIETATI) {
    const trovati = raggiunti.filter((f) => f.includes(frammento));
    if (trovati.length > 0) {
      problemi.push(`${origine.file} arriva a ${frammento} (${perche}): ${trovati.join(", ")}`);
    } else {
      fatti.push(`  non arriva a ${frammento}, che ${perche}`);
    }
  }
}

for (const f of fatti) console.log(`  ok   ${f}`);
for (const p of problemi) console.log(`  NO   ${p}`);

if (problemi.length > 0) {
  console.log(
    `\n${problemi.length} fuori posto: l'informativa dice che le prove non si usano `
      + "per comunicare, e quella frase la tiene questa separazione.",
  );
  process.exit(1);
}
console.log(`\n${fatti.length} verificate, 0 fuori posto. Le prove restano prove.`);
