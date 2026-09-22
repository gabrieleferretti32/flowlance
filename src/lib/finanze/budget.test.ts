import { describe, expect, it } from "vitest";
import {
  confrontoBudget,
  dodiciMesi,
  importiDi,
  quadroDelMese,
  righeDelTipo,
  totaleDi,
  uniforme,
} from "./budget";
import type { BudgetPf, CategoriaPf, MovimentoPf } from "./tipi";

/**
 * Il confronto fra previsto e successo, e le tre volte in cui zero non è zero.
 *
 * Quasi tutti i test qui sotto misurano un **non detto**: che una casella
 * vuota non diventi un allarme, che un mese non importato non diventi un
 * elogio, che una media fatta su un mese solo si dichiari per quello che è.
 * Sono i modi in cui una tabella di budget mente restando aritmeticamente
 * corretta.
 */

const cat = (
  id: string,
  tipo: CategoriaPf["tipo"],
  extra: Partial<CategoriaPf> = {},
): CategoriaPf => ({
  id,
  tipo,
  nome: id,
  fissa: false,
  pagataDallAccantonamento: false,
  arrivaDallAttivita: false,
  ...extra,
});

const mov = (
  categoriaId: string,
  data: string,
  importo: number,
  tipo: MovimentoPf["tipo"] = "spesa",
): MovimentoPf => ({
  id: `${categoriaId}-${data}-${importo}`,
  data,
  tipo,
  categoriaId,
  contoId: "c1",
  importo,
  descrizione: "",
});

const budget = (categoriaId: string, anno: number, importi: number[]): BudgetPf => ({
  categoriaId,
  anno,
  importi,
});

const CATEGORIE = [
  cat("spesa", "spesa"),
  cat("casa", "spesa", { fissa: true }),
  cat("f24", "spesa", { fissa: true, pagataDallAccantonamento: true }),
  cat("fatture", "entrata", { arrivaDallAttivita: true }),
];

const riga = (c: ReturnType<typeof confrontoBudget>, id: string) =>
  c.righe.find((r) => r.categoria.id === id)!;

describe("una categoria senza budget", () => {
  const c = confrontoBudget({
    anno: 2026,
    mese: 9,
    movimenti: [mov("spesa", "2026-09-04", 240)],
    categorie: CATEGORIE,
    budget: [],
  });

  it("**non ha budget zero: non si divide, e non si grida**", () => {
    expect(riga(c, "spesa").quota).toBeNull();
    expect(riga(c, "spesa").stato).toBe("senza-budget");
  });

  it("e il suo speso si vede lo stesso", () => {
    expect(riga(c, "spesa").speso).toBe(240);
  });
});

describe("un mese senza movimenti", () => {
  const c = confrontoBudget({
    anno: 2026,
    mese: 9,
    movimenti: [mov("spesa", "2026-07-04", 300)],
    categorie: CATEGORIE,
    budget: [budget("spesa", 2026, dodiciMesi(400))],
  });

  it("**non è un mese in cui sei rimasto sotto: è un mese che non si sa**", () => {
    expect(c.conMovimenti).toBe(false);
    expect(riga(c, "spesa").stato).toBe("senza-dati");
  });

  it("e la misura vede la differenza: con un movimento lo stato cambia", () => {
    const con = confrontoBudget({
      anno: 2026,
      mese: 9,
      movimenti: [mov("spesa", "2026-07-04", 300), mov("spesa", "2026-09-04", 100)],
      categorie: CATEGORIE,
      budget: [budget("spesa", 2026, dodiciMesi(400))],
    });
    expect(con.conMovimenti).toBe(true);
    expect(riga(con, "spesa").stato).toBe("sotto");
  });
});

describe("dove sta il consumato rispetto al previsto", () => {
  const conSpesa = (importo: number) =>
    riga(
      confrontoBudget({
        anno: 2026,
        mese: 9,
        movimenti: [mov("spesa", "2026-09-04", importo)],
        categorie: CATEGORIE,
        budget: [budget("spesa", 2026, dodiciMesi(400))],
      }),
      "spesa",
    );

  it("sotto, vicino, oltre", () => {
    expect(conSpesa(200).stato).toBe("sotto");
    expect(conSpesa(360).stato).toBe("vicino"); // il 90% esatto è già «vicino»
    expect(conSpesa(400).stato).toBe("vicino"); // pari pari non è sforare
    expect(conSpesa(400.5).stato).toBe("oltre");
  });

  it("**e mezzo euro oltre è oltre, anche se la percentuale stampata dice 100%**", () => {
    // 400,50 / 400 = 1,00125, che arrotondato fa 1,00. Lo stato guarda gli
    // importi, non la quota stampata: era il contrario, e questo test l'ha
    // scoperto.
    expect(conSpesa(400.5).quota).toBe(1);
    expect(conSpesa(400.5).stato).toBe("oltre");
    expect(conSpesa(400.5).differenza).toBe(-0.5);
  });

  it("la differenza è negativa quando si è andati oltre, e resta negativa", () => {
    expect(conSpesa(450).differenza).toBe(-50);
  });

  it("**le quote non si arrotondano a occhio**", () => {
    // 133,33 su 400 fa 0,33333…: round2 lo ferma dove lo ferma il foglio.
    expect(conSpesa(133.33).quota).toBe(0.33);
  });
});

describe("cosa entra nel confronto", () => {
  const c = confrontoBudget({
    anno: 2026,
    mese: 9,
    movimenti: [
      mov("spesa", "2026-09-04", 100),
      mov("spesa", "2026-09-05", 50, "giroconto"),
      mov("spesa", "2025-09-04", 999),
      mov("f24", "2026-09-16", 1_200),
    ],
    categorie: CATEGORIE,
    budget: [],
  });

  it("i giroconti no: spostare non è spendere", () => {
    expect(riga(c, "spesa").speso).toBe(100);
  });

  it("gli altri anni no", () => {
    expect(riga(c, "spesa").spesoAnno).toBe(100);
  });

  it("**le categorie pagate dall'accantonamento non hanno nemmeno la riga**", () => {
    expect(c.righe.map((r) => r.categoria.id)).not.toContain("f24");
    // Non è pigrizia: il limite di spesa le toglie da tutti i gruppi, quindi
    // un budget scritto lì non cambierebbe nessun numero.
    expect(c.righe.map((r) => r.categoria.id)).toContain("spesa");
  });
});

describe("la media che si propone", () => {
  const c = confrontoBudget({
    anno: 2026,
    mese: 9,
    movimenti: [
      mov("spesa", "2026-07-04", 300),
      mov("spesa", "2026-08-04", 500),
      mov("spesa", "2026-09-04", 400),
    ],
    categorie: CATEGORIE,
    budget: [],
  });

  it("si fa sui mesi con movimenti, non sui mesi passati", () => {
    // Tre mesi importati su nove passati: 1.200 / 3, non 1.200 / 9.
    expect(riga(c, "spesa").mesiMisurati).toBe(3);
    expect(riga(c, "spesa").media).toBe(400);
  });

  it("su una categoria mai toccata è zero, e i mesi lo dicono", () => {
    expect(riga(c, "casa").media).toBe(0);
    expect(riga(c, "casa").mesiMisurati).toBe(3);
  });

  it("senza nessun movimento nell'anno non c'è niente da proporre", () => {
    const vuoto = confrontoBudget({
      anno: 2026,
      mese: 9,
      movimenti: [],
      categorie: CATEGORIE,
      budget: [],
    });
    expect(riga(vuoto, "spesa").media).toBe(0);
    expect(riga(vuoto, "spesa").mesiMisurati).toBe(0);
  });
});

describe("i dodici importi", () => {
  it("una riga che non c'è vale dodici zeri, non un errore", () => {
    expect(importiDi([], "spesa", 2026)).toEqual(Array(12).fill(0));
  });

  it("una riga corta si completa, invece di produrre `undefined`", () => {
    expect(importiDi([budget("spesa", 2026, [100, 200])], "spesa", 2026)).toEqual([
      100, 200, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
  });

  it("l'anno fa parte della chiave: il budget del 2025 non è quello del 2026", () => {
    expect(importiDi([budget("spesa", 2025, dodiciMesi(400))], "spesa", 2026)).toEqual(
      Array(12).fill(0),
    );
  });

  it("uniforme riconosce una riga riassumibile in un numero solo", () => {
    expect(uniforme(dodiciMesi(400))).toBe(true);
    expect(uniforme(Array(12).fill(0))).toBe(true);
    expect(uniforme([400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 900])).toBe(false);
  });

  it("il previsto dell'anno è la somma dei dodici, non dodici volte il primo", () => {
    const c = confrontoBudget({
      anno: 2026,
      mese: 9,
      movimenti: [],
      categorie: CATEGORIE,
      budget: [budget("spesa", 2026, [400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 400, 900])],
    });
    expect(riga(c, "spesa").previstoAnno).toBe(5_300);
    expect(riga(c, "spesa").uniforme).toBe(false);
  });
});

describe("i totali", () => {
  const c = confrontoBudget({
    anno: 2026,
    mese: 9,
    movimenti: [mov("spesa", "2026-09-04", 100), mov("fatture", "2026-09-10", 2_400, "entrata")],
    categorie: CATEGORIE,
    budget: [budget("spesa", 2026, dodiciMesi(400)), budget("casa", 2026, dodiciMesi(850))],
  });

  it("si possono chiedere per tipo, senza mescolare entrate e uscite", () => {
    expect(totaleDi(righeDelTipo(c, "spesa"))).toEqual({
      previsto: 1_250,
      speso: 100,
      differenza: 1_150,
    });
    expect(totaleDi(righeDelTipo(c, "entrata"))).toEqual({
      previsto: 0,
      speso: 2_400,
      differenza: -2_400,
    });
  });
});

describe("il quadro del mese", () => {
  const con = (b: BudgetPf[], m: MovimentoPf[] = []) =>
    quadroDelMese(confrontoBudget({ anno: 2026, mese: 9, movimenti: m, categorie: CATEGORIE, budget: b }));

  it("con una previsione di entrate usa quella", () => {
    const q = con([budget("fatture", 2026, dodiciMesi(3_000)), budget("spesa", 2026, dodiciMesi(400))]);
    expect(q).toEqual({ entrate: 3_000, fonteEntrate: "previsione", uscite: 400, differenza: 2_600 });
  });

  it("**senza previsione ma con incassi registrati usa quelli**", () => {
    /*
      Era il difetto: 9.000 € di budget di spesa, nessuna previsione di
      entrate, e la schermata scriveva «Differenza −9.000,00 €» accanto a
      «incassato 3.200,00 €».
    */
    const q = con(
      [budget("spesa", 2026, dodiciMesi(9_000))],
      [mov("fatture", "2026-09-10", 3_200, "entrata")],
    );
    expect(q.fonteEntrate).toBe("registrate");
    expect(q.entrate).toBe(3_200);
    expect(q.differenza).toBe(-5_800);
  });

  it("e la previsione, quando c'è, vince sugli incassi: è quella che stai decidendo", () => {
    const q = con(
      [budget("fatture", 2026, dodiciMesi(2_000))],
      [mov("fatture", "2026-09-10", 3_200, "entrata")],
    );
    expect(q.fonteEntrate).toBe("previsione");
    expect(q.entrate).toBe(2_000);
  });

  it("**senza né l'una né gli altri la differenza non si calcola**", () => {
    const q = con([budget("spesa", 2026, dodiciMesi(9_000))]);
    expect(q.fonteEntrate).toBe("nessuna");
    expect(q.entrate).toBe(0);
    expect(q.differenza).toBeNull();
    // Le uscite previste restano un numero vero, e si possono mostrare.
    expect(q.uscite).toBe(9_000);
  });

  it("un mese senza movimenti non ha «entrate registrate» pari a zero: non ne ha", () => {
    const q = con(
      [budget("spesa", 2026, dodiciMesi(400))],
      [mov("fatture", "2026-07-10", 3_200, "entrata")],
    );
    expect(q.fonteEntrate).toBe("nessuna");
    expect(q.differenza).toBeNull();
  });
});
