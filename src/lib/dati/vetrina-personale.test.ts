import { describe, expect, it } from "vitest";
import { ANNO_VETRINA, datiVetrina } from "@/lib/dati/vetrina";
import { catenaAnni } from "@/lib/analisi/anno";
import { situazioneDelMese } from "@/lib/finanze/mese";
import { riepilogoEffettivo, anniChiusi } from "@/lib/finanze/derivazione";
import { saldoConto } from "@/lib/finanze/saldo";

/** Il giorno in cui la vetrina è ambientata. */
const OGGI_VETRINA = "2026-09-05";

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
      expect(saldoConto(conto, d.pfMovimenti, OGGI_VETRINA), conto.nome).toBeGreaterThan(0);
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
      expect(m.data <= OGGI_VETRINA, `${m.id} ${m.data}`).toBe(true);
    }
  });
});

/**
 * Il numero grande della quarta schermata di vendita, tenuto per il collo.
 *
 * «Quanto posso spendere» è l'unica schermata che promette una cifra da
 * seguire, e per mesi la vetrina ne ha mostrata una **negativa**: −9.753,05 €.
 * Non era un errore di calcolo — era il dataset che raccontava una freelance
 * che si preleva il netto e poi rimette da parte il fisco una seconda volta
 * (vedi APPROSSIMAZIONI.md, «Il prelievo netto tassato due volte»). Dal
 * momento in cui gli F24 escono dal conto personale il conto torna, ma torna
 * per una ragione che si può rompere di nuovo con una riga: basta alzare le
 * spese fisse, abbassare il prelievo, o rimettere gli F24 sul conto
 * dell'attività.
 *
 * Quindi il limite lo guarda un test, non uno screenshot: un margine che va
 * sotto zero fa fallire questo file, e non finisce sulla pagina di vendita.
 */
describe("e il limite del mese della vetrina resta positivo tutto l'anno", () => {
  const d = datiVetrina();
  const catena = catenaAnni(d, ANNO_VETRINA, OGGI_VETRINA);
  const situazione = situazioneDelMese({
    anno: ANNO_VETRINA,
    oggi: OGGI_VETRINA,
    calcolo: catena.get(ANNO_VETRINA)!,
    precedente: catena.get(ANNO_VETRINA - 1) ?? null,
    versamenti: d.versamenti,
    conti: d.pfConti,
    movimenti: d.pfMovimenti,
    categorie: d.pfCategorie,
    budget: d.pfBudget,
    // La stessa riga di `archivioDa`: l'elenco è vuoto, e vuoto vuol dire
    // «i valori di partenza», non «un oggetto senza campi».
    impostazioniPf: d.pfImpostazioni[0] ?? null,
  });

  it("nessuno dei dodici mesi promette una cifra negativa", () => {
    const negativi = situazione.righe.filter((r) => r.limite <= 0).map((r) => r.mese);
    expect(negativi).toEqual([]);
  });

  it("e in nessun mese importato si è speso più del limite", () => {
    const sforati = situazione.righe
      .filter((r) => r.conMovimenti && r.resta <= 0)
      .map((r) => `mese ${r.mese}: ${r.resta}`);
    expect(sforati).toEqual([]);
  });

  /*
    Stretto, non largo: il prodotto serve a chi il margine ce l'ha corto, e una
    vetrina che mostrasse duemila euro spendibili racconterebbe qualcun altro.
    I limiti stanno fra i 500 e i 1.200 €, e il mese in corso sotto gli 800.
  */
  it("ma nemmeno largo: è un conto stretto, e si deve vedere", () => {
    for (const riga of situazione.righe) {
      expect(riga.limite, `mese ${riga.mese}`).toBeLessThan(1_200);
    }
    expect(situazione.dalMese.resta).toBeLessThan(800);
    expect(situazione.effettivo.vincolo).toBe("mese");
  });

  /*
    Gli F24 del registro personale sono gli stessi che legge il motore fiscale.
    Due elenchi scritti a mano sarebbero due elenchi diversi il giorno che uno
    dei due cambia, e la differenza si vedrebbe solo confrontando il saldo del
    conto con la somma dei bonifici — cioè mai.
  */
  it("gli F24 sul conto personale sono quelli che il fisco conosce", () => {
    const daiVersamenti = d.versamenti
      .filter((v) => v.pagatoDa === "personale" && v.data <= OGGI_VETRINA)
      .map((v) => v.importo)
      .sort((a, b) => a - b);
    const coperte = new Set(
      d.pfCategorie.filter((c) => c.pagataDallAccantonamento).map((c) => c.id),
    );
    const dalRegistro = d.pfMovimenti
      .filter((m) => coperte.has(m.categoriaId))
      .map((m) => m.importo)
      .sort((a, b) => a - b);
    expect(dalRegistro).toEqual(daiVersamenti);
    expect(dalRegistro.length).toBeGreaterThan(0);
  });
});
