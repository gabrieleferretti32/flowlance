#!/usr/bin/env node
/**
 * L'immagine di anteprima del sito, disegnata dalla landing vera.
 *
 *   npm run build             # serve out/ costruito
 *   npm run anteprima:immagine
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Da dove prende quello che disegna
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Niente di quello che finisce nell'immagine è scritto qui dentro:
 *
 * — **il titolo e l'occhiello** li legge dal `<h1>` e dalla riga sopra della
 *   landing costruita, che a loro volta escono da `APERTURA`
 *   (`src/lib/sito/apertura.ts`). Le righe del titolo sono `<span>` con
 *   `data-accento`, e da lì si sa quale va colorata;
 * — **le tinte** — fondo, inchiostro, accento — le prende da
 *   `getComputedStyle` degli stessi elementi, così il #4b5bf0 non è scritto una
 *   seconda volta;
 * — **il carattere** è quello che la pagina ha già caricato: l'immagine si
 *   disegna *dentro* il documento della landing, non in una pagina vuota, e
 *   quindi usa lo stesso woff2 con lo stesso peso;
 * — **il marchio** è `src/app/icon.svg`, infilato com'è. Non ridisegnato:
 *   messo dentro un `<img>` e basta, così non c'è un secondo disegno da tenere
 *   allineato al primo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il titolo non si adatta: se non ci sta, questo strumento si ferma
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il corpo è fisso. Una frase più lunga **va a capo**, e fin lì si adatta: il
 * riquadro ne tiene tre, di righe, e il disegno ne usa due. Dalla quarta in poi
 * lo strumento **si ferma**: non rimpicciolisce il testo e non lo taglia.
 *
 * È la stessa scelta del renderer del Markdown e del lettore del marchio.
 * Rimpicciolire da solo produrrebbe, senza dirlo, un'anteprima con il titolo
 * grande la metà del previsto: plausibile in ogni pixel e sbagliata, e nessuno
 * la guarda mai. Meglio fermarsi e far decidere a una persona se accorciare la
 * frase o allargare il riquadro.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La firma
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Prima di scrivere il file, dentro il PNG finisce un chunk `iTXt` con la
 * frase disegnata, l'occhiello e l'impronta del marchio. `next.config.ts` lo
 * rilegge a ogni build e ferma tutto se non coincide più con la pagina: è quel
 * che rende «generata a mano una volta» innocuo, perché l'immagine non può
 * restare indietro in silenzio.
 *
 * Opzioni:
 *   --chromium=percorso   un binario diverso da Chrome di sistema
 *   --file=percorso       scrive altrove, per guardarla prima di sostituirla
 *   --niente-scrittura    disegna e misura senza toccare il file
 */
import { createServer } from "node:http";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import { esigiArtefattoFresco } from "./artefatto.mjs";

// Prima di ogni altra cosa: out/ è il sito del sorgente di adesso?
esigiArtefattoFresco();

const opzione = (nome, predefinito = "") => {
  const trovata = process.argv.slice(2).find((a) => a.startsWith(`--${nome}=`));
  return trovata ? trovata.slice(nome.length + 3) : predefinito;
};
const bandiera = (nome) => process.argv.slice(2).includes(`--${nome}`);

const RADICE = resolve("out");
const BINARIO = opzione("chromium", process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium");
const SOLO_MISURA = bandiera("niente-scrittura");
const DOVE = opzione("file", "");

/*
  Gli stessi valori di `src/lib/sito/anteprima.ts`. Sono scritti qui perché
  questo file è un .mjs e quello è TypeScript: un test li confronta, così la
  seconda copia non può divergere dalla prima senza che qualcuno lo sappia.
*/
const MISURA = { larghezza: 1200, altezza: 630 };
const SORGENTE_MARCHIO = "src/app/icon.svg";
const FILE_ANTEPRIMA = "public/anteprima.png";
const CHIAVE_FIRMA = "Flowlance";

/** Il corpo del titolo nell'immagine, e quante righe il riquadro ne tiene. */
const CORPO = 74;
const INTERLINEA = 1.06;
/*
  Tre, e il disegno ne usa due.

  Non è la misura oltre la quale il testo sfonda fisicamente il riquadro —
  quella è la quinta riga, e a quel punto l'immagine sarebbe già una parete di
  testo con il marchio schiacciato in un angolo. È la misura oltre la quale
  l'anteprima smette di essere una frase che si legge in un colpo d'occhio, che
  è l'unica cosa che deve saper fare.
*/
const RIGHE_MASSIME = 3;

try {
  statSync(RADICE);
} catch {
  console.error("Non trovo out/. Esegui prima «npm run build».");
  process.exit(1);
}

// ————————————————————————————————————————————————————————————
// Il sito costruito, servito da un'origine sola
// ————————————————————————————————————————————————————————————

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

const marchioSvg = readFileSync(SORGENTE_MARCHIO, "utf8");
const improntaMarchio = createHash("sha256").update(readFileSync(SORGENTE_MARCHIO)).digest("hex").slice(0, 12);
const marchioUri = `data:image/svg+xml;base64,${Buffer.from(marchioSvg, "utf8").toString("base64")}`;

const browser = await chromium.launch(BINARIO ? { executablePath: BINARIO } : { channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: MISURA.larghezza, height: MISURA.altezza },
  deviceScaleFactor: 1,
});
await page.goto(`${BASE}/`, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);

/**
 * Legge dalla landing quello che serve, poi le sostituisce il corpo con la
 * scheda e la misura. Tutto dentro una `evaluate` sola: la lettura e il
 * disegno devono guardare lo stesso documento, e in mezzo non deve poterci
 * finire un ricaricamento.
 */
const esito = await page.evaluate(
  ({ marchioUri, corpo, interlinea, misura }) => {
    const h1 = document.querySelector("h1");
    if (!h1) return { errore: "la landing costruita non ha un <h1>." };
    const righe = [...h1.querySelectorAll("span[data-accento]")].map((s) => ({
      testo: s.textContent.trim(),
      accento: s.dataset.accento === "si",
      colore: getComputedStyle(s).color,
    }));
    if (righe.length === 0) {
      return { errore: "il <h1> della landing non ha righe con data-accento: markup cambiato?" };
    }
    const pOcchiello = h1.previousElementSibling;
    if (!pOcchiello) return { errore: "manca la riga di occhiello sopra il <h1>." };
    const occhiello = pOcchiello.textContent.trim();
    /*
      I valori calcolati vanno copiati adesso, in stringhe. `getComputedStyle`
      restituisce una dichiarazione **viva**: appena il corpo della pagina viene
      sostituito questi elementi non sono più nel documento e ogni proprietà
      torna vuota. La prima stesura li rileggeva dopo, e stampava un carattere
      e un colore vuoti in fondo al comando.
    */
    const stileH1 = getComputedStyle(h1);
    const stileOcchiello = getComputedStyle(pOcchiello);
    const inchiostro = stileH1.color;
    const carattere = stileH1.fontFamily;
    const coloreOcchiello = stileOcchiello.color;

    /*
      Il nome del prodotto sta già in testa alla scheda, in grande. L'occhiello
      della landing lo ripete — «Flowlance · per freelance italiani…» — perché
      là è l'unica firma di quella sezione; qui sarebbe la seconda volta in due
      righe. La scheda toglie il prefisso, e solo quello: il testo che va nella
      firma del PNG resta quello vero della pagina, che è ciò che il presidio
      confronta.
    */
    const nome = document.querySelector("header span")?.textContent.trim() || "Flowlance";
    const occhielloScheda = occhiello.replace(
      new RegExp(`^${nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*·\\s*`, "i"),
      "",
    );

    // Il fondo: il primo antenato che ne ha uno non trasparente.
    let fondo = "#ffffff";
    for (let e = h1; e; e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") {
        fondo = c;
        break;
      }
    }

    const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

    document.head.insertAdjacentHTML(
      "beforeend",
      `<style>
        html, body { margin: 0; padding: 0; overflow: hidden; }
        #scheda {
          box-sizing: border-box;
          width: ${misura.larghezza}px; height: ${misura.altezza}px;
          padding: 64px 72px;
          background: ${fondo};
          color: ${inchiostro};
          font-family: ${carattere};
          display: flex; flex-direction: column;
          position: relative; overflow: hidden;
        }
        #scheda .barra {
          position: absolute; left: 0; top: 0; bottom: 0; width: 10px;
          background: ${righe.find((r) => r.accento)?.colore ?? coloreOcchiello};
        }
        #scheda .testa { display: flex; align-items: center; gap: 16px; }
        #scheda .testa img { width: 60px; height: 60px; display: block; }
        #scheda .testa span {
          font-size: 36px; font-weight: 700; letter-spacing: -0.02em;
        }
        #scheda .centro { flex: 1; display: flex; flex-direction: column; justify-content: center; }
        #scheda .occhiello {
          margin: 0 0 22px; font-size: 20px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: ${coloreOcchiello};
        }
        #scheda h1.titolo {
          margin: 0; font-size: ${corpo}px; line-height: ${interlinea};
          letter-spacing: -0.035em; font-weight: 800; max-width: 980px;
        }
        #scheda .piede {
          display: flex; align-items: baseline; justify-content: space-between;
          font-size: 24px; font-weight: 700;
        }
        #scheda .piede .tenue { font-weight: 500; font-style: italic; opacity: 0.55; }
      </style>`,
    );
    document.body.innerHTML = `
      <div id="scheda">
        <span class="barra"></span>
        <div class="testa"><img src="${marchioUri}" alt=""><span>${esc(nome)}</span></div>
        <div class="centro">
          <p class="occhiello">${esc(occhielloScheda)}</p>
          <h1 class="titolo">${righe
            .map(
              (r, i) =>
                `${i > 0 ? "<br>" : ""}<span${r.accento ? ` style="color:${r.colore}"` : ""}>${esc(r.testo)}</span>`,
            )
            .join("")}</h1>
        </div>
        <div class="piede"><span>flowlance.it</span><span class="tenue">Forfettario e ordinario.</span></div>
      </div>`;

    const scheda = document.getElementById("scheda");
    const centro = scheda.querySelector(".centro");
    const titolo = scheda.querySelector("h1.titolo");
    const r = titolo.getBoundingClientRect();
    return {
      righe: righe.map(({ testo, accento }) => (accento ? { testo, accento } : { testo })),
      occhiello,
      fondo,
      inchiostro,
      carattere,
      riquadro: { x: Math.round(r.x), y: Math.round(r.y), larghezza: Math.round(r.width), altezza: Math.round(r.height) },
      quanteRighe: Math.round(r.height / (corpo * interlinea)),
      // Di quanto il contenuto supera lo spazio che ha. Zero vuol dire che ci sta.
      sfondaCentro: Math.max(0, centro.scrollHeight - centro.clientHeight),
      sfondaScheda: Math.max(0, scheda.scrollHeight - scheda.clientHeight),
      avanzaCentro: Math.max(0, centro.clientHeight - titolo.scrollHeight - 42),
      sfondaLarghezza: Math.max(0, titolo.scrollWidth - titolo.clientWidth),
    };
  },
  { marchioUri, corpo: CORPO, interlinea: INTERLINEA, misura: MISURA },
);

const chiudi = async () => {
  await browser.close();
  server.close();
};

if (esito.errore) {
  await chiudi();
  console.error(`\n  Non riesco a leggere la landing costruita: ${esito.errore}\n`);
  process.exit(1);
}

const sfonda = Math.max(esito.sfondaCentro, esito.sfondaScheda, esito.sfondaLarghezza);
const troppeRighe = esito.quanteRighe > RIGHE_MASSIME;
if (sfonda > 0 || troppeRighe) {
  await chiudi();
  console.error(
    [
      "",
      "  ┌─ Il titolo non ci sta nell'immagine",
      troppeRighe
        ? `  │  Va a capo ${esito.quanteRighe} volte, e il riquadro ne tiene ${RIGHE_MASSIME}.`
        : `  │  Sfonda il riquadro di ${sfonda} px (${esito.quanteRighe} righe a ${CORPO} px).`,
      "  │",
      "  │  Fin qui il testo si era adattato: a ogni parola in più il titolo manda",
      "  │  a capo da solo, e il disegno regge. Oltre non si adatta più, e questo",
      "  │  strumento **non** rimpicciolisce il corpo per farcelo stare: un titolo",
      "  │  grande la metà del previsto sarebbe plausibile in ogni pixel, e nessuno",
      "  │  guarda mai questa immagine per accorgersene.",
      "  │",
      "  │  Le tre strade, e la scelta è di chi scrive la frase:",
      "  │    · accorciare il titolo in src/lib/sito/apertura.ts — è quello che",
      "  │      compare anche in cima alla landing, e più corto sta meglio lì;",
      "  │    · scriverne uno diverso per l'immagine, se la frase della pagina",
      "  │      deve restare lunga (e allora diventano due frasi da tenere allineate);",
      "  │    · abbassare CORPO in strumenti/immagine-anteprima.mjs, sapendo che",
      "  │      sotto una certa misura l'anteprima non si legge più in miniatura —",
      "  │      quella soglia la tiene un test, e diventerebbe rosso.",
      "  └─",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const png = await page.screenshot({
  clip: { x: 0, y: 0, width: MISURA.larghezza, height: MISURA.altezza },
});
await chiudi();

// ————————————————————————————————————————————————————————————
// La firma dentro il file
// ————————————————————————————————————————————————————————————

const TAVOLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = TAVOLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/**
 * Un chunk `iTXt`, che è quello che sa scrivere UTF-8.
 *
 * `tEXt` avrebbe scritto Latin-1, e nel titolo c'è «€», che in Latin-1 non
 * esiste: la firma sarebbe uscita con dentro un carattere diverso da quello
 * disegnato, e il presidio si sarebbe fermato a ogni build per un difetto suo.
 */
function conFirma(png, chiave, testo) {
  const corpo = Buffer.concat([
    Buffer.from(chiave, "latin1"),
    // fine chiave, compressione spenta, metodo 0, lingua vuota, chiave tradotta vuota
    Buffer.from([0, 0, 0, 0, 0]),
    Buffer.from(testo, "utf8"),
  ]);
  const lunghezza = Buffer.alloc(4);
  lunghezza.writeUInt32BE(corpo.length);
  const conTipo = Buffer.concat([Buffer.from("iTXt", "latin1"), corpo]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(conTipo));
  // L'IEND è sempre l'ultimo chunk, e occupa dodici byte esatti.
  const taglio = png.length - 12;
  return Buffer.concat([png.subarray(0, taglio), lunghezza, conTipo, crc, png.subarray(taglio)]);
}

const firma = {
  occhiello: esito.occhiello,
  titolo: esito.righe,
  marchio: improntaMarchio,
  corpo: CORPO,
  riquadro: esito.riquadro,
};
const finale = conFirma(png, CHIAVE_FIRMA, JSON.stringify(firma));

const destinazione = DOVE || FILE_ANTEPRIMA;
if (SOLO_MISURA) {
  console.log("Solo misura, niente scrittura.");
} else {
  writeFileSync(destinazione, finale);
}

console.log(
  [
    `Anteprima: ${destinazione} · ${MISURA.larghezza}×${MISURA.altezza} · ${finale.length} byte`,
    `  titolo   ${esito.righe.map((r) => `«${r.testo}»`).join(" + ")}`,
    `  corpo    ${CORPO} px su ${esito.quanteRighe} righe · avanzano ${esito.avanzaCentro} px `
      + `(≈ ${Math.floor(esito.avanzaCentro / (CORPO * INTERLINEA))} righe)`,
    `  tinte    fondo ${esito.fondo} · inchiostro ${esito.inchiostro}`,
    `  marchio  ${SORGENTE_MARCHIO} · ${improntaMarchio}`,
    `  carattere ${esito.carattere}`,
  ].join("\n"),
);
