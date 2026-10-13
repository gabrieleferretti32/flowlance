/**
 * Il registro delle prove su Vercel Blob.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché Blob, fra quello che Vercel offre
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il registro ha una forma precisa: si **scrive** qualche volta al giorno, non
 * si legge quasi mai, non si interroga, non si aggiorna, e non si cancella —
 * tranne una volta l'anno, quando scade. È un giornale, non una tabella.
 *
 * - **Blob** (quello scelto). Un file per evento, scritto e mai più toccato.
 *   Niente schema da migrare, niente connessioni da gestire in una funzione
 *   che vive tre secondi, e soprattutto **niente scritture concorrenti sullo
 *   stesso oggetto**: due eventi nello stesso istante sono due file, non una
 *   lettura-modifica-scrittura che ne perde uno.
 * - **Postgres.** Darebbe le interrogazioni, che qui non servono mai, in
 *   cambio di uno schema, delle migrazioni e di un pool di connessioni dentro
 *   una funzione serverless. E darebbe un database a un prodotto che si vende
 *   dicendo di non averne uno: la distinzione «il sito ha un giornale delle
 *   prove, l'applicazione non ha un server» regge meglio con un magazzino di
 *   file che con un'istanza Postgres.
 * - **KV / Redis.** Fatto per leggere spesso e scadere da solo. Qui si legge
 *   quasi mai, e la scadenza la decide il legale, non un TTL.
 * - **Edge Config.** In sola lettura dal codice: non è un posto dove scrivere.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Quello che non è verificato
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il magazzino va creato sul pannello di Vercel e collegato al progetto, che
 * fornisce `BLOB_READ_WRITE_TOKEN`. Da questo ambiente `vercel.com` è bloccato
 * dal proxy di rete, quindi **non ho potuto leggere la documentazione né
 * provare una scrittura vera**: quello che c'è qui sotto compila contro i tipi
 * del pacchetto `@vercel/blob@2.8.1`, e tanto vale. La prima scrittura vera va
 * guardata sul pannello.
 */
import { put } from "@vercel/blob";
import {
  nomeEvento,
  type Esclusione,
  type EventoAccettazione,
  type EventoProva,
  type RegistroProve,
} from "./registro-prove";

export function registroSuBlob(token: string): RegistroProve {
  /*
    I tre archivi sono tre prefissi dello stesso magazzino, e non tre magazzini.

    Separarli in tre store vorrebbe dire tre token, tre configurazioni sul
    pannello e tre modi di sbagliarne una; il prefisso lo decide `nomeEvento`,
    che è codice e si prova. Quello che la separazione deve garantire — che un
    archivio non finisca letto per l'altro — lo garantisce il nome, non il
    confine del magazzino.
  */
  async function deposita(cosa: EventoProva | Esclusione | EventoAccettazione) {
    await put(nomeEvento(cosa), JSON.stringify(cosa), {
      access: "public",
      token,
      /*
        Il suffisso casuale, e perché **non** si disattiva.

        Senza, due eventi dello stesso tipo nello stesso giorno finirebbero
        sullo stesso nome e il secondo coprirebbe il primo: due prove
        diventerebbero una, e la mancante sarebbe quella vecchia — cioè quella
        che serve. Con il suffisso ogni evento è un file suo.
      */
      addRandomSuffix: true,
      contentType: "application/json",
      /*
        Niente cache: un file di prova non viene riletto da una rete di
        distribuzione, e un oggetto che resta in cache è un oggetto che
        continua a esistere dopo essere stato cancellato.
      */
      cacheControlMaxAge: 0,
    });
  }

  return {
    scrivi: (evento) => deposita(evento),
    escludi: (esclusione) => deposita(esclusione),
    accetta: (evento) => deposita(evento),
  };
}
