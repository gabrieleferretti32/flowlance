import { describe, expect, it } from "vitest";
import {
  contiConfondibili,
  contiInOrdine,
  contoPropostoPerFile,
  distintiviDeiConti,
  movimentiDaSpostare,
} from "./conti";
import type { ContoPersonale, MovimentoPf } from "./tipi";

/**
 * L'elenco dei conti, dopo un import finito sul conto sbagliato.
 *
 * I sei conti qui sotto sono quelli veri del caso: nell'ordine in cui
 * l'archivio li restituiva — cioè quello dei loro identificatori — e con i due
 * «Fineco» che quell'ordine separava mentre metteva «Fineco (Tasse)» appena
 * sopra «Intesa Sanpaolo», che era il conto giusto.
 */
const conto = (id: string, nome: string, saldo = 0): ContoPersonale => ({
  id,
  nome,
  tipo: "corrente",
  saldoRiferimento: saldo,
  dataRiferimento: "2026-08-31",
  professionale: false,
});

const COME_ARRIVAVANO = [
  conto("3434f294", "Trade Republic", 1_000),
  conto("641cbab9", "Fineco", 4_000),
  conto("a24e9a7b", "Revolut", 200),
  conto("e6607f98", "Mediolanum", 700),
  conto("ec5a9373", "Fineco (Tasse)", 9_000),
  conto("fb3e11d3", "Intesa Sanpaolo", 3_000),
];

describe("l'ordine dei conti", () => {
  it("**è alfabetico**, e non quello con cui arrivano dall'archivio", () => {
    expect(contiInOrdine(COME_ARRIVAVANO).map((c) => c.nome)).toEqual([
      "Fineco",
      "Fineco (Tasse)",
      "Intesa Sanpaolo",
      "Mediolanum",
      "Revolut",
      "Trade Republic",
    ]);
  });

  it("i numeri si leggono come numeri: «Conto 2» prima di «Conto 10»", () => {
    const nomi = ["Conto 10", "Conto 2", "Conto 1"].map((n, i) => conto(`c${i}`, n));
    expect(contiInOrdine(nomi).map((c) => c.nome)).toEqual(["Conto 1", "Conto 2", "Conto 10"]);
  });

  it("non tocca l'elenco che gli viene dato", () => {
    const originale = [...COME_ARRIVAVANO];
    contiInOrdine(COME_ARRIVAVANO);
    expect(COME_ARRIVAVANO).toEqual(originale);
  });
});

describe("i conti che si possono scambiare", () => {
  it("**un nome che comincia come un altro**", () => {
    const confondibili = contiConfondibili(COME_ARRIVAVANO);
    expect(confondibili.has("641cbab9")).toBe(true); // Fineco
    expect(confondibili.has("ec5a9373")).toBe(true); // Fineco (Tasse)
  });

  it("e la misura vede la differenza: gli altri quattro non lo sono", () => {
    const confondibili = contiConfondibili(COME_ARRIVAVANO);
    for (const id of ["3434f294", "a24e9a7b", "e6607f98", "fb3e11d3"]) {
      expect(confondibili.has(id), id).toBe(false);
    }
  });

  it("anche la stessa prima parola conta: «Conto Mario» e «Conto Anna»", () => {
    const due = [conto("a", "Conto Mario"), conto("b", "Conto Anna"), conto("c", "Postepay")];
    const confondibili = contiConfondibili(due);
    expect([...confondibili].sort()).toEqual(["a", "b"]);
  });

  it("una parola corta in comune non basta: «Il rosso» e «Il verde» si leggono", () => {
    const due = [conto("a", "Il rosso"), conto("b", "Il verde")];
    expect(contiConfondibili(due).size).toBe(0);
  });

  it("maiuscole e spazi non fanno differenza", () => {
    const due = [conto("a", "  FINECO "), conto("b", "Fineco (Tasse)")];
    expect(contiConfondibili(due).size).toBe(2);
  });
});

describe("il distintivo accanto al nome", () => {
  const movimenti: MovimentoPf[] = [
    {
      id: "m1", data: "2026-09-10", tipo: "spesa", categoriaId: "spesa",
      contoId: "641cbab9", importo: 100, descrizione: "",
    },
  ];

  it("**è il saldo, e solo sui conti che si somigliano**", () => {
    const distintivi = distintiviDeiConti(COME_ARRIVAVANO, movimenti);
    /* Lo spazio prima del simbolo è unificatore: lo mette il formatter. */
    expect(distintivi.get("641cbab9")).toBe("3.900,00\u00a0€"); // Fineco: 4.000 − 100
    expect(distintivi.get("ec5a9373")).toBe("9.000,00\u00a0€"); // Fineco (Tasse)
    expect(distintivi.get("fb3e11d3")).toBeNull(); // Intesa Sanpaolo: si legge da sé
    expect(distintivi.get("3434f294")).toBeNull();
  });

  it("c'è una voce per ogni conto, anche quando non serve", () => {
    expect(distintiviDeiConti(COME_ARRIVAVANO, []).size).toBe(COME_ARRIVAVANO.length);
  });
});

describe("il conto proposto per un file", () => {
  const importazioni = [
    { data: "2026-09-23T07:05:24Z", file: "lista_completa.xlsx", contoId: "ec5a9373" },
    { data: "2026-09-23T08:09:59Z", file: "lista_completa.xlsx", contoId: "fb3e11d3" },
    { data: "2026-08-02T10:00:00Z", file: "trade.xlsx · revolut.csv", contoId: "" },
  ];

  it("**è l'ultimo usato per un file con quel nome**, non il primo", () => {
    /*
      È il caso vero: lo stesso file importato due volte, la prima sul conto
      sbagliato. Proporre il primo import riproporrebbe l'errore.
    */
    expect(contoPropostoPerFile("lista_completa.xlsx", importazioni, COME_ARRIVAVANO)).toBe(
      "fb3e11d3",
    );
  });

  it("**un file mai visto non ha proposta**: meglio nessuna che una su sei", () => {
    expect(contoPropostoPerFile("banca-nuova.csv", importazioni, COME_ARRIVAVANO)).toBe("");
  });

  it("un import di più file su più conti non propone niente", () => {
    expect(contoPropostoPerFile("trade.xlsx", importazioni, COME_ARRIVAVANO)).toBe("");
  });

  it("ma un import di più file su un conto solo vale per ognuno dei suoi nomi", () => {
    const con = [{ data: "2026-08-02T10:00:00Z", file: "a.csv · b.csv", contoId: "a24e9a7b" }];
    expect(contoPropostoPerFile("b.csv", con, COME_ARRIVAVANO)).toBe("a24e9a7b");
  });

  it("un conto cancellato non si propone", () => {
    const senzaIntesa = COME_ARRIVAVANO.filter((c) => c.id !== "fb3e11d3");
    expect(contoPropostoPerFile("lista_completa.xlsx", importazioni, senzaIntesa)).toBe("ec5a9373");
  });
});

describe("spostare i movimenti di un import su un altro conto", () => {
  const mov = (id: string, extra: Partial<MovimentoPf> = {}): MovimentoPf => ({
    id,
    data: "2026-09-10",
    tipo: "spesa",
    categoriaId: "spesa",
    contoId: "ec5a9373",
    importo: 10,
    descrizione: "",
    importId: "imp-1",
    ...extra,
  });

  it("**sposta i suoi, e solo i suoi**", () => {
    const tutti = [
      mov("a"),
      mov("b"),
      mov("c", { importId: "imp-2" }),
      mov("d", { contoId: "a24e9a7b" }),
      mov("e", { importId: undefined }),
    ];
    const { spostati, bloccati } = movimentiDaSpostare(tutti, "imp-1", "ec5a9373", "fb3e11d3");
    expect(spostati.map((m) => m.id)).toEqual(["a", "b"]);
    expect(spostati.every((m) => m.contoId === "fb3e11d3")).toBe(true);
    expect(bloccati).toEqual([]);
  });

  it("**un giroconto che ha già quel conto dall'altro capo non si sposta**", () => {
    /*
      Diventerebbe un movimento che esce da un conto ed entra nello stesso: il
      saldo lo conterebbe due volte con segni opposti e l'elenco mostrerebbe
      «Intesa → Intesa». Resta dov'è, e la schermata lo dice.
    */
    const tutti = [
      mov("g", { tipo: "giroconto", categoriaId: "", contoDestinazioneId: "fb3e11d3" }),
      mov("h", { tipo: "giroconto", categoriaId: "", contoDestinazioneId: "a24e9a7b" }),
    ];
    const { spostati, bloccati } = movimentiDaSpostare(tutti, "imp-1", "ec5a9373", "fb3e11d3");
    expect(bloccati.map((m) => m.id)).toEqual(["g"]);
    expect(spostati.map((m) => m.id)).toEqual(["h"]);
  });

  it("non modifica i movimenti che gli si passano", () => {
    const tutti = [mov("a")];
    movimentiDaSpostare(tutti, "imp-1", "ec5a9373", "fb3e11d3");
    expect(tutti[0].contoId).toBe("ec5a9373");
  });
});
