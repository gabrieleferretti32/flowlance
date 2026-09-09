import { describe, expect, it } from "vitest";
import { calcolaIva } from "@/lib/fisco/iva";
import { calcolaProspetto } from "@/lib/fisco/motore";
import { PARAMETRI_2026 } from "@/lib/fisco/parametri/2026";
import { scadenzeAnno } from "@/lib/fisco/scadenze";
import {
  COSTI_FIXTURE,
  FATTURE_FIXTURE,
  impostazioniForfettario,
  impostazioniOrdinario,
} from "@/lib/fisco/fixture";
import type { Fattura, Impostazioni } from "@/lib/fisco/tipi";
import { generaAvvisi } from "./avvisi";
import { ROTTE } from "@/lib/rotte";

const par = PARAMETRI_2026;

function avvisiDi(
  imp: Impostazioni,
  fatture: Fattura[] = FATTURE_FIXTURE,
  costi = COSTI_FIXTURE,
  oggi = "2026-09-01",
) {
  const prospetto = calcolaProspetto({
    impostazioni: imp, parametri: par, fatture, costi, oggi,
  });
  const iva = calcolaIva(prospetto.fattureCalcolate, prospetto.costiCalcolati, imp, par);
  const scadenze = scadenzeAnno(imp, par, prospetto, iva);
  return generaAvvisi({
    prospetto,
    impostazioni: imp,
    fatture: prospetto.fattureCalcolate,
    costi: prospetto.costiCalcolati,
    scadenze,
    oggi,
  });
}

describe("avvisi del cruscotto", () => {
  it("segnala lo scaduto con un'azione che porta alle fatture filtrate", () => {
    const avvisi = avvisiDi(impostazioniForfettario());
    const scaduto = avvisi.find((a) => a.id === "scadute");
    expect(scaduto).toBeDefined();
    expect(scaduto?.tono).toBe("negativo"); // la fattura è ferma da 135 giorni
    expect(scaduto?.azione?.href).toBe(`${ROTTE.fatture}?stato=scadute`);
    expect(scaduto?.testo).toContain("135 giorni");
  });

  it("avverte quando l'emesso non ancora incassato farebbe superare il limite", () => {
    const grosse: Fattura[] = [
      { ...FATTURE_FIXTURE[0], id: "a", imponibile: 60_000, dataIncasso: "2026-03-01" },
      { ...FATTURE_FIXTURE[1], id: "b", imponibile: 30_000, dataIncasso: null },
    ];
    const avvisi = avvisiDi(impostazioniForfettario(), grosse, []);
    const proiezione = avvisi.find((a) => a.id === "soglia-proiezione");
    expect(proiezione?.tono).toBe("attenzione");
    expect(proiezione?.testo).toContain("non ancora incassati");
  });

  it("distingue il limite superato dall'uscita immediata", () => {
    const oltre85 = avvisiDi(impostazioniForfettario(), [
      { ...FATTURE_FIXTURE[0], imponibile: 90_000, dataIncasso: "2026-03-01" },
    ], []);
    expect(oltre85.find((a) => a.id === "soglia")?.testo).toContain("1° gennaio successivo");

    const oltre100 = avvisiDi(impostazioniForfettario(), [
      { ...FATTURE_FIXTURE[0], imponibile: 120_000, dataIncasso: "2026-03-01" },
    ], []);
    const avviso = oltre100.find((a) => a.id === "soglia");
    expect(avviso?.tono).toBe("negativo");
    expect(avviso?.testo).toContain("stesso anno");
  });

  it("dice di quanto è insufficiente l'accantonamento e a quanto portarlo", () => {
    const avvisi = avvisiDi({ ...impostazioniForfettario(), percentualeAccantonamento: 0.1 });
    const accantonamento = avvisi.find((a) => a.id === "accantonamento");
    expect(accantonamento?.testo).toContain("mancano");
    expect(accantonamento?.testo).toContain("29 %");
  });

  it("tace sull'accantonamento quando basta", () => {
    const avvisi = avvisiDi({ ...impostazioniForfettario(), percentualeAccantonamento: 0.35 });
    expect(avvisi.some((a) => a.id === "accantonamento")).toBe(false);
  });

  it("segnala l'accredito contributivo parziale, che nessuno dice mai", () => {
    const avvisi = avvisiDi(impostazioniForfettario());
    const accredito = avvisi.find((a) => a.id === "accredito");
    expect(accredito?.testo).toContain("non ti viene accreditato per intero");
  });

  it("mostra il credito d'imposta invece di un saldo negativo", () => {
    const avvisi = avvisiDi({
      ...impostazioniOrdinario(),
      ritenutaAttiva: true,
      detrazioniPersonali: 1200,
    });
    const credito = avvisi.find((a) => a.id === "credito-imposta");
    expect(credito?.tono).toBe("positivo");
    expect(credito?.testo).toContain("credito d'imposta");
  });

  it("segnala le scadenze dei prossimi quindici giorni", () => {
    // Il 30 settembre c'è la LIPE del 2° trimestre.
    const avvisi = avvisiDi(impostazioniOrdinario(), FATTURE_FIXTURE, COSTI_FIXTURE, "2026-09-20");
    const imminente = avvisi.find((a) => a.id === "scadenza-imminente");
    expect(imminente).toBeDefined();
    expect(imminente?.testo).toMatch(/fra \d+ giorni|domani|oggi/);
  });

  it("su un archivio vuoto invita all'azione invece di dire che va tutto bene", () => {
    const avvisi = avvisiDi(impostazioniForfettario(), [], []);
    expect(avvisi).toHaveLength(1);
    expect(avvisi[0].id).toBe("tutto-in-ordine");
    expect(avvisi[0].azione?.href).toBe(ROTTE.fatture);
    expect(avvisi[0].testo).toContain("Registra la prima fattura");
  });

  it("non lascia mai il cruscotto senza una riga", () => {
    const tutteIncassate = FATTURE_FIXTURE.map((f) => ({ ...f, dataIncasso: "2026-02-10" }));
    const avvisi = avvisiDi(
      { ...impostazioniForfettario(), percentualeAccantonamento: 0.4 },
      tutteIncassate,
      COSTI_FIXTURE.map((c) => ({ ...c, dataPagamento: c.dataDocumento })),
    );
    expect(avvisi.length).toBeGreaterThan(0);
  });
});
