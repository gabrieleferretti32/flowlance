import { describe, expect, it } from "vitest";
import { conIntestazioneAllaRiga, contieneData, trovaIntestazione } from "./intestazione";

/**
 * Il foglio di prova è quello che ha rotto il primo file vero: un estratto
 * conto con sette righe di copertina sopra la tabella. Prendendo la prima riga
 * come intestazione uscivano «Colonna 1», «Conto 1000/00065493», e tutte le
 * righe scartate per «data non leggibile».
 */
const COPERTINA = [
  ["Trade Republic Bank GmbH", "", "", ""],
  ["Brunnenstraße 19-21, 10119 Berlin", "", "", ""],
  ["", "", "", ""],
  ["Estratto conto", "", "", ""],
  ["Intestatario", "Mario Rossi", "", ""],
  ["Conto", "1000/00065493", "", ""],
  ["Periodo", "01/01/2026 - 31/03/2026", "", ""],
  ["", "", "", ""],
];

const TABELLA = [
  ["Data", "Tipo", "Descrizione", "Importo"],
  ["12/01/2026", "Pagamento", "POS ESSELUNGA", "-42,90"],
  ["15/01/2026", "Accredito", "BONIFICO DA STUDIO", "1.500,00"],
  ["03/02/2026", "Pagamento", "ADDEBITO AFFITTO", "-820,00"],
  ["11/02/2026", "Pagamento", "CARBURANTE", "-64,10"],
  ["28/02/2026", "Accredito", "INTERESSI", "3,12"],
  ["05/03/2026", "Pagamento", "POS BAR", "-12,50"],
  ["19/03/2026", "Accredito", "BONIFICO DA STUDIO", "2.400,00"],
];

describe("un foglio con la copertina sopra", () => {
  const scelta = trovaIntestazione([...COPERTINA, ...TABELLA]);

  it("**trova l'intestazione alla riga 9, non alla 1**", () => {
    expect(scelta.riga).toBe(9);
    expect(scelta.certa).toBe(true);
  });

  it("e da lì in poi le colonne hanno un nome vero", () => {
    expect(scelta.intestazioni).toEqual(["Data", "Tipo", "Descrizione", "Importo"]);
  });

  it("le righe sono i movimenti, tutti e sette, senza la copertina", () => {
    expect(scelta.righe).toHaveLength(7);
    expect(scelta.righe[0][0]).toBe("12/01/2026");
    expect(scelta.righe.map((r) => r[0]).every((d) => /^\d{2}\/\d{2}\/2026$/.test(d))).toBe(true);
  });

  it("**e la misura vede la differenza**: presa la prima riga, non tornava niente", () => {
    const sbagliata = conIntestazioneAllaRiga([...COPERTINA, ...TABELLA], 1);
    expect(sbagliata.intestazioni[0]).toBe("Trade Republic Bank GmbH");
    // È esattamente quello che si vedeva: nessuna colonna riconoscibile e la
    // prima riga di dati persa fra le righe di copertina.
    expect(sbagliata.righe[0][0]).toBe("Brunnenstraße 19-21, 10119 Berlin");
  });

  it("dice su quante righe ha deciso: un giudizio su due righe non è un giudizio", () => {
    expect(scelta.conData).toBe(7);
    expect(scelta.esaminate).toBe(7);
  });
});

describe("le tre regole, una per volta", () => {
  it("**una riga che contiene una data non è un'intestazione**", () => {
    // Senza questa regola vincerebbe la prima riga di dati, che ha sotto di sé
    // solo altre righe di dati: una quota perfetta.
    const scelta = trovaIntestazione(TABELLA);
    expect(scelta.riga).toBe(1);
    expect(contieneData(TABELLA[1])).toBe(true);
  });

  it("vince la frazione più alta di righe con una data **nella finestra sotto**", () => {
    /*
      È la regola che distingue la copertina dall'intestazione: sotto la prima
      riga della copertina ci sono altre righe di copertina, sotto
      l'intestazione ci sono solo dati. Guardando tutto il file invece che la
      finestra, le due si assomiglierebbero.
    */
    const scelta = trovaIntestazione([...COPERTINA, ...TABELLA]);
    expect(scelta.riga).toBe(9);
  });

  it("a parità, vince chi ha più celle piene", () => {
    const conSottotitolo = [
      ["Movimenti del conto", "", "", ""],
      ["Data", "Tipo", "Descrizione", "Importo"],
      ...TABELLA.slice(1),
    ];
    expect(trovaIntestazione(conSottotitolo).riga).toBe(2);
  });

  it("una riga con una cella sola non è una tabella", () => {
    const scelta = trovaIntestazione([["Estratto conto", "", "", ""], ...TABELLA]);
    expect(scelta.intestazioni).toEqual(["Data", "Tipo", "Descrizione", "Importo"]);
  });
});

describe("quando non si capisce, lo dice", () => {
  it("un foglio senza nessuna data ripiega sulla prima riga, dichiarandolo", () => {
    const scelta = trovaIntestazione([
      ["Nome", "Cognome"],
      ["Mario", "Rossi"],
      ["Luisa", "Bianchi"],
    ]);
    expect(scelta.riga).toBe(1);
    expect(scelta.certa).toBe(false);
    expect(scelta.intestazioni).toEqual(["Nome", "Cognome"]);
  });

  it("un foglio vuoto non fa saltare niente", () => {
    const scelta = trovaIntestazione([]);
    expect(scelta.riga).toBe(1);
    expect(scelta.certa).toBe(false);
    expect(scelta.intestazioni).toEqual([]);
    expect(scelta.righe).toEqual([]);
  });

  it("una sola riga di dati e nient'altro: non c'è un'intestazione da trovare", () => {
    const scelta = trovaIntestazione([["12/01/2026", "POS", "-10,00"]]);
    expect(scelta.certa).toBe(false);
    expect(scelta.riga).toBe(1);
  });
});

describe("la scelta a mano", () => {
  const tutte = [...COPERTINA, ...TABELLA];

  it("taglia dove le si dice, contando da 1 come chi guarda il file", () => {
    const alla9 = conIntestazioneAllaRiga(tutte, 9);
    expect(alla9.intestazioni[0]).toBe("Data");
    expect(alla9.righe).toHaveLength(7);
  });

  it("una riga fuori dal foglio non sfonda: si ferma agli estremi", () => {
    expect(conIntestazioneAllaRiga(tutte, 0).intestazioni).toEqual(tutte[0]);
    expect(conIntestazioneAllaRiga(tutte, 999).righe).toEqual([]);
    expect(conIntestazioneAllaRiga([], 5).intestazioni).toEqual([]);
  });

  it("la copertina lunga oltre le righe esaminate non si cerca all'infinito", () => {
    const lunghissima = Array.from({ length: 40 }, () => ["titolo", "x", "", ""]);
    const scelta = trovaIntestazione([...lunghissima, ...TABELLA]);
    // Nessuna candidata nelle prime 25 righe ha dati sotto: si ripiega e si dice.
    expect(scelta.certa).toBe(false);
    expect(scelta.riga).toBe(1);
  });
});
