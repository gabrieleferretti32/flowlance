import { beforeEach, describe, expect, it } from "vitest";
import {
  CORPO_MASSIMO_BYTE,
  FRENO,
  azzeraFreno,
  gestisciPromemoria,
  originiAmmesse,
  type Configurazione,
} from "./promemoria-server";

const OGGI = "2026-10-01";
const ADESSO = 1_767_225_600_000;

const CONF: Configurazione = {
  chiave: "xkeysib-finta",
  lista: "7",
  listaMarketing: "9",
  modello: "3",
  ritorno: "https://flowlance.it/simulatore/",
  origini: ["https://flowlance.it"],
};

const CORPO = {
  email: "mario@example.com",
  compilatoIn: 9_000,
  marketing: false,
  attributi: {
    REGIME: "forfettario",
    ACCANTONAMENTO_MESE: 966.15,
    SCAD_1_DATA: "2026-11-30",
    SCAD_1_IMPORTO: 5_329.48,
    SCAD_2_DATA: "2027-06-30",
    SCAD_2_IMPORTO: 6_264.28,
  },
};

function posta(corpo: unknown = CORPO, intestazioni: Record<string, string> = {}): Request {
  return new Request("https://flowlance.it/api/promemoria", {
    method: "POST",
    headers: { origin: "https://flowlance.it", "content-type": "application/json", ...intestazioni },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
}

/** Un `fetch` che non chiama nessuno e registra cosa gli è stato chiesto. */
function spia(risposta: Response = new Response("{}", { status: 201 })) {
  const chiamate: { url: string; opzioni: RequestInit }[] = [];
  const finto: typeof globalThis.fetch = async (url, opzioni) => {
    chiamate.push({ url: String(url), opzioni: opzioni ?? {} });
    return risposta;
  };
  return { chiamate, finto };
}

const dip = (f: typeof globalThis.fetch) => ({ fetch: f, oggi: OGGI, adesso: ADESSO });

beforeEach(azzeraFreno);

describe("la strada buona", () => {
  it("risponde ok e chiama l'endpoint del doppio opt-in", async () => {
    const s = spia();
    const r = await gestisciPromemoria(posta(), CONF, dip(s.finto));
    expect(r.stato).toBe(200);
    expect(r.corpo).toEqual({ ok: true });
    expect(s.chiamate).toHaveLength(1);
    /*
      L'endpoint, non `/v3/contacts`: quello creerebbe il contatto senza
      mandare niente, e «doppio opt-in attivo» sarebbe falso.
    */
    expect(s.chiamate[0].url).toBe("https://api.brevo.com/v3/contacts/doubleOptinConfirmation");
  });

  it("manda la chiave nell'intestazione, e mai nel corpo", async () => {
    const s = spia();
    await gestisciPromemoria(posta(), CONF, dip(s.finto));
    const { headers, body } = s.chiamate[0].opzioni;
    expect((headers as Record<string, string>)["api-key"]).toBe("xkeysib-finta");
    expect(String(body)).not.toContain("xkeysib");
  });

  it("manda i sei attributi, la lista, il modello e il ritorno", async () => {
    const s = spia();
    await gestisciPromemoria(posta(), CONF, dip(s.finto));
    const inviato = JSON.parse(String(s.chiamate[0].opzioni.body));
    expect(inviato.email).toBe("mario@example.com");
    expect(inviato.includeListIds).toEqual([7]);
    expect(inviato.templateId).toBe(3);
    expect(inviato.redirectionUrl).toBe("https://flowlance.it/simulatore/");
    expect(Object.keys(inviato.attributes)).toHaveLength(6);
    expect(inviato.attributes.SCAD_1_IMPORTO).toBe(5_329.48);
  });

  /*
    Il fatturato digitato non arriva a Brevo nemmeno se il browser lo manda.
    La convalida ricostruisce invece di filtrare, e qui si guarda il corpo
    vero della richiesta HTTP — non il valore di ritorno di una funzione.
  */
  it("il fatturato stimato non esce da questa funzione", async () => {
    const s = spia();
    await gestisciPromemoria(
      posta({ ...CORPO, attributi: { ...CORPO.attributi, FATTURATO_STIMATO: 40_000 } }),
      CONF,
      dip(s.finto),
    );
    const corpo = String(s.chiamate[0].opzioni.body);
    expect(corpo).not.toContain("FATTURATO_STIMATO");
    expect(corpo).not.toContain("40000");
  });

  it("niente oltre i sei attributi arriva a Brevo", async () => {
    const s = spia();
    await gestisciPromemoria(
      posta({ ...CORPO, attributi: { ...CORPO.attributi, GESTIONE: "separata" } }),
      CONF,
      dip(s.finto),
    );
    const inviato = JSON.parse(String(s.chiamate[0].opzioni.body));
    expect(inviato.attributes.GESTIONE).toBeUndefined();
  });
});

describe("i due consensi, due liste", () => {
  it("senza marketing entra solo nella lista dei promemoria", async () => {
    const s = spia();
    await gestisciPromemoria(posta({ ...CORPO, marketing: false }), CONF, dip(s.finto));
    expect(JSON.parse(String(s.chiamate[0].opzioni.body)).includeListIds).toEqual([7]);
  });

  it("con il marketing entra in tutte e due", async () => {
    const s = spia();
    await gestisciPromemoria(posta({ ...CORPO, marketing: true }), CONF, dip(s.finto));
    expect(JSON.parse(String(s.chiamate[0].opzioni.body)).includeListIds).toEqual([7, 9]);
  });

  /*
    Il verso che conta: rifiutare le comunicazioni commerciali **non** impedisce
    di ricevere i promemoria. È la ragione per cui le caselle sono due, ed è la
    cosa che si romperebbe per prima se un giorno qualcuno «semplificasse»
    tornando a un consenso solo.
  */
  it("chi rifiuta il marketing resta iscritto ai promemoria", async () => {
    const s = spia();
    const r = await gestisciPromemoria(posta({ ...CORPO, marketing: false }), CONF, dip(s.finto));
    expect(r.stato).toBe(200);
    expect(JSON.parse(String(s.chiamate[0].opzioni.body)).includeListIds).toContain(7);
  });

  /*
    E il contrario di una lista separata: se la lista del marketing non è
    configurata, la funzione **non** iscrive ai soli promemoria chi aveva
    spuntato tutte e due. Accettare un consenso e non registrarlo è peggio
    che non raccoglierlo — e l'alternativa silenziosa sarebbe invisibile sia a
    chi si iscrive sia a chi guarda i numeri.
  */
  it("senza la lista del marketing la funzione è spenta, non a metà", async () => {
    const s = spia();
    const r = await gestisciPromemoria(
      posta({ ...CORPO, marketing: true }),
      { ...CONF, listaMarketing: undefined },
      dip(s.finto),
    );
    expect(r.stato).toBe(503);
    expect(s.chiamate).toHaveLength(0);
  });
});

describe("spenta finché non è configurata", () => {
  for (const mancante of ["chiave", "lista", "listaMarketing", "modello"] as const) {
    it(`senza ${mancante} risponde 503 e non contatta nessuno`, async () => {
      const s = spia();
      const r = await gestisciPromemoria(posta(), { ...CONF, [mancante]: undefined }, dip(s.finto));
      expect(r.stato).toBe(503);
      expect(s.chiamate).toHaveLength(0);
    });
  }

  /*
    La prova che l'interruttore è davvero un interruttore: con la
    configurazione vuota non parte **niente**, nemmeno su una richiesta
    perfetta. È il presidio che tiene i dati fermi finché l'informativa non li
    descrive.
  */
  it("con tutto spento, una richiesta valida non manda un byte", async () => {
    const s = spia();
    const r = await gestisciPromemoria(
      posta(),
      { ...CONF, chiave: undefined, lista: undefined, listaMarketing: undefined, modello: undefined },
      dip(s.finto),
    );
    expect(r.stato).toBe(503);
    expect(r.corpo).toEqual({
      ok: false,
      errore: "I promemoria non sono ancora attivi. Riprova fra qualche giorno.",
    });
    expect(s.chiamate).toHaveLength(0);
  });
});

describe("quello che si rifiuta prima di Brevo", () => {
  it("un GET non passa", async () => {
    const s = spia();
    const r = await gestisciPromemoria(
      new Request("https://flowlance.it/api/promemoria", { headers: { origin: "https://flowlance.it" } }),
      CONF,
      dip(s.finto),
    );
    expect(r.stato).toBe(405);
    expect(s.chiamate).toHaveLength(0);
  });

  it("un'origine estranea non passa", async () => {
    const s = spia();
    const r = await gestisciPromemoria(posta(CORPO, { origin: "https://altro.example" }), CONF, dip(s.finto));
    expect(r.stato).toBe(403);
    expect(s.chiamate).toHaveLength(0);
  });

  it("senza origine non passa", async () => {
    const s = spia();
    const r = await gestisciPromemoria(
      new Request("https://flowlance.it/api/promemoria", { method: "POST", body: JSON.stringify(CORPO) }),
      CONF,
      dip(s.finto),
    );
    expect(r.stato).toBe(403);
  });

  it("un corpo enorme non passa", async () => {
    const s = spia();
    const r = await gestisciPromemoria(posta("x".repeat(CORPO_MASSIMO_BYTE + 1)), CONF, dip(s.finto));
    expect(r.stato).toBe(413);
    expect(s.chiamate).toHaveLength(0);
  });

  it("un JSON rotto non manda in pezzi la funzione", async () => {
    const s = spia();
    const r = await gestisciPromemoria(posta("{non json"), CONF, dip(s.finto));
    expect(r.stato).toBe(400);
  });

  it("la trappola temporale ferma l'invio istantaneo", async () => {
    const s = spia();
    const r = await gestisciPromemoria(posta({ ...CORPO, compilatoIn: 12 }), CONF, dip(s.finto));
    expect(r.stato).toBe(400);
    expect(s.chiamate).toHaveLength(0);
  });
});

describe("il freno", () => {
  it(`passa ${FRENO.tentativi} volte e poi frena`, async () => {
    const s = spia();
    for (let i = 0; i < FRENO.tentativi; i++) {
      const r = await gestisciPromemoria(posta(CORPO, { "x-forwarded-for": "1.2.3.4" }), CONF, dip(s.finto));
      expect(r.stato).toBe(200);
    }
    const r = await gestisciPromemoria(posta(CORPO, { "x-forwarded-for": "1.2.3.4" }), CONF, dip(s.finto));
    expect(r.stato).toBe(429);
    expect(s.chiamate).toHaveLength(FRENO.tentativi);
  });

  it("un altro indirizzo non è frenato dal primo", async () => {
    const s = spia();
    for (let i = 0; i < FRENO.tentativi + 2; i++) {
      await gestisciPromemoria(posta(CORPO, { "x-forwarded-for": "1.2.3.4" }), CONF, dip(s.finto));
    }
    const r = await gestisciPromemoria(posta(CORPO, { "x-forwarded-for": "5.6.7.8" }), CONF, dip(s.finto));
    expect(r.stato).toBe(200);
  });

  it("passata la finestra si riparte", async () => {
    const s = spia();
    for (let i = 0; i < FRENO.tentativi; i++) {
      await gestisciPromemoria(posta(CORPO, { "x-forwarded-for": "1.2.3.4" }), CONF, dip(s.finto));
    }
    const dopo = { fetch: s.finto, oggi: OGGI, adesso: ADESSO + FRENO.finestraMs + 1 };
    const r = await gestisciPromemoria(posta(CORPO, { "x-forwarded-for": "1.2.3.4" }), CONF, dopo);
    expect(r.stato).toBe(200);
  });

  /*
    Chi manda spazzatura non consuma i tentativi di chi condivide il suo
    indirizzo di rete: il freno sta dopo la convalida, di proposito.
  */
  it("le richieste malformate non consumano i tentativi di un ufficio", async () => {
    const s = spia();
    for (let i = 0; i < 20; i++) {
      await gestisciPromemoria(posta("{rotto", { "x-forwarded-for": "9.9.9.9" }), CONF, dip(s.finto));
    }
    const r = await gestisciPromemoria(posta(CORPO, { "x-forwarded-for": "9.9.9.9" }), CONF, dip(s.finto));
    expect(r.stato).toBe(200);
  });

  it("prende il primo indirizzo della catena, non tutta l'intestazione", async () => {
    const s = spia();
    for (let i = 0; i < FRENO.tentativi; i++) {
      await gestisciPromemoria(posta(CORPO, { "x-forwarded-for": "1.2.3.4, 10.0.0.1" }), CONF, dip(s.finto));
    }
    const r = await gestisciPromemoria(posta(CORPO, { "x-forwarded-for": "1.2.3.4, 10.0.0.9" }), CONF, dip(s.finto));
    expect(r.stato).toBe(429);
  });
});

describe("quando Brevo risponde male", () => {
  it("un 400 diventa un 502 e il dettaglio resta nel registro", async () => {
    const s = spia(new Response('{"code":"invalid_parameter","message":"templateId"}', { status: 400 }));
    const r = await gestisciPromemoria(posta(), CONF, dip(s.finto));
    expect(r.stato).toBe(502);
    expect(r.corpo).toEqual({
      ok: false,
      errore: "L'iscrizione non è andata a buon fine. Riprova fra un attimo.",
    });
    expect(r.registro).toContain("templateId");
    // Il messaggio a schermo non riporta i codici di Brevo.
    expect(JSON.stringify(r.corpo)).not.toContain("invalid_parameter");
  });

  it("una rete che cade diventa un 502, non un'eccezione", async () => {
    const rotto: typeof globalThis.fetch = async () => {
      throw new Error("ECONNRESET");
    };
    const r = await gestisciPromemoria(posta(), CONF, dip(rotto));
    expect(r.stato).toBe(502);
    expect(r.registro).toContain("ECONNRESET");
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
