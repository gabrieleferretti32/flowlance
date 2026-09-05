import { describe, expect, it } from "vitest";
import { calcolaProspetto } from "@/lib/fisco/motore";
import { PARAMETRI_2026 } from "@/lib/fisco/parametri/2026";
import { impostazioniPredefinite } from "@/lib/fisco/impostazioni";
import { datiDemo, ANNO_DEMO } from "@/lib/dati/demo";
import type { Fattura, NotaCredito } from "@/lib/fisco/tipi";
import { coloreDaNome } from "@/lib/format";
import {
  andamentoMensile,
  concentrazione,
  giorniMediIncasso,
  portafoglioClienti,
  scadutoPerFascia,
} from "./dashboard";

const dati = datiDemo();
// Il dataset copre due anni: qui interessa quello raccontato, non l'antefatto.
const impostazioni =
  dati.impostazioni.find((i) => i.anno === ANNO_DEMO) ?? impostazioniPredefinite(PARAMETRI_2026);
const prospetto = calcolaProspetto({
  impostazioni,
  parametri: PARAMETRI_2026,
  fatture: dati.fatture,
  costi: dati.costi,
  versamenti: dati.versamenti,
  oggi: "2026-09-01",
});

describe("andamento mensile", () => {
  const mesi = andamentoMensile(prospetto.fattureCalcolate, prospetto.costiCalcolati, ANNO_DEMO);

  it("restituisce sempre dodici mesi, anche quelli senza movimenti", () => {
    expect(mesi).toHaveLength(12);
    expect(mesi.map((m) => m.etichetta)).toEqual([
      "Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
    ]);
  });

  it("l'emesso dei dodici mesi somma al fatturato dell'anno", () => {
    const totale = mesi.reduce((a, m) => a + m.emesso, 0);
    expect(totale).toBe(46_050);
  });

  it("l'incassato somma ai ricavi rilevanti del prospetto", () => {
    const totale = Math.round(mesi.reduce((a, m) => a + m.incassato, 0) * 100) / 100;
    expect(totale).toBe(prospetto.ricaviRilevanti);
  });

  it("una fattura emessa e non incassata non entra fra gli incassi", () => {
    /*
      Il caso segnalato: a settembre le due colonne erano identiche mentre una
      fattura di settembre era ancora da incassare, e sembrava contata due
      volte. Qui c'è la stessa forma di dati — due fatture emesse il 1°
      settembre, una sola incassata, più una di giugno incassata a settembre —
      e le due colonne coincidono per coincidenza, non perché l'incasso
      mancante sia stato contato.
    */
    const imp = impostazioniPredefinite(PARAMETRI_2026);
    const fatture: Fattura[] = [
      {
        id: "18", numero: "18", dataEmissione: "2026-09-01", dataIncasso: null,
        clienteId: "c1", descrizione: "Gestione clienti AGOSTO", tipoRicavo: "ricorrente",
        imponibile: 1_200,
      },
      {
        id: "19", numero: "19", dataEmissione: "2026-09-01", dataIncasso: "2026-09-04",
        clienteId: "c2", descrizione: "Ricorrente", tipoRicavo: "ricorrente",
        imponibile: 992.5,
      },
      {
        id: "12", numero: "12", dataEmissione: "2026-06-15", dataIncasso: "2026-09-20",
        clienteId: "c1", descrizione: "Gestione clienti MAGGIO", tipoRicavo: "ricorrente",
        imponibile: 1_200,
      },
    ];
    const p = calcolaProspetto({
      impostazioni: imp, parametri: PARAMETRI_2026, fatture, costi: [], oggi: "2026-09-04",
    });
    const set = andamentoMensile(p.fattureCalcolate, p.costiCalcolati, 2026)[8];
    expect(set.emesso).toBe(2_192.5);
    expect(set.incassato).toBe(2_192.5);

    // La prova che non è contata: togliendo la fattura di giugno, l'incassato
    // di settembre resta quello della sola fattura davvero incassata.
    const senzaGiugno = calcolaProspetto({
      impostazioni: imp, parametri: PARAMETRI_2026, fatture: fatture.slice(0, 2), costi: [],
      oggi: "2026-09-04",
    });
    const soloSettembre = andamentoMensile(
      senzaGiugno.fattureCalcolate, senzaGiugno.costiCalcolati, 2026,
    )[8];
    expect(soloSettembre.emesso).toBe(2_192.5);
    expect(soloSettembre.incassato).toBe(992.5);
  });

  it("il grafico dice lo stesso numero della card: al netto degli storni", () => {
    /*
      Il cruscotto mostrava «Fatturato emesso 45.650 €» in una card e «Emesso
      46.050 €» nel grafico sotto: la differenza erano le note di credito,
      tolte da una parte e no dall'altra. Due numeri diversi sotto la stessa
      parola, a due centimetri di distanza.
    */
    const imp = impostazioniPredefinite(PARAMETRI_2026);
    const fattura: Fattura = {
      id: "f", numero: "1", dataEmissione: "2026-05-10", dataIncasso: "2026-06-10",
      clienteId: "c1", descrizione: "", tipoRicavo: "progetto", imponibile: 10_000,
    };
    const nota: NotaCredito = {
      id: "n", dataDocumento: "2026-05-20", numero: "NC/1", clienteId: "c1",
      descrizione: "", imponibile: 400, dataRimborso: "2026-07-01",
    };
    const p = calcolaProspetto({
      impostazioni: imp, parametri: PARAMETRI_2026, fatture: [fattura], note: [nota],
      costi: [], oggi: "2026-12-31",
    });
    const mesi = andamentoMensile(p.fattureCalcolate, p.costiCalcolati, 2026, p.noteCalcolate);

    // Maggio: emesso 10.000 meno lo storno di 400, che è del documento di maggio.
    expect(mesi[4].emesso).toBe(9_600);
    // Il rimborso cade a luglio: è lì che scende l'incassato, non a giugno.
    expect(mesi[5].incassato).toBe(10_000);
    expect(mesi[6].incassato).toBe(-400);

    // E i totali delle due serie coincidono con quelli del prospetto.
    const emessoAnno = mesi.reduce((a, m) => a + m.emesso, 0);
    const incassatoAnno = mesi.reduce((a, m) => a + m.incassato, 0);
    expect(emessoAnno).toBeCloseTo(p.fatturatoEmesso, 2);
    expect(incassatoAnno).toBeCloseTo(p.ricaviRilevanti, 2);
  });

  it("emesso e incassato misurano la stessa cosa in due momenti", () => {
    /*
      Le due serie stanno sullo stesso asse e si confrontano a vista: se una
      contasse la rivalsa e l'altra no, la stessa fattura darebbe due colonne
      diverse — e la differenza sembrerebbe un incasso mancante.
    */
    const conRivalsa = { ...impostazioniPredefinite(PARAMETRI_2026), rivalsaAttiva: true };
    const fattura: Fattura = {
      id: "r1", numero: "1", dataEmissione: "2026-04-10", dataIncasso: "2026-04-20",
      clienteId: "c1", descrizione: "Con rivalsa", tipoRicavo: "progetto", imponibile: 1_000,
    };
    const p = calcolaProspetto({
      impostazioni: conRivalsa, parametri: PARAMETRI_2026, fatture: [fattura], costi: [],
      oggi: "2026-04-20",
    });
    const aprile = andamentoMensile(p.fattureCalcolate, p.costiCalcolati, 2026)[3];
    expect(aprile.emesso).toBe(aprile.incassato);
    expect(aprile.emesso).toBeGreaterThan(1_000);
  });

  it("il cumulato è monotono quando i costi non superano gli incassi", () => {
    const gennaio = mesi[0];
    expect(gennaio.cumulatoIncassato).toBe(
      Math.round((gennaio.incassato - gennaio.costi) * 100) / 100,
    );
    const ultimo = mesi[11].cumulatoIncassato;
    expect(ultimo).toBeGreaterThan(0);
  });
});

describe("portafoglio clienti", () => {
  const portafoglio = portafoglioClienti(
    prospetto.fattureCalcolate, dati.clienti, ANNO_DEMO, coloreDaNome,
  );

  it("ordina dal cliente più grande al più piccolo", () => {
    const quote = portafoglio.map((r) => r.emesso);
    expect([...quote].sort((a, b) => b - a)).toEqual(quote);
    expect(portafoglio[0].nome).toBe("Alfa Srl");
    expect(portafoglio[0].emesso).toBe(18_000);
  });

  it("le quote sommano a uno", () => {
    const somma = portafoglio.reduce((a, r) => a + r.quota, 0);
    expect(somma).toBeCloseTo(1, 6);
  });

  it("misura la concentrazione del primo cliente", () => {
    expect(concentrazione(portafoglio)).toBeCloseTo(18_000 / 46_050, 6);
    expect(concentrazione([])).toBe(0);
  });

  it("dà a ogni cliente un colore stabile", () => {
    const secondo = portafoglioClienti(
      prospetto.fattureCalcolate, dati.clienti, ANNO_DEMO, coloreDaNome,
    );
    expect(portafoglio.map((r) => r.colore)).toEqual(secondo.map((r) => r.colore));
  });

  it("esclude i clienti senza movimenti nell'anno", () => {
    const conFantasma = [
      ...dati.clienti,
      { id: "cli-fantasma", nome: "Mai Fatturato", canaleAcquisizione: "", note: "" },
    ];
    const righe = portafoglioClienti(prospetto.fattureCalcolate, conFantasma, ANNO_DEMO, coloreDaNome);
    expect(righe.some((r) => r.id === "cli-fantasma")).toBe(false);
  });
});

describe("scaduto per fascia", () => {
  const fasce = scadutoPerFascia(prospetto.fattureCalcolate);

  it("divide il credito aperto fra termini e fasce di ritardo", () => {
    const totale =
      fasce.neiTermini + fasce.entro30 + fasce.entro60 + fasce.entro90 + fasce.oltre90;
    // Le quattro fatture aperte valgono 6.100 € più il bollo addebitato.
    expect(Math.round(totale)).toBe(6108);
    expect(fasce.totaleScaduto).toBe(
      Math.round((fasce.entro30 + fasce.entro60 + fasce.entro90 + fasce.oltre90) * 100) / 100,
    );
  });

  it("mette nella fascia lunga la fattura dimenticata", () => {
    // Zeta Digital, emessa il 24 giugno, scaduta il 24 luglio: oltre i 30 giorni.
    expect(fasce.entro60).toBe(902);
  });

  it("su un archivio vuoto restituisce zeri, non NaN", () => {
    const vuote = scadutoPerFascia([]);
    expect(vuote.totaleScaduto).toBe(0);
    expect(vuote.neiTermini).toBe(0);
  });
});

describe("giorni medi di incasso", () => {
  it("considera solo le fatture già incassate", () => {
    // 34 e non 35 da quando il dataset ha anche l'anno prima: la media si fa
    // su tutte le fatture dell'archivio, non su quelle dell'anno guardato.
    expect(giorniMediIncasso(prospetto.fattureCalcolate)).toBe(34);
  });

  it("senza incassi non inventa uno zero", () => {
    expect(giorniMediIncasso([])).toBeNull();
  });
});
