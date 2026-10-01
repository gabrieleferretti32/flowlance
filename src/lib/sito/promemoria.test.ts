import { describe, expect, it } from "vitest";
import {
  ATTESA_MINIMA_MS,
  ATTRIBUTI,
  TETTO_IMPORTI,
  TETTO_RICAVI,
  convalidaPromemoria,
  origineAmmessa,
} from "./promemoria";
import { RICAVI_MASSIMI } from "./simulatore";

const OGGI = "2026-10-01";

function richiesta(parziale: Record<string, unknown> = {}) {
  return {
    email: "mario@example.com",
    compilatoIn: 9_000,
    attributi: {
      REGIME: "forfettario",
      FATTURATO_STIMATO: 40_000,
      ACCANTONAMENTO_MESE: 966.15,
      SCAD_1_DATA: "2026-11-30",
      SCAD_1_IMPORTO: 5_329.48,
      SCAD_2_DATA: "2027-06-30",
      SCAD_2_IMPORTO: 6_264.28,
    },
    ...parziale,
  };
}

/*
  La tagliola che tiene allineati i due tetti.

  `TETTO_RICAVI` non importa `RICAVI_MASSIMI` di proposito — la funzione
  serverless non deve tirarsi dentro il motore fiscale — e due costanti scritte
  in due file divergono. Il giorno in cui una cambia, questo test lo dice: senza
  di lui il server scarterebbe in silenzio una richiesta che la pagina
  considera legittima, e chi si iscrive vedrebbe un errore senza ragione.
*/
describe("i due tetti restano lo stesso numero", () => {
  it("TETTO_RICAVI è RICAVI_MASSIMI", () => {
    expect(TETTO_RICAVI).toBe(RICAVI_MASSIMI);
  });
});

describe("convalidaPromemoria", () => {
  it("accetta una richiesta della pagina e restituisce i sette attributi", () => {
    const e = convalidaPromemoria(richiesta(), OGGI);
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    expect(e.email).toBe("mario@example.com");
    expect(Object.keys(e.attributi).sort()).toEqual([...ATTRIBUTI].sort());
  });

  it("normalizza l'indirizzo: spazi via, minuscole", () => {
    const e = convalidaPromemoria(richiesta({ email: "  Mario@Example.COM " }), OGGI);
    expect(e.ok && e.email).toBe("mario@example.com");
  });

  /*
    Il presidio che conta davvero: quello che non è nell'elenco non passa.
    Non si verifica che la chiave venga rifiutata — si verifica che **non
    esista** nell'oggetto che parte, perché la convalida ricostruisce invece
    di filtrare.
  */
  it("una chiave estranea non arriva a Brevo", () => {
    const e = convalidaPromemoria(
      richiesta({
        attributi: { ...richiesta().attributi, GRUPPO_ATECO: "professionali", NOTE: "x" },
      }),
      OGGI,
    );
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    expect(e.attributi.GRUPPO_ATECO).toBeUndefined();
    expect(e.attributi.NOTE).toBeUndefined();
    expect(Object.keys(e.attributi)).toHaveLength(7);
  });

  it("niente gestione e niente gruppo ATECO fra gli attributi ammessi", () => {
    // Insieme al fatturato sarebbero il profilo economico di una persona.
    expect(ATTRIBUTI).not.toContain("GESTIONE");
    expect(ATTRIBUTI).not.toContain("GRUPPO_ATECO");
  });

  for (const sbagliata of ["", "mario", "mario@", "@example.com", "mario@example", "ma rio@e.com"]) {
    it(`scarta «${sbagliata}» come indirizzo`, () => {
      expect(convalidaPromemoria(richiesta({ email: sbagliata }), OGGI).ok).toBe(false);
    });
  }

  it("accetta gli indirizzi legittimi che una regex severa rifiuterebbe", () => {
    for (const buona of ["mario+tasse@example.com", "d'angelo@example.co.uk", "a_b-c@sub.example.it"]) {
      expect(convalidaPromemoria(richiesta({ email: buona }), OGGI).ok).toBe(true);
    }
  });

  it("la trappola temporale scarta l'invio istantaneo", () => {
    expect(convalidaPromemoria(richiesta({ compilatoIn: 0 }), OGGI).ok).toBe(false);
    expect(convalidaPromemoria(richiesta({ compilatoIn: ATTESA_MINIMA_MS - 1 }), OGGI).ok).toBe(false);
    expect(convalidaPromemoria(richiesta({ compilatoIn: ATTESA_MINIMA_MS }), OGGI).ok).toBe(true);
  });

  it("e scarta anche chi non lo manda affatto", () => {
    const senza = richiesta();
    delete (senza as { compilatoIn?: number }).compilatoIn;
    expect(convalidaPromemoria(senza, OGGI).ok).toBe(false);
  });

  it("il regime sta in un elenco di due", () => {
    expect(convalidaPromemoria(richiesta({ attributi: { ...richiesta().attributi, REGIME: "minimi" } }), OGGI).ok).toBe(false);
  });

  it("il fatturato non supera il tetto", () => {
    const a = richiesta().attributi;
    expect(convalidaPromemoria(richiesta({ attributi: { ...a, FATTURATO_STIMATO: TETTO_RICAVI } }), OGGI).ok).toBe(true);
    expect(convalidaPromemoria(richiesta({ attributi: { ...a, FATTURATO_STIMATO: TETTO_RICAVI + 1 } }), OGGI).ok).toBe(false);
    expect(convalidaPromemoria(richiesta({ attributi: { ...a, FATTURATO_STIMATO: -1 } }), OGGI).ok).toBe(false);
  });

  it("gli importi delle scadenze hanno il loro tetto, più alto", () => {
    const a = richiesta().attributi;
    expect(convalidaPromemoria(richiesta({ attributi: { ...a, SCAD_1_IMPORTO: TETTO_IMPORTI } }), OGGI).ok).toBe(true);
    expect(convalidaPromemoria(richiesta({ attributi: { ...a, SCAD_1_IMPORTO: TETTO_IMPORTI + 1 } }), OGGI).ok).toBe(false);
  });

  it("una data fuori dalla finestra plausibile non viene da questa pagina", () => {
    const a = richiesta().attributi;
    for (const data of ["2019-06-30", "2031-06-30", "30/06/2027", "2027-13-01", "2027-06-32", ""]) {
      expect(convalidaPromemoria(richiesta({ attributi: { ...a, SCAD_1_DATA: data } }), OGGI).ok).toBe(false);
    }
  });

  it("la seconda scadenza può mancare: nel primo anno ce n'è una sola", () => {
    const a = { ...richiesta().attributi } as Record<string, unknown>;
    delete a.SCAD_2_DATA;
    delete a.SCAD_2_IMPORTO;
    const e = convalidaPromemoria(richiesta({ attributi: a }), OGGI);
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    expect(Object.keys(e.attributi)).toHaveLength(5);
    expect(e.attributi.SCAD_2_DATA).toBeUndefined();
  });

  it("ma non può mancare a metà: data senza importo è un'email rotta", () => {
    const a = { ...richiesta().attributi } as Record<string, unknown>;
    delete a.SCAD_2_IMPORTO;
    expect(convalidaPromemoria(richiesta({ attributi: a }), OGGI).ok).toBe(false);
  });

  it("la seconda scadenza viene dopo la prima", () => {
    const a = richiesta().attributi;
    expect(
      convalidaPromemoria(
        richiesta({ attributi: { ...a, SCAD_2_DATA: "2026-06-30", SCAD_2_IMPORTO: 100 } }),
        OGGI,
      ).ok,
    ).toBe(false);
  });

  it("e non è a zero: zero non è un appuntamento", () => {
    const a = richiesta().attributi;
    expect(convalidaPromemoria(richiesta({ attributi: { ...a, SCAD_2_IMPORTO: 0 } }), OGGI).ok).toBe(false);
  });

  it("un corpo che non è un oggetto non manda in pezzi niente", () => {
    for (const corpo of [null, undefined, 42, "ciao", [], true]) {
      expect(convalidaPromemoria(corpo, OGGI).ok).toBe(false);
    }
  });

  it("gli attributi mancanti del tutto non passano", () => {
    expect(convalidaPromemoria({ email: "mario@example.com", compilatoIn: 9_000 }, OGGI).ok).toBe(false);
  });

  it("il motivo tecnico non finisce nel messaggio per chi guarda", () => {
    const e = convalidaPromemoria(richiesta({ compilatoIn: 10 }), OGGI);
    expect(e.ok).toBe(false);
    if (e.ok) return;
    expect(e.motivo).toContain("veloce");
    expect(e.errore).not.toContain("veloce");
  });
});

describe("origineAmmessa", () => {
  const ammesse = ["https://flowlance.it", "https://www.flowlance.it"];

  it("passa l'origine del sito, con o senza barra finale", () => {
    expect(origineAmmessa("https://flowlance.it", ammesse)).toBe(true);
    expect(origineAmmessa("https://flowlance.it/", ammesse)).toBe(true);
  });

  it("non passa un altro sito, né l'assenza di origine", () => {
    expect(origineAmmessa("https://flowlance.it.evil.com", ammesse)).toBe(false);
    expect(origineAmmessa("http://flowlance.it", ammesse)).toBe(false);
    expect(origineAmmessa(undefined, ammesse)).toBe(false);
    expect(origineAmmessa("", ammesse)).toBe(false);
  });
});
