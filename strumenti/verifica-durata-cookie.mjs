#!/usr/bin/env node
/**
 * Quanto dura davvero il cookie che il pixel di Meta lascia nel browser.
 *
 *   npm run build
 *   npm run verifica:durata-cookie
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché questo strumento esiste
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Nella Cookie Policy c'è scritta una durata. Quella riga è un impegno verso
 * chi legge e verso il Garante, ed è stata scritta — come si scrivono quasi
 * tutte le righe di quel tipo — **copiando un numero che girava**, non
 * misurando il cookie.
 *
 * La documentazione di Meta, letta per intero, non pubblica la durata del
 * cookie `_fbp` che il pixel imposta da sé. I «90 giorni» che si trovano
 * ovunque stanno, nella pagina originale, in un posto diverso: sono il
 * suggerimento su come **tu** dovresti impostare `_fbc` dal tuo server. Detto
 * altrimenti: il numero più ripetuto del settore è la risposta a un'altra
 * domanda.
 *
 * Quindi si misura. Si apre il sito vero, si accetta dal banner vero, si
 * guarda il cookie che arriva e si legge la sua scadenza — e la si confronta
 * con quello che la Cookie Policy dichiara, letto dal file della Cookie
 * Policy. Due cose che devono restare d'accordo, e un posto solo in cui
 * l'accordo si rompe rumorosamente.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La domanda che il numero secco nasconde
 * ─────────────────────────────────────────────────────────────────────────
 *
 * «90 giorni» sembra un limite: passa il novantesimo giorno e finisce. Ma se
 * la scadenza viene riscritta a ogni visita, per chi torna sul sito non
 * finisce mai — e allora il numero, pur essendo esatto, dice una cosa falsa.
 * Perciò qui si visita **due volte** e si guarda se la scadenza si è spostata
 * in avanti. È l'unica differenza che conta per chi legge la policy.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Prima di misurare, si misura la misura
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Se questo strumento non trovasse il cookie perché non sa leggerlo,
 * scriverebbe «non l'ho trovato» con la stessa faccia con cui lo scriverebbe
 * se il cookie non ci fosse. Perciò il primo passo pianta un `_fbp` finto con
 * una scadenza nota e verifica di rileggerla: se la misura non vede la cosa
 * quando c'è, tutto quello che dice dopo non vale niente.
 */
import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright-core";
import { esigiArtefattoFresco } from "./artefatto.mjs";

esigiArtefattoFresco();

const opzione = (nome, predefinito = "") => {
  const trovata = process.argv.slice(2).find((a) => a.startsWith(`--${nome}=`));
  return trovata ? trovata.slice(nome.length + 3) : predefinito;
};

const RADICE = resolve("out");
const BINARIO = opzione("chromium", process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium");
const POLICY = "contenuti/cookie.md";
const GIORNI_PER_MESE = 30;
const TOLLERANZA_GIORNI = 10;

/** Il cookie che il pixel imposta da sé, e quello che nasce dal clic su un annuncio. */
const COOKIE = "_fbp";

// ————————————————————————————————————————————————————————————
// Cosa dichiara la Cookie Policy — letto dal file, non ricordato
// ————————————————————————————————————————————————————————————

function dichiarazione() {
  const testo = readFileSync(POLICY, "utf8");
  const paragrafo = testo
    .split(/\n\s*\n/)
    .find((p) => p.includes("Meta Pixel") && p.includes("Durata:"));
  if (!paragrafo) {
    throw new Error(
      `${POLICY}: non trovo il paragrafo del Meta Pixel con dentro «Durata:».\n`
        + "Se il pixel è stato tolto, togli anche questo strumento. Se è stato solo\n"
        + "riscritto, questo controllo non stava più guardando niente.",
    );
  }
  const mesi = paragrafo.match(/Durata:\s*(\d+)\s*mesi?\b/i);
  const giorni = paragrafo.match(/Durata:\s*(?:fino a\s*)?(\d+)\s*giorni?\b/i);
  if (!mesi && !giorni) {
    throw new Error(`${POLICY}: «Durata:» non è seguita da un numero di mesi o di giorni.`);
  }
  return {
    giorni: mesi ? Number(mesi[1]) * GIORNI_PER_MESE : Number(giorni[1]),
    /*
      Ricostruita per esteso, non presa dalla cattura. La prima stesura
      stampava «Durata: 3 mes», con la parola tagliata a metà
      dall'espressione regolare: un numero giusto sotto un'etichetta
      sbagliata, che è il modo in cui questi errori passano inosservati.
      Il numero era esatto e la riga era da buttare.
    */
    comeScritta: mesi
      ? `${Number(mesi[1])} mes${Number(mesi[1]) === 1 ? "e" : "i"}`
      : `${Number(giorni[1])} giorn${Number(giorni[1]) === 1 ? "o" : "i"}`,
    /*
      La policy dice anche che il conto **può ripartire**. È l'altra metà
      dell'impegno: se un giorno la misura dicesse che non riparte, quella
      frase andrebbe tolta — una cautela di troppo in un documento legale è
      comunque una cosa che non corrisponde.
    */
    diceCheRiparte: /ripart|rinnov/i.test(paragrafo),
  };
}

// ————————————————————————————————————————————————————————————
// Il sito vero, servito da out/
// ————————————————————————————————————————————————————————————

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
const HOST = "127.0.0.1";

const atteso = dichiarazione();
const browser = await chromium.launch(BINARIO ? { executablePath: BINARIO } : { channel: "chrome" });

const giorniDa = (scadenzaInSecondi, da = Date.now()) =>
  (scadenzaInSecondi * 1000 - da) / 86_400_000;

const trova = async (ctx) => (await ctx.cookies()).find((c) => c.name === COOKIE) ?? null;

const chiudi = async (codice) => {
  await browser.close();
  server.close();
  process.exit(codice);
};

// ————————————————————————————————————————————————————————————
// 0 · La misura vede il cookie quando c'è?
// ————————————————————————————————————————————————————————————

{
  const ctx = await browser.newContext();
  const fra = 42;
  await ctx.addCookies([{
    name: COOKIE,
    value: "fb.0.1757600000000.1234567890",
    domain: HOST,
    path: "/",
    expires: Math.floor(Date.now() / 1000) + fra * 86_400,
  }]);
  const letto = await trova(ctx);
  const visti = letto ? giorniDa(letto.expires) : null;
  await ctx.close();

  if (visti === null || Math.abs(visti - fra) > 1) {
    console.log(
      `\n  ┌─ La misura non funziona\n`
        + `  │  Ho piantato un ${COOKIE} che scade fra ${fra} giorni e ho riletto `
        + `${visti === null ? "niente" : `${visti.toFixed(1)} giorni`}.\n`
        + `  │\n`
        + `  │  Finché è così, «non ho trovato il cookie» non vorrebbe dire che il\n`
        + `  │  cookie non c'è: vorrebbe dire che non lo so leggere. Non misuro altro.\n`
        + `  └─`,
    );
    await chiudi(2);
  }
  console.log(`  ok   la misura legge la scadenza di un ${COOKIE} piantato apposta (${fra} giorni)`);
}

// ————————————————————————————————————————————————————————————
// 1 · Il sito vero, il banner vero, il cookie vero
// ————————————————————————————————————————————————————————————

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "it-IT" });
const bloccate = [];
ctx.on("requestfailed", (r) => {
  if (/facebook\.(net|com)/.test(r.url())) bloccate.push(`${r.url()} — ${r.failure()?.errorText}`);
});

const page = await ctx.newPage();
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

const banner = await page.getByRole("button", { name: "Accetta tutto" }).count();
if (banner !== 1) {
  console.log(
    `\n  ┌─ Non ho potuto misurare\n`
      + `  │  Sulla landing ci sono ${banner} banner dei cookie invece di uno: senza il\n`
      + `  │  pulsante «Accetta tutto» non posso dare il consenso, e senza consenso il\n`
      + `  │  pixel non parte. Non è il cookie a mancare — è la strada per arrivarci.\n`
      + `  └─`,
  );
  await chiudi(2);
}
await page.getByRole("button", { name: "Accetta tutto" }).click();

// Il cookie arriva quando fbevents.js è stato scaricato ed eseguito: si aspetta lui.
const scadenza = async (secondi = 15) => {
  for (let i = 0; i < secondi * 4; i += 1) {
    const c = await trova(ctx);
    if (c && c.expires > 0) return c.expires;
    await page.waitForTimeout(250);
  }
  return null;
};

const prima = await scadenza();

if (prima === null) {
  const perche = bloccate.length
    ? `Le richieste verso Meta non sono arrivate a destinazione:\n  │    ${[...new Set(bloccate)].slice(0, 3).join("\n  │    ")}`
    : "Il pixel non ha chiesto niente a Meta: o il consenso non è stato registrato,\n  │  oppure lo script non è nella pagina.";
  console.log(
    `\n  ┌─ Non ho potuto misurare\n`
      + `  │  Dopo «Accetta tutto» il cookie ${COOKIE} non è comparso.\n`
      + `  │  ${perche}\n`
      + `  │\n`
      + `  │  **Questo non dice che la Cookie Policy sbagli.** Dice che da qui non si\n`
      + `  │  raggiunge Meta, quindi la durata scritta in ${POLICY}\n`
      + `  │  (${atteso.comeScritta}) resta una dichiarazione e non una misura.\n`
      + `  │  Rilancialo da una rete che arrivi a connect.facebook.net.\n`
      + `  └─`,
  );
  await chiudi(2);
}

const giorniPrima = giorniDa(prima);
console.log(`  ok   dopo il consenso ${COOKIE} c'è, e scade fra ${giorniPrima.toFixed(1)} giorni`);

// ————————————————————————————————————————————————————————————
// 2 · La seconda visita: il conto riparte o no?
// ————————————————————————————————————————————————————————————

await page.waitForTimeout(3_000);
await page.goto(`${BASE}/acquista/`, { waitUntil: "networkidle" });
await page.waitForTimeout(2_000);
const dopo = (await trova(ctx))?.expires ?? prima;
const riparte = dopo - prima >= 2;

console.log(
  riparte
    ? `  ok   alla seconda visita la scadenza si è spostata in avanti di ${dopo - prima}s: **il conto riparte**`
    : `  ok   alla seconda visita la scadenza non si è mossa: il conto **non** riparte`,
);

// ————————————————————————————————————————————————————————————
// 3 · Quello che la policy dichiara e quello che il browser ha
// ————————————————————————————————————————————————————————————

const problemi = [];
const scarto = Math.abs(giorniPrima - atteso.giorni);
if (scarto > TOLLERANZA_GIORNI) {
  problemi.push(
    `${POLICY} dichiara «${atteso.comeScritta}» (${atteso.giorni} giorni), il browser ha `
      + `${giorniPrima.toFixed(1)} giorni. Scarto di ${scarto.toFixed(1)} giorni.`,
  );
} else {
  console.log(
    `  ok   la durata dichiarata («${atteso.comeScritta}») è quella vera, a meno di ${scarto.toFixed(1)} giorni`,
  );
}

if (riparte && !atteso.diceCheRiparte) {
  problemi.push(
    `Il conto riparte a ogni visita e ${POLICY} non lo dice: «${atteso.comeScritta}» letto da solo `
      + "sembra un limite assoluto, e per chi torna sul sito non lo è.",
  );
} else if (!riparte && atteso.diceCheRiparte) {
  problemi.push(
    `${POLICY} dice che il conto può ripartire, e la misura dice di no. È una cautela che non `
      + "corrisponde: va tolta, o va capito perché qui non riparte.",
  );
} else {
  console.log(`  ok   quello che la policy dice sul rinnovo è quello che succede`);
}

for (const p of problemi) console.log(`  NO   ${p}`);
console.log(
  problemi.length === 0
    ? `\nLa durata scritta nella Cookie Policy è misurata, non stimata.`
    : `\n${problemi.length} cose da sistemare in ${POLICY}.`,
);
await chiudi(problemi.length === 0 ? 0 : 1);
