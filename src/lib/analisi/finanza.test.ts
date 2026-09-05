import { describe, expect, it } from "vitest";
import { calcolaProspetto } from "@/lib/fisco/motore";
import { PARAMETRI_2026 } from "@/lib/fisco/parametri/2026";
import { ANNO_DEMO, datiDemo } from "@/lib/dati/demo";
import { calcolaCashflow, mesiDiAutonomia } from "./cashflow";
import { calcolaPatrimonio, calcolaPianificazione } from "./pianificazione";

const dati = datiDemo();
// Il dataset copre due anni: qui si guarda quello raccontato, non l'antefatto.
const impostazioni = dati.impostazioni.find((i) => i.anno === ANNO_DEMO)!;
const SALDO_INIZIALE = impostazioni.saldoInizialeAttivita;
const prospetto = calcolaProspetto({
  impostazioni,
  parametri: PARAMETRI_2026,
  fatture: dati.fatture,
  costi: dati.costi,
  versamenti: dati.versamenti,
  oggi: "2026-09-01",
});

const cashflow = calcolaCashflow({
  anno: ANNO_DEMO,
  saldoIniziale: impostazioni.saldoInizialeAttivita,
  percentualeAccantonamento: impostazioni.percentualeAccantonamento,
  fatture: prospetto.fattureCalcolate,
  costi: prospetto.costiCalcolati,
  versamenti: dati.versamenti,
  movimentiAttivita: dati.movimentiAttivita,
  movimentiPersonali: dati.movimentiPersonali,
});

describe("cashflow", () => {
  it("copre dodici mesi e parte dal saldo iniziale", () => {
    expect(cashflow.mesi).toHaveLength(12);
    expect(cashflow.saldoIniziale).toBe(SALDO_INIZIALE);
    const gennaio = cashflow.mesi[0];
    expect(gennaio.saldoCassa).toBe(
      Math.round((SALDO_INIZIALE + gennaio.flussoNetto) * 100) / 100,
    );
  });

  it("il saldo finale è il saldo iniziale più il flusso di tutto l'anno", () => {
    const flusso = cashflow.mesi.reduce((a, m) => a + m.flussoNetto, 0);
    expect(cashflow.saldoFinale).toBeCloseTo(SALDO_INIZIALE + flusso, 2);
    expect(cashflow.saldoFinale).toBeCloseTo(
      cashflow.saldoIniziale + cashflow.totaleEntrate - cashflow.totaleUscite,
      2,
    );
  });

  it("gli incassi seguono la data di accredito, non quella di emissione", () => {
    // La fattura di gennaio del retainer rientra a febbraio: gennaio non la vede.
    const gennaio = cashflow.mesi[0];
    const febbraio = cashflow.mesi[1];
    expect(gennaio.incassiClienti).toBe(0);
    expect(febbraio.incassiClienti).toBeGreaterThan(0);
  });

  it("gli F24 escono nel mese in cui sono stati versati", () => {
    const giugno = cashflow.mesi[5];
    /*
      Al 30 giugno escono insieme il saldo del 2025 e il primo acconto del
      2026. Qui comanda la data, non l'anno d'imposta: la cassa non sa di che
      anno è il debito che sta pagando.
    */
    const versatiAGiugno = dati.versamenti
      .filter((v) => v.data === `${ANNO_DEMO}-06-30`)
      .reduce((a, v) => a + v.importo, 0);
    expect(giugno.imposteEContributi).toBeCloseTo(versatiAGiugno, 2);
    expect(versatiAGiugno).toBeGreaterThan(0);

  });

  it("i prelievi personali escono dalla cassa dell'attività", () => {
    expect(cashflow.mesi[0].prelieviPersonali).toBe(1500);
    const prelievi = cashflow.mesi.reduce((a, m) => a + m.prelieviPersonali, 0);
    expect(prelievi).toBe(1500 * 12);
  });

  it("la liquidità netta è sempre sotto il saldo di cassa", () => {
    for (const m of cashflow.mesi) {
      expect(m.liquiditaNetta).toBeLessThanOrEqual(m.saldoCassa);
      expect(m.accantonamentoCumulato).toBeGreaterThanOrEqual(0);
    }
  });

  it("l'accantonamento si consuma quando si versa", () => {
    // A maggio l'accantonato è cresciuto; a giugno il versamento lo abbatte.
    const maggio = cashflow.mesi[4];
    const giugno = cashflow.mesi[5];
    expect(giugno.accantonamentoCumulato).toBeLessThan(maggio.accantonamentoCumulato);
  });

  it("la cassa del dataset dimostrativo non va mai sotto zero", () => {
    expect(cashflow.meseNegativo).toBeNull();
    expect(Math.min(...cashflow.mesi.map((m) => m.liquiditaNetta))).toBeGreaterThan(0);
    // Chiude l'anno con margine, ma non con troppo: è un anno vero. I limiti
    // si misurano sull'apertura, così restano veri anche se il dataset cresce.
    expect(cashflow.saldoFinale).toBeGreaterThan(SALDO_INIZIALE / 2);
    expect(cashflow.saldoFinale).toBeLessThan(SALDO_INIZIALE * 2);

    const inRosso = calcolaCashflow({
      anno: ANNO_DEMO,
      saldoIniziale: 0,
      percentualeAccantonamento: 0.3,
      fatture: [],
      costi: [],
      versamenti: [{ id: "v", data: "2026-03-15", tipo: "imposte", importo: 5000 }],
      movimentiAttivita: [],
      movimentiPersonali: [],
    });
    expect(inRosso.meseNegativo?.mese).toBe(3);
    expect(inRosso.meseNegativo?.saldoCassa).toBe(-5000);
  });

  it("calcola i mesi di autonomia, e tace se non sa la spesa", () => {
    expect(mesiDiAutonomia(9000, 1500)).toBe(6);
    expect(mesiDiAutonomia(9000, 0)).toBeNull();
  });
});

describe("pianificazione", () => {
  const base = {
    nettoDesiderato: 40_000,
    costiPrevisti: 12_000,
    pressione: 0.35,
    ticketMedio: 3000,
    tassoChiusura: 0.25,
    tassoConversione: 0.3,
    oreFatturabiliAnno: 1100,
    oreFatturabiliGiorno: 5,
    tariffaOraria: 80,
    costiFissiAnnui: 12_000,
  };
  const piano = calcolaPianificazione(base);

  it("risale dal netto voluto al fatturato necessario", () => {
    // (40.000 + 12.000) ÷ (1 − 0,35)
    expect(piano.fatturatoNecessario).toBe(80_000);
    expect(piano.fatturatoMensile).toBeCloseTo(6666.67, 2);
  });

  it("arriva fino ai contatti da coltivare ogni mese", () => {
    expect(piano.clientiNecessari).toBe(27);
    expect(piano.proposteNecessarie).toBe(108);
    expect(piano.contattiNecessari).toBe(360);
    expect(piano.contattiAlMese).toBe(30);
  });

  it("dice la tariffa minima e se quella attuale basta", () => {
    expect(piano.tariffaMinima).toBeCloseTo(72.73, 2);
    expect(piano.tariffaGiornalieraMinima).toBeCloseTo(363.64, 2);
    expect(piano.fatturatoPotenziale).toBe(88_000);
    expect(piano.saturazioneNecessaria).toBeCloseTo(0.909, 3);
    expect(piano.tariffaSufficiente).toBe(true);
  });

  it("segnala quando la tariffa non basta nemmeno riempiendo tutte le ore", () => {
    const stretto = calcolaPianificazione({ ...base, tariffaOraria: 50 });
    expect(stretto.saturazioneNecessaria).toBeGreaterThan(1);
    expect(stretto.tariffaSufficiente).toBe(false);
  });

  it("calcola il punto di pareggio in fatturato, ore e giorni", () => {
    expect(piano.pareggioFatturato).toBeCloseTo(18_461.54, 2);
    expect(piano.pareggioMensile).toBeCloseTo(1538.46, 2);
    expect(piano.pareggioOre).toBeCloseTo(230.77, 2);
    expect(piano.pareggioGiorni).toBeCloseTo(46.15, 2);
  });

  it("non promette l'infinito con una pressione impossibile", () => {
    const assurdo = calcolaPianificazione({ ...base, pressione: 1 });
    expect(Number.isFinite(assurdo.fatturatoNecessario)).toBe(true);
    expect(assurdo.fatturatoNecessario).toBe(5_200_000);
  });

  it("con un ticket medio a zero non divide per zero", () => {
    const senzaTicket = calcolaPianificazione({ ...base, ticketMedio: 0 });
    expect(senzaTicket.clientiNecessari).toBe(0);
    expect(senzaTicket.contattiAlMese).toBe(0);
  });
});

describe("stato patrimoniale", () => {
  const patrimonio = calcolaPatrimonio({
    liquiditaAttivita: 12_000,
    liquiditaPersonale: 1_800,
    creditiClienti: 6_100,
    creditoIva: 0,
    tasseAccantonate: 4_000,
    debitiFornitori: 414.8,
    debitoIva: 0,
    debitoImposte: 3_044.32,
    vociLibere: dati.patrimonio,
  });

  it("somma le voci derivate e quelle scritte a mano", () => {
    expect(patrimonio.totaleAttivo).toBeCloseTo(12_000 + 1_800 + 6_100 + 8_400 + 4_600 + 2_100, 2);
    expect(patrimonio.totalePassivo).toBeCloseTo(414.8 + 3_044.32 + 3_200, 2);
  });

  it("il patrimonio netto è la differenza", () => {
    expect(patrimonio.patrimonioNetto).toBeCloseTo(
      patrimonio.totaleAttivo - patrimonio.totalePassivo,
      2,
    );
  });

  it("distingue le voci derivate da quelle libere", () => {
    expect(patrimonio.attivo.find((v) => v.id === "crediti")?.derivata).toBe(true);
    expect(patrimonio.attivo.find((v) => v.id === "pat-01")?.derivata).toBe(false);
  });

  it("misura l'indice di liquidità immediata", () => {
    expect(patrimonio.indiceLiquidita).toBeCloseTo(
      (12_000 + 1_800) / (414.8 + 3_044.32),
      2,
    );
  });

  it("senza debiti a breve l'indice non ha senso e resta vuoto", () => {
    const senzaDebiti = calcolaPatrimonio({
      liquiditaAttivita: 5_000, liquiditaPersonale: 0, creditiClienti: 0, creditoIva: 0,
      tasseAccantonate: 0, debitiFornitori: 0, debitoIva: 0, debitoImposte: 0, vociLibere: [],
    });
    expect(senzaDebiti.indiceLiquidita).toBeNull();
  });
});
