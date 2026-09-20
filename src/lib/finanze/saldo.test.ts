import { describe, expect, it } from "vitest";
import { saldoConto, saldoTotale, serieSaldo } from "./saldo";
import type { ContoPersonale, MovimentoPf } from "./tipi";

const conto = (id: string, saldo: number, data = "2026-09-01"): ContoPersonale => ({
  id, nome: id, tipo: "corrente", saldoRiferimento: saldo, dataRiferimento: data, professionale: false,
});

const mov = (p: Partial<MovimentoPf> & { id: string; data: string; importo: number }): MovimentoPf => ({
  tipo: "spesa", categoriaId: "c", contoId: "a", descrizione: "", ...p,
});

describe("il saldo è ancorato: importare il passato non cambia il presente", () => {
  const corrente = conto("a", 1_000, "2026-09-01");

  it("**un movimento precedente all'ancora non sposta niente**", () => {
    const prima = saldoConto(corrente, []);
    const dopo = saldoConto(corrente, [mov({ id: "1", data: "2026-03-15", importo: 500 })]);
    expect(prima).toBe(1_000);
    expect(dopo).toBe(1_000);
  });

  it("nemmeno un anno intero di movimenti precedenti", () => {
    const anno = Array.from({ length: 200 }, (_, i) =>
      mov({ id: `v${i}`, data: `2026-0${(i % 8) + 1}-10`, importo: 37 }),
    );
    expect(saldoConto(corrente, anno)).toBe(1_000);
  });

  it("**un movimento dello stesso giorno dell'ancora è già dentro**", () => {
    /*
      Il saldo letto il 1° settembre comprende tutto quello che è successo il
      1° settembre. Contarlo di nuovo lo conterebbe due volte — ed è la riga
      su cui sbaglia chiunque scriva questa funzione di fretta.
    */
    expect(saldoConto(corrente, [mov({ id: "1", data: "2026-09-01", importo: 200 })])).toBe(1_000);
  });

  it("un movimento successivo sì", () => {
    expect(saldoConto(corrente, [mov({ id: "1", data: "2026-09-02", importo: 200 })])).toBe(800);
    expect(
      saldoConto(corrente, [mov({ id: "1", data: "2026-09-02", importo: 200, tipo: "entrata" })]),
    ).toBe(1_200);
  });

  it("risparmi e rate escono dal conto come le spese", () => {
    for (const tipo of ["risparmio", "rata"] as const) {
      expect(saldoConto(corrente, [mov({ id: "1", data: "2026-09-05", importo: 100, tipo })]), tipo)
        .toBe(900);
    }
  });
});

describe("i giroconti", () => {
  const a = conto("a", 1_000);
  const b = conto("b", 500);
  const fra = mov({
    id: "g", data: "2026-09-10", importo: 300, tipo: "giroconto", contoId: "a", contoDestinazioneId: "b",
  });

  it("**fra due conti tracciati il totale non cambia, i due saldi sì**", () => {
    expect(saldoTotale([a, b], [])).toBe(1_500);
    expect(saldoTotale([a, b], [fra])).toBe(1_500);
    expect(saldoConto(a, [fra])).toBe(700);
    expect(saldoConto(b, [fra])).toBe(800);
  });

  it("verso un conto esterno il totale scende", () => {
    const fuori = { ...fra, contoDestinazioneId: null };
    expect(saldoTotale([a, b], [fuori])).toBe(1_200);
    expect(saldoConto(a, [fuori])).toBe(700);
    expect(saldoConto(b, [fuori])).toBe(500);
  });
});

describe("la serie storica", () => {
  it("parte dall'ancora più vecchia e ha un punto per giorno con movimenti", () => {
    const a = conto("a", 1_000, "2026-09-01");
    const b = conto("b", 500, "2026-08-15");
    const serie = serieSaldo([a, b], [
      mov({ id: "1", data: "2026-09-02", importo: 100 }),
      mov({ id: "2", data: "2026-09-02", importo: 50 }),
      mov({ id: "3", data: "2026-09-04", importo: 25, tipo: "entrata" }),
    ]);
    expect(serie.map((p) => p.data)).toEqual(["2026-08-15", "2026-09-02", "2026-09-04"]);
    expect(serie[serie.length - 1].saldo).toBe(1_500 - 100 - 50 + 25);
  });

  it("senza conti non c'è niente da disegnare", () => {
    expect(serieSaldo([], [mov({ id: "1", data: "2026-09-02", importo: 10 })])).toEqual([]);
  });
});
