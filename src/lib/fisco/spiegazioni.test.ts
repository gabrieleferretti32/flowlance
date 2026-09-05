import { describe, expect, it } from "vitest";
import {
  COSTI_FIXTURE,
  FATTURE_FIXTURE,
  OGGI_FIXTURE,
  impostazioniForfettario,
  impostazioniOrdinario,
} from "./fixture";
import { round2 } from "./aritmetica";
import { calcolaAcconti, calcolaProspetto } from "./motore";
import { PARAMETRI_2026 } from "./parametri/2026";
import { euro, percentuale } from "@/lib/format";
import {
  descriviScaglioni,
  dettaglioSoglia,
  prospettoDettagliato,
  quotaLimite,
} from "./spiegazioni";
import { conValoreDichiarato } from "./parametri-utente";
import type { Fattura, Impostazioni, NotaCredito } from "./tipi";

const par = PARAMETRI_2026;

function sezioniDi(imp: Impostazioni, fatture = FATTURE_FIXTURE, costi = COSTI_FIXTURE) {
  const p = calcolaProspetto({
    impostazioni: imp, parametri: par, fatture, costi, oggi: OGGI_FIXTURE,
  });
  return { sezioni: prospettoDettagliato(p, imp, par), prospetto: p };
}

function riga(sezioni: ReturnType<typeof prospettoDettagliato>, id: string) {
  return sezioni.flatMap((s) => s.righe).find((r) => r.id === id);
}

describe("prospetto dettagliato", () => {
  it("copre le sei sezioni dell'Excel, nell'ordine", () => {
    const { sezioni } = sezioniDi(impostazioniForfettario());
    expect(sezioni.map((s) => s.lettera)).toEqual(["A", "B", "C", "D", "E", "F"]);
    expect(sezioni.map((s) => s.id)).toEqual([
      "base", "reddito", "imposte", "contributi", "sintesi", "acconti",
    ]);
  });

  it("ogni riga porta un valore, e quasi tutte una formula", () => {
    const { sezioni } = sezioniDi(impostazioniForfettario());
    const righe = sezioni.flatMap((s) => s.righe);
    expect(righe.length).toBeGreaterThan(20);
    for (const r of righe) {
      expect(r.valore).toBeDefined();
      expect(["euro", "percentuale", "testo"]).toContain(r.formato);
    }
    // Solo le righe di puro totale possono farne a meno.
    const senzaFormula = righe.filter((r) => !r.formula);
    expect(senzaFormula.every((r) => r.totale)).toBe(true);
  });

  it("spiega il reddito lordo forfettario con il coefficiente reale", () => {
    const { sezioni } = sezioniDi(impostazioniForfettario());
    expect(riga(sezioni, "reddito-lordo")?.formula).toBe(
      `${euro(7500)} × ${percentuale(0.78, 0)}, il coefficiente di redditività del tuo gruppo ATECO.`,
    );
  });

  it("spiega i contributi con la base e il massimale", () => {
    const { sezioni } = sezioniDi(impostazioniForfettario());
    const gs = riga(sezioni, "gestione-separata");
    expect(gs?.valore).toBe(1525.1);
    expect(gs?.formula).toBe(
      `${euro(5850)} × ${percentuale(0.2607, 2)}, fino al massimale di ${euro(122_295)}.`,
    );
  });

  it("scompone l'IRPEF negli scaglioni davvero applicati", () => {
    const imp = impostazioniOrdinario();
    const al = (q: number, a: number) => `${euro(q)} al ${percentuale(a, 0)}`;
    expect(descriviScaglioni(4820.24, imp)).toBe(
      `Scaglioni progressivi: ${al(4820.24, 0.23)}.`,
    );
    expect(descriviScaglioni(40_000, imp)).toBe(
      `Scaglioni progressivi: ${al(28_000, 0.23)}, poi ${al(12_000, 0.33)}.`,
    );
    expect(descriviScaglioni(60_000, imp)).toBe(
      `Scaglioni progressivi: ${al(28_000, 0.23)}, poi ${al(22_000, 0.33)}, poi ${al(10_000, 0.43)}.`,
    );
    expect(descriviScaglioni(0, imp)).toContain("Nessuna imposta");
  });

  it("in forfettario dice perché i costi non abbattono nulla", () => {
    const { sezioni } = sezioniDi(impostazioniForfettario());
    const costi = riga(sezioni, "costi-indeducibili");
    expect(costi?.valore).toBe(0);
    expect(costi?.formula).toContain("non si deducono analiticamente");
    expect(costi?.nota).toContain("coefficiente ATECO");
    expect(riga(sezioni, "costi-deducibili")).toBeUndefined();
  });

  it("in ordinario mostra le voci che il forfettario non ha", () => {
    const { sezioni } = sezioniDi(impostazioniOrdinario());
    expect(riga(sezioni, "irpef-lorda")).toBeDefined();
    expect(riga(sezioni, "add-regionale")).toBeDefined();
    expect(riga(sezioni, "iva-detraibile")).toBeDefined();
    expect(riga(sezioni, "sostitutiva")).toBeUndefined();
  });

  it("dichiara se i contributi dedotti vengono dai versamenti o dalla competenza", () => {
    const senza = sezioniDi(impostazioniForfettario());
    expect(riga(senza.sezioni, "contributi-dedotti")?.formula).toContain("competenza");

    const p = calcolaProspetto({
      impostazioni: impostazioniForfettario(),
      parametri: par,
      fatture: FATTURE_FIXTURE,
      costi: COSTI_FIXTURE,
      versamenti: [{ id: "v", data: "2026-06-30", tipo: "contributi", importo: 1200 }],
      oggi: OGGI_FIXTURE,
    });
    const conVersamenti = prospettoDettagliato(p, impostazioniForfettario(), par);
    expect(riga(conVersamenti, "contributi-dedotti")?.formula).toContain("per cassa");
  });

  it("segnala l'accredito parziale con il minimale a fianco", () => {
    const { sezioni } = sezioniDi(impostazioniForfettario());
    const accredito = riga(sezioni, "accredito");
    expect(accredito?.valore).toBe("Accredito parziale");
    expect(accredito?.formula).toContain(euro(18_808));
    expect(accredito?.nota).toContain("quasi nessuno dà");
  });

  it("mostra il credito d'imposta invece del saldo quando le ritenute eccedono", () => {
    const { sezioni } = sezioniDi({
      ...impostazioniOrdinario(), ritenutaAttiva: true, detrazioniPersonali: 1200,
    });
    expect(riga(sezioni, "credito")?.formula).toContain("non un saldo negativo");
    expect(riga(sezioni, "imposte-a-saldo")).toBeUndefined();
  });

  it("spiega perché gli acconti d'imposta non sono dovuti su importi minuscoli", () => {
    /*
      60 € di compenso: l'imposta sostitutiva è sotto la soglia dei 51,65 € e
      non fa acconto. I contributi invece l'acconto ce l'hanno comunque — la
      soglia è una regola delle imposte — quindi le due rate esistono, fatte
      di soli contributi, e la nota lo dice.
    */
    const piccola = [{ ...FATTURE_FIXTURE[0], imponibile: 60, dataIncasso: "2026-02-10" }];
    const { sezioni, prospetto } = sezioniDi(impostazioniForfettario(), piccola, []);
    expect(prospetto.imposteNetteASaldo).toBeLessThan(51.65);
    expect(prospetto.acconti.imposte.primo).toBe(0);
    expect(prospetto.acconti.imposte.secondo).toBe(0);
    expect(riga(sezioni, "acconti-non-dovuti")).toBeUndefined();
    const primo = riga(sezioni, "primo-acconto")!;
    expect(primo.valore).toBe(prospetto.acconti.contributi.primo);
    expect(primo.nota).toContain("di contributi");
    expect(primo.nota).not.toContain("di imposte");
  });

  it("dice di che cosa è fatta ogni rata di acconto", () => {
    const { sezioni, prospetto } = sezioniDi(impostazioniForfettario());
    const primo = riga(sezioni, "primo-acconto")!;
    const secondo = riga(sezioni, "secondo-acconto")!;
    // Imposte 40/60, contributi 80 % in due rate uguali: le due quote sono
    // scritte una per una, perché sulla somma non torna nessuna percentuale.
    expect(primo.nota).toContain(euro(prospetto.acconti.imposte.primo));
    expect(primo.nota).toContain(euro(prospetto.acconti.contributi.primo));
    // «il 80 %» in un documento che va dal commercialista si nota.
    expect(secondo.nota).toContain("l'80 %");
    expect(secondo.nota).not.toContain("il 80 %");
    expect(prospetto.acconti.contributi.primo).toBe(prospetto.acconti.contributi.secondo);
  });

  it("descrive la rateizzazione con e senza interessi", () => {
    const { sezioni } = sezioniDi(impostazioniForfettario());
    const rata = riga(sezioni, "rata");
    expect(rata?.formula).toContain("6 rate da giugno a novembre");
    expect(rata?.nota).toContain("Senza interessi");
  });

  it("dice quanto manca al limite forfettario", () => {
    const { prospetto } = sezioniDi(impostazioniForfettario());
    const testo = dettaglioSoglia(prospetto, impostazioniForfettario());
    expect(testo).toContain("puoi ancora incassare");
    expect(testo).toContain(euro(77_500));
  });

  it("in regime ordinario la soglia non si applica", () => {
    const { prospetto } = sezioniDi(impostazioniOrdinario());
    expect(dettaglioSoglia(prospetto, impostazioniOrdinario())).toBeNull();
  });

  it("chiama «tua» un'aliquota solo se l'hai dichiarata", () => {
    // È il difetto da cui nasce la schermata Parametri: la formula diceva
    // «l'aliquota della tua regione» sopra una media dell'app, e nessuno
    // sarebbe mai tornato a controllarla.
    const media = sezioniDi(impostazioniOrdinario());
    expect(riga(media.sezioni, "add-regionale")?.formula).toMatch(/predefinit/);
    expect(riga(media.sezioni, "add-comunale")?.formula).toMatch(/predefinit/);

    const dichiarata = conValoreDichiarato(impostazioniOrdinario(), "addizionaleRegionale", 0.0203);
    const dopo = sezioniDi(dichiarata);
    expect(riga(dopo.sezioni, "add-regionale")?.formula).toContain("della tua regione");
    // Quella comunale resta com'era: si dichiarano una per una.
    expect(riga(dopo.sezioni, "add-comunale")?.formula).toMatch(/predefinit/);
  });

  it("la quota di limite si misura sull'incassato, e dice dove si arriverebbe", () => {
    /*
      Il limite del forfettario è sui compensi percepiti, non sull'emesso: chi
      credesse il contrario si spaventerebbe a vuoto a novembre, o starebbe
      tranquillo mentre incassa oltre soglia. L'emesso serve però da preavviso,
      ed è l'unico modo in cui entra in questa domanda.
    */
    const imp = impostazioniForfettario();
    const fatture: Fattura[] = [
      // 60.000 incassati, 40.000 emessi e ancora da incassare.
      {
        id: "a", numero: "1", dataEmissione: "2026-02-01", dataIncasso: "2026-03-01",
        clienteId: "c1", descrizione: "", tipoRicavo: "progetto", imponibile: 60_000,
      },
      {
        id: "b", numero: "2", dataEmissione: "2026-11-01", dataIncasso: null,
        clienteId: "c1", descrizione: "", tipoRicavo: "progetto", imponibile: 40_000,
      },
    ];
    const { prospetto } = sezioniDi(imp, fatture, []);
    const q = quotaLimite(prospetto, imp)!;

    expect(prospetto.soglia.baseCassa).toBe(60_000);
    expect(prospetto.fatturatoEmesso).toBe(100_000);
    // Sotto il limite per cassa, oltre proiettando: è il preavviso.
    expect(q.usato).toBeCloseTo(60_000 / imp.limiteForfettario, 4);
    expect(q.oltreProiettando).toBe(true);
    expect(q.testo).toContain("sull'incassato");
    expect(q.testo).toContain("oltre il limite");
  });

  it("senza emesso in sospeso la quota non promette niente", () => {
    const imp = impostazioniForfettario();
    const fatture: Fattura[] = [
      {
        id: "a", numero: "1", dataEmissione: "2026-02-01", dataIncasso: "2026-03-01",
        clienteId: "c1", descrizione: "", tipoRicavo: "progetto", imponibile: 20_000,
      },
    ];
    const q = quotaLimite(sezioniDi(imp, fatture, []).prospetto, imp)!;
    expect(q.oltreProiettando).toBe(false);
    expect(q.testo).not.toContain("arriveresti");
  });

  it("in ordinario un limite non c'è, e non si inventa", () => {
    const { prospetto } = sezioniDi(impostazioniOrdinario());
    expect(quotaLimite(prospetto, impostazioniOrdinario())).toBeNull();
  });

  it("il fatturato emesso è al netto delle note di credito", () => {
    /*
      È il numero con cui si descrive il proprio anno: se una nota di credito
      non lo abbassasse, si racconterebbe un fatturato che non c'è stato.
    */
    const imp = impostazioniForfettario();
    const fattura: Fattura = {
      id: "a", numero: "1", dataEmissione: "2026-02-01", dataIncasso: null,
      clienteId: "c1", descrizione: "", tipoRicavo: "progetto", imponibile: 10_000,
    };
    const nota: NotaCredito = {
      id: "n", dataDocumento: "2026-03-01", numero: "NC/1", clienteId: "c1",
      descrizione: "", imponibile: 2_000, dataRimborso: null,
    };
    const conNota = calcolaProspetto({
      impostazioni: imp, parametri: par, fatture: [fattura], note: [nota], costi: [],
      oggi: OGGI_FIXTURE,
    });
    expect(conNota.fatturatoEmesso).toBe(8_000);
    expect(conNota.note.stornoEmesso).toBe(2_000);
  });

  it("le note di credito sono una voce a sé, fra due totali che tornano", () => {
    /*
      Su carta la colonna dei numeri si legge di seguito, e deve sommare: lordo,
      storno col segno meno, netto. Con il netto in cima e un «di cui» sotto,
      lo stesso storno sembrava da sottrarre una seconda volta.
    */
    const imp = impostazioniForfettario();
    const fattura: Fattura = {
      id: "a", numero: "1", dataEmissione: "2026-02-01", dataIncasso: "2026-03-01",
      clienteId: "c1", descrizione: "", tipoRicavo: "progetto", imponibile: 10_000,
    };
    const nota: NotaCredito = {
      id: "n", dataDocumento: "2026-03-01", numero: "NC/1", clienteId: "c1",
      descrizione: "", imponibile: 2_000, dataRimborso: "2026-04-01",
    };
    const p = calcolaProspetto({
      impostazioni: imp, parametri: par, fatture: [fattura], note: [nota], costi: [],
      oggi: OGGI_FIXTURE,
    });
    const sezioni = prospettoDettagliato(p, imp, par);
    const lordo = riga(sezioni, "fatture-incassate")!;
    const storno = riga(sezioni, "storno-note")!;
    const netto = riga(sezioni, "compensi")!;
    expect(lordo.valore).toBe(10_000);
    expect(storno.valore).toBe(-2_000);
    expect(netto.valore).toBe(8_000);
    expect(Number(lordo.valore) + Number(storno.valore)).toBe(Number(netto.valore));
    // E nell'ordine in cui si leggono.
    const idBase = sezioni[0].righe.map((r) => r.id);
    expect(idBase.slice(0, 3)).toEqual(["fatture-incassate", "storno-note", "compensi"]);
  });

  it("senza note di credito non compare nessuna riga di storno", () => {
    const { sezioni } = sezioniDi(impostazioniForfettario());
    expect(riga(sezioni, "fatture-incassate")).toBeUndefined();
    expect(riga(sezioni, "storno-note")).toBeUndefined();
    expect(riga(sezioni, "compensi")?.etichetta).toBe("Compensi incassati nell'anno");
  });

  it("la ritenuta dice su quale base è calcolata", () => {
    const imp: Impostazioni = { ...impostazioniOrdinario(), ritenutaAttiva: true };
    const fattura: Fattura = {
      id: "f", numero: "1", dataEmissione: "2026-01-10", dataIncasso: "2026-02-10",
      clienteId: "c", descrizione: "", tipoRicavo: "progetto", imponibile: 10_000,
    };
    const nota: NotaCredito = {
      id: "n", numero: "NC/1", dataDocumento: "2026-03-01", dataRimborso: "2026-04-01",
      clienteId: "c", descrizione: "", imponibile: 2_000,
      riconciliazioni: [{ fatturaId: "f", imponibile: 2_000 }],
    };
    const p = calcolaProspetto({
      impostazioni: imp, parametri: par, fatture: [fattura], note: [nota], costi: [],
      oggi: OGGI_FIXTURE,
    });
    const r = riga(prospettoDettagliato(p, imp, par), "ritenute")!;
    expect(r.valore).toBe(1_600);
    expect(r.formula).toContain(euro(8_000));
    expect(r.formula).toContain("riconciliate");
  });

  it("uno storno non riconciliato è dichiarato sotto la ritenuta", () => {
    const imp: Impostazioni = { ...impostazioniOrdinario(), ritenutaAttiva: true };
    const fattura: Fattura = {
      id: "f", numero: "1", dataEmissione: "2026-01-10", dataIncasso: "2026-02-10",
      clienteId: "c", descrizione: "", tipoRicavo: "progetto", imponibile: 10_000,
    };
    const nota: NotaCredito = {
      id: "n", numero: "NC/1", dataDocumento: "2026-03-01", dataRimborso: "2026-04-01",
      clienteId: "c", descrizione: "", imponibile: 2_000,
    };
    const p = calcolaProspetto({
      impostazioni: imp, parametri: par, fatture: [fattura], note: [nota], costi: [],
      oggi: OGGI_FIXTURE,
    });
    const r = riga(prospettoDettagliato(p, imp, par), "ritenute")!;
    expect(r.formula).toContain(euro(10_000));
    expect(r.nota).toContain("non sono riconciliati");
  });

  it("in ordinario la detrazione dell'art. 13 è una riga, anche quando è zero", () => {
    const { sezioni } = sezioniDi(impostazioniOrdinario());
    const r = riga(sezioni, "detrazione-autonomo")!;
    expect(r.formula).toContain("Art. 13");
    expect(r.nota).toContain("reddito complessivo");
    // In forfettario non esiste: non c'è IRPEF da cui detrarre.
    expect(riga(sezioniDi(impostazioniForfettario()).sezioni, "detrazione-autonomo")).toBeUndefined();
  });

  it("quando l'IRPEF si azzera, le addizionali dicono perché non sono dovute", () => {
    const { sezioni, prospetto } = sezioniDi(impostazioniOrdinario());
    expect(prospetto.irpefNetta).toBe(0);
    expect(riga(sezioni, "add-regionale")?.valore).toBe(0);
    expect(riga(sezioni, "add-regionale")?.nota).toContain("solo se l'IRPEF");
    expect(riga(sezioni, "add-comunale")?.nota).toContain("solo se l'IRPEF");
  });

  it("saldo, acconti e rate portano scritto l'anno in cui si versano", () => {
    // «A giugno» su un prospetto 2026 si legge giugno 2026, e il saldo del
    // 2026 si versa a giugno 2027.
    const { sezioni } = sezioniDi(impostazioniForfettario());
    // Il saldo si è diviso in due righe: quello che esce a novembre come
    // acconto e quello che resta per giugno.
    expect(riga(sezioni, "saldo")?.etichetta).toContain("2026");
    expect(riga(sezioni, "saldo-finale")?.etichetta).toContain("30 giugno 2027");
    expect(riga(sezioni, "primo-acconto")?.formula).toContain("30 giugno 2027");
    expect(riga(sezioni, "primo-acconto")?.etichetta).toContain("2027");
    expect(riga(sezioni, "secondo-acconto")?.formula).toContain("30 novembre 2027");
    expect(riga(sezioni, "rata")?.formula).toContain("novembre 2027");
  });

  it("il credito d'imposta ricompare in fondo, con che farne", () => {
    /*
      Comparire in C e sparire in F faceva sembrare il documento sbagliato:
      un numero che non torna più non si sa se è stato dimenticato o speso.
    */
    const imp: Impostazioni = { ...impostazioniOrdinario(), ritenutaAttiva: true };
    const fattura: Fattura = {
      id: "f", numero: "1", dataEmissione: "2026-01-10", dataIncasso: "2026-02-10",
      clienteId: "c", descrizione: "", tipoRicavo: "progetto", imponibile: 10_000,
    };
    const p = calcolaProspetto({
      impostazioni: imp, parametri: par, fatture: [fattura], costi: [], oggi: OGGI_FIXTURE,
    });
    expect(p.creditoImposta).toBeGreaterThan(0);
    const sezioni = prospettoDettagliato(p, imp, par);
    // Sta in F, non solo in C.
    const f = sezioni.find((s) => s.lettera === "F")!;
    const r = f.righe.find((x) => x.id === "credito-a-nuovo")!;
    expect(r.valore).toBe(p.creditoImposta);
    expect(r.formula).toContain("compensa in F24");
    expect(r.nota).toContain("riporto al 2027");
    expect(r.nota).toContain(euro(par.sogliaVistoCompensazione));
  });

  it("anche il versato in più dice dove finisce", () => {
    const imp = impostazioniForfettario();
    const p = calcolaProspetto({
      impostazioni: imp, parametri: par, fatture: FATTURE_FIXTURE, costi: COSTI_FIXTURE,
      versamenti: [{ id: "v", data: "2026-06-30", tipo: "imposte", importo: 9_000 }],
      oggi: OGGI_FIXTURE,
    });
    expect(p.saldoResiduo).toBe(0);
    const r = riga(prospettoDettagliato(p, imp, par), "eccedenza-versamenti")!;
    expect(r.valore).toBe(round2(9_000 - p.totaleDovuto));
    expect(r.formula).toContain("riporto al 2027");
  });

  it("la rata di giugno dice tutte e tre le sue quote", () => {
    const fattura: Fattura = {
      id: "f", numero: "1", dataEmissione: "2026-01-10", dataIncasso: "2026-02-10",
      clienteId: "c", descrizione: "", tipoRicavo: "progetto", imponibile: 40_000,
    };
    const imp = impostazioniOrdinario();
    const p = calcolaProspetto({
      impostazioni: imp, parametri: par, fatture: [fattura], costi: [], oggi: OGGI_FIXTURE,
    });
    const primo = riga(prospettoDettagliato(p, imp, par), "primo-acconto")!;
    expect(primo.nota).toContain("di IRPEF");
    expect(primo.nota).toContain("di addizionale comunale");
    expect(primo.nota).toContain("di contributi");
    expect(primo.nota).toContain("L'addizionale regionale non ha acconto");
    // A novembre l'addizionale comunale non ricompare: è già stata versata.
    const secondo = riga(prospettoDettagliato(p, imp, par), "secondo-acconto")!;
    expect(secondo.nota).not.toContain("addizionale comunale");
  });

  it("il versato per altri anni si vede, e si vede che non scomputa", () => {
    const imp = impostazioniForfettario();
    const p = calcolaProspetto({
      impostazioni: imp, parametri: par, fatture: FATTURE_FIXTURE, costi: COSTI_FIXTURE,
      versamenti: [
        { id: "v1", data: "2026-06-30", tipo: "imposte", importo: 1_140, annoImposta: 2025 },
        { id: "v2", data: "2026-06-30", tipo: "imposte", importo: 500, annoImposta: 2026 },
      ],
      oggi: OGGI_FIXTURE,
    });
    expect(p.giaVersato).toBe(500);
    const sezioni = prospettoDettagliato(p, imp, par);
    expect(riga(sezioni, "gia-versato")?.etichetta).toContain("anno d'imposta 2026");
    const altri = riga(sezioni, "versamenti-altri-anni")!;
    expect(altri.valore).toBe(1_140);
    expect(altri.formula).toContain("non scomputa");
  });

  it("il saldo si divide fra l'acconto di novembre e quello che resta a giugno", () => {
    /*
      Il difetto: «saldo 7.680,08 € al 30 giugno 2027» in una schermata e
      «secondo acconto 4.801,30 € al 30 novembre 2026» nell'altra, senza che
      nessuna delle due dicesse che il secondo sta dentro il primo.
    */
    const imp = impostazioniForfettario();
    const acconti = calcolaAcconti(
      { imposta: 1_200, addizionaleComunale: 0, contributi: { base: 0, regola: null } },
      par,
    );
    const p = calcolaProspetto({
      impostazioni: imp, parametri: par, fatture: FATTURE_FIXTURE, costi: COSTI_FIXTURE,
      accontiDelPrecedente: acconti, oggi: OGGI_FIXTURE,
    });
    // Acconti dovuti per l'anno 1.200, niente versato: tutti ancora da versare.
    expect(p.accontiAncoraDaVersare).toBe(1_200);
    expect(p.saldoDopoAcconti).toBe(round2(p.saldoResiduo - 1_200));

    const sezioni = prospettoDettagliato(p, imp, par);
    expect(riga(sezioni, "saldo")?.valore).toBe(p.saldoResiduo);
    expect(riga(sezioni, "acconti-in-corso")?.valore).toBe(1_200);
    expect(riga(sezioni, "saldo-finale")?.valore).toBe(p.saldoDopoAcconti);
    // Le due voci si sommano nel totale, e la nota lo dice invece di lasciarlo
    // dedurre: è il punto in cui prima si sommava due volte.
    expect(riga(sezioni, "saldo")?.nota).toContain("acconto di novembre");
  });

  it("gli acconti già versati non ricompaiono fra quelli da versare", () => {
    const imp = impostazioniForfettario();
    const acconti = calcolaAcconti(
      { imposta: 1_200, addizionaleComunale: 0, contributi: { base: 0, regola: null } },
      par,
    );
    const p = calcolaProspetto({
      impostazioni: imp, parametri: par, fatture: FATTURE_FIXTURE, costi: COSTI_FIXTURE,
      accontiDelPrecedente: acconti,
      versamenti: [
        { id: "v", data: "2026-06-30", tipo: "imposte", importo: 500, annoImposta: 2026 },
      ],
      oggi: OGGI_FIXTURE,
    });
    expect(p.giaVersato).toBe(500);
    expect(p.accontiAncoraDaVersare).toBe(700);
    expect(riga(prospettoDettagliato(p, imp, par), "acconti-in-corso")?.valore).toBe(700);
  });

  it("l'accantonamento e il «ancora da versare» sono lo stesso numero", () => {
    // Due righe dello stesso prospetto che rispondono alla stessa domanda.
    const { sezioni, prospetto } = sezioniDi(impostazioniForfettario());
    expect(prospetto.creditoImposta).toBe(0);
    expect(prospetto.fabbisognoDaAccantonare).toBe(prospetto.saldoResiduo);
    expect(riga(sezioni, "saldo")?.valore).toBe(prospetto.fabbisognoDaAccantonare);
    expect(riga(sezioni, "accantonamento-mensile")?.valore).toBe(
      round2(prospetto.saldoResiduo / 12),
    );
  });

  it("lo scostamento confronta due grandezze annuali, non una annuale e una residua", () => {
    /*
      Il 30 % dei ricavi accumula su tutto l'anno e ha già finanziato quello
      che è stato versato a giugno: confrontarlo con quello che resta da
      versare dichiarava un margine che non c'era.
    */
    const imp = impostazioniForfettario();
    const p = calcolaProspetto({
      impostazioni: imp, parametri: par, fatture: FATTURE_FIXTURE, costi: COSTI_FIXTURE,
      versamenti: [
        { id: "v", data: "2026-06-30", tipo: "imposte", importo: 800, annoImposta: 2026 },
      ],
      oggi: OGGI_FIXTURE,
    });
    // Il versato abbassa il residuo ma non quello che l'anno costa.
    expect(p.fabbisognoDaAccantonare).toBe(round2(p.fabbisognoAnnuo - 800));
    expect(p.fabbisognoAnnuo).toBe(p.totaleDovuto);
    expect(p.scostamentoAccantonamento).toBe(
      round2(p.accantonamentoAnnuo - p.fabbisognoAnnuo),
    );
    const sezioni = prospettoDettagliato(p, imp, par);
    expect(riga(sezioni, "scostamento")?.formula).toContain(euro(p.fabbisognoAnnuo));
    // La quota mensile resta sul residuo, ed è un'altra domanda: l'etichetta
    // non promette più una rata mensile da mettere via.
    expect(riga(sezioni, "accantonamento-mensile")?.etichetta).toBe("Quota mensile del fabbisogno");
    expect(riga(sezioni, "accantonamento-mensile")?.valore).toBe(
      round2(p.fabbisognoDaAccantonare / 12),
    );
  });

  it("con la ritenuta attiva e nessuna trattenuta, lo zero è scritto", () => {
    /*
      Su carta non si può chiedere all'app perché una voce manchi: chi applica
      la ritenuta in fattura deve leggere che quest'anno non gliene hanno
      trattenute, non trovare il nulla.
    */
    const imp: Impostazioni = { ...impostazioniOrdinario(), ritenutaAttiva: true };
    const fattura: Fattura = {
      id: "a", numero: "1", dataEmissione: "2026-02-01", dataIncasso: null,
      clienteId: "c1", descrizione: "", tipoRicavo: "progetto", imponibile: 10_000,
    };
    const { sezioni } = sezioniDi(imp, [fattura], []);
    const r = riga(sezioni, "ritenute")!;
    expect(r.valore).toBe(0);
    expect(r.formula).toContain("Nessun committente");
  });
});
