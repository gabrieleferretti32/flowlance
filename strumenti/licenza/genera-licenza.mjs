#!/usr/bin/env node
/**
 * Emette le licenze di Flowlance.
 *
 * Da tenere FUORI dal repository pubblico insieme alla chiave privata: lo
 * script di per sé non è un segreto — l'algoritmo è standard — ma la chiave
 * privata sì, e vivono meglio nella stessa cartella. Con la chiave privata
 * chiunque può emettere licenze valide.
 *
 * Uso:
 *
 *   node genera-licenza.mjs --nuove-chiavi
 *       Crea una coppia Ed25519. Stampa la chiave pubblica da incollare in
 *       `src/lib/licenza/chiave-pubblica.ts` e scrive la privata in
 *       `chiavi/privata.pem`. Si fa una volta sola: rigenerarla invalida
 *       tutte le licenze già emesse.
 *
 *   node genera-licenza.mjs cliente@esempio.it 2027-09-30
 *   node genera-licenza.mjs cliente@esempio.it --mesi 12
 *   node genera-licenza.mjs cliente@esempio.it --anni 1
 *       Emette una licenza e stampa la chiave da mandare all'acquirente.
 *       Prima di emetterla dice se quell'indirizzo ne ha già ricevute.
 *
 *   node genera-licenza.mjs cliente@esempio.it --storico
 *       Dice soltanto quello, senza emettere niente e senza toccare il
 *       registro. È il comando da usare **prima** di rispondere a un'email di
 *       rinnovo, quando serve sapere che prezzo fare.
 *
 * Opzioni: `--privata <percorso>` per usare un'altra chiave privata,
 * `--registro <percorso>` per il file in cui si annotano le emissioni
 * (`chiavi/emesse.jsonl` per impostazione predefinita).
 */
import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { leggiRegistro, raccontaStorico, storicoDi } from "./storico.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));
const CARTELLA_CHIAVI = resolve(QUI, "chiavi");
const PRIVATA = resolve(CARTELLA_CHIAVI, "privata.pem");
const REGISTRO = resolve(CARTELLA_CHIAVI, "emesse.jsonl");

const PREFISSO = "FLW1";
const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** base64url, identico a quello di `src/lib/licenza/chiave.ts`. */
function inBase64Url(byte) {
  let out = "";
  for (let i = 0; i < byte.length; i += 3) {
    const a = byte[i];
    const b = byte[i + 1];
    const c = byte[i + 2];
    out += ALFABETO[a >> 2];
    out += ALFABETO[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b === undefined) break;
    out += ALFABETO[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c === undefined) break;
    out += ALFABETO[c & 63];
  }
  return out;
}

function errore(messaggio) {
  console.error(`\n  ${messaggio}\n`);
  process.exit(1);
}

const argomenti = process.argv.slice(2);
function opzione(nome) {
  const i = argomenti.indexOf(`--${nome}`);
  return i === -1 ? null : argomenti[i + 1] ?? null;
}

// ————————————————————————————————————————————————————————————
// Generazione della coppia
// ————————————————————————————————————————————————————————————

/**
 * Dove sta la chiave privata, per ogni comando.
 *
 * Una riga sola, letta prima di qualunque ramo, perché `--privata` deve voler
 * dire la stessa cosa sempre. Prima era così solo per l'emissione: il ramo
 * `--nuove-chiavi` ignorava l'opzione e scriveva nel percorso fisso. Chi
 * generava una coppia di prova chiedendola altrove se la ritrovava **nella
 * cartella vera**, accanto a quella di produzione, senza che niente glielo
 * dicesse — e il comando stampava comunque il percorso giusto, cioè quello
 * fisso, che però non era quello chiesto.
 *
 * L'intestazione di questo file documentava `--privata` come opzione generale
 * da sempre. Qui il codice la raggiunge.
 */
const percorsoPrivata = opzione("privata") ?? PRIVATA;

if (argomenti.includes("--nuove-chiavi")) {
  /*
    Il rifiuto guarda **il file che si sta per scrivere**, non il percorso
    predefinito: con `--privata` altrove, controllare il predefinito vorrebbe
    dire rifiutare quando non serve e sovrascrivere quando non si deve.

    E non esiste un `--force`, di proposito. Sovrascrivere una chiave privata
    invalida ogni licenza emessa finora: non è un'operazione che si fa in
    fretta rispondendo di sì a un avviso, è una che si fa spostando un file a
    mano, dopo averci pensato. Un flag che la rende possibile in un colpo solo
    è un flag che prima o poi qualcuno usa per sbaglio — e di quel genere di
    errore non ci si accorge subito: ci si accorge dai clienti che scrivono
    che la chiave non funziona più.
  */
  if (existsSync(percorsoPrivata)) {
    errore(
      `Esiste già una chiave privata in ${percorsoPrivata}.\n  ` +
        "Sovrascriverla invaliderebbe tutte le licenze emesse finora.\n  " +
        "Se è davvero quello che vuoi, spostala altrove a mano e riprova.",
    );
  }
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  mkdirSync(dirname(percorsoPrivata), { recursive: true });
  writeFileSync(percorsoPrivata, privateKey.export({ type: "pkcs8", format: "pem" }), {
    mode: 0o600,
  });

  // I 32 byte grezzi stanno in coda al DER SPKI, che per Ed25519 ha un
  // prefisso fisso di 12 byte.
  const grezza = publicKey.export({ type: "spki", format: "der" }).subarray(12);
  console.log(`
  Coppia creata.

  Chiave privata:  ${percorsoPrivata}
                   Non finisca mai in un repository, in un backup condiviso
                   o in un'email.

  Chiave pubblica: incollala in src/lib/licenza/chiave-pubblica.ts

      export const CHIAVE_PUBBLICA = "${inBase64Url(grezza)}";
`);
  process.exit(0);
}

// ————————————————————————————————————————————————————————————
// Emissione di una licenza
// ————————————————————————————————————————————————————————————

const posizionali = argomenti.filter(
  (a, i) => !a.startsWith("--") && !argomenti[i - 1]?.startsWith("--"),
);
const email = posizionali[0];
if (!email || !email.includes("@")) {
  errore(
    "Serve l'email dell'acquirente.\n  " +
      "  node genera-licenza.mjs cliente@esempio.it 2027-09-30\n  " +
      "  node genera-licenza.mjs cliente@esempio.it --mesi 12",
  );
}

/*
  Lo storico **prima** di qualunque altra cosa, e prima della chiave privata.

  Serve a sapere che prezzo fare, e lo si vuole sapere anche quando la chiave
  privata non è a portata — da un altro computer, rispondendo a un'email. Per
  questo `--storico` si ferma qui e non chiede niente al disco oltre al
  registro.
*/
const registro = opzione("registro") ?? REGISTRO;
const { righe: emesse, illeggibili } = existsSync(registro)
  ? leggiRegistro(readFileSync(registro, "utf8"))
  : { righe: [], illeggibili: 0 };
const precedenti = storicoDi(emesse, email);
const storia = raccontaStorico(precedenti);

console.log(`\n  ${storia.righe.join("\n  ")}`);
if (illeggibili > 0) {
  console.log(
    `\n  Attenzione: ${illeggibili} ${illeggibili === 1 ? "riga" : "righe"} del registro `
      + `non si ${illeggibili === 1 ? "legge" : "leggono"}.\n  `
      + "  Il conto qui sopra potrebbe essere più basso del vero.",
  );
}

if (argomenti.includes("--storico")) {
  console.log("");
  process.exit(0);
}

const oggi = new Date();
const emessaIl = oggi.toISOString().slice(0, 10);

let scadenza = posizionali[1] ?? null;
const mesi = opzione("mesi");
const anni = opzione("anni");
if (!scadenza) {
  const fine = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate()));
  if (mesi) fine.setUTCMonth(fine.getUTCMonth() + Number(mesi));
  else fine.setUTCFullYear(fine.getUTCFullYear() + Number(anni ?? 1));
  scadenza = fine.toISOString().slice(0, 10);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(scadenza)) {
  errore(`Scadenza «${scadenza}» non valida: serve una data nella forma 2027-09-30.`);
}
if (scadenza < emessaIl) {
  errore(`La scadenza ${scadenza} è già passata: la licenza nascerebbe scaduta.`);
}

if (!existsSync(percorsoPrivata)) {
  errore(
    `Nessuna chiave privata in ${percorsoPrivata}.\n  ` +
      "La prima volta: node genera-licenza.mjs --nuove-chiavi",
  );
}
const privata = createPrivateKey(readFileSync(percorsoPrivata));

const carico = inBase64Url(
  Buffer.from(JSON.stringify({ e: email, s: scadenza, d: emessaIl }), "utf8"),
);
const firma = sign(null, Buffer.from(`${PREFISSO}.${carico}`, "utf8"), privata);
const chiave = `${PREFISSO}.${carico}.${inBase64Url(firma)}`;

mkdirSync(dirname(registro), { recursive: true });
appendFileSync(registro, `${JSON.stringify({ email, scadenza, emessaIl, chiave })}\n`);

console.log(`
  Licenza per ${email}
  ${storia.nuovo ? "Primo acquisto" : `${storia.numeroLicenza}ª licenza · ${storia.rinnovi} ${storia.rinnovi === 1 ? "rinnovo" : "rinnovi"}`}
  Valida fino al ${scadenza} compreso · emessa il ${emessaIl}
  Annotata in ${registro}

  Da mandare all'acquirente — si incolla in Impostazioni › Licenza:

${chiave}
`);
