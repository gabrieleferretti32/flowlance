import { describe, expect, it } from "vitest";
import { avvisoBackup, contaDocumenti, promemoriaDopoExport, SOGLIE } from "./promemoria-backup";
import { datiVuoti, type Dati } from "./tipi";

const fattura = (id: string) => ({
  id,
  dataEmissione: "2026-03-01",
  numero: id,
  clienteId: "",
  descrizione: "",
  tipoRicavo: "progetto" as const,
  imponibile: 1000,
  dataIncasso: null,
});

function conDocumenti(quanti: number): Dati {
  return { ...datiVuoti(), fatture: Array.from({ length: quanti }, (_, i) => fattura(`f${i}`)) };
}

const OGGI = "2026-09-06T10:00:00.000Z";
const giorniFa = (n: number) =>
  new Date(Date.parse(OGGI) - n * 86_400_000).toISOString();

describe("quando ricordare il backup", () => {
  describe("nessun backup fatto mai", () => {
    it("sotto la soglia minima non dice niente", () => {
      // Chi sta ancora guardando l'app non ha niente da perdere, e un avviso
      // qui insegna solo a ignorare gli avvisi.
      expect(avvisoBackup(null, SOGLIE.MINIMO_PRIMO - 1, OGGI)).toBeNull();
    });

    it("dalla soglia in su lo dice, ed è il caso più grave", () => {
      const a = avvisoBackup(null, SOGLIE.MINIMO_PRIMO, OGGI);
      expect(a?.motivo).toBe("mai");
      expect(a?.giorni).toBeNull();
      expect(a?.titolo).toMatch(/mai fatto un backup/);
    });

    it("su un archivio vuoto tace", () => {
      expect(avvisoBackup(null, 0, OGGI)).toBeNull();
    });
  });

  describe("un backup c'è già", () => {
    const ieri = { fattoIl: giorniFa(1), documenti: 40 };

    it("niente di nuovo, niente da dire", () => {
      expect(avvisoBackup(ieri, 40, OGGI)).toBeNull();
    });

    it("qualche documento nuovo ma pochi: ancora niente", () => {
      expect(avvisoBackup(ieri, 40 + SOGLIE.DOCUMENTI_NUOVI - 1, OGGI)).toBeNull();
    });

    it("dieci documenti nuovi bastano, anche il giorno dopo", () => {
      const a = avvisoBackup(ieri, 40 + SOGLIE.DOCUMENTI_NUOVI, OGGI);
      expect(a?.motivo).toBe("documenti");
      expect(a?.nuovi).toBe(SOGLIE.DOCUMENTI_NUOVI);
    });

    it("un mese e un documento solo: basta il tempo", () => {
      const a = avvisoBackup({ fattoIl: giorniFa(SOGLIE.GIORNI), documenti: 40 }, 41, OGGI);
      expect(a?.motivo).toBe("tempo");
      expect(a?.giorni).toBe(SOGLIE.GIORNI);
    });

    it("un anno intero senza toccare niente: non disturba", () => {
      // È la condizione che distingue un avviso da un banner. L'archivio fermo
      // è già tutto dentro l'ultimo backup: non c'è niente da salvare.
      expect(avvisoBackup({ fattoIl: giorniFa(365), documenti: 40 }, 40, OGGI)).toBeNull();
    });

    it("un archivio che si è ridotto non conta come lavoro nuovo", () => {
      // Cancellare non è produrre: dopo aver eliminato dieci fatture non c'è
      // niente di nuovo da mettere al sicuro.
      expect(avvisoBackup({ fattoIl: giorniFa(2), documenti: 40 }, 30, OGGI)).toBeNull();
    });

    it("i documenti vincono sul tempo quando ci sono entrambi", () => {
      const a = avvisoBackup({ fattoIl: giorniFa(90), documenti: 40 }, 80, OGGI);
      expect(a?.motivo).toBe("documenti");
      expect(a?.giorni).toBe(90);
    });

    it("una data illeggibile non fa comparire un avviso inventato", () => {
      expect(avvisoBackup({ fattoIl: "non una data", documenti: 40 }, 41, OGGI)).toBeNull();
    });
  });

  describe("che cosa conta come documento", () => {
    it("conta il lavoro, non le impostazioni", () => {
      const dati = conDocumenti(3);
      dati.percorsi = [
        { id: "p", contesto: "primoAvvio", anno: 2026, confermati: [], saltati: [], completatoIl: null, aggiornatoIl: "" },
      ];
      // Percorsi e spunte si rifanno in minuti: nell'avviso sarebbero rumore.
      expect(contaDocumenti(dati)).toBe(3);
    });

    it("il promemoria dopo un export fotografa quanti erano", () => {
      const p = promemoriaDopoExport(conDocumenti(7), new Date(OGGI));
      expect(p.documenti).toBe(7);
      expect(p.fattoIl).toBe(OGGI);
      // …e da lì in poi l'avviso tace, che è tutto il punto.
      expect(avvisoBackup(p, 7, OGGI)).toBeNull();
    });
  });
});
