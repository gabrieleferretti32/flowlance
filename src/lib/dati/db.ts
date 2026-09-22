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
import type {
  BenePf,
  BudgetPf,
  CategoriaPf,
  ContoPersonale,
  ImportPf,
  ImpostazioniPf,
  MovimentoPf,
  ObiettivoPf,
  RegolaPf,
} from "@/lib/finanze/tipi";

/**
 * La versione dello schema, che è due cose in una: la versione del database e
 * quella del formato di backup.
 *
 * 8 con l'arrivo delle finanze personali: sette tabelle nuove, che nel backup
 * entrano. Un backup scritto oggi porta chiavi che una versione precedente non
 * conosce, e va rifiutato dicendo di aggiornare invece di essere letto a metà.
 *
 * Nel verso opposto no: un backup **vecchio** non porta quelle chiavi, e deve
 * entrare senza un errore — chi ha esportato a settembre non ha fatto niente di
 * sbagliato. Lo tiene `convalidaElenco`, che su una chiave assente restituisce
 * un elenco vuoto, e un test in `backup.test.ts` che importa un file senza il
 * modulo.
 */
export const VERSIONE_SCHEMA = 11;

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

  // ——— Finanze personali ———
  pfConti!: EntityTable<ContoPersonale, "id">;
  pfMovimenti!: EntityTable<MovimentoPf, "id">;
  pfCategorie!: EntityTable<CategoriaPf, "id">;
  pfBudget!: EntityTable<BudgetPf, "categoriaId">;
  pfBeni!: EntityTable<BenePf, "id">;
  pfRegole!: EntityTable<RegolaPf, "id">;
  pfImport!: EntityTable<ImportPf, "id">;
  pfImpostazioni!: EntityTable<ImpostazioniPf, "id">;
  pfObiettivi!: EntityTable<ObiettivoPf, "id">;

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
    /*
      Versione 8: le finanze personali. Sette tabelle nuove e nessuna
      migrazione — chi apre l'app dopo l'aggiornamento le trova vuote, che è
      esattamente lo stato «non ho ancora configurato il modulo».

      Gli indici sono quelli che le schermate interrogheranno davvero: la data
      e il conto sui movimenti (il registro si filtra per mese e per conto),
      l'import per poterlo annullare in blocco, la coppia categoria-anno sul
      budget, che è la sua chiave naturale.
    */
    this.version(8).stores({
      pfConti: "id, nome",
      pfMovimenti: "id, data, contoId, categoriaId, importId",
      pfCategorie: "id, tipo",
      pfBudget: "[categoriaId+anno], anno",
      pfBeni: "id, classe",
      pfRegole: "id",
      pfImport: "id, data",
    });
    /*
      Versione 9: le impostazioni del modulo, una riga sola. Nessuna
      migrazione: chi apre l'app dopo l'aggiornamento non ne ha nessuna, e
      «nessuna» vuol dire i valori predefiniti — cuscinetto a zero e riporto
      acceso, che è il comportamento di prima.
    */
    this.version(9).stores({
      pfImpostazioni: "id",
    });
    /*
      Versione 10: il flag «arriva dall'attività» sulle categorie.

      Nessuna tabella nuova — un campo in più su righe che ci sono già — ma
      **una migrazione sì**, e riguarda una riga sola: «Fatture incassate»
      nasce con il flag acceso, e chi ha seminato le categorie prima di oggi
      deve trovarcelo lo stesso. Senza, il flag sarebbe acceso solo per chi
      installa l'app da domani, e la stessa app direbbe due cose diverse a due
      persone a seconda di quando hanno cominciato.

      Le categorie inventate da chi usa l'app non si toccano: non c'è modo di
      sapere se una «Bonifici dallo studio» porta denaro dell'attività, e
      indovinarlo marcherebbe come prelievi delle entrate che nessuno ha
      dichiarato tali.
    */
    this.version(10).upgrade(async (tx) => {
      await tx
        .table("pfCategorie")
        .toCollection()
        .modify((c: { id?: string; arrivaDallAttivita?: boolean }) => {
          c.arrivaDallAttivita = c.id === "fatture";
        });
    });
    /*
      Versione 11: le mete di risparmio. Tabella nuova e nessuna migrazione:
      chi apre l'app dopo l'aggiornamento non ne ha nessuna, e «nessuna meta»
      è esattamente lo stato di prima. Le righe che ci sono non si toccano.
    */
    this.version(11).stores({
      pfObiettivi: "id",
    });
  }
}

let istanza: DatabaseFinanze | null = null;

/** Istanza condivisa. Creata alla prima richiesta, mai durante il render sul server. */
export function db(): DatabaseFinanze {
  if (!istanza) istanza = new DatabaseFinanze();
  return istanza;
}
