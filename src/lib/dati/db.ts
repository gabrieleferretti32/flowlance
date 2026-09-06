import Dexie, { type EntityTable } from "dexie";
import type {
  ChiusuraAnno,
  Cliente,
  StatoPercorso,
  Costo,
  Fattura,
  Impostazioni,
  MovimentoAttivita,
  MovimentoPersonale,
  VersamentoF24,
  SpuntaAdempimento,
  VocePatrimonio,
  Importazione,
  IstantaneaArchivio,
  NotaCredito,
} from "./tipi";

/**
 * La versione dello schema, che è due cose in una: la versione del database e
 * quella del formato di backup.
 *
 * 7 per due ragioni insieme. I dati sono cambiati — le impostazioni portano
 * regione, comune e la marcatura dei parametri ereditati — e un backup scritto
 * oggi non è leggibile per intero da una versione precedente, che li
 * scarterebbe in silenzio: meglio che si rifiuti dicendo di aggiornare. E c'è
 * una tabella nuova, `istantanee`, che nel backup non entra ma nel database sì.
 */
export const VERSIONE_SCHEMA = 7;

/**
 * Lo schema IndexedDB.
 *
 * Gli indici sono scelti sulle interrogazioni che l'app fa davvero: le date di
 * incasso e pagamento (il principio di cassa), le date dei documenti (la
 * liquidazione IVA) e il cliente (concentrazione del portafoglio).
 * Nessun campo derivato è indicizzato, perché nessun campo derivato è salvato.
 */
export class DatabaseFinanze extends Dexie {
  impostazioni!: EntityTable<Impostazioni, "anno">;
  clienti!: EntityTable<Cliente, "id">;
  fatture!: EntityTable<Fattura, "id">;
  note!: EntityTable<NotaCredito, "id">;
  costi!: EntityTable<Costo, "id">;
  movimentiPersonali!: EntityTable<MovimentoPersonale, "id">;
  movimentiAttivita!: EntityTable<MovimentoAttivita, "id">;
  versamenti!: EntityTable<VersamentoF24, "id">;
  patrimonio!: EntityTable<VocePatrimonio, "id">;
  spunte!: EntityTable<SpuntaAdempimento, "id">;
  chiusure!: EntityTable<ChiusuraAnno, "anno">;
  percorsi!: EntityTable<StatoPercorso, "id">;
  importazioni!: EntityTable<Importazione, "id">;
  istantanee!: EntityTable<IstantaneaArchivio, "id">;

  // Il nome del database resta quello originale anche dopo il rename del
  // progetto in Flowlance: in IndexedDB il nome È la chiave dell'archivio,
  // cambiarlo aprirebbe un database nuovo e vuoto lasciando i dati esistenti
  // orfani. Nessun vantaggio, un modo silenzioso di perdere un anno di fatture.
  constructor(nome = "freelance-finance-os") {
    super(nome);
    // Versione 1: lo schema iniziale.
    this.version(1).stores({
      impostazioni: "anno",
      clienti: "id, nome",
      fatture: "id, dataEmissione, dataIncasso, clienteId, numero",
      costi: "id, dataDocumento, dataPagamento, categoria",
      movimentiPersonali: "id, [anno+mese]",
      movimentiAttivita: "id, [anno+mese]",
      versamenti: "id, data, tipo",
      patrimonio: "id, tipo",
    });
    // Versione 2: le spunte dello scadenzario. Aggiungere una tabella non
    // richiede migrazione: i dati esistenti restano dove sono.
    this.version(2).stores({
      spunte: "id, anno",
    });
    // Versione 3: le chiusure d'anno, una per anno. Anche qui nessuna
    // migrazione: chi non ha mai chiuso un anno trova la tabella vuota, che è
    // esattamente lo stato «tutti gli anni aperti».
    this.version(3).stores({
      chiusure: "anno",
    });
    // Versione 4: l'avanzamento nei percorsi di configurazione. Chi non ne ha
    // mai fatto uno trova la tabella vuota, cioè «nessun passo confermato»:
    // esattamente lo stato di partenza.
    this.version(4).stores({
      percorsi: "id, [contesto+anno]",
    });
    // Versione 5: l'import annullabile. Una riga sola alla volta — l'import
    // successivo prende il posto del precedente — e nessuna migrazione: chi non
    // ha mai importato trova la tabella vuota, cioè «niente da annullare».
    this.version(5).stores({
      importazioni: "id, eseguitaIl",
    });
    // Versione 6: le note di credito. Tabella nuova, nessuna migrazione: chi non
    // ne ha mai emessa una la trova vuota, ed è esattamente lo stato di prima —
    // nessuno storno, nessun effetto su ricavi e IVA.
    this.version(6).stores({
      note: "id, dataDocumento, dataRimborso, clienteId, numero",
    });
    // Versione 7: l'archivio com'era prima dell'ultimo import di backup. Una
    // riga sola, e nessuna migrazione: chi non ha mai importato la trova vuota,
    // cioè «niente da ripristinare», che è lo stato di sempre.
    this.version(7).stores({
      istantanee: "id, creataIl",
    });
  }
}

let istanza: DatabaseFinanze | null = null;

/** Istanza condivisa. Creata alla prima richiesta, mai durante il render sul server. */
export function db(): DatabaseFinanze {
  if (!istanza) istanza = new DatabaseFinanze();
  return istanza;
}
