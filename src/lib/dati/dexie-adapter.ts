import type { Table } from "dexie";
import { db as dbCondiviso, type DatabaseFinanze } from "./db";
import type { Deposito, EsitoImport, ModalitaImport, StorageAdapter } from "./adapter";
import { COLLEZIONI, datiVuoti, type Dati, type Importazione, type IstantaneaArchivio, type NomeCollezione } from "./tipi";

/**
 * Implementazione su IndexedDB.
 *
 * I metodi delegano direttamente a Dexie, così `useLiveQuery` continua a
 * osservare le tabelle anche quando la lettura passa dall'adapter: la React
 * layer resta reattiva senza conoscere il database.
 */
function deposito<T, K extends string | number>(tabella: Table<T, K>): Deposito<T, K> {
  return {
    tutti: () => tabella.toArray(),
    leggi: (chiave) => tabella.get(chiave),
    salva: (valore) => tabella.put(valore),
    salvaMolti: async (valori) => {
      await tabella.bulkPut(valori);
    },
    elimina: async (chiave) => {
      await tabella.delete(chiave);
    },
    eliminaMolti: async (chiavi) => {
      await tabella.bulkDelete(chiavi);
    },
    conta: () => tabella.count(),
  };
}

export class DexieAdapter implements StorageAdapter {
  readonly nome = "indexeddb";
  private readonly database: DatabaseFinanze;

  readonly impostazioni: StorageAdapter["impostazioni"];
  readonly clienti: StorageAdapter["clienti"];
  readonly fatture: StorageAdapter["fatture"];
  readonly costi: StorageAdapter["costi"];
  readonly movimentiPersonali: StorageAdapter["movimentiPersonali"];
  readonly movimentiAttivita: StorageAdapter["movimentiAttivita"];
  readonly versamenti: StorageAdapter["versamenti"];
  readonly patrimonio: StorageAdapter["patrimonio"];
  readonly spunte: StorageAdapter["spunte"];
  readonly chiusure: StorageAdapter["chiusure"];
  readonly note: StorageAdapter["note"];
  readonly percorsi: StorageAdapter["percorsi"];
  readonly importazioni: StorageAdapter["importazioni"];
  readonly istantanee: StorageAdapter["istantanee"];

  constructor(database: DatabaseFinanze = dbCondiviso()) {
    this.database = database;
    this.impostazioni = deposito(database.impostazioni as unknown as Table<Dati["impostazioni"][number], number>);
    this.clienti = deposito(database.clienti as unknown as Table<Dati["clienti"][number], string>);
    this.fatture = deposito(database.fatture as unknown as Table<Dati["fatture"][number], string>);
    this.costi = deposito(database.costi as unknown as Table<Dati["costi"][number], string>);
    this.movimentiPersonali = deposito(
      database.movimentiPersonali as unknown as Table<Dati["movimentiPersonali"][number], string>,
    );
    this.movimentiAttivita = deposito(
      database.movimentiAttivita as unknown as Table<Dati["movimentiAttivita"][number], string>,
    );
    this.versamenti = deposito(database.versamenti as unknown as Table<Dati["versamenti"][number], string>);
    this.patrimonio = deposito(database.patrimonio as unknown as Table<Dati["patrimonio"][number], string>);
    this.spunte = deposito(database.spunte as unknown as Table<Dati["spunte"][number], string>);
    this.chiusure = deposito(
      database.chiusure as unknown as Table<Dati["chiusure"][number], number>,
    );
    this.percorsi = deposito(
      database.percorsi as unknown as Table<Dati["percorsi"][number], string>,
    );
    this.note = deposito(database.note as unknown as Table<Dati["note"][number], string>);
    this.importazioni = deposito(
      database.importazioni as unknown as Table<Importazione, string>,
    );
    this.istantanee = deposito(
      database.istantanee as unknown as Table<IstantaneaArchivio, string>,
    );
  }

  private tabelle(): Table[] {
    return COLLEZIONI.map((c) => this.database[c] as unknown as Table);
  }

  async leggiTutto(): Promise<Dati> {
    return this.database.transaction("r", this.tabelle(), async () => {
      const dati = datiVuoti();
      for (const collezione of COLLEZIONI) {
        const righe = await (this.database[collezione] as unknown as Table).toArray();
        (dati[collezione] as unknown[]) = righe;
      }
      return dati;
    });
  }

  async scriviTutto(dati: Dati, modalita: ModalitaImport): Promise<EsitoImport> {
    return this.database.transaction("rw", this.tabelle(), async () => {
      const scritte = {} as Record<NomeCollezione, number>;
      for (const collezione of COLLEZIONI) {
        const tabella = this.database[collezione] as unknown as Table;
        if (modalita === "sostituisci") await tabella.clear();
        const righe = dati[collezione] as unknown[];
        if (righe.length > 0) await tabella.bulkPut(righe);
        scritte[collezione] = righe.length;
      }
      return {
        scritte,
        totale: Object.values(scritte).reduce((a, b) => a + b, 0),
        modalita,
      };
    });
  }

  /** Vedi `StorageAdapter.ripristina`: è `scriviTutto`, con un altro nome. */
  async ripristina(dati: Dati): Promise<EsitoImport> {
    return this.scriviTutto(dati, "sostituisci");
  }

  async svuota(): Promise<void> {
    await this.database.transaction("rw", this.tabelle(), async () => {
      for (const tabella of this.tabelle()) await tabella.clear();
    });
  }

  async vuoto(): Promise<boolean> {
    for (const collezione of COLLEZIONI) {
      const n = await (this.database[collezione] as unknown as Table).count();
      if (n > 0) return false;
    }
    return true;
  }
}
