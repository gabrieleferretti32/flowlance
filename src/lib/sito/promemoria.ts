/**
 * Il contratto fra la pagina e la funzione che iscrive ai promemoria.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché un file solo, letto da due parti
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Questo modulo lo leggono in due: il browser, che costruisce la richiesta, e
 * `api/promemoria.ts`, che la riceve e la valida prima di passarla a Brevo.
 * Scritto due volte sarebbero due idee di «richiesta valida», e il giorno in
 * cui una delle due cambia la differenza non si vede: la pagina direbbe
 * «iscritto» e la funzione scarterebbe, o peggio accetterebbe un campo che la
 * pagina non manda più e lo scriverebbe vuoto in un'email.
 *
 * Qui dentro non c'è React, non c'è `fetch` e non c'è Next: è TypeScript
 * puro, perché la funzione gira in Node fuori dal bundle dell'applicazione.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Quello che esce dal browser, e perché è una lista chiusa
 * ─────────────────────────────────────────────────────────────────────────
 *
 * In cima al simulatore c'è scritto che i numeri restano nella pagina, e che
 * partono **solo** se chiedi i promemoria, e **solo** quelli che servono a
 * mandarteli. È una promessa che si tiene con un elenco chiuso di sette
 * attributi, non con l'intenzione di non mandare altro: `convalidaPromemoria`
 * costruisce l'oggetto da zero campo per campo, quindi una chiave in più nel
 * corpo della richiesta non arriva a Brevo nemmeno per sbaglio.
 */

/** I sette attributi, con i nomi che hanno in Brevo. Nessun altro parte. */
export const ATTRIBUTI = [
  "REGIME",
  "SCAD_1_DATA",
  "SCAD_1_IMPORTO",
  "SCAD_2_DATA",
  "SCAD_2_IMPORTO",
  "ACCANTONAMENTO_MESE",
  "FATTURATO_STIMATO",
] as const;

export type NomeAttributo = (typeof ATTRIBUTI)[number];

/**
 * Il tetto sugli importi.
 *
 * È lo stesso di `RICAVI_MASSIMI` nel simulatore, e **non** si importa da lì:
 * `simulatore.ts` tira dentro il motore fiscale intero, e questa costante la
 * legge una funzione serverless che non ha nessun bisogno di avviarlo. Che i
 * due valori restino uguali lo tiene un test, non la buona volontà — e se un
 * giorno divergono fallisce lui, invece di far scartare al server una richiesta
 * che la pagina considerava legittima.
 */
export const TETTO_RICAVI = 300_000;

/**
 * Il tetto sui singoli importi di scadenza e sull'accantonamento.
 *
 * Più alto del fatturato perché la rata di giugno del primo anno porta il
 * carico intero più il primo acconto: su ricavi al massimo è una cifra che
 * supera il fatturato di un forfettario, non di un ordinario. Due volte il
 * tetto dei ricavi è largo e sufficiente: serve a scartare lo zero in più di
 * chi prova il campo, non a fare da secondo motore di calcolo.
 */
export const TETTO_IMPORTI = TETTO_RICAVI * 2;

/**
 * Quanto deve passare, almeno, fra l'apertura del modulo e l'invio.
 *
 * È la trappola temporale, al posto di un CAPTCHA: su una pagina che arriva
 * dalla pubblicità un CAPTCHA costa iscrizioni vere, e questo non costa
 * niente a nessuno — tre secondi per leggere un'etichetta, scrivere
 * un'email e spuntare una casella li impiega qualunque persona. Chi non li
 * impiega non è una persona.
 *
 * Il tempo lo misura **il browser** e lo manda: un orologio di cui il server
 * non ha prova. Non è il presidio principale e non pretende di esserlo — lo
 * sono l'`Origin` e la validazione — è il filtro che costa zero e toglie il
 * rumore di fondo.
 */
export const ATTESA_MINIMA_MS = 3_000;

/** Il corpo della richiesta, come lo manda il browser. */
export type RichiestaPromemoria = {
  email: string;
  attributi: Partial<Record<NomeAttributo, string | number>>;
  /** Millisecondi fra l'apertura del modulo e il clic. Vedi `ATTESA_MINIMA_MS`. */
  compilatoIn: number;
};

export type EsitoConvalida =
  | { ok: true; email: string; attributi: Record<string, string | number> }
  | { ok: false; errore: string; motivo: string };

/*
  Niente di più severo di così.

  La forma di un indirizzo email non si verifica con un'espressione regolare —
  la grammatica vera sta nella RFC 5321 e nessuna riga la riassume — e provarci
  rifiuta indirizzi legittimi: un apostrofo, un `+`, un dominio nuovo. Qui si
  scarta solo ciò che non può essere un indirizzo: niente chiocciola, niente
  punto nel dominio, spazi. Chi sbaglia il resto lo scopre dalla conferma che
  non arriva, che è il modo in cui il doppio opt-in serve anche a questo.
*/
const FORMA_EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

const REGIMI = ["forfettario", "ordinario"] as const;

const FORMA_DATA = /^\d{4}-\d{2}-\d{2}$/;

function dataPlausibile(valore: string, annoDiOggi: number): boolean {
  if (!FORMA_DATA.test(valore)) return false;
  const anno = Number(valore.slice(0, 4));
  const mese = Number(valore.slice(5, 7));
  const giorno = Number(valore.slice(8, 10));
  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return false;
  // Una scadenza è davanti a chi si iscrive, e non di molto: l'anno in corso
  // o i due successivi. Fuori da lì non viene da questa pagina.
  return anno >= annoDiOggi - 1 && anno <= annoDiOggi + 2;
}

function numeroNelLimite(valore: unknown, tetto: number): number | null {
  const n = typeof valore === "number" ? valore : Number(valore);
  if (!Number.isFinite(n) || n < 0 || n > tetto) return null;
  return Math.round(n * 100) / 100;
}

/**
 * La richiesta è accettabile? E in forma, che cosa si manda a Brevo?
 *
 * Restituisce l'oggetto degli attributi **ricostruito**, non quello ricevuto:
 * è la differenza fra validare e filtrare. Una chiave estranea nel corpo —
 * per curiosità, per errore, per tentativo — non sopravvive al passaggio,
 * perché non c'è nessun punto in cui venga copiata.
 *
 * `errore` è la frase che si può mostrare a chi sta guardando la pagina;
 * `motivo` è quella che finisce nel registro del server e non promette
 * niente a nessuno.
 */
export function convalidaPromemoria(corpo: unknown, oggi: string): EsitoConvalida {
  const scarta = (errore: string, motivo: string): EsitoConvalida => ({ ok: false, errore, motivo });

  if (typeof corpo !== "object" || corpo === null) {
    return scarta("Non ho capito la richiesta. Riprova.", "corpo non è un oggetto");
  }
  const r = corpo as Partial<RichiestaPromemoria>;

  const email = typeof r.email === "string" ? r.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !FORMA_EMAIL.test(email)) {
    return scarta("Questo indirizzo non mi sembra un'email.", "email fuori forma");
  }

  const compilatoIn = typeof r.compilatoIn === "number" ? r.compilatoIn : -1;
  if (!Number.isFinite(compilatoIn) || compilatoIn < ATTESA_MINIMA_MS) {
    /*
      A chi è una persona davvero questo non capita: i tre secondi li impiega
      chiunque. Il messaggio dice di riprovare e non accusa nessuno — una
      frase che dà del robot a un cliente è peggio di un'iscrizione persa.
    */
    return scarta("Qualcosa è andato storto nell'invio. Riprova fra un attimo.", "troppo veloce");
  }

  const a = typeof r.attributi === "object" && r.attributi !== null ? r.attributi : {};
  const annoDiOggi = Number(oggi.slice(0, 4));
  const attributi: Record<string, string | number> = {};

  const regime = typeof a.REGIME === "string" ? a.REGIME : "";
  if (!REGIMI.includes(regime as (typeof REGIMI)[number])) {
    return scarta("Non ho capito il regime.", "REGIME fuori elenco");
  }
  attributi.REGIME = regime;

  const fatturato = numeroNelLimite(a.FATTURATO_STIMATO, TETTO_RICAVI);
  if (fatturato === null) return scarta("Il fatturato non è un numero valido.", "FATTURATO_STIMATO fuori limite");
  attributi.FATTURATO_STIMATO = fatturato;

  const mensile = numeroNelLimite(a.ACCANTONAMENTO_MESE, TETTO_IMPORTI);
  if (mensile === null) return scarta("L'accantonamento non è un numero valido.", "ACCANTONAMENTO_MESE fuori limite");
  attributi.ACCANTONAMENTO_MESE = mensile;

  /*
    La prima scadenza è obbligatoria: senza di lei non c'è niente da
    ricordare, e un promemoria senza data è un'email che non parte mai.
  */
  const data1 = typeof a.SCAD_1_DATA === "string" ? a.SCAD_1_DATA : "";
  if (!dataPlausibile(data1, annoDiOggi)) {
    return scarta("La data della scadenza non è valida.", "SCAD_1_DATA non plausibile");
  }
  const importo1 = numeroNelLimite(a.SCAD_1_IMPORTO, TETTO_IMPORTI);
  if (importo1 === null) return scarta("L'importo della scadenza non è valido.", "SCAD_1_IMPORTO fuori limite");
  attributi.SCAD_1_DATA = data1;
  attributi.SCAD_1_IMPORTO = importo1;

  /*
    La seconda è facoltativa, e deve esserlo: nel primo anno di attività — e
    sotto la soglia degli acconti — di appuntamenti ce n'è uno solo. Mandare
    una data vuota e uno zero farebbe uscire un'email che annuncia «0 € da
    versare» in una data che non esiste.
  */
  const haData2 = a.SCAD_2_DATA !== undefined && a.SCAD_2_DATA !== null && a.SCAD_2_DATA !== "";
  const haImporto2 = a.SCAD_2_IMPORTO !== undefined && a.SCAD_2_IMPORTO !== null && a.SCAD_2_IMPORTO !== "";
  if (haData2 !== haImporto2) {
    return scarta("Le scadenze non tornano.", "SCAD_2: data e importo non vanno a coppia");
  }
  if (haData2) {
    const data2 = typeof a.SCAD_2_DATA === "string" ? a.SCAD_2_DATA : "";
    if (!dataPlausibile(data2, annoDiOggi)) {
      return scarta("La data della seconda scadenza non è valida.", "SCAD_2_DATA non plausibile");
    }
    const importo2 = numeroNelLimite(a.SCAD_2_IMPORTO, TETTO_IMPORTI);
    if (importo2 === null || importo2 <= 0) {
      return scarta("L'importo della seconda scadenza non è valido.", "SCAD_2_IMPORTO fuori limite");
    }
    if (data2 <= data1) {
      return scarta("Le scadenze non sono in ordine.", "SCAD_2_DATA non successiva a SCAD_1_DATA");
    }
    attributi.SCAD_2_DATA = data2;
    attributi.SCAD_2_IMPORTO = importo2;
  }

  return { ok: true, email, attributi };
}

/**
 * L'origine della richiesta è una delle nostre?
 *
 * Non è un presidio contro chi vuole davvero inondare l'endpoint — un'intestazione
 * la scrive chiunque con `curl` — ed è inutile dire il contrario. Serve contro
 * il caso che succede per davvero: il modulo copiato su un altro sito, o uno
 * script di terzi che chiama l'indirizzo perché l'ha trovato nel bundle. Quel
 * traffico porta l'`Origin` giusto di qualcun altro, o non lo porta affatto.
 *
 * Il freno vero contro l'abuso non è questo: è che la funzione non ha nessun
 * modo di dire a Brevo di mandare un'email diversa da quella di conferma, e
 * che il doppio opt-in non iscrive nessuno che non abbia cliccato nella
 * propria posta.
 */
export function origineAmmessa(origine: string | undefined, ammesse: string[]): boolean {
  if (!origine) return false;
  return ammesse.includes(origine.replace(/\/$/, ""));
}
