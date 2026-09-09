import { describe, expect, it } from "vitest";
import {
  MESI_DI_VALIDITA,
  NIENTE,
  TUTTO,
  VERSIONE,
  ancoraValida,
  consensoEffettivo,
  nuovaScelta,
  type Scelta,
} from "./consenso";

/**
 * Le regole del consenso, verificate senza montare niente.
 *
 * Quella che conta più di tutte è la prima: **in assenza di una risposta
 * valida non si accende niente.** Non «si accende e poi si spegne»: non si
 * accende. Ogni caso storto — memoria vuota, risposta scaduta, risposta di
 * quando le categorie erano altre, JSON illeggibile — deve cadere lì.
 */
const ADESSO = new Date("2026-09-09T10:00:00Z");

describe("in assenza di una risposta valida non si accende niente", () => {
  it("chi non ha mai risposto", () => {
    expect(consensoEffettivo(null, ADESSO)).toEqual(NIENTE);
    expect(ancoraValida(null, ADESSO)).toBe(false);
  });

  it("una risposta scaduta non vale, nemmeno se era un sì", () => {
    const vecchia = nuovaScelta(TUTTO, new Date("2026-03-08T10:00:00Z"));
    expect(consensoEffettivo(vecchia, ADESSO)).toEqual(NIENTE);
  });

  it("una risposta di quando le categorie erano altre non vale", () => {
    const altraVersione: Scelta = { ...nuovaScelta(TUTTO, ADESSO), versione: VERSIONE + 1 };
    expect(consensoEffettivo(altraVersione, ADESSO)).toEqual(NIENTE);
  });

  it("una data illeggibile non vale", () => {
    const rotta: Scelta = { consenso: TUTTO, il: "l'altro ieri", versione: VERSIONE };
    expect(consensoEffettivo(rotta, ADESSO)).toEqual(NIENTE);
  });
});

describe("la domanda non torna prima di sei mesi", () => {
  it("il giorno prima della scadenza vale ancora", () => {
    const quasi = new Date(ADESSO);
    quasi.setMonth(quasi.getMonth() - MESI_DI_VALIDITA);
    quasi.setDate(quasi.getDate() + 1);
    expect(ancoraValida(nuovaScelta(TUTTO, quasi), ADESSO)).toBe(true);
  });

  it("il giorno dopo no", () => {
    const passata = new Date(ADESSO);
    passata.setMonth(passata.getMonth() - MESI_DI_VALIDITA);
    passata.setDate(passata.getDate() - 1);
    expect(ancoraValida(nuovaScelta(TUTTO, passata), ADESSO)).toBe(false);
  });

  it("vale anche un no: chi ha rifiutato non se lo rivede per sei mesi", () => {
    const ieri = new Date(ADESSO);
    ieri.setDate(ieri.getDate() - 1);
    const rifiuto = nuovaScelta(NIENTE, ieri);
    expect(ancoraValida(rifiuto, ADESSO)).toBe(true);
    expect(consensoEffettivo(rifiuto, ADESSO)).toEqual(NIENTE);
  });
});

describe("le due categorie sono separate", () => {
  it("si può dire sì a una e no all'altra", () => {
    const meta = nuovaScelta({ statistiche: true, registrazioni: false }, ADESSO);
    expect(consensoEffettivo(meta, ADESSO)).toEqual({ statistiche: true, registrazioni: false });
  });
});
