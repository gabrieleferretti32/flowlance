import { describe, expect, it } from "vitest";
import { SEGNAPOSTO_PAGAMENTO, controlloVendita } from "./presidio";
import { PAYMENT_LINK } from "./acquisto";
import { CHIUSO_AI_MOTORI } from "./impostazioni";

/**
 * Un sito che si fa trovare e non vende.
 *
 * Le due condizioni sono legittime separatamente e impossibili insieme, e
 * nessuna delle due, da sola, ha un sintomo: il riquadro «scrivi a
 * info@flowlance.it» sembra a posto a chi l'ha scritto, e il noindex tolto non
 * si vede da nessuna parte. È la definizione di quello che va tenuto da un
 * presidio invece che dalla memoria.
 */
describe("il presidio sulla vendita", () => {
  const PRONTO = "https://buy.stripe.com/xyz123";

  it("in sviluppo non ferma niente, in nessuna combinazione", () => {
    for (const link of [SEGNAPOSTO_PAGAMENTO, PRONTO]) {
      for (const chiuso of [true, false]) {
        expect(controlloVendita(link, chiuso, "development")).toBeNull();
        expect(controlloVendita(link, chiuso, undefined)).toBeNull();
      }
    }
  });

  it("in produzione lascia passare le tre combinazioni sensate", () => {
    // Sito chiuso e pagamento non pronto: si sta costruendo.
    expect(controlloVendita(SEGNAPOSTO_PAGAMENTO, true, "production")).toBeNull();
    // Sito chiuso e pagamento pronto: si è pronti, si apre quando si vuole.
    expect(controlloVendita(PRONTO, true, "production")).toBeNull();
    // Sito aperto e pagamento pronto: bottega aperta.
    expect(controlloVendita(PRONTO, false, "production")).toBeNull();
  });

  it("in produzione ferma la quarta, che è quella impossibile", () => {
    const messaggio = controlloVendita(SEGNAPOSTO_PAGAMENTO, false, "production");
    expect(messaggio).not.toBeNull();
    // Il messaggio nomina tutte e due le manopole e dice dove stanno: chi lo
    // legge sta pubblicando, e non deve andare a cercare.
    expect(messaggio).toContain("CHIUSO_AI_MOTORI");
    expect(messaggio).toContain("PAYMENT_LINK");
    expect(messaggio).toContain("src/lib/sito/acquisto.ts");
    expect(messaggio).toContain("src/lib/sito/impostazioni.ts");
  });

  /**
   * Il segnaposto è quello vero.
   *
   * Se `PAYMENT_LINK` cambiasse valore di riposo — «TODO», stringa vuota — il
   * presidio smetterebbe di riconoscerlo e lascerebbe passare esattamente il
   * caso per cui esiste, in silenzio. Qui i due si guardano.
   */
  it("riconosce il segnaposto che il progetto usa davvero", () => {
    /*
      Il tipo si allarga a `string` di proposito. `PAYMENT_LINK` è una costante
      letterale, e TypeScript sa che oggi non è il segnaposto: senza questo, il
      confronto qui sotto diventa un errore di compilazione — «questi due tipi
      non si sovrappongono» — e il test smetterebbe di esistere proprio adesso
      che il collegamento c'è. Ma deve continuare a valere anche il giorno in
      cui qualcuno rimette il segnaposto.
    */
    const link: string = PAYMENT_LINK;
    if (link !== SEGNAPOSTO_PAGAMENTO) {
      // Il collegamento è stato creato: il presidio non ha più niente da fare,
      // e questo test lo dice invece di fallire.
      expect(link).toMatch(/^https:\/\//);
      return;
    }
    expect(controlloVendita(link, false, "production")).not.toBeNull();
  });

  it("oggi il sito è chiuso ai motori, quindi il build passa", () => {
    expect(CHIUSO_AI_MOTORI).toBe(true);
    expect(controlloVendita(PAYMENT_LINK as string, CHIUSO_AI_MOTORI, "production")).toBeNull();
  });
});
