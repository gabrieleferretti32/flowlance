import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { catenaAnni } from "./anno";
import { datiVetrina } from "@/lib/dati/vetrina";
import type { Dati } from "@/lib/dati/tipi";

/**
 * Il fatturato previsto non deve toccare il fisco. Due tagliole.
 *
 * Non è una promessa da mantenere con la disciplina: è la riga che separa un
 * numero che stampi su un prospetto da un numero che ti sei scritto tu. Se un
 * giorno le due cose si mescolassero, il risultato non sarebbe un errore
 * visibile — sarebbe un prospetto plausibile con dentro un incasso che non
 * esiste, e il posto peggiore in cui finirebbe è il più silenzioso: la
 * liquidazione IVA, che da quel numero tira fuori l'importo di un F24.
 */
const FISCO = "src/lib/fisco";

/** Gli ingressi del motore, costruiti come li costruiscono le schermate. */
const ingressoDa = (d: Dati) => ({
  impostazioni: d.impostazioni,
  fatture: d.fatture,
  note: d.note,
  costi: d.costi,
  versamenti: d.versamenti,
  movimentiAttivita: d.movimentiAttivita,
  movimentiPersonali: d.movimentiPersonali,
  chiusure: d.chiusure,
});

function sorgenti(cartella: string): string[] {
  return readdirSync(cartella).flatMap((voce) => {
    const percorso = join(cartella, voce);
    if (statSync(percorso).isDirectory()) return sorgenti(percorso);
    return percorso.endsWith(".ts") || percorso.endsWith(".tsx") ? [percorso] : [];
  });
}

describe("**la previsione non entra nel motore fiscale**", () => {
  /*
    La prima tagliola legge il sorgente. È grossolana apposta: non cerca un
    collegamento, cerca **la parola**. Un motore fiscale che nomina una
    previsione, in qualunque modo e per qualunque ragione, è un motore da
    guardare — e questa riga è l'unica che se ne accorge prima di chi legge un
    prospetto sbagliato.
  */
  it("la parola non compare da nessuna parte sotto src/lib/fisco/", () => {
    const colpevoli = sorgenti(FISCO).filter((f) =>
      /prevision/i.test(readFileSync(f, "utf8")),
    );
    expect(
      colpevoli,
      "una previsione nominata dentro il motore fiscale: se serve davvero, serve una discussione, non un import",
    ).toEqual([]);
  });

  /*
    La seconda misura l'effetto. Lo stesso archivio, con e senza previsioni,
    deve produrre **lo stesso identico anno calcolato**: prospetto, carico,
    liquidazione IVA, tutto. Il confronto è sull'intero oggetto e non su
    qualche campo scelto a mano, perché i campi che si dimenticano sono
    esattamente quelli che nessuno pensa di controllare.
  */
  it("lo stesso archivio, con e senza previsioni, dà lo stesso anno calcolato", () => {
    const senza = datiVetrina();
    const con: Dati = {
      ...senza,
      previsioniFatturato: [
        { anno: 2026, importi: Array.from({ length: 12 }, () => 9_999), aggiornatoIl: "2026-10-01" },
        { anno: 2025, importi: Array.from({ length: 12 }, () => 4_444), aggiornatoIl: "2026-10-01" },
      ],
    };
    const oggi = "2026-10-01";
    const a = catenaAnni(ingressoDa(senza), 2026, oggi).get(2026);
    const b = catenaAnni(ingressoDa(con), 2026, oggi).get(2026);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});
