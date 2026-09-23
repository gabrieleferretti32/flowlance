import { describe, expect, it } from "vitest";
import { categorizza, sembraIncassoDaCliente, testoConfrontabile } from "./categorizza";
import { CATEGORIE_INIZIALI } from "./categorie";
import type { CategoriaPf } from "./tipi";

/**
 * Che categoria propone una riga di rendiconto, e le volte in cui sbagliava.
 *
 * Le descrizioni qui sotto hanno la forma di quelle vere — la formula della
 * banca davanti, il nome della controparte in mezzo, il codice mandato in
 * fondo — ma i nomi sono inventati: un test non è il posto dove tenere i
 * fornitori di qualcuno.
 */
const categorie = CATEGORIE_INIZIALI as CategoriaPf[];

const uscita = (descrizione: string) =>
  categorizza(descrizione, "uscita", categorie, []).categoriaId;
const entrata = (descrizione: string) =>
  categorizza(descrizione, "entrata", categorie, []).categoriaId;

describe("**una parola dentro un'altra non è quella parola**", () => {
  it("«sanitaria» contiene «tari», e non è la tassa sui rifiuti", () => {
    /*
      Il difetto vero: un pagamento all'azienda sanitaria locale finiva in
      «Tasse» perché `includes("tari")` è vero dentro «saniTARIa». In archivio
      restava una spesa sanitaria contata come tributo — e le categorie del
      fisco sono quelle coperte dall'accantonamento, quindi quella riga
      spariva anche dal limite di spesa.
    */
    expect(uscita("PAGAMENTO AZIENDA SANITARIA LOCALE")).toBe("salute");
    expect(uscita("TARI 2026 COMUNE")).toBe("tasse");
  });

  it("«bar» non prende «barbiere», «ip» non prende «ipermercato»", () => {
    expect(uscita("BAR CENTRALE")).toBe("ristoranti");
    expect(uscita("BARBIERE DA MARIO")).not.toBe("ristoranti");
    expect(uscita("IP STAZIONE DI SERVIZIO")).toBe("trasporti");
    expect(uscita("IPERMERCATO LE VELE")).not.toBe("trasporti");
  });

  it("«gas» non prende «gasolio», che è un carburante", () => {
    expect(uscita("FATTURA GAS METANO")).toBe("bollette");
    expect(uscita("RIFORNIMENTO GASOLIO")).toBe("trasporti");
  });

  it("l'inizio di parola invece prende i plurali: «piscine comunali»", () => {
    expect(uscita("PISCINE COMUNALI VIA ROMA")).toBe("tempo-libero");
    expect(uscita("SUPERMERCATI RIUNITI")).toBe("spesa-alimentare");
  });
});

describe("le frasi vincono sulle parole", () => {
  it("«eni luce» è una bolletta, «eni station» un carburante", () => {
    /*
      Senza la precedenza alle frasi, «Eni Luce e Gas» finirebbe nei trasporti
      solo perché quella voce sta più in alto nell'elenco.
    */
    expect(uscita("ENI LUCE E GAS SPA")).toBe("bollette");
    expect(uscita("ENI STATION VIA AURELIA")).toBe("trasporti");
  });
});

describe("**gli operatori di telefonia, luce e gas**", () => {
  const casi: [string, string][] = [
    ["Addebito Diretto Disposto A Favore Di WIND TRE S.P.A. MANDATO P1138030", "bollette"],
    ["ADDEBITO SDD ILIAD ITALIA SPA", "bollette"],
    ["TIM S.P.A. BOLLETTA", "bollette"],
    ["VODAFONE ITALIA SPA", "bollette"],
    ["FASTWEB SPA", "bollette"],
    ["HO MOBILE RICARICA", "bollette"],
    ["EOLO SPA", "bollette"],
    ["ENEL ENERGIA SPA", "bollette"],
    ["HERA COMM", "bollette"],
    ["A2A ENERGIA", "bollette"],
    ["IREN MERCATO", "bollette"],
    ["EDISON ENERGIA", "bollette"],
    ["SORGENIA SPA", "bollette"],
    ["PLENITUDE", "bollette"],
    ["ACEA ATO 2", "bollette"],
  ];
  for (const [descrizione, atteso] of casi) {
    it(`«${descrizione.slice(0, 40)}…» → ${atteso}`, () => {
      expect(uscita(descrizione)).toBe(atteso);
    });
  }
});

describe("**il bonifico da una società è un incasso da cliente**", () => {
  it("anche quando la formula della banca sta in mezzo", () => {
    /*
      «Bonifico Istantaneo Disposto Da ACME SRL» non contiene «bonifico da»:
      in mezzo c'è la formula. Senza la parola «fattura» quell'incasso finiva
      nella prima categoria di entrata che capitava.
    */
    expect(entrata("Bonifico Istantaneo Disposto Da ACME SRL")).toBe("fatture");
    expect(entrata("BONIFICO A VOSTRO FAVORE DA BETA S.R.L.")).toBe("fatture");
    expect(entrata("ACCREDITO BONIFICO GAMMA S.P.A.")).toBe("fatture");
  });

  it("**e un bonifico da una persona no**: fra amici il denaro gira per mille motivi", () => {
    expect(entrata("Bonifico Disposto Da MARIO ROSSI")).not.toBe("fatture");
  });

  it("e un'uscita verso una società resta un'uscita", () => {
    /* La regola vale solo in entrata: pagare una SRL non è incassare. */
    expect(uscita("Bonifico Disposto A Favore Di ACME SRL")).not.toBe("fatture");
  });

  it("le due forme, con e senza punti, si riconoscono uguale", () => {
    expect(sembraIncassoDaCliente(testoConfrontabile("Bonifico da ACME S.R.L."))).toBe(true);
    expect(sembraIncassoDaCliente(testoConfrontabile("Bonifico da ACME SRL"))).toBe(true);
    expect(sembraIncassoDaCliente(testoConfrontabile("Pagamento pos ACME SRL"))).toBe(false);
  });
});

describe("**quello che non si riconosce non diventa un prelievo**", () => {
  /*
    Per le uscite il ripiego è «Non definito», che è un'ammissione. Per le
    entrate quella categoria non c'è, e si prendeva la prima dell'elenco: con
    «Fatture incassate» in cima, un movimento non riconosciuto diventava un
    prelievo dalla cassa dell'attività, cioè un doppio conteggio. Misurato su
    un archivio vero con «Movimento Salvadanaio».
  */
  it("un'entrata non riconosciuta non finisce in una categoria «arriva dall'attività»", () => {
    const proposta = categorizza("MOVIMENTO SALVADANAIO", "entrata", categorie, []);
    expect(proposta.origine).toBe("nessuna");
    const scelta = categorie.find((c) => c.id === proposta.categoriaId);
    expect(scelta?.arrivaDallAttivita).toBe(false);
  });

  it("e l'ordine dell'elenco non decide: invertito, la risposta è la stessa", () => {
    const rovesciate = [...categorie].reverse();
    const proposta = categorizza("MOVIMENTO SALVADANAIO", "entrata", rovesciate, []);
    expect(rovesciate.find((c) => c.id === proposta.categoriaId)?.arrivaDallAttivita).toBe(false);
  });

  it("un'uscita non riconosciuta resta «Non definito»", () => {
    expect(uscita("QWERTY ZXCV 12345")).toBe("non-definito");
  });
});

describe("le regole di chi usa l'app vincono sul dizionario", () => {
  it("una parola scritta a mano batte la voce del dizionario", () => {
    const regole = [{ id: "r1", testoDaCercare: "lidl", categoriaId: "acquisti", tipo: "spesa" as const }];
    expect(categorizza("LIDL 2505", "uscita", categorie, regole).categoriaId).toBe("acquisti");
    expect(categorizza("LIDL 2505", "uscita", categorie, regole).origine).toBe("regola");
  });
});
