import { describe, expect, it } from "vitest";
import {
  addizionaleComunaleDi,
  addizionaleDovuta,
  addizionaleRegionaleDi,
  aliquotaEffettiva,
  controllaScaglioni,
  descriviAddizionale,
  type Addizionale,
} from "./addizionali";
import { calcolaProspetto } from "./motore";
import { conScaglioni, conEsenzione, senzaDichiarazione, dichiarato } from "./parametri-utente";
import { impostazioniOrdinario, OGGI_FIXTURE } from "./fixture";
import { PARAMETRI_2026 } from "./parametri/2026";
import { frazioneDaPercentuale, round2 } from "./aritmetica";
import type { Fattura, Impostazioni, ScaglioneIrpef } from "./tipi";

/** Il Piemonte 2026: quattro scaglioni, come li pubblica la regione. */
const PIEMONTE: ScaglioneIrpef[] = [
  { limite: 15_000, aliquota: 0.0162 },
  { limite: 28_000, aliquota: 0.0268 },
  { limite: 50_000, aliquota: 0.0331 },
  { limite: null, aliquota: 0.0333 },
];

const unica = (aliquota: number): Addizionale => ({ aliquota, scaglioni: null, esenzione: 0 });
const aScaglioni = (scaglioni: ScaglioneIrpef[], esenzione = 0): Addizionale => ({
  aliquota: 0,
  scaglioni,
  esenzione,
});

describe("addizionali a scaglioni", () => {
  it("applica ogni fetta con la sua aliquota, non tutto con l'ultima", () => {
    // 30.000 € in Piemonte: 15.000 × 1,62 % + 13.000 × 2,68 % + 2.000 × 3,31 %.
    const atteso = round2(15_000 * 0.0162 + 13_000 * 0.0268 + 2_000 * 0.0331);
    expect(addizionaleDovuta(30_000, aScaglioni(PIEMONTE))).toBeCloseTo(atteso, 2);
    expect(atteso).toBeCloseTo(657.6, 2);

    // È il difetto da cui nasce tutto: chi mettesse l'aliquota del proprio
    // scaglione come aliquota unica pagherebbe molto di più.
    expect(addizionaleDovuta(30_000, unica(0.0331))).toBeCloseTo(993, 2);
  });

  it("dentro il primo scaglione i due modi coincidono", () => {
    expect(addizionaleDovuta(10_000, aScaglioni(PIEMONTE))).toBeCloseTo(
      addizionaleDovuta(10_000, unica(0.0162)),
      2,
    );
  });

  it("l'aliquota effettiva è quella che si è pagata davvero", () => {
    const eff = aliquotaEffettiva(30_000, aScaglioni(PIEMONTE));
    expect(eff).toBeGreaterThan(0.0162);
    expect(eff).toBeLessThan(0.0331);
  });

  it("la soglia di esenzione è una soglia, non una franchigia", () => {
    // Sotto: niente. Sopra: si paga sull'intero imponibile, non sull'eccedenza.
    const con = aScaglioni(PIEMONTE, 12_000);
    expect(addizionaleDovuta(12_000, con)).toBe(0);
    expect(addizionaleDovuta(11_999, con)).toBe(0);
    expect(addizionaleDovuta(12_001, con)).toBeCloseTo(
      addizionaleDovuta(12_001, aScaglioni(PIEMONTE)),
      2,
    );
    // Trattarla da franchigia darebbe l'imposta su un euro: quasi zero.
    expect(addizionaleDovuta(12_001, con)).toBeGreaterThan(190);
  });

  it("vale anche per la comunale, che di soglie ne ha quasi sempre", () => {
    const comunale = { aliquota: 0.008, scaglioni: null, esenzione: 15_000 };
    expect(addizionaleDovuta(15_000, comunale)).toBe(0);
    expect(addizionaleDovuta(20_000, comunale)).toBeCloseTo(160, 2);
  });

  it("niente imponibile, niente addizionale", () => {
    expect(addizionaleDovuta(0, aScaglioni(PIEMONTE))).toBe(0);
    expect(addizionaleDovuta(-500, unica(0.02))).toBe(0);
  });
});

describe("scaglioni scritti male", () => {
  it("l'ultimo scaglione non ha tetto", () => {
    expect(controllaScaglioni([{ limite: 15_000, aliquota: 0.02 }])).toMatch(/tetto/);
  });

  it("i limiti devono crescere", () => {
    const errore = controllaScaglioni([
      { limite: 28_000, aliquota: 0.02 },
      { limite: 15_000, aliquota: 0.03 },
      { limite: null, aliquota: 0.04 },
    ]);
    expect(errore).toMatch(/crescere/);
  });

  it("un'aliquota da IRPEF non è un'addizionale", () => {
    const errore = controllaScaglioni([
      { limite: 15_000, aliquota: 0.23 },
      { limite: null, aliquota: 0.33 },
    ]);
    expect(errore).toMatch(/punti percentuali/);
  });

  it("il Piemonte com'è scritto davvero passa", () => {
    expect(controllaScaglioni(PIEMONTE)).toBe(null);
  });
});

describe("come si racconta nel prospetto", () => {
  it("con gli scaglioni non si inventa un'aliquota unica", () => {
    const testo = descriviAddizionale(30_000, aScaglioni(PIEMONTE));
    expect(testo).toContain("a scaglioni");
    expect(testo).toContain("effettivo");
  });

  it("sotto la soglia lo dice, invece di mostrare una moltiplicazione per zero", () => {
    expect(descriviAddizionale(10_000, aScaglioni(PIEMONTE, 12_000))).toMatch(/esenzione/);
  });
});

describe("gli scaglioni nel motore", () => {
  const fattura: Fattura = {
    id: "f1",
    numero: "2026/001",
    dataEmissione: "2026-03-01",
    dataIncasso: "2026-04-01",
    clienteId: "c1",
    descrizione: "Progetto",
    tipoRicavo: "progetto",
    imponibile: 50_000,
  };

  function prospettoCon(imp: Impostazioni) {
    return calcolaProspetto({
      impostazioni: imp,
      parametri: PARAMETRI_2026,
      fatture: [fattura],
      costi: [],
      oggi: OGGI_FIXTURE,
    });
  }

  it("il prospetto usa gli scaglioni dichiarati", () => {
    const piatta = prospettoCon(impostazioniOrdinario());
    const conScala = prospettoCon(
      conScaglioni(impostazioniOrdinario(), "addizionaleRegionale", PIEMONTE),
    );
    expect(conScala.addizionaleRegionale).not.toBe(piatta.addizionaleRegionale);
    expect(conScala.addizionaleRegionale).toBeCloseTo(
      addizionaleDovuta(conScala.imponibile, aScaglioni(PIEMONTE)),
      2,
    );
    // E finisce nel totale delle imposte, non solo nella riga di dettaglio.
    expect(conScala.totaleImposte).not.toBe(piatta.totaleImposte);
  });

  it("dichiarare gli scaglioni conferma il parametro", () => {
    const dopo = conScaglioni(impostazioniOrdinario(), "addizionaleRegionale", PIEMONTE);
    expect(dichiarato(dopo, "addizionaleRegionale")).toBe(true);
    expect(addizionaleRegionaleDi(dopo, PARAMETRI_2026).scaglioni).toEqual(PIEMONTE);
  });

  it("la soglia da sola non conferma niente", () => {
    // Sopra la soglia si paga con un'aliquota che resta la media dell'app:
    // dire «confermato» qui sbloccherebbe il PDF su un numero inventato.
    const dopo = conEsenzione(impostazioniOrdinario(), "addizionaleComunale", 12_000);
    expect(dichiarato(dopo, "addizionaleComunale")).toBe(false);
    expect(addizionaleComunaleDi(dopo, PARAMETRI_2026).esenzione).toBe(12_000);
  });

  it("tornare a «non lo so» toglie anche scaglioni e soglia", () => {
    const con = conEsenzione(
      conScaglioni(impostazioniOrdinario(), "addizionaleRegionale", PIEMONTE),
      "addizionaleRegionale",
      12_000,
    );
    const pulito = senzaDichiarazione(con, "addizionaleRegionale", 0.0173);
    expect(dichiarato(pulito, "addizionaleRegionale")).toBe(false);
    expect(addizionaleRegionaleDi(pulito, PARAMETRI_2026).scaglioni).toBe(null);
    expect(addizionaleRegionaleDi(pulito, PARAMETRI_2026).esenzione).toBe(0);
    expect(pulito.addizionaleRegionale).toBe(0.0173);
  });
});

describe("le aliquote scritte a mano non portano la coda binaria", () => {
  it("1,62 % diventa 0,0162, non 0,016200000000000003", () => {
    // La coda finisce nell'archivio e nei backup: non cambia un conto, ma
    // sporca il dato salvato e si vede aprendo il file.
    expect(frazioneDaPercentuale(1.62)).toBe(0.0162);
    expect(frazioneDaPercentuale(3.33)).toBe(0.0333);
    expect(frazioneDaPercentuale(0)).toBe(0);
  });
});

describe("scegliere la forma non è ancora rispondere", () => {
  it("passare «a scaglioni» non conferma niente da solo", () => {
    // Le righe partono dall'aliquota media dell'app: contarle come dichiarate
    // sbloccherebbe il PDF su numeri che nessuno ha scritto.
    const seme: ScaglioneIrpef[] = [
      { limite: 15_000, aliquota: 0.0173 },
      { limite: null, aliquota: 0.0173 },
    ];
    const forma = conScaglioni(impostazioniOrdinario(), "addizionaleRegionale", seme, false);
    expect(dichiarato(forma, "addizionaleRegionale")).toBe(false);
    expect(addizionaleRegionaleDi(forma, PARAMETRI_2026).scaglioni).toEqual(seme);

    // Toccare una riga sì.
    const risposta = conScaglioni(forma, "addizionaleRegionale", PIEMONTE);
    expect(dichiarato(risposta, "addizionaleRegionale")).toBe(true);
  });
});
