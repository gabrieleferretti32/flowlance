import { describe, expect, it } from "vitest";
import {
  CONTENUTO,
  PARAMETRO_SESSIONE,
  VALORE,
  acquistiContati,
  conAcquisto,
  identificativoAcquisto,
  improntaAcquisto,
} from "./pixel";
import { PREZZO } from "./acquisto";

/**
 * `Purchase` è il numero su cui la campagna impara chi portare. Se conta gente
 * che non ha pagato, Meta impara a portare quella gente — quindi i tre presidi
 * non sono cautela, sono il prodotto del pixel.
 */

const VERO = "cs_test_a1B2c3D4e5F6g7H8i9J0kLmNoPqRsTuVwXyZ";

describe("il parametro di ritorno di Stripe", () => {
  it("riconosce l'identificativo che Stripe manda", () => {
    expect(identificativoAcquisto(`?${PARAMETRO_SESSIONE}=${VERO}`)).toBe(VERO);
    expect(identificativoAcquisto(`?altro=1&${PARAMETRO_SESSIONE}=${VERO}`)).toBe(VERO);
  });

  /** Chi digita `/grazie` a mano non ha comprato niente, e non va contato. */
  it.each([
    ["", "nessun parametro"],
    ["?", "un punto interrogativo e basta"],
    [`?${PARAMETRO_SESSIONE}=`, "il parametro vuoto"],
    [`?${PARAMETRO_SESSIONE}=1`, "un valore che non viene da Stripe"],
    [`?${PARAMETRO_SESSIONE}=cs_`, "un prefisso senza identificativo"],
    ["?sessione2=cs_test_abcdefghijklmnop", "un parametro che somiglia"],
    [`?${PARAMETRO_SESSIONE}=%7BCHECKOUT_SESSION_ID%7D`, "il segnaposto non sostituito"],
  ])("«%s» (%s) non è un acquisto", (ricerca) => {
    expect(identificativoAcquisto(ricerca)).toBeNull();
  });

  /**
   * Il caso che il segnaposto non sostituito rende reale: se un giorno Stripe
   * rimandasse l'indirizzo senza espandere `{CHECKOUT_SESSION_ID}`, ogni
   * ritorno avrebbe lo **stesso** identificativo — e la deduplica conterebbe un
   * acquisto solo per tutti. Meglio che non sia un identificativo valido.
   */
  it("il segnaposto letterale non passa per un acquisto", () => {
    expect(identificativoAcquisto("?sessione={CHECKOUT_SESSION_ID}")).toBeNull();
  });
});

describe("la memoria degli acquisti già contati", () => {
  it("legge una memoria vuota, rotta o di un altro tipo senza lamentarsi", () => {
    expect(acquistiContati(null)).toEqual([]);
    expect(acquistiContati("non è json")).toEqual([]);
    expect(acquistiContati('{"a":1}')).toEqual([]);
    expect(acquistiContati('[1, "b", null]')).toEqual(["b"]);
  });

  it("**un acquisto già contato non si riconta**", () => {
    const dopo = conAcquisto([VERO], VERO);
    expect(dopo).toEqual([VERO]);
    expect(acquistiContati(JSON.stringify(dopo)).includes(VERO)).toBe(true);
  });

  it("non cresce all'infinito: venti e basta", () => {
    let elenco: string[] = [];
    for (let i = 0; i < 30; i += 1) elenco = conAcquisto(elenco, `cs_test_${"x".repeat(12)}${i}`);
    expect(elenco).toHaveLength(20);
    // Gli ultimi restano: è quello che serve a non ricontare un ritorno recente.
    expect(elenco.at(-1)).toContain("29");
  });
});

describe("l'impronta che viaggia al posto dell'identificativo", () => {
  it("è stabile: lo stesso acquisto dà la stessa impronta", async () => {
    expect(await improntaAcquisto(VERO)).toBe(await improntaAcquisto(VERO));
  });

  it("**non contiene l'identificativo**, che è tutto il punto", async () => {
    const impronta = await improntaAcquisto(VERO);
    expect(impronta).toMatch(/^[0-9a-f]{16}$/);
    expect(VERO).not.toContain(impronta);
    expect(impronta).not.toContain("cs_");
  });

  it("due acquisti diversi non si confondono", async () => {
    expect(await improntaAcquisto(VERO)).not.toBe(await improntaAcquisto(`${VERO}z`));
  });
});

describe("il valore della conversione", () => {
  /**
   * L'imponibile, non il totale incassato: l'IVA non è un ricavo, è denaro che
   * transita. È la stessa frase che il prodotto dice ai suoi utenti.
   */
  it("è l'imponibile e viene dalla costante del prezzo", () => {
    expect(VALORE.value).toBe(PREZZO.imponibile);
    expect(VALORE.value).not.toBe(PREZZO.totale);
    expect(VALORE.currency).toBe("EUR");
  });

  it("gli eventi nominano il prodotto, non il prezzo scritto", () => {
    expect(CONTENUTO.content_name).toBe("Flowlance");
  });
});
