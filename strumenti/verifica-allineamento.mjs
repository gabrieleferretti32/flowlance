#!/usr/bin/env node
/**
 * I totali stanno sotto la colonna che sommano. Misurato in pixel.
 *
 *   npm run build
 *   npm run verifica:allineamento
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il difetto che questo strumento esiste per vedere
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il piede del registro dei costi aveva un `colSpan` sbagliato di una unità, e
 * i totali erano scivolati di una colonna: «15.057,50 € sotto Natura». Le somme
 * erano **giuste** — undici uguale undici, il conto tornava — e solo le
 * posizioni erano sbagliate. È la ragione per cui nessun test l'ha visto: un
 * test sui numeri non guarda dove finiscono, e un test sul DOM conta le celle,
 * che erano il numero giusto.
 *
 * Il difetto vive esattamente lì: **fra il numero e il posto in cui è
 * scritto**. E fra quei due c'è solo il rendering, cioè un browser. Contare
 * `colSpan` nel sorgente rifarebbe a mano il conto che il browser fa da sé, con
 * l'aritmetica dello stesso sviluppatore che l'ha sbagliato la prima volta.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Cosa afferma
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Per ogni tabella con un piede, e per ogni cella del piede che contiene una
 * cifra: la colonna sopra quella cella — quella su cui il suo centro cade
 * davvero, misurata coi rettangoli veri — deve essere una colonna di cifre. Un
 * totale sopra «Natura», «Fornitore» o «Documento» è il difetto, e si vede
 * senza sapere quale numero doveva esserci.
 *
 * Dove la colonna sommata contiene importi, va oltre: **somma il corpo** e lo
 * confronta col piede. Lì la verifica smette di essere sulla posizione e
 * diventa sul contenuto, che è la forma più forte — ma vale solo dove la
 * tabella mostra tutte le righe che il piede somma, e questo lo dice la tabella
 * stessa.
 *
 * A 1440 e a 1024: le colonne cambiano di larghezza e qualcuna sparisce, e un
 * piede allineato a una larghezza non lo è per forza all'altra.
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
const GIORNO = "2026-09-05T10:30:00";
const LARGHEZZE = [1440, 1024];
const PAGINE = [
  { rotta: "/app/fatture/", nome: "Fatture" },
  { rotta: "/app/costi/", nome: "Costi" },
  { rotta: "/app/note/", nome: "Note di credito" },
  { rotta: "/app/iva/", nome: "IVA" },
  { rotta: "/app/scadenzario/", nome: "Scadenzario" },
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

const browser = await chromium.launch(BINARIO ? { executablePath: BINARIO } : { channel: "chrome" });

/**
 * Le tabelle di una pagina, misurate come le vede chi guarda.
 *
 * Il rilievo avviene dentro la pagina perché i rettangoli servono tutti nello
 * stesso istante: prenderli uno per uno da fuori, fra un `evaluate` e l'altro,
 * significherebbe confrontare posizioni di momenti diversi — e una tabella che
 * si assesta dopo il primo rendering li farebbe divergere per finta.
 */
async function rilevaTabelle(page) {
  return page.evaluate(() => {
    /** Una cella porta una cifra? Le sigle e le date non contano. */
    const conCifra = (t) => /\d/.test(t) && !/^\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*$/.test(t.trim());
    const importo = (t) => {
      const m = t.match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s*€/);
      return m ? Number(m[0].replace(/[€\s ]/g, "").replace(/\./g, "").replace(",", ".")) : null;
    };
    const rett = (el) => {
      const r = el.getBoundingClientRect();
      return { sinistra: r.left, destra: r.right, centro: r.left + r.width / 2, larghezza: r.width };
    };

    return [...document.querySelectorAll("table")]
      .filter((t) => t.querySelector("tfoot td"))
      .map((t) => ({
        intestazioni: [...t.querySelectorAll("thead th")].map((th) => ({
          testo: (th.textContent ?? "").trim(),
          ...rett(th),
        })),
        corpo: [...t.querySelectorAll("tbody tr")].map((tr) =>
          [...tr.children].map((td) => ({
            testo: (td.textContent ?? "").trim(),
            importo: importo(td.textContent ?? ""),
            ...rett(td),
          })),
        ),
        piede: [...t.querySelectorAll("tfoot td")].map((td) => ({
          testo: (td.textContent ?? "").trim(),
          cifra: conCifra(td.textContent ?? ""),
          importo: importo(td.textContent ?? ""),
          ...rett(td),
        })),
      }));
  });
}

/** La colonna dell'intestazione su cui cade un punto. */
const colonnaDi = (intestazioni, x) =>
  intestazioni.find((h) => x >= h.sinistra && x <= h.destra) ?? null;

for (const larghezza of LARGHEZZE) {
  const ctx = await browser.newContext({
    viewport: { width: larghezza, height: 900 },
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(GIORNO));

  // La vetrina: è l'unico dataset con IVA, ritenute e deducibilità diverse,
  // cioè l'unico in cui i registri hanno davvero delle colonne di importi.
  await page.goto(`${BASE}/app/dati/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1_500);
  await page.getByRole("button", { name: /Vetrina/ }).first().click();
  await page.waitForTimeout(3_000);

  const fatture = await page.evaluate(async () => {
    const db = await new Promise((ok, ko) => {
      const q = indexedDB.open("freelance-finance-os");
      q.onsuccess = () => ok(q.result);
      q.onerror = () => ko(q.error);
    });
    const q = db.transaction("fatture").objectStore("fatture").getAll();
    return new Promise((ok) => {
      q.onsuccess = () => ok(q.result.map((r) => String(r.id)));
    });
  });
  if (fatture.length === 0 || fatture.some((id) => !id.startsWith("vet-"))) {
    console.error("L'archivio non è la vetrina: nessuna misura ha senso su un altro dataset.");
    await browser.close();
    server.close();
    process.exit(1);
  }

  console.log(`\n${larghezza} px`);
  for (const { rotta, nome } of PAGINE) {
    await page.goto(BASE + rotta, { waitUntil: "networkidle" });
    await page.waitForTimeout(2_000);
    const tabelle = await rilevaTabelle(page);
    if (tabelle.length === 0) {
      console.log(`  ${nome}: nessuna tabella con un piede`);
      continue;
    }

    tabelle.forEach((t, indice) => {
      const dove = `${nome}${tabelle.length > 1 ? ` · tabella ${indice + 1}` : ""} @ ${larghezza}`;
      const celleConCifra = t.piede.filter((c) => c.cifra);
      if (celleConCifra.length === 0) {
        console.log(`  ${dove}: il piede non porta cifre`);
        return;
      }

      for (const cella of celleConCifra) {
        /*
          Le celle che coprono più di una colonna sono etichette, non totali:
          «Totale · 18 fatture» porta una cifra ma non sta sommando la colonna
          sopra cui capita di finire. Si riconoscono dal rettangolo, non da un
          `colSpan` letto nel sorgente: è il rettangolo che decide dove il testo
          appare, ed è quello che si sta misurando.
        */
        const coperte = t.intestazioni.filter(
          (h) => h.centro >= cella.sinistra - 1 && h.centro <= cella.destra + 1,
        );
        if (coperte.length > 1) continue;

        const sopra = colonnaDi(t.intestazioni, cella.centro);
        if (!sopra) {
          problemi.push(`${dove}: «${cella.testo}» non cade sotto nessuna intestazione`);
          continue;
        }

        /*
          La colonna è di cifre? Non lo si chiede all'intestazione, che può
          chiamarsi «Totale» ed essere vuota: lo si chiede alle righe. Una
          colonna che nel corpo porta importi è una colonna di importi, e un
          totale ci sta sopra a ragione.
        */
        const sotto = t.corpo
          .map((riga) => riga.find((c) => c.centro >= sopra.sinistra && c.centro <= sopra.destra))
          .filter(Boolean);
        const conCifre = sotto.filter((c) => /\d/.test(c.testo)).length;
        const quota = sotto.length === 0 ? 0 : conCifre / sotto.length;

        if (quota < 0.5) {
          problemi.push(
            `${dove}: «${cella.testo}» finisce sotto «${sopra.testo}», una colonna in cui solo ${conCifre} righe su ${sotto.length} portano una cifra`,
          );
          continue;
        }

        /*
          Dove il piede e la colonna sono tutti e due importi, il confronto
          diventa sul contenuto: la somma delle righe visibili deve fare il
          totale. Vale solo se **tutte** le righe sono a schermo — un registro
          impaginato somma anche quelle che non si vedono, e pretendere la
          coincidenza inventerebbe un difetto che non c'è.
        */
        const importiSotto = sotto.map((c) => c.importo).filter((v) => v !== null);
        if (cella.importo !== null && importiSotto.length === sotto.length && sotto.length > 0) {
          const somma = Math.round(importiSotto.reduce((a, b) => a + b, 0) * 100) / 100;
          if (Math.abs(somma - cella.importo) > 0.02) {
            problemi.push(
              `${dove}: sotto «${sopra.testo}» le ${sotto.length} righe fanno ${somma}, il piede dice ${cella.importo}`,
            );
            continue;
          }
          fatti.push(`${dove}: «${sopra.testo}» — ${sotto.length} righe fanno ${somma}, come il piede`);
          continue;
        }

        fatti.push(`${dove}: «${cella.testo}» sta sotto «${sopra.testo}», colonna di cifre`);
      }
    });
  }

  await ctx.close();
}

await browser.close();
server.close();

for (const f of fatti) console.log(`  ok   ${f}`);
for (const p of problemi) console.log(`  NO   ${p}`);
console.log(`\n${fatti.length} allineamenti verificati, ${problemi.length} fuori posto.`);
process.exit(problemi.length === 0 ? 0 : 1);
