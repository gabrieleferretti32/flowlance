#!/usr/bin/env node
/**
 * Le schermate per la pagina di vendita, rifatte dal prodotto vero.
 *
 *   npm run build
 *   node strumenti/schermate-vendita.mjs
 *
 * Uno screenshot di un prodotto invecchia in fretta e invecchia in silenzio:
 * resta bello, e intanto mostra una versione che non esiste più. Questo
 * strumento le rifà tutte insieme dal sito appena costruito, così l'immagine
 * sulla pagina di vendita è sempre l'app che si apre premendo «Apri la demo».
 *
 * Tre vincoli, che sono la ragione per cui è uno strumento e non una passata a
 * mano:
 *
 * — **Solo il dataset vetrina.** L'ordinario con IVA, ritenute, deducibilità
 *   diverse e il 2025 chiuso. Non il dimostrativo, che è un forfettario con
 *   dentro cose da sistemare: serve a provare l'app, non a farne una cartolina.
 * — **Orologio fermo.** La vetrina finisce il 5 settembre 2026 e le schermate
 *   parlano di «oggi»: senza fermare l'orologio, due esecuzioni a distanza di
 *   un mese darebbero scadenze diverse e importi diversi.
 * — **Stessa proporzione per tutte e quattro**, 16:10, perché la pagina di
 *   vendita è impaginata attorno a quella. Il guscio resta dentro — barra
 *   laterale e testata — perché sono immagini di un'applicazione, non ritagli
 *   di una tabella. Sempre al doppio della densità: la pagina le mostra attorno
 *   ai 1050 px e i file escono a 2880, quindi restano nette su uno schermo
 *   retina.
 *
 *   Tutte e quattro a 1440 × 900, registri compresi. Il registro dei costi si
 *   scattava a 1920 perché a 1440 la colonna «Totale» finiva sotto quella
 *   delle azioni — `453,84 €` si leggeva `4` — ma quello era un difetto del
 *   registro, non una ragione per fotografarlo a una risoluzione che lo
 *   nasconde: una schermata scattata dove il difetto non si vede mostra una
 *   cosa che il cliente non vedrà. Il difetto è stato corretto (le azioni ora
 *   sono ancorate a sinistra) e lo scatto è tornato a 1440.
 *
 * Opzioni:
 *   --dove=cartella         dove scrivere i PNG
 *   --larghezza=1440        larghezza in pixel CSS
 *   --altezza=900           altezza in pixel CSS
 *   --chromium=percorso     un binario diverso da quello predefinito
 */
import { createServer } from "node:http";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright-core";

const opzione = (nome, predefinito = "") => {
  const trovata = process.argv.slice(2).find((a) => a.startsWith(`--${nome}=`));
  return trovata ? trovata.slice(nome.length + 3) : predefinito;
};

const RADICE = resolve("out");
const DOVE = resolve(opzione("dove", "public/schermate"));
const LARGHEZZA = Number(opzione("larghezza", "1440"));
const ALTEZZA = Number(opzione("altezza", "900"));
const BINARIO = opzione("chromium", process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium");

/** L'ultimo giorno che la vetrina racconta. Sta in `src/lib/dati/vetrina.ts`. */
const GIORNO = "2026-09-05T10:30:00";

const SCHERMATE = [
  { file: "cruscotto.png", rotta: "/app/", attesa: "Cruscotto" },
  { file: "fisco.png", rotta: "/app/fisco/", attesa: "Imposte e contributi", apriDettaglio: true },
  { file: "scadenziario.png", rotta: "/app/scadenzario/", attesa: "Scadenzario" },
  { file: "costi.png", rotta: "/app/costi/", attesa: "Costi" },
];

try {
  statSync(RADICE);
} catch {
  console.error("Non trovo out/. Esegui prima «npm run build».");
  process.exit(1);
}
mkdirSync(DOVE, { recursive: true });

const TIPI = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".json": "application/json",
  ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".png": "image/png",
};
const server = createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "");
  for (const c of [join(RADICE, p, "index.html"), join(RADICE, `${p}.html`), join(RADICE, p)]) {
    try {
      if (!statSync(c).isFile()) continue;
      res.writeHead(200, { "content-type": TIPI[extname(c)] ?? "application/octet-stream" });
      res.end(readFileSync(c));
      return;
    } catch {
      // il candidato successivo
    }
  }
  res.writeHead(404);
  res.end("404");
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch(BINARIO ? { executablePath: BINARIO } : { channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: LARGHEZZA, height: ALTEZZA },
  deviceScaleFactor: 2,
  locale: "it-IT",
  timezoneId: "Europe/Rome",
});
const page = await ctx.newPage();
await page.clock.setFixedTime(new Date(GIORNO));

// — Carico la vetrina dalla schermata vera, non scrivendo in IndexedDB da
//   fuori: se un giorno il caricamento cambia, queste immagini devono
//   cambiare con lui invece di continuare a uscire da una scorciatoia.
await page.goto(`${BASE}/app/dati/`, { waitUntil: "networkidle" });
/*
  L'etichetta cambia con lo stato dell'archivio — «Vetrina · …» quando è
  vuoto, «Carica «Vetrina · …»» quando ha già dentro qualcosa — e il nome
  del dataset è l'unica parte che resta.
*/
await page.getByRole("button", { name: /Vetrina/ }).first().click();
await page.waitForTimeout(3_000);

/*
  Che l'archivio sia davvero la vetrina, e non qualcos'altro che le somiglia.

  La prima stesura, dopo aver caricato la vetrina, cercava un'eventuale
  conferma con `/^(Carica|Sostituisci|Conferma)/` — e quel motivo, sulla
  schermata tornata al suo stato normale, corrisponde al pulsante «Carica
  «Dimostrativo · forfettario»», che era lì accanto. Lo premeva. Il
  dimostrativo conserva le impostazioni, quindi l'archivio restava intestato a
  Elena Marani in regime ordinario e sotto ci finivano i documenti di un
  forfettario: quattro schermate perfettamente credibili di un'attività che non
  esiste. Nessun titolo di pagina se n'era accorto.

  Il controllo guarda gli identificativi, che sono l'unica cosa che i due
  dataset non condividono: la vetrina li prefissa tutti con `vet-`.
*/
const estranee = await page.evaluate(async () => {
  const db = await new Promise((ok, ko) => {
    const q = indexedDB.open("freelance-finance-os");
    q.onsuccess = () => ok(q.result);
    q.onerror = () => ko(q.error);
  });
  const leggi = (tabella) =>
    new Promise((ok) => {
      if (!db.objectStoreNames.contains(tabella)) return ok([]);
      const q = db.transaction(tabella).objectStore(tabella).getAll();
      q.onsuccess = () => ok(q.result);
      q.onerror = () => ok([]);
    });
  const righe = [...(await leggi("fatture")), ...(await leggi("costi")), ...(await leggi("clienti"))];
  return { totale: righe.length, fuori: righe.filter((r) => !String(r.id).startsWith("vet-")).length };
});

if (estranee.totale === 0 || estranee.fuori > 0) {
  console.error(
    `L'archivio non è la vetrina: ${estranee.fuori} righe su ${estranee.totale} non hanno un id «vet-».`,
  );
  console.error("Nessuna immagine scritta: meglio nessuna che quattro sbagliate e credibili.");
  await browser.close();
  server.close();
  process.exit(1);
}
console.log(`Vetrina caricata: ${estranee.totale} fra fatture, costi e clienti, tutte sue.\n`);

// Il puntatore lontano da tutto: una cella in stato di modifica o un'icona
// illuminata dal passaggio del mouse finisce dentro l'immagine.
await page.mouse.move(2, 2);

/**
 * La riga del prospetto da aprire prima di scattare.
 *
 * Il paragrafo accanto all'immagine promette che «ogni riga dice il suo
 * calcolo», e un prospetto tutto chiuso mostra etichette e importi: la promessa
 * non si vede.
 *
 * Fra le righe che stanno dentro l'inquadratura, «Quota fiscalmente
 * deducibile» è quella che spiega di più — nomina l'auto al 20 %, i ristoranti
 * al 75 %, la telefonia al 50 % dell'IVA, cioè tre percentuali per documento
 * che quasi nessuno si aspetta di vedere in un gestionale. Le righe che
 * nominano il coefficiente ATECO e l'aliquota regionale spiegherebbero
 * altrettanto bene ma cadono sotto il taglio dei 900 px, e scattarle
 * significherebbe togliere la testata all'immagine.
 */
const RIGA_DA_APRIRE = /^Come si calcola: Quota fiscalmente deducibile/;

for (const s of SCHERMATE) {
  const larghezza = s.larghezza ?? LARGHEZZA;
  const altezza = s.altezza ?? ALTEZZA;
  await page.setViewportSize({ width: larghezza, height: altezza });
  await page.goto(BASE + s.rotta, { waitUntil: "networkidle" });
  await page.waitForTimeout(1_500);
  await page.mouse.move(2, 2);
  const testo = await page.evaluate(() => document.body.innerText);
  if (!testo.includes(s.attesa)) {
    console.error(`${s.file}: non trovo «${s.attesa}» nella pagina. Non la salvo.`);
    continue;
  }
  if (s.apriDettaglio) {
    const bottone = page.getByRole("button", { name: RIGA_DA_APRIRE }).first();
    if (await bottone.isVisible().catch(() => false)) {
      await bottone.click();
      await page.waitForTimeout(700);
    } else {
      console.error(`${s.file}: non trovo la riga da aprire. Scatto comunque, ma senza formula.`);
    }
  }

  const percorso = join(DOVE, s.file);
  await page.screenshot({ path: percorso });
  const { size } = statSync(percorso);
  console.log(`${s.file.padEnd(18)} ${larghezza}×${altezza} @2x  ${(size / 1024).toFixed(0)} kB  ← ${s.rotta}`);
}

await browser.close();
server.close();
console.log(`\nScritte in ${DOVE}.`);
