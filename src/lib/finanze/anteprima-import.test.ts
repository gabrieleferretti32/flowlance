import { describe, expect, it } from "vitest";
import { anteprimaImport, firmaMovimento, movimentiDaScrivere } from "./anteprima-import";
import { CATEGORIE_INIZIALI } from "./categorie";
import type { CategoriaPf, MovimentoPf, RegolaPf } from "./tipi";

const CATEGORIE = CATEGORIE_INIZIALI as CategoriaPf[];

const riga = (indice: number, data: string, descrizione: string, importo: number) => ({
  indice, data, descrizione, importo,
});

const base = {
  categorie: CATEGORIE,
  regole: [] as RegolaPf[],
  esistenti: [] as MovimentoPf[],
  contiTracciati: ["conto", "libretto"],
};

describe("l'anteprima di un import", () => {
  const righe = anteprimaImport({
    ...base,
    file: [
      {
        nome: "conto.csv",
        contoId: "conto",
        righe: [
          riga(1, "2026-09-05", "PAGAMENTO POS ESSELUNGA", -63.4),
          riga(2, "2026-09-06", "BONIFICO DA STUDIO ROSSI", 2_400),
          riga(3, "2026-09-07", "ADDEBITO ENEL ENERGIA", -88.1),
        ],
      },
    ],
  });

  it("il segno del file diventa il tipo del movimento", () => {
    expect(righe.map((r) => r.tipo)).toEqual(["spesa", "entrata", "spesa"]);
    expect(righe.every((r) => r.importo > 0)).toBe(true);
  });

  it("le righe escono in ordine di data", () => {
    expect(righe.map((r) => r.data)).toEqual([...righe.map((r) => r.data)].sort());
  });

  it("il dizionario riconosce quello che è ovvio, e lo dichiara", () => {
    expect(righe[0].categoriaId).toBe("spesa-alimentare");
    expect(righe[0].origineCategoria).toBe("dizionario");
    expect(righe[2].categoriaId).toBe("bollette");
  });

  it("**e quello che non è ovvio finisce in «Non definito», non indovinato**", () => {
    const ignote = anteprimaImport({
      ...base,
      file: [{ nome: "x.csv", contoId: "conto", righe: [riga(1, "2026-09-05", "ADD. XY 4471", -22)] }],
    });
    expect(ignote[0].categoriaId).toBe("non-definito");
    expect(ignote[0].origineCategoria).toBe("nessuna");
  });
});

describe("le regole della persona vincono sul dizionario", () => {
  it("una parola sua riscrive la proposta", () => {
    const righe = anteprimaImport({
      ...base,
      regole: [{ id: "r1", testoDaCercare: "esselunga", categoriaId: "acquisti", tipo: "spesa" }],
      file: [{ nome: "c.csv", contoId: "conto", righe: [riga(1, "2026-09-05", "POS ESSELUNGA", -63.4)] }],
    });
    expect(righe[0].categoriaId).toBe("acquisti");
    expect(righe[0].origineCategoria).toBe("regola");
  });

  /* La regola punta a un id: se la categoria non c'è più, la regola non si
     applica invece di scrivere un id morto. */
  it("**una regola che punta a una categoria sparita non si applica**", () => {
    const righe = anteprimaImport({
      ...base,
      regole: [{ id: "r1", testoDaCercare: "esselunga", categoriaId: "sparita", tipo: "spesa" }],
      file: [{ nome: "c.csv", contoId: "conto", righe: [riga(1, "2026-09-05", "POS ESSELUNGA", -63.4)] }],
    });
    expect(righe[0].categoriaId).toBe("spesa-alimentare");
  });

  it("e una regola di entrata non cattura una spesa", () => {
    const righe = anteprimaImport({
      ...base,
      regole: [{ id: "r1", testoDaCercare: "bonifico", categoriaId: "fatture", tipo: "entrata" }],
      file: [{ nome: "c.csv", contoId: "conto", righe: [riga(1, "2026-09-05", "BONIFICO A MARIO", -500)] }],
    });
    expect(righe[0].categoriaId).toBe("non-definito");
  });
});

/**
 * **Il doppione si deseleziona, non sparisce.**
 *
 * Due caffè uguali nello stesso giorno esistono. Una riga tolta in silenzio è
 * una spesa che non c'è mai stata, e non si scopre più: resta lì, visibile e
 * senza spunta, e chi guarda decide.
 */
describe("i doppioni", () => {
  const esistente: MovimentoPf = {
    id: "m1", data: "2026-09-05", tipo: "spesa", categoriaId: "spesa-alimentare",
    contoId: "conto", importo: 63.4, descrizione: "Pagamento POS  Esselunga",
  };

  it("**una riga già in archivio arriva senza spunta, ma arriva**", () => {
    const righe = anteprimaImport({
      ...base,
      esistenti: [esistente],
      file: [{ nome: "c.csv", contoId: "conto", righe: [riga(1, "2026-09-05", "PAGAMENTO POS ESSELUNGA", -63.4)] }],
    });
    expect(righe).toHaveLength(1);
    expect(righe[0].duplicato).toBe(true);
    expect(righe[0].scelta).toBe(false);
  });

  it("la descrizione si confronta normalizzata: spazi e maiuscole non contano", () => {
    expect(firmaMovimento("2026-09-05", -63.4, "Pagamento POS  Esselunga")).toBe(
      firmaMovimento("2026-09-05", 63.4, "PAGAMENTO POS ESSELUNGA"),
    );
  });

  it("due righe uguali nello stesso import: la seconda è il doppione", () => {
    const righe = anteprimaImport({
      ...base,
      file: [{
        nome: "c.csv", contoId: "conto",
        righe: [riga(1, "2026-09-05", "CAFFE", -1.2), riga(2, "2026-09-05", "CAFFE", -1.2)],
      }],
    });
    expect(righe.map((r) => r.duplicato)).toEqual([false, true]);
  });

  it("una data diversa non è un doppione", () => {
    const righe = anteprimaImport({
      ...base,
      esistenti: [esistente],
      file: [{ nome: "c.csv", contoId: "conto", righe: [riga(1, "2026-09-06", "PAGAMENTO POS ESSELUNGA", -63.4)] }],
    });
    expect(righe[0].duplicato).toBe(false);
  });
});

/**
 * **Le due metà di un giroconto stanno in due file diversi.**
 *
 * Un file per conto: l'uscita è nel rendiconto del corrente, l'entrata in
 * quello del libretto. Cercare la coppia dentro un file solo vuol dire non
 * trovarla mai — ed è il motivo per cui l'abbinamento si fa dopo aver letto
 * tutti i file, non durante.
 */
describe("i giroconti fra due rendiconti", () => {
  const righe = anteprimaImport({
    ...base,
    file: [
      { nome: "conto.csv", contoId: "conto", righe: [riga(1, "2026-09-10", "GIROCONTO A LIBRETTO", -500)] },
      { nome: "libretto.csv", contoId: "libretto", righe: [riga(1, "2026-09-11", "GIROCONTO DA CONTO", 500)] },
    ],
  });

  it("**diventano un movimento solo**", () => {
    expect(righe).toHaveLength(1);
    expect(righe[0].tipo).toBe("giroconto");
    expect(righe[0].contoId).toBe("conto");
    expect(righe[0].contoDestinazioneId).toBe("libretto");
    expect(righe[0].categoriaId).toBe("");
  });

  it("oltre i tre giorni restano due movimenti", () => {
    const lontane = anteprimaImport({
      ...base,
      file: [
        { nome: "a.csv", contoId: "conto", righe: [riga(1, "2026-09-10", "GIRO", -500)] },
        { nome: "b.csv", contoId: "libretto", righe: [riga(1, "2026-09-20", "GIRO", 500)] },
      ],
    });
    expect(lontane).toHaveLength(2);
    expect(lontane.map((r) => r.tipo)).toEqual(["spesa", "entrata"]);
  });

  it("e importi diversi non si abbinano", () => {
    const diverse = anteprimaImport({
      ...base,
      file: [
        { nome: "a.csv", contoId: "conto", righe: [riga(1, "2026-09-10", "GIRO", -500)] },
        { nome: "b.csv", contoId: "libretto", righe: [riga(1, "2026-09-11", "GIRO", 480)] },
      ],
    });
    expect(diverse).toHaveLength(2);
  });
});

describe("quello che si scrive in archivio", () => {
  const righe = anteprimaImport({
    ...base,
    file: [{
      nome: "c.csv", contoId: "conto",
      righe: [riga(1, "2026-09-05", "ESSELUNGA", -63.4), riga(2, "2026-09-06", "CAFFE", -1.2)],
    }],
  });

  it("solo le righe scelte", () => {
    const con = righe.map((r, i) => ({ ...r, scelta: i === 0 }));
    let n = 0;
    const scritti = movimentiDaScrivere(con, "imp-1", () => `id-${(n += 1)}`);
    expect(scritti).toHaveLength(1);
    expect(scritti[0].descrizione).toBe("ESSELUNGA");
  });

  it("ognuna con l'importo positivo, l'import di provenienza e la sua firma", () => {
    let n = 0;
    const scritti = movimentiDaScrivere(righe, "imp-1", () => `id-${(n += 1)}`);
    expect(scritti.every((m) => m.importo > 0)).toBe(true);
    expect(scritti.every((m) => m.importId === "imp-1")).toBe(true);
    expect(scritti[0].hashDuplicato).toBe(firmaMovimento("2026-09-05", 63.4, "ESSELUNGA"));
  });

  /**
   * La firma scritta adesso è quella che il prossimo import confronterà: se le
   * due si calcolassero in due modi diversi, ogni riga rientrerebbe come nuova
   * e il registro si riempirebbe di doppioni a ogni caricamento.
   */
  it("**e la firma scritta è quella che il prossimo import cercherà**", () => {
    let n = 0;
    const scritti = movimentiDaScrivere(righe, "imp-1", () => `id-${(n += 1)}`);
    const dopo = anteprimaImport({
      ...base,
      esistenti: scritti,
      file: [{ nome: "c.csv", contoId: "conto", righe: [riga(1, "2026-09-05", "esselunga", -63.4)] }],
    });
    expect(dopo[0].duplicato).toBe(true);
  });
});

/**
 * **Il segno dice il verso, la categoria dice il tipo.**
 *
 * Una riga che dice «RATA PRESTITO AUTO» è un'uscita, ma non una spesa
 * qualunque: la categoria che la riconosce è di tipo `rata`. Se il movimento
 * restasse `spesa` quella categoria non gli si potrebbe nemmeno attaccare — i
 * tipi devono combaciare — e la riga finirebbe in «Non definito» avendo in
 * mano la risposta. È successo davvero, provando l'import nel browser.
 */
describe("**il tipo viene dietro alla categoria riconosciuta**", () => {
  const conRiga = (descrizione: string, importo: number, regole: RegolaPf[] = []) =>
    anteprimaImport({
      ...base,
      regole,
      file: [{ nome: "c.csv", contoId: "conto", righe: [riga(1, "2026-09-20", descrizione, importo)] }],
    })[0];

  it("una rata riconosciuta diventa di tipo «rata»", () => {
    const r = conRiga("RATA PRESTITO AUTO", -230);
    expect(r.tipo).toBe("rata");
    expect(r.categoriaId).toBe("rate");
  });

  it("un accantonamento riconosciuto diventa «risparmio»", () => {
    const r = conRiga("ACCANTONAMENTO MENSILE", -300);
    expect(r.tipo).toBe("risparmio");
    expect(r.categoriaId).toBe("risparmio");
  });

  it("una spesa qualunque resta «spesa»", () => {
    expect(conRiga("POS ESSELUNGA", -63.4).tipo).toBe("spesa");
  });

  it("**e un'entrata resta un'entrata, qualunque parola contenga**", () => {
    const r = conRiga("BONIFICO RIMBORSO RATA PRESTITO", 230);
    expect(r.tipo).toBe("entrata");
  });

  it("vale anche per le regole: una regola verso una categoria di risparmio sposta il tipo", () => {
    const r = conRiga("GIRO MENSILE XZ", -100, [
      { id: "r1", testoDaCercare: "GIRO MENSILE", categoriaId: "investimenti", tipo: "risparmio" },
    ]);
    expect(r.tipo).toBe("risparmio");
    expect(r.categoriaId).toBe("investimenti");
  });
});

/**
 * **Caricare due volte lo stesso rendiconto non deve raddoppiare i giroconti.**
 *
 * In archivio la coppia unita lascia **una** riga sola, con la descrizione
 * dell'uscita. La riga d'entrata — quella che nel file dell'altro conto dice
 * «GIROCONTO DA…» — non somiglia a niente di scritto, e senza un
 * riconoscimento per struttura rientrerebbe come un'entrata nuova a ogni
 * caricamento: il saldo cresce di cinquecento euro per volta.
 */
describe("**i giroconti già in archivio si riconoscono**", () => {
  const primoImport = () => {
    const righe = anteprimaImport({
      ...base,
      file: [
        { nome: "conto.csv", contoId: "conto", righe: [riga(1, "2026-09-10", "GIROCONTO A LIBRETTO", -500)] },
        { nome: "libretto.csv", contoId: "libretto", righe: [riga(1, "2026-09-11", "GIROCONTO DA CONTO", 500)] },
      ],
    });
    let n = 0;
    return movimentiDaScrivere(righe, "imp-1", () => `id-${(n += 1)}`);
  };

  it("in archivio resta un movimento solo", () => {
    const scritti = primoImport();
    expect(scritti).toHaveLength(1);
    expect(scritti[0].tipo).toBe("giroconto");
  });

  it("**ricaricando il file dell'uscita, la riga arriva senza spunta**", () => {
    const righe = anteprimaImport({
      ...base,
      esistenti: primoImport(),
      file: [{ nome: "conto.csv", contoId: "conto", righe: [riga(1, "2026-09-10", "GIROCONTO A LIBRETTO", -500)] }],
    });
    expect(righe[0].duplicato).toBe(true);
    expect(righe[0].scelta).toBe(false);
  });

  it("**e anche ricaricando il file dell'entrata, che in archivio non c'è scritta**", () => {
    const righe = anteprimaImport({
      ...base,
      esistenti: primoImport(),
      file: [{ nome: "libretto.csv", contoId: "libretto", righe: [riga(1, "2026-09-11", "GIROCONTO DA CONTO", 500)] }],
    });
    expect(righe[0].duplicato).toBe(true);
  });

  /* La misura al contrario: un movimento che non c'entra niente con quel
     giroconto resta scelto, altrimenti il controllo direbbe sempre di sì. */
  it("un importo diverso fra gli stessi conti resta un movimento nuovo", () => {
    const righe = anteprimaImport({
      ...base,
      esistenti: primoImport(),
      file: [{ nome: "conto.csv", contoId: "conto", righe: [riga(1, "2026-09-10", "GIROCONTO A LIBRETTO", -480)] }],
    });
    expect(righe[0].duplicato).toBe(false);
  });

  it("e un conto che non è nessuno dei due nemmeno", () => {
    const righe = anteprimaImport({
      ...base,
      contiTracciati: ["conto", "libretto", "terzo"],
      esistenti: primoImport(),
      file: [{ nome: "terzo.csv", contoId: "terzo", righe: [riga(1, "2026-09-10", "GIROCONTO", -500)] }],
    });
    expect(righe[0].duplicato).toBe(false);
  });
});

describe("**la descrizione si ripulisce, l'impronta no**", () => {
  const riga = (descrizione: string) => ({
    file: [{ nome: "banca.csv", contoId: "c1", righe: [
      { indice: 2, data: "2026-01-12", descrizione, importo: -42.9 },
    ] }],
    categorie: CATEGORIE,
    regole: [],
    esistenti: [] as MovimentoPf[],
    contiTracciati: ["c1"],
  });
  const FORMULA = "Addebito Diretto Disposto A Favore Di ENEL ENERGIA SPA";

  it("in anteprima si legge la controparte, non la formula", () => {
    const [r] = anteprimaImport(riga(FORMULA));
    expect(r.descrizione).toBe("ENEL ENERGIA SPA");
    expect(r.descrizioneOriginale).toBe(FORMULA);
  });

  it("**e ricaricando lo stesso file la riga è un doppione**", () => {
    /*
      È il punto delicato: in archivio c'è la descrizione ripulita, ma
      l'impronta salvata viene dal testo della banca. Se l'impronta seguisse
      la descrizione, il file ricaricato il mese dopo entrerebbe due volte.
    */
    const [prima] = anteprimaImport(riga(FORMULA));
    const [salvato] = movimentiDaScrivere([prima], "imp", () => "m1");
    expect(salvato.descrizione).toBe("ENEL ENERGIA SPA");

    const [dopo] = anteprimaImport({ ...riga(FORMULA), esistenti: [salvato] });
    expect(dopo.duplicato).toBe(true);
    expect(dopo.scelta).toBe(false);
  });

  it("**e i movimenti importati prima di questa pulizia restano riconoscibili**", () => {
    /*
      Com'era un movimento importato il mese scorso: descrizione lunga, e
      l'impronta calcolata su quella stessa descrizione — che allora era il
      testo della banca. Il file ricaricato oggi produce la descrizione
      ripulita, ma l'impronta viene ancora dal grezzo: le due combaciano.

      Senza questa compatibilità, la prima cosa che questa pulizia avrebbe
      fatto sarebbe stata far entrare due volte tutto quello che c'era già.
    */
    const vecchio: MovimentoPf = {
      id: "vecchio",
      data: "2026-01-12",
      tipo: "spesa",
      categoriaId: "bollette",
      contoId: "c1",
      importo: 42.9,
      descrizione: FORMULA,
      hashDuplicato: firmaMovimento("2026-01-12", -42.9, FORMULA),
    };
    const [dopo] = anteprimaImport({ ...riga(FORMULA), esistenti: [vecchio] });
    expect(dopo.duplicato).toBe(true);
  });

  it("e lo è anche se in anteprima la descrizione era stata corretta a mano", () => {
    const [prima] = anteprimaImport(riga(FORMULA));
    const corretta = { ...prima, descrizione: "Bolletta della luce" };
    const [salvato] = movimentiDaScrivere([corretta], "imp", () => "m1");
    expect(salvato.descrizione).toBe("Bolletta della luce");

    const [dopo] = anteprimaImport({ ...riga(FORMULA), esistenti: [salvato] });
    expect(dopo.duplicato, "l'impronta non segue quello che si scrive a mano").toBe(true);
  });
});
