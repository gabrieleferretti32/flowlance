import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TIMBRO, differenze, motivoArtefattoVecchio, timbra } from "./artefatto.mjs";

/**
 * La guardia che impedisce di misurare la copia sbagliata.
 *
 * Ha un modo di fallire peggiore di tutti gli altri: se dicesse «fresco»
 * quando non lo è, ogni verifica del progetto continuerebbe a dire verde su un
 * sito vecchio — cioè tutte le tagliole scritte finora smetterebbero di valere,
 * insieme, senza un sintomo. Questi test si assicurano che sbagli nell'altra
 * direzione.
 */
describe("la guardia sull'artefatto", () => {
  let radice;

  beforeEach(() => {
    radice = mkdtempSync(join(tmpdir(), "artefatto-"));
    mkdirSync(join(radice, "src", "lib"), { recursive: true });
    mkdirSync(join(radice, "out"), { recursive: true });
    writeFileSync(join(radice, "src", "lib", "uno.ts"), "export const uno = 1;\n");
    writeFileSync(join(radice, "out", "index.html"), "<html></html>");
  });

  afterEach(() => rmSync(radice, { recursive: true, force: true }));

  it("subito dopo il timbro, si può misurare", () => {
    timbra(radice);
    expect(motivoArtefattoVecchio(radice)).toBeNull();
  });

  it("senza timbro non si misura, anche se out/ c'è", () => {
    expect(motivoArtefattoVecchio(radice)).toContain(TIMBRO);
  });

  it("senza out/ non si misura, anche se il timbro c'è", () => {
    timbra(radice);
    rmSync(join(radice, "out"), { recursive: true });
    expect(motivoArtefattoVecchio(radice)).toContain("out/");
  });

  it("un file modificato ferma la verifica, e viene nominato", () => {
    timbra(radice);
    writeFileSync(join(radice, "src", "lib", "uno.ts"), "export const uno = 2;\n");
    const motivo = motivoArtefattoVecchio(radice);
    expect(motivo).not.toBeNull();
    expect(motivo).toContain("src/lib/uno.ts");
  });

  it("un file aggiunto ferma la verifica", () => {
    timbra(radice);
    writeFileSync(join(radice, "src", "lib", "due.ts"), "export const due = 2;\n");
    expect(motivoArtefattoVecchio(radice)).toContain("src/lib/due.ts");
  });

  it("un file sparito ferma la verifica", () => {
    timbra(radice);
    rmSync(join(radice, "src", "lib", "uno.ts"));
    expect(motivoArtefattoVecchio(radice)).toContain("src/lib/uno.ts");
  });

  /**
   * I test non entrano nell'impronta.
   *
   * Un `*.test.ts` non finisce nel sito costruito, e farlo entrare vorrebbe
   * dire rifiutare una verifica perché qualcuno ha corretto un'asserzione —
   * cioè addestrare chi lavora a ricostruire senza motivo, che è il primo passo
   * per ignorare il messaggio quando il motivo c'è.
   */
  it("correggere un test non invalida l'artefatto", () => {
    writeFileSync(join(radice, "src", "lib", "uno.test.ts"), "// prima\n");
    timbra(radice);
    writeFileSync(join(radice, "src", "lib", "uno.test.ts"), "// dopo, più lungo\n");
    expect(motivoArtefattoVecchio(radice)).toBeNull();
  });

  it("un timbro illeggibile ferma la verifica invece di essere ignorato", () => {
    timbra(radice);
    writeFileSync(join(radice, TIMBRO), "{ questo non è json");
    expect(motivoArtefattoVecchio(radice)).toContain("non si legge");
  });

  it("dice quali file sono cambiati, in tutte e tre le forme", () => {
    const prima = { a: "1:1", b: "1:1", c: "1:1" };
    const adesso = { a: "1:1", b: "2:2", d: "1:1" };
    expect(differenze(prima, adesso)).toEqual({
      cambiati: ["b"],
      aggiunti: ["d"],
      spariti: ["c"],
    });
  });
});
