#!/usr/bin/env node
/**
 * Il prospetto si verifica con sé stesso, in un browser vero.
 *
 *   npm run build
 *   node strumenti/verifica-derivati.mjs
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Che cosa misura, e perché non misura la presenza di niente
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Ogni riga del prospetto porta con sé la **propria formula**, coi numeri
 * dentro: «12.345,00 € × 26,07 %, fino al massimale di 120.607,00 €» accanto a
 * un importo. Sono due cose che l'app calcola separatamente e mostra insieme, e
 * la famiglia di difetti che questo progetto continua a incontrare è esattamente
 * quella: **un valore mostrato e uno calcolato che non si parlano, con nessuno
 * dei due che segnala l'altro**. Cinque volte in due settimane, tutte trovate a
 * mano, nessuna da un test.
 *
 * Allora questo strumento fa i conti della formula e li confronta con l'importo
 * scritto accanto. Non controlla che la riga ci sia, non conta gli elementi,
 * non cerca una parola in una pagina: prende i numeri che l'app mostra e
 * verifica che uno sia il risultato degli altri. È la sola forma di verifica che
 * il difetto non riesce ad attraversare, perché il difetto **è** la divergenza
 * fra quei due numeri.
 *
 * Serve a valle del registro dei derivati (`src/lib/fisco/derivati/`), che le due
 * strade le ha rese una sola nel sorgente. Questo controlla che siano una sola
 * anche a schermo, che è dove i cinque difetti si erano visti.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché a 375 px
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Sopra i 640 la formula sta in un popover, uno per volta; sotto, si apre in
 * linea sotto la riga. A schermo stretto sono tutte leggibili in una passata,
 * dallo stesso DOM che vede l'utente. Non è una scorciatoia: è la stessa
 * `formula` che il popover mostra, resa dallo stesso componente.
 */
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright-core";

const opzione = (nome, predefinito = "") => {
  const trovata = process.argv.slice(2).find((a) => a.startsWith(`--${nome}=`));
  return trovata ? trovata.slice(nome.length + 3) : predefinito;
};

const RADICE = resolve("out");
const BINARIO = opzione("chromium", process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium");
/** Lo stesso giorno delle schermate di vendita: la vetrina finisce lì. */
const GIORNO = "2026-09-05T10:30:00";

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

// ————————————————————————————————————————————————————————————
// Leggere i numeri come li scrive l'app
// ————————————————————————————————————————————————————————————

/**
 * Tutti i numeri di una frase, in ordine, nel formato italiano.
 *
 * Lo spazio prima di «€» e di «%» è unificatore (U+00A0), non uno spazio
 * normale: `euro()` lo mette apposta perché la cifra non vada a capo dal suo
 * simbolo. Una regex scritta con lo spazio della tastiera non trova niente e
 * il controllo passa a vuoto — che è il modo in cui una verifica diventa
 * decorativa.
 */
function numeriDi(frase) {
  const trovati = frase.match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?/g) ?? [];
  return trovati.map((t) => Number(t.replace(/\./g, "").replace(",", ".")));
}

/** Come `round2` di `src/lib/fisco/aritmetica.ts`: l'arrotondamento del foglio. */
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Due importi coincidono se il divario sta nell'ultimo centesimo mostrato. */
const pari = (a, b, tolleranza = 0.02) => Math.abs(a - b) <= tolleranza;

const problemi = [];
const fatti = [];
const sostiene = (ok, frase) => (ok ? fatti.push(frase) : problemi.push(frase));

// ————————————————————————————————————————————————————————————
// Il browser
// ————————————————————————————————————————————————————————————

const browser = await chromium.launch(BINARIO ? { executablePath: BINARIO } : { channel: "chrome" });
let page;

/**
 * Carica un dataset **in un archivio nuovo**, e verifica che sia lui.
 *
 * Il contesto si rifà da capo per ogni dataset, e non è pignoleria: il
 * dimostrativo, caricato sopra la vetrina, **conserva le impostazioni**. La
 * prima stesura di questo strumento ha misurato così un finto forfettario —
 * i documenti del dimostrativo sotto il profilo ordinario di Elena Marani — e
 * il prospetto mostrava «39.550,00 € di ricavi meno 9.291,00 € di costi
 * deducibili» dove doveva esserci una moltiplicazione per il coefficiente. Il
 * controllo del coefficiente non falliva: non trovava la riga, che è il modo
 * peggiore di passare.
 */
async function carica(nomePulsante, prefissoId) {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 900 },
    locale: "it-IT",
    timezoneId: "Europe/Rome",
  });
  page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(GIORNO));
  await page.goto(`${BASE}/app/dati/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1_500);
  await page.getByRole("button", { name: nomePulsante }).first().click();
  await page.waitForTimeout(3_000);

  /*
    Che l'archivio sia quello che pensiamo, e non un altro che gli somiglia.

    Lo strumento delle schermate ha premuto una volta il pulsante sbagliato —
    «Carica «Dimostrativo · forfettario»» corrispondeva al motivo cercato — e
    ne sono uscite quattro immagini credibili di un'attività che non esiste.
    Gli identificativi sono l'unica cosa che i due dataset non condividono.
  */
  const conta = await page.evaluate(async () => {
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
    return (await leggi("fatture")).map((r) => String(r.id));
  });
  const estranee = conta.filter((id) => !id.startsWith(prefissoId));
  if (conta.length === 0 || estranee.length > 0) {
    console.error(
      `L'archivio non è «${nomePulsante}»: ${estranee.length} fatture su ${conta.length} senza id «${prefissoId}».`,
    );
    await browser.close();
    server.close();
    process.exit(1);
  }
  return conta.length;
}

/** Le righe del prospetto, ciascuna con la sua formula aperta. */
async function righeDelProspetto() {
  await page.goto(`${BASE}/app/fisco/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2_500);
  /*
    Prima le sezioni, poi i dettagli: una riga dentro una sezione chiusa non è
    cliccabile, e la seconda passata prende quelle che la prima ha scoperto.
    Il clic si dà da dentro la pagina perché mira all'elemento e non al punto
    dello schermo — un pulsante fuori dalla finestra è comunque il pulsante di
    quella riga, e qui non si sta fotografando niente.
  */
  for (let passata = 0; passata < 3; passata += 1) {
    await page.evaluate(() => {
      // Le sezioni C e D del prospetto nascono chiuse: le loro righe non stanno
      // nel DOM finché il `<details>` non si apre, e un controllo che non le
      // aprisse direbbe «non c'è la riga della Gestione Separata» ogni volta,
      // cioè misurerebbe sé stesso.
      for (const d of document.querySelectorAll("details")) d.open = true;
      for (const b of document.querySelectorAll('button[aria-expanded="false"]')) {
        if (/^Come si calcola/.test(b.getAttribute("aria-label") ?? "")) b.click();
      }
    });
    await page.waitForTimeout(600);
  }

  return page.evaluate(() =>
    [...document.querySelectorAll('button[aria-label^="Come si calcola"]')]
      .map((b) => {
        const involucro = b.closest("div.flex")?.parentElement;
        const righe = (involucro?.innerText ?? "").split("\n").map((r) => r.trim()).filter(Boolean);
        return {
          etichetta: righe[0] ?? "",
          valore: righe[1] ?? "",
          dettaglio: righe.slice(2).join(" "),
        };
      })
      .filter((r) => r.etichetta && r.dettaglio),
  );
}

/**
 * Il semaforo del cruscotto: i segmenti sommano il denaro entrato in cassa.
 *
 * È l'invariante della schermata che il registro doveva coprire. Le sue due
 * formule erano già divergenti fra il cruscotto e la pagina del sistema visivo
 * e nessuno se n'era accorto, perché una delle due stava in una schermata che
 * «non contava» — e le schermate che non contano sono quelle che nessuno
 * controlla.
 *
 * I segmenti sono tre o quattro secondo il regime: nel forfettario l'IVA non si
 * incassa e la voce non compare. Contarli sarebbe misurare una presenza; qui si
 * sommano quelli che ci sono e si guarda se fanno l'intero.
 */
async function verificaSemaforo(quale) {
  await page.goto(`${BASE}/app/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2_500);
  const righe = (await page.evaluate(() => document.body.innerText))
    .split("\n")
    .map((r) => r.trim());

  /*
    Il sottotitolo dice l'intero da scomporre: «53,7 % di 53.692,20 € entrati in
    cassa, IVA compresa». Il totale si legge da lì e non da «Incassato», che è
    al netto dell'IVA: sono due numeri diversi, e confonderli farebbe fallire il
    controllo per il motivo sbagliato.
  */
  const intestazione = righe.find((r) => r.includes("entrati in cassa"));
  const intero = intestazione ? numeriDi(intestazione)[1] : null;

  const segmenti = new Map();
  for (const nome of ["Netto tuo", "Imposte", "Contributi", "IVA incassata"]) {
    const i = righe.indexOf(nome);
    if (i >= 0 && righe[i + 1]?.includes("\u20ac")) segmenti.set(nome, numeriDi(righe[i + 1])[0]);
  }

  if (intero === null || segmenti.size < 3) {
    problemi.push(
      `${quale}: il semaforo non si legge — ${segmenti.size} segmenti, totale ${intero}`,
    );
    return;
  }
  const somma = round2([...segmenti.values()].reduce((a, b) => a + b, 0));
  sostiene(
    pari(somma, intero, 0.05),
    `${quale} · semaforo: ${[...segmenti].map(([n, v]) => `${n} ${v}`).join(" + ")} = ${somma}, entrati in cassa ${intero}`,
  );
}

const cerca = (righe, inizio) => righe.find((r) => r.etichetta.startsWith(inizio));

// ————————————————————————————————————————————————————————————
// 1 · La vetrina: ordinario, Gestione Separata
// ————————————————————————————————————————————————————————————

console.log("Vetrina (ordinario · Gestione Separata)");
console.log(`  ${await carica(/Vetrina/, "vet-")} fatture, tutte sue.`);
const vetrina = await righeDelProspetto();
sostiene(vetrina.length > 6, `il prospetto porta ${vetrina.length} righe spiegate`);

{
  /*
    Il contributo della Gestione Separata: base × aliquota, col tetto.

    È la voce che ha cambiato strada in questa tornata — aliquota e massimale
    ora escono dal registro invece che da due letture delle impostazioni — e la
    formula qui accanto la scrive `spiegazioni.ts`, mentre l'importo lo calcola
    `motore.ts`. Se le due sorgenti divergessero, il divario si vedrebbe qui e
    da nessun'altra parte.
  */
  const r = cerca(vetrina, "Gestione Separata");
  if (!r) {
    problemi.push("nel prospetto della vetrina manca la riga della Gestione Separata");
  } else {
    const [base, aliquota, massimale] = numeriDi(r.dettaglio);
    const importo = numeriDi(r.valore)[0];
    sostiene(
      Number.isFinite(base) && Number.isFinite(aliquota) && Number.isFinite(massimale),
      `la formula della Gestione Separata porta tre numeri: ${r.dettaglio}`,
    );
    sostiene(
      pari(round2((base * aliquota) / 100), importo),
      `Gestione Separata: ${base} × ${aliquota} % = ${round2((base * aliquota) / 100)}, a schermo ${importo}`,
    );
    sostiene(base <= massimale, `la base ${base} non supera il massimale ${massimale}`);
  }

  const r2 = cerca(vetrina, "Reddito lordo");
  if (!r2) {
    problemi.push("nel prospetto della vetrina manca il reddito lordo");
  } else {
    const [ricavi, costi] = numeriDi(r2.dettaglio);
    const importo = numeriDi(r2.valore)[0];
    sostiene(
      pari(round2(ricavi - costi), importo),
      `reddito lordo ordinario: ${ricavi} − ${costi} = ${round2(ricavi - costi)}, a schermo ${importo}`,
    );
  }

  await verificaSemaforo("vetrina");

  const r3 = cerca(vetrina, "Accredito contributivo");
  if (!r3) {
    problemi.push("nel prospetto della vetrina manca l'accredito contributivo");
  } else {
    /*
      La riga dell'accredito dice un giudizio, non un importo: «Anno intero
      accreditato» oppure no. Il giudizio arriva dal motore, i due numeri della
      frase dalle spiegazioni, e nella tornata precedente venivano da due
      letture diverse del minimale. Qui si verifica che il giudizio segua i suoi
      stessi numeri.
    */
    const [minimale, reddito] = numeriDi(r3.dettaglio);
    const intero = r3.valore.includes("intero");
    sostiene(
      intero === reddito >= minimale,
      `accredito: reddito ${reddito} contro minimale ${minimale} → a schermo «${r3.valore}»`,
    );
  }
}

// ————————————————————————————————————————————————————————————
// 2 · Il dimostrativo: forfettario, coefficiente ATECO
// ————————————————————————————————————————————————————————————

console.log("\nDimostrativo (forfettario)");
console.log(`  ${await carica(/Dimostrativo/, "fat-")} fatture, tutte sue.`);
const demo = await righeDelProspetto();

{
  /*
    Il reddito lordo del forfettario: ricavi × coefficiente.

    Il coefficiente è la voce entrata adesso nel registro, e la sua fonte è
    cambiata: non più la copia salvata nelle impostazioni ma il gruppo ATECO
    scelto. Se le due divergessero — ed è successo, importando un backup — qui
    la moltiplicazione non tornerebbe.
  */
  const r = cerca(demo, "Reddito lordo");
  if (!r) {
    problemi.push("nel prospetto del dimostrativo manca il reddito lordo");
  } else {
    const [ricavi, coefficiente] = numeriDi(r.dettaglio);
    const importo = numeriDi(r.valore)[0];
    sostiene(
      pari(round2((ricavi * coefficiente) / 100), importo, 0.6),
      `reddito lordo forfettario: ${ricavi} × ${coefficiente} % = ${round2((ricavi * coefficiente) / 100)}, a schermo ${importo}`,
    );
  }

  const r2 = cerca(demo, "Imposta sostitutiva");
  if (!r2) {
    problemi.push("nel prospetto del dimostrativo manca l'imposta sostitutiva");
  } else {
    const [imponibile, aliquota] = numeriDi(r2.dettaglio);
    const importo = numeriDi(r2.valore)[0];
    sostiene(
      pari(round2((imponibile * aliquota) / 100), importo, 0.6),
      `sostitutiva: ${imponibile} × ${aliquota} % = ${round2((imponibile * aliquota) / 100)}, a schermo ${importo}`,
    );
  }
}

// ————————————————————————————————————————————————————————————
// 3 · La capacità: giorni × ore, sul dimostrativo
// ————————————————————————————————————————————————————————————

{
  /*
    «1.100 ore fatturabili all'anno: 220 giorni per 5 ore».
    Il prodotto e i due fattori nella stessa frase, e fino a ieri il prodotto
    lo faceva `oreFatturabiliAnno` leggendo i campi grezzi mentre la frase li
    stampava per conto suo. Adesso passano tutti e tre dal registro: questa è
    la misura che lo dice.
  */
  await page.goto(`${BASE}/app/pianificazione/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2_500);
  const frase = await page.evaluate(() => {
    const testo = document.body.innerText;
    const riga = testo.split("\n").find((r) => r.includes("ore fatturabili all'anno"));
    return riga ?? null;
  });
  if (!frase) {
    problemi.push("la pianificazione non dice più quante ore fatturabili ci sono all'anno");
  } else {
    const [anno, giorni, ore] = numeriDi(frase);
    sostiene(
      anno === giorni * ore,
      `capacità: ${giorni} giorni × ${ore} ore = ${giorni * ore}, a schermo ${anno} — «${frase}»`,
    );
  }

  // Nel forfettario i segmenti sono tre: l'IVA non si incassa.
  await verificaSemaforo("dimostrativo");
}

// ————————————————————————————————————————————————————————————
// 4 · L'impronta del PDF dei Termini è quella del file che si scarica
// ————————————————————————————————————————————————————————————

{
  /*
    L'impronta stampata accanto al link serve a dimostrare, fra due anni, che il
    PDF nel fascicolo di un ordine è quello. Una pagina che ne mostrasse una
    qualunque — di un file precedente, di un file vuoto — non direbbe di essere
    sbagliata: sessantaquattro cifre esadecimali si somigliano tutte, ed è la
    forma perfetta di questo difetto.

    Qui l'impronta si ricalcola sul file **come lo serve il sito**, e si cerca
    nel testo della pagina. Non si controlla che una impronta ci sia.
  */
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 900 }, locale: "it-IT" });
  const p = await ctx.newPage();

  for (const rotta of ["/termini/", "/acquista/"]) {
    await p.goto(`${BASE}${rotta}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    const testo = await p.evaluate(() => document.body.innerText);
    const link = await p.evaluate(() => {
      const a = [...document.querySelectorAll("a[href$='.pdf']")][0];
      return a ? a.getAttribute("href") : null;
    });

    if (!link) {
      problemi.push(`${rotta}: non c'è nessun collegamento a un PDF`);
      continue;
    }
    let byte;
    try {
      byte = readFileSync(join(RADICE, link));
    } catch {
      problemi.push(`${rotta}: il PDF «${link}» non esiste nel sito costruito`);
      continue;
    }
    const vera = createHash("sha256").update(byte).digest("hex");
    sostiene(
      byte.length > 2_000,
      `${rotta}: il PDF pesa ${byte.length} byte`,
    );
    sostiene(
      testo.includes(vera),
      `${rotta}: l'impronta a schermo è quella del file (${vera.slice(0, 16)}…)`,
    );
  }

  /*
    La casella della dichiarazione è una condizione, non un aspetto: senza
    spunta il collegamento al pagamento non deve avere un indirizzo. Si misura
    l'attributo `href`, che è ciò che rende un link raggiungibile — non il
    colore, che un utente da tastiera non vede.
  */
  await p.goto(`${BASE}/acquista/`, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  const casella = p.locator('input[type="checkbox"]').first();
  if ((await casella.count()) === 0) {
    problemi.push("/acquista/: manca la casella della dichiarazione professionale");
  } else {
    const paga = p.locator("a", { hasText: /^Paga / }).first();
    if ((await paga.count()) === 0) {
      // Col Payment Link ancora al segnaposto la pagina mostra l'avviso, non il
      // pulsante: è il comportamento voluto, e va detto invece che dato per
      // buono in silenzio.
      const avviso = await p.evaluate(() => document.body.innerText);
      sostiene(
        avviso.includes("non è ancora attivo"),
        "/acquista/: senza Payment Link la pagina lo dichiara invece di mostrare un pulsante muto",
      );
    } else {
      const prima = await paga.getAttribute("href");
      await casella.check();
      await p.waitForTimeout(200);
      const dopo = await paga.getAttribute("href");
      sostiene(
        prima === null && typeof dopo === "string" && dopo.length > 0,
        `/acquista/: senza spunta il pulsante non ha indirizzo (${prima}), con la spunta sì`,
      );
    }
  }
  await ctx.close();
}

// ————————————————————————————————————————————————————————————

await browser.close();
server.close();

for (const f of fatti) console.log(`  ok   ${f}`);
for (const p of problemi) console.log(`  NO   ${p}`);
console.log(
  `\n${fatti.length} verificate, ${problemi.length} fuori posto.`,
);
process.exit(problemi.length === 0 ? 0 : 1);
