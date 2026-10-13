import { describe, expect, it } from "vitest";
import { registroSuBlob, type ScritturaBlob } from "./registro-blob";
import { nomeEvento, type EventoAccettazione, type EventoProva } from "./registro-prove";

/**
 * Che cosa arriva al magazzino, e con quali permessi.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché questo file esiste, e perché prima non esisteva
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Questo modulo è stato per settimane l'unico senza prove, con una ragione che
 * sembrava buona: non si può scrivere su Vercel Blob da una griglia di test, e
 * tutto quello che fa è chiamare `put` con cinque opzioni.
 *
 * Erano **quelle cinque opzioni** la cosa da provare. `access` dice se il file
 * che contiene un indirizzo email è leggibile da chiunque conosca la sua URL, e
 * sbagliarlo non produce nessun errore: la scrittura riesce, il programma
 * continua, e la differenza si vede solo aprendo un indirizzo da una finestra
 * senza credenziali. È esattamente la forma di difetto che questo progetto
 * insegue — una misura che conferma invece di una che rompe — applicata alla
 * riservatezza di un archivio probatorio.
 *
 * Quindi il magazzino si inietta: non per astrazione, per poter leggere quello
 * che gli si manda.
 */

function spia() {
  const chiamate: { percorso: string; corpo: string; opzioni: Parameters<ScritturaBlob>[2] }[] = [];
  const metti: ScritturaBlob = async (percorso, corpo, opzioni) => {
    chiamate.push({ percorso, corpo, opzioni });
    return {};
  };
  return { chiamate, metti };
}

const CONSENSO: EventoProva = {
  archivio: "consensi-marketing",
  email: "chi@esempio.it",
  tipo: "consenso",
  quando: "2026-10-13T14:31:07.201Z",
  versioneTesto: "2026-10-12",
  improntaTesto: "a".repeat(64),
};

const ACCETTAZIONE: EventoAccettazione = {
  archivio: "accettazioni-termini",
  id: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
  quando: "2026-10-13T14:31:07.201Z",
  versioneTermini: 3,
  improntaTermini: "b".repeat(64),
  versioneDichiarazioni: "2026-10-12",
  improntaDichiarazioni: "c".repeat(64),
};

describe("il registro su Vercel Blob", () => {
  it("scrive privato, e mai pubblico", async () => {
    const { chiamate, metti } = spia();
    const registro = registroSuBlob("vercel_blob_rw_finto", metti);
    await registro.scrivi(CONSENSO);
    await registro.escludi({ archivio: "esclusione", email: "chi@esempio.it", quando: CONSENSO.quando });
    await registro.accetta(ACCETTAZIONE);

    expect(chiamate).toHaveLength(3);
    for (const c of chiamate) {
      expect(
        c.opzioni.access,
        `${c.percorso} verrebbe scritto con access «${c.opzioni.access}».\n`
          + "Il magazzino è privato: un file pubblico dentro un magazzino privato non\n"
          + "dà nessun errore, e resta leggibile da chiunque ne conosca l'indirizzo.",
      ).toBe("private");
    }
  });

  it("manda l'evento intero, nel posto che decide nomeEvento", async () => {
    const { chiamate, metti } = spia();
    await registroSuBlob("vercel_blob_rw_finto", metti).accetta(ACCETTAZIONE);
    expect(chiamate[0].percorso).toBe(nomeEvento(ACCETTAZIONE));
    expect(JSON.parse(chiamate[0].corpo)).toEqual(ACCETTAZIONE);
  });

  it("porta il token che gli è stato dato, e le altre tre opzioni", async () => {
    const { chiamate, metti } = spia();
    await registroSuBlob("vercel_blob_rw_finto", metti).scrivi(CONSENSO);
    const o = chiamate[0].opzioni;
    expect(o.token).toBe("vercel_blob_rw_finto");
    /* Due eventi dello stesso tipo nello stesso giorno sono due file, non uno. */
    expect(o.addRandomSuffix).toBe(true);
    expect(o.contentType).toBe("application/json");
    /* Un oggetto in cache continua a esistere dopo essere stato cancellato. */
    expect(o.cacheControlMaxAge).toBe(0);
  });

  /*
    E se il magazzino rifiuta, l'errore **esce**: chi scrive deve saperlo. È
    quello che tiene fermo il pagamento quando la prova non si riesce a
    registrare — vedi `accettazione-server.ts`.
  */
  it("non ingoia l'errore del magazzino", async () => {
    const rotto: ScritturaBlob = async () => {
      throw new Error("ECONNRESET");
    };
    await expect(registroSuBlob("vercel_blob_rw_finto", rotto).accetta(ACCETTAZIONE)).rejects.toThrow(
      "ECONNRESET",
    );
  });
});
