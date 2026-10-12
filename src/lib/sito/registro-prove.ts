/**
 * Il registro delle prove di consenso: fuori da Brevo, e fuori dalla portata
 * di chi manda email.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché esiste
 * ─────────────────────────────────────────────────────────────────────────
 *
 * L'art. 7.1 del GDPR chiede di poter **dimostrare** che un consenso c'è
 * stato. Finché il contatto vive in Brevo la prova è là dentro — ma il primo
 * termine di conservazione **cancella il contatto**, e cancellando il contatto
 * si cancella anche la prova che quella persona aveva chiesto qualcosa e poi
 * non aveva confermato. Si resterebbe senza il dato e senza la prova di averlo
 * trattato legittimamente: il verso peggiore dei due.
 *
 * Quindi il registro sta **fuori** da Brevo, e la pulizia ci scrive l'evento
 * **prima** di cancellare, mai dopo. Se la scrittura non riesce, la
 * cancellazione non parte: meglio un contatto che resta un giorno di più che
 * una cancellazione senza prova.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché è minimo, e che cosa non contiene
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Indirizzo, tipo di evento, quando, e quale testo dei consensi era a schermo.
 * **Nessun dato del calcolo**: non il regime, non l'accantonamento, non le
 * scadenze. Un registro delle prove che portasse dentro anche i numeri di una
 * persona sarebbe un secondo archivio degli stessi dati, con una finalità
 * diversa e una durata più lunga — cioè il modo di tenere per anni quello che
 * si era promesso di cancellare in trenta giorni.
 *
 * `RegistroProve` è un'interfaccia perché la pulizia si possa provare contro
 * un registro finto, e perché il giorno in cui si cambia magazzino non cambi
 * niente intorno.
 */

/** Che cosa è successo. Un elenco chiuso: un tipo nuovo si aggiunge qui. */
export type TipoEvento =
  | "richiesta"
  | "conferma"
  | "revoca"
  | "marketing-si"
  | "marketing-no";

export type EventoProva = {
  /** L'indirizzo a cui l'evento si riferisce. È l'unico dato personale che c'è. */
  email: string;
  tipo: TipoEvento;
  /** Data e ora, ISO con il fuso: una prova senza orario vale poco. */
  quando: string;
  /**
   * La versione del testo dei consensi che la persona aveva davanti.
   *
   * Senza, fra due anni si saprebbe che qualcuno ha spuntato una casella e
   * non che cosa diceva. È la differenza fra una prova e un'annotazione.
   */
  versioneTesto: string;
  /** Una riga sul contesto, quando serve. Mai numeri del calcolo. */
  nota?: string;
};

export interface RegistroProve {
  /** Aggiunge un evento. Lancia se non ci riesce: chi chiama deve saperlo. */
  scrivi(evento: EventoProva): Promise<void>;
}

/**
 * La versione del testo dei consensi oggi a schermo.
 *
 * Si cambia **ogni volta che cambia il testo delle caselle** in
 * `src/app/(sito)/simulatore/promemoria.tsx`. Una versione che resta ferma
 * mentre il testo cambia è un registro che dice il falso con precisione.
 */
export const VERSIONE_TESTO_CONSENSI = "2026-10-12";

/**
 * Per quanto si conservano le prove.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  NON È ANCORA UN NUMERO. Lo deve dire il legale.                     │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Il tipo è `number | "DA CONFERMARE DAL LEGALE"` di proposito: finché è la
 * stringa, ogni uso come numero non compila, e `api/pulizia.ts` si rifiuta di
 * partire. Non è una svista da ricordarsi — è una condizione che il programma
 * controlla da sé.
 *
 * Perché la pulizia **non parte** invece di partire saltando il registro: una
 * pulizia che cancella senza scrivere le prove fa esattamente il danno che il
 * registro esiste per evitare, e lo fa in silenzio.
 */
export const CONSERVAZIONE_PROVE_MESI: number | "DA CONFERMARE DAL LEGALE" =
  "DA CONFERMARE DAL LEGALE";

/** Il termine è stato confermato? Se no, la pulizia non deve girare. */
export function conservazioneConfermata(): boolean {
  return typeof CONSERVAZIONE_PROVE_MESI === "number" && CONSERVAZIONE_PROVE_MESI > 0;
}

/**
 * Il nome del file dell'evento dentro il magazzino.
 *
 * Un file per evento, e il nome porta la data davanti: così il registro si
 * sfoglia in ordine cronologico senza aprire niente, e due eventi dello stesso
 * contatto nello stesso istante non si sovrascrivono — `addRandomSuffix` di
 * Vercel Blob aggiunge la coda che li distingue.
 *
 * L'indirizzo **non** entra nel nome del file: i nomi si leggono da un elenco,
 * e un elenco di nomi file sarebbe una rubrica di indirizzi leggibile senza
 * aprire un solo evento. Dentro il file sì, perché lì serve.
 */
export function nomeEvento(evento: EventoProva): string {
  const giorno = evento.quando.slice(0, 10);
  return `prove/${giorno}/${evento.tipo}.json`;
}
