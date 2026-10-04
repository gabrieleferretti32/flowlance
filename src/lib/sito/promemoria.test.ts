import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ATTESA_MINIMA_MS,
  ATTRIBUTI,
  TETTO_IMPORTI,
  TETTO_RICAVI,
  convalidaPromemoria,
  origineAmmessa,
} from "./promemoria";
import { RICAVI_MASSIMI } from "./simulatore";

const OGGI = "2026-10-01";

function richiesta(parziale: Record<string, unknown> = {}) {
  return {
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
    ...parziale,
  };
}

/*
  La tagliola che tiene allineati i due tetti.

  `TETTO_RICAVI` non importa `RICAVI_MASSIMI` di proposito — la funzione
  serverless non deve tirarsi dentro il motore fiscale — e due costanti scritte
  in due file divergono. Il giorno in cui una cambia, questo test lo dice: senza
  di lui il server scarterebbe in silenzio una richiesta che la pagina
  considera legittima, e chi si iscrive vedrebbe un errore senza ragione.
*/
describe("i due tetti restano lo stesso numero", () => {
  it("TETTO_RICAVI è RICAVI_MASSIMI", () => {
    expect(TETTO_RICAVI).toBe(RICAVI_MASSIMI);
  });
});

describe("convalidaPromemoria", () => {
  it("accetta una richiesta della pagina e restituisce i sei attributi", () => {
    const e = convalidaPromemoria(richiesta(), OGGI);
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    expect(e.email).toBe("mario@example.com");
    expect(Object.keys(e.attributi).sort()).toEqual([...ATTRIBUTI].sort());
  });

  it("normalizza l'indirizzo: spazi via, minuscole", () => {
    const e = convalidaPromemoria(richiesta({ email: "  Mario@Example.COM " }), OGGI);
    expect(e.ok && e.email).toBe("mario@example.com");
  });

  /*
    Il presidio che conta davvero: quello che non è nell'elenco non passa.
    Non si verifica che la chiave venga rifiutata — si verifica che **non
    esista** nell'oggetto che parte, perché la convalida ricostruisce invece
    di filtrare.
  */
  it("una chiave estranea non arriva a Brevo", () => {
    const e = convalidaPromemoria(
      richiesta({
        attributi: { ...richiesta().attributi, GRUPPO_ATECO: "professionali", NOTE: "x" },
      }),
      OGGI,
    );
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    expect(e.attributi.GRUPPO_ATECO).toBeUndefined();
    expect(e.attributi.NOTE).toBeUndefined();
    expect(Object.keys(e.attributi)).toHaveLength(6);
  });

  /*
    La tagliola della minimizzazione.

    `FATTURATO_STIMATO` non entrava in nessuna email: era il dato di partenza,
    mandato perché era lì. Il verso che conta è questo — non che il campo sia
    stato tolto dall'elenco, ma che **non arrivi a Brevo nemmeno se la pagina
    lo rimettesse nel corpo**. La convalida ricostruisce invece di filtrare, e
    questo test è la prova che la ricostruzione tiene anche contro un
    mittente che insiste.
  */
  it("il fatturato non passa nemmeno se qualcuno lo rimette nel corpo", () => {
    const e = convalidaPromemoria(
      richiesta({ attributi: { ...richiesta().attributi, FATTURATO_STIMATO: 40_000 } }),
      OGGI,
    );
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    expect(e.attributi.FATTURATO_STIMATO).toBeUndefined();
    expect(ATTRIBUTI).not.toContain("FATTURATO_STIMATO");
  });

  it("niente gestione e niente gruppo ATECO fra gli attributi ammessi", () => {
    // Insieme agli importi sarebbero il profilo economico di una persona.
    expect(ATTRIBUTI).not.toContain("GESTIONE");
    expect(ATTRIBUTI).not.toContain("GRUPPO_ATECO");
  });

  /*
    Quello che resta **è comunque** un dato economico, e il test lo dice a
    chi legge il file. Non è una verifica di comportamento: è il promemoria,
    accanto al codice, che la minimizzazione ha ridotto la superficie e non
    cambiato la natura del trattamento. Da un acconto di 5.329,48 € in
    forfettario si risale a circa 40.000 € di fatturato.
  */
  it("ma quello che resta permette comunque di risalire al reddito", () => {
    const e = convalidaPromemoria(richiesta(), OGGI);
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    const mensile = Number(e.attributi.ACCANTONAMENTO_MESE);
    // 966,15 × 12 ÷ 0,29 di pressione ≈ 40.000.
    expect((mensile * 12) / 0.29).toBeGreaterThan(35_000);
    expect((mensile * 12) / 0.29).toBeLessThan(45_000);
  });

  for (const sbagliata of ["", "mario", "mario@", "@example.com", "mario@example", "ma rio@e.com"]) {
    it(`scarta «${sbagliata}» come indirizzo`, () => {
      expect(convalidaPromemoria(richiesta({ email: sbagliata }), OGGI).ok).toBe(false);
    });
  }

  it("accetta gli indirizzi legittimi che una regex severa rifiuterebbe", () => {
    for (const buona of ["mario+tasse@example.com", "d'angelo@example.co.uk", "a_b-c@sub.example.it"]) {
      expect(convalidaPromemoria(richiesta({ email: buona }), OGGI).ok).toBe(true);
    }
  });

  it("la trappola temporale scarta l'invio istantaneo", () => {
    expect(convalidaPromemoria(richiesta({ compilatoIn: 0 }), OGGI).ok).toBe(false);
    expect(convalidaPromemoria(richiesta({ compilatoIn: ATTESA_MINIMA_MS - 1 }), OGGI).ok).toBe(false);
    expect(convalidaPromemoria(richiesta({ compilatoIn: ATTESA_MINIMA_MS }), OGGI).ok).toBe(true);
  });

  it("e scarta anche chi non lo manda affatto", () => {
    const senza = richiesta();
    delete (senza as { compilatoIn?: number }).compilatoIn;
    expect(convalidaPromemoria(senza, OGGI).ok).toBe(false);
  });

  it("il regime sta in un elenco di due", () => {
    expect(convalidaPromemoria(richiesta({ attributi: { ...richiesta().attributi, REGIME: "minimi" } }), OGGI).ok).toBe(false);
  });

  it("l'accantonamento non supera il tetto, e non è negativo", () => {
    const a = richiesta().attributi;
    expect(convalidaPromemoria(richiesta({ attributi: { ...a, ACCANTONAMENTO_MESE: TETTO_IMPORTI } }), OGGI).ok).toBe(true);
    expect(convalidaPromemoria(richiesta({ attributi: { ...a, ACCANTONAMENTO_MESE: TETTO_IMPORTI + 1 } }), OGGI).ok).toBe(false);
    expect(convalidaPromemoria(richiesta({ attributi: { ...a, ACCANTONAMENTO_MESE: -1 } }), OGGI).ok).toBe(false);
  });

  it("gli importi delle scadenze hanno il loro tetto, più alto", () => {
    const a = richiesta().attributi;
    expect(convalidaPromemoria(richiesta({ attributi: { ...a, SCAD_1_IMPORTO: TETTO_IMPORTI } }), OGGI).ok).toBe(true);
    expect(convalidaPromemoria(richiesta({ attributi: { ...a, SCAD_1_IMPORTO: TETTO_IMPORTI + 1 } }), OGGI).ok).toBe(false);
  });

  it("una data fuori dalla finestra plausibile non viene da questa pagina", () => {
    const a = richiesta().attributi;
    for (const data of ["2019-06-30", "2031-06-30", "30/06/2027", "2027-13-01", "2027-06-32", ""]) {
      expect(convalidaPromemoria(richiesta({ attributi: { ...a, SCAD_1_DATA: data } }), OGGI).ok).toBe(false);
    }
  });

  it("la seconda scadenza può mancare: nel primo anno ce n'è una sola", () => {
    const a = { ...richiesta().attributi } as Record<string, unknown>;
    delete a.SCAD_2_DATA;
    delete a.SCAD_2_IMPORTO;
    const e = convalidaPromemoria(richiesta({ attributi: a }), OGGI);
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    expect(Object.keys(e.attributi)).toHaveLength(4);
    expect(e.attributi.SCAD_2_DATA).toBeUndefined();
  });

  it("ma non può mancare a metà: data senza importo è un'email rotta", () => {
    const a = { ...richiesta().attributi } as Record<string, unknown>;
    delete a.SCAD_2_IMPORTO;
    expect(convalidaPromemoria(richiesta({ attributi: a }), OGGI).ok).toBe(false);
  });

  it("la seconda scadenza viene dopo la prima", () => {
    const a = richiesta().attributi;
    expect(
      convalidaPromemoria(
        richiesta({ attributi: { ...a, SCAD_2_DATA: "2026-06-30", SCAD_2_IMPORTO: 100 } }),
        OGGI,
      ).ok,
    ).toBe(false);
  });

  it("e non è a zero: zero non è un appuntamento", () => {
    const a = richiesta().attributi;
    expect(convalidaPromemoria(richiesta({ attributi: { ...a, SCAD_2_IMPORTO: 0 } }), OGGI).ok).toBe(false);
  });

  it("il secondo consenso viaggia, e di norma è spento", () => {
    const spento = convalidaPromemoria(richiesta(), OGGI);
    expect(spento.ok && spento.marketing).toBe(false);
    const acceso = convalidaPromemoria(richiesta({ marketing: true }), OGGI);
    expect(acceso.ok && acceso.marketing).toBe(true);
  });

  /*
    Solo `true` vale sì. È il verso in cui si può sbagliare senza fare danno:
    il peggio è non mandare un'email che sarebbe stata gradita, invece di
    mandarla a chi non l'ha chiesta. Un `"true"` di stringa, un `1`, un
    oggetto — tutto quello che non è il booleano — vale no.
  */
  for (const finto of ["true", 1, "si", {}, [], "on"]) {
    it(`«${JSON.stringify(finto)}» non è un consenso`, () => {
      const e = convalidaPromemoria(richiesta({ marketing: finto }), OGGI);
      expect(e.ok && e.marketing).toBe(false);
    });
  }

  it("senza il campo, il secondo consenso è no", () => {
    const senza = richiesta();
    delete (senza as { marketing?: boolean }).marketing;
    const e = convalidaPromemoria(senza, OGGI);
    expect(e.ok).toBe(true);
    expect(e.ok && e.marketing).toBe(false);
  });

  /*
    E il secondo consenso non è una condizione per il primo: una richiesta
    senza marketing resta valida. Se un giorno qualcuno lo rendesse
    obbligatorio nella convalida, il servizio chiesto smetterebbe di essere
    ottenibile da solo — che è la cosa per cui le caselle sono due.
  */
  it("rifiutare il marketing non impedisce l'iscrizione ai promemoria", () => {
    expect(convalidaPromemoria(richiesta({ marketing: false }), OGGI).ok).toBe(true);
  });

  it("un corpo che non è un oggetto non manda in pezzi niente", () => {
    for (const corpo of [null, undefined, 42, "ciao", [], true]) {
      expect(convalidaPromemoria(corpo, OGGI).ok).toBe(false);
    }
  });

  it("gli attributi mancanti del tutto non passano", () => {
    expect(convalidaPromemoria({ email: "mario@example.com", compilatoIn: 9_000 }, OGGI).ok).toBe(false);
  });

  it("il motivo tecnico non finisce nel messaggio per chi guarda", () => {
    const e = convalidaPromemoria(richiesta({ compilatoIn: 10 }), OGGI);
    expect(e.ok).toBe(false);
    if (e.ok) return;
    expect(e.motivo).toContain("veloce");
    expect(e.errore).not.toContain("veloce");
  });
});

/*
  Il copy della pagina e i dati che lo sostengono.

  «Un'email 7 giorni prima delle prossime due scadenze» è una promessa
  verificabile: le scadenze che partono verso Brevo sono esattamente due coppie
  — `SCAD_1_*` e `SCAD_2_*` — e non ce n'è una terza. Il giorno in cui qualcuno
  ne aggiungesse una, o ne togliesse una, la frase in pagina direbbe un numero
  e il sistema ne manderebbe un altro: una promessa che diventa falsa senza che
  nessuno tocchi il testo.

  Si legge il sorgente del componente perché è lì che la frase vive, e perché
  il verso che conta è proprio quello che un test sui tipi non vede: il
  **numero scritto a parole**.
*/
describe("la pagina promette quello che il contratto manda", () => {
  const sorgente = readFileSync(
    new URL("../../app/(sito)/simulatore/promemoria.tsx", import.meta.url),
    "utf8",
  );

  /*
    ─────────────────────────────────────────────────────────────────────
    Il testo senza i commenti, e perché è la differenza fra misurare e no
    ─────────────────────────────────────────────────────────────────────

    La prima stesura di questi test leggeva il sorgente intero. Sembrava
    ragionevole, e non misurava niente: i commenti di questo progetto
    **raccontano** quello che la pagina dice, e quindi contengono le stesse
    frasi. La regola «se la pagina dice che il fatturato non parte, deve dire
    anche che si può stimare» risultava sempre soddisfatta — perché «si
    risale a circa 40.000 €» stava nel commento sopra il paragrafo, non nel
    paragrafo.

    Se n'è accorta una prova di mutazione, non la lettura: accorciata la frase
    a schermo, il test della regola continuava a passare con la faccia di uno
    che ha controllato. È esattamente il difetto che questo progetto insegue —
    una misura che conferma invece di una che rompe — comparso dentro la misura
    stessa.

    E gli spazi si normalizzano, per la stessa ragione misurata due volte: nel
    sorgente una frase va a capo dove serve al JSX, non dove finisce la
    proposizione. Cercando «il fatturato che hai digitato non lo mandiamo» su
    un testo che contiene «il fatturato che hai\n    digitato non lo
    mandiamo» non si trova niente — e «non si trova» voleva dire «la pagina
    non lo dice», cioè la regola soddisfatta a vuoto. Anche questo l'ha trovato
    una mutazione: accorciata la frase, il test continuava a passare.

    Da qui in poi le asserzioni sul copy leggono `copy`, che è il sorgente
    senza commenti e con gli spazi appianati. Quelle sul **codice** continuano
    a leggere `sorgente`.
  */
  const copy = sorgente
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/\{\s*\}/g, " ")
    .replace(/\s+/g, " ");

  it("le scadenze che partono sono due coppie, non una né tre", () => {
    const date = ATTRIBUTI.filter((a) => /^SCAD_\d+_DATA$/.test(a));
    const importi = ATTRIBUTI.filter((a) => /^SCAD_\d+_IMPORTO$/.test(a));
    expect(date).toHaveLength(2);
    expect(importi).toHaveLength(2);
  });

  it("e la frase in pagina dice «due», non «ogni»", () => {
    expect(copy).toContain("prossime due scadenze");
    /*
      «Ogni scadenza» prometteva più di quello che parte: le scadenze dell'anno
      sono di più — l'IVA trimestrale, il bollo — e di quelle il promemoria non
      sa niente.
    */
    expect(copy).not.toContain("prima di ogni scadenza");
  });

  it("la disiscrizione nomina il collegamento, non un gesto", () => {
    expect(copy).toContain("dal collegamento in fondo a ogni email");
    expect(copy).not.toContain("con un clic da ogni email");
  });

  /*
    ─────────────────────────────────────────────────────────────────────
    La mezza verità che questa frase non deve poter diventare
    ─────────────────────────────────────────────────────────────────────

    Sotto il pulsante c'è scritto che il fatturato digitato non viene mandato.
    È vero, e da solo è la rassicurazione sbagliata: da un acconto di 5.329,48 €
    in forfettario si risale a circa 40.000 €, e `ACCANTONAMENTO_MESE × 12 ÷
    pressione` lo ricostruisce meglio ancora. Chi legge solo la prima metà
    capisce il contrario di quello che succede.

    Il modo in cui questa frase si romperebbe non è la cancellazione — quella
    si vede — è l'**accorciamento**: qualcuno taglia la subordinata per far
    stare la riga, e resta la parte che tranquillizza. Perciò il test non
    confronta la frase di oggi: dice la regola. Se da qualche parte il
    componente afferma che il fatturato non parte, **deve** anche dire che si
    può stimare.
  */
  describe("il fatturato non parte, e questo non basta dirlo", () => {
    /** I modi in cui si può scrivere «il fatturato non lo mandiamo». */
    const RASSICURAZIONE = [
      /il fatturato che hai digitato non lo mandiamo/i,
      /il fatturato[^.]{0,40}non parte/i,
      /il fatturato[^.]{0,40}non serve a mandarti/i,
      /il fatturato che hai digitato no:/i,
      /il fatturato[^.]{0,40}non esce/i,
    ];
    /** I modi in cui si può scrivere «ma lo si ricava lo stesso». */
    const STIMA = [/si può stimare/i, /si risale/i, /si ricava/i, /si pu[òo] ricavare/i];

    const rassicura = RASSICURAZIONE.some((r) => r.test(copy));
    const avverte = STIMA.some((r) => r.test(copy));

    it("la rassicurazione non viaggia mai da sola", () => {
      if (rassicura) {
        expect(
          avverte,
          "La pagina dice che il fatturato non parte senza dire che si può stimare "
            + "dagli importi. Le due metà vanno insieme: la prima da sola è una "
            + "mezza verità che tranquillizza nel verso sbagliato.",
        ).toBe(true);
      }
    });

    it("e oggi dice tutte e due le cose, con la conseguenza", () => {
      expect(copy).toContain("non lo mandiamo");
      expect(copy).toContain("da questi importi si può stimare");
      expect(copy).toContain("dati economici");
    });

    /*
      La stesura precedente si fermava alla prima metà. Resta nominata qui
      perché non ci si torni per sbaglio riscrivendo la riga «come era prima».
    */
    it("la vecchia stesura, che si fermava a metà, non torna", () => {
      expect(copy).not.toContain("non serve a mandarti niente");
    });
  });

  /*
    Le due caselle restano due, e la facoltativa resta facoltativa: il
    pulsante non deve guardarla. È la cosa che si romperebbe per prima se un
    giorno qualcuno «semplificasse» il modulo.
  */
  it("il pulsante guarda solo il consenso necessario", () => {
    expect(sorgente).toContain("consensoPromemoria && Boolean(prossimo)");
    expect(sorgente).not.toContain("consensoMarketing &&");
  });
});

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
