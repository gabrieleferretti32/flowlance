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
 *   node genera-licenza.mjs nuovo@esempio.it --trasferisci vecchio@esempio.it
 *       Trasferisce la licenza in corso di `vecchio@` a `nuovo@`, come
 *       previsto dal punto 3 dei Termini: emette una chiave nuova con la
 *       **stessa scadenza** — il trasferimento non prolunga niente — e annota
 *       nel registro da chi arriva.
 *
 *       Due cose che questo comando **non** fa, e che vanno dette a voce:
 *       la chiave vecchia non si disattiva (l'applicazione funziona senza
 *       collegamento al Fornitore, e il punto 3 mette in capo al precedente
 *       intestatario l'obbligo di smettere di usarla), e il prezzo dei
 *       Fondatori **non** si trasferisce: resta a chi ha comprato per primo,
 *       e il punto 6-bis comma 7 lo scrive.
 *
 *   node genera-licenza.mjs cliente@esempio.it --rimborso
 *   node genera-licenza.mjs cliente@esempio.it --rimborso --cessa 2026-11-05
 *       Annota nel registro il rimborso dell'ultima licenza di quell'indirizzo
 *       e **la data da cui cessa il diritto d'uso** (punto 4: la data di
 *       esecuzione del rimborso; con `--cessa` se ne indica un'altra). Non
 *       emette niente e non disattiva nessuna chiave — non si può, e il punto
 *       4 lo dichiara: la cessazione dell'utilizzo è un obbligo dell'utente.
 *
 *       Il posto fra i 50 Fondatori si libera, come dice il comma 2, e
 *       l'ordine degli altri non cambia.
 *
 * Opzioni: `--privata <percorso>` per usare un'altra chiave privata,
 * `--registro <percorso>` per il file in cui si annotano le emissioni
 * (`chiavi/emesse.jsonl` per impostazione predefinita).
 */
import { createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fondatori,
  leggiRegistro,
  normalizzaEmail,
  raccontaStorico,
  rimborsata,
  rimborsiDi,
  scadenzaDelRinnovo,
  storicoDi,
  trasferimenti,
} from "./storico.mjs";

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
const cedente = opzione("trasferisci");
const chiedeRimborso = argomenti.includes("--rimborso");
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
/*
  Oggi, una volta sola. Serve due volte: alla finestra dei 30 giorni del punto
  6-bis, qui sotto, e alla data di emissione più in basso. Due letture
  dell'orologio a mezzanotte darebbero due giorni diversi.
*/
const oggi = new Date();
const emessaIl = oggi.toISOString().slice(0, 10);

const precedenti = storicoDi(emesse, email);
const rimborsi = rimborsiDi(emesse, email);
const storia = raccontaStorico(precedenti, emessaIl, {
  scambi: trasferimenti(emesse, email),
  rimborsi,
  fondatore: fondatori(emesse),
});

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

/*
  ─────────────────────────────────────────────────────────────────────────
  Il rimborso: una riga nel giornale, e una data da comunicare
  ─────────────────────────────────────────────────────────────────────────

  Non si cancella niente e non si modifica la riga dell'emissione: il registro
  è un giornale. La riga del rimborso porta **quando** è stato eseguito e **da
  quando** cessa il diritto d'uso — che per il punto 4 sono la stessa data,
  salvo indicarne un'altra con `--cessa`.

  Quello che il comando non può fare è disattivare la chiave. Il punto 4 lo
  dichiara, e il resoconto lo ripete: la cessazione dell'utilizzo è un obbligo
  dell'acquirente, e il modo di farlo valere è scriverglielo, non un
  interruttore che non esiste.
*/
if (chiedeRimborso) {
  if (cedente) errore("--rimborso e --trasferisci non si combinano: sono due cose diverse.");
  if (precedenti.length === 0) {
    errore(`Nel registro non c'è nessuna licenza per ${email}: non c'è niente da rimborsare.`);
  }
  const daRimborsare = precedenti[precedenti.length - 1];
  if (rimborsata(daRimborsare, rimborsi)) {
    errore(
      `L'ultima licenza di ${email} (emessa il ${daRimborsare.emessaIl}) risulta già rimborsata.\n  `
        + "  Un secondo rimborso della stessa licenza libererebbe due volte lo stesso posto.",
    );
  }
  const cessa = opzione("cessa") ?? emessaIl;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cessa)) {
    errore(`Data «${cessa}» non valida: serve una data nella forma 2026-11-05.`);
  }
  const voce = {
    tipo: "rimborso",
    email,
    licenzaEmessaIl: daRimborsare.emessaIl,
    licenzaScadenza: daRimborsare.scadenza,
    chiave: daRimborsare.chiave,
    data: emessaIl,
    cessaIl: cessa,
  };
  mkdirSync(dirname(registro), { recursive: true });
  appendFileSync(registro, `${JSON.stringify(voce)}\n`);

  const dopo = leggiRegistro(readFileSync(registro, "utf8")).righe;
  const posti = fondatori(dopo);
  console.log(`
  Rimborso annotato per ${email}
  Licenza emessa il ${daRimborsare.emessaIl}, scadenza ${daRimborsare.scadenza}
  Rimborso eseguito il ${emessaIl} · diritto d'uso cessato dal ${cessa}
  Annotato in ${registro}

  Fondatori: ${posti.occupati} posti occupati su ${posti.posti}, ${posti.liberi} liberi.

  Da scrivere all'interessato, perché il programma non può farlo:
  · la chiave NON viene disattivata a distanza — l'applicazione funziona senza
    collegamento al Fornitore — e dal ${cessa} l'utilizzo deve cessare (punto 4).
  Il testo pronto da copiare è in CHECKOUT.md, sezione «Trasferimento e rimborso».
`);
  process.exit(0);
}

let scadenza = posizionali[1] ?? null;
const mesi = opzione("mesi");
const anni = opzione("anni");

/*
  ─────────────────────────────────────────────────────────────────────────
  Il trasferimento: stessa scadenza, e niente di quello che non si trasferisce
  ─────────────────────────────────────────────────────────────────────────

  La scadenza non si ricalcola: si **copia** da quella ceduta. Il punto 3 dice
  che il trasferimento non prolunga la durata, e ricalcolarla da oggi sarebbe
  il modo più naturale di regalare dei mesi senza accorgersene — un conto che
  sembra giusto, fatto sulla data sbagliata.

  Per la stessa ragione una data scritta a mano, `--mesi` o `--anni` insieme a
  `--trasferisci` non si ignorano in silenzio: si rifiutano. Un'opzione
  ignorata è una decisione presa da chi legge il comando e non da chi lo
  scrive.
*/
let cedutaDa = null;
if (cedente) {
  if (normalizzaEmail(cedente) === normalizzaEmail(email)) {
    errore(`Il cedente e il nuovo intestatario sono lo stesso indirizzo (${email}).`);
  }
  if (scadenza || mesi || anni) {
    errore(
      "Con --trasferisci la scadenza non si sceglie: è quella della licenza ceduta.\n  "
        + "  Il punto 3 dei Termini dice che il trasferimento non prolunga la durata.",
    );
  }
  const sue = storicoDi(emesse, cedente);
  if (sue.length === 0) {
    errore(
      `Nel registro non c'è nessuna licenza per ${cedente}.\n  `
        + `  ${registro} è il registro letto: controlla l'indirizzo, o passane un altro con --registro.`,
    );
  }
  cedutaDa = sue[sue.length - 1];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(cedutaDa.scadenza ?? ""))) {
    errore(`La licenza di ${cedente} non porta una scadenza leggibile: «${cedutaDa.scadenza}».`);
  }
  if (cedutaDa.scadenza < emessaIl) {
    errore(
      `La licenza di ${cedente} è scaduta il ${cedutaDa.scadenza}: non c'è durata residua da trasferire.\n  `
        + "  Il nuovo intestatario compra una licenza sua, al prezzo di listino.",
    );
  }
  scadenza = cedutaDa.scadenza;
}

/*
  ─────────────────────────────────────────────────────────────────────────
  La decorrenza del rinnovo anticipato (punto 3)
  ─────────────────────────────────────────────────────────────────────────

  «Il rinnovo acquistato prima della scadenza della licenza in corso decorre
  dalla scadenza di quest'ultima, senza perdita dei giorni già pagati.»

  È la clausola che si sbaglia in silenzio: una licenza emessa oggi, a chi ne
  ha una valida fino a marzo, gli toglie cinque mesi che aveva pagato. Nessun
  errore, nessuna riga storta — una scadenza plausibile, calcolata sulla data
  sbagliata, che nessuno confronta con quella di prima.

  Il conto sta in `scadenzaDelRinnovo`, che non legge né orologio né disco e si
  prova sui tre casi che contano: un mese prima della scadenza, il giorno
  stesso, dieci giorni dopo.
*/
let rinnovo = null;
if (!scadenza) {
  rinnovo = scadenzaDelRinnovo(precedenti, emessaIl, { mesi, anni });
  scadenza = rinnovo.scadenza;
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
/*
  La riga del trasferimento porta **da chi** arriva, e non una riga a parte per
  il cedente: una riga sola non può raccontarne metà, e due righe che si devono
  tenere insieme sono due righe che un giorno si separano. Da `trasferitaDa` si
  ricostruiscono tutti e due i versi — chi ha ceduto e chi ha ricevuto — che è
  quello che fa `trasferimenti()` in `storico.mjs`.
*/
const riga = { email, scadenza, emessaIl, chiave };
if (cedutaDa) riga.trasferitaDa = cedutaDa.email;
appendFileSync(registro, `${JSON.stringify(riga)}\n`);

const intestazione = cedutaDa
  ? [
      `  Licenza TRASFERITA da ${cedutaDa.email} a ${email}`,
      `  Stessa scadenza della ceduta: ${scadenza} compreso · emessa il ${emessaIl}`,
      "",
      "  Da dire a voce, perché il programma non può farlo:",
      "  · la chiave del precedente intestatario NON viene disattivata — l'applicazione",
      "    funziona senza collegamento al Fornitore, e il punto 3 mette in capo a lui",
      "    l'obbligo di cessare l'utilizzo;",
      "  · il prezzo fondatori NON si trasferisce (6-bis, comma 7): resta a",
      `    ${cedutaDa.email}, e per ${email} vale il listino.`,
    ].join("\n")
  : [
      `  Licenza per ${email}`,
      `  ${storia.nuovo ? "Primo acquisto" : `${storia.numeroLicenza}ª licenza · ${storia.rinnovi} ${storia.rinnovi === 1 ? "rinnovo" : "rinnovi"}`}`,
      `  Valida fino al ${scadenza} compreso · emessa il ${emessaIl}`,
      ...(rinnovo?.anticipato
        ? [
            `  Rinnovo anticipato: decorre dalla scadenza della licenza in corso (${rinnovo.base}),`,
            "  non dalla data di emissione — punto 3, nessun giorno già pagato va perso.",
          ]
        : []),
    ].join("\n");

console.log(`
${intestazione}
  Annotata in ${registro}

  Da mandare all'acquirente — si incolla in Impostazioni › Licenza:

${chiave}
`);
