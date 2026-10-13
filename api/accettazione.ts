/**
 * Registra l'accettazione dei Termini, e restituisce l'identificativo da
 * portare a Stripe.
 *
 * Il guscio: tutto quello che decide sta in
 * `src/lib/sito/accettazione-server.ts`, provato con un registro finto. Qui
 * restano le due cose che dipendono da Vercel — la firma della funzione e la
 * lettura dell'ambiente.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le variabili d'ambiente
 * ─────────────────────────────────────────────────────────────────────────
 *
 * - `BLOB_READ_WRITE_TOKEN` — il magazzino degli archivi, che Vercel fornisce
 *   collegando il Blob store al progetto. **Qui è obbligatoria**, al contrario
 *   che per i promemoria: senza, la funzione risponde 503 e la pagina non apre
 *   il pagamento. Un acquisto senza la prova di cosa è stato accettato è
 *   esattamente quello che questo giro esiste per evitare.
 *
 * Non c'è nessuna variabile di Stripe: questa funzione non parla con Stripe.
 * L'identificativo torna alla pagina, che lo attacca al Payment Link.
 */
import { DOMINIO } from "../src/lib/sito/impostazioni";
import { gestisciAccettazione } from "../src/lib/sito/accettazione-server";
import { originiAmmesse } from "../src/lib/sito/origini";
import { registroSuBlob } from "../src/lib/sito/registro-blob";

export default async function accettazione(richiesta: Request): Promise<Response> {
  const magazzino = process.env.BLOB_READ_WRITE_TOKEN;
  const esito = await gestisciAccettazione(
    richiesta,
    { origini: originiAmmesse(DOMINIO, process.env.VERCEL_URL), magazzino },
    {
      registro: magazzino ? registroSuBlob(magazzino) : null,
      adesso: () => new Date().toISOString(),
    },
  );

  if (esito.registro) console.warn(`accettazione: ${esito.registro}`);

  return new Response(JSON.stringify(esito.corpo), {
    status: esito.stato,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
