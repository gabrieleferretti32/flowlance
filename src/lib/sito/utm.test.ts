import { describe, expect, it } from "vitest";
import { conUtm } from "./utm";
import { ROTTE, SITO } from "@/lib/rotte";

describe("conUtm", () => {
  it("mette la barra finale prima della query: niente rimando in mezzo", () => {
    expect(conUtm(SITO.acquisto, "simulatore")).toBe(
      "/acquista/?utm_source=simulatore&utm_medium=landing&utm_campaign=simulatore",
    );
  });

  it("non raddoppia la barra se c'è già", () => {
    expect(conUtm("/acquista/", "simulatore")).not.toContain("//?");
  });

  it("il mezzo si può cambiare, la sorgente è un elenco chiuso", () => {
    expect(conUtm(SITO.acquisto, "simulatore", "barra-mobile")).toContain("utm_medium=barra-mobile");
  });

  /*
    La tagliola sul posto sbagliato: dentro l'applicazione non c'è
    misurazione, quindi un parametro di campagna su una rotta di `/app` non lo
    legge nessuno. Il test non impedisce di scriverlo — impedisce di
    dimenticarsi perché non si fa, e fallisce il giorno in cui qualcuno
    cambia questa riga senza leggere il commento in `utm.ts`.
  */
  it("le rotte dell'app non sono destinazioni da misurare", () => {
    expect(ROTTE.cruscotto.startsWith("/app")).toBe(true);
    expect(SITO.acquisto.startsWith("/app")).toBe(false);
  });
});
