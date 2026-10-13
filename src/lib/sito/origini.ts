/**
 * Chi può chiamare le funzioni serverless: il sito, e l'anteprima quando c'è.
 *
 *   import { origineAmmessa, originiAmmesse } from "./origini";
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché queste due righe stanno in un file loro
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Sono vissute per mesi dentro `promemoria.ts` e `promemoria-server.ts`, dove
 * erano nate: c'era una funzione serverless sola e il controllo dell'origine
 * era un dettaglio di quella. Ora ce ne sono tre, e una — quella che registra
 * l'accettazione dei Termini — non deve vedere il codice che manda email.
 *
 * Lasciate dov'erano, bastava `import { originiAmmesse } from "./promemoria-server"`
 * perché l'intero meccanismo d'invio finisse nella chiusura degli import della
 * funzione delle accettazioni: non un errore, nessun comportamento sbagliato,
 * e però la separazione fra l'archivio che non contiene nessuno e il codice
 * che ha in mano gli indirizzi smetteva di essere vera. `verifica-registro.mjs`
 * la pretende, e questo file è il modo di dargliela senza riscrivere due volte
 * il controllo dell'origine.
 *
 * Qui dentro non c'è niente del servizio promemoria, niente di Stripe e niente
 * dell'acquisto: solo la domanda «questa richiesta viene da noi?».
 */

/**
 * L'origine della richiesta è una delle nostre?
 *
 * Non è un presidio contro chi vuole davvero inondare l'endpoint — un'intestazione
 * la scrive chiunque con `curl` — ed è inutile dire il contrario. Serve contro
 * il caso che succede per davvero: il modulo copiato su un altro sito, o uno
 * script di terzi che chiama l'indirizzo perché l'ha trovato nel bundle. Quel
 * traffico porta l'`Origin` giusto di qualcun altro, o non lo porta affatto.
 *
 * Il freno vero contro l'abuso non è questo: per l'iscrizione, è che la
 * funzione non ha nessun modo di dire a Brevo di mandare un'email diversa da
 * quella di conferma, e che il doppio opt-in non iscrive nessuno che non abbia
 * cliccato nella propria posta; per le accettazioni, è che l'evento non
 * contiene nessun dato personale e che l'identificativo serve a qualcosa solo
 * se poi su Stripe arriva un pagamento.
 */
export function origineAmmessa(origine: string | undefined, ammesse: string[]): boolean {
  if (!origine) return false;
  return ammesse.includes(origine.replace(/\/$/, ""));
}

/**
 * Le origini ammesse: il sito, e la distribuzione di anteprima quando c'è.
 *
 * L'anteprima serve a provare le funzioni prima di mandarle in produzione, ed
 * è l'unico modo di farlo davvero — `next dev` non le esegue. Senza il suo
 * indirizzo fra le ammesse, la prova finirebbe con un 403 che sembra un
 * difetto del codice.
 */
export function originiAmmesse(dominio: string, urlVercel: string | undefined): string[] {
  const host = dominio.replace(/^https?:\/\//, "");
  const ammesse = [`https://${host}`, `https://www.${host}`];
  if (urlVercel) ammesse.push(`https://${urlVercel.replace(/^https?:\/\//, "")}`);
  return ammesse;
}
