#!/usr/bin/env node
/**
 * Cosa c'è online adesso, e coincide con il ramo?
 *
 *   npm run verifica:versione
 *   node strumenti/verifica-versione.mjs --sito=https://…  --contro=origin/HEAD
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La domanda che non sapeva nessuno
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Vercel pubblica, e da fuori non si vede **cosa** ha pubblicato. Si apre il
 * sito, si vede una pagina, e si dà per scontato che sia quella del ramo.
 * Quando non lo è — un build fallito, una distribuzione ferma a metà, un ramo
 * diverso da quello che si crede — il sintomo è che il sito funziona benissimo
 * e racconta qualcosa di vecchio. È il difetto di `artefatto.mjs` spostato di
 * un piano: non la copia sbagliata sul proprio disco, la copia sbagliata in
 * produzione.
 *
 * Da oggi il sito lo dichiara, in `/versione.json`. Questo strumento lo legge e
 * lo confronta: **il confronto lo fa lui, non l'occhio di chi legge.** Due SHA
 * di quaranta cifre guardati a vista sono il modo di dirsi «sì, è quello» sul
 * commit sbagliato.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Cosa NON fa
 * ─────────────────────────────────────────────────────────────────────────
 *
 * — **Non pubblica niente e non manda niente.** Una richiesta GET a un file
 *   pubblico, e basta.
 * — **Non sa se una distribuzione è in corso.** Subito dopo un push il sito
 *   risponde ancora con il commit di prima, ed è normale per qualche minuto:
 *   dice «diverso», e sta a chi legge sapere di aver appena spinto.
 * — **Non ha accesso a Vercel.** Non può dire perché diverge, solo che diverge
 *   e di quanti commit.
 */
import { execFileSync } from "node:child_process";

const opzione = (nome, predefinito = "") => {
  const trovata = process.argv.slice(2).find((a) => a.startsWith(`--${nome}=`));
  return trovata ? trovata.slice(nome.length + 3) : predefinito;
};

/*
  Lo stesso indirizzo di `DOMINIO` in src/lib/sito/impostazioni.ts. È scritto
  qui perché questo è un .mjs e quello è TypeScript; un test li confronta, così
  la seconda copia non può divergere dalla prima senza che qualcuno lo sappia.
*/
const SITO = opzione("sito", "https://flowlance.it").replace(/\/$/, "");
const CONTRO = opzione("contro", "HEAD");
const PERCORSO = "/versione.json";

const gitIn = (...args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};

const atteso = gitIn("rev-parse", CONTRO);
if (!atteso) {
  console.error(`\n  Non riesco a risolvere «${CONTRO}» con git. Sei dentro il repository?\n`);
  process.exit(1);
}

/*
  Tre modi di non sapere, e tre spiegazioni diverse.

  La prima stesura li appiattiva in uno solo — «se il sito risponde ma questo
  file no, è pubblicata una versione precedente» — e alla prima esecuzione ha
  attribuito a una distribuzione vecchia un 403 che veniva dal proxy della rete
  da cui stavo lanciando. Il sito non c'entrava niente. Una causa plausibile e
  sbagliata è esattamente quello che questo strumento esiste per non fare.
*/
let grezzo = null;
let errore = null;
try {
  const risposta = await fetch(`${SITO}${PERCORSO}`, { redirect: "follow" });
  if (risposta.status === 404) {
    errore = {
      titolo: "Il file non c'è ancora",
      righe: [
        `${SITO}${PERCORSO} risponde 404.`,
        "",
        "Online è pubblicata una versione costruita prima che versione.json",
        "esistesse. La prima distribuzione dopo questa modifica lo mette, e da",
        "lì in avanti questa verifica ha qualcosa da leggere.",
      ],
    };
  } else if (!risposta.ok) {
    errore = {
      titolo: "Non so cosa c'è online",
      righe: [
        `${SITO}${PERCORSO} risponde ${risposta.status} ${risposta.statusText}.`,
        "",
        "Non è un 404, quindi non è «il file non c'è ancora»: è il sito, o",
        "qualcosa fra te e il sito, che risponde altro. Un 403 arriva spesso da",
        "un proxy aziendale e non dal server.",
      ],
    };
  } else {
    grezzo = await risposta.json().catch(() => null);
    if (grezzo === null) {
      errore = {
        titolo: "Non so cosa c'è online",
        righe: [`${SITO}${PERCORSO} risponde, ma non con del JSON.`],
      };
    }
  }
} catch (e) {
  errore = {
    titolo: "Non sono arrivato al sito",
    righe: [
      `${SITO}${PERCORSO}: ${e.message}`,
      "",
      "La richiesta non è partita o non è tornata. Questo non dice niente su",
      "cosa c'è online: dice solo che da qui non si vede.",
    ],
  };
}

if (errore) {
  console.error(
    ["", `  ┌─ ${errore.titolo}`, ...errore.righe.map((r) => `  │  ${r}`.trimEnd()), "  └─", ""].join(
      "\n",
    ),
  );
  process.exit(1);
}

/*
  Il confronto vero sta in `src/lib/sito/versione.ts` e qui si ripete in due
  righe soltanto perché questo file è un .mjs: la forma dello SHA e l'uguaglianza
  sono le stesse, e un test le tiene allineate confrontando il modulo con i casi
  che questo strumento sa produrre.
*/
const online = typeof grezzo.commit === "string" ? grezzo.commit.trim().toLowerCase() : "";
const costruito = typeof grezzo.costruito === "string" ? grezzo.costruito : "data sconosciuta";
if (!/^[0-9a-f]{40}$/.test(online)) {
  console.error(`\n  ${PERCORSO} non porta un commit: «${String(grezzo.commit)}».\n`);
  process.exit(1);
}

const breve = (sha) => sha.slice(0, 12);

if (online === atteso) {
  console.log(
    `\n  Online e ${CONTRO} sono lo stesso commit: ${breve(online)}\n  costruito il ${costruito}\n`,
  );
  process.exit(0);
}

/*
  Di quanti commit sono distanti, e in che verso. `rev-list --count` su due ref
  dice quanti ce ne sono da una parte e quanti dall'altra: è la differenza fra
  «diverso» e «indietro di tre».
*/
const distanza = gitIn("rev-list", "--left-right", "--count", `${online}...${atteso}`);
const [avanti, indietro] = distanza ? distanza.split(/\s+/).map(Number) : [null, null];
/*
  `--left-right --count` dà due numeri: quanti commit ha il primo ref che il
  secondo non ha, e viceversa. Sono tre casi diversi e vanno detti diversi — la
  prima stesura li appiattiva su «indietro di N, e avanti di M che qui non ci
  sono», e su un `--contro=HEAD~2` stampava «avanti di 2 che qui non ci sono»
  per due commit che stavano proprio lì.
*/
const commit = (n) => `${n} ${n === 1 ? "commit" : "commit"}`;
const racconto =
  distanza === null
    ? "  │  Il commit online non è in questo clone: fai `git fetch`, o viene da un altro ramo."
    : avanti > 0 && indietro > 0
      ? `  │  I due sono divergenti: online ha ${commit(avanti)} che ${CONTRO} non ha,\n`
        + `  │  e ${CONTRO} ne ha ${indietro} che online non ha.`
      : indietro > 0
        ? `  │  Online è indietro di ${commit(indietro)} rispetto a ${CONTRO}.`
        : `  │  Online è avanti di ${commit(avanti)} rispetto a ${CONTRO}.`;

console.error(
  [
    "",
    "  ┌─ Il sito online non è il commit del ramo",
    `  │  online   ${breve(online)} · costruito il ${costruito}`,
    `  │  ${CONTRO.padEnd(8)} ${breve(atteso)}`,
    "  │",
    racconto,
    "  │",
    "  │  Se hai appena spinto, la distribuzione ci mette qualche minuto: rilancia.",
    "  │  Altrimenti c'è un build che non è arrivato in fondo, e il sito sta",
    "  │  raccontando qualcosa di vecchio senza dare nessun segno.",
    "  └─",
    "",
  ].join("\n"),
);
process.exit(1);
