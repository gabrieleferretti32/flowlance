#!/usr/bin/env node
/**
 * Nessuna richiesta di misurazione prima di un sì. E mai, dentro l'app.
 *
 *   npm run build
 *   npm run verifica:consenso
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Cosa misura, e perché non guarda il codice
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Che gli `<Script>` stiano dentro un ramo condizionale si vede leggendo
 * `statistiche.tsx`, e che quel componente sia montato solo dal layout di
 * `(sito)` si vede nell'albero delle rotte. Tutte e due le cose sono vere, e
 * tutte e due sono argomenti — non prove.
 *
 * La prova è **la rete**. Questo strumento intercetta ogni richiesta che il
 * browser tenta e la confronta con l'elenco dei domini di misurazione. Non
 * conta i tag, non cerca stringhe nel bundle: guarda cosa parte davvero.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il caso che conta più di tutti
 * ─────────────────────────────────────────────────────────────────────────
 *
 * «Ho detto sì sulla landing, poi apro /app.» È il caso in cui la promessa del
 * prodotto — *dentro l'applicazione non c'è nessuna misurazione, in nessun
 * caso* — può cadere senza che nessuno lo noti: il consenso c'è, è valido, e
 * basterebbe che un componente di statistica finisse un giorno nel layout di
 * radice perché quella frase diventi falsa. Verificarlo a consenso **spento**
 * non proverebbe niente, perché a consenso spento non parte niente da nessuna
 * parte.
 *
 * Il consenso si dà premendo «Accetta tutto» nel banner vero, non scrivendo
 * nel `localStorage` da fuori: se un giorno cambia il formato di quella riga,
 * una scorciatoia continuerebbe a scrivere il formato vecchio e il controllo
 * misurerebbe una pagina che non ha mai acconsentito.
 */
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright-core";
import { esigiArtefattoFresco } from "./artefatto.mjs";

// Prima di ogni altra cosa: out/ è il sito del sorgente di adesso?
esigiArtefattoFresco();

const opzione = (nome, predefinito = "") => {
  const trovata = process.argv.slice(2).find((a) => a.startsWith(`--${nome}=`));
  return trovata ? trovata.slice(nome.length + 3) : predefinito;
};

const RADICE = resolve("out");
const BINARIO = opzione("chromium", process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium");

/**
 * I domini che non devono essere contattati senza un sì, e mai da `/app`.
 *
 * Non solo quelli dei due strumenti in uso: qualunque cosa parta verso un
 * terzo da queste pagine è una cosa da sapere. La landing carica solo file
 * propri, quindi l'elenco «tutto ciò che non è questo host» è la misura giusta
 * — e infatti prende anche il carattere tipografico, se un giorno qualcuno lo
 * rimettesse su Google Fonts.
 */
const MISURAZIONE = [
  "google-analytics.com",
  "googletagmanager.com",
  "analytics.google.com",
  "clarity.ms",
  "doubleclick.net",
];

try {
  statSync(RADICE);
} catch {
  console.error("Non trovo out/. Esegui prima «npm run build».");
  process.exit(1);
}

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

const problemi = [];
const fatti = [];
const sostiene = (ok, frase) => (ok ? fatti.push(frase) : problemi.push(frase));

const browser = await chromium.launch(BINARIO ? { executablePath: BINARIO } : { channel: "chrome" });

/**
 * Un contesto che registra ogni richiesta verso l'esterno.
 *
 * Le richieste ai domini di misurazione vengono **interrotte** oltre che
 * annotate: se una partisse davvero, il controllo aspetterebbe una risposta da
 * internet che qui non arriva, e il fallimento arriverebbe come un timeout
 * invece che come una frase leggibile.
 */
async function conRete(opzioni = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "it-IT",
    ...opzioni,
  });
  const fuori = [];
  await ctx.route("**/*", (rotta) => {
    const url = rotta.request().url();
    if (!url.startsWith(BASE) && !url.startsWith("data:") && !url.startsWith("blob:")) {
      fuori.push(url);
      return rotta.abort();
    }
    return rotta.continue();
  });
  return { ctx, fuori };
}

const versoMisurazione = (elenco) =>
  elenco.filter((u) => MISURAZIONE.some((d) => u.includes(d)));

// ————————————————————————————————————————————————————————————
// 1 · Prima di rispondere: niente, da nessuna pagina del sito
// ————————————————————————————————————————————————————————————

{
  const { ctx, fuori } = await conRete();
  const page = await ctx.newPage();
  for (const rotta of ["/", "/acquista/", "/termini/", "/privacy/", "/cookie/"]) {
    await page.goto(`${BASE}${rotta}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1_200);
  }
  const spie = versoMisurazione(fuori);
  sostiene(
    spie.length === 0,
    `senza risposta al banner, cinque pagine del sito non contattano nessuno${spie.length ? `: ${spie.join(", ")}` : ""}`,
  );
  // E niente verso l'esterno in generale: il carattere, le icone, tutto locale.
  sostiene(
    fuori.length === 0,
    `nessuna richiesta esce dal sito${fuori.length ? `: ${[...new Set(fuori)].join(", ")}` : ""}`,
  );
  await ctx.close();
}

// ————————————————————————————————————————————————————————————
// 2 · Dopo il sì: partono, e sono quelle configurate
// ————————————————————————————————————————————————————————————

let cookieConsenso = null;
{
  const { ctx, fuori } = await conRete();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1_000);

  const prima = versoMisurazione(fuori).length;

  /*
    Un banner solo. Se ce ne fossero due — il componente montato sia nel guscio
    di `(sito)` sia in quello di radice — «Accetta tutto» sarebbe ambiguo, e la
    prima stesura di questo strumento moriva lì con un errore di Playwright
    invece di dire cosa aveva trovato. Un controllo che va in pezzi al posto di
    fallire non dice niente a chi lo legge.
  */
  const quanti = await page.getByRole("button", { name: "Accetta tutto" }).count();
  sostiene(
    quanti === 1,
    `sulla landing c'è ${quanti} banner dei cookie${quanti === 1 ? "" : " — il componente è montato più di una volta"}`,
  );
  if (quanti === 0) {
    problemi.push("senza banner non si può dare il consenso: il resto del controllo non prova niente");
    await ctx.close();
    await browser.close();
    server.close();
    for (const f of fatti) console.log(`  ok   ${f}`);
    for (const p of problemi) console.log(`  NO   ${p}`);
    console.log(`\n${fatti.length} verificate, ${problemi.length} fuori posto.`);
    process.exit(1);
  }
  await page.getByRole("button", { name: "Accetta tutto" }).first().click();
  await page.waitForTimeout(2_500);
  const dopo = versoMisurazione(fuori);

  sostiene(prima === 0, `prima del clic: ${prima} richieste di misurazione`);
  sostiene(
    dopo.length > 0,
    `dopo «Accetta tutto» partono ${dopo.length} richieste di misurazione — se fossero zero, il consenso non starebbe accendendo niente`,
  );

  /*
    E sono quelle di questo progetto, non «una qualsiasi». Un identificativo
    sbagliato manderebbe i dati nella proprietà di qualcun altro, e da qui non
    si vedrebbe: le richieste partono lo stesso.
  */
  const codici = readFileSync("src/lib/sito/impostazioni.ts", "utf8");
  const ga4 = codici.match(/ga4:\s*"([^"]+)"/)?.[1];
  const clarity = codici.match(/clarity:\s*"([^"]+)"/)?.[1];
  sostiene(
    Boolean(ga4) && dopo.some((u) => u.includes(ga4)),
    `le richieste portano il codice GA4 configurato (${ga4})`,
  );
  sostiene(
    Boolean(clarity) && dopo.some((u) => u.includes(`/tag/${clarity}`)),
    `le richieste portano il codice Clarity configurato (${clarity})`,
  );

  // Il consenso resta salvato: è quello che si porta dietro chi passa a /app.
  cookieConsenso = await page.evaluate(() => {
    const chiave = "flowlance:consenso-cookie";
    return { chiave, valore: window.localStorage.getItem(chiave) };
  });
  sostiene(
    cookieConsenso?.valore != null,
    `il sì resta scritto nel browser (${cookieConsenso?.chiave})`,
  );
  await ctx.close();
}

// ————————————————————————————————————————————————————————————
// 3 · Il caso che conta: consenso ACCETTATO, e poi /app
// ————————————————————————————————————————————————————————————

{
  /*
    Il consenso si porta dentro come ce lo porta una persona: è lo stesso
    `localStorage` dello stesso host, scritto dal banner vero al passo qui
    sopra. Non lo si inventa — si riusa quello che il banner ha prodotto.
  */
  const { ctx, fuori } = await conRete();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.evaluate(
    ([chiave, valore]) => window.localStorage.setItem(chiave, valore),
    [cookieConsenso.chiave, cookieConsenso.valore],
  );

  // Da qui in avanti si guarda solo cosa parte dall'applicazione.
  fuori.length = 0;
  for (const rotta of ["/app/", "/app/fisco/", "/app/fatture/", "/app/dati/", "/app/licenza/"]) {
    await page.goto(`${BASE}${rotta}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1_500);
  }
  // E la demo, che è l'app aperta da chi non ha ancora comprato.
  await page.goto(`${BASE}/app/?demo=vetrina`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3_000);

  const spie = versoMisurazione(fuori);
  sostiene(
    spie.length === 0,
    `con il consenso ACCETTATO, sei schermate dell'app non contattano nessuno${spie.length ? `: ${spie.join(", ")}` : ""}`,
  );
  sostiene(
    fuori.length === 0,
    `dall'applicazione non esce nessuna richiesta${fuori.length ? `: ${[...new Set(fuori)].join(", ")}` : ""}`,
  );

  // Il consenso c'era davvero: se fosse stato perso, il controllo qui sopra
  // sarebbe passato per la ragione sbagliata.
  const cera = await page.evaluate(
    (chiave) => window.localStorage.getItem(chiave),
    cookieConsenso.chiave,
  );
  sostiene(
    cera === cookieConsenso.valore,
    "durante il giro nell'app il sì era ancora scritto nel browser",
  );

  // E il banner non compare dentro l'app: non c'è niente da chiedere lì.
  const banner = await page.evaluate(() => document.querySelector('[role="dialog"]') !== null);
  sostiene(!banner, "dentro l'app il banner dei cookie non compare");
  await ctx.close();
}

await browser.close();
server.close();

for (const f of fatti) console.log(`  ok   ${f}`);
for (const p of problemi) console.log(`  NO   ${p}`);
console.log(`\n${fatti.length} verificate, ${problemi.length} fuori posto.`);
process.exit(problemi.length === 0 ? 0 : 1);
