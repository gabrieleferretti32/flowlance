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
 * Cosa la pagina NON fa
 * ─────────────────────────────────────────────────────────────────────────
 *
 * **Non raccoglie l'approvazione specifica delle clausole ex artt. 1341 e
 * 1342.** Quella avviene per email, a mano, prima della consegna della chiave,
 * come dice il punto 13. La ragione è che una spunta su un sito statico non
 * lascia traccia da nessuna parte: non c'è un server che la registri, e una
 * dichiarazione che nessuno conserva non è una prova, è un'animazione. L'email
 * dell'acquirente, invece, è un documento che resta nel fascicolo.
 *
 * La casella di questa pagina è quindi una cosa sola, ed è onesta su cosa sia:
 * **un filtro all'ingresso**, che impedisce di comprare a chi consumatore lo è
 * davvero, e un promemoria di cosa arriverà via email.
 */
import { euro, euroTondo, percentuale } from "@/lib/format";
import { DOMINIO } from "./impostazioni";
import { SITO } from "@/lib/rotte";

/**
 * Il Payment Link di Stripe.
 *
 * `"DA-CREARE"` finché il collegamento non esiste: stessa forma del segnaposto
 * della chiave pubblica, e stessa ragione. Una pagina che manda su un
 * indirizzo inventato prende i soldi di nessuno e li perde in silenzio; una
 * che dichiara di non essere pronta si vede subito.
 *
 * Quando il link esiste, si incolla qui e basta. Non va altrove.
 */
export const PAYMENT_LINK = "DA-CREARE";

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

/** L'indirizzo pubblico della pagina d'acquisto, per i collegamenti che stanno nell'app. */
export const INDIRIZZO_ACQUISTO_PUBBLICO = `${DOMINIO}${SITO.acquisto}/`;
