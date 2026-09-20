import { describe, expect, it } from "vitest";
import { CATEGORIA_NON_DEFINITO, CATEGORIE_INIZIALI } from "./categorie";
import { tabellaLimite } from "./limite";
import type { MovimentoPf } from "./tipi";

describe("**le categorie del fisco nascono già coperte dall'accantonamento**", () => {
  it("Tasse, INPS e F24 hanno il flag acceso", () => {
    for (const id of ["tasse", "inps", "f24"]) {
      const c = CATEGORIE_INIZIALI.find((x) => x.id === id);
      expect(c, id).toBeDefined();
      expect(c?.pagataDallAccantonamento, id).toBe(true);
    }
  });

  it("**il commercialista no: è una spesa fissa vera**", () => {
    /*
      La paghi tu, non esce dal fondo delle tasse. Metterla fra le coperte
      toglierebbe dal limite una spesa che nessun accantonamento ha mai messo
      da parte — e sarebbe un errore nel verso peggiore: il limite direbbe
      più del vero.
    */
    const c = CATEGORIE_INIZIALI.find((x) => x.id === "commercialista");
    expect(c?.fissa).toBe(true);
    expect(c?.pagataDallAccantonamento).toBe(false);
  });

  it("e nessun'altra categoria nasce coperta", () => {
    const coperte = CATEGORIE_INIZIALI.filter((c) => c.pagataDallAccantonamento).map((c) => c.id);
    expect(coperte.sort()).toEqual(["f24", "inps", "tasse"]);
  });
});

describe("l'elenco regge da solo", () => {
  it("gli id sono unici", () => {
    const id = CATEGORIE_INIZIALI.map((c) => c.id);
    expect(new Set(id).size).toBe(id.length);
  });

  it("solo le spese possono essere fisse o coperte", () => {
    for (const c of CATEGORIE_INIZIALI) {
      if (c.tipo !== "spesa") {
        expect(c.fissa, c.id).toBe(false);
        expect(c.pagataDallAccantonamento, c.id).toBe(false);
      }
    }
  });

  it("c'è dove mettere quello che l'import non riconosce", () => {
    const c = CATEGORIE_INIZIALI.find((x) => x.id === CATEGORIA_NON_DEFINITO);
    expect(c?.tipo).toBe("spesa");
    expect(c?.fissa).toBe(false);
  });

  it("ci sono entrate, spese fisse, variabili, risparmi e rate", () => {
    const tipi = new Set(CATEGORIE_INIZIALI.map((c) => c.tipo));
    expect([...tipi].sort()).toEqual(["entrata", "rata", "risparmio", "spesa"]);
    expect(CATEGORIE_INIZIALI.some((c) => c.tipo === "spesa" && c.fissa)).toBe(true);
    expect(CATEGORIE_INIZIALI.some((c) => c.tipo === "spesa" && !c.fissa)).toBe(true);
  });
});

describe("con queste categorie, un F24 non abbassa il limite", () => {
  it("**dall'elenco di partenza, senza toccare niente**", () => {
    /*
      È la prova che il flag serve **da subito**: una persona che installa il
      modulo, importa il conto e paga un F24 a giugno non deve scoprire da un
      limite negativo che c'era una casella da spuntare.
    */
    const mov = (p: Partial<MovimentoPf> & { id: string; data: string; importo: number; categoriaId: string }): MovimentoPf =>
      ({ tipo: "spesa", contoId: "a", descrizione: "", ...p });
    const righe = tabellaLimite({
      anno: 2026,
      meseCorrente: 12,
      categorie: CATEGORIE_INIZIALI,
      budget: [],
      accantonamentoMensile: 1_000,
      riportoAttivo: false,
      movimenti: [
        ...Array.from({ length: 12 }, (_, m) =>
          mov({
            id: `e${m}`, data: `2026-${String(m + 1).padStart(2, "0")}-10`,
            importo: 3_000, categoriaId: "fatture", tipo: "entrata",
          }),
        ),
        mov({ id: "f", data: "2026-06-30", importo: 2_400, categoriaId: "f24" }),
        mov({ id: "c", data: "2026-06-15", importo: 150, categoriaId: "commercialista" }),
      ],
    });
    // Giugno: l'F24 sparisce dal conto, il commercialista no.
    expect(righe[5].fisse).toBe(150);
    expect(righe[5].limite).toBe(3_000 - 1_000 - 150);
  });
});
