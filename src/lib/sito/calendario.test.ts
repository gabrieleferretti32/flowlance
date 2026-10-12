import { describe, expect, it } from "vitest";
import { bisestile, giorniDelMese, piuGiorni, piuMesi, scaduto, scadutoAMesi } from "./calendario";

describe("piuGiorni", () => {
  it("dentro il mese", () => {
    expect(piuGiorni("2026-10-01", 30)).toBe("2026-10-31");
  });

  it("attraversa il mese", () => {
    expect(piuGiorni("2026-11-30", 30)).toBe("2026-12-30");
    expect(piuGiorni("2026-10-15", 30)).toBe("2026-11-14");
  });

  it("attraversa l'anno", () => {
    expect(piuGiorni("2026-12-20", 30)).toBe("2027-01-19");
  });

  it("attraversa febbraio, bisestile e no", () => {
    expect(piuGiorni("2028-02-01", 30)).toBe("2028-03-02");
    expect(piuGiorni("2027-02-01", 30)).toBe("2027-03-03");
  });

  it("zero giorni è lo stesso giorno", () => {
    expect(piuGiorni("2026-10-12", 0)).toBe("2026-10-12");
  });

  it("regge un anno intero", () => {
    expect(piuGiorni("2026-01-01", 365)).toBe("2027-01-01");
    // Il 2028 è bisestile: 366 giorni dal 1° gennaio tornano al 1° gennaio.
    expect(piuGiorni("2028-01-01", 366)).toBe("2029-01-01");
  });
});

describe("piuMesi", () => {
  it("il mese dopo, stesso giorno", () => {
    expect(piuMesi("2026-10-12", 1)).toBe("2026-11-12");
    expect(piuMesi("2026-10-12", 12)).toBe("2027-10-12");
    expect(piuMesi("2026-10-12", 24)).toBe("2028-10-12");
  });

  /*
    Il 31 non esiste in tutti i mesi: si schiaccia sulla fine. Sulla
    conservazione vuol dire cancellare un giorno prima invece che un giorno
    dopo, che è il verso prudente.
  */
  it("schiaccia il giorno sulla fine del mese", () => {
    expect(piuMesi("2026-01-31", 1)).toBe("2026-02-28");
    expect(piuMesi("2028-01-31", 1)).toBe("2028-02-29");
    expect(piuMesi("2026-03-31", 1)).toBe("2026-04-30");
  });

  it("il 29 febbraio più dodici mesi finisce sul 28", () => {
    expect(piuMesi("2028-02-29", 12)).toBe("2029-02-28");
  });

  it("attraversa l'anno", () => {
    expect(piuMesi("2026-11-15", 3)).toBe("2027-02-15");
  });
});

/*
  ─────────────────────────────────────────────────────────────────────────
  Il cuore: il giorno giusto e non il giorno prima
  ─────────────────────────────────────────────────────────────────────────

  «Entro 30 giorni» vuol dire che al trentesimo la cosa è fatta. Un `>` al
  posto di `>=` la farebbe al trentunesimo — un giorno di ritardo su ogni
  termine, sempre, e invisibile.
*/
describe("scaduto", () => {
  const RICHIESTA = "2026-10-01";

  it("il giorno prima: non è scaduto", () => {
    expect(scaduto(RICHIESTA, 30, "2026-10-30")).toBe(false);
  });

  it("il giorno stesso: è scaduto", () => {
    expect(scaduto(RICHIESTA, 30, "2026-10-31")).toBe(true);
  });

  it("il giorno dopo: resta scaduto", () => {
    expect(scaduto(RICHIESTA, 30, "2026-11-01")).toBe(true);
  });

  it("molto prima: no", () => {
    expect(scaduto(RICHIESTA, 30, "2026-10-01")).toBe(false);
    expect(scaduto(RICHIESTA, 30, "2026-10-02")).toBe(false);
  });

  it("ogni giorno dei trenta, uno per uno", () => {
    let giorno = RICHIESTA;
    for (let i = 0; i < 30; i++) {
      expect(scaduto(RICHIESTA, 30, giorno), `al giorno +${i} non deve essere scaduto`).toBe(false);
      giorno = piuGiorni(giorno, 1);
    }
    expect(scaduto(RICHIESTA, 30, giorno)).toBe(true);
  });
});

describe("scadutoAMesi", () => {
  it("il giorno prima dei dodici mesi: no", () => {
    expect(scadutoAMesi("2026-10-12", 12, "2027-10-11")).toBe(false);
  });

  it("il giorno dei dodici mesi: sì", () => {
    expect(scadutoAMesi("2026-10-12", 12, "2027-10-12")).toBe(true);
  });

  it("ventiquattro mesi, lo stesso", () => {
    expect(scadutoAMesi("2026-10-12", 24, "2028-10-11")).toBe(false);
    expect(scadutoAMesi("2026-10-12", 24, "2028-10-12")).toBe(true);
  });
});

describe("il calendario, nelle sue parti", () => {
  it("gli anni bisestili", () => {
    expect(bisestile(2028)).toBe(true);
    expect(bisestile(2027)).toBe(false);
    expect(bisestile(2100)).toBe(false);
    expect(bisestile(2000)).toBe(true);
  });

  it("i giorni dei mesi", () => {
    expect(giorniDelMese(2027, 2)).toBe(28);
    expect(giorniDelMese(2028, 2)).toBe(29);
    expect(giorniDelMese(2026, 4)).toBe(30);
    expect(giorniDelMese(2026, 12)).toBe(31);
  });
});
