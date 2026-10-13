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
 * Il magazzino è privato, e il codice lo dice a ogni scrittura
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `access: "private"`. Non è una ripetizione dell'impostazione del pannello: è
 * il pacchetto che richiede di dichiararlo a ogni `put`, e un `"public"` scritto
 * qui dentro, in un magazzino privato, è il modo preciso in cui un archivio di
 * prove — con dentro degli indirizzi email — diventerebbe una serie di file
 * leggibili da chiunque conosca l'indirizzo. Nessun errore, nessun avviso, e
 * dei .json con dentro delle persone raggiungibili da fuori.
 *
 * Il magazzino sta nella regione **fra1 (Francoforte)**: i dati restano nello
 * Spazio economico europeo, che per un archivio probatorio di consensi è una
 * delle poche cose che si decidono una volta sola. Vedi DEPLOY.md.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Quello che non è verificato
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il magazzino va creato sul pannello di Vercel e collegato al progetto, che
 * fornisce `BLOB_READ_WRITE_TOKEN`. Da questo ambiente `vercel.com` è bloccato
 * dal proxy di rete, quindi **non ho potuto leggere la documentazione né
 * provare una scrittura vera**: quello che c'è qui sotto compila contro i tipi
 * del pacchetto `@vercel/blob@2.8.1` — dove `access` è `'public' | 'private'` e
 * il controllo a tempo d'esecuzione accetta tutti e due — e tanto vale. La prima
 * scrittura vera va guardata sul pannello.
 */
import { put } from "@vercel/blob";
import {
  nomeEvento,
  type Esclusione,
  type EventoAccettazione,
  type EventoProva,
  type RegistroProve,
} from "./registro-prove";

/**
 * Quel poco di `put` che serve qui.
 *
 * Il parametro esiste per una ragione sola: provare **che cosa** si manda al
 * magazzino senza un magazzino. Le opzioni di scrittura — prima fra tutte
 * `access` — non si possono guardare da nessun'altra parte: una scrittura
 * pubblica in un magazzino privato non fallisce, riesce, e il file resta
 * leggibile da fuori. Qui invece un test le legge e le pretende.
 */
export type ScritturaBlob = (
  percorso: string,
  contenuto: string,
  opzioni: {
    access: "public" | "private";
    token: string;
    addRandomSuffix: boolean;
    contentType: string;
    cacheControlMaxAge: number;
  },
) => Promise<unknown>;

export function registroSuBlob(token: string, metti: ScritturaBlob = put): RegistroProve {
  /*
    I tre archivi sono tre prefissi dello stesso magazzino, e non tre magazzini.

    Separarli in tre store vorrebbe dire tre token, tre configurazioni sul
    pannello e tre modi di sbagliarne una; il prefisso lo decide `nomeEvento`,
    che è codice e si prova. Quello che la separazione deve garantire — che un
    archivio non finisca letto per l'altro — lo garantisce il nome, non il
    confine del magazzino.
  */
  async function deposita(cosa: EventoProva | Esclusione | EventoAccettazione) {
    await metti(nomeEvento(cosa), JSON.stringify(cosa), {
      /*
        Privato, come il magazzino. Vedi la testa del file: qui «public» non
        darebbe nessun errore, e lascerebbe gli eventi leggibili da fuori.
      */
      access: "private",
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
