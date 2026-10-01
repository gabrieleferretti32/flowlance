/**
 * L'unica funzione serverless di Flowlance: iscrive ai promemoria delle
 * scadenze, e nient'altro.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché questo file è un guscio di quindici righe
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Tutto quello che decide sta in `src/lib/sito/promemoria-server.ts`, che è
 * provato dalla griglia con un `fetch` finto: una funzione che si può provare
 * solo distribuendola non si prova, e si scopre rotta dal fatto che nessuno si
 * iscrive. Qui restano soltanto le due cose che dipendono da Vercel — la firma
 * e la lettura dell'ambiente — così se la firma cambia non c'è logica da
 * riscrivere.
 *
 * Sta alla radice e non sotto `src/app`: con `output: "export"` Next non ha un
 * runtime, e un POST su un route handler dopo il build non esisterebbe da
 * nessuna parte. Vercel compila `/api/*` come funzione anche quando il
 * framework è «altro» e l'output è una cartella statica, che è la nostra
 * configurazione in `vercel.json`. L'export statico resta quello di prima, e
 * `/app` non conosce questo indirizzo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le variabili d'ambiente, e perché la loro assenza è l'interruttore
 * ─────────────────────────────────────────────────────────────────────────
 *
 * - `BREVO_API_KEY` — la chiave. Non ha `NEXT_PUBLIC_`, quindi non entra in
 *   nessun bundle: la legge soltanto questo processo.
 * - `BREVO_LISTA_PROMEMORIA` — l'id della lista a cui il contatto si aggiunge
 *   **dopo** aver confermato.
 * - `BREVO_TEMPLATE_DOI` — l'id del modello dell'email di conferma.
 *
 * Manca una delle tre e la funzione risponde «non ancora attivi» senza
 * contattare nessuno. È l'interruttore: finché l'informativa privacy non
 * descrive questi sette attributi non si raccolgono, e non raccoglierli non
 * dipende dal fatto che qualcuno si ricordi di non accendere il modulo.
 */
import { DOMINIO } from "../src/lib/sito/impostazioni";
import { SITO } from "../src/lib/rotte";
import { gestisciPromemoria, originiAmmesse } from "../src/lib/sito/promemoria-server";

export default async function promemoria(richiesta: Request): Promise<Response> {
  const esito = await gestisciPromemoria(
    richiesta,
    {
      chiave: process.env.BREVO_API_KEY,
      lista: process.env.BREVO_LISTA_PROMEMORIA,
      modello: process.env.BREVO_TEMPLATE_DOI,
      /*
        Dove Brevo rimanda dopo il clic di conferma: il simulatore stesso. Non
        una pagina di ringraziamento nuova — chi conferma dalla posta, magari
        su un altro dispositivo, torna dove può fare la cosa successiva.
      */
      ritorno: `${DOMINIO}${SITO.simulatore}/`,
      origini: originiAmmesse(DOMINIO, process.env.VERCEL_URL),
    },
    {
      fetch: globalThis.fetch,
      oggi: new Date().toISOString().slice(0, 10),
      adesso: Date.now(),
    },
  );

  /*
    Il registro porta il motivo tecnico, la risposta no. Sono due destinatari
    diversi: a chi guarda la pagina serve sapere che non è partita, a chi
    legge i log di Vercel serve sapere perché.
  */
  if (esito.registro) console.warn(`promemoria: ${esito.registro}`);

  return new Response(JSON.stringify(esito.corpo), {
    status: esito.stato,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
