import { describe, expect, it } from "vitest";
import { analizzaBackup, creaBackup, serializzaBackup } from "@/lib/dati/backup";
import { COLLEZIONI, datiVuoti, type Dati } from "@/lib/dati/tipi";
import { VERSIONE_SCHEMA } from "@/lib/dati/db";

/**
 * Il modulo entra nel backup, e i backup di prima continuano a entrare.
 *
 * Sono due promesse in direzioni opposte, e la seconda è quella che si rompe
 * senza far rumore: chi ha esportato a settembre non ha fatto niente di
 * sbagliato, e un import che gli dice «file non valido» gli fa credere di aver
 * perso l'archivio.
 */
const conFinanze = (): Dati => ({
  ...datiVuoti(),
  pfConti: [{
    id: "c1", nome: "Conto principale", tipo: "corrente",
    saldoRiferimento: 3_210.5, dataRiferimento: "2026-09-20", professionale: true,
  }],
  pfMovimenti: [{
    id: "m1", data: "2026-09-21", tipo: "spesa", categoriaId: "spesa",
    contoId: "c1", importo: 42.9, descrizione: "Esselunga",
  }],
  pfCategorie: [{ id: "spesa", tipo: "spesa", nome: "Spesa alimentare", fissa: false }],
  pfBudget: [{ categoriaId: "spesa", anno: 2026, importi: Array(12).fill(400) }],
  pfBeni: [{ id: "b1", classe: "investimenti", nome: "ETF", valore: 12_000, aggiornatoIl: "2026-09-01" }],
  pfRegole: [{ id: "r1", testoDaCercare: "esselunga", categoriaId: "spesa", tipo: "spesa" }],
  pfImport: [{ id: "i1", data: "2026-09-21", file: "conto.csv", contoId: "c1", numeroMovimenti: 1 }],
});

const rilegge = (dati: Dati) => {
  const esito = analizzaBackup(serializzaBackup(creaBackup(dati)));
  if (!esito.ok) throw new Error(`il backup non si rilegge: ${esito.errori.join(" · ")}`);
  return esito.backup.dati;
};

describe("le sette collezioni sono nel giro del backup", () => {
  it("compaiono in COLLEZIONI, quindi nei conteggi e nelle etichette", () => {
    for (const nome of ["pfConti", "pfMovimenti", "pfCategorie", "pfBudget", "pfBeni", "pfRegole", "pfImport"]) {
      expect(COLLEZIONI, nome).toContain(nome);
    }
  });

  it("**esportate e rilette tornano identiche**", () => {
    const dati = conFinanze();
    const tornate = rilegge(dati);
    for (const nome of COLLEZIONI) {
      expect(tornate[nome], nome).toEqual(dati[nome]);
    }
  });
});

describe("**un backup vecchio, senza il modulo, entra senza errori**", () => {
  /*
    Si costruisce a mano il file com'era prima: nessuna delle sette chiavi, e
    lo schema di allora. Non si riusa `creaBackup` perché quello di oggi le
    chiavi le scrive — proverebbe il contrario di quello che serve provare.
  */
  const vecchio = JSON.stringify({
    formato: "flowlance",
    versioneSchema: VERSIONE_SCHEMA - 1,
    esportatoIl: "2026-09-11T10:00:00.000Z",
    dati: {
      impostazioni: [], clienti: [], fatture: [], note: [], costi: [],
      movimentiPersonali: [], movimentiAttivita: [], versamenti: [],
      patrimonio: [], spunte: [], chiusure: [], percorsi: [],
    },
  });

  it("si legge, e il modulo risulta vuoto", () => {
    const esito = analizzaBackup(vecchio);
    expect(esito.ok, esito.ok ? "" : esito.errori.join(" · ")).toBe(true);
    if (!esito.ok) return;
    expect(esito.backup.dati.pfConti).toEqual([]);
    expect(esito.backup.dati.pfMovimenti).toEqual([]);
  });

  it("e la misura vede la differenza: un file con il modulo lo porta davvero", () => {
    const esito = analizzaBackup(serializzaBackup(creaBackup(conFinanze())));
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.backup.dati.pfConti).toHaveLength(1);
  });
});

describe("le righe storte si scartano dicendolo", () => {
  const con = (pf: Record<string, unknown[]>) =>
    analizzaBackup(JSON.stringify({
      formato: "flowlance",
      versioneSchema: VERSIONE_SCHEMA,
      esportatoIl: "2026-09-21T10:00:00.000Z",
      dati: { ...datiVuoti(), ...pf },
    }));

  it("**un importo negativo è un errore, non un numero da raddrizzare**", () => {
    const esito = con({
      pfMovimenti: [{
        id: "m", data: "2026-09-21", tipo: "spesa", categoriaId: "x",
        contoId: "c", importo: -42, descrizione: "",
      }],
    });
    expect(esito.ok).toBe(false);
    if (esito.ok) return;
    expect(esito.errori.join(" ")).toMatch(/negativo/);
  });

  it("un conto senza data di riferimento è un conto senza ancora", () => {
    const esito = con({
      pfConti: [{ id: "c", nome: "X", tipo: "corrente", saldoRiferimento: 100, professionale: false }],
    });
    expect(esito.ok).toBe(false);
    if (esito.ok) return;
    expect(esito.errori.join(" ")).toMatch(/ancorare/);
  });

  it("un budget con meno di dodici caselle si completa a zero, non produce NaN", () => {
    const esito = con({ pfBudget: [{ categoriaId: "x", anno: 2026, importi: [100, 200] }] });
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    const importi = esito.backup.dati.pfBudget[0].importi;
    expect(importi).toHaveLength(12);
    expect(importi.every((n) => Number.isFinite(n))).toBe(true);
    expect(importi[11]).toBe(0);
  });
});
