/**
 * Gli eventi verso le statistiche, e quello che non portano con sé.
 */

type Gtag = (comando: "event", nome: string, parametri?: Record<string, unknown>) => void;

/**
 * Manda un evento a GA4, **senza parametri**, se e solo se GA4 è stato caricato.
 *
 * Non c'è nessun controllo sul consenso qui dentro, ed è voluto: `gtag` esiste
 * nella pagina solo se il componente delle statistiche l'ha montato, e quello
 * lo monta solo dietro il sì. Un secondo controllo sarebbe una seconda
 * definizione di «si può misurare», e il giorno in cui le due divergono vince
 * quella sbagliata.
 */
export function tracciaEvento(nome: string): void {
  const gtag = (globalThis as { gtag?: Gtag }).gtag;
  if (typeof gtag !== "function") return;
  gtag("event", nome);
}

/**
 * Il simulatore ha prodotto un risultato.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché questo evento è vuoto, e deve restare vuoto
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Sarebbe comodo allegarci il fatturato, il gruppo ATECO e la gestione: si
 * saprebbe chi sono le persone che provano il simulatore, e si scriverebbe la
 * pagina di vendita per loro. Ed è esattamente la ragione per cui non si fa.
 *
 * Quei tre campi insieme sono il reddito di una persona, il suo mestiere e la
 * sua cassa previdenziale. Non sono un dato aggregato: sono un profilo
 * economico, mandato a Google, di qualcuno che stava solo facendo un conto — e
 * che in cima alla pagina ha letto che i suoi numeri non escono dal browser.
 * Con i parametri attaccati quella frase diventerebbe falsa, e resterebbe
 * scritta.
 *
 * Quindi si conta **quante volte**, e nient'altro. Basta a sapere se la pagina
 * serve a qualcosa, che è l'unica domanda per cui questo evento esiste.
 */
export const EVENTO_SIMULATORE = "simulatore_calcolato";
