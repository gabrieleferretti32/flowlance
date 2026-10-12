/**
 * L'acquisto: il collegamento a Stripe, il prezzo, e cosa si dichiara prima.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché c'è una pagina in mezzo
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il punto 1 dei Termini offre Flowlance **ai soli professionisti** e vuole che
 * l'acquirente lo dichiari: «la dichiarazione è condizione dell'acquisto». Un
 * Payment Link di Stripe non la sa raccogliere — i campi personalizzati sono
 * tre, sono campi di testo o menù, e una casella da spuntare con accanto una
 * frase lunga non è fra le forme possibili.
 *
 * Da qui la pagina ponte: testo integrale dei Termini, PDF con la sua impronta,
 * la dichiarazione come casella obbligatoria, e solo dopo il collegamento al
 * pagamento.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le due caselle, e cosa sono davvero
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Dalla versione 3 i Termini non hanno più clausole soggette ad approvazione
 * specifica ex artt. 1341 e 1342 c.c.: niente massimale, niente foro
 * esclusivo, niente esclusioni di responsabilità. Con quelle è sparito anche
 * il flusso che le raccoglieva — l'email, la risposta dall'indirizzo
 * dell'acquirente, l'attesa prima della chiave — e il contratto si conclude
 * dove lo si conclude di solito: al pagamento.
 *
 * Qui restano due caselle, e nessuna delle due è una firma:
 *
 * - **l'accettazione dei Termini**, che è il momento in cui l'acquirente li
 *   ha davanti — per intero in pagina, e in PDF con la sua impronta — prima
 *   di pagare;
 * - **la dichiarazione professionale** del punto 1, che è condizione
 *   dell'acquisto e tiene fuori chi consumatore lo è davvero.
 *
 * Una spunta su un sito statico non lascia traccia da nessuna parte: non c'è
 * un server che la registri. La prova di cosa è stato accettato non è questa
 * casella, è il PDF con la sua impronta che parte per email subito dopo il
 * pagamento — un documento su supporto durevole, che resta nel fascicolo.
 */
import { euro, euroTondo, percentuale } from "@/lib/format";
import { DOMINIO, PAYMENT_LINK } from "./impostazioni";
import { SITO } from "@/lib/rotte";

/**
 * Il Payment Link, riesposto da `impostazioni.ts`.
 *
 * Il valore sta là perché lo legge anche `next.config.ts`, che non può
 * attraversare un modulo con gli alias `@/`. Qui c'è il nome con cui lo
 * chiedono le pagine, che è dove si usa: quando il link esiste, si incolla in
 * `src/lib/sito/impostazioni.ts` e basta.
 */
export { PAYMENT_LINK };

/** Il collegamento è configurato, o siamo ancora al segnaposto? */
export function pagamentoConfigurato(link: string = PAYMENT_LINK): boolean {
  return /^https:\/\/(buy\.stripe\.com|[a-z0-9-]+\.stripe\.com)\/\S+$/.test(link);
}

/**
 * Il prezzo, in euro.
 *
 * Sta scritto anche nei Termini, al punto 6, ed è inevitabile: là è una
 * clausola contrattuale, qui è quello che la pagina mostra. Non si può leggere
 * l'uno dall'altro senza estrarre numeri da una frase in prosa — e una regex su
 * un contratto è un difetto che aspetta il giorno in cui il legale riscrive la
 * riga. Al posto della lettura c'è una tagliola: un test verifica che questi
 * tre numeri compaiano nel testo del punto 6, e fallisce se uno dei due
 * documenti si muove senza l'altro.
 */
export const PREZZO = { imponibile: 97, aliquotaIva: 0.22, totale: 118.34 } as const;

/**
 * Il prezzo **già scritto**, nella forma in cui si mostra. Sempre questa.
 *
 * Non è cerimonia: il pulsante della testata diceva «97,00 € + IVA» mentre la
 * sezione del prezzo, due schermate più giù, diceva «97 € all'anno». Stesso
 * numero, due formati, due chiamate diverse — e il controllo che confrontava i
 * **valori** ci passava attraverso senza vedere niente, perché di valori
 * sbagliati non ce n'erano.
 *
 * È la stessa forma di difetto del registro dei derivati, spostata dal numero
 * alla sua scrittura: due strade per mostrare la stessa cosa, e prima o poi ne
 * prendono una diversa. La risposta è la stessa — una strada sola. Qui non c'è
 * più una scelta da fare al momento di stampare: `euroTondo` o `euro` è già
 * stato deciso, una volta, per ciascuna delle tre voci.
 *
 * - `imponibile` è un prezzo intero e i centesimi sono rumore: «97 €».
 * - `totale` i centesimi ce li ha davvero, ed è la cifra che finisce in
 *   fattura: «118,34 €».
 */
export const PREZZO_SCRITTO = {
  imponibile: euroTondo(PREZZO.imponibile),
  totale: euro(PREZZO.totale),
  aliquota: percentuale(PREZZO.aliquotaIva, 0),
} as const;

/**
 * La dichiarazione che si spunta, per esteso.
 *
 * È il testo del punto 1 ridotto a una frase, e sta qui in una costante perché
 * la pagina e la tagliola guardino la stessa: una casella la cui etichetta
 * dicesse meno del contratto sarebbe una dichiarazione raccolta su una frase
 * diversa da quella che obbliga.
 */
export const DICHIARAZIONE_PROFESSIONALE =
  "Dichiaro di acquistare nell'esercizio della mia attività imprenditoriale, commerciale, "
  + "artigianale o professionale, e per finalità connesse a tale attività. "
  + "Flowlance non è destinato ai consumatori.";

/**
 * L'accettazione dei Termini, con dentro il numero di versione.
 *
 * Il numero non è decorazione: il punto 12 dice che la licenza resta regolata
 * dalla versione accettata all'acquisto, e una casella che dicesse soltanto
 * «accetto i Termini» lascerebbe aperta la domanda *quali*. Arriva da
 * `contenuti/termini.md` attraverso la pagina — non è scritto qui, perché qui
 * sarebbe un secondo numero da tenere allineato.
 */
export function accettazioneTermini(versione: number): string {
  return (
    `Ho letto e accetto i Termini di servizio, versione ${versione}, `
    + "che trovo per intero e in PDF in fondo a questa pagina."
  );
}

/**
 * Cosa succede premendo il pulsante, scritto prima di premerlo.
 *
 * Tre fatti che prima stavano in tre posti diversi — il contratto si conclude
 * al pagamento (punto 3), la chiave arriva entro 24 ore lavorative (punto 3),
 * il rimborso è integrale entro 30 giorni (punto 7) — e che una persona vuole
 * sapere **mentre decide**. In fondo a un contratto si leggono dopo aver
 * deciso, che è troppo tardi perché servano.
 *
 * Sta in una costante perché la guardi anche la tagliola: una pagina che
 * promettesse una cosa diversa dal contratto sarebbe il difetto peggiore di
 * tutto il flusso d'acquisto.
 */
export const PRIMA_DI_PAGARE =
  "Paghi, il contratto è concluso e ricevi la chiave per email entro 24 ore lavorative. "
  + "Rimborso integrale entro 30 giorni.";

/** L'indirizzo pubblico della pagina d'acquisto, per i collegamenti che stanno nell'app. */
export const INDIRIZZO_ACQUISTO_PUBBLICO = `${DOMINIO}${SITO.acquisto}/`;
