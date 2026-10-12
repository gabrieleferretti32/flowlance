import { describe, expect, it } from "vitest";
import type { ClientBrevo, ContattoBrevo } from "./brevo";
import {
  ATTRIBUTO_ATTIVITA,
  TERMINI,
  decidi,
  ultimaAttivita,
  ultimaScadenza,
  type Configurazione,
} from "./pulizia";
import { eseguiPulizia, type Dipendenze } from "./pulizia-server";
import {
  CONSERVAZIONE_PROVE_MESI,
  VERSIONE_TESTO_CONSENSI,
  conservazioneConfermata,
  type EventoProva,
  type RegistroProve,
} from "./registro-prove";
import { piuGiorni, piuMesi } from "./calendario";

const CONF: Configurazione = { listaPromemoria: 7, listaMarketing: 9 };
const PROMEMORIA = 7;
const MARKETING = 9;

function contatto(parziale: Partial<ContattoBrevo> = {}): ContattoBrevo {
  return {
    id: 1,
    email: "mario@example.com",
    listIds: [PROMEMORIA],
    attributes: {
      REGIME: "forfettario",
      ACCANTONAMENTO_MESE: 966.15,
      SCAD_1_DATA: "2026-11-30",
      SCAD_1_IMPORTO: 5_329.48,
      SCAD_2_DATA: "2027-06-30",
      SCAD_2_IMPORTO: 6_264.28,
      [ATTRIBUTO_ATTIVITA]: "2026-10-01",
    },
    createdAt: "2026-10-01T09:00:00.000Z",
    modifiedAt: "2026-10-01T09:00:00.000Z",
    ...parziale,
  };
}

/** Un Brevo finto: registra tutto, non parla con nessuno. */
function brevoFinto(contatti: ContattoBrevo[] = []) {
  const chiamate: { metodo: string; email: string; dettaglio?: unknown }[] = [];
  let rompiti: string | null = null;
  const client: ClientBrevo = {
    async elencaContatti(offset, limite) {
      if (rompiti === "elenca") throw new Error("Brevo 500");
      return contatti.slice(offset, offset + limite);
    },
    async aggiornaAttributi(email, attributi) {
      if (rompiti === email) throw new Error("Brevo 400");
      chiamate.push({ metodo: "aggiornaAttributi", email, dettaglio: attributi });
    },
    async togliDaLista(email, lista) {
      if (rompiti === email) throw new Error("Brevo 400");
      chiamate.push({ metodo: "togliDaLista", email, dettaglio: lista });
    },
    async cancellaContatto(email) {
      if (rompiti === email) throw new Error("Brevo 400");
      chiamate.push({ metodo: "cancellaContatto", email });
    },
  };
  return {
    client,
    chiamate,
    rompi: (chi: string) => {
      rompiti = chi;
    },
    listeToccate: () =>
      chiamate.filter((c) => c.metodo === "togliDaLista").map((c) => c.dettaglio),
  };
}

/** Un registro delle prove finto: raccoglie, non scrive da nessuna parte. */
function registroFinto(rompiti = false) {
  const eventi: EventoProva[] = [];
  const registro: RegistroProve = {
    async scrivi(e) {
      if (rompiti) throw new Error("magazzino non raggiungibile");
      eventi.push(e);
    },
  };
  return { registro, eventi };
}

/** Le dipendenze complete, con il termine confermato: è il caso normale. */
function dip(client: ClientBrevo, oggi: string, extra: Partial<Dipendenze> = {}): Dipendenze {
  return {
    client,
    registro: registroFinto().registro,
    conservazioneProveMesi: 24,
    conf: CONF,
    oggi,
    ...extra,
  };
}

const tipi = (c: ContattoBrevo, oggi: string) => decidi(c, CONF, oggi).map((a) => a.tipo);

// ————————————————————————————————————————————————————————————
// 1 · Iscrizioni mai confermate
// ————————————————————————————————————————————————————————————

describe("iscrizioni mai confermate: 30 giorni dalla richiesta", () => {
  const mai = (oggi: string) =>
    decidi(contatto({ listIds: [], attributes: { [ATTRIBUTO_ATTIVITA]: "2026-10-01" } }), CONF, oggi);

  it("il giorno prima dei trenta non si cancella niente", () => {
    expect(mai("2026-10-30")).toEqual([]);
  });

  it("al trentesimo si cancella", () => {
    const a = mai("2026-10-31");
    expect(a).toHaveLength(1);
    expect(a[0].tipo).toBe("cancella");
  });

  /*
    Il segnale è l'assenza dalle liste, non un campo di Brevo: le liste si
    popolano solo dopo la conferma. Vale anche se un giorno Brevo cambiasse il
    modo di rappresentare i contatti in attesa.
  */
  it("chi è in una lista ha confermato, e non si cancella mai per questo", () => {
    for (const liste of [[PROMEMORIA], [MARKETING], [PROMEMORIA, MARKETING]]) {
      const a = decidi(contatto({ listIds: liste, attributes: { [ATTRIBUTO_ATTIVITA]: "2020-01-01" } }), CONF, "2026-10-31");
      expect(a.map((x) => x.tipo)).not.toContain("cancella");
    }
  });

  it("una lista che non è una delle nostre non conta come conferma", () => {
    const a = decidi(contatto({ listIds: [42], attributes: { [ATTRIBUTO_ATTIVITA]: "2026-10-01" } }), CONF, "2026-10-31");
    expect(a[0]?.tipo).toBe("cancella");
  });

  it("senza ULTIMA_ATTIVITA si ripiega su createdAt", () => {
    const c = contatto({ listIds: [], attributes: {}, createdAt: "2026-10-01T09:00:00.000Z" });
    expect(decidi(c, CONF, "2026-10-30")).toEqual([]);
    expect(decidi(c, CONF, "2026-10-31")[0].tipo).toBe("cancella");
  });

  it("cancellato, non gli si fa altro", () => {
    const c = contatto({ listIds: [], attributes: { [ATTRIBUTO_ATTIVITA]: "2020-01-01" } });
    expect(decidi(c, CONF, "2026-10-31")).toHaveLength(1);
  });
});

// ————————————————————————————————————————————————————————————
// 2 · I dati del calcolo
// ————————————————————————————————————————————————————————————

describe("dati del calcolo: 30 giorni dall'ultima scadenza", () => {
  it("il giorno prima non si svuota niente", () => {
    // Ultima scadenza 2027-06-30, più trenta: 2027-07-30.
    expect(tipi(contatto(), "2027-07-29")).toEqual([]);
  });

  it("al trentesimo si svuota e si esce dai promemoria", () => {
    expect(tipi(contatto(), "2027-07-30")).toEqual(["svuotaCalcolo", "esciDaLista"]);
  });

  /*
    La trappola che il legale ha nominato per prima: l'ultima scadenza non è
    sempre SCAD_2. Nel primo anno di attività, e sotto la soglia degli
    acconti, SCAD_2 è vuoto fin dall'inizio — e sarebbero proprio quei
    contatti, con una data sola, a restare scritti per sempre.
  */
  describe("quando SCAD_2 è vuoto, l'ultima scadenza è SCAD_1", () => {
    const soloUna = (valore: string | null) =>
      contatto({
        attributes: {
          SCAD_1_DATA: "2027-06-30",
          SCAD_1_IMPORTO: 16_231.27,
          SCAD_2_DATA: valore,
          [ATTRIBUTO_ATTIVITA]: "2026-10-01",
        },
      });

    for (const vuoto of [null, "", undefined]) {
      it(`SCAD_2_DATA = ${JSON.stringify(vuoto)}`, () => {
        const c = soloUna(vuoto as string | null);
        expect(ultimaScadenza(c)).toBe("2027-06-30");
        expect(tipi(c, "2027-07-29")).toEqual([]);
        expect(tipi(c, "2027-07-30")).toEqual(["svuotaCalcolo", "esciDaLista"]);
      });
    }
  });

  it("con tutte e due le date vince la seconda, anche se è più vicina", () => {
    const c = contatto({
      attributes: { SCAD_1_DATA: "2027-06-30", SCAD_2_DATA: "2026-11-30", [ATTRIBUTO_ATTIVITA]: "2026-10-01" },
    });
    expect(ultimaScadenza(c)).toBe("2026-11-30");
  });

  it("le date arrivano anche con l'ora attaccata, e si guarda il giorno", () => {
    const c = contatto({ attributes: { SCAD_2_DATA: "2027-06-30T00:00:00.000Z", [ATTRIBUTO_ATTIVITA]: "2026-10-01" } });
    expect(ultimaScadenza(c)).toBe("2027-06-30");
    expect(tipi(c, "2027-07-29")).toEqual([]);
    expect(tipi(c, "2027-07-30")[0]).toBe("svuotaCalcolo");
  });

  /*
    «Salvo nuovo calcolo»: chi rifà il conto riscrive le date, e il termine
    riparte da quelle nuove. Non serve una regola a parte — serve che la
    regola guardi le date di adesso, e questo test lo fissa.
  */
  it("un nuovo calcolo rinnova i dati: il termine riparte dalle date nuove", () => {
    const vecchio = contatto({ attributes: { SCAD_2_DATA: "2026-11-30", [ATTRIBUTO_ATTIVITA]: "2026-10-01" } });
    expect(tipi(vecchio, "2026-12-30")).toEqual(["svuotaCalcolo", "esciDaLista"]);

    const rifatto = contatto({
      attributes: { SCAD_1_DATA: "2027-06-30", SCAD_2_DATA: "2027-11-30", [ATTRIBUTO_ATTIVITA]: "2026-12-01" },
    });
    expect(tipi(rifatto, "2026-12-30")).toEqual([]);
    expect(tipi(rifatto, "2027-12-30")).toEqual(["svuotaCalcolo", "esciDaLista"]);
  });

  it("svuotare tocca le quattro voci del calcolo e nient'altro", async () => {
    const b = brevoFinto([contatto()]);
    await eseguiPulizia(dip(b.client, "2027-07-30"));
    const scritte = b.chiamate.find((c) => c.metodo === "aggiornaAttributi")?.dettaglio as Record<string, string>;
    expect(Object.keys(scritte).sort()).toEqual(
      ["SCAD_1_DATA", "SCAD_1_IMPORTO", "SCAD_2_DATA", "SCAD_2_IMPORTO"],
    );
    expect(scritte.REGIME).toBeUndefined();
    expect(scritte.ACCANTONAMENTO_MESE).toBeUndefined();
  });

  /*
    Il difetto che si sarebbe annidato qui: la pulizia scrive, e se scrivesse
    anche ULTIMA_ATTIVITA rimetterebbe a zero l'orologio del marketing — i
    contatti non uscirebbero mai, rinnovati da chi aveva il compito di
    toglierli. Nessun errore, nessuna riga storta: solo gente che non se ne va.
  */
  it("e non tocca MAI l'orologio dell'attività", async () => {
    const b = brevoFinto([contatto({ listIds: [PROMEMORIA, MARKETING] })]);
    await eseguiPulizia(dip(b.client, "2027-07-30"));
    for (const c of b.chiamate.filter((x) => x.metodo === "aggiornaAttributi")) {
      expect(Object.keys(c.dettaglio as object)).not.toContain(ATTRIBUTO_ATTIVITA);
    }
  });
});

// ————————————————————————————————————————————————————————————
// 3 · La rete di sicurezza sui promemoria
// ————————————————————————————————————————————————————————————

describe("promemoria: 12 mesi senza attività, se non restano scadenze", () => {
  const senzaDate = (attivita: string) =>
    contatto({ listIds: [PROMEMORIA], attributes: { [ATTRIBUTO_ATTIVITA]: attivita } });

  it("il giorno prima dei dodici mesi resta in lista", () => {
    expect(tipi(senzaDate("2026-10-01"), "2027-09-30")).toEqual([]);
  });

  it("al dodicesimo mese esce", () => {
    const a = decidi(senzaDate("2026-10-01"), CONF, "2027-10-01");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ tipo: "esciDaLista", lista: PROMEMORIA });
  });

  it("con una scadenza futura non esce, per quanto vecchia sia l'attività", () => {
    const c = contatto({
      listIds: [PROMEMORIA],
      attributes: { SCAD_2_DATA: "2030-06-30", [ATTRIBUTO_ATTIVITA]: "2020-01-01" },
    });
    expect(tipi(c, "2027-10-01")).toEqual([]);
  });
});

// ————————————————————————————————————————————————————————————
// 4 · Il marketing, e l'isolamento fra le due liste
// ————————————————————————————————————————————————————————————

describe("marketing: 24 mesi dal consenso o dall'ultima interazione", () => {
  const soloMarketing = (attivita: string) =>
    contatto({ listIds: [MARKETING], attributes: { [ATTRIBUTO_ATTIVITA]: attivita } });

  it("il giorno prima dei ventiquattro mesi resta", () => {
    expect(tipi(soloMarketing("2026-10-01"), "2028-09-30")).toEqual([]);
  });

  it("al ventiquattresimo mese esce", () => {
    const a = decidi(soloMarketing("2026-10-01"), CONF, "2028-10-01");
    expect(a).toEqual([
      expect.objectContaining({ tipo: "esciDaLista", lista: MARKETING }),
    ]);
  });

  it("un'interazione attiva più recente rimanda il termine", () => {
    expect(tipi(soloMarketing("2027-06-01"), "2028-10-01")).toEqual([]);
    expect(tipi(soloMarketing("2027-06-01"), "2029-06-01")).toHaveLength(1);
  });
});

/*
  ─────────────────────────────────────────────────────────────────────────
  L'isolamento fra le due liste, nei due versi
  ─────────────────────────────────────────────────────────────────────────

  Sono due consensi distinti e due termini distinti. Una pulizia che
  lavorando sui promemoria togliesse anche dal marketing cancellerebbe un
  consenso che nessuno ha revocato; nel verso opposto spegnerebbe un servizio
  che la persona ha chiesto, per far scadere una pubblicità.
*/
describe("le due liste non si toccano a vicenda", () => {
  it("il servizio finisce: esce dai promemoria e resta nel marketing", async () => {
    const b = brevoFinto([contatto({ listIds: [PROMEMORIA, MARKETING] })]);
    await eseguiPulizia(dip(b.client, "2027-07-30"));
    expect(b.listeToccate()).toEqual([PROMEMORIA]);
    expect(b.chiamate.some((c) => c.metodo === "cancellaContatto")).toBe(false);
  });

  it("il marketing scade: esce dal marketing e resta nei promemoria", async () => {
    const c = contatto({
      listIds: [PROMEMORIA, MARKETING],
      attributes: { SCAD_2_DATA: "2030-06-30", [ATTRIBUTO_ATTIVITA]: "2026-10-01" },
    });
    const b = brevoFinto([c]);
    await eseguiPulizia(dip(b.client, "2028-10-01"));
    expect(b.listeToccate()).toEqual([MARKETING]);
    expect(b.chiamate.some((x) => x.metodo === "aggiornaAttributi")).toBe(false);
  });

  it("quando scadono tutti e due, escono da tutte e due e il contatto resta", async () => {
    const c = contatto({
      listIds: [PROMEMORIA, MARKETING],
      attributes: { SCAD_2_DATA: "2026-11-30", [ATTRIBUTO_ATTIVITA]: "2026-10-01" },
    });
    const b = brevoFinto([c]);
    await eseguiPulizia(dip(b.client, "2028-10-01"));
    expect(b.listeToccate().sort()).toEqual([PROMEMORIA, MARKETING]);
    expect(b.chiamate.some((x) => x.metodo === "cancellaContatto")).toBe(false);
  });
});

// ————————————————————————————————————————————————————————————
// Il giro
// ————————————————————————————————————————————————————————————

describe("il giro della pulizia", () => {
  it("conta quello che ha fatto", async () => {
    const b = brevoFinto([
      contatto({ email: "a@example.com" }),
      contatto({ email: "b@example.com", listIds: [], attributes: { [ATTRIBUTO_ATTIVITA]: "2020-01-01" } }),
    ]);
    const r = await eseguiPulizia(dip(b.client, "2027-07-30"));
    expect(r.esaminati).toBe(2);
    expect(r.cancellati).toBe(1);
    expect(r.calcoliSvuotati).toBe(1);
    expect(r.usciteDaLista).toBe(1);
    expect(r.errori).toHaveLength(0);
  });

  it("prova soltanto: decide tutto ed esegue niente", async () => {
    const b = brevoFinto([contatto()]);
    const r = await eseguiPulizia(dip(b.client, "2027-07-30", { provaSoltanto: true }));
    expect(r.calcoliSvuotati).toBe(1);
    expect(r.fatte).toHaveLength(2);
    expect(b.chiamate).toHaveLength(0);
  });

  it("un contatto che non si lascia toccare non ferma gli altri", async () => {
    const b = brevoFinto([
      contatto({ email: "rotto@example.com" }),
      contatto({ email: "buono@example.com" }),
    ]);
    b.rompi("rotto@example.com");
    const r = await eseguiPulizia(dip(b.client, "2027-07-30"));
    expect(r.esaminati).toBe(2);
    expect(r.errori.length).toBeGreaterThan(0);
    expect(b.chiamate.some((c) => c.email === "buono@example.com")).toBe(true);
  });

  /*
    L'elenco che non arriva ferma il giro, e deve: andare avanti saltando una
    pagina vorrebbe dire non guardare cinquecento contatti e dire che è
    andato tutto bene.
  */
  it("se l'elenco non arriva, il giro si ferma e lo dice", async () => {
    const b = brevoFinto([contatto()]);
    b.rompi("elenca");
    const r = await eseguiPulizia(dip(b.client, "2027-07-30"));
    expect(r.esaminati).toBe(0);
    expect(r.errori[0].azione).toBe("elenca");
  });

  it("un archivio vuoto non fa niente e non si lamenta", async () => {
    const b = brevoFinto([]);
    const r = await eseguiPulizia(dip(b.client, "2027-07-30"));
    expect(r).toMatchObject({ esaminati: 0, cancellati: 0, errori: [], troncata: false });
  });
});

// ————————————————————————————————————————————————————————————
// Il registro delle prove
// ————————————————————————————————————————————————————————————

describe("il registro delle prove", () => {
  const nonConfermato = () =>
    contatto({ listIds: [], attributes: { [ATTRIBUTO_ATTIVITA]: "2026-10-01" } });

  it("prima di cancellare, scrive la prova", async () => {
    const b = brevoFinto([nonConfermato()]);
    const reg = registroFinto();
    await eseguiPulizia(dip(b.client, "2026-12-01", { registro: reg.registro }));

    expect(reg.eventi).toHaveLength(1);
    expect(reg.eventi[0]).toMatchObject({
      email: "mario@example.com",
      tipo: "richiesta",
      quando: "2026-10-01",
      versioneTesto: VERSIONE_TESTO_CONSENSI,
    });
    expect(b.chiamate.map((c) => c.metodo)).toEqual(["cancellaContatto"]);
  });

  /*
    L'ordine è la cosa. Invertirlo non produrrebbe nessun errore: produrrebbe,
    ogni tanto, una cancellazione senza prova — e di quelle ci si accorge solo
    il giorno in cui qualcuno chiede di dimostrare che aveva acconsentito.
  */
  it("se il registro non accetta, il contatto non si tocca", async () => {
    const b = brevoFinto([nonConfermato()]);
    const r = await eseguiPulizia(
      dip(b.client, "2026-12-01", { registro: registroFinto(true).registro }),
    );
    expect(b.chiamate).toHaveLength(0);
    expect(r.cancellati).toBe(0);
    expect(r.errori[0].azione).toBe("registro");
  });

  it("nella prova non entra nessun dato del calcolo", async () => {
    const reg = registroFinto();
    const b = brevoFinto([
      contatto({
        listIds: [],
        attributes: {
          REGIME: "forfettario",
          ACCANTONAMENTO_MESE: 966.15,
          SCAD_1_DATA: "2026-11-30",
          SCAD_1_IMPORTO: 5_329.48,
          [ATTRIBUTO_ATTIVITA]: "2026-10-01",
        },
      }),
    ]);
    await eseguiPulizia(dip(b.client, "2026-12-01", { registro: reg.registro }));
    const scritto = JSON.stringify(reg.eventi[0]);
    for (const vietato of ["forfettario", "966.15", "5329.48", "SCAD_1", "ACCANTONAMENTO"]) {
      expect(scritto, `«${vietato}» non deve finire nel registro delle prove`).not.toContain(vietato);
    }
  });

  it("uscire da una lista non è una revoca, e non si registra", async () => {
    const reg = registroFinto();
    const b = brevoFinto([contatto({ listIds: [PROMEMORIA, MARKETING] })]);
    await eseguiPulizia(dip(b.client, "2027-07-30", { registro: reg.registro }));
    expect(b.listeToccate()).toEqual([PROMEMORIA]);
    expect(reg.eventi).toHaveLength(0);
  });

  it("in prova soltanto non si scrive niente, nemmeno nel registro", async () => {
    const reg = registroFinto();
    const b = brevoFinto([nonConfermato()]);
    await eseguiPulizia(
      dip(b.client, "2026-12-01", { registro: reg.registro, provaSoltanto: true }),
    );
    expect(reg.eventi).toHaveLength(0);
    expect(b.chiamate).toHaveLength(0);
  });
});

/*
  ─────────────────────────────────────────────────────────────────────────
  Il rifiuto di partire
  ─────────────────────────────────────────────────────────────────────────

  Finché il legale non dice per quanto si conservano le prove, la pulizia non
  gira. Non «gira saltando il registro», che sarebbe il modo silenzioso di
  fare esattamente il danno che il registro evita.
*/
describe("senza il termine di conservazione confermato, non parte", () => {
  for (const valore of ["DA CONFERMARE DAL LEGALE", "", 0, -1, Number.NaN, null, undefined]) {
    it(`con ${JSON.stringify(valore)} si rifiuta e non tocca niente`, async () => {
      const b = brevoFinto([contatto({ listIds: [] }), contatto()]);
      const reg = registroFinto();
      const r = await eseguiPulizia(
        dip(b.client, "2027-07-30", {
          registro: reg.registro,
          conservazioneProveMesi: valore as number | string,
        }),
      );
      expect(r.rifiutata).toContain("non confermato");
      expect(r.esaminati).toBe(0);
      expect(b.chiamate).toHaveLength(0);
      expect(reg.eventi).toHaveLength(0);
    });
  }

  it("con un numero di mesi vero, parte", async () => {
    const b = brevoFinto([contatto()]);
    const r = await eseguiPulizia(dip(b.client, "2027-07-30", { conservazioneProveMesi: 24 }));
    expect(r.rifiutata).toBeNull();
    expect(r.esaminati).toBe(1);
  });

  /*
    E oggi il termine **non** è confermato: la costante vale ancora la
    stringa. Questo test è il promemoria che accendere la pulizia richiede
    prima una risposta del legale, e cadrà da solo il giorno in cui arriva.
  */
  it("oggi il termine non è confermato, e la costante lo dice", () => {
    expect(conservazioneConfermata()).toBe(false);
    expect(CONSERVAZIONE_PROVE_MESI).toBe("DA CONFERMARE DAL LEGALE");
  });
});

describe("le funzioni di lettura", () => {
  it("ultimaAttivita preferisce l'attributo a createdAt", () => {
    expect(ultimaAttivita(contatto())).toBe("2026-10-01");
    expect(
      ultimaAttivita(contatto({ attributes: {}, createdAt: "2025-03-04T10:00:00.000Z" })),
    ).toBe("2025-03-04");
  });

  it("i termini sono quelli decisi dal legale", () => {
    expect(TERMINI).toEqual({
      nonConfermate: 30,
      datiDelCalcolo: 30,
      promemoriaInattivo: 12,
      marketing: 24,
    });
  });

  it("e le date si possono raccontare senza rifare il conto", () => {
    expect(piuGiorni("2027-06-30", TERMINI.datiDelCalcolo)).toBe("2027-07-30");
    expect(piuMesi("2026-10-01", TERMINI.marketing)).toBe("2028-10-01");
  });
});
