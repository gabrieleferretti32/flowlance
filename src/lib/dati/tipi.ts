/**
 * Entità che non appartengono al motore fiscale: anagrafiche e movimenti
 * che l'utente compila a mano.
 */
import type { ChiusuraAnno } from "@/lib/fisco/chiusura";
import type { StatoPercorso } from "@/lib/onboarding/percorso";
import type { Costo, Fattura, Impostazioni, NotaCredito, VersamentoF24 } from "@/lib/fisco/tipi";

export type Cliente = {
  id: string;
  nome: string;
  /** Sovrascrive il colore derivato dal nome. Di norma resta vuoto. */
  colore?: string;
  canaleAcquisizione: string;
  note: string;
};

/** Un mese di finanze personali. `mese` va da 1 a 12, `anno` lo qualifica. */
export type MovimentoPersonale = {
  id: string;
  anno: number;
  mese: number;
  prelievi: number;
  altreEntrate: number;
  speseFisse: number;
  speseVariabili: number;
  risparmio: number;
};

/**
 * Entrate e uscite dell'attività che non passano dai registri: rimborsi,
 * interessi, commissioni bancarie. Servono al cashflow, che altrimenti
 * non quadra con l'estratto conto.
 */
export type MovimentoAttivita = {
  id: string;
  anno: number;
  mese: number;
  altreEntrate: number;
  altreUscite: number;
};

/**
 * La spunta di un adempimento dello scadenzario. Non è un dato fiscale: è la
 * memoria di ciò che l'utente ha dichiarato di aver fatto.
 */
export type SpuntaAdempimento = {
  /** `${anno}:${idAdempimento}`, così la spunta segue l'anno. */
  id: string;
  anno: number;
  idAdempimento: string;
  completatoIl: string;
};

/**
 * Una modifica fatta da un import, per poterla disfare.
 *
 * Tre forme, perché tre sono i modi in cui un import tocca l'archivio: crea una
 * riga, ne sostituisce una esistente, o somma un importo dentro un totale
 * mensile — le spese personali, che nell'archivio non sono righe ma il mese in
 * cui cadono.
 */
export type ModificaImport =
  | { tipo: "creato"; collezione: NomeCollezione; id: string | number }
  | { tipo: "sostituito"; collezione: NomeCollezione; precedente: unknown }
  | { tipo: "sommato"; collezione: "movimentiPersonali"; id: string; campo: string; delta: number };

/**
 * Un import annullabile.
 *
 * Persistito, perché di un import sbagliato ci si accorge il giorno dopo
 * guardando il cruscotto, non nella schermata d'esito. E **chirurgico**: non
 * un'istantanea dell'archivio ma l'elenco puntuale di ciò che l'import ha
 * fatto. Un'istantanea, ripristinata il giorno dopo, cancellerebbe anche le
 * fatture inserite a mano nel frattempo — un annulla che distrugge lavoro non
 * è un annulla.
 *
 * Ne esiste al massimo uno: l'import successivo prende il posto del precedente.
 */
/**
 * Non è una collezione di `COLLEZIONI`, e quindi non entra nel backup: un
 * annulla che viaggia dentro un file e viene ripristinato su un archivio
 * diverso disferebbe cose che non ha mai fatto. Vive in una tabella sua.
 */
export type Importazione = {
  id: string;
  eseguitaIl: string;
  nomeFile: string;
  /** La destinazione scelta: è quella predefinita, non quella di ogni riga. */
  destinazione: "fattura" | "nota" | "costo";
  conteggi: {
    fatture: number;
    note: number;
    costi: number;
    personali: number;
    clienti: number;
    scartate: number;
  };
  modifiche: ModificaImport[];
};

/**
 * L'archivio com'era un istante prima di essere sostituito.
 *
 * L'import di un backup non è chirurgico come quello da CSV: rimpiazza tutto,
 * e non c'è modo di disfarlo riga per riga. L'unica rete possibile è una copia
 * intera del prima — e deve **sopravvivere alla ricarica**, perché di un import
 * sbagliato ci si accorge quando si riapre l'app e i numeri non tornano, non
 * nei tre secondi in cui un toast è a schermo.
 *
 * Ce n'è una sola: la successiva prende il posto della precedente. Resta finché
 * non la si ripristina o non la si scarta, e come `Importazione` non è una
 * collezione di `COLLEZIONI` — dentro un backup sarebbe l'archivio di qualcun
 * altro travestito da rete di sicurezza.
 */
export type IstantaneaArchivio = {
  id: string;
  creataIl: string;
  /** Che cosa l'ha sostituito, per poterlo raccontare a chi torna il giorno dopo. */
  causa: "import" | "demo" | "svuota";
  /** Il nome del file, quando la causa è un import. */
  dettaglio?: string;
  conteggi: Record<NomeCollezione, number>;
  dati: Dati;
};

export type VocePatrimonio = {
  id: string;
  tipo: "attivo" | "passivo";
  categoria: string;
  descrizione: string;
  valore: number;
};

export type { ChiusuraAnno, Costo, Fattura, Impostazioni, NotaCredito, StatoPercorso, VersamentoF24 };

/** Le collezioni persistite. Il nome è anche la chiave nel file di backup. */
export const COLLEZIONI = [
  "impostazioni",
  "clienti",
  "fatture",
  "note",
  "costi",
  "movimentiPersonali",
  "movimentiAttivita",
  "versamenti",
  "patrimonio",
  "spunte",
  "chiusure",
  "percorsi",
] as const;

export type NomeCollezione = (typeof COLLEZIONI)[number];

export type Dati = {
  impostazioni: Impostazioni[];
  clienti: Cliente[];
  fatture: Fattura[];
  /** Note di credito emesse: stornano ricavi e IVA con le stesse due date. */
  note: NotaCredito[];
  costi: Costo[];
  movimentiPersonali: MovimentoPersonale[];
  movimentiAttivita: MovimentoAttivita[];
  versamenti: VersamentoF24[];
  patrimonio: VocePatrimonio[];
  spunte: SpuntaAdempimento[];
  /** Le chiusure d'anno: decisioni, non importi. Eliminarne una riapre l'anno. */
  chiusure: ChiusuraAnno[];
  /**
   * L'avanzamento nei percorsi di configurazione. Non è stato di interfaccia:
   * distingue un valore scelto da un valore mai toccato, e l'app lo dichiara.
   */
  percorsi: StatoPercorso[];
};

export function datiVuoti(): Dati {
  return {
    impostazioni: [],
    clienti: [],
    fatture: [],
    note: [],
    costi: [],
    movimentiPersonali: [],
    movimentiAttivita: [],
    versamenti: [],
    patrimonio: [],
    spunte: [],
    chiusure: [],
    percorsi: [],
  };
}

/** Identificatore locale: nessun server a cui chiederlo. */
export function nuovoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
