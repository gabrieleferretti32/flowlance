import { describe, expect, it } from "vitest";
import { descrizioneUtile } from "./descrizione";
import { categorizza } from "./categorizza";
import { CATEGORIE_INIZIALI } from "./categorie";
import type { CategoriaPf } from "./tipi";

/**
 * Le righe di prova sono scritte come le scrivono le banche italiane: maiuscole
 * a metà, formule lunghe, la controparte in fondo. È lì che il nome finisce
 * oltre il troncamento.
 */

describe("la formula iniziale se ne va e resta la controparte", () => {
  const casi: [string, string][] = [
    ["Addebito Diretto Disposto A Favore Di ENEL ENERGIA SPA", "ENEL ENERGIA SPA"],
    ["ADDEBITO DIRETTO SDD A FAVORE DI VODAFONE ITALIA SPA", "VODAFONE ITALIA SPA"],
    ["Addebito Preautorizzato NETFLIX INTERNATIONAL", "NETFLIX INTERNATIONAL"],
    ["Bonifico Istantaneo Disposto A Favore Di MARIO ROSSI", "MARIO ROSSI"],
    ["BONIFICO DA STUDIO ROSSI SRL", "STUDIO ROSSI SRL"],
    ["Bonifico in entrata da COMUNE DI MILANO", "COMUNE DI MILANO"],
    ["Accredito bonifico da ACME SPA", "ACME SPA"],
    ["Pagamento tramite POS ESSELUNGA MILANO VIA DANTE", "ESSELUNGA MILANO VIA DANTE"],
    ["Pagamento Con Carta Di Credito AMAZON EU SARL", "AMAZON EU SARL"],
    ["Disposizione di pagamento a favore di AGENZIA DELLE ENTRATE", "AGENZIA DELLE ENTRATE"],
  ];

  for (const [grezza, attesa] of casi) {
    it(`«${grezza.slice(0, 38)}…» → «${attesa}»`, () => {
      expect(descrizioneUtile(grezza)).toBe(attesa);
    });
  }
});

describe("le code che la formula si porta dietro", () => {
  it("la data e l'ora se ne vanno: la data ha già la sua colonna", () => {
    expect(descrizioneUtile("Pagamento Pos Del 12/01/2026 Ore 10:30 Presso ESSELUNGA")).toBe(
      "ESSELUNGA",
    );
  });

  it("«presso» da solo se ne va", () => {
    expect(descrizioneUtile("PAGAMENTO POS PRESSO FARMACIA COMUNALE 3")).toBe(
      "FARMACIA COMUNALE 3",
    );
  });

  it("gli spazi doppi si normalizzano anche quando non c'è niente da togliere", () => {
    expect(descrizioneUtile("  RATA   MUTUO  CASA ")).toBe("RATA MUTUO CASA");
  });
});

describe("**quando togliere farebbe danno, non si toglie**", () => {
  it("una riga senza controparte resta intera", () => {
    // Tolta la formula non resterebbe niente da leggere.
    expect(descrizioneUtile("PRELIEVO BANCOMAT")).toBe("PRELIEVO BANCOMAT");
    expect(descrizioneUtile("Bonifico istantaneo")).toBe("Bonifico istantaneo");
    expect(descrizioneUtile("Addebito diretto")).toBe("Addebito diretto");
  });

  it("una descrizione senza formule non si tocca", () => {
    expect(descrizioneUtile("COMMISSIONI TRIMESTRALI")).toBe("COMMISSIONI TRIMESTRALI");
    expect(descrizioneUtile("Stipendio settembre")).toBe("Stipendio settembre");
  });

  it("**la formula si toglie solo dall'inizio**", () => {
    // «bonifico» in mezzo è parte di quello che qualcuno ha scritto.
    expect(descrizioneUtile("RIMBORSO PER BONIFICO DA CONTO ESTERO")).toBe(
      "RIMBORSO PER BONIFICO DA CONTO ESTERO",
    );
  });

  it("**una controparte che si chiama come una formula si salva intera**", () => {
    /*
      «BONIFICO SPA» è un nome, ma è fatto di parole di formula: tagliando
      resterebbe «SPA», che non identifica nessuno. Sotto il minimo non si
      taglia, quindi la riga resta per intero — lunga, ma vera. È il verso
      giusto in cui sbagliare.
    */
    expect(descrizioneUtile("Addebito diretto disposto a favore di BONIFICO SPA")).toBe(
      "Addebito diretto disposto a favore di BONIFICO SPA",
    );
  });

  it("e una parola di formula dentro al nome non lo accorcia due volte", () => {
    expect(descrizioneUtile("BONIFICO DA CARTA DI CREDITO SERVIZI SRL")).toBe("SERVIZI SRL");
  });
});

describe("**la categoria si legge sul testo grezzo, non su quello ripulito**", () => {
  const categorie = CATEGORIE_INIZIALI.map((c) => ({ ...c }) as CategoriaPf);

  it("«BONIFICO DA STUDIO ROSSI» resta un'entrata da fattura", () => {
    const grezza = "BONIFICO DA STUDIO ROSSI SRL";
    /*
      Il dizionario conosce «bonifico da». Catalogando sul testo ripulito —
      «STUDIO ROSSI SRL» — quella riga finirebbe in una categoria generica per
      colpa di una pulizia estetica: è il motivo per cui `anteprimaImport`
      passa il grezzo a `categorizza` e il ripulito al registro.
    */
    expect(categorizza(grezza, "entrata", categorie, []).origine).toBe("dizionario");
    /*
      Sul ripulito la parola «bonifico da» non c'è più: la categoria che esce è
      il ripiego — la prima categoria di entrata — e `origine` lo dichiara.
      Guardare l'id non basterebbe: il ripiego e il riconoscimento portano allo
      stesso posto, ed è proprio il caso in cui un test si autoconvince.
    */
    expect(categorizza(descrizioneUtile(grezza), "entrata", categorie, []).origine).toBe(
      "nessuna",
    );
  });

  it("e una regola scritta sul testo ripulito continua a valere sul grezzo", () => {
    // Il ripulito è un pezzo del grezzo, quindi `includes` lo trova lo stesso.
    const grezza = "Addebito Diretto Disposto A Favore Di ENEL ENERGIA SPA";
    const regola = { id: "r", testoDaCercare: descrizioneUtile(grezza), categoriaId: "bollette", tipo: "spesa" as const };
    expect(categorizza(grezza, "uscita", categorie, [regola]).categoriaId).toBe("bollette");
  });
});

describe("un incasso da cliente scritto come lo scrive la banca", () => {
  const categorie = CATEGORIE_INIZIALI.map((c) => ({ ...c }) as CategoriaPf);

  it("«Bonifico Istantaneo Disposto Da X Per Fattura 12/2025» è un incasso da fattura", () => {
    /*
      Visto su un estratto conto vero: finiva in «Altre entrate» perché il
      dizionario cercava «bonifico da», che lì dentro non c'è. La categoria
      conta più delle altre — è l'unica marcata «arriva dall'attività» — e
      sbagliarla vuol dire, domani, un prelievo che non si conta.
    */
    const grezza = "Bonifico Istantaneo Disposto Da STUDIO ROSSI SRL Per Fattura 12/2025";
    const proposta = categorizza(grezza, "entrata", categorie, []);
    expect(proposta.categoriaId).toBe("fatture");
    expect(proposta.origine).toBe("dizionario");
  });

  it("**ma un rimborso no**: «fattura» da sola non basta", () => {
    const proposta = categorizza("RIMBORSO FATTURA ENEL ENERGIA", "entrata", categorie, []);
    expect(proposta.origine).toBe("nessuna");
  });
});
