import { describe, expect, it } from "vitest";
import { datiVetrina } from "@/lib/dati/vetrina";
import { calcolaProspetto, type Prospetto } from "./motore";
import { calcolaIva } from "./iva";
import { scadenzeAnno } from "./scadenze";
import { parametriDi } from "./parametri";
import { mesiFinoA, mesiRimastiNellAnno, quotaAccantonamento } from "./accantonamento";

const d = datiVetrina();
const impDi = (a: number) => d.impostazioni.find((i) => i.anno === a)!;
const prospettoDi = (a: number, oggi: string): Prospetto =>
  calcolaProspetto({
    impostazioni: impDi(a), parametri: parametriDi(a), fatture: d.fatture, costi: d.costi,
    note: d.note, versamenti: d.versamenti, impostazioniPerAnno: d.impostazioni, oggi,
  });

const quota = (oggi: string, conAnnoPrima = true) => {
  const p = prospettoDi(2026, oggi);
  return quotaAccantonamento({
    prospetto: p,
    impostazioni: impDi(2026),
    parametri: parametriDi(2026),
    iva: calcolaIva(p.fattureCalcolate, p.costiCalcolati, impDi(2026), parametriDi(2026)),
    precedente: conAnnoPrima ? prospettoDi(2025, oggi) : null,
    oggi,
  });
};

describe("i mesi che mancano", () => {
  it("una scadenza di questo mese è un mese, non zero", () => {
    expect(mesiFinoA("2026-09-30", "2026-09-20")).toBe(1);
  });
  it("il mese dopo sono due", () => {
    expect(mesiFinoA("2026-10-05", "2026-09-20")).toBe(2);
  });
  it("attraversa l'anno", () => {
    expect(mesiFinoA("2027-06-30", "2026-09-20")).toBe(10);
  });
  it("**una scadenza passata è zero, e non uno**", () => {
    expect(mesiFinoA("2026-06-30", "2026-09-20")).toBe(0);
  });
  it("i mesi rimasti nell'anno non scendono sotto uno", () => {
    expect(mesiRimastiNellAnno("2026-09-20")).toBe(4);
    expect(mesiRimastiNellAnno("2026-12-31")).toBe(1);
  });
});

/**
 * La prova che il brief chiede: **se gli acconti escono senza importo, questo
 * test fallisce.**
 *
 * `scadenzeAnno` calcola gli acconti sui numeri dell'anno prima. Senza quel
 * prospetto restituisce le due righe con `importo: null`, e le due scadenze
 * più grosse dell'anno diventano invisibili al calcolo della quota — che
 * uscirebbe più bassa del vero, in silenzio. È il difetto che questa funzione
 * esiste per non avere.
 */
describe("**gli acconti devono avere un importo**", () => {
  const p2026 = prospettoDi(2026, "2026-09-20");
  const p2025 = prospettoDi(2025, "2026-09-20");
  const iva = calcolaIva(p2026.fattureCalcolate, p2026.costiCalcolati, impDi(2026), parametriDi(2026));

  it("con il prospetto dell'anno prima, le due scadenze di imposte hanno una cifra", () => {
    const imposte = scadenzeAnno(impDi(2026), parametriDi(2026), p2026, iva, p2025)
      .filter((s) => s.categoria === "imposte" && s.importo !== null && s.importo > 0);
    expect(imposte.length).toBeGreaterThanOrEqual(2);
    for (const s of imposte) expect(s.importo, s.titolo).toBeGreaterThan(0);
  });

  it("e la misura vede la differenza: senza l'anno prima non ce l'hanno", () => {
    const senza = scadenzeAnno(impDi(2026), parametriDi(2026), p2026, iva, null)
      .filter((s) => s.categoria === "imposte" && s.importo !== null && s.importo > 0);
    expect(senza).toHaveLength(0);
  });

  it("**quindi senza l'anno prima si passa al ripiego, e lo si dice**", () => {
    const q = quota("2026-09-20", false);
    expect(q.metodo).toBe("ripiego");
    expect(q.avvisi.join(" ")).toMatch(/anno scorso/);
    expect(q.alMese).toBe(Math.round((q.daAccantonare / 4) * 100) / 100);
  });
});

describe("**la quota di settembre, sui numeri veri della vetrina**", () => {
  const q = quota("2026-09-20");

  it("distribuisce il residuo sulle scadenze future, non la somma delle scadenze", () => {
    expect(q.metodo).toBe("scadenze");
    expect(q.daAccantonare).toBe(3_035.93);
    // Il 30 giugno è passato: non entra. Resta il secondo acconto del 30 novembre.
    expect(q.voci.map((v) => v.data)).toEqual(["2026-11-30"]);
    expect(q.voci[0].quota).toBe(3_035.93);
    expect(q.voci[0].mesiMancanti).toBe(3);
  });

  it("e fa 1.011,98 € al mese, non 252,99 €", () => {
    expect(q.alMese).toBe(1_011.98);
    expect(prospettoDi(2026, "2026-09-20").accantonamentoMensile).toBe(252.99);
  });

  it("nessun avviso: il calendario basta", () => {
    expect(q.avvisi).toEqual([]);
  });
});

describe("la quota si muove con il calendario, invece di scendere quando paghi", () => {
  it("più ci si avvicina alla scadenza, più sale", () => {
    const mesi = ["2026-09-20", "2026-10-20", "2026-11-20"].map((o) => quota(o).alMese);
    expect(mesi[0]).toBeLessThan(mesi[1]);
    expect(mesi[1]).toBeLessThan(mesi[2]);
  });

  it("l'ultimo mese utile chiede tutto quello che manca", () => {
    const q = quota("2026-11-20");
    expect(q.voci[0].mesiMancanti).toBe(1);
    expect(q.alMese).toBe(q.daAccantonare);
  });
});

describe("**quando è già scaduto: niente divisione per zero**", () => {
  it("dopo l'ultima scadenza dell'anno tutto il residuo è di questo mese, con l'avviso", () => {
    const q = quota("2026-12-10");
    const inRitardo = q.voci.find((v) => v.scaduta);
    expect(inRitardo).toBeDefined();
    expect(inRitardo?.mesiMancanti).toBe(0);
    expect(inRitardo?.alMese).toBe(inRitardo?.quota);
    expect(Number.isFinite(q.alMese)).toBe(true);
    expect(q.avvisi.join(" ")).toMatch(/doveva già essere uscito/);
  });
});

describe("i casi che non devono rompere niente", () => {
  it("con niente da accantonare la quota è zero e non ci sono voci", () => {
    const p = prospettoDi(2026, "2026-09-20");
    const q = quotaAccantonamento({
      prospetto: { ...p, fabbisognoDaAccantonare: 0 },
      impostazioni: impDi(2026), parametri: parametriDi(2026),
      iva: calcolaIva(p.fattureCalcolate, p.costiCalcolati, impDi(2026), parametriDi(2026)),
      precedente: prospettoDi(2025, "2026-09-20"), oggi: "2026-09-20",
    });
    expect(q.alMese).toBe(0);
    expect(q.voci).toEqual([]);
  });

  it("la somma delle voci è la quota, e le quote sommano il residuo", () => {
    const q = quota("2026-09-20");
    const somma = q.voci.reduce((t, v) => t + v.alMese, 0);
    expect(Math.abs(somma - q.alMese)).toBeLessThan(0.02);
    const distribuito = q.voci.reduce((t, v) => t + v.quota, 0);
    expect(Math.abs(distribuito - q.daAccantonare)).toBeLessThan(0.02);
  });
});
