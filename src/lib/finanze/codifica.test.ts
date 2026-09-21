import { describe, expect, it } from "vitest";
import { decodificaRendiconto, nomeCodifica } from "./codifica";

const inUtf8 = (testo: string) => new TextEncoder().encode(testo);

/** Gli stessi caratteri, come li scrive Excel su Windows: un byte ciascuno. */
const in1252 = (testo: string) => {
  const mappa: Record<string, number> = {
    "À": 0xc0, "È": 0xc8, "É": 0xc9, "Ì": 0xcc, "Ò": 0xd2, "Ù": 0xd9,
    "à": 0xe0, "è": 0xe8, "é": 0xe9, "ì": 0xec, "ò": 0xf2, "ù": 0xf9,
    "€": 0x80,
  };
  return Uint8Array.from([...testo].map((c) => mappa[c] ?? c.charCodeAt(0)));
};

describe("l'alfabeto di un rendiconto", () => {
  it("un file UTF-8 si legge come UTF-8", () => {
    const esito = decodificaRendiconto(inUtf8("PERCHÉ;CITTÀ;caffè"));
    expect(esito.codifica).toBe("utf-8");
    expect(esito.testo).toBe("PERCHÉ;CITTÀ;caffè");
  });

  /**
   * **Il caso che rompe le regole di categoria.**
   *
   * Letto come UTF-8, un file ANSI perde gli accenti: «caffè» diventa
   * «caff?», e una regola su «caffè» smette di riconoscerlo. La
   * categorizzazione peggiora da sola, e nessuno collega la cosa al file.
   */
  it("**un file ANSI con «PERCHÉ» e «CITTÀ» si legge lo stesso**", () => {
    const esito = decodificaRendiconto(in1252("PERCHÉ;CITTÀ;caffè"));
    expect(esito.codifica).toBe("windows-1252");
    expect(esito.testo).toBe("PERCHÉ;CITTÀ;caffè");
  });

  it("e la misura al contrario: letto come UTF-8 quel file si rompe davvero", () => {
    const grezzo = in1252("PERCHÉ");
    expect(() => new TextDecoder("utf-8", { fatal: true }).decode(grezzo)).toThrow();
    expect(new TextDecoder("utf-8").decode(grezzo)).not.toBe("PERCHÉ");
  });

  it("l'euro di Windows-1252 non è quello di UTF-8, e torna comunque", () => {
    expect(decodificaRendiconto(in1252("IMPORTO €")).testo).toBe("IMPORTO €");
  });

  it("il segno d'ordine che Excel mette in testa non finisce nel testo", () => {
    const conBom = Uint8Array.from([0xef, 0xbb, 0xbf, ...inUtf8("Data;Importo")]);
    const esito = decodificaRendiconto(conBom);
    expect(esito.testo).toBe("Data;Importo");
    expect(esito.codifica).toBe("utf-8");
  });

  it("un file senza accenti è uguale nei due alfabeti, e non è un problema", () => {
    const esito = decodificaRendiconto(inUtf8("Data;Descrizione;Importo"));
    expect(esito.testo).toBe("Data;Descrizione;Importo");
  });

  it("il nome si mostra a chi carica", () => {
    expect(nomeCodifica("windows-1252")).toBe("ANSI (Windows-1252)");
    expect(nomeCodifica("utf-8")).toBe("UTF-8");
  });
});
