import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CORPO_MASSIMO_BYTE,
  FORMA_IDENTIFICATIVO,
  convalidaAccettazione,
  gestisciAccettazione,
  type Dipendenze,
} from "./accettazione-server";
import { dichiarazioniMostrate } from "./dichiarazioni";
import { DICHIARAZIONE_PROFESSIONALE, accettazioneTermini } from "./acquisto";
import type { EventoAccettazione, RegistroProve } from "./registro-prove";

/**
 * La prova dell'accettazione, e il pagamento che la aspetta.
 *
 * Quello che si prova qui non è che la funzione risponda: è che **un acquisto
 * senza la sua prova non possa avvenire**. È una proprietà di ordine — prima
 * si scrive, poi si paga — e l'ordine è la cosa che si rompe senza produrre
 * nessun errore: invertito, funziona tutto, e ogni tanto resta un pagamento
 * di cui non si sa che cosa aveva davanti chi l'ha fatto.
 */

const IMPRONTA = "a".repeat(64);
const ORIGINE = "https://flowlance.it";
const CONF = { origini: [ORIGINE], magazzino: "vercel_blob_rw_finto" };

function posta(corpo: unknown = { versioneTermini: 3, improntaTermini: IMPRONTA }, intestazioni: Record<string, string> = {}) {
  return new Request("https://flowlance.it/api/accettazione", {
    method: "POST",
    headers: { origin: ORIGINE, "content-type": "application/json", ...intestazioni },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
}

function registroFinto(rompiti = false) {
  const scritti: EventoAccettazione[] = [];
  const registro: RegistroProve = {
    async scrivi() {
      throw new Error("qui non si scrivono eventi del servizio");
    },
    async escludi() {
      throw new Error("qui non si esclude nessuno");
    },
    async accetta(e) {
      if (rompiti) throw new Error("magazzino non raggiungibile");
      scritti.push(e);
    },
  };
  return { registro, scritti };
}

const dip = (registro: RegistroProve | null, extra: Partial<Dipendenze> = {}): Dipendenze => ({
  registro,
  adesso: () => "2026-10-13T12:00:00.000Z",
  identificativo: () => "0123456789abcdef0123456789abcdef",
  ...extra,
});

describe("la registrazione dell'accettazione", () => {
  it("registra la versione dei Termini che la pagina ha mostrato", async () => {
    const r = registroFinto();
    const esito = await gestisciAccettazione(posta(), CONF, dip(r.registro));
    expect(esito.stato).toBe(200);
    expect(r.scritti).toHaveLength(1);
    expect(r.scritti[0]).toMatchObject({
      archivio: "accettazioni-termini",
      versioneTermini: 3,
      improntaTermini: IMPRONTA,
      quando: "2026-10-13T12:00:00.000Z",
    });
  });

  it("e restituisce l'identificativo da portare a Stripe", async () => {
    const r = registroFinto();
    const esito = await gestisciAccettazione(posta(), CONF, dip(r.registro));
    expect(esito.corpo).toEqual({ ok: true, id: "0123456789abcdef0123456789abcdef" });
    expect(r.scritti[0].id).toBe("0123456789abcdef0123456789abcdef");
    expect(FORMA_IDENTIFICATIVO.test(r.scritti[0].id)).toBe(true);
  });

  /*
    Le due dichiarazioni **non** le detta il browser: le ricompone il server
    dalla versione ricevuta. Se le mandasse la pagina, la prova direbbe quello
    che la pagina ha voluto dire, non quello che il testo era.
  */
  it("l'impronta delle dichiarazioni la calcola il server, non chi chiama", async () => {
    const r = registroFinto();
    await gestisciAccettazione(
      posta({ versioneTermini: 3, improntaTermini: IMPRONTA, improntaDichiarazioni: "finta" }),
      CONF,
      dip(r.registro),
    );
    const atteso = createHash("sha256")
      .update(`${accettazioneTermini(3)}\n\n${DICHIARAZIONE_PROFESSIONALE}`, "utf8")
      .digest("hex");
    expect(r.scritti[0].improntaDichiarazioni).toBe(atteso);
    expect(r.scritti[0].improntaDichiarazioni).not.toBe("finta");
  });

  it("e da quell'impronta si risale al testo esatto delle due caselle", () => {
    const d = dichiarazioniMostrate(3);
    expect(d.testo).toContain("versione 3");
    expect(d.testo).toContain("Flowlance non è destinato ai consumatori");
    expect(createHash("sha256").update(d.testo, "utf8").digest("hex")).toBe(d.impronta);
  });

  it("l'evento non contiene nessun dato personale", async () => {
    const r = registroFinto();
    await gestisciAccettazione(posta(), CONF, dip(r.registro));
    const scritto = JSON.stringify(r.scritti[0]);
    for (const vietato of ["@", "email", "ip", "Mozilla", "user", "agent"]) {
      expect(scritto.toLowerCase(), `nell'evento è finito ${vietato}`).not.toContain(vietato.toLowerCase());
    }
  });
});

describe("quando il pagamento non deve partire", () => {
  /*
    Il caso che conta: il magazzino non risponde. La pagina non apre Stripe, e
    la risposta dice che cosa fare. Un 200 ottimista qui — «registriamo dopo» —
    sarebbe un acquisto senza prova, cioè il difetto che tutto questo giro
    esiste per rendere impossibile.
  */
  it("con il registro rotto non si registra niente e la risposta è un errore", async () => {
    const r = registroFinto(true);
    const esito = await gestisciAccettazione(posta(), CONF, dip(r.registro));
    expect(esito.stato).toBe(502);
    expect(esito.corpo).toMatchObject({ ok: false });
    expect(JSON.stringify(esito.corpo)).toContain("non apro il pagamento");
    expect(esito.registro).toContain("registro non raggiungibile");
  });

  it("senza magazzino configurato risponde 503, e lo dice nei log", async () => {
    const esito = await gestisciAccettazione(posta(), { origini: [ORIGINE], magazzino: undefined }, dip(null));
    expect(esito.stato).toBe(503);
    expect(esito.registro).toContain("non configurato");
  });

  it("da un'altra origine non si registra niente", async () => {
    const r = registroFinto();
    const esito = await gestisciAccettazione(
      posta(undefined, { origin: "https://copia-del-sito.example" }),
      CONF,
      dip(r.registro),
    );
    expect(esito.stato).toBe(403);
    expect(r.scritti).toHaveLength(0);
  });

  it("in GET nemmeno", async () => {
    const r = registroFinto();
    const esito = await gestisciAccettazione(
      new Request("https://flowlance.it/api/accettazione", { method: "GET", headers: { origin: ORIGINE } }),
      CONF,
      dip(r.registro),
    );
    expect(esito.stato).toBe(405);
    expect(r.scritti).toHaveLength(0);
  });

  it("un corpo enorme si ferma prima di essere letto", async () => {
    const r = registroFinto();
    const esito = await gestisciAccettazione(posta("x".repeat(CORPO_MASSIMO_BYTE + 1)), CONF, dip(r.registro));
    expect(esito.stato).toBe(413);
    expect(r.scritti).toHaveLength(0);
  });
});

describe("la convalida del corpo", () => {
  it("prende quello che serve", () => {
    expect(convalidaAccettazione({ versioneTermini: 3, improntaTermini: IMPRONTA })).toEqual({
      ok: true,
      dati: { versioneTermini: 3, improntaTermini: IMPRONTA },
    });
  });

  it("e rifiuta tutto il resto", () => {
    const brutti = [
      null,
      "3",
      { versioneTermini: "3", improntaTermini: IMPRONTA },
      { versioneTermini: 0, improntaTermini: IMPRONTA },
      { versioneTermini: 3.5, improntaTermini: IMPRONTA },
      { versioneTermini: 3 },
      { versioneTermini: 3, improntaTermini: "troppo corta" },
      { versioneTermini: 3, improntaTermini: IMPRONTA.toUpperCase() },
    ];
    for (const b of brutti) {
      expect(convalidaAccettazione(b).ok, `${JSON.stringify(b)} è passato`).toBe(false);
    }
  });
});
