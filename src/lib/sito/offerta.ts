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
 * diverse.
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
 */

/** C'è ancora qualcosa da scrivere in questa sezione? Una riga sola da cambiare. */
export const DA_RIEMPIRE = true;

export const OFFERTA = {
  /** Il nome commerciale dell'offerta. */
  nome: "[NOME DELL'OFFERTA]",
  /** Una riga sotto il nome: per chi è, e perché adesso. */
  sottotitolo: "[UNA RIGA: per chi è questa offerta, e perché conviene adesso]",
  /** Cosa include, una voce per riga. Vanno con la spunta. */
  include: [
    "[VOCE 1 — la cosa più importante che si ottiene]",
    "[VOCE 2]",
    "[VOCE 3]",
    "[VOCE 4]",
  ],
  /**
   * I posti rimasti.
   *
   * Un numero fermo, scritto qui, e per ora nient'altro: un contatore che
   * scende da solo senza che niente lo decida è una scarsità inventata, e si
   * riconosce — basta ricaricare domani e trovarlo identico, o più basso
   * senza ragione. Quando ci sarà un numero vero di licenze vendute, questo
   * valore verrà da lì.
   */
  posti: 20,
  /** La riga della garanzia: quella contrattuale, non una promessa nuova. */
  garanzia: "[RIGA DELLA GARANZIA — richiama i 30 giorni dei Termini]",
} as const;
