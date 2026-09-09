#!/usr/bin/env node
/**
 * Ogni link interno del sito costruito porta da qualche parte.
 *
 *   npm run build                        # lo esegue da solo in coda a next build
 *   node strumenti/verifica-link.mjs     # su un out/ già costruito
 *
 * Lo spostamento dell'app sotto `/app` è il tipo di modifica che rompe **in
 * silenzio**: un `href="/fatture"` rimasto indietro compila, passa i test, e
 * in produzione mostra la pagina di errore dell'hosting. Il compilatore non
 * può vederlo — per lui è una stringa — e nessun test di unità apre una pagina.
 *
 * Perché serve un browser, e non basta leggere l'HTML. Le schermate dell'app
 * stanno dentro `SoloClient`: l'HTML esportato contiene un segnaposto, e la
 * navigazione — la barra laterale, cioè quasi tutti i link interni del
 * prodotto — nasce dopo il montaggio. Un controllo che legga i file `.html`
 * trova cinque link per pagina, tutti fogli di stile, e dichiara che va tutto
 * bene. Questo apre le pagine per davvero e legge il DOM vivo.
 *
 * Cosa **non** vede: le navigazioni fatte da codice (`router.push`), che non
 * sono link finché qualcuno non preme. Quelle le tiene la regola
 * `no-restricted-syntax` di eslint, che vieta di scrivere un percorso a mano:
 * le due cose si dividono il lavoro, il sorgente a una e il sito all'altra.
 *
 * Esce con codice 1 al primo link morto, così un build in CI si ferma.
 *
 * Opzioni:
 *   --cartella=out          la cartella da servire
 *   --chromium=percorso     un binario diverso da Chrome di sistema
 */
import { createServer } from "node:http";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { chromium } from "playwright-core";

const opzione = (nome, predefinito = "") => {
  const trovata = process.argv.slice(2).find((a) => a.startsWith(`--${nome}=`));
  return trovata ? trovata.slice(nome.length + 3) : predefinito;
};

const RADICE = resolve(opzione("cartella", "out"));
const BINARIO = opzione("chromium", process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium");

try {
  statSync(RADICE);
} catch {
  console.error(`Non trovo ${RADICE}. Esegui prima «next build».`);
  process.exit(1);
}

// ————————————————————————————————————————————————————————————
// Le pagine costruite, e come si chiamano da fuori
// ————————————————————————————————————————————————————————————

function html(cartella, trovate = []) {
  for (const voce of readdirSync(cartella, { withFileTypes: true })) {
    const percorso = join(cartella, voce.name);
    if (voce.isDirectory()) html(percorso, trovate);
    else if (voce.name.endsWith(".html")) trovate.push(percorso);
  }
  return trovate;
}

/** `out/app/fatture/index.html` → `/app/fatture/`. */
const indirizzoDi = (file) =>
  "/" + relative(RADICE, file).replaceAll("\\", "/").replace(/index\.html$/, "").replace(/\.html$/, "/");

/** C'è un file dall'altra parte? Una pagina è la sua cartella con dentro `index.html`. */
function esiste(indirizzo) {
  const nudo = decodeURIComponent(indirizzo).replace(/\/$/, "");
  const candidati = [
    join(RADICE, nudo, "index.html"),
    join(RADICE, `${nudo}.html`),
    join(RADICE, nudo),
  ];
  return candidati.some((c) => {
    try {
      return statSync(c).isFile();
    } catch {
      return false;
    }
  });
}

// ————————————————————————————————————————————————————————————
// Un server statico che si comporta come l'hosting
// ————————————————————————————————————————————————————————————

const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

const server = createServer((req, res) => {
  const percorso = decodeURIComponent(req.url.split("?")[0]);
  const nudo = percorso.replace(/\/$/, "");
  for (const candidato of [join(RADICE, nudo, "index.html"), join(RADICE, `${nudo}.html`), join(RADICE, nudo)]) {
    try {
      if (!statSync(candidato).isFile()) continue;
      res.writeHead(200, { "content-type": TIPI[extname(candidato)] ?? "application/octet-stream" });
      res.end(readFileSync(candidato));
      return;
    } catch {
      // il candidato successivo
    }
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("non trovato");
});

await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const BASE = `http://127.0.0.1:${server.address().port}`;

// ————————————————————————————————————————————————————————————
// Apertura di ogni pagina, e raccolta dei link veri
// ————————————————————————————————————————————————————————————

const pagine = html(RADICE).map(indirizzoDi).sort();
const browser = await chromium.launch(BINARIO ? { executablePath: BINARIO } : { channel: "chrome" });
const contesto = await browser.newContext();
const pagina = await contesto.newPage();

const rotti = [];
const vuote = [];
let contati = 0;

for (const indirizzo of pagine) {
  await pagina.goto(BASE + indirizzo, { waitUntil: "networkidle" });
  // Il guscio compare dopo il montaggio: senza attenderlo si leggerebbe il
  // segnaposto, che di link non ne ha nessuno.
  await pagina.waitForSelector("a[href], main", { timeout: 15_000 }).catch(() => {});

  const { collegamenti, testo } = await pagina.evaluate(() => ({
    collegamenti: [
      ...document.querySelectorAll("a[href]"),
      ...document.querySelectorAll("img[src], source[src]"),
    ].map((n) => n.getAttribute("href") ?? n.getAttribute("src")),
    testo: (document.body.innerText ?? "").trim().length,
  }));

  // Una pagina che si apre bianca è rotta anche senza link rotti.
  if (testo === 0) vuote.push(indirizzo);

  for (const grezzo of new Set(collegamenti)) {
    if (!grezzo || !grezzo.startsWith("/") || grezzo.startsWith("//")) continue;
    const pulito = grezzo.split("#")[0].split("?")[0];
    if (pulito === "") continue;
    contati++;
    if (!esiste(pulito)) rotti.push({ da: indirizzo, a: pulito });
  }
}

await browser.close();
server.close();

console.log(`${pagine.length} pagine aperte, ${contati} collegamenti interni verificati.`);
console.log(pagine.map((i) => `  ${i}`).join("\n"));

if (vuote.length > 0) {
  console.error(`\n${vuote.length} pagine si aprono senza contenuto:`);
  for (const v of vuote) console.error(`  ${v}`);
}

if (rotti.length > 0) {
  console.error(`\n${rotti.length} collegamenti non portano da nessuna parte:`);
  for (const r of rotti) console.error(`  ${r.da} → ${r.a}`);
  console.error("\nSe è una rotta dell'app, il posto da cui prenderla è `ROTTE` in src/lib/rotte.ts.");
}

if (rotti.length > 0 || vuote.length > 0) process.exit(1);
console.log("\nNessun collegamento rotto, nessuna pagina vuota.");
