import { describe, expect, it } from "vitest";
import { round0, round2, somma } from "./aritmetica";
import { percentuale } from "@/lib/format";
import { calcolaCosto, calcolaFattura, costoGrezzo, fatturaGrezza } from "./documenti";
import {
  COSTI_FIXTURE,
  FATTURE_FIXTURE,
  OGGI_FIXTURE,
  impostazioniForfettario,
  impostazioniOrdinario,
} from "./fixture";
import {
  baseAccontoContributi,
  calcolaAcconti,
  calcolaProspetto,
  contributiPrevidenziali,
  irpefScaglioni,
} from "./motore";
import { PARAMETRI_2026 } from "./parametri/2026";
import type { Costo, Fattura, Impostazioni, NotaCredito, VersamentoF24 } from "./tipi";

const par = PARAMETRI_2026;

function prospettoCon(imp: Impostazioni, extra: Partial<Parameters<typeof calcolaProspetto>[0]> = {}) {
  return calcolaProspetto({
    impostazioni: imp,
    parametri: par,
    fatture: FATTURE_FIXTURE,
    costi: COSTI_FIXTURE,
    oggi: OGGI_FIXTURE,
    ...extra,
  });
}

describe("aritmetica", () => {
  it("arrotonda come il foglio di calcolo, non come Math.round", () => {
    // Math.round(4324.9 * 0.15 * 100) / 100 darebbe 648.73: un centesimo di meno.
    expect(round2(4324.9 * 0.15)).toBe(648.74);
    expect(round2(5850 * 0.2607)).toBe(1525.1);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
  });

  it("arrotonda allontanandosi da zero anche sui negativi", () => {
    expect(round2(-4324.9 * 0.15)).toBe(-648.74);
    expect(round0(-2.5)).toBe(-3);
    expect(round0(2.5)).toBe(3);
  });

  it("non propaga NaN né Infinity", () => {
    expect(round2(Number.NaN)).toBe(0);
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0);
    expect(somma(1.1, Number.NaN, 2.2)).toBe(3.3);
  });
});

describe("IRPEF a scaglioni", () => {
  it("applica le aliquote progressive", () => {
    expect(irpefScaglioni(0, par.scaglioniIrpef)).toBe(0);
    expect(irpefScaglioni(20_000, par.scaglioniIrpef)).toBe(4600);
    expect(irpefScaglioni(28_000, par.scaglioniIrpef)).toBe(6440);
    // 28.000 × 23% + 22.000 × 33%
    expect(irpefScaglioni(50_000, par.scaglioniIrpef)).toBe(13_700);
    // + 10.000 × 43%
    expect(irpefScaglioni(60_000, par.scaglioniIrpef)).toBe(18_000);
  });

  it("non produce imposta su reddito negativo", () => {
    expect(irpefScaglioni(-5000, par.scaglioniIrpef)).toBe(0);
  });
});

// ————————————————————————————————————————————————————————————
// I due casi verificati a mano sull'Excel. Se falliscono, è sbagliato il motore.
// ————————————————————————————————————————————————————————————

describe("fixture obbligatorio · forfettario", () => {
  const p = prospettoCon(impostazioniForfettario());

  it("riproduce la catena al centesimo", () => {
    expect(p.ricaviRilevanti).toBe(7500);
    expect(p.redditoLordo).toBe(5850);
    expect(p.totaleContributi).toBe(1525.1);
    expect(p.imponibile).toBe(4324.9);
    expect(p.impostaSostitutiva).toBe(648.74);
    expect(p.totaleImposte).toBe(648.74);
    expect(p.caricoTotale).toBe(2173.84);
    // Sulla pressione controllo la cifra che l'utente legge, non un'approssimazione.
    expect(percentuale(p.pressione)).toBe("28,98 %");
  });

  it("senza IVA in fattura l'incassato lordo coincide con i ricavi rilevanti", () => {
    expect(p.ivaIncassata).toBe(0);
    expect(p.incassatoLordo).toBe(7500);
  });

  it("non deduce i costi e conta l'IVA sugli acquisti per intero", () => {
    expect(p.costiDeducibiliPagati).toBe(0);
    expect(p.ivaDetraibilePagata).toBe(0);
    expect(p.costiNettiACarico).toBe(1019.6);
    expect(p.nettoDisponibile).toBe(4306.56);
  });

  it("azzera l'IVA in fattura e applica il bollo", () => {
    const f = p.fattureCalcolate[0];
    expect(f.aliquotaIvaApplicata).toBe(0);
    expect(f.iva).toBe(0);
    expect(f.bollo).toBe(2);
    expect(f.totale).toBe(3002);
    // Addebitato al cliente: non è un costo.
    expect(p.bolloACarico).toBe(0);
  });

  it("segnala che l'anno contributivo non si accredita per intero", () => {
    expect(p.accreditoIntero).toBe(false);
  });
});

describe("fixture obbligatorio · ordinario", () => {
  const p = prospettoCon(impostazioniOrdinario());

  it("riproduce la catena al centesimo", () => {
    expect(p.ricaviRilevanti).toBe(7500);
    expect(p.costiDeducibiliPagati).toBe(980);
    expect(p.redditoLordo).toBe(6520);
    expect(p.totaleContributi).toBe(1699.76);
    expect(p.imponibile).toBe(4820.24);
    /*
      Qui il motore si stacca dall'Excel di partenza, e volutamente: il foglio
      non conteneva la detrazione per redditi di lavoro autonomo dell'art. 13
      TUIR, che spetta d'ufficio e che su 6.520 € di reddito complessivo vale
      più dell'IRPEF lorda. Con l'IRPEF azzerata cadono anche le addizionali,
      che sono dovute solo se l'IRPEF risulta dovuta. Restano i contributi.
    */
    expect(p.totaleImposte).toBe(0);
    expect(p.caricoTotale).toBe(1699.76);
    expect(p.nettoDisponibile).toBe(4820.24);
    expect(percentuale(p.pressione)).toBe("22,66 %");
  });

  it("scompone le imposte come il prospetto", () => {
    expect(p.irpefLorda).toBe(1108.66);
    // 500 + 765 × (28.000 − 6.520) ÷ 22.500 = 500 + 730,32. Nessuna
    // maggiorazione: 6.520 € è sotto la fascia 11.000–17.000.
    expect(p.detrazioneAutonomo).toBe(1230.32);
    // Incapiente: dell'intera detrazione se ne usano 1.108,66, il resto si perde.
    expect(p.detrazioniApplicate).toBe(1108.66);
    expect(p.irpefNetta).toBe(0);
    expect(p.addizionaleRegionale).toBe(0);
    expect(p.addizionaleComunale).toBe(0);
    expect(p.impostaSostitutiva).toBe(0);
  });

  it("recupera l'IVA sugli acquisti", () => {
    expect(p.ivaDetraibilePagata).toBe(39.6);
    expect(p.costiPagatiTotale).toBe(1019.6);
    expect(p.costiNettiACarico).toBe(980);
  });

  it("distingue il denaro entrato in cassa dai ricavi rilevanti", () => {
    // 7.500 € di compensi più 1.650 € di IVA incassata dai clienti:
    // in banca sono entrati 9.150 €, ma 1.650 € non sono mai stati tuoi.
    expect(p.ivaIncassata).toBe(1650);
    expect(p.incassatoLordo).toBe(9150);
    expect(p.ricaviRilevanti).toBe(7500);
  });

  it("applica l'IVA in fattura e niente bollo", () => {
    const f = p.fattureCalcolate[0];
    expect(f.aliquotaIvaApplicata).toBe(0.22);
    expect(f.iva).toBe(660);
    expect(f.bollo).toBe(0);
    expect(f.totale).toBe(3660);
  });
});

describe("detrazione dell'art. 13 dentro la catena", () => {
  /** Un solo compenso incassato, nessun costo: il reddito lordo è quello. */
  function ordinarioCon(compenso: number, extra: Partial<Impostazioni> = {}) {
    const fattura: Fattura = {
      id: "f", numero: "1", dataEmissione: "2026-01-10", dataIncasso: "2026-02-10",
      clienteId: "c", descrizione: "", tipoRicavo: "progetto", imponibile: compenso,
    };
    return calcolaProspetto({
      impostazioni: { ...impostazioniOrdinario(), ...extra },
      parametri: par, fatture: [fattura], costi: [], oggi: OGGI_FIXTURE,
    });
  }

  it("con un reddito medio la detrazione è parziale e le addizionali restano dovute", () => {
    /*
      Reddito lordo 40.000 → detrazione 500 × (50.000 − 40.000) ÷ 22.000 = 227,27.
      Contributi 40.000 × 26,07 % = 10.428. Imponibile 29.572.
      IRPEF 28.000 × 23 % + 1.572 × 33 % = 6.440 + 518,76 = 6.958,76.
      Netta 6.958,76 − 227,27 = 6.731,49.
    */
    const p = ordinarioCon(40_000);
    expect(p.redditoLordo).toBe(40_000);
    expect(p.detrazioneAutonomo).toBe(227.27);
    expect(p.irpefLorda).toBe(6_958.76);
    expect(p.irpefNetta).toBe(6_731.49);
    expect(p.detrazioniApplicate).toBe(227.27);
    // L'IRPEF è dovuta, quindi le addizionali si pagano: 29.572 × 1,73 % e × 0,8 %.
    expect(p.addizionaleRegionale).toBe(511.6);
    expect(p.addizionaleComunale).toBe(236.58);
  });

  it("sopra i 50.000 € di reddito complessivo la detrazione non spetta più", () => {
    const p = ordinarioCon(60_000);
    expect(p.redditoLordo).toBe(60_000);
    expect(p.detrazioneAutonomo).toBe(0);
    expect(p.irpefNetta).toBe(p.irpefLorda);
  });

  it("in forfettario non entra: non c'è IRPEF da cui detrarla", () => {
    const p = prospettoCon(impostazioniForfettario());
    expect(p.detrazioneAutonomo).toBe(0);
    expect(p.detrazioniTotali).toBe(0);
  });

  it("le detrazioni indicate a mano si sommano a quella dell'art. 13", () => {
    const p = ordinarioCon(40_000, { detrazioniPersonali: 300 });
    expect(p.detrazioniTotali).toBe(527.27);
    expect(p.irpefNetta).toBe(6_431.49);
  });
});

describe("ritenute d'acconto e note di credito", () => {
  const conRitenuta = { ...impostazioniOrdinario(), ritenutaAttiva: true };
  const fattura: Fattura = {
    id: "f", numero: "1", dataEmissione: "2026-01-10", dataIncasso: "2026-02-10",
    clienteId: "c", descrizione: "", tipoRicavo: "progetto", imponibile: 10_000,
  };
  function con(note: NotaCredito[], imp: Impostazioni = conRitenuta) {
    return calcolaProspetto({
      impostazioni: imp, parametri: par, fatture: [fattura], note, costi: [], oggi: OGGI_FIXTURE,
    });
  }

  it("uno storno riconciliato e rimborsato abbassa anche la base della ritenuta", () => {
    /*
      È il caso vero: la nota rettifica quella fattura, il committente ha
      trattenuto su quello che ha pagato davvero. 20 % su 8.000, non su 10.000.
    */
    const p = con([
      {
        id: "n", numero: "NC/1", dataDocumento: "2026-03-01", dataRimborso: "2026-04-01",
        clienteId: "c", descrizione: "", imponibile: 2_000,
        riconciliazioni: [{ fatturaId: "f", imponibile: 2_000 }],
      },
    ]);
    expect(p.compensiIncassati).toBe(8_000);
    expect(p.baseRitenute).toBe(8_000);
    expect(p.stornoDedottoDalleRitenute).toBe(2_000);
    expect(p.ritenuteSubite).toBe(1_600);
  });

  it("uno storno non riconciliato riduce i ricavi ma non la base della ritenuta", () => {
    // Senza aggancio non si sa a quale committente attribuirlo: attribuirlo a
    // caso sposterebbe la ritenuta di qualcun altro.
    const p = con([
      {
        id: "n", numero: "NC/1", dataDocumento: "2026-03-01", dataRimborso: "2026-04-01",
        clienteId: "c", descrizione: "", imponibile: 2_000,
      },
    ]);
    expect(p.compensiIncassati).toBe(8_000);
    expect(p.baseRitenute).toBe(10_000);
    expect(p.ritenuteSubite).toBe(2_000);
    expect(p.note.nonRiconciliato).toBe(2_000);
  });

  it("uno storno rimborsato l'anno dopo non tocca la ritenuta di quest'anno", () => {
    // La nota esiste e riduce l'IVA, ma il denaro non è ancora tornato: quello
    // che il committente ha trattenuto nel 2026 è calcolato sul lordo.
    const p = con([
      {
        id: "n", numero: "NC/1", dataDocumento: "2026-12-01", dataRimborso: "2027-01-15",
        clienteId: "c", descrizione: "", imponibile: 2_000,
        riconciliazioni: [{ fatturaId: "f", imponibile: 2_000 }],
      },
    ]);
    expect(p.compensiIncassati).toBe(10_000);
    expect(p.baseRitenute).toBe(10_000);
    expect(p.ritenuteSubite).toBe(2_000);
  });

  it("senza ritenuta in fattura la base resta a zero", () => {
    const p = con([], impostazioniOrdinario());
    expect(p.ritenuteSubite).toBe(0);
    expect(p.baseRitenute).toBe(0);
  });
});

describe("accantonamento e ritenute", () => {
  /*
    Stesso dataset, tre livelli di ritenuta. Il carico è identico in tutti e
    tre: cambia solo quanto di quel carico è già stato pagato, e quindi quanto
    ha senso chiedere di mettere da parte.

    Su 40.000 € incassati senza costi: contributi 40.000 × 26,07 % = 10.428;
    imponibile 29.572; IRPEF 6.958,76 meno 227,27 di detrazione = 6.731,49;
    addizionali 511,60 + 236,58. Imposte 7.479,67, carico 17.907,67.
  */
  const fattura: Fattura = {
    id: "f", numero: "1", dataEmissione: "2026-01-10", dataIncasso: "2026-02-10",
    clienteId: "c", descrizione: "", tipoRicavo: "progetto", imponibile: 40_000,
  };
  function scenario(extra: Partial<Impostazioni>, costi: Costo[] = [], credito = 0) {
    return calcolaProspetto({
      impostazioni: { ...impostazioniOrdinario(), ...extra },
      parametri: par, fatture: [fattura], costi, oggi: OGGI_FIXTURE,
      creditoAnnoPrecedente: credito,
    });
  }

  it("senza ritenuta si accantona tutto il carico", () => {
    const p = scenario({ ritenutaAttiva: false });
    expect(p.caricoTotale).toBe(17_907.67);
    expect(p.ritenuteSubite).toBe(0);
    expect(p.fabbisognoDaAccantonare).toBe(17_907.67);
    expect(p.accantonamentoMensile).toBe(1_492.31);
  });

  it("con la ritenuta al 20 % si accantona solo quello che resta da versare", () => {
    // 8.000 € li ha già trattenuti il committente: accantonarli di nuovo
    // vorrebbe dire mettere da parte due volte la stessa imposta.
    const p = scenario({ ritenutaAttiva: true });
    expect(p.caricoTotale).toBe(17_907.67);
    expect(p.ritenuteSubite).toBe(8_000);
    expect(p.fabbisognoDaAccantonare).toBe(9_907.67);
    expect(p.accantonamentoMensile).toBe(825.64);
    // La percentuale suggerita scende con la stessa base: 9.907,67 ÷ 40.000.
    expect(percentuale(p.percentualeTeoricaAccantonamento, 0)).toBe("25 %");
  });

  it("quando le ritenute superano il carico non c'è niente da accantonare", () => {
    /*
      35.000 € di costi deducibili: reddito lordo 5.000, contributi 1.303,50,
      IRPEF azzerata dalla detrazione piena. Carico 1.303,50 contro 8.000 € di
      ritenute già subite.
    */
    const costo: Costo = {
      id: "c1", dataDocumento: "2026-03-01", dataPagamento: "2026-03-01",
      fornitore: "", categoria: "", descrizione: "", natura: "variabile",
      imponibile: 35_000, aliquotaIva: 0, percentualeDeducibilita: 1,
    };
    const p = scenario({ ritenutaAttiva: true }, [costo]);
    expect(p.caricoTotale).toBe(1_303.5);
    expect(p.ritenuteSubite).toBe(8_000);
    expect(p.fabbisognoDaAccantonare).toBe(0);
    expect(p.accantonamentoMensile).toBe(0);
    expect(p.percentualeTeoricaAccantonamento).toBe(0);
  });

  it("anche il credito riportato dall'anno prima abbassa il fabbisogno", () => {
    const p = scenario({ ritenutaAttiva: true }, [], 2_000);
    expect(p.fabbisognoDaAccantonare).toBe(7_907.67);
  });

  it("uno scarto dentro la tolleranza non è un problema da segnalare", () => {
    /*
      Su 40.000 € di ricavi il fabbisogno è 17.907,67: la tolleranza è il 2 %,
      cioè 358,15 €. Accantonando il 44 % si mettono da parte 17.600, ne
      mancano 307,67 — meno della tolleranza. Chiedere un punto percentuale in
      più costerebbe 400 € l'anno per coprirne 308.
    */
    const p = scenario({ ritenutaAttiva: false, percentualeAccantonamento: 0.44 });
    expect(p.tolleranzaAccantonamento).toBe(358.15);
    expect(p.scostamentoAccantonamento).toBe(-307.67);
    expect(p.accantonamentoSufficiente).toBe(true);
  });

  it("uno scarto oltre la tolleranza resta un problema", () => {
    const p = scenario({ ritenutaAttiva: false, percentualeAccantonamento: 0.3 });
    expect(p.scostamentoAccantonamento).toBeLessThan(-p.tolleranzaAccantonamento);
    expect(p.accantonamentoSufficiente).toBe(false);
  });

  it("su cifre piccole la tolleranza è un importo, non una percentuale", () => {
    // Il 2 % di poche centinaia di euro sarebbe qualche euro: sotto quella
    // soglia si darebbero consigli per niente.
    const p = scenario({ ritenutaAttiva: false }, [], 17_500);
    expect(p.fabbisognoDaAccantonare).toBeLessThan(1_000);
    expect(p.tolleranzaAccantonamento).toBe(100);
  });

  it("il carico totale e il netto disponibile non si muovono", () => {
    // Sono corretti per competenza e rispondono a un'altra domanda.
    const senza = scenario({ ritenutaAttiva: false });
    const con = scenario({ ritenutaAttiva: true });
    expect(con.caricoTotale).toBe(senza.caricoTotale);
    expect(con.nettoDisponibile).toBe(senza.nettoDisponibile);
    expect(con.pressione).toBe(senza.pressione);
  });
});

describe("acconti delle addizionali", () => {
  /*
    Tre basi, tre regole. Su 40.000 € incassati in ordinario:
    IRPEF netta 6.731,49 → 40 % = 2.692,60 e 60 % = 4.038,89.
    Addizionale comunale 236,58 → 30 % = 70,97, tutto a giugno.
    Addizionale regionale 511,60 → niente: non ha acconto.
    Contributi 10.428 → 80 % in due rate da 4.171,20.
  */
  const fattura: Fattura = {
    id: "f", numero: "1", dataEmissione: "2026-01-10", dataIncasso: "2026-02-10",
    clienteId: "c", descrizione: "", tipoRicavo: "progetto", imponibile: 40_000,
  };
  const p = calcolaProspetto({
    impostazioni: impostazioniOrdinario(), parametri: par,
    fatture: [fattura], costi: [], oggi: OGGI_FIXTURE,
  });

  it("l'acconto dell'IRPEF si commisura all'imposta netta, non al totale imposte", () => {
    expect(p.irpefNetta).toBe(6_731.49);
    expect(p.acconti.imposte.primo).toBe(2_692.6);
    expect(p.acconti.imposte.secondo).toBe(4_038.89);
  });

  it("l'addizionale comunale va al 30 %, tutta a giugno", () => {
    expect(p.addizionaleComunale).toBe(236.58);
    expect(p.acconti.addizionali.primo).toBe(70.97);
    expect(p.acconti.addizionali.secondo).toBe(0);
  });

  it("l'addizionale regionale non entra in nessuna rata", () => {
    expect(p.addizionaleRegionale).toBe(511.6);
    // Se entrasse, la somma delle rate porterebbe i suoi 511,60 € da qualche parte.
    expect(p.acconti.primo).toBe(round2(2_692.6 + 70.97 + 4_171.2));
    expect(p.acconti.secondo).toBe(round2(4_038.89 + 4_171.2));
  });

  it("in forfettario le addizionali non esistono e l'acconto è tutto sostitutiva", () => {
    const f = calcolaProspetto({
      impostazioni: impostazioniForfettario(), parametri: par,
      fatture: [fattura], costi: [], oggi: OGGI_FIXTURE,
    });
    expect(f.acconti.addizionali.primo).toBe(0);
    expect(f.acconti.imposte.primo).toBe(round2(f.impostaSostitutiva * 0.4));
  });

  it("le ritenute abbassano la base dell'acconto, le addizionali no", () => {
    const conRitenuta = calcolaProspetto({
      impostazioni: { ...impostazioniOrdinario(), ritenutaAttiva: true }, parametri: par,
      fatture: [fattura], costi: [], oggi: OGGI_FIXTURE,
    });
    // 8.000 € di ritenute contro 6.731,49 di IRPEF netta: l'acconto d'imposta
    // si azzera, ma quello dell'addizionale comunale resta dov'è.
    expect(conRitenuta.acconti.imposte.primo).toBe(0);
    expect(conRitenuta.acconti.addizionali.primo).toBe(70.97);
  });
});

describe("acconti dentro il prospetto, gestione per gestione", () => {
  const fattura: Fattura = {
    id: "f", numero: "1", dataEmissione: "2026-01-10", dataIncasso: "2026-02-10",
    clienteId: "c", descrizione: "", tipoRicavo: "progetto", imponibile: 40_000,
  };
  const con = (extra: Partial<Impostazioni>) =>
    calcolaProspetto({
      impostazioni: { ...impostazioniOrdinario(), ...extra },
      parametri: par, fatture: [fattura], costi: [], oggi: OGGI_FIXTURE,
    });

  it("in Gestione Separata l'acconto contributivo è l'80 % in due rate uguali", () => {
    const p = con({ gestione: "separata" });
    expect(p.acconti.contributi.base).toBe(p.contributiGestioneSeparata);
    expect(p.acconti.contributi.primo).toBe(p.acconti.contributi.secondo);
    expect(round2(p.acconti.contributi.primo + p.acconti.contributi.secondo)).toBe(
      round2(p.contributiGestioneSeparata * 0.8),
    );
  });

  it("per gli artigiani l'acconto guarda solo la parte eccedente il minimale", () => {
    // I contributi fissi hanno le loro quattro rate trimestrali: contarli qui
    // li farebbe versare due volte.
    const fissi = impostazioniOrdinario().contributiFissi;
    const p = con({ gestione: "artigiani" });
    expect(p.acconti.contributi.base).toBe(round2(p.contributiArtigiani - fissi));
    expect(p.acconti.contributi.primo).toBe(p.acconti.contributi.secondo);
  });

  it("con una cassa professionale non si inventa un acconto contributivo", () => {
    const p = con({ gestione: "cassa" });
    expect(p.contributiCassa).toBeGreaterThan(0);
    expect(p.acconti.contributi.primo).toBe(0);
    expect(p.acconti.contributi.secondo).toBe(0);
    // Le imposte, invece, l'acconto ce l'hanno eccome.
    expect(p.acconti.imposte.primo).toBeGreaterThan(0);
  });
});

describe("versamenti per anno d'imposta", () => {
  const fattura: Fattura = {
    id: "f", numero: "1", dataEmissione: "2026-01-10", dataIncasso: "2026-02-10",
    clienteId: "c", descrizione: "", tipoRicavo: "progetto", imponibile: 40_000,
  };
  const con = (versamenti: VersamentoF24[]) =>
    calcolaProspetto({
      impostazioni: impostazioniForfettario(), parametri: par,
      fatture: [fattura], costi: [], versamenti, oggi: OGGI_FIXTURE,
    });

  it("il saldo dell'anno prima, versato a giugno, non scomputa il dovuto di quest'anno", () => {
    // È il caso per cui il campo esiste: stesso F24, due anni d'imposta.
    const p = con([
      { id: "a", data: "2026-06-30", tipo: "imposte", importo: 1_000, annoImposta: 2025 },
      { id: "b", data: "2026-06-30", tipo: "imposte", importo: 400, annoImposta: 2026 },
    ]);
    expect(p.giaVersato).toBe(400);
    expect(p.versamentiSenzaAnno).toBe(0);
  });

  it("un versamento senza anno vale per l'anno della data, e viene dichiarato", () => {
    const p = con([{ id: "a", data: "2026-06-30", tipo: "imposte", importo: 1_000 }]);
    expect(p.giaVersato).toBe(1_000);
    expect(p.versamentiSenzaAnno).toBe(1_000);
  });

  it("assegnare l'anno a un vecchio versamento lo toglie dal conto dichiarato", () => {
    const p = con([
      { id: "a", data: "2026-06-30", tipo: "imposte", importo: 1_000, annoImposta: 2026 },
    ]);
    expect(p.giaVersato).toBe(1_000);
    expect(p.versamentiSenzaAnno).toBe(0);
  });

  it("l'IVA resta fuori, con o senza anno d'imposta", () => {
    const p = con([{ id: "a", data: "2026-06-30", tipo: "iva", importo: 900, annoImposta: 2026 }]);
    expect(p.giaVersato).toBe(0);
  });

  it("i contributi si deducono per data di pagamento, non per anno d'imposta", () => {
    /*
      Due criteri sulla stessa tabella, ed è giusto così: un contributo si
      deduce nell'anno in cui esce dal conto, quale che sia l'anno d'imposta
      del debito che sta pagando.
    */
    const p = con([
      { id: "a", data: "2026-06-30", tipo: "contributi", importo: 3_000, annoImposta: 2025 },
    ]);
    expect(p.contributiDedotti).toBe(3_000);
    expect(p.fonteContributiDedotti).toBe("versamenti");
    // Ma dal dovuto del 2026 non scomputa niente.
    expect(p.giaVersato).toBe(0);
  });
});

// ————————————————————————————————————————————————————————————
// Casi limite
// ————————————————————————————————————————————————————————————

describe("casi limite", () => {
  it("reddito zero non produce imposte, contributi né divisioni per zero", () => {
    const p = calcolaProspetto({
      impostazioni: impostazioniForfettario(),
      parametri: par,
      fatture: [],
      costi: [],
      oggi: OGGI_FIXTURE,
    });
    expect(p.ricaviRilevanti).toBe(0);
    expect(p.redditoLordo).toBe(0);
    expect(p.totaleContributi).toBe(0);
    expect(p.totaleImposte).toBe(0);
    expect(p.pressione).toBe(0);
    expect(p.nettoDisponibile).toBe(0);
    expect(Number.isNaN(p.pressione)).toBe(false);
    expect(p.acconti.dovuti).toBe(false);
  });

  it("i contributi si fermano al massimale della Gestione Separata", () => {
    const imp = impostazioniForfettario();
    const soprailMassimale = imp.massimaleGs + 50_000;
    const c = contributiPrevidenziali(soprailMassimale, imp);
    expect(c.separata).toBe(round2(imp.massimaleGs * imp.aliquotaGestioneSeparata));
    expect(c.separata).toBe(31_882.31);
    // Un euro sopra il massimale non cambia il contributo.
    expect(contributiPrevidenziali(imp.massimaleGs + 1, imp).separata).toBe(c.separata);
  });

  it("artigiani e commercianti pagano i fissi più l'eccedenza sul minimale", () => {
    const imp = { ...impostazioniForfettario(), gestione: "artigiani" as const };
    // Sotto il minimale si versano solo i contributi fissi.
    expect(contributiPrevidenziali(10_000, imp).artigiani).toBe(4600);
    // Il minimale si legge dalle impostazioni, non si riscrive qui: è un valore
    // di legge che cambia ogni anno, e un numero fisso nel test avrebbe
    // continuato a passare anche col parametro sbagliato.
    expect(contributiPrevidenziali(imp.minimaleArtigiani + 10_000, imp).artigiani).toBe(
      round2(4600 + 10_000 * imp.aliquotaEccedenza),
    );
  });

  it("il minimale annuo è una costante sola, letta da due formule", () => {
    /*
      Nel 2026 se n'era aggiornata una copia e non l'altra: la Gestione
      Separata leggeva 18.808 € e gli artigiani 18.555 €, cioè il valore del
      2025. Ora è un campo solo nei parametri, e questo test lo tiene tale.
    */
    const imp = impostazioniForfettario();
    expect(imp.minimaleGs).toBe(par.minimaleAnnuo);
    expect(imp.minimaleArtigiani).toBe(par.minimaleAnnuo);
    expect(par.minimaleAnnuo).toBe(18_808);
  });

  it("il superamento degli 85.000 € tiene dentro l'anno e fa uscire dal successivo", () => {
    const p = prospettoConRicavo(90_000);
    expect(p.soglia.stato).toBe("limiteSuperato");
    expect(p.soglia.messaggio).toContain("1° gennaio successivo");
  });

  it("oltre i 100.000 € l'uscita è immediata", () => {
    const p = prospettoConRicavo(110_000);
    expect(p.soglia.stato).toBe("uscitaImmediata");
    expect(p.soglia.messaggio).toContain("stesso anno");
  });

  it("oltre l'85% del limite scatta l'avviso, non l'allarme", () => {
    const p = prospettoConRicavo(75_000);
    expect(p.soglia.stato).toBe("avviso");
    expect(p.soglia.utilizzoLimite).toBeCloseTo(75_000 / 85_000, 6);
  });

  it("la soglia guarda gli incassi, e tiene a fianco l'emesso non ancora incassato", () => {
    const p = prospettoCon(impostazioniForfettario());
    expect(p.soglia.baseCassa).toBe(7500);
    expect(p.soglia.baseCompetenza).toBe(10_000);
    expect(p.soglia.inSospeso).toBe(2500);
    expect(p.soglia.stato).toBe("neiLimiti");
  });

  it("ritenute superiori alle imposte producono un credito, non un saldo negativo", () => {
    const imp: Impostazioni = {
      ...impostazioniOrdinario(),
      ritenutaAttiva: true,
      detrazioniPersonali: 1200,
    };
    const p = prospettoCon(imp);
    expect(p.ritenuteSubite).toBe(1500); // 20% su 7.500 € incassati
    expect(p.totaleImposte).toBeLessThan(p.ritenuteSubite);
    expect(p.imposteNetteASaldo).toBe(0);
    expect(p.creditoImposta).toBe(round2(p.ritenuteSubite - p.totaleImposte));
    expect(p.creditoImposta).toBeGreaterThan(0);
  });

  it("in forfettario la ritenuta non si applica mai", () => {
    const p = prospettoCon({ ...impostazioniForfettario(), ritenutaAttiva: true });
    expect(p.ritenuteSubite).toBe(0);
    expect(p.fattureCalcolate.every((f) => f.ritenuta === 0)).toBe(true);
  });

  it("la rivalsa INPS concorre a formare il reddito in entrambi i regimi", () => {
    const p = prospettoCon({ ...impostazioniForfettario(), rivalsaAttiva: true });
    expect(p.rivalsaIncassata).toBe(300); // 4% su 7.500 €
    expect(p.ricaviRilevanti).toBe(7800);
    expect(p.redditoLordo).toBe(round2(7800 * 0.78));
  });

  it("il contributo integrativo della cassa non concorre al reddito", () => {
    const imp: Impostazioni = {
      ...impostazioniOrdinario(),
      gestione: "cassa",
      rivalsaAttiva: true,
    };
    const p = prospettoCon(imp);
    const f = p.fattureCalcolate[0];
    expect(f.integrativaCassa).toBe(120); // 4% su 3.000 €
    expect(f.rivalsa).toBe(0);
    expect(f.ricavoRilevante).toBe(3000);
    expect(p.ricaviRilevanti).toBe(7500);
    expect(p.contributiCassa).toBe(round2(p.redditoLordo * imp.aliquotaSoggettivaCassa));
  });

  it("il bollo non addebitato diventa un costo a carico", () => {
    const p = prospettoCon({ ...impostazioniForfettario(), bolloAddebitato: false });
    expect(p.bolloACarico).toBe(6); // tre fatture emesse nell'anno
    expect(p.costiNettiACarico).toBe(round2(1019.6 + 6));
  });

  it("sotto la soglia di 77,47 € il bollo non è dovuto", () => {
    const piccola: Fattura = {
      id: "fx",
      dataEmissione: "2026-04-01",
      numero: "2026/004",
      clienteId: "alfa",
      descrizione: "Micro consulenza",
      tipoRicavo: "unaTantum",
      imponibile: 70,
      dataIncasso: "2026-04-10",
    };
    const f = calcolaFattura(piccola, impostazioniForfettario(), OGGI_FIXTURE);
    expect(f.bollo).toBe(0);
  });

  it("i contributi versati con F24 prevalgono sulla competenza", () => {
    const senza = prospettoCon(impostazioniForfettario());
    expect(senza.fonteContributiDedotti).toBe("competenza");
    expect(senza.contributiDedotti).toBe(1525.1);

    const con = prospettoCon(impostazioniForfettario(), {
      versamenti: [{ id: "v1", data: "2026-06-30", tipo: "contributi", importo: 1200 }],
    });
    expect(con.fonteContributiDedotti).toBe("versamenti");
    expect(con.contributiDedotti).toBe(1200);
    expect(con.imponibile).toBe(round2(5850 - 1200));
  });

  it("stati e ritardi delle fatture rispettano la data di riferimento", () => {
    const p = prospettoCon(impostazioniForfettario());
    const [prima, seconda, terza] = p.fattureCalcolate;
    expect(prima.stato).toBe("incassato");
    expect(prima.giorniIncasso).toBe(26);
    expect(prima.giorniRitardo).toBe(0);
    expect(seconda.giorniIncasso).toBe(30);
    expect(terza.stato).toBe("scaduto");
    expect(terza.scadenza).toBe("2026-04-19");
    expect(terza.giorniRitardo).toBe(135);
    expect(terza.giorniIncasso).toBeNull();
  });
});

describe("acconti", () => {
  /** Costruisce le tre basi, riempiendo solo quelle che il caso vuole. */
  const basi = (b: Partial<Parameters<typeof calcolaAcconti>[0]>) => ({
    imposta: 0,
    addizionaleComunale: 0,
    contributi: { base: 0, regola: null },
    ...b,
  });

  it("sotto 51,65 € non si versa nulla", () => {
    expect(calcolaAcconti(basi({ imposta: 40 }), par).dovuti).toBe(false);
  });

  it("fra 51,65 e 257,52 € l'acconto è unico a novembre", () => {
    const a = calcolaAcconti(basi({ imposta: 200 }), par);
    expect(a.accontoUnico).toBe(true);
    expect(a.primo).toBe(0);
    expect(a.secondo).toBe(200);
  });

  it("sopra 257,52 € si divide in 40% e 60%", () => {
    const a = calcolaAcconti(basi({ imposta: 2173.84 }), par);
    expect(a.accontoUnico).toBe(false);
    expect(a.primo).toBe(869.54);
    expect(a.secondo).toBe(1304.3);
  });

  it("i contributi della Gestione Separata vanno all'80 % in due rate uguali", () => {
    // 10.000 € di contributi → acconto 8.000, cioè 4.000 e 4.000.
    const a = calcolaAcconti(basi({ imposta: 0, contributi: { base: 10_000, regola: par.accontoContributi.separata } }), par);
    expect(a.contributi.primo).toBe(4_000);
    expect(a.contributi.secondo).toBe(4_000);
    expect(a.primo).toBe(4_000);
    expect(a.secondo).toBe(4_000);
    expect(a.accontoUnico).toBe(false);
  });

  it("le due basi si sommano rata per rata, ognuna con la sua regola", () => {
    // Imposte 1.000 → 400 e 600. Contributi 10.000 → 4.000 e 4.000.
    const a = calcolaAcconti(basi({ imposta: 1_000, contributi: { base: 10_000, regola: par.accontoContributi.separata } }), par);
    expect(a.imposte).toEqual({ primo: 400, secondo: 600, unico: false });
    expect(a.primo).toBe(4_400);
    expect(a.secondo).toBe(4_600);
  });

  it("artigiani e commercianti: 100 % dell'eccedenza, in due rate del 50 %", () => {
    const a = calcolaAcconti(basi({ imposta: 0, contributi: { base: 3_000, regola: par.accontoContributi.artigiani } }), par);
    expect(a.contributi.primo).toBe(1_500);
    expect(a.contributi.secondo).toBe(1_500);
  });

  it("senza regola — le casse professionali — non si calcola nessun acconto contributivo", () => {
    const a = calcolaAcconti(basi({ imposta: 0, contributi: { base: 9_000, regola: par.accontoContributi.cassa } }), par);
    expect(a.contributi.primo).toBe(0);
    expect(a.contributi.secondo).toBe(0);
    expect(a.dovuti).toBe(false);
  });

  it("il centesimo dispari finisce nell'ultima rata, non sparisce", () => {
    // 8.000,01 × 80 % = 6.400,01: 3.200 e 3.200,01.
    const a = calcolaAcconti(basi({ imposta: 0, contributi: { base: 8_000.01, regola: par.accontoContributi.separata } }), par);
    expect(round2(a.contributi.primo + a.contributi.secondo)).toBe(6_400.01);
  });

  it("le soglie valgono sulle imposte, non sui contributi", () => {
    // 40 € di imposte non fanno acconto; 1.000 € di contributi sì.
    const a = calcolaAcconti(basi({ imposta: 40, contributi: { base: 1_000, regola: par.accontoContributi.separata } }), par);
    expect(a.imposte.primo).toBe(0);
    expect(a.imposte.secondo).toBe(0);
    expect(a.dovuti).toBe(true);
    expect(a.primo).toBe(400);
  });

  it("la base degli artigiani esclude i contributi fissi, che hanno le loro rate", () => {
    expect(
      baseAccontoContributi({
        gestione: "artigiani",
        contributiGestioneSeparata: 0,
        contributiArtigiani: 7_000,
        contributiFissi: 4_500,
      }),
    ).toBe(2_500);
    // Sotto il minimale non c'è eccedenza: nessun acconto.
    expect(
      baseAccontoContributi({
        gestione: "artigiani",
        contributiGestioneSeparata: 0,
        contributiArtigiani: 4_500,
        contributiFissi: 4_500,
      }),
    ).toBe(0);
  });
});

// Helper: un anno con un solo incasso del valore indicato.
function prospettoConRicavo(importo: number) {
  return calcolaProspetto({
    impostazioni: impostazioniForfettario(),
    parametri: par,
    fatture: [
      {
        id: "unica",
        dataEmissione: "2026-01-10",
        numero: "2026/001",
        clienteId: "alfa",
        descrizione: "Incarico annuale",
        tipoRicavo: "progetto",
        imponibile: importo,
        dataIncasso: "2026-02-10",
      },
    ],
    costi: [],
    oggi: OGGI_FIXTURE,
  });
}

describe("ritorno alla forma grezza", () => {
  const p = prospettoCon(impostazioniOrdinario());

  it("una fattura calcolata torna grezza senza portarsi dietro i derivati", () => {
    const calcolata = p.fattureCalcolate[0];
    const grezza = fatturaGrezza(calcolata);
    const vietati = [
      "iva", "rivalsa", "integrativaCassa", "bollo", "bolloACarico", "ritenuta",
      "totale", "nettoIncasso", "ricavoRilevante", "scadenza", "stato",
      "giorniIncasso", "giorniRitardo", "aliquotaIvaApplicata",
    ];
    for (const campo of vietati) expect(grezza).not.toHaveProperty(campo);
    expect(grezza).toEqual(FATTURE_FIXTURE[0]);
  });

  it("un costo calcolato torna grezzo e ricalcolato dà lo stesso risultato", () => {
    const calcolato = p.costiCalcolati[1];
    const grezzo = costoGrezzo(calcolato);
    for (const campo of ["iva", "totale", "costoDeducibile", "ivaDetraibile", "costoNetto", "stato"]) {
      expect(grezzo).not.toHaveProperty(campo);
    }
    expect(calcolaCosto(grezzo, impostazioniOrdinario())).toEqual(calcolato);
  });
})
