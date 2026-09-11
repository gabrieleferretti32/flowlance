/**
 * L'immagine di anteprima: dove sta, quanto misura, e cosa deve dire.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Come viene fatta
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `strumenti/immagine-anteprima.mjs` apre il **sito costruito** in Chromium,
 * legge dalla landing il titolo, l'occhiello e le tinte, disegna la scheda con
 * il carattere del sito e il marchio preso da `src/app/icon.svg`, e fotografa
 * 1200 × 630.
 *
 * Non è il browser a essere un vezzo: il carattere di Flowlance arriva come
 * woff2 variabile, e in questo progetto non c'è niente che sappia rasterizzare
 * un woff2 variabile fuori da un motore di rendering. Disegnare l'immagine con
 * un altro carattere avrebbe voluto dire un'anteprima che non somiglia alla
 * pagina — che è esattamente il difetto che stiamo evitando.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché allora il build se ne accorge lo stesso
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un'immagine fatta a mano una volta e poi dimenticata è la seconda copia di
 * sempre: si cambia il titolo della landing, l'anteprima continua a mostrare
 * quello di sei mesi fa, e non se ne accorge nessuno perché l'anteprima non si
 * vede mai aprendo il sito.
 *
 * Quindi il generatore **firma il PNG**: dentro il file, in un chunk di testo,
 * lascia la frase che ha disegnato, l'occhiello e l'impronta del marchio. E
 * `next.config.ts` — che ogni `next build` legge, anche quello di Vercel —
 * confronta quella firma con `APERTURA` e con il file del marchio di adesso.
 * Se non coincidono il build **si ferma** e dice il comando da lanciare.
 *
 * Il risultato è quello voluto: l'immagine non può restare indietro rispetto
 * alla pagina, e lo si scopre al build e non da un link in una chat.
 *
 * Modulo puro — nessun import di Node — perché lo legge anche la pagina.
 */
import { APERTURA, type RigaApertura } from "./apertura";

/** Dove sta, per il browser e sul disco. */
export const PERCORSO_ANTEPRIMA = "/anteprima.png";
export const FILE_ANTEPRIMA = "public/anteprima.png";

/**
 * 1200 × 630: la misura che Facebook, LinkedIn e X ritagliano senza tagliare.
 * Qualunque altra proporzione viene tagliata da qualcuno, e ognuno da un lato
 * diverso.
 */
export const MISURA = { larghezza: 1200, altezza: 630 } as const;

/** Il comando che rifà l'immagine. Compare in ogni messaggio d'errore. */
export const COMANDO = "npm run anteprima:immagine";

/** La chiave del chunk iTXt dove il generatore lascia la firma. */
export const CHIAVE_FIRMA = "Flowlance";

export type Riquadro = { x: number; y: number; larghezza: number; altezza: number };

/**
 * Quello che il generatore scrive dentro il PNG: **i dati da cui l'immagine è
 * nata**, non un riassunto di com'è venuta.
 */
export type Firma = {
  occhiello: string;
  titolo: RigaApertura[];
  /** L'impronta di `src/app/icon.svg` quando il marchio è stato disegnato. */
  marchio: string;
  /** Il corpo del titolo in pixel dell'immagine, e il riquadro che occupa. */
  corpo: number;
  riquadro: Riquadro;
};

/**
 * Quanto è larga un'anteprima in una chat, e sotto quale altezza una lettera
 * maiuscola smette di essere una lettera.
 *
 * Telegram, Slack e WhatsApp mostrano l'anteprima di un link intorno ai 360 –
 * 420 px di larghezza: 400 è la misura di mezzo, e 1200 ÷ 400 = 3 è il fattore
 * con cui l'immagine viene rimpicciolita. Quattordici pixel di maiuscola sono
 * il minimo per leggere una frase su un telefono senza avvicinarlo.
 */
export const MINIATURA = { larghezza: 400, maiuscolaMinima: 14 } as const;

/** L'altezza che l'inchiostro del titolo deve avere nell'immagine grande. */
export const MAIUSCOLA_MINIMA =
  (MINIATURA.maiuscolaMinima * MISURA.larghezza) / MINIATURA.larghezza;

const stessoTitolo = (a: RigaApertura[], b: RigaApertura[]): boolean =>
  a.length === b.length
  && a.every((r, i) => r.testo === b[i].testo && Boolean(r.accento) === Boolean(b[i].accento));

const scrivi = (righe: RigaApertura[]): string =>
  righe.map((r) => (r.accento ? `«${r.testo}» (accento)` : `«${r.testo}»`)).join(" + ");

/**
 * L'immagine dice ancora quello che dice la pagina? `null` se sì.
 *
 * Puro apposta: prende la firma letta dal file e l'impronta del marchio di
 * adesso, e non va a cercarsele da solo. Così un test può chiedergli di
 * confrontare una firma sbagliata e vedere che se ne accorge — che è l'unico
 * modo di sapere che questo controllo funziona anche quando non scatta.
 */
export function differenzaAnteprima(firma: Firma | null, improntaMarchio: string): string | null {
  if (firma === null) {
    return `manca ${FILE_ANTEPRIMA}, oppure non porta la firma di chi l'ha disegnata.`;
  }
  if (!stessoTitolo(firma.titolo, APERTURA.titolo)) {
    return [
      "il titolo dell'immagine non è più quello della landing.",
      `  nell'immagine: ${scrivi(firma.titolo)}`,
      `  sulla pagina:  ${scrivi(APERTURA.titolo)}`,
    ].join("\n");
  }
  if (firma.occhiello !== APERTURA.occhiello) {
    return [
      "l'occhiello dell'immagine non è più quello della landing.",
      `  nell'immagine: «${firma.occhiello}»`,
      `  sulla pagina:  «${APERTURA.occhiello}»`,
    ].join("\n");
  }
  if (firma.marchio !== improntaMarchio) {
    return [
      "il marchio è cambiato dopo che l'immagine è stata disegnata.",
      `  nell'immagine: ${firma.marchio}`,
      `  nel file:      ${improntaMarchio}`,
    ].join("\n");
  }
  return null;
}

/** Il messaggio con cui fermare il build. `null` se non c'è niente da dire. */
export function messaggioAnteprima(motivo: string | null): string | null {
  if (motivo === null) return null;
  return [
    "",
    "  ┌─ Build fermato: l'immagine di anteprima non è più quella del sito",
    ...motivo.split("\n").map((r) => `  │  ${r}`),
    "  │",
    "  │  È l'immagine che compare quando qualcuno incolla flowlance.it in una",
    "  │  chat: l'unica cosa del sito che non si vede mai aprendolo. Lasciarla",
    "  │  indietro vuol dire far girare per mesi una frase che non diciamo più.",
    "  │",
    `  │      ${COMANDO}`,
    "  │",
    "  │  (vuole out/ costruito: rifà l'immagine leggendo la landing vera)",
    "  └─",
    "",
  ].join("\n");
}
