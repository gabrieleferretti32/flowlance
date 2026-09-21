import { describe, expect, it } from "vitest";
import { sovrapposizionePersonale } from "./sovrapposizione";
import type { MovimentoPf } from "./tipi";

const mov = (p: Partial<MovimentoPf> & { id: string; data: string; importo: number }): MovimentoPf => ({
  tipo: "spesa", categoriaId: "c", contoId: "a", descrizione: "", ...p,
});

describe("la sovrapposizione fra registro e riepilogo mensile", () => {
  it("su un archivio vuoto non dice niente, e non è un avviso da mostrare", () => {
    const s = sovrapposizionePersonale([], 2026);
    expect(s.quanti).toBe(0);
    expect(s.mesi).toEqual([]);
  });

  it("conta i movimenti dell'anno, mese per mese", () => {
    const s = sovrapposizionePersonale(
      [
        mov({ id: "1", data: "2026-01-10", importo: 100 }),
        mov({ id: "2", data: "2026-01-20", importo: 50 }),
        mov({ id: "3", data: "2026-03-05", importo: 30 }),
      ],
      2026,
    );
    expect(s.quanti).toBe(3);
    expect(s.mesi.map((m) => [m.mese, m.quanti])).toEqual([
      [1, 2],
      [3, 1],
    ]);
  });

  it("**gli altri anni non ci entrano**", () => {
    const s = sovrapposizionePersonale(
      [
        mov({ id: "1", data: "2025-12-31", importo: 100 }),
        mov({ id: "2", data: "2026-01-01", importo: 40 }),
        mov({ id: "3", data: "2027-01-01", importo: 900 }),
      ],
      2026,
    );
    expect(s.quanti).toBe(1);
    expect(s.uscite).toBe(40);
  });

  it("entrate e uscite restano separate, con il loro nome", () => {
    const s = sovrapposizionePersonale(
      [
        mov({ id: "1", data: "2026-02-01", tipo: "entrata", importo: 3_200 }),
        mov({ id: "2", data: "2026-02-03", tipo: "spesa", importo: 870 }),
        mov({ id: "3", data: "2026-02-05", tipo: "risparmio", importo: 500 }),
        mov({ id: "4", data: "2026-02-08", tipo: "rata", importo: 500 }),
      ],
      2026,
    );
    expect(s.entrate).toBe(3_200);
    expect(s.uscite).toBe(1_870);
  });

  /**
   * **Un giroconto non è denaro che entra o esce.**
   *
   * Spostare 1.000 € dal conto corrente al libretto non cambia di un centesimo
   * quello che hai: sommarlo fra le uscite (o fra le entrate) gonfierebbe la
   * riga di una cifra che non esiste, proprio nella schermata che serve a dire
   * «attento, questi soldi li stai contando due volte».
   */
  it("**i giroconti si contano fra i movimenti, non nei totali**", () => {
    const s = sovrapposizionePersonale(
      [
        mov({ id: "1", data: "2026-04-01", tipo: "giroconto", importo: 1_000, contoDestinazioneId: "b" }),
        mov({ id: "2", data: "2026-04-02", tipo: "spesa", importo: 60 }),
      ],
      2026,
    );
    expect(s.quanti).toBe(2);
    expect(s.entrate).toBe(0);
    expect(s.uscite).toBe(60);
  });

  it("i totali dell'anno sono la somma dei mesi", () => {
    const righe = [
      mov({ id: "1", data: "2026-01-10", tipo: "entrata", importo: 1_000 }),
      mov({ id: "2", data: "2026-02-10", tipo: "entrata", importo: 500 }),
      mov({ id: "3", data: "2026-02-11", tipo: "spesa", importo: 120.55 }),
      mov({ id: "4", data: "2026-12-31", tipo: "spesa", importo: 79.45 }),
    ];
    const s = sovrapposizionePersonale(righe, 2026);
    expect(s.entrate).toBe(s.mesi.reduce((t, m) => t + m.entrate, 0));
    expect(s.uscite).toBe(200);
    expect(s.mesi.map((m) => m.mese)).toEqual([1, 2, 12]);
  });
});
