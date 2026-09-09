import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { archivio, impostaArchivio } from "./archivio";
import { DatabaseFinanze } from "./db";
import { DexieAdapter } from "./dexie-adapter";
import { demoNellIndirizzo, NOME_DB_DEMO, preparaArchivio } from "./demo-isolata";
import type { Fattura } from "@/lib/fisco/tipi";

/**
 * Il caso da non sbagliare è uno: **chi usa l'app per davvero non deve perdere
 * niente.** Un visitatore curioso e un cliente con dentro un anno di fatture
 * possono essere la stessa persona, sullo stesso browser, nella stessa ora.
 *
 * Questi test guardano l'archivio, non l'interfaccia: che la demo scriva in un
 * database suo si dimostra contando le righe dei due database, non vedendo una
 * barra colorata in cima alla pagina.
 */

const NOME_DB_VERO = "freelance-finance-os";

/** Una memoria di sessione finta: in Node non c'è, e la demo ci vive dentro. */
function memoriaDiSessione() {
  const dentro = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (c: string) => dentro.get(c) ?? null,
      setItem: (c: string, v: string) => void dentro.set(c, v),
      removeItem: (c: string) => void dentro.delete(c),
    },
  });
  return dentro;
}

async function conta(nome: string): Promise<number> {
  const database = new DatabaseFinanze(nome);
  const n = await database.fatture.count();
  database.close();
  return n;
}

describe("l'indirizzo che apre la demo", () => {
  it("riconosce un dataset che esiste", () => {
    expect(demoNellIndirizzo("?demo=vetrina")).toBe("vetrina");
    expect(demoNellIndirizzo("?anno=2026&demo=dimostrativo")).toBe("dimostrativo");
  });

  it("ignora tutto il resto, invece di aprire un archivio a caso", () => {
    expect(demoNellIndirizzo("")).toBeNull();
    expect(demoNellIndirizzo("?demo=")).toBeNull();
    expect(demoNellIndirizzo("?demo=archivio-vero")).toBeNull();
    expect(demoNellIndirizzo("?demo=../../etc")).toBeNull();
  });
});

describe("la demo non tocca l'archivio vero", () => {
  beforeEach(async () => {
    memoriaDiSessione();
    impostaArchivio(null);
    for (const nome of [NOME_DB_VERO, NOME_DB_DEMO]) await DatabaseFinanze.delete(nome);
  });

  it("senza il parametro resta sull'archivio di sempre", async () => {
    const stato = await preparaArchivio("");
    expect(stato.demo).toBeNull();
    expect(stato.appenaCaricata).toBe(false);
  });

  it("scrive la vetrina nel database della demo e lascia intatto quello vero", async () => {
    // Un utente vero, con dentro la sua roba.
    impostaArchivio(new DexieAdapter(new DatabaseFinanze(NOME_DB_VERO)));
    const mia: Fattura = {
      id: "mia-fattura",
      dataEmissione: "2026-03-01",
      numero: "2026/1",
      clienteId: "c1",
      descrizione: "Lavoro vero, di chi possiede questo computer",
      tipoRicavo: "progetto",
      imponibile: 1_000,
      dataIncasso: null,
    };
    await archivio().fatture.salva(mia);

    const primaVero = await conta(NOME_DB_VERO);
    expect(primaVero).toBe(1);

    // Lo stesso browser apre la demo.
    impostaArchivio(null);
    const stato = await preparaArchivio("?demo=vetrina");
    expect(stato.demo).toBe("vetrina");
    expect(stato.appenaCaricata).toBe(true);

    expect(await conta(NOME_DB_DEMO)).toBeGreaterThan(0);
    expect(await conta(NOME_DB_VERO)).toBe(primaVero);
  });

  it("al secondo ingresso non ricarica: chi torna ritrova quello che stava guardando", async () => {
    await preparaArchivio("?demo=vetrina");
    await archivio().fatture.elimina((await archivio().fatture.tutti())[0].id);
    const dopoLaModifica = await conta(NOME_DB_DEMO);

    impostaArchivio(null);
    const secondo = await preparaArchivio("?demo=vetrina");
    expect(secondo.appenaCaricata).toBe(false);
    expect(await conta(NOME_DB_DEMO)).toBe(dopoLaModifica);
  });

  it("la demo resta accesa quando l'indirizzo non porta più il parametro", async () => {
    await preparaArchivio("?demo=vetrina");
    impostaArchivio(null);
    // La navigazione interna porta a `/app/fatture`, senza query.
    const dopo = await preparaArchivio("");
    expect(dopo.demo).toBe("vetrina");
  });
});
