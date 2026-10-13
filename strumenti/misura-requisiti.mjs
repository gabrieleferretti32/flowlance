#!/usr/bin/env node
/**
 * Che cosa serve davvero per usare Flowlance: misurato, non supposto.
 *
 *   npm run build
 *   npm run misura:requisiti
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché questo strumento esiste
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il punto 8 dei Termini rimanda ai «requisiti tecnici indicati sul sito».
 * Quella pagina è un impegno contrattuale: ogni riga è una cosa che il
 * Fornitore dichiara vera. Scriverla a memoria — «funziona su tutti i browser
 * moderni», «i dati restano finché non li cancelli tu» — vorrebbe dire
 * promettere, in un documento che il contratto richiama, cose che nessuno ha
 * provato.
 *
 * Qui si prova. Ogni misura apre il sito costruito in un browser vero, fa il
 * gesto, e registra **che cosa è successo**. Quello che non si riesce a
 * misurare non finisce sulla pagina: finisce nell'elenco dei controlli da fare
 * a mano.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Un browser solo, e si dice quale
 * ─────────────────────────────────────────────────────────────────────────
 *
 * In questo contenitore c'è **solo Chromium** (`/opt/pw-browsers`), e
 * `playwright install` non si lancia: niente Firefox, niente WebKit. Quindi le
 * righe che questo strumento produce parlano di Chromium e lo dicono. Safari e
 * Firefox restano da provare a mano, su una macchina che li ha.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La chiave di licenza, e perché serve una build con una chiave finta
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Per provare che incollare una chiave attiva l'applicazione serve una chiave
 * **valida**, cioè firmata con la chiave privata di chi vende — che non sta in
 * questo repository, e giustamente. Allora si fa l'unica cosa onesta che resta:
 * si copia `out/` da una parte, si sostituisce nella copia la chiave pubblica
 * con quella di una coppia di prova, e si incolla una licenza firmata con la
 * sua privata.
 *
 * Il codice esercitato è lo stesso — stessa verifica, stessa firma, stesso
 * percorso — e cambia una costante. La copia si butta alla fine, e `out/` non
 * si tocca: lo strumento lo dice nel resoconto, perché una misura fatta su una
 * build modificata va dichiarata ogni volta che la si cita.
 */
import { createServer } from "node:http";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { avviaChromium } from "./chromium.mjs";
import { esigiArtefattoFresco } from "./artefatto.mjs";

esigiArtefattoFresco();

const opzione = (nome, predefinito = "") => {
  const trovata = process.argv.slice(2).find((a) => a.startsWith(`--${nome}=`));
  return trovata ? trovata.slice(nome.length + 3) : predefinito;
};

/** La chiave di prova e la licenza firmata con la sua privata: vedi la testa del file. */
const CHIAVE_DI_PROVA = opzione("chiave-pubblica");
const LICENZA_DI_PROVA = opzione("licenza");

const TIPI = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
};

function servi(radice) {
  const server = createServer((req, res) => {
    const percorso = decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "");
    for (const c of [join(radice, percorso, "index.html"), join(radice, `${percorso}.html`), join(radice, percorso)]) {
      try {
        if (!statSync(c).isFile()) continue;
        res.writeHead(200, { "content-type": TIPI[extname(c)] ?? "application/octet-stream" });
        res.end(readFileSync(c));
        return;
      } catch {
        // il candidato dopo
      }
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("non trovato");
  });
  return server;
}

/** Quanto pesa, in byte, tutto quello che il browser scarica per l'app. */
function pesoDi(cartella) {
  let totale = 0;
  for (const voce of readdirSync(cartella, { withFileTypes: true })) {
    const p = join(cartella, voce.name);
    totale += voce.isDirectory() ? pesoDi(p) : statSync(p).size;
  }
  return totale;
}

const esiti = [];
const prova = (cosa, risultato, dettaglio = "") => {
  esiti.push({ cosa, risultato, dettaglio });
  const segno = risultato === "sì" ? "ok  " : risultato === "no" ? "NO  " : "·   ";
  console.log(`  ${segno} ${cosa}${dettaglio ? ` — ${dettaglio}` : ""}`);
};

// ————————————————————————————————————————————————————————————
// La copia con la chiave di prova
// ————————————————————————————————————————————————————————————

const SORGENTE = resolve("out");
const COPIA = mkdtempSync(join(tmpdir(), "requisiti-"));
cpSync(SORGENTE, COPIA, { recursive: true });

let chiaveSostituita = 0;
if (CHIAVE_DI_PROVA) {
  const vera = readFileSync("src/lib/licenza/chiave-pubblica.ts", "utf8").match(/"([A-Za-z0-9_-]{43})"/)?.[1];
  if (!vera) {
    console.error("Non trovo la chiave pubblica nel sorgente: la prova della chiave si salta.");
  } else {
    const sostituisci = (cartella) => {
      for (const voce of readdirSync(cartella, { withFileTypes: true })) {
        const p = join(cartella, voce.name);
        if (voce.isDirectory()) sostituisci(p);
        else if (/\.(js|txt|html)$/.test(voce.name)) {
          const testo = readFileSync(p, "utf8");
          if (testo.includes(vera)) {
            writeFileSync(p, testo.replaceAll(vera, CHIAVE_DI_PROVA));
            chiaveSostituita += 1;
          }
        }
      }
    };
    sostituisci(COPIA);
  }
}

const server = servi(COPIA);
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const BASE = `http://127.0.0.1:${server.address().port}`;

const profilo = mkdtempSync(join(tmpdir(), "profilo-"));
const browser = await avviaChromium();
const contesto = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const p = await contesto.newPage();

console.log(`\nChromium, sito costruito servito da ${COPIA}\n`);

// ————————————————————————————————————————————————————————————
// 1 · L'applicazione si apre
// ————————————————————————————————————————————————————————————

await p.goto(`${BASE}/app/`, { waitUntil: "networkidle" });
await p.waitForSelector("main", { timeout: 20_000 }).catch(() => {});
const testoApp = (await p.evaluate(() => document.body.innerText)).trim();
prova(
  "l'applicazione si apre e mostra il cruscotto",
  testoApp.length > 200 ? "sì" : "no",
  `${testoApp.length} caratteri a schermo`,
);

// ————————————————————————————————————————————————————————————
// 2 · La chiave di licenza
// ————————————————————————————————————————————————————————————

if (LICENZA_DI_PROVA && chiaveSostituita > 0) {
  await p.goto(`${BASE}/app/licenza/`, { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  const campo = p.locator("textarea, input[type=text]").first();
  await campo.fill(LICENZA_DI_PROVA);
  await p.getByRole("button", { name: /^Attiva$/ }).first().click().catch(() => {});
  await p.waitForTimeout(1500);
  const dopo = await p.evaluate(() => document.body.innerText);
  /*
    Non «contiene la parola attiva»: la scadenza **della licenza incollata**,
    scritta per esteso dall'app. La pagina della licenza la parola «attiva» ce
    l'ha già nel titolo del riquadro, e un controllo su quella avrebbe detto sì
    davanti a qualunque cosa.
  */
  prova(
    "incollare una chiave di licenza attiva l'applicazione",
    /31 dicembre 2027/.test(dopo) ? "sì" : "no",
    `scadenza della licenza a schermo (build con la chiave pubblica di prova, ${chiaveSostituita} file sostituiti)`,
  );
} else {
  prova("incollare una chiave di licenza attiva l'applicazione", "non misurato", "serve --chiave-pubblica= e --licenza=");
}

// ————————————————————————————————————————————————————————————
// 3 · I dati si salvano e si ritrovano
// ————————————————————————————————————————————————————————————

await p.goto(`${BASE}/app/dati/`, { waitUntil: "networkidle" });
await p.waitForTimeout(800);
await p.getByRole("button", { name: /Dimostrativo/ }).first().click().catch(() => {});
await p.waitForTimeout(3000);

const conta = async () =>
  p.evaluate(async () => {
    const nomi = (await indexedDB.databases()).map((d) => d.name).filter(Boolean);
    let righe = 0;
    for (const nome of nomi) {
      const db = await new Promise((ok) => {
        const r = indexedDB.open(nome);
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ok(null);
      });
      if (!db) continue;
      for (const tabella of [...db.objectStoreNames]) {
        righe += await new Promise((ok) => {
          const q = db.transaction(tabella, "readonly").objectStore(tabella).count();
          q.onsuccess = () => ok(q.result);
          q.onerror = () => ok(0);
        });
      }
      db.close();
    }
    return { nomi, righe };
  });

const prima = await conta();
prova(
  "i dati si scrivono nell'archivio del browser",
  prima.righe > 0 ? "sì" : "no",
  `${prima.righe} righe scritte caricando il dataset dimostrativo dall'applicazione`,
);
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const dopo = await conta();
prova(
  "chiudendo e riaprendo, i dati sono ancora lì",
  dopo.righe > 0 && dopo.righe === prima.righe ? "sì" : "no",
  `${dopo.righe} righe in ${dopo.nomi.length} archivi (${dopo.nomi.join(", ")})`,
);

// ————————————————————————————————————————————————————————————
// 4 · Quanto spazio occupa
// ————————————————————————————————————————————————————————————

const spazio = await p.evaluate(() => navigator.storage?.estimate?.() ?? null);
prova(
  "spazio occupato nell'archivio del browser",
  spazio ? "sì" : "non misurato",
  spazio ? `${Math.round(spazio.usage / 1024)} KB usati con il dataset dimostrativo dentro` : "",
);
prova(
  "peso dell'applicazione da scaricare",
  "sì",
  `${Math.round(pesoDi(join(SORGENTE, "_next")) / 1024)} KB di file dell'applicazione in out/_next`,
);

// ————————————————————————————————————————————————————————————
// 5 · L'esportazione
// ————————————————————————————————————————————————————————————

const attesa = p.waitForEvent("download", { timeout: 15_000 }).catch(() => null);
await p.getByRole("button", { name: /^Esporta$/ }).first().click().catch(() => {});
const scaricato = await attesa;
let byteExport = 0;
if (scaricato) {
  const dove = join(COPIA, "export-di-prova.json");
  await scaricato.saveAs(dove);
  byteExport = statSync(dove).size;
}
prova(
  "l'esportazione dell'archivio scarica un file",
  byteExport > 1000 ? "sì" : "no",
  scaricato ? `${scaricato.suggestedFilename()}, ${Math.round(byteExport / 1024)} KB` : "nessun download",
);

// ————————————————————————————————————————————————————————————
// 6 · La stampa del prospetto
// ————————————————————————————————————————————————————————————

await p.goto(`${BASE}/app/fisco/`, { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
await p.emulateMedia({ media: "print" });
const foglio = await p.evaluate(() => {
  const testo = document.body.innerText;
  return { lungo: testo.length, haProspetto: /IRPEF|imposta|contributi/i.test(testo) };
});
const pdf = await p.pdf({ format: "A4", printBackground: true }).catch(() => null);
await p.emulateMedia({ media: "screen" });
prova(
  "il prospetto si stampa",
  pdf && pdf.length > 5000 && foglio.haProspetto ? "sì" : "no",
  pdf ? `foglio di stampa composto, PDF di ${Math.round(pdf.length / 1024)} KB` : "nessun PDF",
);

// ————————————————————————————————————————————————————————————
// 7 · Senza rete
// ————————————————————————————————————————————————————————————

await p.goto(`${BASE}/app/`, { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
await contesto.setOffline(true);

const navigato = await p
  .getByRole("link", { name: /fatture/i })
  .first()
  .click()
  .then(async () => {
    await p.waitForTimeout(1200);
    return (await p.evaluate(() => document.body.innerText)).length > 200;
  })
  .catch(() => false);
prova(
  "senza rete, l'applicazione già aperta continua a funzionare",
  navigato ? "sì" : "no",
  "navigazione interna a scheda aperta, con la rete staccata",
);

const ricaricata = await p
  .reload({ waitUntil: "domcontentloaded", timeout: 15_000 })
  .then(async () => (await p.evaluate(() => document.body.innerText)).length > 200)
  .catch(() => false);
prova(
  "senza rete, ricaricando la pagina l'applicazione si apre",
  ricaricata ? "sì" : "no",
  ricaricata ? "" : "la pagina non si carica: i file dell'applicazione arrivano dalla rete a ogni apertura",
);
await contesto.setOffline(false);

// ————————————————————————————————————————————————————————————
// 8 · Che cosa cancella i dati
// ————————————————————————————————————————————————————————————

await p.goto(`${BASE}/app/`, { waitUntil: "networkidle" });
await p.waitForTimeout(1000);
const primaDiPulire = await conta();
const cdp = await contesto.newCDPSession(p);
await cdp.send("Storage.clearDataForOrigin", { origin: BASE, storageTypes: "all" });
await p.reload({ waitUntil: "networkidle" });
await p.waitForTimeout(1500);
const dopoPulizia = await conta();
prova(
  "cancellando i dati del sito dal browser, l'archivio sparisce",
  primaDiPulire.righe > 0 && dopoPulizia.righe === 0 ? "sì" : "no",
  `da ${primaDiPulire.righe} righe a ${dopoPulizia.righe}`,
);

const anonimo = await browser.newContext();
const pa = await anonimo.newPage();
await pa.goto(`${BASE}/app/`, { waitUntil: "networkidle" });
await pa.waitForTimeout(1500);
/*
  Non basta contare gli archivi: l'applicazione **apre** il suo archivio
  all'avvio, quindi in una sessione nuova ce n'è uno lo stesso — vuoto. Quello
  che conta è che dentro non ci sia niente, e si contano le righe.
*/
const righeAnonimo = await pa.evaluate(async () => {
  const nomi = (await indexedDB.databases()).map((d) => d.name).filter(Boolean);
  let righe = 0;
  for (const nome of nomi) {
    const db = await new Promise((ok) => {
      const r = indexedDB.open(nome);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
    });
    if (!db) continue;
    for (const tabella of [...db.objectStoreNames]) {
      righe += await new Promise((ok) => {
        const q = db.transaction(tabella, "readonly").objectStore(tabella).count();
        q.onsuccess = () => ok(q.result);
        q.onerror = () => ok(0);
      });
    }
    db.close();
  }
  return righe;
});
prova(
  "una sessione separata (come la navigazione privata) non vede l'archivio di prima",
  righeAnonimo === 0 ? "sì" : "no",
  `${righeAnonimo} righe in una sessione appena aperta`,
);
await anonimo.close();

// ————————————————————————————————————————————————————————————
// 9 · Senza JavaScript
// ————————————————————————————————————————————————————————————

/*
  L'applicazione è un programma che gira nel browser: senza JavaScript non c'è
  niente da mostrare. Va misurato invece che dedotto, perché il sito **di
  vendita** funziona lo stesso — è HTML statico — e dire «serve JavaScript»
  senza distinguere le due cose confonderebbe chi legge.
*/
const senzaJs = await browser.newContext({ javaScriptEnabled: false });
const pj = await senzaJs.newPage();
await pj.goto(`${BASE}/app/`, { waitUntil: "domcontentloaded" });
const testoSenzaJs = (await pj.evaluate(() => document.body.innerText).catch(() => "")) || "";
await pj.goto(`${BASE}/termini/`, { waitUntil: "domcontentloaded" });
const terminiSenzaJs = (await pj.evaluate(() => document.body.innerText).catch(() => "")) || "";
prova(
  "senza JavaScript l'applicazione non si apre",
  testoSenzaJs.trim().length < 200 ? "sì" : "no",
  `${testoSenzaJs.trim().length} caratteri nell'app, ${terminiSenzaJs.trim().length} nella pagina dei Termini (che resta leggibile)`,
);
await senzaJs.close();

// ————————————————————————————————————————————————————————————
// 10 · Dal telefono
// ————————————————————————————————————————————————————————————

const telefono = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
const pt = await telefono.newPage();
await pt.goto(`${BASE}/app/`, { waitUntil: "networkidle" });
await pt.waitForTimeout(1500);
const sulTelefono = await pt.evaluate(() => ({
  testo: document.body.innerText.trim().length,
  sfonda: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
}));
prova(
  "da telefono (375 px) l'applicazione si apre e si legge",
  sulTelefono.testo > 200 && !sulTelefono.sfonda ? "sì" : "no",
  `${sulTelefono.testo} caratteri a schermo, nessuno scorrimento laterale`,
);
await telefono.close();

// ————————————————————————————————————————————————————————————

await browser.close();
server.close();
rmSync(COPIA, { recursive: true, force: true });
rmSync(profilo, { recursive: true, force: true });

const falliti = esiti.filter((e) => e.risultato === "no");
console.log(`\n${esiti.length} misure, ${falliti.length} con esito «no».`);
console.log("Le righe qui sopra sono quelle che possono andare sulla pagina dei requisiti: niente altro.\n");
writeFileSync("/tmp/misure-requisiti.json", JSON.stringify(esiti, null, 1));
