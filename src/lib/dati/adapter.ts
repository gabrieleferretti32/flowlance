/**
 * L'interfaccia dietro cui vive tutta la persistenza.
 *
 * Oggi c'è una sola implementazione, su IndexedDB via Dexie, e i dati non
 * lasciano il browser. Se un giorno servisse un sync cloud, sarà un'altra
 * implementazione di questa interfaccia e non una riscrittura dell'app.
 * Per i test esiste anche un adapter in memoria: la stessa suite gira su
 * entrambi, così l'interfaccia resta un contratto vero e non una decorazione.
 */
import type { Dati, Importazione, IstantaneaArchivio, NomeCollezione } from "./tipi";

/** Una collezione di entità con chiave `K`. */
export interface Deposito<T, K extends string | number = string> {
  tutti(): Promise<T[]>;
  leggi(chiave: K): Promise<T | undefined>;
  salva(valore: T): Promise<K>;
  salvaMolti(valori: T[]): Promise<void>;
  elimina(chiave: K): Promise<void>;
  eliminaMolti(chiavi: K[]): Promise<void>;
  conta(): Promise<number>;
}

export type ModalitaImport = "sostituisci" | "unisci";

export type EsitoImport = {
  /** Quante entità sono state scritte, per collezione. */
  scritte: Record<NomeCollezione, number>;
  totale: number;
  modalita: ModalitaImport;
};

export interface StorageAdapter {
  readonly nome: string;

  /** Le impostazioni sono indicizzate per anno: i parametri cambiano ogni gennaio. */
  readonly impostazioni: Deposito<Dati["impostazioni"][number], number>;
  readonly clienti: Deposito<Dati["clienti"][number]>;
  readonly fatture: Deposito<Dati["fatture"][number]>;
  /** Note di credito emesse: stornano ricavi e IVA. */
  readonly note: Deposito<Dati["note"][number]>;
  readonly costi: Deposito<Dati["costi"][number]>;
  readonly movimentiPersonali: Deposito<Dati["movimentiPersonali"][number]>;
  readonly movimentiAttivita: Deposito<Dati["movimentiAttivita"][number]>;
  readonly versamenti: Deposito<Dati["versamenti"][number]>;
  readonly patrimonio: Deposito<Dati["patrimonio"][number]>;
  readonly spunte: Deposito<Dati["spunte"][number]>;
  /** Le chiusure sono indicizzate per anno, come le impostazioni. */
  readonly chiusure: Deposito<Dati["chiusure"][number], number>;
  readonly percorsi: Deposito<Dati["percorsi"][number]>;
  /**
   * Gli import annullabili. Fuori da `COLLEZIONI` di proposito: non entrano nel
   * backup, perché un annulla ripristinato su un altro archivio disferebbe
   * modifiche che lì non sono mai state fatte.
   */
  readonly importazioni: Deposito<Importazione>;
  /**
   * L'archivio com'era prima dell'ultimo import di backup. Fuori da
   * `COLLEZIONI` per la stessa ragione: una rete di sicurezza che viaggia
   * dentro un file e atterra su un altro archivio non è una rete.
   */
  readonly istantanee: Deposito<IstantaneaArchivio>;

  // ——— Finanze personali ———
  readonly pfConti: Deposito<Dati["pfConti"][number]>;
  readonly pfMovimenti: Deposito<Dati["pfMovimenti"][number]>;
  readonly pfCategorie: Deposito<Dati["pfCategorie"][number]>;
  /**
   * Il budget non ha un id: la sua chiave è la coppia categoria-anno.
   *
   * Nell'interfaccia è **una stringa**, `categoria|anno`, e non l'array che
   * Dexie usa nell'indice composto: due adapter con due forme di chiave per la
   * stessa riga sarebbero due identità, e chi scrive contro l'interfaccia non
   * saprebbe quale delle due gli tocca. La traduzione la fa l'adapter di
   * Dexie, che è l'unico a cui serve l'array.
   */
  readonly pfBudget: Deposito<Dati["pfBudget"][number]>;
  readonly pfBeni: Deposito<Dati["pfBeni"][number]>;
  readonly pfRegole: Deposito<Dati["pfRegole"][number]>;
  readonly pfImport: Deposito<Dati["pfImport"][number]>;

  /** Legge tutto, in una sola transazione dove la tecnologia lo consente. */
  leggiTutto(): Promise<Dati>;
  /** Scrive tutto. `sostituisci` svuota prima, `unisci` fa upsert per chiave. */
  scriviTutto(dati: Dati, modalita: ModalitaImport): Promise<EsitoImport>;
  /**
   * Rimette in archivio dati che erano già suoi.
   *
   * Fa esattamente quello che fa `scriviTutto` in modalità «sostituisci», e
   * esiste solo per essere **distinguibile dalla sola lettura**. Ripristinare
   * l'istantanea presa prima di un import non è inserire dati nuovi: è
   * rimettere i propri dove stavano, e a licenza scaduta deve restare
   * possibile — altrimenti chi sbaglia un import e poi scade si esporta
   * l'archivio sbagliato, con quello giusto a un pulsante spento di distanza.
   *
   * Non è un varco di sicurezza, e la guardia non è una barriera: un controllo
   * lato client si aggira comunque, e sta lì per le dimenticanze
   * dell'interfaccia, non contro chi apre la console.
   */
  ripristina(dati: Dati): Promise<EsitoImport>;
  svuota(): Promise<void>;
  /** L'archivio non contiene nulla: serve a decidere se proporre l'onboarding. */
  vuoto(): Promise<boolean>;
}

/**
 * I depositi nell'ordine delle collezioni, per iterarci sopra.
 *
 * **Senza il cast, e non è un dettaglio di stile.** Qui c'era un
 * `as Record<NomeCollezione, …>` che zittiva il controllo: le sette collezioni
 * delle finanze personali erano entrate in `COLLEZIONI`, nei tipi, nel backup e
 * in `leggiTutto`, ma non in questa mappa — e `conSolaLettura`, che ricostruisce
 * l'adapter da qui, restituiva un archivio **senza quei depositi**. La prima
 * schermata che ha provato a scrivere un conto ha trovato `undefined.salva`.
 *
 * L'oggetto letterale senza cast fa fallire la compilazione quando manca una
 * chiave: il difetto si vede a `tsc`, non in una console del browser.
 */
export function depositiDi(
  adapter: StorageAdapter,
): Record<NomeCollezione, Deposito<never, never>> {
  const mappa: Record<NomeCollezione, unknown> = {
    impostazioni: adapter.impostazioni,
    clienti: adapter.clienti,
    fatture: adapter.fatture,
    note: adapter.note,
    costi: adapter.costi,
    movimentiPersonali: adapter.movimentiPersonali,
    movimentiAttivita: adapter.movimentiAttivita,
    versamenti: adapter.versamenti,
    patrimonio: adapter.patrimonio,
    spunte: adapter.spunte,
    chiusure: adapter.chiusure,
    percorsi: adapter.percorsi,
    pfConti: adapter.pfConti,
    pfMovimenti: adapter.pfMovimenti,
    pfCategorie: adapter.pfCategorie,
    pfBudget: adapter.pfBudget,
    pfBeni: adapter.pfBeni,
    pfRegole: adapter.pfRegole,
    pfImport: adapter.pfImport,
  };
  return mappa as Record<NomeCollezione, Deposito<never, never>>;
}
