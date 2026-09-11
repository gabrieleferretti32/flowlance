import { describe, expect, it } from "vitest";
import { calcolaCosto, calcolaFattura } from "./documenti";
import { calcolaNota } from "./note";
import { calcolaIva } from "./iva";
import { impostazioniOrdinario, OGGI_FIXTURE } from "./fixture";
import { PARAMETRI_2026 } from "./parametri/2026";
import { acquistiAlConfine, scostamentiIva, versamentiPerPeriodo } from "./scostamento-iva";
import type { Costo, Fattura, NotaCredito } from "./tipi";

/**
 * Lo scostamento non si stima sommando l'IVA delle righe sospette: si calcola
 * rifacendo la liquidazione con `calcolaIva`. I test tengono la differenza fra
 * le due cose, che è tutta nel credito riportato e nella maggiorazione.
 */

const IMP = { ...impostazioniOrdinario(), periodicitaIva: "trimestrale" as const };

const fattura = (p: Partial<Fattura>): Fattura => ({
  id: "f",
  numero: "1",
  dataEmissione: "2026-07-10",
  dataIncasso: null,
  clienteId: "c",
  descrizione: "",
  tipoRicavo: "progetto",
  imponibile: 10_000,
  aliquotaIva: 0.22,
  ...p,
});

const costo = (p: Partial<Costo>): Costo => ({
  id: "c",
  dataDocumento: "2026-09-28",
  fornitore: "Fornitore",
  categoria: "Servizi",
  descrizione: "",
  natura: "variabile",
  imponibile: 1_000,
  aliquotaIva: 0.22,
  percentualeDeducibilita: 1,
  dataPagamento: "2026-09-28",
  ...p,
});

const nota = (p: Partial<NotaCredito>): NotaCredito => ({
  id: "n",
  dataDocumento: "2026-08-20",
  numero: "NC/1",
  clienteId: "c",
  descrizione: "",
  imponibile: 1_000,
  aliquotaIva: 0.22,
  dataRimborso: null,
  ...p,
});

function ingresso(f: Fattura[], c: Costo[], n: NotaCredito[] = [], imp = IMP) {
  return {
    fatture: f.map((x) => calcolaFattura(x, imp, OGGI_FIXTURE)),
    costi: c.map((x) => calcolaCosto(x, imp)),
    note: n.map((x) => calcolaNota(x, imp)),
    impostazioni: imp,
    parametri: PARAMETRI_2026,
  };
}

describe("quali acquisti stanno al confine del periodo", () => {
  it("l'ultima settimana del trimestre sì, il resto no", () => {
    const dentro = acquistiAlConfine(
      ingresso([], [costo({ id: "a", dataDocumento: "2026-09-28" })]).costi,
      2026,
      false,
    );
    expect(dentro.map((c) => c.id)).toEqual(["a"]);

    const fuori = acquistiAlConfine(
      ingresso([], [costo({ id: "b", dataDocumento: "2026-09-05" })]).costi,
      2026,
      false,
    );
    expect(fuori).toEqual([]);
  });

  it("a fine agosto no, perché agosto non è la fine di un trimestre", () => {
    const c = ingresso([], [costo({ dataDocumento: "2026-08-31" })]).costi;
    expect(acquistiAlConfine(c, 2026, false)).toEqual([]);
    // Con la liquidazione mensile invece quello stesso giorno è un confine.
    expect(acquistiAlConfine(c, 2026, true)).toHaveLength(1);
  });

  it("senza IVA detraibile non è sospetto di niente", () => {
    const c = ingresso([], [costo({ aliquotaIva: 0 })]).costi;
    expect(acquistiAlConfine(c, 2026, false)).toEqual([]);
  });
});

describe("cosa direbbe il periodo se l'ipotesi fosse vera", () => {
  const ing = ingresso(
    [fattura({ dataEmissione: "2026-07-10", imponibile: 10_000 })],
    [costo({ id: "c1", dataDocumento: "2026-09-28", imponibile: 1_000 })],
  );

  it("l'acquisto al confine sposta il numero del terzo trimestre", () => {
    const terzo = scostamentiIva(ing)[2];
    // 2.200 di debito meno 220 di credito = 1.980, più l'1 % = 1.999,80.
    expect(terzo.calcolato).toBe(1_999.8);
    const ricezione = terzo.cause.find((c) => c.chiave === "ricezione");
    expect(ricezione?.righe).toHaveLength(1);
    // Senza quei 220 di credito: 2.200 più l'1 % = 2.222.
    expect(ricezione?.seFosse).toBe(2_222);
    expect(ricezione?.effetto).toBe(222.2);
  });

  /**
   * **L'effetto non è l'IVA della riga.** Sono 220 € di IVA, e il numero del
   * trimestre si sposta di 222: la maggiorazione dell'1 % cresce con lui.
   * Sommare le righe avrebbe dato 220 — plausibile, e diverso da quello che
   * l'F24 direbbe davvero.
   */
  it("**non è la somma delle righe**: la maggiorazione cresce con il versamento", () => {
    const terzo = scostamentiIva(ing)[2];
    const ricezione = terzo.cause.find((c) => c.chiave === "ricezione");
    const ivaDelleRighe = ricezione?.righe.reduce((a, r) => a + r.iva, 0);
    expect(ivaDelleRighe).toBe(220);
    expect(ricezione?.effetto).toBe(222.2);
  });

  /**
   * Il difetto che si è visto solo guardando la schermata.
   *
   * La prima stesura spostava in un colpo tutti gli acquisti al confine
   * dell'anno, e su un periodo senza acquisti propri stampava «0 acquisti
   * datati negli ultimi giorni del periodo, 0,00 € di IVA» accanto a uno
   * scostamento di 52,70 €. Il numero era giusto: era l'effetto degli acquisti
   * del periodo **prima**, che gli arrivavano dentro. Etichetta sbagliata su un
   * numero giusto, che nessun test sui totali avrebbe visto.
   *
   * Ora sono due cause distinte, ognuna con le sue righe.
   */
  it("**quello che esce da un periodo arriva nel dopo, e si chiama diversamente**", () => {
    const conDebito = ingresso(
      [
        fattura({ id: "f1", dataEmissione: "2026-07-10", imponibile: 10_000 }),
        fattura({ id: "f2", dataEmissione: "2026-10-10", imponibile: 10_000 }),
      ],
      [costo({ id: "c1", dataDocumento: "2026-09-28", imponibile: 1_000 })],
    );
    const [, , terzo, quarto] = scostamentiIva(conDebito);

    expect(terzo.cause.map((c) => c.chiave)).toEqual(["ricezione"]);
    expect(quarto.cause.map((c) => c.chiave)).toEqual(["ricezioneDalPrecedente"]);

    // E nessuna causa esce senza le righe che la giustificano.
    for (const p of scostamentiIva(conDebito)) {
      for (const c of p.cause) {
        expect(c.righe.length, `${p.etichetta} · ${c.chiave} senza righe`).toBeGreaterThan(0);
      }
    }
    // Quello che il terzo non versa più, il quarto lo versa: effetti opposti.
    expect(terzo.cause[0].effetto).toBeGreaterThan(0);
    expect(quarto.cause[0].effetto).toBeLessThan(0);
  });

  it("una causa che non sposta il numero non si mostra", () => {
    // Quarto trimestre senza debito: il credito in più diventa credito a nuovo
    // e il da versare resta zero. Niente da spiegare, quindi niente da dire.
    const quarto = scostamentiIva(ing)[3];
    expect(quarto.calcolato).toBe(0);
    expect(quarto.cause).toEqual([]);
  });

  it("una fattura di dicembre ricevuta a gennaio esce dall'anno, e si vede", () => {
    const dicembre = ingresso(
      [fattura({ dataEmissione: "2026-10-10", imponibile: 10_000 })],
      [costo({ dataDocumento: "2026-12-29", imponibile: 2_000 })],
    );
    const quarto = scostamentiIva(dicembre)[3];
    const ricezione = quarto.cause.find((c) => c.chiave === "ricezione");
    expect(quarto.calcolato).toBe(1_760);
    expect(ricezione?.seFosse).toBe(2_200);
  });

  it("le note di credito sono la seconda causa, con le loro righe", () => {
    const conNota = ingresso(
      [fattura({ dataEmissione: "2026-07-10", imponibile: 10_000 })],
      [],
      [nota({ dataDocumento: "2026-08-20", imponibile: 1_000 })],
    );
    const terzo = scostamentiIva(conNota)[2];
    const causa = terzo.cause.find((c) => c.chiave === "note");
    expect(causa?.righe).toHaveLength(1);
    expect(causa?.effetto).toBe(222.2);
    expect(terzo.effettoMassimo).toBe(222.2);
  });

  it("le cause escono in ordine di peso, la più grossa per prima", () => {
    const due = ingresso(
      [fattura({ dataEmissione: "2026-07-10", imponibile: 10_000 })],
      [costo({ dataDocumento: "2026-09-28", imponibile: 500 })],
      [nota({ dataDocumento: "2026-08-20", imponibile: 3_000 })],
    );
    const terzo = scostamentiIva(due)[2];
    expect(terzo.cause.map((c) => c.chiave)).toEqual(["note", "ricezione"]);
  });

  it("archivio senza niente di sospetto: nessuna causa da mostrare", () => {
    const pulito = ingresso(
      [fattura({ dataEmissione: "2026-07-10" })],
      [costo({ dataDocumento: "2026-07-05" })],
    );
    expect(scostamentiIva(pulito).every((p) => p.cause.length === 0)).toBe(true);
  });

  it("in forfettario non c'è niente da confrontare", () => {
    const forf = ingresso([fattura({})], [costo({})], [], {
      ...IMP,
      regime: "forfettario" as const,
    });
    expect(scostamentiIva(forf)).toEqual([]);
  });
});

describe("a quale trimestre appartiene un F24 pagato", () => {
  const trimestri = calcolaIva([], [], IMP, PARAMETRI_2026).trimestri;
  const v = (id: string, data: string, importo: number) => ({ id, data, importo, tipo: "iva" });

  it("il versamento del 16 novembre è del terzo trimestre, non del quarto", () => {
    const per = versamentiPerPeriodo(trimestri, [v("a", "2026-11-16", 500)], 2026);
    expect(per.get(3)?.map((x) => x.id)).toEqual(["a"]);
  });

  it("pagato in ritardo resta del suo trimestre", () => {
    const per = versamentiPerPeriodo(trimestri, [v("a", "2026-11-28", 500)], 2026);
    expect(per.get(3)?.map((x) => x.id)).toEqual(["a"]);
  });

  /**
   * Il difetto che il primo rendering ha mostrato: sulla vetrina il confronto
   * si apriva con «5 versamenti IVA in questo periodo, 10.681,63 € in tutto»
   * contro 3.616,96 € calcolati. Erano gli F24 dell'anno prima, attribuiti al
   * primo trimestre perché pagati prima della sua scadenza.
   */
  it("**gli F24 dell'anno prima non entrano nel primo trimestre di questo**", () => {
    const per = versamentiPerPeriodo(
      trimestri,
      [
        v("vecchio", "2025-11-16", 4_000),
        { id: "marzo", data: "2026-03-16", importo: 900, tipo: "iva", annoImposta: 2025 },
        v("mio", "2026-05-16", 300),
      ],
      2026,
    );
    expect(per.get(1)?.map((x) => x.id)).toEqual(["mio"]);
    expect(per.size).toBe(1);
  });

  it("quello che non è IVA non entra", () => {
    const per = versamentiPerPeriodo(
      trimestri,
      [{ id: "x", data: "2026-11-16", importo: 900, tipo: "imposte" }],
      2026,
    );
    expect(per.size).toBe(0);
  });

  it("due versamenti sullo stesso trimestre restano due", () => {
    const per = versamentiPerPeriodo(
      trimestri,
      [v("a", "2026-11-16", 300), v("b", "2026-11-20", 200)],
      2026,
    );
    expect(per.get(3)).toHaveLength(2);
  });
});
