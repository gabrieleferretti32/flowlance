/**
 * Le due domande sull'origine, provate dove adesso vivono.
 *
 * Erano in `promemoria.test.ts` e in `promemoria-server.test.ts`: si sono
 * spostate con le funzioni, perché la funzione delle accettazioni non deve
 * importare niente del servizio promemoria. Vedi la testa di `origini.ts`.
 */
import { describe, expect, it } from "vitest";
import { origineAmmessa, originiAmmesse } from "./origini";

describe("origineAmmessa", () => {
  const ammesse = ["https://flowlance.it", "https://www.flowlance.it"];

  it("passa l'origine del sito, con o senza barra finale", () => {
    expect(origineAmmessa("https://flowlance.it", ammesse)).toBe(true);
    expect(origineAmmessa("https://flowlance.it/", ammesse)).toBe(true);
  });

  it("non passa un altro sito, né l'assenza di origine", () => {
    expect(origineAmmessa("https://flowlance.it.evil.com", ammesse)).toBe(false);
    expect(origineAmmessa("http://flowlance.it", ammesse)).toBe(false);
    expect(origineAmmessa(undefined, ammesse)).toBe(false);
    expect(origineAmmessa("", ammesse)).toBe(false);
  });
});

describe("originiAmmesse", () => {
  it("il sito con e senza www", () => {
    expect(originiAmmesse("https://flowlance.it", undefined)).toEqual([
      "https://flowlance.it",
      "https://www.flowlance.it",
    ]);
  });

  it("più l'anteprima, quando Vercel la dichiara", () => {
    expect(originiAmmesse("https://flowlance.it", "flowlance-abc123.vercel.app")).toContain(
      "https://flowlance-abc123.vercel.app",
    );
  });
});
