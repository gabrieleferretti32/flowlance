import { describe, expect, it } from "vitest";
import { leggiCsv } from "@/lib/csv/parser";
import {
  applicaMappatura,
  dataDiCella,
  formatoDelleDate,
  importoDiCella,
  proponiMappatura,
  type MappaturaColonne,
} from "./rendiconto";

const CSV_UNICA = `Data;Descrizione;Importo
05/09/2026;PAGAMENTO POS ESSELUNGA;-63,40
06/09/2026;BONIFICO DA STUDIO ROSSI;2.400,00
07/09/2026;ADDEBITO SDD ENEL ENERGIA;-88,10
`;

const CSV_SEPARATE = `Data contabile,Causale,Entrate,Uscite
05/09/2026,SPESA SUPERMERCATO,,63.40
06/09/2026,ACCREDITO COMPENSO,2400.00,
`;

describe("la mappatura proposta dalle intestazioni", () => {
  it("riconosce data, descrizione e importo", () => {
    const m = proponiMappatura(["Data", "Descrizione", "Importo"]);
    expect(m).toEqual({ data: 0, descrizione: 1, forma: { tipo: "unica", importo: 2 } });
  });

  it("riconosce le due colonne separate, e le preferisce all'importo unico", () => {
    const m = proponiMappatura(["Data contabile", "Causale", "Entrate", "Uscite"]);
    expect(m?.forma).toEqual({ tipo: "separate", entrate: 2, uscite: 3 });
  });

  /**
   * **Quando non si capisce, non si propone.**
   *
   * Tre tendine riempite a caso si confermano senza guardare, perché «l'app le
   * aveva già messe». Un modulo vuoto invece si compila guardando il file.
   */
  it("**su intestazioni che non dicono niente, non propone niente**", () => {
    expect(proponiMappatura(["Colonna 1", "Colonna 2", "Colonna 3"])).toBeNull();
    expect(proponiMappatura(["Data", "Importo"])).toBeNull();
  });
});

describe("gli importi come li scrivono i rendiconti", () => {
  it("il formato italiano, con e senza migliaia", () => {
    expect(importoDiCella("1.234,56")).toBe(1234.56);
    expect(importoDiCella("-63,40")).toBe(-63.4);
    expect(importoDiCella("2400.00")).toBe(2400);
  });

  it("**il meno travestito: parentesi e segno in coda**", () => {
    expect(importoDiCella("(120,50)")).toBe(-120.5);
    expect(importoDiCella("120,50-")).toBe(-120.5);
  });

  it("una cella vuota o non numerica non è zero: è niente", () => {
    expect(importoDiCella("")).toBeNull();
    expect(importoDiCella("   ")).toBeNull();
    expect(importoDiCella("saldo")).toBeNull();
  });
});

describe("leggere un rendiconto con la colonna unica", () => {
  const tabella = leggiCsv(CSV_UNICA);
  const mappatura = proponiMappatura(tabella.intestazioni)!;
  const esito = applicaMappatura(tabella, mappatura);

  it("tiene il segno che c'è nel file", () => {
    expect(esito.righe.map((r) => r.importo)).toEqual([-63.4, 2400, -88.1]);
  });

  it("porta le date in ISO e ripulisce le descrizioni", () => {
    expect(esito.righe[0].data).toBe("2026-09-05");
    expect(esito.righe[0].descrizione).toBe("PAGAMENTO POS ESSELUNGA");
  });

  it("e sa rovesciare tutto, quando il file ha le uscite positive", () => {
    const rovesciato = applicaMappatura(tabella, { ...mappatura, invertiSegno: true });
    expect(rovesciato.righe.map((r) => r.importo)).toEqual([63.4, -2400, 88.1]);
  });
});

/**
 * **Due colonne separate: è la colonna a dire il verso, non il segno.**
 *
 * Trattare «Uscite: 63,40» come un importo positivo farebbe entrare gli
 * addebiti come entrate. Non è un errore piccolo: raddoppia il saldo invece di
 * sbagliarlo di poco, e lo fa su tutte le righe insieme.
 */
describe("leggere un rendiconto con entrate e uscite separate", () => {
  const tabella = leggiCsv(CSV_SEPARATE);
  const mappatura = proponiMappatura(tabella.intestazioni)!;
  const esito = applicaMappatura(tabella, mappatura);

  it("**l'uscita diventa negativa anche se nel file è positiva**", () => {
    expect(esito.righe.map((r) => r.importo)).toEqual([-63.4, 2400]);
  });

  it("e un meno nella colonna delle uscite non la rovescia", () => {
    const conMeno = leggiCsv(`Data,Causale,Entrate,Uscite\n05/09/2026,SPESA,,-63.40\n`);
    const m: MappaturaColonne = { data: 0, descrizione: 1, forma: { tipo: "separate", entrate: 2, uscite: 3 } };
    expect(applicaMappatura(conMeno, m).righe[0].importo).toBe(-63.4);
  });
});

describe("le righe che non si possono leggere", () => {
  it("si scartano una per una, dicendo perché e con che testo", () => {
    const tabella = leggiCsv(`Data;Descrizione;Importo
05/09/2026;BUONA;-10,00
saldo finale;;1.000,00
07/09/2026;SENZA IMPORTO;
08/09/2026;ZERO;0,00
`);
    const esito = applicaMappatura(tabella, proponiMappatura(tabella.intestazioni)!);
    expect(esito.righe).toHaveLength(1);
    expect(esito.scartate.map((s) => [s.indice, s.motivo])).toEqual([
      [2, "data"],
      [3, "importo"],
      [4, "importo"],
    ]);
    expect(esito.scartate[0].grezzo).toBe("saldo finale");
  });

  /* La misura al contrario: un file tutto buono non produce scarti. */
  it("e un file buono non ne produce nessuno", () => {
    const tabella = leggiCsv(CSV_UNICA);
    expect(applicaMappatura(tabella, proponiMappatura(tabella.intestazioni)!).scartate).toEqual([]);
  });
});

/**
 * **05/09/2026 è il 5 settembre, o il 9 maggio?**
 *
 * Dipende da chi ha scritto il file: Revolut e PayPal esportano all'americana.
 * Non è un dettaglio di forma — sposta un movimento di quattro mesi, e nel
 * registro non si vede: la data c'è, è plausibile, ed è un'altra.
 */
describe("il formato delle date, dedotto dal file", () => {
  it("**una data con il primo numero sopra 12 decide tutto il file**", () => {
    const esito = formatoDelleDate(["05/09/2026", "31/12/2026", "02/01/2027"]);
    expect(esito).toEqual({ formato: "giorno-mese", certezza: "dedotto" });
  });

  it("**e se è il secondo a superare 12, il file è americano**", () => {
    const esito = formatoDelleDate(["05/09/2026", "12/31/2026"]);
    expect(esito).toEqual({ formato: "mese-giorno", certezza: "dedotto" });
  });

  it("senza nessuna prova si sceglie l'italiano, e si dice che è una scelta", () => {
    expect(formatoDelleDate(["05/09/2026", "01/02/2026"])).toEqual({
      formato: "giorno-mese",
      certezza: "predefinito",
    });
  });

  it("le date ISO non sono ambigue", () => {
    expect(formatoDelleDate(["2026-09-05", "2026-12-31"])).toEqual({
      formato: "iso",
      certezza: "dedotto",
    });
  });

  /* Un file con tutte e due le prove è incoerente: righe leggibili solo in un
     modo e righe leggibili solo nell'altro. Non si sceglie in silenzio. */
  it("**un file che dice tutte e due le cose si dichiara incoerente**", () => {
    expect(formatoDelleDate(["31/12/2026", "12/31/2026"])).toEqual({
      formato: "giorno-mese",
      certezza: "incoerente",
    });
  });

  it("e le celle si leggono nel formato deciso", () => {
    expect(dataDiCella("05/09/2026", "giorno-mese")).toBe("2026-09-05");
    expect(dataDiCella("05/09/2026", "mese-giorno")).toBe("2026-05-09");
    expect(dataDiCella("2026-09-05", "mese-giorno")).toBe("2026-09-05");
    expect(dataDiCella("31/12/2026", "mese-giorno")).toBeNull();
  });

  it("**e un file americano, letto all'americana, dà i mesi giusti**", () => {
    const tabella = leggiCsv(`Data,Descrizione,Importo\n05/09/2026,UNO,-10.00\n12/31/2026,DUE,-20.00\n`);
    const formato = formatoDelleDate(tabella.righe.map((r) => r[0]));
    const esito = applicaMappatura(tabella, {
      ...proponiMappatura(tabella.intestazioni)!,
      formatoData: formato.formato,
    });
    expect(formato.formato).toBe("mese-giorno");
    expect(esito.righe.map((r) => r.data)).toEqual(["2026-05-09", "2026-12-31"]);
  });
});

/**
 * **I numeri all'inglese.**
 *
 * Revolut, Wise, PayPal e i conti in valuta esportano col punto decimale.
 * Letto all'italiana, `1,234.56` entra sbagliato di mille volte — ed è il
 * genere di errore che in un registro di spese non si nota subito, perché una
 * riga sola sbagliata di mille si confonde con un bonifico vero.
 */
describe("gli importi all'inglese", () => {
  it("**l'ultimo separatore è quello decimale**", () => {
    expect(importoDiCella("1,234.56")).toBe(1234.56);
    expect(importoDiCella("1.234,56")).toBe(1234.56);
    expect(importoDiCella("-2,400.00")).toBe(-2400);
  });

  it("con le migliaia ripetute", () => {
    expect(importoDiCella("1,234,567.89")).toBe(1234567.89);
    expect(importoDiCella("1.234.567,89")).toBe(1234567.89);
  });

  it("**un separatore solo con tre cifre dietro è migliaia, in tutte e due le lingue**", () => {
    expect(importoDiCella("1.234")).toBe(1234);
    expect(importoDiCella("1,234")).toBe(1234);
  });

  it("e con due cifre dietro è decimale, in tutte e due", () => {
    expect(importoDiCella("12.50")).toBe(12.5);
    expect(importoDiCella("12,50")).toBe(12.5);
  });

  it("i simboli di valuta non disturbano", () => {
    expect(importoDiCella("€ 1.234,56")).toBe(1234.56);
    expect(importoDiCella("$1,234.56")).toBe(1234.56);
  });
});

/**
 * **Una riga con più campi dell'intestazione non si legge: si scarta.**
 *
 * È il caso dei numeri all'inglese in un file separato da virgole:
 * `1,234.56` senza virgolette diventa due campi, le colonne dopo slittano, e
 * la colonna dell'importo legge «1». Milleduecentotrentaquattro euro entrati
 * come uno, e nessuno se ne accorge — è un importo plausibile.
 *
 * Trovato provando un finto export di Revolut nel browser, non rileggendo.
 */
describe("le righe che slittano", () => {
  const conVirgolaNonQuotata = `Data,Descrizione,Importo
05/09/2026,SPESA,-12.50
31/12/2026,BONIFICO DA CLIENTE,1,234.56
`;

  it("**si scartano invece di entrare con l'importo troncato**", () => {
    const tabella = leggiCsv(conVirgolaNonQuotata);
    const esito = applicaMappatura(tabella, proponiMappatura(tabella.intestazioni)!);
    expect(esito.righe).toHaveLength(1);
    expect(esito.scartate).toEqual([
      { indice: 2, motivo: "colonne", grezzo: "31/12/2026,BONIFICO DA CLIENTE,1,234.56" },
    ]);
  });

  /* La misura al contrario: lo stesso numero fra virgolette entra intero. */
  it("**e con le virgolette, come lo scrive davvero una banca, entra intero**", () => {
    const tabella = leggiCsv(`Data,Descrizione,Importo\n31/12/2026,BONIFICO,"1,234.56"\n`);
    const esito = applicaMappatura(tabella, proponiMappatura(tabella.intestazioni)!);
    expect(esito.scartate).toEqual([]);
    expect(esito.righe[0].importo).toBe(1234.56);
  });
});

describe("**le colonne si riconoscono a parole, non a pezzi di parola**", () => {
  /*
    «in» sta nell'elenco delle entrate perché esistono colonne chiamate così, e
    sta anche dentro «saldo fINale». Cercando la sottostringa, un rendiconto
    con la colonna del saldo diventava un rendiconto con la colonna degli
    accrediti — e gli importi entravano con il segno sbagliato.
  */
  it("«Saldo finale» non è la colonna degli accrediti", () => {
    const m = proponiMappatura(["Data", "Descrizione", "Importo", "Saldo finale", "Dare"]);
    expect(m).not.toBeNull();
    /*
      Cercando la sottostringa: entrate = «Saldo finale» (per il «in» dentro
      «finale») e uscite = «Dare», cioè due colonne di importo che importi non
      sono. A parole: nessuna colonna di entrata, e resta «Importo».
    */
    expect(m!.forma).toEqual({ tipo: "unica", importo: 2 });
  });

  it("e le colonne che lo sono davvero si riconoscono lo stesso", () => {
    const m = proponiMappatura(["Data", "Causale", "In", "Out"]);
    expect(m!.forma).toEqual({ tipo: "separate", entrate: 2, uscite: 3 });
  });

  it("gli inizi di parola continuano a prendere i plurali e i femminili", () => {
    const m = proponiMappatura(["Data valuta", "Descrizione operazione", "Accrediti", "Addebiti"]);
    expect(m!.forma).toEqual({ tipo: "separate", entrate: 2, uscite: 3 });
  });

  it("una colonna «Dare/Avere» resta riconosciuta", () => {
    const m = proponiMappatura(["Data", "Causale", "Avere", "Dare"]);
    expect(m!.forma).toEqual({ tipo: "separate", entrate: 2, uscite: 3 });
  });
});
