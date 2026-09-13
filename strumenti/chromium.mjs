/**
 * Dove sta Chromium, su questa macchina.
 *
 *   import { esigiChromium, avviaChromium } from "./chromium.mjs";
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché non è una costante
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Per mesi tutti gli strumenti hanno avuto scritto dentro
 * `/opt/pw-browsers/chromium`, che è il percorso del container in cui girano
 * gli agenti. Su un Mac non esiste: là Playwright installa in
 * `~/Library/Caches/ms-playwright`. Il risultato era che `npm run build`
 * costruiva tutto e poi moriva sull'ultimo passo, e che gli strumenti che
 * misurano il sito vero non si potevano lanciare dalla macchina di chi il
 * sito lo pubblica.
 *
 * Impostare `PLAYWRIGHT_BROWSERS_PATH` non cambiava niente, perché nessuno
 * lo leggeva: il percorso era fisso. È un difetto che non si vede da dove è
 * stato scritto — nel container funzionava sempre.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ordine, e perché un percorso esplicito non scivola mai
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 1. `--chromium=<percorso>` sulla riga di comando;
 * 2. `PLAYWRIGHT_CHROMIUM`, il binario indicato a mano;
 * 3. `PLAYWRIGHT_BROWSERS_PATH/chromium`, il collegamento del container;
 * 4. quello che risolve playwright-core da sé;
 * 5. una scansione delle cartelle di Playwright, questa macchina compresa;
 * 6. `/opt/pw-browsers/chromium`, il ripiego del container.
 *
 * I primi due sono **espliciti**: se puntano a un file che non c'è, il
 * controllo si ferma e lo dice, invece di scivolare al candidato dopo. Un
 * percorso scritto a mano che viene ignorato in silenzio è la stessa famiglia
 * di difetti che questo progetto insegue — una misura fatta su una cosa
 * diversa da quella che si credeva di misurare.
 *
 * Il quarto passo non basta da solo, e vale la pena sapere perché: dentro il
 * container `chromium.executablePath()` risponde `…/chromium-1234/…`, mentre
 * installata c'è la 1194. È un percorso **calcolato**, non trovato: dice dove
 * il browser starebbe se la versione fosse quella attesa da playwright-core.
 * Perciò ogni candidato, prima di essere buono, deve esistere su disco.
 */
import { readdirSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

/** I posti in cui Playwright mette i browser, quando non glielo si dice. */
function cartelleDiPlaywright() {
  const casa = homedir();
  const per = {
    darwin: join(casa, "Library", "Caches", "ms-playwright"),
    win32: join(process.env.LOCALAPPDATA ?? join(casa, "AppData", "Local"), "ms-playwright"),
  };
  return [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    per[platform()] ?? join(casa, ".cache", "ms-playwright"),
  ].filter((c) => c && c !== "0");
}

/** I nomi che il binario prende dentro una cartella `chromium-<build>`. */
const DENTRO = [
  join("chrome-linux", "chrome"),
  join("chrome-linux64", "chrome"),
  join("chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
  join("chrome-mac-arm64", "Chromium.app", "Contents", "MacOS", "Chromium"),
  join("chrome-win", "chrome.exe"),
  join("chrome-linux", "headless_shell"),
  join("chrome-mac", "headless_shell"),
];

const eseguibile = (p) => {
  try {
    return Boolean(p) && statSync(p).isFile();
  } catch {
    return false;
  }
};

/**
 * Fruga nelle cartelle di Playwright.
 *
 * Prende la build **più alta**, e il Chromium intero prima del guscio senza
 * interfaccia: sono tutti e due utilizzabili, ma se ci sono entrambi è quello
 * completo a somigliare al browser di chi visita il sito.
 */
function cerca() {
  const trovati = [];
  for (const radice of cartelleDiPlaywright()) {
    let voci;
    try {
      voci = readdirSync(radice);
    } catch {
      continue;
    }
    for (const voce of voci) {
      const m = voce.match(/^chromium(_headless_shell)?-(\d+)$/);
      if (!m) continue;
      for (const coda of DENTRO) {
        const p = join(radice, voce, coda);
        if (eseguibile(p)) {
          trovati.push({ percorso: p, build: Number(m[2]), guscio: Boolean(m[1]) });
          break;
        }
      }
    }
  }
  trovati.sort((a, b) => a.guscio - b.guscio || b.build - a.build);
  return trovati[0]?.percorso ?? null;
}

function opzione(nome, argv) {
  const trovata = argv.find((a) => a.startsWith(`--${nome}=`));
  return trovata ? trovata.slice(nome.length + 3) : "";
}

function riquadro(righe) {
  return `\n  ┌─ ${righe[0]}\n${righe.slice(1).map((r) => `  │  ${r}`).join("\n")}\n  └─`;
}

/**
 * Il percorso di Chromium, o un messaggio leggibile e l'uscita.
 *
 * Esce invece di lanciare perché questi sono programmi da riga di comando, non
 * una libreria: uno stack trace di playwright-core su una macchina senza
 * browser non dice cosa fare, e cosa fare è una riga sola.
 */
export function esigiChromium(argv = process.argv.slice(2)) {
  const espliciti = [
    { valore: opzione("chromium", argv), da: "l'opzione --chromium=" },
    { valore: process.env.PLAYWRIGHT_CHROMIUM ?? "", da: "la variabile PLAYWRIGHT_CHROMIUM" },
  ].filter((e) => e.valore);

  for (const e of espliciti) {
    if (eseguibile(e.valore)) return e.valore;
    console.error(
      riquadro([
        "Il Chromium che mi hai indicato non c'è",
        `${e.da} dice «${e.valore}», e lì non c'è nessun file eseguibile.`,
        "",
        "Non provo altrove: un percorso scritto a mano che viene scavalcato in",
        "silenzio farebbe misurare un browser diverso da quello che credi.",
      ]),
    );
    process.exit(3);
  }

  const daCercare = [];
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
    daCercare.push(join(process.env.PLAYWRIGHT_BROWSERS_PATH, "chromium"));
  }
  try {
    daCercare.push(chromium.executablePath());
  } catch {
    // playwright-core non sa dirlo: si passa alla scansione.
  }
  for (const c of daCercare) if (eseguibile(c)) return c;

  const trovato = cerca();
  if (trovato) return trovato;

  if (eseguibile("/opt/pw-browsers/chromium")) return "/opt/pw-browsers/chromium";

  console.error(
    riquadro([
      "Non ho trovato Chromium",
      "Ho guardato in:",
      ...cartelleDiPlaywright().map((c) => `  · ${c}`),
      "  · /opt/pw-browsers/chromium",
      "",
      "Installalo con:",
      "",
      "  npx playwright-core install chromium",
      "",
      // Non `npx playwright`: quello tira giù un pacchetto a parte, con la sua
      // versione, che può installare una build diversa da quella che
      // playwright-core si aspetta. Qui in progetto c'è solo playwright-core,
      // e la sua CLI installa il browser della **sua** versione.
      "Oppure indicami il binario che vuoi usare:",
      "",
      "  PLAYWRIGHT_CHROMIUM=/percorso/al/chrome npm run <comando>",
      "",
      "Questo non dice che il sito abbia qualcosa che non va: dice che da qui",
      "non si può aprire un browser, quindi non si può misurare niente.",
    ]),
  );
  process.exit(3);
}

/** Avvia Chromium, con le opzioni che servono al chiamante. */
export async function avviaChromium(opzioni = {}, argv = process.argv.slice(2)) {
  return chromium.launch({ executablePath: esigiChromium(argv), ...opzioni });
}
