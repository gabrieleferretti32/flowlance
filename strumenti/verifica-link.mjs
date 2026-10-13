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
import { avviaChromium } from "./chromium.mjs";
import { esigiArtefattoFresco } from "./artefatto.mjs";

// Prima di ogni altra cosa: out/ è il sito del sorgente di adesso?
esigiArtefattoFresco();

const opzione = (nome, predefinito = "") => {
  const trovata = process.argv.slice(2).find((a) => a.startsWith(`--${nome}=`));
  return trovata ? trovata.slice(nome.length + 3) : predefinito;
};

const RADICE = resolve(opzione("cartella", "out"));

/**
 * Il nostro dominio, letto dal sorgente.
 *
 * Non scritto qui: sta in `src/lib/sito/impostazioni.ts`, ed è lo stesso da cui
 * lo prendono il contratto e i metadati. Una copia qui dentro resterebbe
 * indietro il giorno del cambio, e questo controllo smetterebbe di guardare gli
 * indirizzi assoluti senza dire niente — tornerebbe a dire «nessun link rotto»
 * su un sito con dentro i rinvii al dominio di prima.
 */
const DOMINIO = (() => {
  const testo = readFileSync(resolve("src/lib/sito/impostazioni.ts"), "utf8");
  const trovato = testo.match(/export const DOMINIO\s*=\s*"([^"]+)"/);
  if (!trovato) {
    console.error("src/lib/sito/impostazioni.ts: non trovo DOMINIO. Gli indirizzi assoluti non si possono verificare.");
    process.exit(1);
  }
  return trovato[1].replace(/\/$/, "");
})();

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
      const stato = statSync(c);
      /*
        Non basta che il file ci sia: deve avere qualcosa dentro. Il PDF dei
        Termini viene generato dal build, e la prima stesura del generatore ne
        scriveva uno da **zero byte** — un link che non è rotto, un file che si
        scarica, e dentro niente. Un controllo di sola esistenza l'avrebbe
        promosso.
      */
      return stato.isFile() && stato.size > 0;
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
const browser = await avviaChromium();
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
    if (!grezzo) continue;
    /*
      Anche gli indirizzi **assoluti** del nostro dominio.

      Il contratto scrive l'indirizzo per esteso — «flowlance.it/requisiti-tecnici/» —
      perché il PDF non ha link e sul foglio deve restare qualcosa da copiare a
      mano. Un `https://flowlance.it/...` però non comincia con `/`, e per
      questo controllo era invisibile: il punto 8 ha nominato per un mese una
      pagina che non esisteva, e niente lo ha detto.
    */
    const nostro = grezzo.startsWith(DOMINIO) ? grezzo.slice(DOMINIO.length) || "/" : null;
    const interno = grezzo.startsWith("/") && !grezzo.startsWith("//") ? grezzo : nostro;
    if (!interno) continue;
    const pulito = interno.split("#")[0].split("?")[0];
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

/*
  ─────────────────────────────────────────────────────────────────────────
  E nessuna pagina porta a una versione vecchia dei Termini
  ─────────────────────────────────────────────────────────────────────────

  I PDF delle versioni passate restano in `public/`, e devono: il punto 12 dice
  che per le licenze in corso valgono i termini «nella versione indicata in
  testa al documento trasmesso», quindi il documento di chi ha comprato ieri
  non si cancella.

  Ma restare non vuol dire essere linkati. Un collegamento rimasto alla
  versione vecchia **non è un link rotto** — il file c'è, la pagina si apre, il
  PDF si scarica — ed è il motivo per cui il controllo qui sopra non lo vede.
  È il caso peggiore di tutti: chi clicca scarica un contratto diverso da
  quello che sta accettando, e niente lo segnala.

  Qui si guarda l'altra cosa: che fra i PDF dei Termini nominati dalle pagine
  non ce ne sia nessuno che non sia quello corrente.
*/
const CORRENTE = (() => {
  const testa = readFileSync(resolve("contenuti/termini.md"), "utf8");
  const trovata = testa.match(/^\*Versione\s+(\d+)\s*[—–-]/m);
  return trovata ? trovata[1] : null;
})();

const vecchie = [];
if (CORRENTE === null) {
  vecchie.push("contenuti/termini.md: non trovo la riga «*Versione N — data*»");
} else {
  for (const file of html(RADICE)) {
    const testo = readFileSync(file, "utf8");
    for (const m of testo.matchAll(/flowlance-termini-v(\d+)\.pdf/g)) {
      if (m[1] !== CORRENTE) {
        vecchie.push(`${indirizzoDi(file)} → flowlance-termini-v${m[1]}.pdf (corrente: v${CORRENTE})`);
      }
    }
  }
}

if (vecchie.length > 0) {
  console.error(`\n${vecchie.length} collegamenti portano a una versione vecchia dei Termini:`);
  for (const v of [...new Set(vecchie)]) console.error(`  ${v}`);
  console.error(
    "\nIl file vecchio resta dov'è — serve a chi l'ha accettato — ma nessuna pagina\n"
      + "deve portarci: chi clicca scaricherebbe un contratto diverso da quello che accetta.",
  );
}

if (rotti.length > 0 || vuote.length > 0 || vecchie.length > 0) process.exit(1);
console.log(`\nNessun collegamento rotto, nessuna pagina vuota, nessun rimando a una versione vecchia dei Termini (corrente: v${CORRENTE}).`);
