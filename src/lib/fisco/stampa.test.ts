import { describe, expect, it } from "vitest";
import { calcolaProspetto } from "./motore";
import {
  COSTI_FIXTURE,
  FATTURE_FIXTURE,
  OGGI_FIXTURE,
  impostazioniForfettario,
  impostazioniOrdinario,
} from "./fixture";
import { PARAMETRI_2026 } from "./parametri/2026";
import { PARAMETRI_2027 } from "./parametri/2027";
import {
  documentoProspetto,
  nomeFileProspetto,
  stampaConsentita,
  NOTA_GESTIONALE,
} from "./stampa";
import { euro, percentuale } from "@/lib/format";
import type { Impostazioni, ParametriAnno } from "./tipi";

function documentoCon(imp: Impostazioni, par: ParametriAnno = PARAMETRI_2026) {
  const p = calcolaProspetto({
    impostazioni: imp,
    parametri: par,
    fatture: FATTURE_FIXTURE,
    costi: COSTI_FIXTURE,
    oggi: OGGI_FIXTURE,
  });
  return documentoProspetto(p, imp, par, OGGI_FIXTURE);
}

const forfettario = documentoCon({
  ...impostazioniForfettario(),
  nome: "Studio di consulenza",
  dataAperturaPiva: "2021-03-01",
});
const ordinario = documentoCon({ ...impostazioniOrdinario(), nome: "Studio di consulenza" });

function valoriDi(voci: { etichetta: string; valore: string }[]) {
  return Object.fromEntries(voci.map((v) => [v.etichetta, v.valore]));
}

// ————————————————————————————————————————————————————————————
// Il documento regge da solo
// ————————————————————————————————————————————————————————————

describe("il prospetto stampato si spiega senza l'app intorno", () => {
  it("dice chi è, che anno è e quando è stato emesso", () => {
    const v = valoriDi(forfettario.identificazione);
    expect(v["Intestatario"]).toBe("Studio di consulenza");
    expect(v["Anno d'imposta"]).toBe("2026");
    expect(v["Apertura partita IVA"]).toBe("1 marzo 2021");
    expect(v["Documento emesso il"]).toBe("1 settembre 2026");
    expect(forfettario.titolo).toBe("Prospetto fiscale 2026");
  });

  it("senza un nome impostato lo dichiara invece di lasciare il vuoto", () => {
    const senzaNome = documentoCon({ ...impostazioniForfettario(), nome: "  " });
    expect(senzaNome.intestatario).toBe("Non impostato");
    expect(valoriDi(senzaNome.identificazione)["Apertura partita IVA"]).toBe("Non impostata");
  });

  it("elenca i parametri di legge applicati e le loro fonti", () => {
    const v = valoriDi(forfettario.parametri);
    expect(v["Regime fiscale"]).toBe("Forfettario");
    expect(v["Coefficiente di redditività"]).toBe(percentuale(0.78));
    expect(v["Imposta sostitutiva"]).toBe(percentuale(0.15));
    expect(v["Previdenza"]).toBe("Gestione Separata INPS");
    expect(v["Aliquota Gestione Separata"]).toBe(percentuale(0.2607));
    // Senza le fonti il documento sarebbe una cifra senza provenienza.
    expect(forfettario.fonti).toEqual(PARAMETRI_2026.fonti);
    expect(forfettario.fonti.length).toBeGreaterThan(0);
  });

  it("in ordinario mostra scaglioni e addizionali al posto del coefficiente", () => {
    const v = valoriDi(ordinario.parametri);
    expect(v["Regime fiscale"]).toBe("Ordinario");
    expect(v["Coefficiente di redditività"]).toBeUndefined();
    expect(v["Scaglioni IRPEF"]).toContain("23 %");
  });

  /**
   * Un'aliquota senza il suo territorio non è verificabile.
   *
   * «Addizionale regionale 1,73 %» su un foglio che finisce in mano al
   * commercialista non si può ricontrollare: per sapere se è giusta bisogna
   * sapere di quale regione è. Dove il territorio manca la riga lo dice, e
   * l'aliquota non compare: mostrarla nuda darebbe l'aria di un dato completo
   * a un dato che non lo è.
   */
  describe("le addizionali portano il loro territorio", () => {
    const conTerritorio = documentoCon({
      ...impostazioniOrdinario(),
      nome: "Studio di consulenza",
      regione: "emilia-romagna",
      comune: "Bologna",
    });

    it("aliquota e territorio nella stessa riga", () => {
      const v = valoriDi(conTerritorio.parametri);
      expect(v["Addizionale regionale"]).toBe(`${percentuale(0.0173)} · Emilia-Romagna`);
      expect(v["Addizionale comunale"]).toBe(`${percentuale(0.008)} · Bologna`);
    });

    it("senza territorio la riga dice cosa manca, e non mostra l'aliquota", () => {
      const v = valoriDi(ordinario.parametri);
      expect(v["Addizionale regionale"]).toBe("Regione non dichiarata");
      expect(v["Addizionale comunale"]).toBe("Comune non dichiarato");
      expect(v["Addizionale regionale"]).not.toContain("%");
    });

    it("un comune scritto di soli spazi non è un comune", () => {
      const v = valoriDi(
        documentoCon({ ...impostazioniOrdinario(), comune: "   ", regione: "veneto" }).parametri,
      );
      expect(v["Addizionale comunale"]).toBe("Comune non dichiarato");
    });

    it("con gli scaglioni non stampa l'aliquota unica, che non è quella applicata", () => {
      const v = valoriDi(
        documentoCon({
          ...impostazioniOrdinario(),
          regione: "lombardia",
          comune: "Milano",
          scaglioniAddizionaleRegionale: [
            { limite: 15_000, aliquota: 0.0123 },
            { limite: null, aliquota: 0.0173 },
          ],
        }).parametri,
      );
      // La scomposizione sta nella sezione delle imposte, con la sua formula.
      expect(v["Addizionale regionale"]).toBe("a scaglioni · Lombardia");
      expect(v["Addizionale comunale"]).toBe(`${percentuale(0.008)} · Milano`);
    });

    it("in forfettario le due righe non ci sono per niente", () => {
      const v = valoriDi(forfettario.parametri);
      expect(v["Addizionale regionale"]).toBeUndefined();
      expect(v["Addizionale comunale"]).toBeUndefined();
    });
  });

  it("porta la nota di prospetto gestionale, in chiaro", () => {
    expect(forfettario.nota).toBe(NOTA_GESTIONALE);
    expect(forfettario.nota).toContain("Non è una dichiarazione dei redditi");
    expect(forfettario.nota).toContain("Flowlance");
  });
});

// ————————————————————————————————————————————————————————————
// I numeri sono quelli del fixture obbligatorio
// ————————————————————————————————————————————————————————————

describe("i numeri stampati sono quelli del motore", () => {
  it("la sintesi riporta la catena del fixture forfettario", () => {
    const v = Object.fromEntries(forfettario.sintesi.map((s) => [s.etichetta, s.valore]));
    expect(v["Ricavi rilevanti"]).toBe(euro(7_500));
    expect(v["Reddito imponibile"]).toBe(euro(4_324.9));
    expect(v["Imposte e contributi"]).toBe(euro(2_173.84));
    expect(v["Netto disponibile"]).toBe(euro(4_306.56));
  });

  it("la catena di calcolo arriva riga per riga, con le formule", () => {
    const righe = forfettario.sezioni.flatMap((s) => s.righe);
    const perId = Object.fromEntries(righe.map((r) => [r.id, r]));
    expect(perId["ricavi-rilevanti"].valore).toBe(7_500);
    expect(perId["reddito-lordo"] ?? perId["imponibile"]).toBeDefined();
    // Sulla carta non c'è un popover da aprire: la formula deve stare scritta.
    expect(righe.filter((r) => r.formula).length).toBeGreaterThan(righe.length / 2);
  });

  it("imposte e contributi restano scomposti, non solo sommati", () => {
    const titoli = forfettario.sezioni.map((s) => s.titolo);
    expect(titoli).toContain("Imposte");
    expect(titoli).toContain("Contributi previdenziali");
  });

  it("saldo e acconti stanno nel prospetto, senza un secondo blocco che li ripete", () => {
    const sezioneF = ordinario.sezioni.find((s) => s.lettera === "F");
    expect(sezioneF?.titolo).toBe("Saldo, acconti e rateizzazione");
    const id = sezioneF?.righe.map((r) => r.id) ?? [];
    expect(id).toContain("dovuto");
    expect(id).toContain("gia-versato");
    expect(id).toContain("saldo");
    expect(id.some((x) => x === "primo-acconto" || x === "acconto-unico" || x === "acconti-non-dovuti")).toBe(true);
  });

  it("le ritenute subite compaiono fra le imposte quando ci sono", () => {
    const conRitenute = documentoCon({
      ...impostazioniOrdinario(),
      nome: "Studio",
      ritenutaAttiva: true,
    });
    const righe = conRitenute.sezioni.flatMap((s) => s.righe);
    expect(righe.some((r) => r.id === "ritenute")).toBe(true);
  });

  it("sotto la soglia gli acconti si dichiarano non dovuti, non spariscono", () => {
    const senzaRicavi = calcolaProspetto({
      impostazioni: impostazioniForfettario(),
      parametri: PARAMETRI_2026,
      fatture: [],
      costi: [],
      oggi: OGGI_FIXTURE,
    });
    const doc = documentoProspetto(
      senzaRicavi,
      impostazioniForfettario(),
      PARAMETRI_2026,
      OGGI_FIXTURE,
    );
    const righe = doc.sezioni.flatMap((s) => s.righe);
    expect(righe.some((r) => r.id === "acconti-non-dovuti")).toBe(true);
  });

  it("ogni importo passa dai formatter italiani, mai da una stringa a mano", () => {
    const importi = forfettario.sintesi.map((s) => s.valore).filter((v) => v.includes("€"));
    for (const v of importi) {
      // Spazio unificatore prima dell'euro e virgola decimale: è quello che
      // produce `euro()`, e nient'altro deve produrre importi in questo file.
      expect(v).toMatch(/\d,\d{2} €/);
    }
  });
});

// ————————————————————————————————————————————————————————————
// Il blocco sui parametri provvisori
// ————————————————————————————————————————————————————————————

describe("stampa bloccata sui parametri provvisori", () => {
  it("con parametri definitivi si stampa", () => {
    expect(stampaConsentita(PARAMETRI_2026).consentita).toBe(true);
  });

  it("con parametri provvisori no, e dice perché", () => {
    const esito = stampaConsentita(PARAMETRI_2027);
    expect(esito.consentita).toBe(false);
    if (esito.consentita) return;
    expect(esito.motivo).toContain("provvisori");
    expect(esito.motivo).toContain("2027");
  });
});

// ————————————————————————————————————————————————————————————
// Nome del file
// ————————————————————————————————————————————————————————————

describe("nome del file da allegare", () => {
  it("contiene anno e intestatario, ridotti a caratteri sicuri", () => {
    expect(nomeFileProspetto(forfettario)).toBe("prospetto-2026-studio-di-consulenza");
  });

  it("regge accenti e punteggiatura", () => {
    const doc = documentoCon({ ...impostazioniForfettario(), nome: "Società Àcme & C. s.r.l." });
    expect(nomeFileProspetto(doc)).toBe("prospetto-2026-societa-acme-c-s-r-l");
  });

  it("senza intestatario resta il solo anno", () => {
    const doc = documentoCon({ ...impostazioniForfettario(), nome: "" });
    expect(nomeFileProspetto(doc)).toBe("prospetto-2026-non-impostato");
  });
});
