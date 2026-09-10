#!/usr/bin/env node
/**
 * Misura le schermate alle larghezze vere dei telefoni.
 *
 *   npm run dev            # in un terminale
 *   node strumenti/misura-responsive.mjs
 *
 * Cerca due cose che a occhio non si vedono e che si rompono di nuovo ogni
 * volta che una schermata cresce di un pulsante:
 *
 * — **lo sfondamento orizzontale**: quando qualcosa è più largo della finestra,
 *   la pagina scorre di lato. Su un telefono uno scorrimento orizzontale
 *   involontario si sente come un difetto anche quando non si capisce cosa
 *   l'ha causato. Lo strumento non dice solo «sfonda»: nomina l'elemento più
 *   profondo che esce, con classi e testo, perché sia riconoscibile nel codice.
 * — **le aree di tocco troppo piccole**: sotto i 32 px il pollice manca il
 *   bersaglio e colpisce quello che c'è sotto. Chi sta dentro un'etichetta si
 *   preme dall'etichetta, e quella è l'area vera: non conta il quadratino.
 *
 * Quello che *non* misura, e va guardato a occhio: quanta testata resta prima
 * del contenuto, se un modulo lungo si scorre fino al pulsante, se il testo
 * troncato dice ancora qualcosa.
 *
 * Opzioni:
 *   --url=http://localhost:3000    da dove leggere
 *   --larghezze=320,375,390,430    quali larghezze provare
 *   --rotte=/fatture,/costi        solo alcune schermate
 *   --json=percorso.json           dove scrivere il dettaglio completo
 *   --profilo=percorso             cartella del profilo Chromium da riusare
 *   --chromium=percorso            un binario diverso da Chrome di sistema
 *
 * L'archivio è quello del profilo: la prima volta è vuoto, e una tabella vuota
 * non misura niente. Carica il dataset dimostrativo da «Dati e backup» — il
 * profilo se lo ricorda — e rilancia.
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { esigiArtefattoFresco } from "./artefatto.mjs";

// Prima di ogni altra cosa: out/ è il sito del sorgente di adesso?
esigiArtefattoFresco();

const opzione = (nome, predefinito) => {
  const trovata = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return trovata ? trovata.slice(nome.length + 3) : predefinito;
};

const BASE_URL = opzione("url", "http://localhost:3000").replace(/\/$/, "");
const LARGHEZZE = opzione("larghezze", "320,375,390,430").split(",").map(Number);
const PROFILO = resolve(opzione("profilo", `${tmpdir()}/flowlance-misura`));
const JSON_OUT = opzione("json", "");

/** Le schermate dell'app. L'elenco sta qui perché lo strumento gira da fuori. */
const ROTTE_PREDEFINITE = [
  "/", "/fatture", "/note", "/costi", "/clienti", "/fisco", "/iva", "/confronto",
  "/scadenzario", "/chiusura", "/cashflow", "/patrimonio", "/pianificazione",
  "/avvio", "/parametri", "/dati", "/importa", "/licenza", "/scorciatoie",
];
const ROTTE = opzione("rotte", "") ? opzione("rotte", "").split(",") : ROTTE_PREDEFINITE;

/** Sotto questa misura un bersaglio non si preme con il pollice. */
const TOCCO_MINIMO = 32;

/*
  `playwright-core` non scarica nessun browser: usa quello che c'è già. Di
  norma è Chrome, che su un Mac da sviluppo c'è sempre; `--chromium=` serve
  quando il binario sta altrove — su un runner, per esempio.
*/
const BINARIO = opzione("chromium", process.env.PLAYWRIGHT_CHROMIUM ?? "");
const ctx = await chromium.launchPersistentContext(PROFILO, {
  ...(BINARIO ? { executablePath: BINARIO } : { channel: "chrome" }),
  viewport: { width: LARGHEZZE[0], height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const pagina = ctx.pages()[0] ?? (await ctx.newPage());
const errori = [];
pagina.on("pageerror", (e) => errori.push(String(e)));

const problemi = [];
for (const larghezza of LARGHEZZE) {
  await pagina.setViewportSize({ width: larghezza, height: 844 });
  for (const rotta of ROTTE) {
    await pagina.goto(`${BASE_URL}${rotta}`, { waitUntil: "networkidle" });
    await pagina.waitForTimeout(600);
    const esito = await pagina.evaluate(
      ({ larghezza, minimo }) => {
        const fuori = (r) => r.right > larghezza + 1 || r.left < -1;
        const sfonda = document.documentElement.scrollWidth > larghezza + 1;

        const colpevoli = [];
        if (sfonda) {
          for (const el of document.querySelectorAll("body *")) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || !fuori(r)) continue;
            // Solo il nodo più profondo che esce: i suoi genitori escono per
            // colpa sua, e elencarli tutti nasconde quello da correggere.
            const anchePerIFigli = [...el.children].some((c) => {
              const cr = c.getBoundingClientRect();
              return cr.width > 0 && fuori(cr);
            });
            if (anchePerIFigli) continue;
            colpevoli.push({
              tag: el.tagName.toLowerCase(),
              classi: String(el.className).slice(0, 80),
              testo: (el.textContent ?? "").trim().slice(0, 40),
              destra: Math.round(r.right),
            });
          }
        }

        const piccoli = [...document.querySelectorAll("button, a[href], input, select")]
          .filter((el) => {
            if (el.getAttribute("aria-hidden") === "true") return false;
            if (el.closest("[aria-hidden='true']")) return false;
            // Un controllo dentro un'etichetta si preme dall'etichetta.
            const r = (el.closest("label") ?? el).getBoundingClientRect();
            return r.width > 0 && r.height > 0 && (r.height < minimo || r.width < minimo);
          })
          .map((el) => {
            const r = (el.closest("label") ?? el).getBoundingClientRect();
            return {
              tag: el.tagName.toLowerCase(),
              etichetta: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 34),
              larghezza: Math.round(r.width),
              altezza: Math.round(r.height),
            };
          });

        return {
          sfonda,
          largo: document.documentElement.scrollWidth,
          colpevoli: colpevoli.slice(0, 5),
          piccoli: piccoli.slice(0, 6),
        };
      },
      { larghezza, minimo: TOCCO_MINIMO },
    );
    if (esito.sfonda || esito.piccoli.length > 0) problemi.push({ larghezza, rotta, ...esito });
  }
}
await ctx.close();

const sfondamenti = problemi.filter((p) => p.sfonda);
console.log(`${ROTTE.length} schermate × ${LARGHEZZE.length} larghezze\n`);

if (sfondamenti.length === 0) {
  console.log("Nessuno sfondamento orizzontale.");
} else {
  console.log(`Sfondamenti (${sfondamenti.length}):`);
  for (const p of sfondamenti) {
    console.log(`  ${p.larghezza}px ${p.rotta} → ${p.largo}px`);
    for (const c of p.colpevoli) {
      console.log(`      <${c.tag} class="${c.classi}"> «${c.testo}» arriva a ${c.destra}px`);
    }
  }
}

const tocchi = new Map();
for (const p of problemi) {
  for (const t of p.piccoli) {
    const chiave = `${t.tag} «${t.etichetta}» ${t.larghezza}×${t.altezza}`;
    tocchi.set(chiave, (tocchi.get(chiave) ?? 0) + 1);
  }
}
console.log(`\nAree di tocco sotto i ${TOCCO_MINIMO} px (${tocchi.size}):`);
if (tocchi.size === 0) console.log("  nessuna.");
for (const [chiave, quante] of [...tocchi].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${chiave} — su ${quante} schermate`);
}
console.log(
  "\nUn link dentro una frase è alto quanto la riga di testo: allargarlo spezzerebbe" +
    "\nil paragrafo. Sono i soli casi in cui la misura piccola è la scelta giusta.",
);

if (errori.length > 0) console.log("\nErrori in console:", errori);
if (JSON_OUT) {
  mkdirSync(dirname(resolve(JSON_OUT)), { recursive: true });
  writeFileSync(resolve(JSON_OUT), JSON.stringify(problemi, null, 1));
  console.log(`\nDettaglio completo in ${JSON_OUT}`);
}
process.exit(sfondamenti.length > 0 ? 1 : 0);
