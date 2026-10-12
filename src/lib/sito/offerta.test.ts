import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONDIZIONI_ESSENZIALI,
  DA_RIEMPIRE,
  OFFERTA,
  PUNTO_PREZZO_GARANTITO,
  RIMANDO_AI_TERMINI,
  TESTO_DEL_RIMANDO,
  condizioniSpezzate,
} from "./offerta";
import { PREZZO, PREZZO_SCRITTO } from "./acquisto";
import { ancoraDelPunto } from "@/lib/contenuti/ancore";
import { leggiPagina } from "@/lib/contenuti/pagine";
import { SITO } from "@/lib/rotte";

/**
 * La card dell'offerta, verificata contro il contratto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché questo gruppo di test esiste
 * ─────────────────────────────────────────────────────────────────────────
 *
 * «97 € + IVA l'anno anche a ogni rinnovo» è una promessa che vale soldi, e
 * vale soldi **perché** il punto 6-bis dei Termini la rende esigibile. Le due
 * metà stanno in due file che non si parlano: una pagina di marketing e un
 * contratto, scritti da due persone diverse in due momenti diversi.
 *
 * Il modo in cui questa cosa si rompe non è un errore di compilazione. È il
 * legale che riscrive la clausola e porta i Fondatori da 50 a 30; è il prezzo
 * di listino che sale a 129 € e la card che resta a 97; è il termine di
 * rinnovo che diventa 15 giorni. Ognuna di queste tre modifiche compila,
 * passa i test, e pubblica una pagina che promette una cosa diversa da quella
 * che il contratto obbliga. In un verso è pubblicità ingannevole, nell'altro è
 * un regalo a chiunque se ne accorga.
 *
 * Qui si misurano i tre numeri sul **testo del contratto**. Non c'è modo di
 * leggere la clausola e ricavarne i valori senza una regex su della prosa — e
 * una regex su un contratto è un difetto che aspetta il giorno in cui il
 * legale riscrive la riga. Ma la regex che *non trova* fa fallire il test, non
 * passare: è la direzione giusta in cui sbagliare.
 *
 * L'altra metà del lavoro — che nessuna pagina **costruita** dica «per sempre»
 * e che i numeri a schermo siano questi — la fa `strumenti/verifica-offerta.mjs`
 * su `out/`, perché una stringa composta a runtime da qui non si vede.
 */

const TERMINI = readFileSync("contenuti/termini.md", "utf8");

/** Il testo della clausola 6-bis, dal titolo al titolo successivo. */
const SEIBIS = (() => {
  const dal = TERMINI.indexOf(`## ${PUNTO_PREZZO_GARANTITO}.`);
  if (dal < 0) return null;
  const al = TERMINI.indexOf("\n## ", dal + 1);
  return TERMINI.slice(dal, al < 0 ? undefined : al);
})();

/**
 * Le due parole proibite, con i confini.
 *
 * Senza `\b` la seconda prende anche «la vita», che in APPROSSIMAZIONI.md c'è
 * davvero — «che era la vita di quell'archivio» — e il controllo fallirebbe su
 * una frase che non promette niente a nessuno.
 */
const PROIBITE = [/\bper sempre\b/i, /\ba vita\b/i];

describe("la card del prezzo fondatori", () => {
  it("non è più una bozza", () => {
    expect(DA_RIEMPIRE).toBe(false);
    const tutti = [OFFERTA.nome, OFFERTA.sottotitolo, OFFERTA.garanzia, ...OFFERTA.include];
    for (const testo of tutti) {
      expect(testo, `«${testo}» è ancora un segnaposto`).not.toMatch(/\[|\]/);
    }
  });

  it("compone prezzo e posti invece di riscriverli", () => {
    expect(OFFERTA.sottotitolo).toContain(PREZZO_SCRITTO.imponibile);
    expect(OFFERTA.sottotitolo).toContain(String(OFFERTA.posti));
  });

  /*
    La promessa e la clausola, nei due versi. Se la card dice «anche a ogni
    rinnovo» il contratto deve contenere il 6-bis; e se un giorno la card
    smette di dirlo, questo test non chiede più niente — non è un test sulla
    presenza della clausola, è un test sul fatto che la promessa sia coperta.
  */
  it("promette il prezzo sui rinnovi solo se i Termini lo garantiscono", () => {
    const promette = /rinnov/i.test(OFFERTA.sottotitolo) || /rinnov/i.test(CONDIZIONI_ESSENZIALI);
    if (!promette) return;
    expect(
      SEIBIS,
      `La pagina promette il prezzo sui rinnovi, ma contenuti/termini.md non ha il punto ${PUNTO_PREZZO_GARANTITO}.\n`
        + "È una promessa senza clausola che la renda esigibile.",
    ).not.toBeNull();
    expect(SEIBIS).toContain("per ogni rinnovo successivo");
  });

  describe("i tre numeri coincidono col punto 6-bis", () => {
    it("i posti sono i Fondatori della clausola", () => {
      const nel6bis = SEIBIS?.match(/primi\s+(\d+)\s+acquirenti/)?.[1];
      expect(nel6bis, "nel 6-bis non trovo «primi N acquirenti»").toBeDefined();
      expect(
        Number(nel6bis),
        `La card offre ${OFFERTA.posti} posti, la clausola ne garantisce ${nel6bis}.`,
      ).toBe(OFFERTA.posti);
    });

    it("il prezzo garantito è quello che la pagina mostra", () => {
      const nel6bis = SEIBIS?.match(/il prezzo di\s+([\d.,]+)\s*€\s*oltre IVA/)?.[1];
      expect(nel6bis, "nel 6-bis non trovo «il prezzo di N € oltre IVA»").toBeDefined();
      expect(
        Number(nel6bis?.replace(",", ".")),
        `La pagina vende a ${PREZZO.imponibile} €, la clausola garantisce ${nel6bis} €.`,
      ).toBe(PREZZO.imponibile);
    });

    it("i giorni per rinnovare sono quelli del comma 3", () => {
      const nel6bis = SEIBIS?.match(/entro\s+(\d+)\s+giorni dalla stessa/)?.[1];
      const nellaCard = CONDIZIONI_ESSENZIALI.match(/entro\s+(\d+)\s+giorni/)?.[1];
      expect(nel6bis, "nel 6-bis non trovo il termine del comma 3").toBeDefined();
      expect(nellaCard, "le condizioni della card non nominano nessun termine").toBeDefined();
      expect(
        nellaCard,
        `La card dice ${nellaCard} giorni, il comma 3 ne dà ${nel6bis}.`,
      ).toBe(nel6bis);
    });
  });

  it("non dice «per sempre» né «a vita», da nessuna parte", () => {
    const tutto = [
      OFFERTA.nome,
      OFFERTA.sottotitolo,
      OFFERTA.garanzia,
      CONDIZIONI_ESSENZIALI,
      ...OFFERTA.include,
    ].join(" · ");
    for (const proibita of PROIBITE) {
      expect(
        tutto,
        `L'offerta usa ${proibita}. La garanzia dura finché il Fornitore rende\n`
          + "disponibile il rinnovo della licenza ai clienti esistenti (comma 3), e un\n"
          + "rinnovo fuori termine si paga a listino (comma 4): «per sempre» promette una\n"
          + "cosa che il contratto non dà.",
      ).not.toMatch(proibita);
    }
  });

  describe("il rimando al punto", () => {
    it("ricompone esattamente la frase approvata", () => {
      const { prima, rimando, dopo } = condizioniSpezzate();
      expect(prima + rimando + dopo).toBe(
        "Il prezzo resta valido a ogni rinnovo fatto entro 30 giorni dalla scadenza. "
          + "È personale e non cedibile. Condizioni al punto 6-bis dei Termini.",
      );
      expect(rimando).toBe(TESTO_DEL_RIMANDO);
    });

    /*
      Il taglio si fa con `indexOf`, e un `indexOf` che non trova niente
      restituisce −1: senza il controllo, `slice(-1)` darebbe due pezzi
      plausibili e il collegamento sparirebbe senza un errore. Qui si verifica
      che quel caso si fermi invece di comporsi.
    */
    it("si ferma se la frase non nomina più il punto", () => {
      expect(CONDIZIONI_ESSENZIALI).toContain(TESTO_DEL_RIMANDO);
    });

    it("porta all'ancora che la pagina dei Termini mette davvero", () => {
      const ancora = ancoraDelPunto(PUNTO_PREZZO_GARANTITO);
      expect(RIMANDO_AI_TERMINI).toBe(`${SITO.termini}/#${ancora}`);
      expect(
        leggiPagina(SITO.termini).html,
        `La card rimanda a #${ancora}, che nella pagina dei Termini non esiste:\n`
          + "il collegamento non è rotto — la pagina si apre — e porta in testa\n"
          + "al documento, lasciando a chi legge quattordici clausole da scorrere.",
      ).toContain(`id="${ancora}"`);
    });
  });
});
