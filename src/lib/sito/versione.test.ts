import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHIAVI_VERSIONE,
  PERCORSO_VERSIONE,
  commitDa,
  confrontaVersione,
  scriviVersione,
} from "./versione";
import { DOMINIO } from "./impostazioni";

const SHA = "a80f8ab810f4fd0ed1061e9c4bd86ce48330b610";
const ALTRO = "30ae248000000000000000000000000000000000";

describe("da quale commit si sta costruendo", () => {
  it("su Vercel lo dice la variabile d'ambiente", () => {
    expect(commitDa({ VERCEL_GIT_COMMIT_SHA: SHA }, () => null)).toBe(SHA);
  });

  it("in locale lo dice git", () => {
    expect(commitDa({}, () => SHA)).toBe(SHA);
  });

  it("la variabile vince su git: è il commit che Vercel sta davvero costruendo", () => {
    expect(commitDa({ VERCEL_GIT_COMMIT_SHA: SHA }, () => ALTRO)).toBe(SHA);
  });

  /**
   * Una variabile d'ambiente può contenere qualunque cosa — un ref, una
   * stringa vuota, il nome di un ramo. Presa per buona finirebbe dentro un file
   * pubblico, e lo strumento che confronta direbbe «diverso» per sempre senza
   * che nessuno capisca perché.
   */
  it.each([["", "vuota"], ["HEAD", "un ref"], ["a80f8ab", "abbreviata"], ["zzzz", "non esadecimale"]])(
    "«%s» (%s) non è uno SHA: si passa a git",
    (valore) => {
      expect(commitDa({ VERCEL_GIT_COMMIT_SHA: valore }, () => SHA)).toBe(SHA);
    },
  );

  it("senza nessuna delle due fonti dice che non sa, invece di inventare", () => {
    expect(commitDa({}, () => null)).toBeNull();
  });

  it("lo scrive in minuscolo, così il confronto non dipende da chi l'ha prodotto", () => {
    expect(commitDa({ VERCEL_GIT_COMMIT_SHA: SHA.toUpperCase() }, () => null)).toBe(SHA);
  });
});

/**
 * È un file **pubblico** su un sito che vende la promessa di non mandare dati
 * da nessuna parte. Le chiavi sono due e restano due: questo test è il posto in
 * cui diventa rosso il giorno in cui qualcuno ci aggiunge «per comodità» il
 * nome del ramo, l'autore del commit o il percorso della cartella di build.
 */
describe("il file pubblico non dice niente oltre lo SHA e la data", () => {
  /*
    Si scrive in una cartella temporanea, non in `public/`.

    La prima stesura chiamava `scriviVersione(process.cwd())`: il test
    riscriveva il file dentro la cartella pubblicata, e la guardia
    dell'artefatto — giustamente — si rifiutava di misurare `out/` subito dopo,
    perché il sorgente era cambiato dopo il build. Un test che sporca l'albero è
    un test che rompe gli strumenti che vengono dopo di lui.

    Il commit arriva dalla variabile che usa Vercel: una cartella temporanea non
    è un repository, e `scriviVersione` — bene — si rifiuta di scrivere senza
    sapere da dove viene.

    Che poi il file **pubblicato** abbia le stesse due chiavi lo controlla
    `strumenti/verifica-metadati.mjs` su `out/`: è lì che conta, perché è quello
    il file che legge il mondo.
  */
  function scriviFuori() {
    const fuori = mkdtempSync(join(tmpdir(), "flowlance-versione-"));
    const prima = process.env.VERCEL_GIT_COMMIT_SHA;
    process.env.VERCEL_GIT_COMMIT_SHA = SHA;
    try {
      return { fuori, scritto: scriviVersione(fuori, new Date("2026-09-11T10:00:00.000Z")) };
    } finally {
      if (prima === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
      else process.env.VERCEL_GIT_COMMIT_SHA = prima;
    }
  }

  it("ha esattamente due chiavi", () => {
    const { fuori, scritto } = scriviFuori();
    expect(Object.keys(scritto).sort()).toEqual([...CHIAVI_VERSIONE].sort());
    rmSync(fuori, { recursive: true, force: true });
  });

  it("e sul disco anche il file ne ha due", () => {
    const { fuori } = scriviFuori();
    const dal = JSON.parse(readFileSync(join(fuori, "public/versione.json"), "utf8"));
    expect(Object.keys(dal).sort()).toEqual([...CHIAVI_VERSIONE].sort());
    expect(dal.commit).toBe(SHA);
    expect(dal.costruito).toBe("2026-09-11T10:00:00.000Z");
    rmSync(fuori, { recursive: true, force: true });
  });
});

/**
 * E quando non sa, si ferma davvero.
 *
 * Una prova che il presidio vede la mancanza quando c'è: fuori da un clone git
 * e senza la variabile di Vercel, `scriviVersione` lancia invece di scrivere un
 * file che dice «non so». Senza questo test la riga del `throw` sarebbe una
 * riga mai eseguita da nessuno.
 */
describe("senza commit il build si ferma", () => {
  it("fuori da un repository e senza Vercel, lancia e non scrive niente", () => {
    const prima = process.env.VERCEL_GIT_COMMIT_SHA;
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    const fuori = mkdtempSync(join(tmpdir(), "flowlance-versione-"));
    try {
      expect(() => scriviVersione(fuori)).toThrow(/non so da quale commit/);
      expect(existsSync(join(fuori, "public/versione.json"))).toBe(false);
    } finally {
      rmSync(fuori, { recursive: true, force: true });
      if (prima !== undefined) process.env.VERCEL_GIT_COMMIT_SHA = prima;
    }
  });
});

describe("il confronto fra quello che è online e quello che dice il ramo", () => {
  it("stesso commit: allineato", () => {
    expect(confrontaVersione({ commit: SHA, costruito: "x" }, SHA)).toEqual({
      stato: "allineato",
      commit: SHA,
      costruito: "x",
    });
  });

  it("commit diverso: lo dice, e dice tutti e due", () => {
    expect(confrontaVersione({ commit: ALTRO, costruito: "x" }, SHA)).toEqual({
      stato: "diverso",
      online: ALTRO,
      atteso: SHA,
      costruito: "x",
    });
  });

  it("maiuscole e spazi non fanno una differenza", () => {
    expect(confrontaVersione({ commit: SHA, costruito: "x" }, ` ${SHA.toUpperCase()} `).stato).toBe(
      "allineato",
    );
  });

  it.each([
    [null, "niente"],
    [{}, "un oggetto vuoto"],
    [{ commit: 3 }, "un numero"],
    [{ commit: "a80f8ab" }, "uno SHA abbreviato"],
    ["a80f8ab810f4fd0ed1061e9c4bd86ce48330b610", "una stringa invece di un oggetto"],
  ] as [unknown, string][])("%#: con %s non dice «allineato», dice che non sa", (grezzo) => {
    expect(confrontaVersione(grezzo, SHA).stato).toBe("muto");
  });

  it("la data non basta a fare un confronto: senza commit resta muto", () => {
    expect(confrontaVersione({ costruito: "2026-09-11T10:00:00.000Z" }, SHA).stato).toBe("muto");
  });
});

/**
 * Lo strumento è un `.mjs` e le costanti stanno in TypeScript: due file che
 * devono dire lo stesso indirizzo e lo stesso percorso. È una seconda copia, e
 * le seconde copie di questo progetto divergono sempre — a meno che qualcuno le
 * guardi insieme.
 */
describe("lo strumento e le costanti dicono la stessa cosa", () => {
  const sorgente = readFileSync("strumenti/verifica-versione.mjs", "utf8");

  it.each([
    ["il dominio", `"${DOMINIO}"`],
    ["il percorso del file", `"${PERCORSO_VERSIONE}"`],
  ])("%s", (_, atteso) => {
    expect(sorgente).toContain(atteso);
  });
});
