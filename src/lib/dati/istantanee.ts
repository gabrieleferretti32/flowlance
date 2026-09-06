/**
 * La rete sotto l'import di un backup.
 *
 * L'import da CSV si disfa riga per riga, perché aggiunge righe. Quello di un
 * backup no: sostituisce tutto, e l'unica cosa che si può disfare è tutto. Da
 * qui la forma — una copia intera dell'archivio, presa un istante prima — e
 * soprattutto il posto dove sta: **una tabella del database, non la memoria**.
 *
 * Prima questa rete durava tre secondi e mezzo, quanto un toast, e viveva in
 * una variabile: chi ricaricava la pagina, chiudeva la scheda o semplicemente
 * guardava altrove non aveva più niente. Ma di un import sbagliato ci si
 * accorge riaprendo l'app, non nei tre secondi in cui il messaggio è a schermo.
 *
 * Ce n'è una sola: la successiva prende il posto della precedente. Si scarta a
 * mano, quando si è sicuri — non da sola, non a tempo.
 *
 * Vale per i tre gesti che sostituiscono l'archivio intero: importare un
 * backup, ricaricare il dataset dimostrativo, svuotare. Sull'ultimo la copia
 * che resta è una contraddizione dichiarata — chi svuota per far sparire i
 * dati deve poterla togliere, e la schermata glielo dice in chiaro invece di
 * tenersela.
 */
import { archivio } from "./archivio";
import { COLLEZIONI, type Dati, type IstantaneaArchivio, type NomeCollezione } from "./tipi";

/**
 * Una sola riga, con una chiave fissa.
 *
 * Un id generato darebbe una collezione di istantanee da gestire, sfogliare e
 * spiegare. Qui serve una domanda sola — «vuoi tornare a com'era?» — e una
 * domanda sola vuole una risposta sola.
 */
const CHIAVE = "prima-import";

function conteggi(dati: Dati): Record<NomeCollezione, number> {
  const out = {} as Record<NomeCollezione, number>;
  for (const c of COLLEZIONI) out[c] = dati[c].length;
  return out;
}

/** Copia l'archivio com'è adesso, prima di sostituirlo. */
export async function salvaIstantanea(
  dati: Dati,
  causa: IstantaneaArchivio["causa"],
  dettaglio?: string,
  adesso = new Date(),
): Promise<IstantaneaArchivio> {
  const istantanea: IstantaneaArchivio = {
    id: CHIAVE,
    creataIl: adesso.toISOString(),
    causa,
    ...(dettaglio ? { dettaglio } : {}),
    conteggi: conteggi(dati),
    dati,
  };
  await archivio().istantanee.salva(istantanea);
  return istantanea;
}

/** L'istantanea disponibile, se c'è. */
export async function istantaneaDisponibile(): Promise<IstantaneaArchivio | undefined> {
  return archivio().istantanee.leggi(CHIAVE);
}

/**
 * Torna a com'era, e toglie la rete.
 *
 * Non ne salva una nuova prima di ripristinare: sarebbe la copia dell'archivio
 * importato, cioè del file che l'utente ha ancora su disco. Ripristinare due
 * volte di seguito non deve poter riportare indietro l'errore.
 */
export async function ripristinaIstantanea(): Promise<boolean> {
  const istantanea = await istantaneaDisponibile();
  if (!istantanea) return false;
  // `ripristina`, non `scriviTutto`: la differenza è che questa passa anche a
  // licenza scaduta, perché rimette dati che erano già dell'utente.
  await archivio().ripristina(istantanea.dati);
  await archivio().istantanee.elimina(CHIAVE);
  return true;
}

/** «Va bene così»: la rete si toglie solo quando lo dice l'utente. */
export async function scartaIstantanea(): Promise<void> {
  await archivio().istantanee.elimina(CHIAVE);
}

/** Quanti documenti conteneva l'archivio salvato: per dirlo in una frase. */
export function documentiDi(istantanea: IstantaneaArchivio): number {
  return COLLEZIONI.reduce((t, c) => t + (istantanea.conteggi[c] ?? 0), 0);
}
