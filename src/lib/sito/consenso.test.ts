import { describe, expect, it } from "vitest";
import {
  CATEGORIE,
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

describe("le categorie sono separate davvero", () => {
  it("si può dire sì a una e no alle altre", () => {
    const scelta = { statistiche: true, registrazioni: false, pubblicita: false };
    const meta = nuovaScelta(scelta, ADESSO);
    expect(consensoEffettivo(meta, ADESSO)).toEqual(scelta);
  });

  /**
   * La profilazione pubblicitaria è una categoria sua, e questo test è il
   * posto in cui si nota il giorno in cui qualcuno prova a legarla alle
   * statistiche «perché tanto le accettano insieme».
   */
  it("**chi accetta le statistiche non ha accettato la pubblicità**", () => {
    const solo = nuovaScelta(
      { statistiche: true, registrazioni: true, pubblicita: false },
      ADESSO,
    );
    expect(consensoEffettivo(solo, ADESSO).pubblicita).toBe(false);
  });

  /**
   * E una risposta data quando la categoria non esisteva non vale per lei.
   *
   * È il motivo per cui `VERSIONE` è passata a 2: una scelta salvata alla
   * versione 1 non è più valida, quindi torna `NIENTE` e il banner ricompare.
   * Senza questo, chi aveva detto sì alle statistiche a settembre si sarebbe
   * ritrovato profilato senza che nessuno glielo chiedesse.
   */
  it("**una risposta data prima che la categoria esistesse non vale**", () => {
    const vecchia = { ...nuovaScelta(TUTTO, ADESSO), versione: 1 };
    expect(ancoraValida(vecchia, ADESSO)).toBe(false);
    expect(consensoEffettivo(vecchia, ADESSO)).toEqual(NIENTE);
  });

  it("le categorie dichiarate e le chiavi del consenso sono le stesse", () => {
    expect(CATEGORIE.map((c) => c.id).sort()).toEqual(Object.keys(TUTTO).sort());
  });

  it("ogni categoria dice cosa fa e chi la fa, senza perifrasi", () => {
    for (const c of CATEGORIE) {
      expect(c.cosaFa.length, c.id).toBeGreaterThan(40);
      expect(c.chi, c.id).toMatch(/·/);
    }
  });
});
