import { describe, expect, it, beforeEach } from "vitest";
import { impostazioniDellAnno } from "./azioni";
import { archivio, impostaArchivio } from "./archivio";
import { MemoriaAdapter } from "./memoria-adapter";
import { impostazioniPredefinite } from "@/lib/fisco/impostazioni";
import { conValoreDichiarato, dichiarato, ereditato } from "@/lib/fisco/parametri-utente";
import { parametriDi } from "@/lib/fisco/parametri";

/**
 * Cosa passa da un anno d'imposta al successivo.
 *
 * Il punto delicato non è il valore — quello si eredita, ed è giusto: è un
 * punto di partenza migliore della media dell'app. È l'etichetta. Un'aliquota
 * confermata per il 2026 che nel 2027 si presenta come «dichiarata da te» è
 * una risposta attribuita a un anno per cui nessuno l'ha data, mentre regioni
 * e comuni le ritoccano ogni gennaio.
 */
describe("l'anno nuovo eredita, ma lo dichiara", () => {
  beforeEach(() => {
    impostaArchivio(new MemoriaAdapter());
  });

  async function con2026Dichiarato() {
    const base = impostazioniPredefinite(parametriDi(2026));
    const dichiarate = conValoreDichiarato(
      { ...base, anno: 2026, regime: "ordinario", regione: "emilia-romagna", comune: "Bologna" },
      "addizionaleRegionale",
      0.0203,
    );
    await archivio().impostazioni.salva(dichiarate);
    return dichiarate;
  }

  it("porta avanti valore, regione e comune", async () => {
    const prima = await con2026Dichiarato();
    const dopo = await impostazioniDellAnno(2027);
    expect(dopo.addizionaleRegionale).toBe(prima.addizionaleRegionale);
    expect(dopo.regione).toBe("emilia-romagna");
    expect(dopo.comune).toBe("Bologna");
  });

  it("li marca ereditati, non dichiarati per l'anno nuovo", async () => {
    await con2026Dichiarato();
    const dopo = await impostazioniDellAnno(2027);
    expect(dichiarato(dopo, "addizionaleRegionale")).toBe(true);
    expect(ereditato(dopo, "addizionaleRegionale")).toBe(true);
  });

  it("l'anno in cui sono stati dichiarati non li marca", async () => {
    const prima = await con2026Dichiarato();
    expect(ereditato(prima, "addizionaleRegionale")).toBe(false);
  });

  it("dice da quale anno eredita, non «l'anno prima»", async () => {
    await con2026Dichiarato();
    // Saltando il 2027 l'eredità arriva dal 2026: scrivere 2027 sarebbe una
    // data precisa e falsa proprio sulla schermata che distingue i numeri veri
    // da quelli plausibili.
    const dopo = await impostazioniDellAnno(2028);
    expect(dopo.ereditatiDa).toBe(2026);
    expect(ereditato(dopo, "addizionaleRegionale")).toBe(true);
  });

  it("senza un anno precedente non c'è niente da ereditare", async () => {
    const dopo = await impostazioniDellAnno(2027);
    expect(dopo.ereditati ?? []).toEqual([]);
    expect(dichiarato(dopo, "addizionaleRegionale")).toBe(false);
  });

  it("quello che non era dichiarato non diventa ereditato", async () => {
    await con2026Dichiarato();
    const dopo = await impostazioniDellAnno(2027);
    // La comunale nel 2026 non era stata confermata: nel 2027 resta predefinita.
    expect(dichiarato(dopo, "addizionaleComunale")).toBe(false);
    expect(ereditato(dopo, "addizionaleComunale")).toBe(false);
  });
});
