import { describe, expect, it } from "vitest";
import { datiVetrina } from "@/lib/dati/vetrina";
import { riepilogoEffettivo, anniChiusi } from "@/lib/finanze/derivazione";
import { saldoConto } from "@/lib/finanze/saldo";

/**
 * Il registro personale della vetrina non cambia i numeri della vetrina.
 *
 * Il Cashflow del dataset dimostrativo ha un riepilogo mensile che esiste da
 * prima del modulo personale, ed è il numero che le schermate dell'attività
 * mostrano da sempre. Da quando quel riepilogo **si deriva dal registro**,
 * aggiungere movimenti vuol dire riscriverlo: un dataset che cambia i suoi
 * numeri perché gli abbiamo aggiunto una schermata non si può più usare per
 * confrontare niente — e le schermate di vendita sono fatte da lì.
 *
 * Questo test è il patto: i movimenti sono costruiti a partire dal riepilogo,
 * e la derivazione deve ritrovarlo identico. Se un giorno le cinque regole
 * cambiassero, o qualcuno toccasse un importo del registro, qui si vede
 * subito invece di scoprirlo in uno screenshot.
 */

describe("il registro della vetrina riproduce il riepilogo scritto a mano", () => {
  it("mese per mese, voce per voce", () => {
    const d = datiVetrina();
    const derivato = riepilogoEffettivo(
      d.movimentiPersonali,
      d.pfMovimenti,
      d.pfCategorie,
      anniChiusi(d.chiusure),
    );
    for (const scritto of d.movimentiPersonali) {
      const riga = derivato.find((r) => r.anno === scritto.anno && r.mese === scritto.mese)!;
      expect([riga.anno, riga.mese, riga.prelievi, riga.altreEntrate, riga.speseFisse, riga.speseVariabili, riga.risparmio])
        .toEqual([scritto.anno, scritto.mese, scritto.prelievi, scritto.altreEntrate, scritto.speseFisse, scritto.speseVariabili, scritto.risparmio]);
    }
    expect(derivato).toHaveLength(d.movimentiPersonali.length);
  });
});

describe("e i conti personali della vetrina restano in piedi", () => {
  it("il saldo di oggi è positivo su tutti e due", () => {
    const d = datiVetrina();
    for (const conto of d.pfConti) {
      expect(saldoConto(conto, d.pfMovimenti, "2026-09-05"), conto.nome).toBeGreaterThan(0);
    }
  });

  it("ogni movimento ha una categoria che esiste, tranne i giroconti", () => {
    const d = datiVetrina();
    const id = new Set(d.pfCategorie.map((c) => c.id));
    for (const m of d.pfMovimenti) {
      if (m.tipo === "giroconto") continue;
      expect(id.has(m.categoriaId), `${m.descrizione}: ${m.categoriaId}`).toBe(true);
    }
  });

  it("e nessun movimento è datato dopo il giorno di «oggi» della vetrina", () => {
    for (const m of datiVetrina().pfMovimenti) {
      expect(m.data <= "2026-09-05", `${m.id} ${m.data}`).toBe(true);
    }
  });
});
