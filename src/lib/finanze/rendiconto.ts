/**
 * Leggere il rendiconto di una banca, senza sapere che banca è.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché nessun profilo per banca
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un profilo per Intesa, uno per Fineco, uno per Revolut: funzionano finché la
 * banca non cambia l'intestazione di una colonna, e quel giorno l'import
 * fallisce per tutti quelli che usano quella banca, in silenzio o con un
 * errore che non dice cosa fare. E chi ha una banca fuori dall'elenco non può
 * proprio cominciare.
 *
 * Qui invece la mappatura la fa la persona, una volta per conto, e si salva
 * accanto al conto: `ContoPersonale.mappaturaImport`. Il mese dopo il file
 * dello stesso conto entra senza chiedere niente, e il giorno in cui la banca
 * cambia tracciato basta rifare la mappatura — una schermata, non una nuova
 * versione dell'app.
 *
 * `proponiMappatura` legge le intestazioni e **propone**: è un modo di
 * riempire i campi prima che qualcuno li guardi, non un profilo. Quello che
 * viene scritto in archivio è sempre la scelta confermata dalla persona.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Due forme, perché le banche ne usano due
 * ─────────────────────────────────────────────────────────────────────────
 *
 * O una colonna sola con il segno — «−120,50» — o due colonne separate, dare e
 * avere, entrambe positive. Trattare la seconda come la prima farebbe entrare
 * gli addebiti come entrate: il doppio errore più costoso che un import possa
 * fare, perché raddoppia il saldo invece di sbagliarlo di poco.
 */
import { analizzaData, analizzaNumero } from "@/lib/format";
import { campoDi, type Tabella } from "@/lib/csv/parser";
import { round2 } from "@/lib/fisco/aritmetica";

export type FormaImporto =
  | { tipo: "unica"; importo: number }
  | { tipo: "separate"; entrate: number; uscite: number };

export type MappaturaColonne = {
  data: number;
  descrizione: number;
  forma: FormaImporto;
  /**
   * Il file ha le uscite positive in una colonna sola.
   *
   * Succede: un estratto conto con la colonna «Importo» dove tutto è positivo
   * e il verso sta altrove. Chi mappa se ne accorge dall'anteprima — le spese
   * comparirebbero come entrate — e con questo le rovescia tutte.
   */
  invertiSegno?: boolean;
};

/** Una riga del file, ridotta a quello che serve. L'importo porta il segno. */
export type RigaRendiconto = {
  /** L'indice nel file, per poter dire «riga 14» a chi guarda uno scarto. */
  indice: number;
  data: string;
  descrizione: string;
  importo: number;
};

export type ScartoRendiconto = {
  indice: number;
  motivo: "data" | "importo";
  /** Il testo che non si è saputo leggere, per mostrarlo com'era. */
  grezzo: string;
};

export type LetturaRendiconto = {
  righe: RigaRendiconto[];
  scartate: ScartoRendiconto[];
};

const PAROLE_DATA = ["data", "date", "valuta", "contabile", "giorno"];
const PAROLE_DESCRIZIONE = ["descrizione", "causale", "operazione", "dettagl", "movimento", "note"];
const PAROLE_IMPORTO = ["importo", "amount", "saldo riga", "valore"];
const PAROLE_ENTRATE = ["entrat", "accredit", "avere", "in", "credit"];
const PAROLE_USCITE = ["uscit", "addebit", "dare", "out", "debit"];

const contiene = (testo: string, parole: string[]) => {
  const t = testo.trim().toLocaleLowerCase("it-IT");
  return parole.some((p) => t.includes(p));
};

/**
 * Una proposta di mappatura letta dalle intestazioni.
 *
 * `null` quando non si riconosce abbastanza da proporre qualcosa: meglio un
 * modulo vuoto che tre tendine riempite a caso, che si confermano senza
 * guardare perché «l'app le aveva già messe».
 */
export function proponiMappatura(intestazioni: string[]): MappaturaColonne | null {
  const indice = (parole: string[], escludi: number[] = []) =>
    intestazioni.findIndex((h, i) => !escludi.includes(i) && contiene(h, parole));

  const data = indice(PAROLE_DATA);
  const descrizione = indice(PAROLE_DESCRIZIONE);
  if (data < 0 || descrizione < 0) return null;

  const entrate = indice(PAROLE_ENTRATE, [data, descrizione]);
  const uscite = indice(PAROLE_USCITE, [data, descrizione, entrate]);
  if (entrate >= 0 && uscite >= 0) {
    return { data, descrizione, forma: { tipo: "separate", entrate, uscite } };
  }

  const importo = indice(PAROLE_IMPORTO, [data, descrizione]);
  if (importo < 0) return null;
  return { data, descrizione, forma: { tipo: "unica", importo } };
}

/**
 * Un importo come lo scrivono i rendiconti, con i due travestimenti del meno.
 *
 * `(120,50)` è la contabilità anglosassone, `120,50-` è il segno in coda di
 * certi gestionali. Senza questi due casi la riga verrebbe scartata — e uno
 * scarto silenzioso su un addebito è denaro che sparisce dal registro.
 */
export function importoDiCella(grezzo: string): number | null {
  const testo = grezzo.trim();
  if (testo === "") return null;
  const parentesi = /^\((.+)\)$/.exec(testo);
  const inCoda = /^(.+)-$/.exec(testo);
  const negativo = parentesi !== null || inCoda !== null;
  const numero = analizzaNumero(parentesi?.[1] ?? inCoda?.[1] ?? testo);
  if (numero === null) return null;
  return negativo ? -Math.abs(numero) : numero;
}

export function applicaMappatura(
  tabella: Tabella,
  mappatura: MappaturaColonne,
): LetturaRendiconto {
  const righe: RigaRendiconto[] = [];
  const scartate: ScartoRendiconto[] = [];

  tabella.righe.forEach((riga, i) => {
    const indice = i + 1;
    const grezzaData = campoDi(riga, mappatura.data);
    const data = analizzaData(grezzaData);
    if (data === null) {
      scartate.push({ indice, motivo: "data", grezzo: grezzaData });
      return;
    }

    let importo: number | null;
    let grezzoImporto: string;
    if (mappatura.forma.tipo === "unica") {
      grezzoImporto = campoDi(riga, mappatura.forma.importo);
      importo = importoDiCella(grezzoImporto);
    } else {
      /*
        Due colonne, e in una delle due c'è sempre niente. Quella piena decide
        il verso: entrata positiva, uscita negativa — **qualunque segno abbia
        scritto la banca**, perché la colonna è già il verso e un meno nella
        colonna delle uscite vorrebbe dire «meno un'uscita», cioè un'entrata.
      */
      const entrata = importoDiCella(campoDi(riga, mappatura.forma.entrate));
      const uscita = importoDiCella(campoDi(riga, mappatura.forma.uscite));
      grezzoImporto = `${campoDi(riga, mappatura.forma.entrate)} / ${campoDi(riga, mappatura.forma.uscite)}`;
      importo =
        entrata !== null && entrata !== 0
          ? Math.abs(entrata)
          : uscita !== null && uscita !== 0
            ? -Math.abs(uscita)
            : null;
    }

    if (importo === null || importo === 0) {
      scartate.push({ indice, motivo: "importo", grezzo: grezzoImporto });
      return;
    }

    righe.push({
      indice,
      data,
      descrizione: campoDi(riga, mappatura.descrizione).replace(/\s+/g, " ").trim(),
      importo: round2(mappatura.invertiSegno ? -importo : importo),
    });
  });

  return { righe, scartate };
}
