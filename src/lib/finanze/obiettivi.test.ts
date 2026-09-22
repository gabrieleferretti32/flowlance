import { describe, expect, it } from "vitest";
import { fabbisognoMensile, inOrdine, statoObiettivi } from "./obiettivi";
import type { ContoPersonale, MovimentoPf, ObiettivoPf } from "./tipi";

/**
 * Le mete di risparmio, e i tre modi in cui una barra di avanzamento mente:
 * misurando un numero scritto a mano, misurando due volte gli stessi euro, e
 * riempiendosi quando non c'è niente da misurare.
 */

const OGGI = "2026-09-22";

const conto: ContoPersonale = {
  id: "deposito",
  nome: "Deposito",
  tipo: "deposito",
  saldoRiferimento: 2_000,
  dataRiferimento: "2026-09-01",
  professionale: false,
};

const mov = (
  categoriaId: string,
  data: string,
  importo: number,
  tipo: MovimentoPf["tipo"] = "risparmio",
  contoId = "corrente",
): MovimentoPf => ({
  id: `${categoriaId}-${data}-${importo}`,
  data,
  tipo,
  categoriaId,
  contoId,
  importo,
  descrizione: "",
});

const meta = (extra: Partial<ObiettivoPf> = {}): ObiettivoPf => ({
  id: "m1",
  nome: "Fondo emergenza",
  obiettivo: 6_000,
  entro: "2027-06-30",
  fonte: "nessuna",
  fonteId: null,
  dal: "2026-01-01",
  ...extra,
});

const stato = (obiettivi: ObiettivoPf[], movimenti: MovimentoPf[] = []) =>
  statoObiettivi({ obiettivi, conti: [conto], movimenti, oggi: OGGI });

describe("da dove arriva l'avanzamento", () => {
  it("dal saldo del conto, ancorato come lo vede Conti e patrimonio", () => {
    const [s] = stato(
      [meta({ fonte: "conto", fonteId: "deposito" })],
      [mov("risparmio", "2026-09-10", 500, "entrata", "deposito")],
    );
    expect(s.accumulato).toBe(2_500);
    expect(s.mancano).toBe(3_500);
  });

  it("dalla somma dei movimenti di una categoria, **da `dal` in poi**", () => {
    const [s] = stato(
      [meta({ fonte: "categoria", fonteId: "fondo", dal: "2026-06-01" })],
      [
        mov("fondo", "2026-05-31", 900), // prima: già speso per altro
        mov("fondo", "2026-06-01", 300), // il giorno stesso conta
        mov("fondo", "2026-08-10", 200),
        mov("altro", "2026-08-11", 400), // un'altra categoria
      ],
    );
    expect(s.accumulato).toBe(500);
  });

  it("i giroconti no: spostare soldi fra conti propri non è metterli via", () => {
    const [s] = stato(
      [meta({ fonte: "categoria", fonteId: "fondo" })],
      [mov("fondo", "2026-08-10", 200), mov("fondo", "2026-08-11", 1_000, "giroconto")],
    );
    expect(s.accumulato).toBe(200);
  });

  it("e quello che succede dopo oggi non è ancora successo", () => {
    const [s] = stato(
      [meta({ fonte: "categoria", fonteId: "fondo" })],
      [mov("fondo", "2026-12-01", 5_000)],
    );
    expect(s.accumulato).toBe(0);
  });
});

describe("**senza fonte non c'è avanzamento, e si dice**", () => {
  it("accumulato è `null`, non zero: sono due frasi diverse", () => {
    const [s] = stato([meta()]);
    expect(s.accumulato).toBeNull();
    expect(s.quota).toBeNull();
    expect(s.mancano).toBeNull();
    expect(s.alMese).toBeNull();
    expect(s.fonteMancante).toBe(false);
  });

  it("e la misura vede la differenza: con una fonte i numeri ci sono", () => {
    const [s] = stato([meta({ fonte: "conto", fonteId: "deposito" })]);
    expect(s.accumulato).toBe(2_000);
    expect(s.quota).toBe(0.33);
  });

  it("una fonte che punta a un conto cancellato si dichiara mancante", () => {
    const [s] = stato([meta({ fonte: "conto", fonteId: "sparito" })]);
    expect(s.accumulato).toBeNull();
    expect(s.fonteMancante).toBe(true);
  });
});

describe("**due mete sulla stessa fonte contano gli stessi euro due volte**", () => {
  const due = stato([
    meta({ id: "a", nome: "Vacanza", fonte: "conto", fonteId: "deposito" }),
    meta({ id: "b", nome: "Emergenza", fonte: "conto", fonteId: "deposito" }),
  ]);

  it("l'avanzamento è lo stesso per tutte e due, e il modulo lo marca", () => {
    expect(due.map((s) => s.accumulato)).toEqual([2_000, 2_000]);
    expect(due.every((s) => s.condivisa)).toBe(true);
  });

  it("una sola meta su quella fonte non è condivisa", () => {
    const [s] = stato([meta({ fonte: "conto", fonteId: "deposito" })]);
    expect(s.condivisa).toBe(false);
  });

  it("due mete senza fonte non condividono niente: non misurano niente", () => {
    const senza = stato([meta({ id: "a" }), meta({ id: "b" })]);
    expect(senza.every((s) => s.condivisa)).toBe(false);
  });
});

describe("quanto al mese", () => {
  it("si calcola su quello che manca, non sull'obiettivo intero", () => {
    // Mancano 4.000 e i mesi fino a giugno 2027 sono dieci.
    const [s] = stato([meta({ obiettivo: 6_000, fonte: "conto", fonteId: "deposito" })]);
    expect(s.mesiMancanti).toBe(10);
    expect(s.alMese).toBe(400);
  });

  it("senza data non vuol dire niente, e resta `null`", () => {
    const [s] = stato([meta({ entro: null, fonte: "conto", fonteId: "deposito" })]);
    expect(s.mesiMancanti).toBeNull();
    expect(s.alMese).toBeNull();
    expect(s.scaduto).toBe(false);
  });

  it("**a data passata serve tutto adesso, non diviso un mese**", () => {
    const [s] = stato([
      meta({ entro: "2026-06-30", obiettivo: 6_000, fonte: "conto", fonteId: "deposito" }),
    ]);
    expect(s.scaduto).toBe(true);
    expect(s.mesiMancanti).toBe(0);
    expect(s.alMese).toBe(4_000);
  });

  it("raggiunta non chiede più niente, nemmeno se la data è passata", () => {
    const [s] = stato([
      meta({ entro: "2026-06-30", obiettivo: 1_500, fonte: "conto", fonteId: "deposito" }),
    ]);
    expect(s.raggiunto).toBe(true);
    expect(s.scaduto).toBe(false);
    expect(s.alMese).toBeNull();
    expect(s.mancano).toBe(0);
  });

  it("l'avanzamento può superare il 100%, e non si taglia", () => {
    const [s] = stato([meta({ obiettivo: 1_000, fonte: "conto", fonteId: "deposito" })]);
    expect(s.quota).toBe(2);
  });
});

describe("il fabbisogno di tutte le mete", () => {
  it("somma solo quelle che una cifra ce l'hanno, e conta le altre", () => {
    const stati = stato([
      meta({ id: "a", obiettivo: 6_000, fonte: "conto", fonteId: "deposito" }), // 400 al mese
      meta({ id: "b", obiettivo: 12_000, entro: null, fonte: "conto", fonteId: "deposito" }), // senza data
      meta({ id: "c", obiettivo: 900 }), // senza fonte
    ]);
    const f = fabbisognoMensile(stati);
    expect(f.totale).toBe(400);
    expect(f.contate).toBe(1);
    expect(f.escluse).toBe(2);
  });

  it("le mete raggiunte non gonfiano il conto delle escluse", () => {
    const stati = stato([
      meta({ id: "a", obiettivo: 1_000, fonte: "conto", fonteId: "deposito" }),
    ]);
    expect(fabbisognoMensile(stati)).toEqual({ totale: 0, contate: 0, escluse: 0 });
  });
});

describe("l'ordine dell'elenco", () => {
  const con = (righe: Partial<ObiettivoPf>[]) =>
    inOrdine(stato(righe.map((r, i) => meta({ id: `m${i}`, ...r }))))
      .map((s) => s.obiettivo.nome);

  it("prima quelle da finire, poi quelle raggiunte", () => {
    expect(
      con([
        { nome: "Finita", obiettivo: 1_000, fonte: "conto", fonteId: "deposito" },
        { nome: "Da finire", obiettivo: 9_000, fonte: "conto", fonteId: "deposito" },
      ]),
    ).toEqual(["Da finire", "Finita"]);
  });

  it("dentro il gruppo, prima quella che scade prima", () => {
    expect(
      con([
        { nome: "Dopo", entro: "2028-01-31" },
        { nome: "Prima", entro: "2026-12-31" },
      ]),
    ).toEqual(["Prima", "Dopo"]);
  });

  it("**le mete senza data vanno in fondo, non in cima**", () => {
    expect(
      con([
        { nome: "Senza fretta", entro: null },
        { nome: "Con una data", entro: "2027-12-31" },
      ]),
    ).toEqual(["Con una data", "Senza fretta"]);
  });

  it("a parità di data decide il nome, e non l'ordine di inserimento", () => {
    expect(
      con([
        { nome: "Zaino", entro: "2027-01-31" },
        { nome: "Auto", entro: "2027-01-31" },
      ]),
    ).toEqual(["Auto", "Zaino"]);
  });
});
