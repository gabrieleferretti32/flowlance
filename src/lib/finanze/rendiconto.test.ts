import { describe, expect, it } from "vitest";
import { leggiCsv } from "@/lib/csv/parser";
import {
  applicaMappatura,
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
