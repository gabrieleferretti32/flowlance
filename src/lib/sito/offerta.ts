/**
 * La sezione dell'offerta sul simulatore: tutti i testi in un blocco solo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché un file e non del testo nel JSX
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Sono i testi che cambiano più spesso di tutti — il nome dell'offerta, cosa
 * include, quanti posti restano — e che vanno cambiati *insieme*: un elenco
 * aggiornato accanto a un nome vecchio è un'offerta che non esiste. Scritti
 * dentro la pagina diventano otto modifiche in otto punti, e la nona volta
 * una se ne dimentica.
 *
 * Il prezzo **non** è qui: arriva da `acquisto.ts`, già scritto, nella forma
 * in cui si mostra. Due posti dove è scritto «97 €» sono due prezzi, e il
 * giorno in cui uno cambia la pagina ne mostra due diversi a due altezze
 * diverse. Per la stessa ragione il sottotitolo e la riga dei posti si
 * **compongono**: dentro ci sono il prezzo e il numero dei Fondatori, e sono
 * gli stessi valori che stanno nel contratto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * I segnaposto si vedono, di proposito
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Finché `DA_RIEMPIRE` è vero la card porta a schermo una fascia che lo dice.
 * Non è una dimenticanza mascherata da bozza: è il contrario — un segnaposto
 * invisibile è quello che finisce in produzione, e si scopre da uno screenshot
 * in una chat. Questa fascia non ci arriva senza che qualcuno la veda.
 *
 * Non c'è un presidio che fermi il build, a differenza del Payment Link: un
 * link di pagamento al segnaposto prende i soldi di nessuno e li perde, un
 * testo d'offerta al segnaposto fa una brutta figura. Sono due gravità
 * diverse, e meritano due risposte diverse.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Quello che qui è una promessa, nei Termini è un obbligo
 * ─────────────────────────────────────────────────────────────────────────
 *
 * «97 € + IVA l'anno anche a ogni rinnovo» non è una frase di vendita: è il
 * punto 6-bis del contratto, che la rende esigibile. I numeri che compaiono in
 * questa card — 50 posti, 97 €, 30 giorni — sono gli stessi tre numeri di
 * quella clausola, e `strumenti/verifica-offerta.mjs` fallisce il build se uno
 * dei due documenti si muove senza l'altro. La pagina che promette di più del
 * contratto è pubblicità ingannevole; quella che promette di meno regala.
 */
import { SITO } from "@/lib/rotte";
import { collegamentoAlPunto } from "@/lib/contenuti/ancore";
import { PREZZO_SCRITTO } from "./acquisto";

/** C'è ancora qualcosa da scrivere in questa sezione? Una riga sola da cambiare. */
export const DA_RIEMPIRE = false;

/**
 * I posti, cioè i Fondatori del punto 6-bis.
 *
 * Un numero fermo, scritto qui, e per ora nient'altro: un contatore che scende
 * da solo senza che niente lo decida è una scarsità inventata, e si riconosce
 * — basta ricaricare domani e trovarlo identico, o più basso senza ragione.
 * Quando ci sarà un numero vero di licenze vendute, questo valore verrà da lì.
 *
 * Oggi è 50 perché le licenze vendute sono zero e la clausola ne garantisce
 * cinquanta. Il giorno in cui scende, scende **questo** numero: quello del
 * contratto — «i primi 50 acquirenti» — non si tocca, perché è il totale dei
 * Fondatori e non quelli che restano.
 */
const FONDATORI = 50;

/** Il punto dei Termini che regge la promessa sui rinnovi. */
export const PUNTO_PREZZO_GARANTITO = "6-bis";

/** Dove porta il rimando: al punto, non in testa alla pagina. */
export const RIMANDO_AI_TERMINI = collegamentoAlPunto(SITO.termini, PUNTO_PREZZO_GARANTITO);

/**
 * Le condizioni essenziali, sotto il prezzo e senza un clic in mezzo.
 *
 * Le tre cose che cambiano il valore di quello che si sta comprando: il
 * termine entro cui rinnovare, che la garanzia è personale, e dove sta scritto
 * per intero. Stanno **nella card**, non dentro un accordion e non dietro un
 * asterisco: una condizione che si vede solo aprendo qualcosa è una condizione
 * che non si è letta, e il punto 6-bis la rende esigibile comunque.
 */
export const CONDIZIONI_ESSENZIALI =
  "Il prezzo resta valido se rinnovi entro 30 giorni dalla scadenza. "
  + "È personale e non cedibile. "
  + `Condizioni al punto ${PUNTO_PREZZO_GARANTITO} dei Termini.`;

/** La parte della frase che è un collegamento. */
export const TESTO_DEL_RIMANDO = `punto ${PUNTO_PREZZO_GARANTITO} dei Termini`;

/**
 * La frase spezzata nei tre pezzi che servono a renderla: prima, link, dopo.
 *
 * Il taglio si fa qui e non nel JSX perché un `split` che non trova niente
 * **non è un errore**: restituisce la stringa intera, il collegamento sparisce,
 * e la card continua a comporsi senza dire niente. Resterebbe una frase che
 * nomina un punto del contratto senza portarci — cioè l'unica parte di questa
 * card che si poteva perdere in silenzio. Qui invece si ferma il build, che è
 * dove il prerendering della pagina chiama questa funzione.
 */
export function condizioniSpezzate(): { prima: string; rimando: string; dopo: string } {
  const taglio = CONDIZIONI_ESSENZIALI.indexOf(TESTO_DEL_RIMANDO);
  if (taglio < 0) {
    throw new Error(
      `Le condizioni dell'offerta non nominano «${TESTO_DEL_RIMANDO}»:\n`
        + `  ${CONDIZIONI_ESSENZIALI}\n\n`
        + "Senza quel pezzo non c'è niente da trasformare in collegamento, e la\n"
        + "frase resterebbe un rimando a un punto del contratto che non si apre.",
    );
  }
  return {
    prima: CONDIZIONI_ESSENZIALI.slice(0, taglio),
    rimando: TESTO_DEL_RIMANDO,
    dopo: CONDIZIONI_ESSENZIALI.slice(taglio + TESTO_DEL_RIMANDO.length),
  };
}

export const OFFERTA = {
  /** Il nome commerciale dell'offerta. */
  nome: "Prezzo fondatori",
  /** Una riga sotto il nome: per chi è, e perché adesso. */
  sottotitolo:
    `Per i primi ${FONDATORI} professionisti, ${PREZZO_SCRITTO.imponibile} + IVA l'anno `
    + "anche a ogni rinnovo.",
  /**
   * Cosa include, una voce per riga. Vanno con la spunta.
   *
   * Cinque schermate che l'applicazione ha, non cinque benefici: il cruscotto
   * col semaforo fiscale, il prospetto di `/app/fisco`, lo scadenzario, il
   * confronto fra i due regimi e «quanto posso spendere» di
   * `/app/finanze/spesa`. Un elenco di cose che il prodotto farà è la riga per
   * cui si chiede il rimborso al punto 7.
   */
  include: [
    "Il cruscotto: quanto dei soldi sul conto è tuo e quanto è già del fisco",
    "Il prospetto di imposte e contributi, riga per riga, da portare al commercialista",
    "Lo scadenzario: saldo, acconti, IVA e contributi, con date e importi",
    "Forfettario e ordinario, con il confronto fra i due",
    "Quanto puoi spendere questo mese, dai movimenti della banca",
  ],
  /** I posti rimasti. Vedi `FONDATORI`. */
  posti: FONDATORI,
  /** La riga della garanzia: quella contrattuale, non una promessa nuova. */
  garanzia: "Rimborso integrale entro 30 giorni, senza dover spiegare perché.",
} as const;
