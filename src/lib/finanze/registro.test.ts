import { describe, expect, it } from "vitest";
import {
  FILTRO_VUOTO,
  filtraRegistro,
  mesiConMovimenti,
  riguardaIlConto,
  totaliRegistro,
} from "./registro";
import { saldoConto } from "./saldo";
import type { ContoPersonale, MovimentoPf } from "./tipi";

const mov = (p: Partial<MovimentoPf> & { id: string; data: string; importo: number }): MovimentoPf => ({
  tipo: "spesa", categoriaId: "c", contoId: "a", descrizione: "", ...p,
});

const REGISTRO: MovimentoPf[] = [
  mov({ id: "1", data: "2026-01-10", tipo: "entrata", importo: 2_000 }),
  mov({ id: "2", data: "2026-01-20", tipo: "spesa", importo: 300 }),
  mov({ id: "3", data: "2026-02-05", tipo: "rata", importo: 250, contoId: "b" }),
  mov({ id: "4", data: "2026-03-01", tipo: "giroconto", importo: 1_000, contoId: "a", contoDestinazioneId: "b" }),
  mov({ id: "5", data: "2026-03-08", tipo: "risparmio", importo: 400, contoId: "b" }),
  mov({ id: "6", data: "2025-12-30", tipo: "spesa", importo: 99 }),
];

describe("il filtro del registro", () => {
  const base = FILTRO_VUOTO(2026);

  it("tiene solo l'anno guardato", () => {
    expect(filtraRegistro(REGISTRO, base).map((m) => m.id)).toEqual(["5", "4", "3", "2", "1"]);
  });

  it("mostra il più recente per primo", () => {
    const righe = filtraRegistro(REGISTRO, base);
    expect(righe[0].data >= righe[righe.length - 1].data).toBe(true);
  });

  it("per mese", () => {
    expect(filtraRegistro(REGISTRO, { ...base, mese: 1 }).map((m) => m.id)).toEqual(["2", "1"]);
  });

  it("per tipo", () => {
    expect(filtraRegistro(REGISTRO, { ...base, tipo: "entrata" }).map((m) => m.id)).toEqual(["1"]);
  });

  /**
   * **Il conto di destinazione conta quanto quello d'origine.**
   *
   * I mille euro arrivati sul libretto sono nel saldo del libretto, perché
   * `saldoConto` legge tutti e due i capi del giroconto. Se l'elenco filtrato
   * per libretto non li mostrasse, il saldo e la lista direbbero due cose
   * diverse sulla stessa cassa — e la lista sembrerebbe incompleta senza che
   * nessuno possa dire perché.
   */
  it("**per conto, e un giroconto si vede da tutti e due i capi**", () => {
    expect(filtraRegistro(REGISTRO, { ...base, contoId: "a" }).map((m) => m.id)).toEqual([
      "4", "2", "1",
    ]);
    expect(filtraRegistro(REGISTRO, { ...base, contoId: "b" }).map((m) => m.id)).toEqual([
      "5", "4", "3",
    ]);
  });

  it("e la misura al contrario: un conto che non c'entra non trova niente", () => {
    expect(filtraRegistro(REGISTRO, { ...base, contoId: "z" })).toEqual([]);
    expect(riguardaIlConto(REGISTRO[3], "z")).toBe(false);
  });

  it("i filtri si sommano", () => {
    expect(
      filtraRegistro(REGISTRO, { ...base, mese: 3, tipo: "giroconto", contoId: "b" }).map((m) => m.id),
    ).toEqual(["4"]);
  });

  it("i mesi offerti sono quelli che hanno qualcosa", () => {
    expect(mesiConMovimenti(REGISTRO, 2026)).toEqual([1, 2, 3]);
    expect(mesiConMovimenti(REGISTRO, 2025)).toEqual([12]);
    expect(mesiConMovimenti(REGISTRO, 2024)).toEqual([]);
  });
});

describe("i totali del registro", () => {
  const dellAnno = filtraRegistro(REGISTRO, FILTRO_VUOTO(2026));

  it("entrate e uscite hanno il loro nome", () => {
    const t = totaliRegistro(dellAnno, null);
    expect(t.quanti).toBe(5);
    expect(t.entrate).toBe(2_000);
    expect(t.uscite).toBe(950);
    expect(t.netto).toBe(1_050);
  });

  it("**il giroconto non entra nei totali: non entra né esce niente**", () => {
    const soloGiro = filtraRegistro(REGISTRO, { ...FILTRO_VUOTO(2026), tipo: "giroconto" });
    const t = totaliRegistro(soloGiro, null);
    expect(t.quanti).toBe(1);
    expect(t.entrate).toBe(0);
    expect(t.uscite).toBe(0);
    expect(t.netto).toBe(0);
  });

  it("senza un conto scelto l'effetto non si calcola, perché non vorrebbe dire niente", () => {
    expect(totaliRegistro(dellAnno, null).effettoSulConto).toBeNull();
  });

  /**
   * **L'effetto sul conto è quello che il saldo conta.**
   *
   * Questo test lega il registro al saldo: se un giorno le due funzioni
   * leggessero i giroconti in modo diverso, la somma qui sotto e il saldo del
   * conto smetterebbero di coincidere, ed è esattamente il difetto che
   * nessuno si accorgerebbe di avere.
   */
  it("**con un conto scelto, coincide con quello che muove il saldo**", () => {
    const conto: ContoPersonale = {
      id: "b", nome: "Libretto", tipo: "deposito",
      saldoRiferimento: 5_000, dataRiferimento: "2025-12-31", professionale: false,
    };
    const suoi = filtraRegistro(REGISTRO, { ...FILTRO_VUOTO(2026), contoId: "b" });
    const t = totaliRegistro(suoi, "b");
    expect(t.effettoSulConto).toBe(350);
    expect(saldoConto(conto, REGISTRO)).toBe(5_000 + 350);
  });
});
