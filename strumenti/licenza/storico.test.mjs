import { describe, expect, it } from "vitest";
import { leggiRegistro, normalizzaEmail, raccontaStorico, storicoDi } from "./storico.mjs";

const riga = (email, emessaIl, scadenza) =>
  JSON.stringify({ email, scadenza, emessaIl, chiave: "FLW1.x.y" });

const REGISTRO = [
  riga("mario@example.com", "2026-09-12", "2027-09-12"),
  riga("altro@example.com", "2026-10-01", "2027-10-01"),
  riga("Mario@Example.com", "2027-09-14", "2028-09-14"),
].join("\n");

describe("normalizzaEmail", () => {
  it("confronta senza guardare maiuscole e spazi", () => {
    expect(normalizzaEmail("  Mario@Example.COM ")).toBe("mario@example.com");
  });

  it("regge anche quello che non è una stringa", () => {
    expect(normalizzaEmail(undefined)).toBe("");
    expect(normalizzaEmail(null)).toBe("");
  });
});

describe("leggiRegistro", () => {
  it("legge le righe buone", () => {
    const { righe, illeggibili } = leggiRegistro(REGISTRO);
    expect(righe).toHaveLength(3);
    expect(illeggibili).toBe(0);
  });

  it("salta le righe vuote senza contarle fra le illeggibili", () => {
    const { righe, illeggibili } = leggiRegistro(`${REGISTRO}\n\n\n`);
    expect(righe).toHaveLength(3);
    expect(illeggibili).toBe(0);
  });

  /*
    Una riga troncata non deve far perdere tutte le altre: sarebbe un cliente
    che risulta nuovo per colpa di un disco pieno di due anni fa.
  */
  it("una riga troncata non manda in pezzi la lettura, e viene contata", () => {
    const { righe, illeggibili } = leggiRegistro(`${REGISTRO}\n{"email":"rotta@exa`);
    expect(righe).toHaveLength(3);
    expect(illeggibili).toBe(1);
  });

  it("una riga senza email non è una licenza", () => {
    const { righe, illeggibili } = leggiRegistro('{"scadenza":"2027-01-01"}');
    expect(righe).toHaveLength(0);
    expect(illeggibili).toBe(1);
  });

  it("un registro che non c'è è un registro vuoto", () => {
    expect(leggiRegistro("").righe).toHaveLength(0);
    expect(leggiRegistro(undefined).righe).toHaveLength(0);
  });
});

describe("storicoDi", () => {
  const { righe } = leggiRegistro(REGISTRO);

  /*
    Il caso che costa: lo stesso cliente scritto con la maiuscola. Senza
    questo confronto risulterebbe un primo acquisto, e pagherebbe il prezzo
    pieno un anno dopo averlo già pagato.
  */
  it("trova lo stesso cliente anche scritto con un'altra grafia", () => {
    expect(storicoDi(righe, "MARIO@example.com")).toHaveLength(2);
  });

  it("non confonde due clienti diversi", () => {
    expect(storicoDi(righe, "altro@example.com")).toHaveLength(1);
  });

  it("chi non c'è non ha storia", () => {
    expect(storicoDi(righe, "nessuno@example.com")).toHaveLength(0);
  });

  it("le restituisce dalla più vecchia alla più recente", () => {
    const s = storicoDi(righe, "mario@example.com");
    expect(s.map((x) => x.emessaIl)).toEqual(["2026-09-12", "2027-09-14"]);
  });

  it("l'ordine non dipende da come sono scritte nel file", () => {
    const alContrario = leggiRegistro(REGISTRO.split("\n").reverse().join("\n")).righe;
    const s = storicoDi(alContrario, "mario@example.com");
    expect(s.map((x) => x.emessaIl)).toEqual(["2026-09-12", "2027-09-14"]);
  });
});

describe("raccontaStorico", () => {
  const { righe } = leggiRegistro(REGISTRO);

  it("il primo acquisto si dice tale", () => {
    const r = raccontaStorico(storicoDi(righe, "nuovo@example.com"));
    expect(r.nuovo).toBe(true);
    expect(r.numeroLicenza).toBe(1);
    expect(r.rinnovi).toBe(0);
    expect(r.righe[0]).toContain("Primo acquisto");
  });

  /*
    I due numeri, e perché ci sono tutti e due.

    «Rinnovo n. 3» non vuol dire niente da solo: fra la terza licenza e il
    terzo rinnovo c'è una licenza di differenza, cioè il prezzo sbagliato.
    Questo test fissa che si dicano entrambi, non uno.
  */
  it("dice la licenza e i rinnovi, che non sono lo stesso numero", () => {
    const r = raccontaStorico(storicoDi(righe, "mario@example.com"));
    expect(r.numeroLicenza).toBe(3);
    expect(r.rinnovi).toBe(2);
    expect(r.righe[0]).toContain("3ª licenza");
    expect(r.righe[0]).toContain("2 rinnovi");
  });

  it("al primo rinnovo il singolare", () => {
    const r = raccontaStorico(storicoDi(righe, "altro@example.com"));
    expect(r.numeroLicenza).toBe(2);
    expect(r.righe[0]).toContain("1 rinnovo");
    expect(r.righe[0]).not.toContain("rinnovi");
  });

  it("elenca le precedenti con le loro date", () => {
    const r = raccontaStorico(storicoDi(righe, "mario@example.com"));
    expect(r.righe.join("\n")).toContain("emessa il 2026-09-12, valida fino al 2027-09-12");
  });

  it("segnala quando lo stesso indirizzo è scritto in più modi", () => {
    const r = raccontaStorico(storicoDi(righe, "mario@example.com"));
    expect(r.righe.join("\n")).toContain("2 modi diversi");
  });

  it("e non lo segnala quando la grafia è una sola", () => {
    const r = raccontaStorico(storicoDi(righe, "altro@example.com"));
    expect(r.righe.join("\n")).not.toContain("modi diversi");
  });
});
