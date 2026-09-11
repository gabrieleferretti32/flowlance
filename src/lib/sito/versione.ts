/**
 * Da quale commit è costruito il sito che sta online.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La domanda che non sapeva nessuno
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Vercel pubblica, e da fuori non c'è modo di verificare **cosa** ha
 * pubblicato. Si guarda il sito, si vede una pagina, e si dà per scontato che
 * sia quella del ramo. Quando non lo è — un build fallito, una distribuzione
 * ferma, un ramo diverso da quello che si crede — il sintomo è che il sito
 * funziona benissimo e racconta qualcosa di vecchio.
 *
 * È lo stesso difetto di `artefatto.mjs`, spostato di un piano ancora: là si
 * misurava la copia sbagliata sul proprio disco, qui si guarda la copia
 * sbagliata in produzione. E ha la stessa risposta: fare in modo che la copia
 * dichiari da dove viene, invece di dedurlo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Due campi, e non uno di più
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `commit` e `costruito`. Niente ramo, niente autore, niente messaggio, niente
 * variabili d'ambiente, niente percorsi. È un file **pubblico** su un sito che
 * vende la promessa di non mandare dati da nessuna parte: la forma del file è
 * parte di quella promessa, e un test verifica che le chiavi restino queste due
 * — così il giorno in cui qualcuno ci aggiunge «per comodità» il nome del ramo,
 * il test diventa rosso invece che il file più ciarliero.
 *
 * Non si committa: a differenza del PDF dei Termini, che esce identico a ogni
 * build, questo cambia a ogni build per costruzione. Tenerlo in git vorrebbe
 * dire un commit di rumore ogni volta.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const PERCORSO_VERSIONE = "/versione.json";
export const FILE_VERSIONE = "public/versione.json";

export type Versione = {
  /** Lo SHA completo, quaranta cifre esadecimali. */
  commit: string;
  /** Quando il sito è stato costruito, in ISO. */
  costruito: string;
};

/** Le uniche chiavi che il file pubblico può avere. Un test le tiene. */
export const CHIAVI_VERSIONE = ["commit", "costruito"] as const;

const SHA = /^[0-9a-f]{40}$/;

/**
 * Lo SHA del commit da cui si sta costruendo. `null` se non si sa.
 *
 * Due fonti, nessuna delle quali inventata: la variabile che Vercel mette a
 * ogni build, e `git` nella cartella. La prima serve perché su un runner la
 * cartella `.git` può non esserci; la seconda perché in locale la variabile non
 * c'è. Uno SHA che non ha la forma di uno SHA vale quanto non averlo.
 */
export function commitDa(
  ambiente: Record<string, string | undefined>,
  daGit: () => string | null,
): string | null {
  const daVercel = ambiente.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase();
  if (daVercel && SHA.test(daVercel)) return daVercel;
  const git = daGit()?.trim().toLowerCase();
  return git && SHA.test(git) ? git : null;
}

/** Chiede a git il commit di adesso. `null` se git non c'è o la cartella non è un repository. */
export function commitDaGit(radice = process.cwd()): string | null {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: radice,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

/**
 * Scrive `public/versione.json`. Lo chiama `next.config.ts`, a ogni build.
 *
 * Senza commit **si ferma**, e lo fa apposta. Un file che dice «non so da dove
 * vengo» è peggio che non averlo: lo strumento che confronta direbbe «diverso»
 * a ogni giro, e in due settimane nessuno lo guarderebbe più. Le due fonti
 * insieme mancano solo in un ambiente che non è né Vercel né un clone git, e in
 * quel caso c'è qualcosa da sapere prima di pubblicare.
 */
export function scriviVersione(radice = process.cwd(), adesso = new Date()): Versione {
  const commit = commitDa(process.env, () => commitDaGit(radice));
  if (commit === null) {
    throw new Error(
      [
        "",
        "  ┌─ Build fermato: non so da quale commit sto costruendo",
        "  │  Né VERCEL_GIT_COMMIT_SHA né `git rev-parse HEAD` danno uno SHA.",
        "  │",
        `  │  ${FILE_VERSIONE} è il file che dice cosa c'è online: senza commit`,
        "  │  direbbe «non so», e uno strumento che confronta lo leggerebbe come",
        "  │  «diverso» a ogni giro — cioè un allarme che suona sempre, e che in due",
        "  │  settimane non guarda più nessuno.",
        "  │",
        "  │  Succede fuori da Vercel e fuori da un clone git. Se è il tuo caso,",
        "  │  costruisci da dentro il repository.",
        "  └─",
        "",
      ].join("\n"),
    );
  }

  const versione: Versione = { commit, costruito: adesso.toISOString() };
  const percorso = join(radice, FILE_VERSIONE);
  mkdirSync(dirname(percorso), { recursive: true });
  writeFileSync(percorso, `${JSON.stringify(versione, null, 2)}\n`);
  return versione;
}

// ————————————————————————————————————————————————————————————
// Il confronto
// ————————————————————————————————————————————————————————————

export type EsitoConfronto =
  | { stato: "allineato"; commit: string; costruito: string }
  | { stato: "diverso"; online: string; atteso: string; costruito: string }
  | { stato: "muto"; motivo: string };

/**
 * Quello che risponde il sito contro quello che dice il ramo.
 *
 * Funzione pura, separata dallo strumento che va in rete: il confronto è la
 * parte che può sbagliare, e un test deve poterla interrogare senza pubblicare
 * niente. Lo strumento fa la richiesta e stampa; qui si decide.
 */
export function confrontaVersione(grezzo: unknown, atteso: string): EsitoConfronto {
  if (grezzo === null || typeof grezzo !== "object") {
    return { stato: "muto", motivo: `${PERCORSO_VERSIONE} non è un oggetto JSON.` };
  }
  const v = grezzo as Partial<Versione>;
  if (typeof v.commit !== "string" || !SHA.test(v.commit)) {
    return {
      stato: "muto",
      motivo: `${PERCORSO_VERSIONE} non porta un commit: «${String(v.commit)}».`,
    };
  }
  const costruito = typeof v.costruito === "string" ? v.costruito : "data sconosciuta";
  if (v.commit === atteso.trim().toLowerCase()) {
    return { stato: "allineato", commit: v.commit, costruito };
  }
  return { stato: "diverso", online: v.commit, atteso, costruito };
}
