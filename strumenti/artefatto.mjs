/**
 * Il sito costruito è quello del sorgente di adesso?
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il difetto, che è di un piano sopra tutti gli altri
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Gli strumenti di verifica di questo progetto misurano `out/`, cioè il sito
 * costruito, e non il sorgente: è la scelta giusta, perché quello che finisce
 * online è `out/`. Ma vuol dire che una verifica **non sa** se sta guardando il
 * sito appena costruito o quello di ieri.
 *
 * È successo. Un `npm run build` si è fermato — `next.config.ts` importava un
 * modulo con gli alias `@/`, che dalla configurazione compilata non si
 * risolvono — e la verifica lanciata subito dopo ha misurato la cartella
 * rimasta dal build precedente. Ha detto **verde su un sito che non era quello
 * appena costruito**, e l'unico sintomo è stato un codice d'uscita 1 in mezzo a
 * un `&&`.
 *
 * È la stessa famiglia di difetti di tutto il resto, spostata di un piano: non
 * misurare la cosa sbagliata, ma misurare **la copia sbagliata**. E ha la
 * stessa risposta: meglio fermarsi dicendo «non ho niente da misurare» che
 * promuovere un artefatto vecchio.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Come si riconosce una copia vecchia
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Non a occhio sulle date: `out/` contiene file copiati da `public/` che si
 * portano dietro la loro data, e un confronto «il più recente di qua contro il
 * più recente di là» sarebbe un'euristica che sbaglia nei due sensi.
 *
 * Invece il build **timbra**: `timbra-artefatto.mjs` gira subito dopo
 * `next build` e scrive in `.artefatto.json` l'impronta dei file che decidono
 * cosa esce — percorso, dimensione e data di modifica di tutto ciò che entra
 * nel sito. Chi verifica ricalcola quell'impronta adesso e la confronta. Se
 * qualcosa è cambiato — un file modificato, aggiunto o tolto — l'impronta è
 * diversa e la verifica si rifiuta di partire.
 *
 * La direzione in cui sbaglia è quella giusta: un build fallito lascia il
 * timbro vecchio, il sorgente nel frattempo è cambiato, e il controllo si
 * ferma. Non promuove.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

/** Dove il build lascia il timbro. Fuori da `out/`: non è roba da pubblicare. */
export const TIMBRO = ".artefatto.json";

/**
 * Cosa entra nell'impronta: tutto ciò che può cambiare quello che esce.
 *
 * `strumenti/` no — sono questi file, e cambiarli non cambia il sito. I test
 * nemmeno: un `*.test.ts` non finisce nel bundle, e includerlo vorrebbe dire
 * rifiutare una verifica perché qualcuno ha corretto un'asserzione.
 */
const CARTELLE = ["src", "contenuti", "public"];
const FILE = [
  "next.config.ts",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "postcss.config.mjs",
  // Pubblicato su /cosa-non-calcola: sta alla radice, ma è contenuto del sito.
  "APPROSSIMAZIONI.md",
];
const IGNORA = /\.test\.[cm]?[jt]sx?$/;

function* camminata(cartella) {
  let voci;
  try {
    voci = readdirSync(cartella, { withFileTypes: true });
  } catch {
    return;
  }
  for (const v of voci.sort((a, b) => a.name.localeCompare(b.name))) {
    const percorso = join(cartella, v.name);
    if (v.isDirectory()) yield* camminata(percorso);
    else if (v.isFile() && !IGNORA.test(v.name)) yield percorso;
  }
}

/**
 * L'impronta del sorgente: percorso, dimensione e data di ogni file che conta.
 *
 * La data e non il contenuto perché deve costare poco — gira all'avvio di ogni
 * strumento — e perché la domanda non è «il contenuto è diverso» ma «qualcuno
 * ha toccato qualcosa dopo l'ultimo build». Un file riscritto identico cambia
 * la data e fa scattare il controllo: è la direzione sicura.
 */
export function improntaSorgente(radice = process.cwd()) {
  const impronta = createHash("sha256");
  /*
    Non solo l'impronta complessiva: anche riga per riga.

    Un messaggio che dice «il sorgente è cambiato» manda chi lo legge a cercare
    cosa. Con la mappa, dice **quale file**, ed è la differenza fra un avviso e
    un'informazione.
  */
  const file = {};
  const aggiungi = (percorso) => {
    const s = statSync(percorso);
    const nome = relative(radice, percorso).split(sep).join("/");
    file[nome] = `${s.size}:${s.mtimeMs}`;
    impronta.update(`${nome} ${file[nome]}\n`);
  };

  for (const cartella of CARTELLE) {
    for (const percorso of camminata(resolve(radice, cartella))) aggiungi(percorso);
  }
  for (const nome of FILE) {
    const percorso = resolve(radice, nome);
    if (existsSync(percorso)) aggiungi(percorso);
  }
  return { impronta: impronta.digest("hex"), file };
}

/** Cosa è cambiato fra due mappe di file: modificati, aggiunti, spariti. */
export function differenze(prima = {}, adesso = {}) {
  const cambiati = Object.keys(adesso).filter((n) => n in prima && prima[n] !== adesso[n]);
  const aggiunti = Object.keys(adesso).filter((n) => !(n in prima));
  const spariti = Object.keys(prima).filter((n) => !(n in adesso));
  return { cambiati, aggiunti, spariti };
}

/** Scrive il timbro. Lo chiama `timbra-artefatto.mjs`, subito dopo `next build`. */
export function timbra(radice = process.cwd()) {
  const { impronta, file } = improntaSorgente(radice);
  const timbro = {
    quando: new Date().toISOString(),
    impronta,
    quanti: Object.keys(file).length,
    file,
    /*
      Il numero di pagine costruite: non serve al confronto, serve a chi legge
      il file per capire di cosa sta parlando.
    */
    pagine: contaPagine(resolve(radice, "out")),
  };
  writeFileSync(resolve(radice, TIMBRO), `${JSON.stringify(timbro, null, 2)}\n`);
  return timbro;
}

function contaPagine(out) {
  let n = 0;
  for (const percorso of camminata(out)) if (percorso.endsWith("index.html")) n += 1;
  return n;
}

/**
 * Perché non si può misurare `out/`, in una riga. `null` se si può.
 *
 * Separata da chi la usa così un test la può leggere senza costruire niente.
 */
export function motivoArtefattoVecchio(radice = process.cwd()) {
  const out = resolve(radice, "out");
  if (!existsSync(out)) return "la cartella out/ non esiste: il sito non è mai stato costruito qui.";

  const percorsoTimbro = resolve(radice, TIMBRO);
  if (!existsSync(percorsoTimbro)) {
    return `manca ${TIMBRO}: out/ c'è, ma nessuno può dire da quale sorgente venga.`;
  }

  let timbro;
  try {
    timbro = JSON.parse(readFileSync(percorsoTimbro, "utf8"));
  } catch {
    return `${TIMBRO} non si legge: meglio ricostruire che fidarsi.`;
  }

  const adesso = improntaSorgente(radice);
  if (timbro.impronta === adesso.impronta) return null;

  const { cambiati, aggiunti, spariti } = differenze(timbro.file, adesso.file);
  const elenca = (etichetta, nomi) =>
    nomi.length === 0
      ? []
      : [
          `${etichetta}: ${nomi.slice(0, 3).join(", ")}`
          + (nomi.length > 3 ? ` e altri ${nomi.length - 3}` : ""),
        ];

  return [
    `il sorgente è cambiato dopo l'ultimo build riuscito (${timbro.quando}).`,
    ...elenca("modificati", cambiati),
    ...elenca("aggiunti", aggiunti),
    ...elenca("spariti", spariti),
    "Quello che misurerei non è quello che hai scritto.",
  ].join("\n");
}

/**
 * Si ferma se `out/` non è il sito del sorgente di adesso.
 *
 * Da chiamare per prima cosa in ogni strumento che serve `out/`. Esce con 1 e
 * dice cosa fare: un messaggio, non un'eccezione, perché chi lo legge sta
 * guardando l'output di un comando e non uno stack.
 */
export function esigiArtefattoFresco(radice = process.cwd()) {
  const motivo = motivoArtefattoVecchio(radice);
  if (motivo === null) return;

  const righe = motivo.split("\n");
  console.error(
    [
      "",
      "  ┌─ Niente da misurare",
      ...righe.map((r) => `  │  ${r.trim()}`),
      "  │",
      "  │  Una verifica che gira su un out/ vecchio dice verde su un sito che non",
      "  │  esiste più. È già successo, e l'unico sintomo era un codice d'uscita.",
      "  │",
      "  │      npm run build",
      "  │",
      "  │  poi rilancia questo strumento.",
      "  └─",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
