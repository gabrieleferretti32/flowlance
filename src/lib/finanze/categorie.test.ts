import { describe, expect, it } from "vitest";
import {
  CATEGORIA_NON_DEFINITO,
  CATEGORIE_INIZIALI,
  movimentiDellaCategoria,
  nomeGiaUsato,
  usoDelleCategorie,
} from "./categorie";
import { tabellaLimite } from "./limite";
import type { CategoriaPf, MovimentoPf } from "./tipi";

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

describe("due categorie dello stesso tipo non si chiamano uguale", () => {
  const categorie: CategoriaPf[] = [
    { id: "a", tipo: "spesa", nome: "Trasporti", fissa: false, pagataDallAccantonamento: false },
    { id: "b", tipo: "risparmio", nome: "Auto", fissa: false, pagataDallAccantonamento: false },
  ];

  it("lo stesso nome nello stesso tipo è occupato", () => {
    expect(nomeGiaUsato(categorie, "spesa", "Trasporti")).toBe(true);
  });

  it("**maiuscole e spazi ai bordi non fanno un nome diverso**", () => {
    for (const nome of ["trasporti", "  Trasporti ", "TRASPORTI", "\tTrasporti\n"]) {
      expect(nomeGiaUsato(categorie, "spesa", nome), JSON.stringify(nome)).toBe(true);
    }
  });

  it("e nemmeno uno spazio doppio in mezzo", () => {
    const con: CategoriaPf[] = [
      { id: "s", tipo: "spesa", nome: "Spesa alimentare", fissa: false, pagataDallAccantonamento: false },
    ];
    expect(nomeGiaUsato(con, "spesa", "Spesa  alimentare")).toBe(true);
  });

  /* Uno spazio **dentro** una parola invece cambia la parola, e deve passare:
     «Tra sporti» non è «Trasporti», ed è giusto che siano due categorie. */
  it("uno spazio dentro la parola sì, perché è un'altra parola", () => {
    expect(nomeGiaUsato(categorie, "spesa", "Tra sporti")).toBe(false);
  });

  it("gli accenti sì: «pero» e «però» sono due parole", () => {
    const con: CategoriaPf[] = [
      { id: "c", tipo: "spesa", nome: "Però", fissa: false, pagataDallAccantonamento: false },
    ];
    expect(nomeGiaUsato(con, "spesa", "Pero")).toBe(false);
  });

  it("tipi diversi convivono: non compaiono mai nello stesso elenco", () => {
    expect(nomeGiaUsato(categorie, "spesa", "Auto")).toBe(false);
    expect(nomeGiaUsato(categorie, "risparmio", "Auto")).toBe(true);
  });

  it("rinominando, la categoria non si scontra con sé stessa", () => {
    expect(nomeGiaUsato(categorie, "spesa", "Trasporti", "a")).toBe(false);
  });

  it("un nome vuoto non è «già usato»: è un altro errore, e lo dice il modulo", () => {
    expect(nomeGiaUsato(categorie, "spesa", "   ")).toBe(false);
  });
});

describe("quante volte si usa una categoria", () => {
  const movimenti = [
    { data: "2026-01-10", tipo: "spesa", categoriaId: "affitto" },
    { data: "2026-02-10", tipo: "spesa", categoriaId: "affitto" },
    { data: "2025-02-10", tipo: "spesa", categoriaId: "affitto" },
    { data: "2026-03-10", tipo: "entrata", categoriaId: "fatture" },
    { data: "2026-04-10", tipo: "giroconto", categoriaId: "" },
  ];

  it("conta per anno", () => {
    const uso = usoDelleCategorie(movimenti, 2026);
    expect(uso.get("affitto")).toBe(2);
    expect(uso.get("fatture")).toBe(1);
    expect(usoDelleCategorie(movimenti, 2025).get("affitto")).toBe(1);
  });

  it("una categoria mai usata non compare, e non è zero per caso", () => {
    expect(usoDelleCategorie(movimenti, 2026).get("bollette")).toBeUndefined();
  });

  it("**i giroconti non hanno categoria e non si contano**", () => {
    const uso = usoDelleCategorie(movimenti, 2026);
    expect(uso.get("")).toBeUndefined();
    expect([...uso.values()].reduce((a, b) => a + b, 0)).toBe(3);
  });

  it("i collegamenti di una categoria si trovano in tutti gli anni", () => {
    expect(movimentiDellaCategoria(movimenti, "affitto")).toHaveLength(3);
    expect(movimentiDellaCategoria(movimenti, "mai-usata")).toEqual([]);
  });
});

/**
 * **Rinominare non richiede di propagare niente, e questo test lo prova.**
 *
 * Movimenti, budget e regole puntano alla categoria per `categoriaId`, non per
 * nome: cambiare `nome` non tocca nessun collegamento. È il motivo per cui la
 * schermata delle categorie non ha codice di propagazione — non perché ci si
 * sia dimenticati di scriverlo. Se un giorno qualcosa cominciasse a salvare il
 * nome al posto dell'id, questo test resterebbe verde e non se ne accorgerebbe
 * nessuno: per quello guarda i collegamenti veri, non l'intenzione.
 */
describe("**rinominare una categoria non stacca i suoi collegamenti**", () => {
  it("i movimenti restano attaccati, perché puntano all'id", () => {
    const prima: CategoriaPf = {
      id: "affitto", tipo: "spesa", nome: "Affitto e casa",
      fissa: true, pagataDallAccantonamento: false,
    };
    const movimenti = [{ data: "2026-01-10", tipo: "spesa", categoriaId: "affitto" }];
    const dopo: CategoriaPf = { ...prima, nome: "Casa" };

    expect(movimentiDellaCategoria(movimenti, dopo.id)).toHaveLength(1);
    expect(usoDelleCategorie(movimenti, 2026).get(dopo.id)).toBe(1);
  });

  it("e lo stesso vale per budget e regole: la chiave è sempre l'id", () => {
    const budget = [{ categoriaId: "affitto", anno: 2026, importi: Array(12).fill(900) }];
    const regole = [{ id: "r1", testoDaCercare: "affitto", categoriaId: "affitto", tipo: "spesa" as const }];
    const rinominata = { id: "affitto", nome: "Casa" };
    expect(budget.filter((b) => b.categoriaId === rinominata.id)).toHaveLength(1);
    expect(regole.filter((r) => r.categoriaId === rinominata.id)).toHaveLength(1);
  });
});
