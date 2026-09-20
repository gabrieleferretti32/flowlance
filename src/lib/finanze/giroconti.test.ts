import { describe, expect, it } from "vitest";
import { abbinaGiroconti } from "./giroconti";
import { saldoTotale } from "./saldo";
import type { ContoPersonale, MovimentoPf } from "./tipi";

const mov = (p: Partial<MovimentoPf> & { id: string; data: string; importo: number }): MovimentoPf => ({
  tipo: "spesa", categoriaId: "c", contoId: "a", descrizione: "", ...p,
});
const TRACCIATI = ["a", "b"];

describe("le due metà di uno spostamento diventano un movimento solo", () => {
  it("**stesso importo, conti diversi, tre giorni: una coppia**", () => {
    const esito = abbinaGiroconti([
      mov({ id: "1", data: "2026-09-03", importo: 1_000, contoId: "a" }),
      mov({ id: "2", data: "2026-09-04", importo: 1_000, contoId: "b", tipo: "entrata" }),
    ], TRACCIATI);
    expect(esito.abbinati).toBe(1);
    expect(esito.movimenti).toHaveLength(1);
    expect(esito.movimenti[0]).toMatchObject({
      tipo: "giroconto", contoId: "a", contoDestinazioneId: "b", importo: 1_000,
    });
  });

  it("il giroconto tiene la data dell'uscita, non dell'accredito", () => {
    const esito = abbinaGiroconti([
      mov({ id: "1", data: "2026-09-30", importo: 500, contoId: "a" }),
      mov({ id: "2", data: "2026-10-02", importo: 500, contoId: "b", tipo: "entrata" }),
    ], TRACCIATI);
    expect(esito.movimenti[0].data).toBe("2026-09-30");
  });

  it("e il saldo totale resta quello di prima", () => {
    const conti: ContoPersonale[] = [
      { id: "a", nome: "a", tipo: "corrente", saldoRiferimento: 2_000, dataRiferimento: "2026-09-01", professionale: false },
      { id: "b", nome: "b", tipo: "deposito", saldoRiferimento: 0, dataRiferimento: "2026-09-01", professionale: false },
    ];
    const due = [
      mov({ id: "1", data: "2026-09-03", importo: 1_000, contoId: "a" }),
      mov({ id: "2", data: "2026-09-04", importo: 1_000, contoId: "b", tipo: "entrata" }),
    ];
    expect(saldoTotale(conti, due)).toBe(2_000);
    expect(saldoTotale(conti, abbinaGiroconti(due, TRACCIATI).movimenti)).toBe(2_000);
  });
});

describe("quello che NON deve diventare un giroconto", () => {
  it("oltre i tre giorni no: due movimenti veri non si fanno sparire", () => {
    const esito = abbinaGiroconti([
      mov({ id: "1", data: "2026-09-01", importo: 1_000, contoId: "a" }),
      mov({ id: "2", data: "2026-09-06", importo: 1_000, contoId: "b", tipo: "entrata" }),
    ], TRACCIATI);
    expect(esito.abbinati).toBe(0);
    expect(esito.movimenti).toHaveLength(2);
  });

  it("importi diversi no", () => {
    const esito = abbinaGiroconti([
      mov({ id: "1", data: "2026-09-03", importo: 1_000, contoId: "a" }),
      mov({ id: "2", data: "2026-09-03", importo: 999, contoId: "b", tipo: "entrata" }),
    ], TRACCIATI);
    expect(esito.abbinati).toBe(0);
  });

  it("**lo stesso conto no**: un prelievo e un versamento sullo stesso conto sono due fatti", () => {
    const esito = abbinaGiroconti([
      mov({ id: "1", data: "2026-09-03", importo: 200, contoId: "a" }),
      mov({ id: "2", data: "2026-09-03", importo: 200, contoId: "a", tipo: "entrata" }),
    ], TRACCIATI);
    expect(esito.abbinati).toBe(0);
  });

  it("**un conto non tracciato no**: lo stipendio che entra non è un giroconto", () => {
    const esito = abbinaGiroconti([
      mov({ id: "1", data: "2026-09-03", importo: 1_500, contoId: "a" }),
      mov({ id: "2", data: "2026-09-03", importo: 1_500, contoId: "ignoto", tipo: "entrata" }),
    ], TRACCIATI);
    expect(esito.abbinati).toBe(0);
    expect(esito.movimenti).toHaveLength(2);
  });

  it("tre movimenti dello stesso importo fanno una coppia sola, e il terzo resta", () => {
    const esito = abbinaGiroconti([
      mov({ id: "1", data: "2026-09-03", importo: 100, contoId: "a" }),
      mov({ id: "2", data: "2026-09-03", importo: 100, contoId: "b", tipo: "entrata" }),
      mov({ id: "3", data: "2026-09-03", importo: 100, contoId: "b", tipo: "entrata" }),
    ], TRACCIATI);
    expect(esito.abbinati).toBe(1);
    expect(esito.movimenti).toHaveLength(2);
    expect(esito.movimenti.filter((m) => m.tipo === "entrata")).toHaveLength(1);
  });
});

describe("lo stesso ingresso dà lo stesso esito", () => {
  it("l'ordine dei movimenti non cambia l'abbinamento", () => {
    const righe = [
      mov({ id: "z", data: "2026-09-03", importo: 400, contoId: "a" }),
      mov({ id: "m", data: "2026-09-04", importo: 400, contoId: "b", tipo: "entrata" }),
      mov({ id: "c", data: "2026-09-05", importo: 77, contoId: "a" }),
    ];
    const diritto = abbinaGiroconti(righe, TRACCIATI);
    const rovescio = abbinaGiroconti([...righe].reverse(), TRACCIATI);
    expect(rovescio.abbinati).toBe(diritto.abbinati);
    expect(rovescio.movimenti.map((m) => m.id).sort()).toEqual(
      diritto.movimenti.map((m) => m.id).sort(),
    );
  });
});
