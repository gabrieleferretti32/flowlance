import { describe, expect, it } from "vitest";
import { CLASSI, etichettaClasse, patrimonio } from "./patrimonio";
import type { BenePf, ContoPersonale, MovimentoPf } from "./tipi";

const conto = (id: string, saldo: number, data = "2026-09-01"): ContoPersonale => ({
  id, nome: id, tipo: "corrente", saldoRiferimento: saldo, dataRiferimento: data, professionale: false,
});

const bene = (id: string, classe: BenePf["classe"], valore: number): BenePf => ({
  id, classe, nome: id, valore, aggiornatoIl: "2026-09-01",
});

const mov = (p: Partial<MovimentoPf> & { id: string; data: string; importo: number }): MovimentoPf => ({
  tipo: "spesa", categoriaId: "c", contoId: "a", descrizione: "", ...p,
});

describe("il patrimonio netto", () => {
  it("senza niente è zero, e non è un errore", () => {
    const p = patrimonio([], [], []);
    expect(p.netto).toBe(0);
    expect(p.liquidita).toBe(0);
    expect(p.righe.map((r) => r.valore)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("è la liquidità più quello che possiedi", () => {
    const p = patrimonio([conto("a", 3_000)], [], [bene("etf", "investimenti", 12_000)]);
    expect(p.liquidita).toBe(3_000);
    expect(p.netto).toBe(15_000);
  });

  /**
   * **I debiti si scrivono positivi e si sottraggono.**
   *
   * «Mutuo residuo: 84.000 €» è come lo dice la banca, ed è come lo scrive
   * chiunque. Chiedere il meno a chi compila vorrebbe dire che sbagliarlo una
   * volta manda il netto fuori strada di due volte il debito. Il segno lo mette
   * la funzione, e questi due test sono il perché.
   */
  it("**un debito scritto positivo abbassa il netto**", () => {
    const p = patrimonio([conto("a", 50_000)], [], [bene("mutuo", "debiti", 84_000)]);
    expect(p.netto).toBe(-34_000);
    expect(p.debiti).toBe(84_000);
  });

  it("e nella sua riga compare col meno, senza toccare il dato scritto", () => {
    const p = patrimonio([], [], [bene("mutuo", "debiti", 84_000)]);
    const riga = p.righe.find((r) => r.classe === "debiti")!;
    expect(riga.valore).toBe(-84_000);
    expect(riga.valoreScritto).toBe(84_000);
    expect(riga.voci[0].valore).toBe(84_000);
  });

  it("la liquidità segue i movimenti, come il saldo", () => {
    const p = patrimonio(
      [conto("a", 1_000)],
      [mov({ id: "1", data: "2026-09-10", importo: 250 })],
      [],
    );
    expect(p.liquidita).toBe(750);
    expect(p.netto).toBe(750);
  });

  it("e a una data passata vale quello che valeva allora", () => {
    const p = patrimonio(
      [conto("a", 1_000)],
      [mov({ id: "1", data: "2026-09-10", importo: 250 })],
      [],
      "2026-09-05",
    );
    expect(p.liquidita).toBe(1_000);
  });

  it("le voci di una classe si sommano, e restano elencate", () => {
    const p = patrimonio(
      [],
      [],
      [bene("etf", "investimenti", 12_000), bene("btp", "investimenti", 8_000)],
    );
    const riga = p.righe.find((r) => r.classe === "investimenti")!;
    expect(riga.valoreScritto).toBe(20_000);
    expect(riga.voci).toHaveLength(2);
  });

  it("**la somma delle righe più la liquidità fa il netto**", () => {
    const p = patrimonio(
      [conto("a", 2_500), conto("b", 7_500, "2026-01-01")],
      [mov({ id: "1", data: "2026-09-10", importo: 100 })],
      [
        bene("etf", "investimenti", 12_000),
        bene("casa", "beni", 180_000),
        bene("prestito", "crediti", 1_500),
        bene("fondo", "pensione", 22_000),
        bene("orologio", "altro", 3_000),
        bene("mutuo", "debiti", 120_000),
      ],
    );
    const somma = p.righe.reduce((t, r) => t + r.valore, p.liquidita);
    expect(p.netto).toBe(Math.round(somma * 100) / 100);
    expect(p.netto).toBe(108_400);
  });

  it("i centesimi si arrotondano come il foglio, non come capita", () => {
    const p = patrimonio(
      [],
      [],
      [bene("a", "investimenti", 0.005), bene("b", "investimenti", 0.005)],
    );
    expect(p.netto).toBe(0.01);
  });
});

describe("le classi", () => {
  it("sono sei, e i debiti chiudono la fila", () => {
    expect(CLASSI).toHaveLength(6);
    expect(CLASSI[CLASSI.length - 1].classe).toBe("debiti");
  });

  it("hanno tutte un nome da mostrare", () => {
    for (const c of CLASSI) expect(etichettaClasse(c.classe)).toBe(c.etichetta);
  });

  /* La misura al contrario: se un giorno il tipo guadagna una classe e questo
     elenco resta indietro, `patrimonio()` la ignorerebbe in silenzio. */
  it("**e l'elenco copre tutte quelle che il tipo ammette**", () => {
    const nelTipo: BenePf["classe"][] = [
      "investimenti", "beni", "crediti", "pensione", "altro", "debiti",
    ];
    expect(CLASSI.map((c) => c.classe).sort()).toEqual([...nelTipo].sort());
  });
});

/**
 * **Il mutuo senza la casa.**
 *
 * È lo sbilancio più facile da produrre: il debito te lo ricorda la rata, il
 * bene no — nessuno manda l'estratto conto di un immobile. Chi registra solo
 * il primo si vede un patrimonio netto più basso del vero di tutto il valore
 * della casa, e non ha nessun modo di accorgersene guardando la cifra.
 */
describe("**un mutuo senza beni fisici**", () => {
  it("si nota, e lo si dice", () => {
    const p = patrimonio([], [], [bene("Mutuo prima casa", "debiti", 84_000)]);
    expect(p.mancaImmobile).toBe(true);
  });

  it("con la casa fra i beni fisici, non si dice niente", () => {
    const p = patrimonio(
      [],
      [],
      [bene("Mutuo prima casa", "debiti", 84_000), bene("Casa", "beni", 210_000)],
    );
    expect(p.mancaImmobile).toBe(false);
  });

  it("un debito che non è un mutuo non fa scattare niente", () => {
    const p = patrimonio([], [], [bene("Prestito auto", "debiti", 6_000)]);
    expect(p.mancaImmobile).toBe(false);
  });

  it("e nemmeno un archivio senza debiti", () => {
    expect(patrimonio([], [], []).mancaImmobile).toBe(false);
    expect(patrimonio([], [], [bene("Casa", "beni", 210_000)]).mancaImmobile).toBe(false);
  });

  it("il nome si legge come lo scrive una persona: maiuscole e flessioni comprese", () => {
    for (const nome of ["MUTUO", "Mutuo residuo", "mutuo ipotecario", "Il Mutuo della casa"]) {
      expect(patrimonio([], [], [bene(nome, "debiti", 1)]).mancaImmobile, nome).toBe(true);
    }
  });

  /*
    Il limite, scritto come test perché non si perda: il riconoscimento è una
    lettura del nome, e un mutuo chiamato in un altro modo non si riconosce.
    Questo test **documenta** il comportamento, non lo approva.
  */
  it("ma un mutuo chiamato in un altro modo no, ed è il limite del metodo", () => {
    const p = patrimonio([], [], [bene("Banca Intesa, rata 320 €", "debiti", 84_000)]);
    expect(p.mancaImmobile).toBe(false);
  });

  it("non tocca nessun numero: resta un'osservazione", () => {
    const con = patrimonio([conto("a", 1_000)], [], [bene("Mutuo", "debiti", 84_000)]);
    expect(con.netto).toBe(-83_000);
  });
});
