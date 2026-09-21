import { describe, expect, it } from "vitest";
import { limiteEffettivo, tettoDalConto } from "./tetto";

describe("il tetto dato dal conto", () => {
  it("è il saldo meno cuscinetto, impegni e fisco", () => {
    const t = tettoDalConto({
      saldoConti: 10_000,
      cuscinetto: 1_000,
      impegniDelMese: 1_200,
      fiscoNonVersato: 5_000,
    });
    expect(t.tetto).toBe(2_800);
  });

  /**
   * **I soldi del fisco sono sul conto e non sono tuoi.**
   *
   * È la sottrazione che il brief non aveva. Senza, il tetto è più alto del
   * vero proprio nei mesi in cui il fondo delle tasse è più pieno — cioè
   * quelli in cui uno è più tentato di fidarsi del saldo.
   */
  it("**senza la sottrazione del fisco il tetto sarebbe più alto di tutto il fondo**", () => {
    const con = tettoDalConto({ saldoConti: 10_000, cuscinetto: 0, impegniDelMese: 0, fiscoNonVersato: 7_680.08 });
    const senza = tettoDalConto({ saldoConti: 10_000, cuscinetto: 0, impegniDelMese: 0, fiscoNonVersato: 0 });
    expect(senza.tetto - con.tetto).toBe(7_680.08);
    expect(con.tetto).toBe(2_319.92);
  });

  it("può essere negativo, e non si arrotonda a zero", () => {
    const t = tettoDalConto({ saldoConti: 500, cuscinetto: 0, impegniDelMese: 300, fiscoNonVersato: 900 });
    expect(t.tetto).toBe(-700);
  });

  it("un cuscinetto o un impegno negativo non regala niente", () => {
    const t = tettoDalConto({ saldoConti: 1_000, cuscinetto: -500, impegniDelMese: -200, fiscoNonVersato: 0 });
    expect(t.tetto).toBe(1_000);
  });

  it("le tre sottrazioni restano visibili una per una", () => {
    const t = tettoDalConto({ saldoConti: 3_000, cuscinetto: 500, impegniDelMese: 400, fiscoNonVersato: 100 });
    expect([t.saldoConti, t.cuscinetto, t.impegniDelMese, t.fiscoNonVersato]).toEqual([
      3_000, 500, 400, 100,
    ]);
  });

  it("i centesimi si arrotondano come il foglio", () => {
    const t = tettoDalConto({ saldoConti: 100.005, cuscinetto: 0, impegniDelMese: 0, fiscoNonVersato: 0 });
    expect(t.tetto).toBe(100.01);
  });
});

/**
 * **Va detto quale dei due ha deciso.**
 *
 * Un numero che scende senza dire perché si legge come un errore dell'app, e
 * il mese dopo non si guarda più. «Te lo impone il conto» è
 * un'informazione: vuol dire che il mese permetterebbe di più, e che il
 * problema è la giacenza.
 */
describe("il limite vero è il più basso dei due", () => {
  it("quando il conto stringe, lo dice il conto", () => {
    const l = limiteEffettivo(900, 400);
    expect(l.limite).toBe(400);
    expect(l.vincolo).toBe("conto");
    expect(l.differenza).toBe(500);
  });

  it("quando stringe il mese, lo dice il mese", () => {
    const l = limiteEffettivo(300, 4_000);
    expect(l.limite).toBe(300);
    expect(l.vincolo).toBe("mese");
  });

  it("**a parità vince il mese: un allarme senza causa è peggio di nessun allarme**", () => {
    expect(limiteEffettivo(500, 500).vincolo).toBe("mese");
  });

  it("i due numeri restano tutti e due a disposizione", () => {
    const l = limiteEffettivo(900, 400);
    expect([l.dalMese, l.dalConto]).toEqual([900, 400]);
  });

  it("e con il conto in negativo il limite è negativo, non zero", () => {
    expect(limiteEffettivo(900, -120).limite).toBe(-120);
  });
});
