import { describe, expect, it } from "vitest";
import {
  anniChiusi,
  anniChiusiToccati,
  riepilogoDelMese,
  seRiaprissi,
  riepilogoDellAnno,
  riepilogoEffettivo,
} from "./derivazione";
import type { MovimentoPersonale } from "@/lib/dati/tipi";
import type { CategoriaPf, MovimentoPf } from "./tipi";

/**
 * Il riepilogo mensile ricavato dal registro.
 *
 * La regola che conta più di tutte è la quarta: **un'entrata marcata «arriva
 * dall'attività» è un prelievo**, cioè un'uscita di cassa dell'attività.
 * Senza, la derivazione sommerebbe due volte gli stessi euro — 2.402 € di
 * liquidità dell'attività più 2.400 € di conto personale per una fattura da
 * 2.400 € incassata una volta sola.
 */

const cat = (id: string, tipo: CategoriaPf["tipo"], extra: Partial<CategoriaPf> = {}): CategoriaPf => ({
  id,
  tipo,
  nome: id,
  fissa: false,
  pagataDallAccantonamento: false,
  arrivaDallAttivita: false,
  ...extra,
});

const CATEGORIE = [
  cat("fatture", "entrata", { arrivaDallAttivita: true }),
  cat("regali", "entrata"),
  cat("affitto", "spesa", { fissa: true }),
  cat("spesa", "spesa"),
  cat("mutuo", "rata", { fissa: true }),
  cat("fondo", "risparmio"),
];

const mov = (
  data: string,
  tipo: MovimentoPf["tipo"],
  categoriaId: string,
  importo: number,
): MovimentoPf => ({
  id: `${data}-${categoriaId}-${importo}`,
  data,
  tipo,
  categoriaId,
  contoId: "c1",
  importo,
  descrizione: "",
});

const manuale = (anno: number, mese: number, v: Partial<MovimentoPersonale> = {}): MovimentoPersonale => ({
  id: `man-${anno}-${mese}`,
  anno,
  mese,
  prelievi: 1_000,
  altreEntrate: 0,
  speseFisse: 800,
  speseVariabili: 400,
  risparmio: 100,
  ...v,
});

const SETTEMBRE = [
  mov("2026-09-02", "entrata", "fatture", 2_400),
  mov("2026-09-03", "entrata", "regali", 150),
  mov("2026-09-05", "spesa", "affitto", 820),
  mov("2026-09-08", "spesa", "spesa", 260),
  mov("2026-09-10", "rata", "mutuo", 430),
  mov("2026-09-12", "risparmio", "fondo", 300),
  mov("2026-09-15", "giroconto", "fondo", 900),
];

describe("dove finisce ogni movimento", () => {
  const r = riepilogoDelMese(SETTEMBRE, CATEGORIE, 2026, 9, "x");

  it("**un'entrata che arriva dall'attività è un prelievo**", () => {
    expect(r.prelievi).toBe(2_400);
  });

  it("e le altre entrate restano altre entrate", () => {
    expect(r.altreEntrate).toBe(150);
  });

  it("le spese fisse e le rate stanno insieme: sono impegni, non scelte del mese", () => {
    expect(r.speseFisse).toBe(1_250);
  });

  it("le variabili sono quelle su cui si decide", () => {
    expect(r.speseVariabili).toBe(260);
  });

  it("il risparmio è il suo", () => {
    expect(r.risparmio).toBe(300);
  });

  it("**il giroconto non entra da nessuna parte**", () => {
    const senza = riepilogoDelMese(
      SETTEMBRE.filter((m) => m.tipo !== "giroconto"),
      CATEGORIE,
      2026,
      9,
      "x",
    );
    expect(senza).toEqual(r);
  });

  it("e la misura vede la differenza: senza il flag quel prelievo sarebbe un'altra entrata", () => {
    const spento = CATEGORIE.map((c) => ({ ...c, arrivaDallAttivita: false }));
    const r2 = riepilogoDelMese(SETTEMBRE, spento, 2026, 9, "x");
    expect(r2.prelievi).toBe(0);
    expect(r2.altreEntrate).toBe(2_550);
  });

  it("una categoria cancellata dopo l'import non diventa un prelievo per sbaglio", () => {
    const r3 = riepilogoDelMese(SETTEMBRE, [], 2026, 9, "x");
    expect(r3.prelievi).toBe(0);
    expect(r3.altreEntrate).toBe(2_550);
    expect(r3.speseFisse).toBe(430); // la rata resta una rata: lo dice il movimento
    expect(r3.speseVariabili).toBe(1_080);
  });
});

describe("**la derivazione vale solo dove il registro parla**", () => {
  const manuali = [manuale(2026, 8), manuale(2026, 9)];
  const anno = riepilogoDellAnno(manuali, SETTEMBRE, CATEGORIE, 2026);

  it("settembre arriva dal registro, e dice quanti movimenti ha dietro", () => {
    const set = anno[8];
    expect(set.fonte).toBe("registro");
    expect(set.quanti).toBe(6); // il giroconto non si conta
    expect(set.riga.prelievi).toBe(2_400);
  });

  it("agosto resta quello scritto a mano, intatto", () => {
    expect(anno[7].fonte).toBe("manuale");
    expect(anno[7].riga).toEqual(manuali[0]);
  });

  it("**un mese senza niente è «assente», non un mese a zero**", () => {
    expect(anno[0].fonte).toBe("assente");
    expect(anno[0].riga.prelievi).toBe(0);
  });

  it("il mese derivato tiene l'id della riga a mano: non è una riga in più", () => {
    expect(anno[8].riga.id).toBe("man-2026-9");
  });

  it("e se la riga a mano non c'è se ne costruisce uno dalla sua chiave", () => {
    const senzaManuale = riepilogoDellAnno([], SETTEMBRE, CATEGORIE, 2026);
    expect(senzaManuale[8].riga.id).toBe("pf-2026-09");
  });
});

describe("le righe che vanno al motore", () => {
  it("sostituiscono i mesi derivati e lasciano stare gli altri", () => {
    const manuali = [manuale(2025, 12), manuale(2026, 8), manuale(2026, 9)];
    const righe = riepilogoEffettivo(manuali, SETTEMBRE, CATEGORIE);

    const dicembre = righe.find((r) => r.anno === 2025 && r.mese === 12);
    expect(dicembre, "l'anno che il registro non tocca resta intatto").toEqual(manuali[0]);

    const agosto = righe.find((r) => r.anno === 2026 && r.mese === 8);
    expect(agosto, "il mese senza movimenti resta com'era").toEqual(manuali[1]);

    const settembre = righe.find((r) => r.anno === 2026 && r.mese === 9);
    expect(settembre?.prelievi).toBe(2_400);
  });

  it("**nessun mese compare due volte**: sarebbe un prelievo contato due volte", () => {
    const manuali = [manuale(2026, 9)];
    const righe = riepilogoEffettivo(manuali, SETTEMBRE, CATEGORIE);
    const chiavi = righe.map((r) => `${r.anno}-${r.mese}`);
    expect(new Set(chiavi).size).toBe(chiavi.length);
  });

  it("senza registro non tocca niente, nemmeno l'ordine", () => {
    const manuali = [manuale(2026, 8), manuale(2026, 9)];
    expect(riepilogoEffettivo(manuali, [], CATEGORIE)).toBe(manuali);
  });

  it("un anno di soli giroconti non è un anno con un registro", () => {
    const manuali = [manuale(2026, 9)];
    const soloGiri = [mov("2026-09-15", "giroconto", "fondo", 900)];
    expect(riepilogoEffettivo(manuali, soloGiri, CATEGORIE)).toBe(manuali);
  });
});

describe("**regola 5: un anno chiuso non si deriva**", () => {
  const manuali = [manuale(2026, 9)];

  it("i movimenti ci sono, si contano, e non entrano nel riepilogo", () => {
    const anno = riepilogoDellAnno(manuali, SETTEMBRE, CATEGORIE, 2026, true);
    const set = anno[8];
    expect(set.fonte).toBe("chiuso");
    expect(set.quanti, "i movimenti si vedono").toBe(6);
    expect(set.riga, "ma la riga è quella dichiarata").toEqual(manuali[0]);
  });

  it("«chiuso» non è «manuale»: la schermata deve poterli distinguire", () => {
    const chiuso = riepilogoDellAnno(manuali, SETTEMBRE, CATEGORIE, 2026, true);
    const aperto = riepilogoDellAnno(manuali, [], CATEGORIE, 2026, false);
    expect(chiuso[8].fonte).toBe("chiuso");
    expect(aperto[8].fonte).toBe("manuale");
  });

  it("le righe che vanno al motore restano quelle di prima, identiche", () => {
    expect(riepilogoEffettivo(manuali, SETTEMBRE, CATEGORIE, [2026])).toBe(manuali);
  });

  it("**e riaprendo l'anno la derivazione riprende**", () => {
    const righe = riepilogoEffettivo(manuali, SETTEMBRE, CATEGORIE, []);
    expect(righe.find((r) => r.mese === 9)?.prelievi).toBe(2_400);
  });

  it("un anno chiuso non blocca gli altri", () => {
    const misti = [manuale(2025, 9), manuale(2026, 9)];
    const movimenti = [...SETTEMBRE, mov("2025-09-02", "entrata", "fatture", 999)];
    const righe = riepilogoEffettivo(misti, movimenti, CATEGORIE, [2025]);
    expect(righe.find((r) => r.anno === 2025 && r.mese === 9)).toEqual(misti[0]);
    expect(righe.find((r) => r.anno === 2026 && r.mese === 9)?.prelievi).toBe(2_400);
  });

  it("anniChiusi legge le chiusure così come stanno in archivio", () => {
    expect(anniChiusi([{ anno: 2024 }, { anno: 2025 }])).toEqual([2024, 2025]);
    expect(anniChiusi([])).toEqual([]);
  });
});

describe("l'esito di un import dentro un anno chiuso", () => {
  const chiusure = [{ anno: 2025 }];

  it("dice quali anni chiusi ha toccato, e con quanti movimenti", () => {
    const movimenti = [
      mov("2025-03-01", "entrata", "fatture", 100),
      mov("2025-04-01", "spesa", "spesa", 50),
      mov("2026-01-01", "spesa", "spesa", 70),
    ];
    expect(anniChiusiToccati(movimenti, chiusure)).toEqual([{ anno: 2025, quanti: 2 }]);
  });

  it("un import tutto dentro un anno aperto non ha niente da dire", () => {
    expect(anniChiusiToccati([mov("2026-01-01", "spesa", "spesa", 70)], chiusure)).toEqual([]);
  });

  it("i giroconti non si contano: non entrano nel riepilogo nemmeno da aperti", () => {
    expect(anniChiusiToccati([mov("2025-01-01", "giroconto", "fondo", 70)], chiusure)).toEqual([]);
  });
});

describe("che cosa cambierebbe riaprendo l'anno", () => {
  it("confronta i prelievi dichiarati con quelli che uscirebbero dal registro", () => {
    const manuali = [manuale(2026, 9, { prelievi: 1_000 }), manuale(2026, 8, { prelievi: 1_000 })];
    const c = seRiaprissi(manuali, SETTEMBRE, CATEGORIE, 2026);
    expect(c.mesi, "solo i mesi che il registro conosce").toEqual([9]);
    expect(c.dichiarati).toBe(1_000);
    expect(c.derivati).toBe(2_400);
    expect(c.differenza).toBe(1_400);
  });

  it("senza registro non c'è niente da confrontare", () => {
    const c = seRiaprissi([manuale(2026, 9)], [], CATEGORIE, 2026);
    expect(c.mesi).toEqual([]);
    expect(c.differenza).toBe(0);
  });
});
