#!/usr/bin/env node
/**
 * I metadati del sito costruito, verificati fra loro.
 *
 *   npm run build
 *   npm run verifica:metadati
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Cosa misura, e perché guarda `out/` e non il sorgente
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Che la tabella dei titoli sia coerente lo verifica `metadati.test.ts`, sul
 * sorgente. Questo strumento guarda **quello che è uscito**: i file HTML che un
 * motore scaricherà, il `robots.txt` che leggerà prima, e la `sitemap.xml` che
 * gli diciamo di prendere.
 *
 * Fra la tabella e i file c'è Next, e in mezzo ci sono tre cose che si possono
 * rompere senza che nessuno le veda aprendo il sito: un `<title>` che non
 * arriva nella pagina, un canonical che punta a un altro indirizzo, e le tre
 * facce — robots, meta, sitemap — che smettono di dire la stessa cosa.
 *
 * Nessuna richiesta e nessun browser: i metadati stanno nell'HTML servito, e
 * aprirli in un browser aggiungerebbe soltanto un modo di sbagliare.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { esigiArtefattoFresco } from "./artefatto.mjs";

// Prima di ogni altra cosa: out/ è il sito del sorgente di adesso?
esigiArtefattoFresco();

const RADICE = resolve("out");
const DOMINIO = "https://flowlance.it";

const problemi = [];
const fatti = [];
const sostiene = (ok, frase) => (ok ? fatti.push(frase) : problemi.push(frase));

// ————————————————————————————————————————————————————————————
// Le pagine costruite
// ————————————————————————————————————————————————————————————

function* pagine(cartella = RADICE) {
  for (const v of readdirSync(cartella, { withFileTypes: true })) {
    const percorso = join(cartella, v.name);
    if (v.isDirectory()) yield* pagine(percorso);
    else if (v.name === "index.html") yield percorso;
  }
}

/** L'indirizzo di una pagina costruita: `out/termini/index.html` → `/termini/`. */
const rottaDi = (percorso) => {
  const dentro = relative(RADICE, percorso).split(sep).slice(0, -1).join("/");
  return dentro === "" ? "/" : `/${dentro}/`;
};

const primo = (html, espressione) => html.match(espressione)?.[1] ?? null;
const attributo = (html, chiave, valore) =>
  primo(
    html,
    new RegExp(`<meta[^>]*${chiave}=["']${valore}["'][^>]*content=["']([^"']*)["']`, "i"),
  )
  ?? primo(
    html,
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${chiave}=["']${valore}["']`, "i"),
  );

const documenti = [...pagine()].map((percorso) => {
  const html = readFileSync(percorso, "utf8");
  const testa = html.slice(0, html.indexOf("</head>"));
  return {
    rotta: rottaDi(percorso),
    percorso,
    titolo: primo(testa, /<title>([^<]*)<\/title>/i),
    descrizione: attributo(testa, "name", "description"),
    canonical: primo(testa, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i),
    robots: attributo(testa, "name", "robots"),
    ogTitolo: attributo(testa, "property", "og:title"),
    ogDescrizione: attributo(testa, "property", "og:description"),
    ogUrl: attributo(testa, "property", "og:url"),
    twTitolo: attributo(testa, "name", "twitter:title"),
    twScheda: attributo(testa, "name", "twitter:card"),
    ogImmagine: attributo(testa, "property", "og:image"),
    ogLarghezza: attributo(testa, "property", "og:image:width"),
    ogAltezza: attributo(testa, "property", "og:image:height"),
    jsonLd: /<script[^>]*application\/ld\+json/i.test(testa),
    lang: primo(html, /<html[^>]*lang=["']([^"']*)["']/i),
  };
});

const APP = documenti.filter((d) => d.rotta.startsWith("/app"));
const PUBBLICHE = documenti.filter((d) => !d.rotta.startsWith("/app") && d.rotta !== "/404/");

sostiene(PUBBLICHE.length >= 6, `${PUBBLICHE.length} pagine pubbliche costruite`);
sostiene(APP.length > 10, `${APP.length} schermate dell'applicazione`);

// ————————————————————————————————————————————————————————————
// 1 · Ogni pagina pubblica si presenta
// ————————————————————————————————————————————————————————————

for (const d of PUBBLICHE) {
  const manca = [];
  if (!d.titolo) manca.push("title");
  if (!d.descrizione) manca.push("description");
  if (!d.canonical) manca.push("canonical");
  if (!d.ogTitolo) manca.push("og:title");
  sostiene(manca.length === 0, `${d.rotta} si presenta${manca.length ? `: manca ${manca.join(", ")}` : ""}`);
}

/*
  Il canonical punta a sé stesso, con la barra finale.

  `trailingSlash: true` fa rispondere il sito a `/termini` e a `/termini/`: senza
  canonical sono due indirizzi per un documento solo, e con un canonical
  sbagliato sono due documenti che si rimandano a vicenda. Si confronta con la
  rotta vera del file, non con una tabella: qui la domanda è se Next l'ha
  scritto giusto.
*/
for (const d of PUBBLICHE) {
  const atteso = `${DOMINIO}${d.rotta}`;
  sostiene(d.canonical === atteso, `${d.rotta}: canonical ${d.canonical ?? "assente"}`);
  if (d.ogUrl) sostiene(d.ogUrl === atteso, `${d.rotta}: og:url ${d.ogUrl}`);
}

/*
  Il titolo della scheda e quello dell'anteprima sono lo stesso.

  Sono due tag diversi che nascono dalla stessa stringa, e se un giorno
  qualcuno ne scrivesse uno a mano diventerebbero due testi che dicono cose
  diverse a due pubblici diversi — quello che il progetto chiama «due strade per
  la stessa cosa», spostato nella testa del documento dove nessuno guarda.
*/
for (const d of PUBBLICHE) {
  sostiene(
    d.ogTitolo === d.titolo,
    `${d.rotta}: og:title e <title> coincidono${d.ogTitolo === d.titolo ? "" : ` — «${d.ogTitolo}» contro «${d.titolo}»`}`,
  );
  sostiene(d.ogDescrizione === d.descrizione, `${d.rotta}: og:description e description coincidono`);
  if (d.twTitolo) sostiene(d.twTitolo === d.titolo, `${d.rotta}: twitter:title coincide`);
}

sostiene(
  documenti.every((d) => d.lang === "it"),
  `lang="it" su tutte e ${documenti.length} le pagine`,
);

// ————————————————————————————————————————————————————————————
// 2 · Le tre facce dicono la stessa cosa
// ————————————————————————————————————————————————————————————

const robots = readFileSync(join(RADICE, "robots.txt"), "utf8");
const bloccaTutto = /^\s*Disallow:\s*\/\s*$/m.test(robots);
const sitemapXml = readFileSync(join(RADICE, "sitemap.xml"), "utf8");
const inSitemap = [...sitemapXml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
const senzaNoindex = PUBBLICHE.filter((d) => !/noindex/i.test(d.robots ?? ""));

if (bloccaTutto) {
  // Sito chiuso: nessuna pagina indicizzabile, nessun indirizzo da prendere.
  sostiene(
    senzaNoindex.length === 0,
    `robots.txt blocca tutto e ${senzaNoindex.length} pagine non portano noindex`
      + (senzaNoindex.length ? `: ${senzaNoindex.map((d) => d.rotta).join(", ")}` : ""),
  );
  sostiene(
    inSitemap.length === 0,
    `robots.txt blocca tutto e la sitemap elenca ${inSitemap.length} indirizzi`,
  );
  sostiene(true, "stato: sito CHIUSO ai motori, e le tre facce lo dicono tutte");
} else {
  // Sito aperto: la sitemap elenca tutte e sole le pagine senza noindex.
  const attesi = senzaNoindex.map((d) => `${DOMINIO}${d.rotta}`).sort();
  const trovati = [...inSitemap].sort();
  sostiene(
    JSON.stringify(attesi) === JSON.stringify(trovati),
    attesi.length === trovati.length && JSON.stringify(attesi) === JSON.stringify(trovati)
      ? `la sitemap elenca le ${attesi.length} pagine senza noindex, e nessun'altra`
      : `sitemap e noindex non coincidono:\n       sitemap: ${trovati.join(", ")}\n       attesi:  ${attesi.join(", ")}`,
  );
  sostiene(/Disallow:\s*\/app\//.test(robots), "robots.txt esclude comunque /app/");
  sostiene(/Sitemap:/i.test(robots), "robots.txt annuncia la sitemap");
  sostiene(true, "stato: sito APERTO ai motori, e le tre facce lo dicono tutte");
}

/*
  L'applicazione resta fuori in tutti e due gli stati, e da due lati: il
  `robots.txt` dice di non passare, il meta dice di non indicizzare. Non passare
  e non indicizzare sono cose diverse — una pagina collegata da fuori può finire
  in un indice senza che nessuno l'abbia visitata.
*/
const appIndicizzabili = APP.filter((d) => !/noindex/i.test(d.robots ?? ""));
sostiene(
  appIndicizzabili.length === 0,
  `l'applicazione porta noindex su tutte e ${APP.length} le schermate`
    + (appIndicizzabili.length ? `: ${appIndicizzabili.map((d) => d.rotta).join(", ")}` : ""),
);
sostiene(
  inSitemap.every((u) => !u.includes("/app/")),
  "nessun indirizzo dell'applicazione nella sitemap",
);

// Ogni indirizzo elencato esiste davvero come pagina costruita.
const costruite = new Set(documenti.map((d) => `${DOMINIO}${d.rotta}`));
const fantasmi = inSitemap.filter((u) => !costruite.has(u));
sostiene(
  fantasmi.length === 0,
  `ogni indirizzo della sitemap esiste${fantasmi.length ? `: ${fantasmi.join(", ")} no` : ""}`,
);

// ————————————————————————————————————————————————————————————
// 3 · I dati strutturati della landing
// ————————————————————————————————————————————————————————————

{
  const landing = PUBBLICHE.find((d) => d.rotta === "/");
  const html = readFileSync(landing.percorso, "utf8");
  const blocco = html.match(
    /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i,
  )?.[1];

  if (!blocco) {
    problemi.push("la landing non porta dati strutturati");
  } else {
    let dati = null;
    try {
      dati = JSON.parse(blocco);
    } catch (e) {
      problemi.push(`i dati strutturati non sono JSON valido: ${e.message}`);
    }
    if (dati) {
      const nodi = dati["@graph"] ?? [dati];
      const app = nodi.find((n) => n["@type"] === "SoftwareApplication");
      const org = nodi.find((n) => n["@type"] === "Organization");
      sostiene(Boolean(app), "c'è un SoftwareApplication");
      sostiene(Boolean(org), "c'è un'Organization");

      if (app) {
        /*
          Il prezzo nei dati strutturati è quello della pagina. È il controllo
          che conta di più qui dentro: quel numero lo legge un motore e lo
          mostra accanto al risultato, e nessuno di noi lo vede mai. Un prezzo
          vecchio lì sarebbe la peggiore versione del difetto di sempre.
        */
        const prezzo = app.offers?.price;
        const testo = html.replace(/<[^>]+>/g, " ");
        const sullaPagina = [...testo.matchAll(/(\d{1,3}(?:\.\d{3})*)(?:,\d{2})?\s*(?:€|&#x20ac;)/g)]
          .map((m) => Number(m[1].replace(/\./g, "")));
        sostiene(
          prezzo !== undefined && sullaPagina.includes(Number(prezzo)),
          `il prezzo nei dati strutturati (${prezzo} €) è uno di quelli scritti sulla pagina`,
        );
        sostiene(app.offers?.priceCurrency === "EUR", `la valuta è ${app.offers?.priceCurrency}`);
        sostiene(
          app.offers?.priceSpecification?.valueAddedTaxIncluded === false,
          "i dati strutturati dichiarano che il prezzo è al netto dell'IVA",
        );
        sostiene(
          app.description === landing.descrizione,
          "la descrizione nei dati strutturati è quella della pagina",
        );
        sostiene(
          typeof app.offers?.url === "string" && app.offers.url.includes("/acquista/"),
          `l'offerta rimanda a ${app.offers?.url}`,
        );
      }
      if (org) {
        sostiene(
          typeof org.vatID === "string" && org.vatID.startsWith("IT"),
          `la partita IVA è dichiarata (${org.vatID})`,
        );
      }
    }
  }

  // E sta solo lì: un SoftwareApplication su ogni pagina direbbe che ogni
  // pagina è il prodotto.
  const altrove = PUBBLICHE.filter((d) => d.rotta !== "/" && d.jsonLd);
  sostiene(
    altrove.length === 0,
    `i dati strutturati stanno solo sulla landing${altrove.length ? `: anche su ${altrove.map((d) => d.rotta).join(", ")}` : ""}`,
  );
}

// ————————————————————————————————————————————————————————————
// 4 · Il favicon
// ————————————————————————————————————————————————————————————

for (const nome of ["favicon.ico", "icon.svg"]) {
  let byte = 0;
  try {
    byte = statSync(join(RADICE, nome)).size;
  } catch {
    byte = 0;
  }
  sostiene(byte > 0, `${nome} è pubblicato (${byte} byte)`);
}

// ————————————————————————————————————————————————————————————
// 4-bis · Da quale commit è costruito questo sito
// ————————————————————————————————————————————————————————————

/*
  `versione.json` è il file che risponde a «cosa c'è online adesso». Due cose
  vanno controllate qui, dove c'è il sito costruito: che sia stato pubblicato, e
  che porti **solo** lo SHA e la data.

  La seconda non è pignoleria: è un file pubblico su un sito che vende la
  promessa di non mandare dati da nessuna parte, e il giorno in cui qualcuno ci
  aggiunge «per comodità» il nome del ramo o l'autore del commit, quel giorno la
  promessa vale un po' meno e non se ne accorge nessuno.
*/
try {
  const versione = JSON.parse(readFileSync(join(RADICE, "versione.json"), "utf8"));
  const chiavi = Object.keys(versione).sort();
  sostiene(
    chiavi.length === 2 && chiavi[0] === "commit" && chiavi[1] === "costruito",
    `versione.json porta solo commit e data (${chiavi.join(", ")})`,
  );
  sostiene(
    /^[0-9a-f]{40}$/.test(String(versione.commit)),
    `versione.json dice da quale commit: ${String(versione.commit).slice(0, 12)}`,
  );
  sostiene(
    !Number.isNaN(Date.parse(String(versione.costruito))),
    `versione.json dice quando: ${versione.costruito}`,
  );
} catch {
  sostiene(false, "versione.json non è stato pubblicato, o non si legge");
}

// ————————————————————————————————————————————————————————————
// 5 · L'immagine di anteprima, quella che si vede solo in una chat
// ————————————————————————————————————————————————————————————

/*
  Qui non si rimisura il PNG: lo fa `src/lib/sito/anteprima.test.ts`, che ne
  apre i pixel, misura l'altezza dell'inchiostro del titolo e il contrasto.
  Quello che manca da lì è il pezzo che riguarda **il sito costruito**: che
  og:image ci sia su tutte le pagine pubbliche, che dica lo stesso indirizzo, e
  che a quell'indirizzo il file pubblicato sia byte per byte quello misurato.

  Un og:image che punta a un file che non è stato copiato è un rettangolo rotto
  al posto dell'anteprima, ed è invisibile da dentro: la pagina si apre bene.
*/
const conImmagine = PUBBLICHE.filter((d) => d.ogImmagine);
if (conImmagine.length === 0) {
  sostiene(true, "nessuna og:image dichiarata: i social mostreranno titolo e descrizione");
} else {
  sostiene(
    conImmagine.length === PUBBLICHE.length,
    `og:image su tutte le pagine pubbliche (${conImmagine.length} di ${PUBBLICHE.length})`,
  );
  const indirizzi = [...new Set(conImmagine.map((d) => d.ogImmagine))];
  sostiene(indirizzi.length === 1, `og:image è sempre lo stesso indirizzo: ${indirizzi.join(", ")}`);

  for (const d of conImmagine) {
    sostiene(
      d.twScheda === "summary_large_image",
      `${d.rotta}: twitter:card è ${d.twScheda ?? "assente"}`,
    );
  }

  const indirizzo = indirizzi[0];
  sostiene(/^https:\/\//.test(indirizzo), "og:image è un indirizzo assoluto, come vuole il protocollo");

  const dentro = indirizzo.replace(/^https?:\/\/[^/]+/, "");
  let pubblicato = null;
  try {
    pubblicato = readFileSync(join(RADICE, dentro));
  } catch {
    pubblicato = null;
  }
  sostiene(pubblicato !== null, `${dentro} è stato pubblicato in out/`);
  if (pubblicato) {
    const sorgente = readFileSync(join("public", dentro));
    sostiene(
      pubblicato.equals(sorgente),
      `${dentro} pubblicato è lo stesso file misurato (${pubblicato.length} byte)`,
    );
    sostiene(
      conImmagine.every((d) => d.ogLarghezza === "1200" && d.ogAltezza === "630"),
      `og:image:width e height dicono ${conImmagine[0].ogLarghezza}×${conImmagine[0].ogAltezza}`,
    );
  }
}

// ————————————————————————————————————————————————————————————

for (const f of fatti) console.log(`  ok   ${f}`);
for (const p of problemi) console.log(`  NO   ${p}`);
console.log(`\n${fatti.length} verificate, ${problemi.length} fuori posto.`);
process.exit(problemi.length === 0 ? 0 : 1);
