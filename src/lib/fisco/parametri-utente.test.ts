import { describe, expect, it } from "vitest";
import {
  aliquoteIrpefNonDichiarate,
  campiDaDichiarare,
  campiPertinenti,
  conComune,
  conEreditaConfermata,
  conRegione,
  conValoreDichiarato,
  conValoreProposto,
  dichiarato,
  ereditato,
  leggiValore,
  messaggioFuoriScala,
  nellaScala,
  noteDelValore,
  senzaDichiarazione,
  valoreDi,
  CAMPI_UTENTE,
} from "./parametri-utente";
import { conScaglioni } from "./parametri-utente";
import { esportazioneProspettoConsentita } from "./chiusura";
import { ALIQUOTA_BASE_REGIONALE, REGIONI, nomeRegione } from "./regioni";
import { impostazioniPredefinite } from "./impostazioni";
import { PARAMETRI_2026 } from "./parametri/2026";
import { PARAMETRI_2027 } from "./parametri/2027";
import type { Impostazioni } from "./tipi";

const base = impostazioniPredefinite(PARAMETRI_2026);
const ordinario: Impostazioni = { ...base, regime: "ordinario" };

describe("i parametri che solo l'utente conosce", () => {
  it("all'inizio non ne è dichiarato nessuno", () => {
    expect(base.dichiarati).toEqual([]);
    for (const c of CAMPI_UTENTE) expect(dichiarato(base, c.campo)).toBe(false);
  });

  it("chiede solo quello che ha senso nella configurazione", () => {
    const inForfettario = campiPertinenti(base).map((c) => c.campo);
    // Nel forfettario non c'è IRPEF: le addizionali non si applicano.
    expect(inForfettario).not.toContain("addizionaleRegionale");
    expect(inForfettario).not.toContain("addizionaleComunale");
    expect(campiPertinenti(ordinario).map((c) => c.campo)).toContain("addizionaleComunale");

    // I contributi fissi sono degli artigiani, l'aliquota soggettiva di chi ha
    // una cassa: chiederli a chi sta in Gestione Separata sarebbe rumore.
    expect(inForfettario).not.toContain("contributiFissi");
    expect(
      campiPertinenti({ ...base, gestione: "artigiani" }).map((c) => c.campo),
    ).toContain("contributiFissi");
    expect(campiPertinenti({ ...base, gestione: "cassa" }).map((c) => c.campo)).toContain(
      "aliquotaSoggettivaCassa",
    );
  });

  it("dichiarare scrive il valore e lo marca", () => {
    const dopo = conValoreDichiarato(ordinario, "addizionaleComunale", 0.006);
    expect(dopo.addizionaleComunale).toBe(0.006);
    expect(dichiarato(dopo, "addizionaleComunale")).toBe(true);
    // L'originale non si tocca: le impostazioni si salvano, non si mutano.
    expect(dichiarato(ordinario, "addizionaleComunale")).toBe(false);
  });

  it("in un campo « % » si scrivono punti percentuali, sempre", () => {
    const d = CAMPI_UTENTE.find((c) => c.campo === "addizionaleComunale")!;
    // Lo 0,6 % del comune cade nella zona in cui «è già una frazione o sono
    // punti percentuali?» non si può indovinare: nel campo marcato «%» sono
    // punti percentuali, e leggerlo come 60 % moltiplicherebbe l'imposta.
    expect(leggiValore("0,6", d)).toBeCloseTo(0.006, 6);
    expect(leggiValore("0,8", d)).toBeCloseTo(0.008, 6);
    expect(leggiValore("", d)).toBe(null);
    expect(nellaScala(0.006, d)).toBe(true);
    // Otto punti percentuali di addizionale comunale non esistono.
    expect(nellaScala(0.08, d)).toBe(false);
    expect(messaggioFuoriScala(d)).toMatch(/punti percentuali/);

    const giorni = CAMPI_UTENTE.find((c) => c.campo === "giorniLavorativi")!;
    expect(leggiValore("220", giorni)).toBe(220);
  });

  it("un valore fuori scala è un errore di battitura, non una scelta", () => {
    // 8 invece di 0,8 %: senza limite diventerebbe l'800 % e il prospetto
    // mostrerebbe un'imposta mostruosa presentata come dichiarata dall'utente.
    const dopo = conValoreDichiarato(ordinario, "addizionaleComunale", 8);
    expect(dopo.addizionaleComunale).toBe(0.01);
  });

  it("si può tornare a dire «non lo so»", () => {
    const dichiarata = conValoreDichiarato(ordinario, "addizionaleRegionale", 0.03);
    const annullata = senzaDichiarazione(
      dichiarata,
      "addizionaleRegionale",
      base.addizionaleRegionale,
    );
    expect(dichiarato(annullata, "addizionaleRegionale")).toBe(false);
    expect(annullata.addizionaleRegionale).toBe(base.addizionaleRegionale);
  });

  it("il valore si chiama «tuo» solo se lo è", () => {
    expect(noteDelValore(ordinario, "addizionaleComunale")).toMatch(/predefinit/);
    const dopo = conValoreDichiarato(ordinario, "addizionaleComunale", 0.006);
    expect(noteDelValore(dopo, "addizionaleComunale")).toBe("l'aliquota del tuo comune");
  });

  it("formatta ogni campo come si legge", () => {
    expect(valoreDi(ordinario, "addizionaleRegionale")).toMatch(/%$/);
    expect(valoreDi({ ...base, gestione: "artigiani" }, "contributiFissi")).toMatch(/€$/);
    expect(valoreDi(base, "giorniLavorativi")).toBe("220");
  });
});

describe("l'export del prospetto e le aliquote non dichiarate", () => {
  it("in ordinario resta bloccato finché le addizionali non sono confermate", () => {
    const esito = esportazioneProspettoConsentita(PARAMETRI_2026, ordinario);
    expect(esito.consentita).toBe(false);
    if (esito.consentita) return;
    expect(esito.motivo).toMatch(/addizionale/i);

    const con = conValoreDichiarato(
      conValoreDichiarato(ordinario, "addizionaleRegionale", 0.0173),
      "addizionaleComunale",
      0.008,
    );
    expect(esportazioneProspettoConsentita(PARAMETRI_2026, con).consentita).toBe(true);
  });

  it("in forfettario non blocca: nessuna addizionale entra nel calcolo", () => {
    expect(esportazioneProspettoConsentita(PARAMETRI_2026, base).consentita).toBe(true);
  });

  it("solo le aliquote dell'IRPEF bloccano, non le ore fatturabili", () => {
    const artigiano: Impostazioni = { ...base, gestione: "artigiani" };
    // Contributi fissi e ore fatturabili restano da dichiarare…
    expect(campiDaDichiarare(artigiano).map((c) => c.campo)).toContain("contributiFissi");
    // …ma non mandano un documento sbagliato dal commercialista.
    expect(aliquoteIrpefNonDichiarate(artigiano)).toEqual([]);
    expect(esportazioneProspettoConsentita(PARAMETRI_2026, artigiano).consentita).toBe(true);
  });

  it("i parametri provvisori bloccano prima di tutto il resto", () => {
    // Due motivi insieme: quello di legge viene detto per primo, perché è
    // quello che non dipende dall'utente e non si può risolvere.
    const esito = esportazioneProspettoConsentita(PARAMETRI_2027, ordinario);
    expect(esito.consentita).toBe(false);
    if (esito.consentita) return;
    expect(esito.motivo).toMatch(/provvisori/);
  });

  it("senza impostazioni si comporta come prima", () => {
    // La firma resta compatibile: chi non passa le impostazioni ottiene il
    // controllo sui soli parametri di legge.
    expect(esportazioneProspettoConsentita(PARAMETRI_2026).consentita).toBe(true);
  });
});

// ————————————————————————————————————————————————————————————
// L'eredità fra anni d'imposta
// ————————————————————————————————————————————————————————————

/** Un anno che ha ereditato l'addizionale regionale dichiarata l'anno prima. */
const conEredita: Impostazioni = {
  ...ordinario,
  addizionaleRegionale: 0.0203,
  dichiarati: ["addizionaleRegionale"],
  ereditati: ["addizionaleRegionale"],
};

describe("un parametro ereditato dall'anno prima", () => {
  it("vale, ma non passa per una risposta data quest'anno", () => {
    expect(dichiarato(conEredita, "addizionaleRegionale")).toBe(true);
    expect(ereditato(conEredita, "addizionaleRegionale")).toBe(true);
  });

  it("non blocca l'export: il numero l'ha scritto l'utente, non l'app", () => {
    // Bloccare ogni gennaio farebbe ricominciare da capo chi non ha cambiato
    // né comune né regione. Il valore vale; quello che cambia è l'etichetta.
    const soloComunale = aliquoteIrpefNonDichiarate(conEredita).map((c) => c.campo);
    expect(soloComunale).toEqual(["addizionaleComunale"]);
  });

  it("confermarlo non tocca il numero, solo l'anno di chi risponde", () => {
    const dopo = conEreditaConfermata(conEredita, "addizionaleRegionale");
    expect(dopo.addizionaleRegionale).toBe(0.0203);
    expect(dichiarato(dopo, "addizionaleRegionale")).toBe(true);
    expect(ereditato(dopo, "addizionaleRegionale")).toBe(false);
  });

  it("riscrivere il valore lo toglie dagli ereditati", () => {
    const dopo = conValoreDichiarato(conEredita, "addizionaleRegionale", 0.0173);
    expect(ereditato(dopo, "addizionaleRegionale")).toBe(false);
  });

  it("passare agli scaglioni e toccarli lo toglie dagli ereditati", () => {
    const scelta = conScaglioni(conEredita, "addizionaleRegionale", null, false);
    // Scegliere la forma non è ancora rispondere.
    expect(ereditato(scelta, "addizionaleRegionale")).toBe(true);
    const risposta = conScaglioni(scelta, "addizionaleRegionale", [
      { limite: 15_000, aliquota: 0.0173 },
      { limite: null, aliquota: 0.0203 },
    ]);
    expect(ereditato(risposta, "addizionaleRegionale")).toBe(false);
  });

  it("«non lo so» cancella anche l'eredità", () => {
    const dopo = senzaDichiarazione(conEredita, "addizionaleRegionale", 0.0173);
    expect(dichiarato(dopo, "addizionaleRegionale")).toBe(false);
    expect(ereditato(dopo, "addizionaleRegionale")).toBe(false);
  });
});

// ————————————————————————————————————————————————————————————
// Dove si versa, e il valore proposto
// ————————————————————————————————————————————————————————————

describe("regione e comune", () => {
  it("le regioni sono venti", () => {
    expect(REGIONI).toHaveLength(20);
    expect(new Set(REGIONI.map((r) => r.codice)).size).toBe(20);
  });

  it("scegliere la regione non dichiara l'aliquota", () => {
    const dopo = conRegione(ordinario, "lombardia");
    expect(nomeRegione(dopo.regione)).toBe("Lombardia");
    expect(dichiarato(dopo, "addizionaleRegionale")).toBe(false);
  });

  it("il nome del comune si ripulisce, e vuoto vuol dire nessuno", () => {
    expect(conComune(ordinario, "  Bologna ").comune).toBe("Bologna");
    expect(conComune(ordinario, "   ").comune).toBeNull();
  });

  it("l'aliquota base si compila da sola e resta predefinita", () => {
    const dopo = conValoreProposto(ordinario, "addizionaleRegionale", ALIQUOTA_BASE_REGIONALE);
    expect(dopo.addizionaleRegionale).toBe(ALIQUOTA_BASE_REGIONALE);
    // Il punto di tutto: proporre non è dichiarare, e il PDF resta bloccato.
    expect(dichiarato(dopo, "addizionaleRegionale")).toBe(false);
    expect(esportazioneProspettoConsentita(PARAMETRI_2026, dopo).consentita).toBe(false);
  });

  it("non sovrascrive un valore che l'utente ha già dichiarato", () => {
    const mia = conValoreDichiarato(ordinario, "addizionaleRegionale", 0.0333);
    const dopo = conValoreProposto(mia, "addizionaleRegionale", ALIQUOTA_BASE_REGIONALE);
    expect(dopo.addizionaleRegionale).toBe(0.0333);
  });
});
