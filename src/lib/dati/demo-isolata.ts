/**
 * La demo, in un database suo.
 *
 * «Apri la demo» dalla pagina di vendita porta dentro l'applicazione vera con
 * la vetrina già caricata, senza passare da Dati e backup. Il caso da non
 * sbagliare è uno solo, ed è quello che governa ogni scelta qui dentro: **chi
 * l'app la sta già usando per davvero non deve perdere niente.** Un visitatore
 * curioso e un cliente con dentro un anno di fatture possono essere la stessa
 * persona, sullo stesso browser, nella stessa ora.
 *
 * L'isolamento non è un accorgimento nel codice: è **un database diverso**.
 * `flowlance-demo` e `freelance-finance-os` sono due archivi IndexedDB
 * distinti, e nessuna scrittura sbagliata può arrivare dall'uno all'altro
 * perché non condividono nulla — nemmeno le tabelle. Un flag «sono in demo»
 * consultato prima di ogni scrittura sarebbe stato un flag da ricordarsi di
 * consultare; questo non si può dimenticare.
 *
 * La demo resta accesa per **scheda**, non per browser: `sessionStorage`. È la
 * proprietà che serve — chi apre la demo da una scheda e ha l'app vera in
 * un'altra le usa insieme senza che l'una diventi l'altra — e nessun'altra
 * memoria ce l'ha: `localStorage` è del browser, un cookie è del dominio, e
 * l'indirizzo `?demo=vetrina` si perde alla prima navigazione interna.
 *
 * All'uscita il database **resta**. Chi torna ritrova quello che stava
 * guardando, ed è quello che ci si aspetta da una vetrina; cancellarlo
 * significherebbe anche cancellare, a ogni visita, il lavoro di chi nella demo
 * ha provato a inserire una sua fattura per vedere come si comporta.
 */
import { DatabaseFinanze } from "./db";
import { DexieAdapter } from "./dexie-adapter";
import { impostaArchivio } from "./archivio";
import { archivio } from "./archivio";
import { datasetDi, DATASET, type IdDataset } from "./dataset";

/** Il database della demo. Diverso da quello vero, che si chiama ancora `freelance-finance-os`. */
export const NOME_DB_DEMO = "flowlance-demo";

/** Dove sta scritto che questa scheda è in demo. */
const CHIAVE = "flowlance:demo";

/** Il parametro che apre la demo: `/app/?demo=vetrina`. */
export const PARAMETRO = "demo";

function eUnDataset(v: string | null): v is IdDataset {
  return v !== null && DATASET.some((d) => d.id === v);
}

/** Il dataset chiesto nell'indirizzo, se ce n'è uno valido. */
export function demoNellIndirizzo(ricerca: string): IdDataset | null {
  const valore = new URLSearchParams(ricerca).get(PARAMETRO);
  return eUnDataset(valore) ? valore : null;
}

/** Questa scheda è in demo, e su quale dataset. */
export function demoAttiva(): IdDataset | null {
  try {
    const valore = sessionStorage.getItem(CHIAVE);
    return eUnDataset(valore) ? valore : null;
  } catch {
    // Navigazione privata con la memoria bloccata: nessuna demo, l'app vera.
    return null;
  }
}

function accendi(id: IdDataset): void {
  try {
    sessionStorage.setItem(CHIAVE, id);
  } catch {
    // Senza memoria la demo dura una schermata sola. Meglio che non partire.
  }
}

function spegni(): void {
  try {
    sessionStorage.removeItem(CHIAVE);
  } catch {
    // niente da spegnere
  }
}

export type StatoArchivio = { demo: IdDataset | null; appenaCaricata: boolean };

/**
 * Decide **quale archivio** userà questa scheda, e lo fa prima di tutto il resto.
 *
 * Va chiamata una volta sola, prima che qualunque schermata legga: `archivio()`
 * è un singolo condiviso, e una schermata che legge prima della decisione legge
 * dall'archivio vero. Per questo il guscio dell'app non monta finché questa non
 * ha risposto.
 *
 * Il dataset si scrive **solo se il database della demo è vuoto**. Chi entra,
 * modifica qualcosa e torna il giorno dopo ritrova il suo giro, non una vetrina
 * rimessa a nuovo: ricaricarla a ogni ingresso sarebbe cancellare il lavoro di
 * chi ha provato l'app, cioè esattamente quello che la demo serve a far fare.
 */
export async function preparaArchivio(ricerca: string): Promise<StatoArchivio> {
  const chiesta = demoNellIndirizzo(ricerca);
  if (chiesta) accendi(chiesta);

  const demo = demoAttiva();
  if (!demo) return { demo: null, appenaCaricata: false };

  impostaArchivio(new DexieAdapter(new DatabaseFinanze(NOME_DB_DEMO)));

  const dataset = datasetDi(demo);
  const vuoto = (await archivio().impostazioni.conta()) === 0;
  if (vuoto) {
    await archivio().scriviTutto(dataset.dati(await archivio().leggiTutto()), "sostituisci");
  }
  return { demo, appenaCaricata: vuoto };
}

/**
 * Esce dalla demo e torna alla pagina di vendita.
 *
 * Il database della demo **non si cancella**: resta dov'è, e chi rientra
 * ritrova quello che stava guardando.
 *
 * Il ritorno è un caricamento vero della pagina, non una navigazione interna:
 * `archivio()` è un singolo già costruito sul database della demo, e senza
 * ricaricare l'applicazione continuerebbe a leggere da lì con la demo spenta —
 * uno stato che non è né la demo né l'app vera.
 */
export function esciDallaDemo(destinazione: string): void {
  spegni();
  window.location.assign(destinazione);
}
