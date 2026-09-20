import { describe, expect, it } from "vitest";
import { datiVetrina } from "@/lib/dati/vetrina";
import { calcolaProspetto, type Prospetto } from "./motore";
import { calcolaIva } from "./iva";
import { scadenzeAnno } from "./scadenze";
import { parametriDi } from "./parametri";
import { round2 } from "./aritmetica";
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
    expect(q.imposte.alMese).toBe(Math.round((q.imposte.daAccantonare / 4) * 100) / 100);
  });
});

describe("**la quota di settembre, sui numeri veri della vetrina**", () => {
  const q = quota("2026-09-20");

  it("distribuisce il residuo sulle scadenze future, non la somma delle scadenze", () => {
    expect(q.metodo).toBe("scadenze");
    expect(q.imposte.daAccantonare).toBe(3_035.93);
    // Il 30 giugno è passato: non entra. Resta il secondo acconto del 30 novembre.
    expect(q.imposte.voci.map((v) => v.data)).toEqual(["2026-11-30"]);
    expect(q.imposte.voci[0].quota).toBe(3_035.93);
    expect(q.imposte.voci[0].mesiMancanti).toBe(3);
  });

  it("e fa 1.011,98 € al mese, non 252,99 €", () => {
    expect(q.imposte.alMese).toBe(1_011.98);
    expect(prospettoDi(2026, "2026-09-20").accantonamentoMensile).toBe(252.99);
  });

  it("nessun avviso: il calendario basta", () => {
    expect(q.avvisi).toEqual([]);
  });
});

describe("la quota si muove con il calendario, invece di scendere quando paghi", () => {
  it("più ci si avvicina alla scadenza, più sale", () => {
    const mesi = ["2026-09-20", "2026-10-20", "2026-11-20"].map((o) => quota(o).imposte.alMese);
    expect(mesi[0]).toBeLessThan(mesi[1]);
    expect(mesi[1]).toBeLessThan(mesi[2]);
  });

  it("l'ultimo mese utile chiede tutto quello che manca", () => {
    const q = quota("2026-11-20");
    expect(q.imposte.voci[0].mesiMancanti).toBe(1);
    expect(q.imposte.alMese).toBe(q.imposte.daAccantonare);
  });
});

describe("**quando è già scaduto: niente divisione per zero**", () => {
  it("dopo l'ultima scadenza dell'anno tutto il residuo è di questo mese, con l'avviso", () => {
    const q = quota("2026-12-10");
    const inRitardo = q.imposte.voci.find((v) => v.scaduta);
    expect(inRitardo).toBeDefined();
    expect(inRitardo?.mesiMancanti).toBe(0);
    expect(inRitardo?.alMese).toBe(inRitardo?.quota);
    expect(Number.isFinite(q.alMese)).toBe(true);
    expect(q.avvisi.join(" ")).toMatch(/doveva già essere uscito/);
  });
});

describe("i casi che non devono rompere niente", () => {
  /*
    La versione precedente di questo test pretendeva che la quota intera fosse
    zero. Era vero quando le componenti erano una sola: adesso non lo è più, ed
    è giusto che non lo sia. Chi non deve più niente di imposte può dovere
    ancora l'IVA del trimestre — sono due denari diversi, e il secondo non
    smette di esistere perché il primo è finito.
  */
  it("senza fabbisogno di imposte resta comunque l'IVA", () => {
    const p = prospettoDi(2026, "2026-09-20");
    const q = quotaAccantonamento({
      prospetto: { ...p, fabbisognoDaAccantonare: 0 },
      impostazioni: impDi(2026), parametri: parametriDi(2026),
      iva: calcolaIva(p.fattureCalcolate, p.costiCalcolati, impDi(2026), parametriDi(2026)),
      precedente: prospettoDi(2025, "2026-09-20"), oggi: "2026-09-20",
    });
    expect(q.imposte.alMese).toBe(0);
    expect(q.imposte.voci).toEqual([]);
    expect(q.alMese).toBe(q.iva.alMese);
  });

  it("la somma delle voci è la quota, e le quote sommano il residuo", () => {
    const q = quota("2026-09-20");
    const tutte = [...q.imposte.voci, ...q.iva.voci];
    const somma = tutte.reduce((t, v) => t + v.alMese, 0);
    expect(Math.abs(somma - q.alMese)).toBeLessThan(0.02);
    const distribuito = q.imposte.voci.reduce((t, v) => t + v.quota, 0);
    expect(Math.abs(distribuito - q.imposte.daAccantonare)).toBeLessThan(0.02);
  });
});

/**
 * L'IVA è la seconda componente, e in forfettario sparisce da sé.
 *
 * Per chi è in ordinario l'IVA incassata non è sua, e il limite di spesa del
 * modulo parte dalle entrate in banca — che la comprendono. Una quota che la
 * escludesse lascerebbe spendere l'IVA dei clienti: sul dataset di vetrina
 * sono più del carico fiscale intero.
 */
describe("**la componente IVA**", () => {
  const ordinario = quota("2026-09-20");

  it("c'è, e sta su scadenze di sola IVA", () => {
    expect(ordinario.iva.voci.length).toBeGreaterThan(0);
    for (const v of ordinario.iva.voci) expect(v.componente).toBe("iva");
  });

  it("le imposte restano su scadenze di sole imposte e contributi", () => {
    for (const v of ordinario.imposte.voci) expect(v.componente).toBe("imposte");
  });

  it("**il totale è esattamente la somma delle due**", () => {
    expect(ordinario.alMese).toBe(
      Math.round((ordinario.imposte.alMese + ordinario.iva.alMese) * 100) / 100,
    );
  });

  it("ogni scadenza IVA futura è il suo importo diviso i mesi che mancano", () => {
    for (const v of ordinario.iva.voci) {
      expect(v.mesiMancanti).toBeGreaterThan(0);
      expect(v.alMese).toBe(Math.round((v.quota / v.mesiMancanti) * 100) / 100);
    }
  });

  it("le scadenze IVA già passate non ci sono", () => {
    for (const v of ordinario.iva.voci) expect(v.data >= "2026-09-20").toBe(true);
  });
});

describe("**stesso mese, ordinario contro forfettario**", () => {
  const oggi = "2026-09-20";
  const ordinario = quota(oggi);

  /*
    Lo stesso archivio, lo stesso mese, cambiata una cosa sola: il regime.
    Non un dataset diverso — sarebbero due situazioni diverse, e il confronto
    non direbbe niente sul regime.
  */
  const forfettario = (() => {
    const imp = { ...impDi(2026), regime: "forfettario" as const };
    const p = calcolaProspetto({
      impostazioni: imp, parametri: parametriDi(2026), fatture: d.fatture, costi: d.costi,
      note: d.note, versamenti: d.versamenti,
      impostazioniPerAnno: d.impostazioni.map((i) => (i.anno === 2026 ? imp : i)),
      oggi,
    });
    return quotaAccantonamento({
      prospetto: p,
      impostazioni: imp,
      parametri: parametriDi(2026),
      iva: calcolaIva(p.fattureCalcolate, p.costiCalcolati, imp, parametriDi(2026)),
      precedente: prospettoDi(2025, oggi),
      oggi,
    });
  })();

  it("in forfettario la componente IVA è zero", () => {
    expect(forfettario.iva.alMese).toBe(0);
    expect(forfettario.iva.voci).toEqual([]);
    expect(forfettario.iva.daAccantonare).toBe(0);
  });

  it("**e la quota totale è la sola parte di imposte**", () => {
    expect(forfettario.alMese).toBe(forfettario.imposte.alMese);
  });

  it("**in ordinario la quota è più alta di esattamente la parte IVA**", () => {
    /*
      Il confronto che conta: la differenza fra i due totali non è un numero
      qualunque, è la componente IVA. Se un giorno l'IVA finisse anche dentro
      il residuo delle imposte, questa uguaglianza si romperebbe — ed è
      esattamente il doppio conteggio da evitare.
    */
    const soloIva = round2(ordinario.alMese - ordinario.imposte.alMese);
    expect(soloIva).toBe(ordinario.iva.alMese);
    expect(ordinario.iva.alMese).toBeGreaterThan(0);
  });

  it("la parte di imposte esiste in tutti e due i regimi", () => {
    expect(ordinario.imposte.alMese).toBeGreaterThan(0);
    expect(forfettario.imposte.alMese).toBeGreaterThan(0);
  });
});
