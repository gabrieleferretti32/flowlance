#!/usr/bin/env node
/**
 * Quello che la pagina promette, il contratto lo garantisce. Alla lettera.
 *
 *   npm run build
 *   npm run verifica:offerta
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché su `out/` e non sul sorgente
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `src/lib/sito/offerta.test.ts` verifica gli stessi tre numeri sulle
 * costanti, e ci arriva prima — gira a ogni `npm test`, senza build. Quello
 * che non può fare è leggere la **frase composta**: il sottotitolo nasce da un
 * template che unisce il numero dei posti e un prezzo che viene da un altro
 * modulo, e il risultato esiste solo quando la pagina è costruita. Lo stesso
 * vale per le due parole proibite: «per sempre» potrebbe entrare in una
 * stringa messa insieme a pezzi, che nessuna ricerca nel sorgente trova.
 *
 * Qui si legge quello che il browser riceve. Il testo delle pagine di `out/`,
 * i numeri che ci sono dentro, e il contratto in `contenuti/termini.md` che
 * deve dire gli stessi.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le due direzioni dello stesso errore
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Se la pagina promette **più** del contratto è pubblicità ingannevole: 50
 * posti a schermo e 30 nella clausola vuol dire venti persone a cui è stato
 * promesso un prezzo che nessuno deve. Se promette **meno** è un regalo:
 * chiunque legga la clausola ottiene qualcosa che la pagina non offriva. Non
 * si sceglie quale dei due sorvegliare — si pretende che i numeri siano gli
 * stessi, e il verso dello scostamento non conta.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Prima di misurare, si misura la misura
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un estrattore di testo che sbagliasse un'espressione troverebbe zero numeri
 * e direbbe «nessuno scostamento», con la stessa faccia di un sito giusto.
 * Perciò ogni numero cercato deve essere **trovato** da tutte e due le parti:
 * un valore che manca è un errore, non un controllo che si salta.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { esigiArtefattoFresco } from "./artefatto.mjs";

// Prima di ogni altra cosa: out/ è il sito del sorgente di adesso?
esigiArtefattoFresco();

const RADICE = resolve("out");
const CONTRATTO = "contenuti/termini.md";
const PAGINA_OFFERTA = "simulatore";

/**
 * Le due parole che non devono comparire **in nessuna pagina**.
 *
 * I confini di parola non sono pignoleria: senza `\b`, «a vita» prende anche
 * «la vita», che in `/cosa-non-calcola/` c'è davvero — «che era la vita di
 * quell'archivio» — e lo strumento fallirebbe su una frase che non promette
 * niente a nessuno. Un controllo che grida al lupo viene spento, e da lì in
 * poi non guarda più nemmeno i lupi.
 */
const PROIBITE = [
  {
    espressione: /\bper sempre\b/i,
    perche: "la garanzia vale finché il Fornitore offre il rinnovo ai clienti esistenti (comma 3)",
  },
  {
    espressione: /\ba vita\b/i,
    perche: "la licenza è annuale e la garanzia è legata al rinnovo",
  },
];

// ————————————————————————————————————————————————————————————
// Il testo che il browser riceve
// ————————————————————————————————————————————————————————————

function html(cartella, trovate = []) {
  for (const voce of readdirSync(cartella, { withFileTypes: true })) {
    const percorso = join(cartella, voce.name);
    if (voce.isDirectory()) html(percorso, trovate);
    else if (voce.name.endsWith(".html")) trovate.push(percorso);
  }
  return trovate;
}

/**
 * Il testo visibile di una pagina costruita, senza i marcatori.
 *
 * Gli `<script>` e gli `<style>` si tolgono **prima** dei tag: dentro il
 * payload di Next c'è ogni stringa della pagina, scritta un'altra volta e con
 * le virgolette scappate, e cercarci dei numeri vorrebbe dire contarli due
 * volte in due grafie diverse. Le entità che contano qui — lo spazio
 * insecabile dei prezzi, l'apostrofo tipografico — si rimettono a mano: un
 * «97&nbsp;€» che resta tale non somiglia più a «97 €» e non si trova.
 */
function testoDi(file) {
  return readFileSync(file, "utf8")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;| /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const pagine = html(RADICE).map((file) => ({
  indirizzo: "/" + relative(RADICE, file).replaceAll("\\", "/").replace(/index\.html$/, ""),
  file,
  testo: testoDi(file),
}));

const offerta = pagine.find((p) => p.indirizzo === `/${PAGINA_OFFERTA}/`);

const problemi = [];
const fatti = [];

if (!offerta) {
  problemi.push(`in out/ non c'è la pagina /${PAGINA_OFFERTA}/: non ho niente da misurare`);
}

// ————————————————————————————————————————————————————————————
// I tre numeri, dalle due parti
// ————————————————————————————————————————————————————————————

const contratto = readFileSync(resolve(CONTRATTO), "utf8");
const clausola = (() => {
  const dal = contratto.indexOf("## 6-bis.");
  if (dal < 0) return null;
  const al = contratto.indexOf("\n## ", dal + 1);
  return contratto.slice(dal, al < 0 ? undefined : al);
})();

/**
 * La promessa che tira in ballo la clausola.
 *
 * Non si pretende il 6-bis sempre: si pretende **se** la pagina promette il
 * prezzo sui rinnovi. Il giorno in cui l'offerta cambia e quella promessa
 * sparisce, questo strumento non chiede più niente — non è un controllo sulla
 * presenza di una clausola, è un controllo sul fatto che una promessa sia
 * coperta.
 *
 * La prova è la parola `rinnov`, e non la frase intera «anche a ogni rinnovo»:
 * una frase riscritta in «il prezzo non cambia quando rinnovi» spegnerebbe
 * tutti i controlli qui sotto senza che nessuno lo chieda, e li spegnerebbe
 * proprio mentre la promessa resta. La radice prende anche una pagina che
 * parla di rinnovi per altre ragioni, e va bene: il verso in cui sbaglia è
 * pretendere una clausola che c'è.
 */
const promette = offerta ? /rinnov/i.test(offerta.testo) : false;

if (promette && clausola === null) {
  problemi.push(
    `/${PAGINA_OFFERTA}/ promette il prezzo «anche a ogni rinnovo», ma ${CONTRATTO} `
      + "non ha il punto 6-bis: è una promessa senza clausola che la renda esigibile",
  );
}

if (promette && clausola !== null) {
  fatti.push(`/${PAGINA_OFFERTA}/ promette il prezzo sui rinnovi, e il 6-bis lo garantisce`);

  const CONFRONTI = [
    {
      cosa: "i posti dei Fondatori",
      pagina: /(\d+)\s+posti rimasti/,
      contratto: /primi\s+(\d+)\s+acquirenti/,
    },
    {
      cosa: "il prezzo garantito",
      pagina: /(\d+)\s*€\s*\+\s*IVA l'anno/,
      /*
        «il prezzo di **rinnovo** di 97 €»: il comma 1 riscritto dal legale non
        dice più «garantisce, per ogni rinnovo successivo, il prezzo di 97 €».
        La vecchia espressione qui non trovava più niente — e questo strumento
        lo dice invece di tacere, che è il motivo per cui l'espressione la si
        pretende trovata da tutte e due le parti.
      */
      contratto: /il prezzo di rinnovo di\s+(\d+)\s*€\s*oltre IVA/,
    },
    {
      cosa: "i giorni per rinnovare",
      pagina: /entro\s+(\d+)\s+giorni dalla scadenza/,
      contratto: /entro\s+(\d+)\s+giorni dalla stessa/,
    },
  ];

  for (const confronto of CONFRONTI) {
    const inPagina = offerta.testo.match(confronto.pagina)?.[1];
    const inContratto = clausola.match(confronto.contratto)?.[1];
    if (inPagina === undefined) {
      problemi.push(
        `${confronto.cosa}: nella pagina costruita non trovo ${confronto.pagina}. `
          + "Il valore non si vede più dove si vedeva, e questo controllo senza di lui non misura niente",
      );
      continue;
    }
    if (inContratto === undefined) {
      problemi.push(
        `${confronto.cosa}: nel punto 6-bis non trovo ${confronto.contratto}. `
          + "La clausola è stata riscritta: questo controllo va riscritto con lei",
      );
      continue;
    }
    if (inPagina !== inContratto) {
      problemi.push(
        `${confronto.cosa}: la pagina dice ${inPagina}, il contratto ${inContratto}`,
      );
    } else {
      fatti.push(`${confronto.cosa}: ${inPagina} tanto in pagina quanto nel 6-bis`);
    }
  }

  /*
    E il rimando porta al punto, non in testa alla pagina. Un `href` con un
    frammento che dall'altra parte non esiste **non è un link rotto**: la
    pagina si apre, il browser non si lamenta, e chi ha cliccato «condizioni al
    punto 6-bis» si trova davanti al punto 1 con quattordici clausole da
    scorrere. È lo stesso tipo di silenzio del PDF alla versione vecchia.
  */
  const rimandi = [
    ...readFileSync(offerta.file, "utf8").matchAll(/href="(\/[^"#]*\/)#([^"]+)"/g),
  ];
  const aiTermini = rimandi.filter(([, dove]) => dove.includes("termini"));
  if (aiTermini.length === 0) {
    problemi.push(
      `/${PAGINA_OFFERTA}/ non porta a nessun punto dei Termini: le condizioni `
        + "essenziali nominano il 6-bis e non ci portano",
    );
  }
  for (const [, dove, ancora] of aiTermini) {
    const destinazione = pagine.find((p) => p.indirizzo === dove);
    if (!destinazione) {
      problemi.push(`il rimando a ${dove}#${ancora} porta a una pagina che in out/ non c'è`);
      continue;
    }
    if (readFileSync(destinazione.file, "utf8").includes(`id="${ancora}"`)) {
      fatti.push(`il rimando porta a ${dove}#${ancora}, che in quella pagina esiste`);
    } else {
      problemi.push(
        `${dove} non ha nessun elemento con id="${ancora}": il collegamento si apre `
          + "e porta in testa al documento, senza dirlo a nessuno",
      );
    }
  }
}

// ————————————————————————————————————————————————————————————
// Le due parole, su tutte le pagine
// ————————————————————————————————————————————————————————————

for (const { espressione, perche } of PROIBITE) {
  const colpevoli = pagine.filter((p) => espressione.test(p.testo));
  if (colpevoli.length > 0) {
    for (const p of colpevoli) {
      const intorno = p.testo.match(new RegExp(`.{0,60}${espressione.source}.{0,60}`, "i"))?.[0];
      problemi.push(`${p.indirizzo} dice ${espressione} — ${perche}:\n       «…${intorno}…»`);
    }
  } else {
    fatti.push(`nessuna delle ${pagine.length} pagine dice ${espressione}`);
  }
}

for (const f of fatti) console.log(`  ok   ${f}`);
for (const p of problemi) console.log(`  NO   ${p}`);

if (problemi.length > 0) {
  console.log(
    `\n${problemi.length} fuori posto fra la pagina e il contratto. Quello che la card `
      + "promette è esigibile solo nei termini in cui il 6-bis lo scrive.",
  );
  process.exit(1);
}
console.log(`\n${fatti.length} verificate, 0 fuori posto. La pagina promette quello che il contratto garantisce.`);
