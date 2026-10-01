import { describe, expect, it } from "vitest";
import { avanzamentoAnno, type IngressoAvanzamento } from "./avanzamento";

/*
  I numeri sono quelli di un archivio vero al 1° ottobre 2026: 38.892,03 € di
  imponibile su 22 fatture, una nota di credito da 1.270,49 € del 22 aprile,
  sei clienti distinti. Il fatturato che si legge a schermo è 37.621,54 €.
*/
const fattura = (data: string, imponibile: number, clienteId = "c1") => ({
  dataEmissione: data, imponibile, clienteId,
});

const BASE: IngressoAvanzamento = {
  anno: 2026,
  oggi: "2026-10-01",
  fatture: [
    fattura("2026-01-20", 4_466.64, "a"),
    fattura("2026-02-10", 4_748.5, "b"),
    fattura("2026-03-11", 2_100, "c"),
    fattura("2026-04-14", 3_200, "d"),
    fattura("2026-05-12", 3_065, "a"),
    fattura("2026-06-09", 4_930, "e"),
    fattura("2026-07-07", 3_237.5, "b"),
    fattura("2026-08-18", 3_227.5, "f"),
    fattura("2026-09-15", 6_191.39, "a"),
    fattura("2026-10-01", 3_725.5, "b"),
  ],
  note: [{ dataDocumento: "2026-04-22", imponibile: 1_270.49 }],
  obiettivoFatturato: 101_410.93,
  obiettivoClienti: 16,
};

const round = (n: number) => Math.round(n * 100) / 100;

describe("**a che punto è l'anno in corso**", () => {
  const a = avanzamentoAnno(BASE);

  it("il fatturato è al netto delle note di credito", () => {
    expect(a.fatturato).toBe(37_621.54);
    expect(a.mensili[3]).toBe(round(3_200 - 1_270.49));
  });

  it("nove mesi chiusi, tre che restano, e insieme fanno dodici", () => {
    expect(a.mesiChiusi).toBe(9);
    expect(a.mesiRestanti).toBe(3);
  });

  /*
    **Il numero che la prima stesura sbagliava.** Contando tutto il fatturato —
    ottobre compreso — sui soli nove mesi chiusi uscivano 4.180,17 €: una
    fattura del giorno prima al numeratore di una divisione che al denominatore
    si ferma a settembre.
  */
  it("il ritmo guarda solo i mesi chiusi: 3.766,23 e non 4.180,17", () => {
    expect(a.ritmo).toBe(3_766.23);
    expect(round(a.fatturato / 9)).toBe(4_180.17);
  });

  it("quanto manca, e a che ritmo nei mesi che restano", () => {
    expect(a.manca).toBe(63_789.39);
    expect(a.ritmoDaAdesso).toBe(21_263.13);
    expect(a.ritmoNecessario).toBe(8_450.91);
  });

  it("e la proiezione dice dove si arriva tenendo questo ritmo", () => {
    expect(a.proiezione).toBe(45_194.76);
    expect(a.quota).toBeCloseTo(0.371, 3);
  });

  /* 21.263 contro 3.766: oltre il doppio, quindi la divisione non è un consiglio. */
  it("**e lo dichiara fuori scala**", () => {
    expect(a.fuoriScala).toBe(true);
  });

  it("i clienti sono quelli distinti con una fattura nell'anno", () => {
    expect(a.clienti).toEqual({ fatti: 6, necessari: 16 });
  });
});

describe("l'obiettivo superato", () => {
  const a = avanzamentoAnno({ ...BASE, obiettivoFatturato: 30_000 });

  it("non produce un «manca» negativo", () => {
    expect(a.superato).toBe(true);
    expect(a.manca).toBe(0);
    expect(a.ritmoDaAdesso).toBeNull();
  });

  it("e la proiezione resta, perché è la domanda che resta", () => {
    expect(a.proiezione).toBe(45_194.76);
    expect(a.fuoriScala).toBe(false);
  });
});

describe("gli altri due anni", () => {
  it("**un anno futuro non ha niente da confrontare**", () => {
    const a = avanzamentoAnno({ ...BASE, anno: 2027 });
    expect(a.stato).toBe("futuro");
    expect(a.fatturato).toBe(0);
    expect(a.mesiChiusi).toBe(0);
    expect(a.mesiRestanti).toBe(12);
    /* Nessun ritmo da dichiarare: zero mesi chiusi non è «zero euro al mese». */
    expect(a.ritmo).toBeNull();
    expect(a.proiezione).toBeNull();
    expect(a.fuoriScala).toBe(false);
  });

  it("un anno chiuso è un consuntivo: niente mesi davanti, niente divisioni per zero", () => {
    const a = avanzamentoAnno({ ...BASE, anno: 2026, oggi: "2027-03-04" });
    expect(a.stato).toBe("chiuso");
    expect(a.mesiChiusi).toBe(12);
    expect(a.mesiRestanti).toBe(0);
    expect(a.ritmoDaAdesso).toBeNull();
    expect(a.ritmo).toBe(round(37_621.54 / 12));
  });

  it("e il primo mese dell'anno non ha ancora un ritmo", () => {
    const a = avanzamentoAnno({ ...BASE, oggi: "2026-01-04" });
    expect(a.mesiChiusi).toBe(0);
    expect(a.ritmo).toBeNull();
    expect(a.ritmoDaAdesso).toBe(round(a.manca / 12));
    expect(a.fuoriScala).toBe(false);
  });
});

describe("i casi che non devono rompere niente", () => {
  it("senza obiettivo non si inventa una percentuale", () => {
    const a = avanzamentoAnno({ ...BASE, obiettivoFatturato: 0 });
    expect(a.quota).toBeNull();
    expect(a.manca).toBe(0);
    expect(a.superato).toBe(false);
  });

  /* Chi non ha fatturato niente nei mesi chiusi: qualunque cifra serva, è fuori scala. */
  it("un ritmo a zero con qualcosa da recuperare è fuori scala", () => {
    const a = avanzamentoAnno({ ...BASE, fatture: [], note: [] });
    expect(a.ritmo).toBe(0);
    expect(a.fuoriScala).toBe(true);
    expect(a.proiezione).toBe(0);
  });
});
