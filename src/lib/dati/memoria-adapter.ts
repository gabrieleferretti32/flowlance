import type { Deposito, EsitoImport, ModalitaImport, StorageAdapter } from "./adapter";
import { COLLEZIONI, datiVuoti, type Dati, type Importazione, type IstantaneaArchivio, type NomeCollezione } from "./tipi";

/**
 * Adapter in memoria. Esiste perché la suite di test possa girare sull'interfaccia
 * senza IndexedDB, e perché avere due implementazioni tiene onesto il contratto:
 * se `StorageAdapter` non bastasse a scrivere questo, non basterebbe nemmeno a
 * scrivere un eventuale adapter cloud.
 */
class DepositoMemoria<T, K extends string | number> implements Deposito<T, K> {
  private mappa = new Map<K, T>();

  constructor(private readonly chiave: (valore: T) => K) {}

  async tutti() {
    return [...this.mappa.values()].map((v) => structuredClone(v));
  }
  async leggi(chiave: K) {
    const v = this.mappa.get(chiave);
    return v === undefined ? undefined : structuredClone(v);
  }
  async salva(valore: T) {
    const k = this.chiave(valore);
    this.mappa.set(k, structuredClone(valore));
    return k;
  }
  async salvaMolti(valori: T[]) {
    for (const v of valori) await this.salva(v);
  }
  async elimina(chiave: K) {
    this.mappa.delete(chiave);
  }
  async eliminaMolti(chiavi: K[]) {
    for (const k of chiavi) this.mappa.delete(k);
  }
  async conta() {
    return this.mappa.size;
  }
  svuotaSincrono() {
    this.mappa.clear();
  }
}

export class MemoriaAdapter implements StorageAdapter {
  readonly nome = "memoria";

  readonly impostazioni = new DepositoMemoria<Dati["impostazioni"][number], number>((v) => v.anno);
  readonly clienti = new DepositoMemoria<Dati["clienti"][number], string>((v) => v.id);
  readonly fatture = new DepositoMemoria<Dati["fatture"][number], string>((v) => v.id);
  readonly costi = new DepositoMemoria<Dati["costi"][number], string>((v) => v.id);
  readonly movimentiPersonali = new DepositoMemoria<Dati["movimentiPersonali"][number], string>(
    (v) => v.id,
  );
  readonly movimentiAttivita = new DepositoMemoria<Dati["movimentiAttivita"][number], string>(
    (v) => v.id,
  );
  readonly versamenti = new DepositoMemoria<Dati["versamenti"][number], string>((v) => v.id);
  readonly patrimonio = new DepositoMemoria<Dati["patrimonio"][number], string>((v) => v.id);
  readonly spunte = new DepositoMemoria<Dati["spunte"][number], string>((v) => v.id);
  readonly chiusure = new DepositoMemoria<Dati["chiusure"][number], number>((v) => v.anno);
  readonly note = new DepositoMemoria<Dati["note"][number], string>((v) => v.id);
  readonly percorsi = new DepositoMemoria<Dati["percorsi"][number], string>((v) => v.id);
  readonly importazioni = new DepositoMemoria<Importazione, string>((v) => v.id);
  readonly istantanee = new DepositoMemoria<IstantaneaArchivio, string>((v) => v.id);

  private deposito(collezione: NomeCollezione) {
    return this[collezione] as DepositoMemoria<unknown, string | number>;
  }

  async leggiTutto(): Promise<Dati> {
    const dati = datiVuoti();
    for (const collezione of COLLEZIONI) {
      (dati[collezione] as unknown[]) = await this.deposito(collezione).tutti();
    }
    return dati;
  }

  async scriviTutto(dati: Dati, modalita: ModalitaImport): Promise<EsitoImport> {
    const scritte = {} as Record<NomeCollezione, number>;
    for (const collezione of COLLEZIONI) {
      const deposito = this.deposito(collezione);
      if (modalita === "sostituisci") deposito.svuotaSincrono();
      const righe = dati[collezione] as unknown[];
      await deposito.salvaMolti(righe);
      scritte[collezione] = righe.length;
    }
    return { scritte, totale: Object.values(scritte).reduce((a, b) => a + b, 0), modalita };
  }

  /** Vedi `StorageAdapter.ripristina`: è `scriviTutto`, con un altro nome. */
  async ripristina(dati: Dati): Promise<EsitoImport> {
    return this.scriviTutto(dati, "sostituisci");
  }

  async svuota(): Promise<void> {
    for (const collezione of COLLEZIONI) this.deposito(collezione).svuotaSincrono();
  }

  async vuoto(): Promise<boolean> {
    for (const collezione of COLLEZIONI) {
      if ((await this.deposito(collezione).conta()) > 0) return false;
    }
    return true;
  }
}
