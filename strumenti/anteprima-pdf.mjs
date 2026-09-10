#!/usr/bin/env node
/**
 * Guardare il PDF, invece di leggerne il testo.
 *
 *   npm run build
 *   node strumenti/anteprima-pdf.mjs [file.pdf] [--dove=cartella]
 *
 * Il testo estratto da un PDF dice cosa c'è scritto e non dice **dov'è**. Il
 * piede di questo documento è finito, per una versione intera, su quattro
 * pagine vuote in fondo — e il controllo che cercava le stringhe «pagina N di
 * M» le trovava tutte e quattro, in fila, e diceva che andava bene.
 *
 * `termini.test.ts` adesso misura la geometria e quel difetto non passa più.
 * Questo strumento serve all'altra metà: **decidere come deve venire**. La
 * carta intestata, il filetto, il peso del marchio accanto al titolo sono cose
 * che non si affermano in un test — si guardano.
 *
 * Rende ogni pagina con pdf.js dentro Chromium e scrive un PNG per pagina.
 * Nessuna dipendenza nativa: la stessa libreria che il browser usa per
 * mostrare i PDF, fatta girare in un browser.
 */
import { createServer } from "node:http";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { chromium } from "playwright-core";
import { esigiArtefattoFresco } from "./artefatto.mjs";

// Prima di ogni altra cosa: out/ è il sito del sorgente di adesso?
esigiArtefattoFresco();

const opzione = (nome, predefinito = "") => {
  const trovata = process.argv.slice(2).find((a) => a.startsWith(`--${nome}=`));
  return trovata ? trovata.slice(nome.length + 3) : predefinito;
};

const FILE = resolve(
  process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "public/termini/flowlance-termini-v2.pdf",
);
const DOVE = resolve(opzione("dove", "/tmp/anteprima-pdf"));
const SCALA = Number(opzione("scala", "1.6"));
const BINARIO = opzione("chromium", process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium");

try {
  statSync(FILE);
} catch {
  console.error(`Non trovo ${FILE}.`);
  process.exit(1);
}
mkdirSync(DOVE, { recursive: true });

const PDFJS = resolve("node_modules/pdfjs-dist/build");
const TIPI = { ".mjs": "text/javascript", ".js": "text/javascript", ".pdf": "application/pdf", ".html": "text/html; charset=utf-8" };

const server = createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  /*
    La pagina si serve da qui e non con `setContent`: un documento «about:blank»
    ha origine nulla, e l'import dinamico di pdf.js da un altro indirizzo viene
    rifiutato dal browser. Servendo tutto dallo stesso host la regola non si
    applica, e non c'è niente da disattivare.
  */
  if (p === "/" || p === "/index.html") {
    res.writeHead(200, { "content-type": TIPI[".html"] });
    res.end('<body style="margin:0;background:#e9ebf0"><div id="fogli"></div></body>');
    return;
  }
  const candidato = p === "/documento.pdf" ? FILE : p.startsWith("/pdfjs/") ? join(PDFJS, p.slice(7)) : null;
  if (!candidato) {
    res.writeHead(404);
    res.end("404");
    return;
  }
  try {
    res.writeHead(200, { "content-type": TIPI[extname(candidato)] ?? "application/octet-stream" });
    res.end(readFileSync(candidato));
  } catch {
    res.writeHead(404);
    res.end("404");
  }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const BASE = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch(BINARIO ? { executablePath: BINARIO } : { channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
await page.goto(BASE + "/", { waitUntil: "load" });

const pagine = await page.evaluate(
  async ([base, scala]) => {
    const pdfjs = await import(`${base}/pdfjs/pdf.mjs`);
    pdfjs.GlobalWorkerOptions.workerSrc = `${base}/pdfjs/pdf.worker.mjs`;
    const doc = await pdfjs.getDocument({ url: `${base}/documento.pdf` }).promise;
    const contenitore = document.getElementById("fogli");
    const misure = [];
    for (let n = 1; n <= doc.numPages; n += 1) {
      const p = await doc.getPage(n);
      const vista = p.getViewport({ scale: scala });
      const tela = document.createElement("canvas");
      tela.id = `pagina-${n}`;
      tela.width = Math.ceil(vista.width);
      tela.height = Math.ceil(vista.height);
      tela.style.cssText = "display:block;margin:0 auto 16px;box-shadow:0 1px 6px rgba(0,0,0,.25);background:#fff";
      contenitore.appendChild(tela);
      await p.render({ canvasContext: tela.getContext("2d"), viewport: vista }).promise;
      misure.push({ n, larghezza: tela.width, altezza: tela.height });
    }
    return misure;
  },
  [BASE, SCALA],
);

const radice = basename(FILE, ".pdf");
for (const { n } of pagine) {
  const png = await page.locator(`#pagina-${n}`).screenshot();
  const dove = join(DOVE, `${radice}-p${n}.png`);
  writeFileSync(dove, png);
  console.log(`  ${dove}`);
}

await browser.close();
server.close();
console.log(`\n${pagine.length} pagine rese da ${FILE}.`);
