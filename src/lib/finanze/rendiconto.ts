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
import { analizzaData } from "@/lib/format";
import { campoDi, type Tabella } from "@/lib/csv/parser";
import { round2 } from "@/lib/fisco/aritmetica";

/**
 * In che ordine sono scritte le date di questo file.
 *
 * `05/09/2026` è il 5 settembre per una banca italiana e il 9 maggio per
 * Revolut o PayPal, che esportano all'americana. Non è un dettaglio: sposta
 * un movimento di quattro mesi, e nel registro non si vede — la data c'è, è
 * plausibile, ed è sbagliata.
 *
 * La regola, e ha una sola mossa: **se nel file esiste almeno una data con il
 * primo numero sopra 12, quel numero è per forza un giorno**, e tutto il file
 * è giorno/mese. Se invece è il secondo numero a superare 12, è il contrario.
 * Se nessuno dei due supera mai 12 il file non lo dice, e si sceglie
 * l'italiano — perché questa è un'app italiana e chi la usa scarica
 * soprattutto rendiconti italiani.
 *
 * Un file che contiene tutte e due le prove è incoerente: ha righe che
 * possono essere lette solo in un modo e righe che possono essere lette solo
 * nell'altro. Non si sceglie in silenzio: si dichiara, e l'anteprima lo
 * mostra prima che qualcosa entri in archivio.
 */
export type FormatoData = "giorno-mese" | "mese-giorno" | "iso";

export type LetturaFormatoData = {
  formato: FormatoData;
  /** `dedotto` = il file lo dimostra; `predefinito` = nessuna prova, si usa l'italiano. */
  certezza: "dedotto" | "predefinito" | "incoerente";
};

export function formatoDelleDate(valori: string[]): LetturaFormatoData {
  let primoSopra12 = 0;
  let secondoSopra12 = 0;
  let separate = 0;
  let iso = 0;

  for (const grezzo of valori) {
    const testo = grezzo.trim();
    if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(testo)) {
      iso += 1;
      continue;
    }
    const pezzi = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(testo);
    if (!pezzi) continue;
    separate += 1;
    if (Number(pezzi[1]) > 12) primoSopra12 += 1;
    if (Number(pezzi[2]) > 12) secondoSopra12 += 1;
  }

  if (separate === 0 && iso > 0) return { formato: "iso", certezza: "dedotto" };
  if (primoSopra12 > 0 && secondoSopra12 > 0) {
    return { formato: "giorno-mese", certezza: "incoerente" };
  }
  if (primoSopra12 > 0) return { formato: "giorno-mese", certezza: "dedotto" };
  if (secondoSopra12 > 0) return { formato: "mese-giorno", certezza: "dedotto" };
  return { formato: "giorno-mese", certezza: "predefinito" };
}

/** Come si dice a chi carica, in due parole. */
export function nomeFormatoData(formato: FormatoData): string {
  if (formato === "iso") return "anno-mese-giorno";
  return formato === "giorno-mese" ? "giorno/mese (italiano)" : "mese/giorno (americano)";
}

/**
 * Una data di cella, letta nel formato che il file ha dichiarato.
 *
 * `analizzaData` di `format.ts` legge sempre all'italiana, ed è giusto che lo
 * faccia: la usa l'import dei documenti fiscali, dove il primo numero è il
 * giorno per legge. Qui il formato può essere un altro, e allora si scambiano
 * i due numeri **prima** di passarglieli, invece di scrivere un secondo
 * lettore di date che il giorno del 31 febbraio si comporterebbe diversamente.
 */
export function dataDiCella(grezzo: string, formato: FormatoData): string | null {
  const testo = grezzo.trim();
  if (formato !== "mese-giorno") return analizzaData(testo);
  const pezzi = /^(\d{1,2})([-/.])(\d{1,2})([-/.])(\d{2}|\d{4})$/.exec(testo);
  if (!pezzi) return analizzaData(testo);
  return analizzaData(`${pezzi[3]}${pezzi[2]}${pezzi[1]}${pezzi[4]}${pezzi[5]}`);
}

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
  /**
   * Il formato delle date del file, quando non è quello italiano.
   *
   * Assente vuol dire giorno/mese, che è il caso normale: un campo che quasi
   * sempre non c'è non deve comparire in ogni mappatura salvata.
   */
  formatoData?: FormatoData;
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
  motivo: "data" | "importo" | "colonne";
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
 * Un importo come lo scrivono i rendiconti: all'italiana, all'inglese, e con
 * i due travestimenti del meno.
 *
 * `(120,50)` è la contabilità anglosassone, `120,50-` è il segno in coda di
 * certi gestionali. Senza questi due casi la riga verrebbe scartata — e uno
 * scarto silenzioso su un addebito è denaro che sparisce dal registro.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * «1.234,56» contro «1,234.56»
 * ─────────────────────────────────────────────────────────────────────────
 *
 * I conti in valuta e le banche nuove — Revolut, Wise, PayPal — esportano col
 * punto decimale. Letto all'italiana, `1,234.56` diventa milleduecentotrenta­
 * quattro virgola cinquantasei **oppure** un numero che non si legge: in tutti
 * e due i casi il rendiconto entra sbagliato di mille volte.
 *
 * La regola è la posizione: **l'ultimo separatore è quello decimale**, e
 * l'altro, se c'è, separa le migliaia. Quando ce n'è uno solo seguito da
 * esattamente tre cifre — `1.234`, `1,234` — è migliaia in tutte e due le
 * convenzioni: un importo in euro con tre decimali non esiste, e leggerlo
 * come decimale trasformerebbe milleduecentotrentaquattro euro in uno e
 * spiccioli.
 */
export function importoDiCella(grezzo: string): number | null {
  const testo = grezzo.trim();
  if (testo === "") return null;
  const parentesi = /^\((.+)\)$/.exec(testo);
  const inCoda = /^(.+)-$/.exec(testo);
  const negativo = parentesi !== null || inCoda !== null;
  const numero = numeroDiQualunqueConvenzione(parentesi?.[1] ?? inCoda?.[1] ?? testo);
  if (numero === null) return null;
  return negativo ? -Math.abs(numero) : numero;
}

function numeroDiQualunqueConvenzione(grezzo: string): number | null {
  const pulito = grezzo
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(/[€$£%]/g, "")
    .replace(/−/g, "-")
    .replace(/^\+/, "");
  if (pulito === "" || pulito === "-") return null;

  const ultimaVirgola = pulito.lastIndexOf(",");
  const ultimoPunto = pulito.lastIndexOf(".");
  const senza = (testo: string, segno: string) => testo.split(segno).join("");

  let normalizzato: string;
  if (ultimaVirgola >= 0 && ultimoPunto >= 0) {
    // Tutti e due presenti: l'ultimo è il decimale, l'altro le migliaia.
    const decimale = ultimaVirgola > ultimoPunto ? "," : ".";
    const migliaia = decimale === "," ? "." : ",";
    normalizzato = senza(pulito, migliaia).replace(decimale, ".");
  } else if (ultimaVirgola >= 0 || ultimoPunto >= 0) {
    const segno = ultimaVirgola >= 0 ? "," : ".";
    const quanti = pulito.split(segno).length - 1;
    const dopo = pulito.length - pulito.lastIndexOf(segno) - 1;
    /*
      Ripetuto — «1.234.567» — è per forza migliaia. Uno solo con tre cifre
      dietro — «1.234», «1,234» — è migliaia in tutte e due le convenzioni: un
      importo in euro con tre decimali non esiste, e leggerlo come decimale
      trasformerebbe milleduecentotrentaquattro euro in uno e spiccioli.
    */
    normalizzato = quanti > 1 || dopo === 3 ? senza(pulito, segno) : pulito.replace(segno, ".");
  } else {
    normalizzato = pulito;
  }

  const valore = Number(normalizzato);
  return Number.isFinite(valore) ? valore : null;
}

export function applicaMappatura(
  tabella: Tabella,
  mappatura: MappaturaColonne,
): LetturaRendiconto {
  const righe: RigaRendiconto[] = [];
  const scartate: ScartoRendiconto[] = [];

  tabella.righe.forEach((riga, i) => {
    const indice = i + 1;

    /*
      La riga ha più campi dell'intestazione: qualcosa dentro un campo somiglia
      al separatore.

      Succede davvero con i numeri all'inglese in un file separato da virgole:
      `1,234.56` senza virgolette diventa due campi, tutte le colonne dopo
      slittano di uno, e la colonna dell'importo legge «1». Milleduecento­
      trentaquattro euro entrati come uno, e nessuno se ne accorge — è un
      importo plausibile.

      Quindi la riga si scarta e si dice: uno scarto si vede in anteprima, un
      importo slittato no.
    */
    if (riga.length > tabella.intestazioni.length) {
      scartate.push({ indice, motivo: "colonne", grezzo: riga.join(tabella.separatore) });
      return;
    }

    const grezzaData = campoDi(riga, mappatura.data);
    const data = dataDiCella(grezzaData, mappatura.formatoData ?? "giorno-mese");
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
