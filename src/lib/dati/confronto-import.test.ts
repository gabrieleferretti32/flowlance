import { describe, expect, it } from "vitest";
import { confrontaPerImport } from "./confronto-import";
import { datiVuoti, type Dati } from "./tipi";
import { impostazioniPredefinite } from "@/lib/fisco/impostazioni";
import { PARAMETRI_2026 } from "@/lib/fisco/parametri/2026";

function archivio(parti: Partial<Dati> = {}): Dati {
  return { ...datiVuoti(), ...parti };
}

function impostazioni(anno: number, nome: string, regime: "forfettario" | "ordinario") {
  return { ...impostazioniPredefinite(PARAMETRI_2026), anno, nome, regime };
}

const fattura = (id: string) => ({
  id,
  dataEmissione: "2026-03-01",
  numero: id,
  clienteId: "c1",
  descrizione: "",
  tipoRicavo: "progetto" as const,
  imponibile: 1000,
  dataIncasso: null,
});

describe("che cosa succede se importo questo file", () => {
  it("su un archivio vuoto non c'è niente da chiedere", () => {
    const c = confrontaPerImport(archivio(), archivio({ fatture: [fattura("a")] }));
    expect(c.archivioVuoto).toBe(true);
    expect(c.documentiPersi).toBe(0);
  });

  it("conta quello che sparisce, non la differenza netta", () => {
    // Dieci fatture diventano due, e zero costi diventano cinque: quello che si
    // perde è otto, non tre. La somma algebrica nasconderebbe la perdita.
    const attuale = archivio({ fatture: Array.from({ length: 10 }, (_, i) => fattura(`f${i}`)) });
    const nelFile = archivio({
      fatture: [fattura("f0"), fattura("f1")],
      costi: Array.from({ length: 5 }, (_, i) => ({
        id: `c${i}`,
        dataDocumento: "2026-01-01",
        fornitore: "",
        categoria: "Altro",
        descrizione: "",
        natura: "variabile" as const,
        imponibile: 10,
        aliquotaIva: 0.22,
        percentualeDeducibilita: 1,
        percentualeDetraibilitaIva: 1,
        dataPagamento: null,
      })),
    });
    const c = confrontaPerImport(attuale, nelFile);
    expect(c.archivioVuoto).toBe(false);
    expect(c.documentiPersi).toBe(8);
    expect(c.righe.find((r) => r.collezione === "fatture")).toMatchObject({
      adesso: 10,
      nelFile: 2,
      perse: 8,
    });
    // Una collezione vuota da entrambe le parti non compare: sarebbe rumore.
    expect(c.righe.map((r) => r.collezione)).toEqual(["fatture", "costi"]);
  });

  it("il cambio di regime si nota, ed è il più grave", () => {
    const c = confrontaPerImport(
      archivio({ impostazioni: [impostazioni(2026, "Studio", "forfettario")] }),
      archivio({ impostazioni: [impostazioni(2026, "Studio", "ordinario")] }),
    );
    expect(c.cambi).toEqual([
      { campo: "regime", anno: 2026, adesso: "forfettario", nelFile: "ordinario" },
    ]);
  });

  it("il cambio di nome dice che il file è di un altro archivio", () => {
    const c = confrontaPerImport(
      archivio({ impostazioni: [impostazioni(2026, "Studio di consulenza", "forfettario")] }),
      archivio({ impostazioni: [impostazioni(2026, "Marta Bianchi", "forfettario")] }),
    );
    expect(c.cambi).toEqual([
      { campo: "nome", anno: 2026, adesso: "Studio di consulenza", nelFile: "Marta Bianchi" },
    ]);
  });

  it("due cambi sullo stesso anno si dicono tutti e due", () => {
    const c = confrontaPerImport(
      archivio({ impostazioni: [impostazioni(2026, "Studio", "forfettario")] }),
      archivio({ impostazioni: [impostazioni(2026, "Marta", "ordinario")] }),
    );
    expect(c.cambi.map((x) => x.campo)).toEqual(["nome", "regime"]);
  });

  it("un anno che c'è da una parte sola non è un cambio", () => {
    // È una riga in più o in meno, e la conta delle collezioni lo dice già:
    // chiamarlo «cambio di regime» sarebbe un allarme per una cosa che non c'è.
    const c = confrontaPerImport(
      archivio({ impostazioni: [impostazioni(2025, "Studio", "forfettario")] }),
      archivio({ impostazioni: [impostazioni(2026, "Studio", "ordinario")] }),
    );
    expect(c.cambi).toEqual([]);
    expect(c.righe.find((r) => r.collezione === "impostazioni")).toMatchObject({
      adesso: 1,
      nelFile: 1,
      perse: 0,
    });
  });

  it("gli anni si guardano dal più recente", () => {
    const c = confrontaPerImport(
      archivio({
        impostazioni: [impostazioni(2025, "Studio", "forfettario"), impostazioni(2026, "Studio", "forfettario")],
      }),
      archivio({
        impostazioni: [impostazioni(2025, "Studio", "ordinario"), impostazioni(2026, "Studio", "ordinario")],
      }),
    );
    expect(c.cambi.map((x) => x.anno)).toEqual([2026, 2025]);
  });

  it("un nome vuoto da entrambe le parti non è un cambio", () => {
    const c = confrontaPerImport(
      archivio({ impostazioni: [impostazioni(2026, "", "forfettario")] }),
      archivio({ impostazioni: [impostazioni(2026, "  ", "forfettario")] }),
    );
    expect(c.cambi).toEqual([]);
  });
});
