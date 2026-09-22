import { describe, expect, it } from "vitest";
import { catenaAnni } from "@/lib/analisi/anno";
import { datiVetrina } from "@/lib/dati/vetrina";
import { round2 } from "@/lib/fisco/aritmetica";
import { CATEGORIE_INIZIALI } from "./categorie";
import { anniChiusi, riepilogoEffettivo } from "./derivazione";
import type { Dati } from "@/lib/dati/tipi";
import type { MovimentoPf } from "./tipi";

/**
 * La derivazione vista dal motore, cioè dalla stessa porta da cui passa l'app.
 *
 * `riepilogoEffettivo` si prova da solo nel file accanto; qui si prova che
 * **innestato dove lo innesta l'app** faccia quello che deve: cambiare il
 * cashflow e il bilancio dove il registro parla, e non toccare un euro degli
 * anni chiusi. Un test che ricostruisse il calcolo a mano proverebbe un
 * percorso che l'app non fa — la lezione in testa ad `accantonamento.test.ts`.
 */

const OGGI = "2026-09-22";
const d = datiVetrina();

/** Lo stesso innesto che fa `archivioDa` in `hooks.ts`. */
const archivioDa = (dati: Dati) => ({
  impostazioni: dati.impostazioni,
  fatture: dati.fatture,
  note: dati.note,
  costi: dati.costi,
  versamenti: dati.versamenti,
  movimentiAttivita: dati.movimentiAttivita,
  movimentiPersonali: riepilogoEffettivo(
    dati.movimentiPersonali,
    dati.pfMovimenti,
    dati.pfCategorie,
    anniChiusi(dati.chiusure),
  ),
  chiusure: dati.chiusure,
});

const anno = (dati: Dati, a: number) => catenaAnni(archivioDa(dati), a, OGGI).get(a)!;

const idCategoria = (nome: string) => CATEGORIE_INIZIALI.find((c) => c.nome === nome)!.id;

const mov = (data: string, tipo: MovimentoPf["tipo"], categoria: string, importo: number): MovimentoPf => ({
  id: `${data}-${categoria}-${importo}`,
  data,
  tipo,
  categoriaId: idCategoria(categoria),
  contoId: "c1",
  importo,
  descrizione: "",
});

/** Un mese di registro: un prelievo più tre uscite. */
const mese = (aaaaMm: string, prelievo: number) => [
  mov(`${aaaaMm}-05`, "entrata", "Fatture incassate", prelievo),
  mov(`${aaaaMm}-06`, "spesa", "Affitto e casa", 820),
  mov(`${aaaaMm}-12`, "spesa", "Spesa alimentare", 430),
  mov(`${aaaaMm}-20`, "risparmio", "Risparmio", 300),
];

const conRegistro = (movimenti: MovimentoPf[]): Dati => ({
  ...d,
  pfCategorie: [...CATEGORIE_INIZIALI],
  pfMovimenti: movimenti,
});

/** Il 2025 della vetrina è chiuso: è il caso che regge tutto questo file. */
const ANNO_CHIUSO = 2025;

describe("il 2025 della vetrina è chiuso davvero", () => {
  it("altrimenti questi test non provano niente", () => {
    expect(d.chiusure.map((c) => c.anno)).toContain(ANNO_CHIUSO);
    expect(anno(d, ANNO_CHIUSO).chiuso).toBe(true);
  });
});

describe("**un anno chiuso non si deriva**", () => {
  const dentroIlChiuso = conRegistro([...mese("2025-06", 1_900), ...mese("2025-08", 2_100)]);

  it("il cashflow di quell'anno non si muove di un euro", () => {
    const senza = anno(d, ANNO_CHIUSO).cashflow;
    const con = anno(dentroIlChiuso, ANNO_CHIUSO).cashflow;
    expect(con.saldoFinale).toBe(senza.saldoFinale);
    expect(con.totaleUscite).toBe(senza.totaleUscite);
    expect(con.mesi.map((m) => m.prelieviPersonali)).toEqual(
      senza.mesi.map((m) => m.prelieviPersonali),
    );
  });

  it("e nessuno scostamento dalla chiusura compare: non è cambiato niente", () => {
    expect(anno(dentroIlChiuso, ANNO_CHIUSO).scostamenti).toEqual([]);
  });

  it("**nemmeno l'anno dopo, che eredita il saldo**", () => {
    expect(anno(dentroIlChiuso, 2026).cashflow.saldoIniziale).toBe(
      anno(d, 2026).cashflow.saldoIniziale,
    );
    expect(anno(dentroIlChiuso, 2026).cashflow.saldoFinale).toBe(anno(d, 2026).cashflow.saldoFinale);
  });
});

describe("**riaprendo l'anno la derivazione riprende**", () => {
  const movimenti = [...mese("2025-06", 1_900), ...mese("2025-08", 2_100)];
  const chiuso = conRegistro(movimenti);
  const riaperto: Dati = { ...chiuso, chiusure: d.chiusure.filter((c) => c.anno !== ANNO_CHIUSO) };

  it("la misura vede la differenza: gli stessi movimenti, senza la chiusura, muovono i numeri", () => {
    const prima = anno(chiuso, ANNO_CHIUSO).cashflow;
    const dopo = anno(riaperto, ANNO_CHIUSO).cashflow;
    expect(dopo.saldoFinale).not.toBe(prima.saldoFinale);

    // Giugno e agosto passano dal dichiarato al derivato, gli altri no.
    const cambiati = dopo.mesi
      .map((m, i) => ({ mese: m.mese, prima: prima.mesi[i].prelieviPersonali, dopo: m.prelieviPersonali }))
      .filter((m) => m.prima !== m.dopo);
    expect(cambiati.map((c) => c.mese)).toEqual([6, 8]);
    expect(cambiati.map((c) => c.dopo)).toEqual([1_900, 2_100]);
  });

  it("e il saldo scende esattamente di quello che i prelievi salgono", () => {
    const prima = anno(chiuso, ANNO_CHIUSO).cashflow;
    const dopo = anno(riaperto, ANNO_CHIUSO).cashflow;
    const inPiu = round2(
      dopo.mesi.reduce((s, m) => s + m.prelieviPersonali, 0) -
        prima.mesi.reduce((s, m) => s + m.prelieviPersonali, 0),
    );
    expect(round2(prima.saldoFinale - dopo.saldoFinale)).toBe(inPiu);
  });

  it("l'anno dopo eredita il saldo nuovo, ed è il momento in cui è giusto che si muova", () => {
    expect(anno(riaperto, 2026).cashflow.saldoIniziale).not.toBe(
      anno(chiuso, 2026).cashflow.saldoIniziale,
    );
  });
});

describe("in un anno aperto la derivazione lavora", () => {
  const aperto = conRegistro([...mese("2026-06", 1_900), ...mese("2026-08", 2_100)]);

  it("i prelievi dei mesi con registro diventano quelli del registro", () => {
    const mesi = anno(aperto, 2026).cashflow.mesi;
    expect(mesi[5].prelieviPersonali).toBe(1_900);
    expect(mesi[7].prelieviPersonali).toBe(2_100);
  });

  it("e i mesi senza registro restano quelli scritti a mano", () => {
    const con = anno(aperto, 2026).cashflow.mesi;
    const senza = anno(d, 2026).cashflow.mesi;
    for (const i of [0, 1, 2, 3, 4, 6, 8]) {
      expect(con[i].prelieviPersonali, `mese ${i + 1}`).toBe(senza[i].prelieviPersonali);
    }
  });

  it("**i due dataset com'escono di fabbrica non cambiano di un euro**", () => {
    /*
      È la misura che vale più di tutte: chi non usa il modulo non vede
      muoversi niente, perché senza movimenti registrati non c'è niente da
      derivare. Se un giorno la vetrina avrà un registro, questo test lo dirà
      fallendo.
    */
    expect(d.pfMovimenti).toEqual([]);
    const conInnesto = anno(d, 2026).cashflow;
    const senzaInnesto = catenaAnni(
      { ...archivioDa(d), movimentiPersonali: d.movimentiPersonali },
      2026,
      OGGI,
    ).get(2026)!.cashflow;
    expect(conInnesto.saldoFinale).toBe(senzaInnesto.saldoFinale);
    expect(conInnesto.totaleUscite).toBe(senzaInnesto.totaleUscite);
  });
});
