import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONSEGNA_CHIAVE,
  CONSEGNA_CHIAVE_BREVE,
  PREZZO,
  PREZZO_SCRITTO,
  PRIMA_DI_PAGARE,
  accettazioneTermini,
  collegamentoDiPagamento,
} from "./acquisto";
import { euro, euroTondo, percentuale } from "@/lib/format";

/**
 * Il prezzo si scrive in un modo solo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il difetto che questa tagliola esiste per rendere impossibile
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il pulsante della testata diceva «97,00 € + IVA»; due schermate più giù, la
 * sezione del prezzo diceva «97 € all'anno». Stesso numero, due formati, due
 * chiamate diverse a due formatter diversi.
 *
 * Il controllo che c'era confrontava i **valori** — 97 di qua, 97 di là — e
 * passava, perché di valori sbagliati non ce n'erano. È la stessa forma di
 * sempre, spostata di un passo: non due numeri che divergono, ma due modi di
 * scrivere lo stesso numero. Da fuori si legge come un rincaro o come un
 * refuso, e in una pagina che chiede dei soldi non è un dettaglio.
 *
 * La risposta è quella di sempre: **una strada sola**. `PREZZO_SCRITTO` decide
 * una volta come si scrive ciascuna voce, e le pagine non scelgono più. Questi
 * test sorvegliano che nessuno riapra la seconda strada.
 */

const PAGINE = [
  "src/app/(sito)/page.tsx",
  "src/app/(sito)/acquista/schermata-acquisto.tsx",
];

/** Il sorgente senza commenti: lì i numeri si citano per raccontare, e va bene. */
function codiceDi(percorso: string): string {
  return readFileSync(percorso, "utf8")
    .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("il prezzo scritto", () => {
  it("è il prezzo, formattato come si mostra", () => {
    expect(PREZZO_SCRITTO.imponibile).toBe(euroTondo(PREZZO.imponibile));
    expect(PREZZO_SCRITTO.totale).toBe(euro(PREZZO.totale));
    expect(PREZZO_SCRITTO.aliquota).toBe(percentuale(PREZZO.aliquotaIva, 0));
  });

  it("l'imponibile non porta centesimi, il totale sì", () => {
    // Le due forme sono diverse per scelta, e la scelta è qui dentro: se un
    // giorno cambia, cambia in un posto e in tutte le pagine insieme.
    expect(PREZZO_SCRITTO.imponibile).not.toMatch(/,/);
    expect(PREZZO_SCRITTO.totale).toMatch(/,\d{2}\s*€$/);
  });

  it("nessuna pagina formatta il prezzo per conto suo", () => {
    const colpevoli: string[] = [];
    for (const percorso of PAGINE) {
      const codice = codiceDi(percorso);
      /*
        Qualunque formatter applicato a un campo di `PREZZO` è una seconda
        strada: `euro(PREZZO.totale)`, `euroTondo(PREZZO.imponibile)`,
        `percentuale(PREZZO.aliquotaIva, 0)`. Il prezzo si prende già scritto.
      */
      const seconde = codice.match(/\b(euro|euroTondo|percentuale|interoIt\.format)\s*\(\s*PREZZO\./g);
      if (seconde) colpevoli.push(`${percorso}: ${seconde.join(", ")}`);
    }
    expect(
      colpevoli,
      `Il prezzo viene formattato fuori da PREZZO_SCRITTO:\n${colpevoli.join("\n")}\n\n`
        + "È così che la testata ha finito per dire «97,00 € + IVA» mentre la sezione del\n"
        + "prezzo diceva «97 €»: stesso numero, due strade, due formati.",
    ).toEqual([]);
  });

  it("le cifre del prezzo non sono scritte a mano in nessuna pagina", () => {
    const acaso = [
      String(PREZZO.imponibile),
      PREZZO_SCRITTO.totale.replace(/\s*€$/, ""),
      String(PREZZO.aliquotaIva * 100),
    ];
    const colpevoli: string[] = [];
    for (const percorso of PAGINE) {
      const codice = codiceDi(percorso);
      // Fuori da un identificatore e fuori da un numero più lungo: `1140` non
      // è il prezzo, e nemmeno `97` dentro `1970`.
      for (const cifra of acaso) {
        const dentro = new RegExp(`(^|[^\\w.,])${cifra.replace(".", "[.,]")}(?![\\w.,])`);
        if (dentro.test(codice)) colpevoli.push(`${percorso}: «${cifra}»`);
      }
    }
    expect(
      colpevoli,
      `Cifre del prezzo scritte a mano:\n${colpevoli.join("\n")}\n\n`
        + "Il prezzo cambia una volta sola, in src/lib/sito/acquisto.ts.",
    ).toEqual([]);
  });
});

/*
  ─────────────────────────────────────────────────────────────────────────
  Quello che la pagina promette prima del pulsante, e quello che il contratto
  dice dopo
  ─────────────────────────────────────────────────────────────────────────

  `PRIMA_DI_PAGARE` è l'unica frase del sito che una persona legge **con la
  carta in mano**, e dice tre cose che stanno in due clausole: il contratto si
  conclude con il pagamento (punto 3), quando arriva la chiave (punto 3), il
  rimborso è integrale entro 30 giorni (punto 7).

  Il modo in cui questa frase si rompe non è una riscrittura: è una clausola
  che cambia e una frase che resta. È appena successo — il legale ha
  sostituito «24 ore lavorative» con la fine del primo giorno lavorativo
  successivo — e senza questi controlli la pagina avrebbe continuato a
  promettere un termine che il contratto non dà più.

  Per il termine di consegna non si confronta più un **numero**: si pretende
  che la frase della pagina sia, parola per parola, dentro il contratto. Un
  numero si poteva confrontare finché il termine era un numero; adesso che è
  una formula, cercarci dentro delle cifre vorrebbe dire inventare una regex
  su una clausola in prosa — e la prima riscrittura del legale la manderebbe a
  vuoto in silenzio.
*/
describe("la frase prima del pulsante e il contratto", () => {
  const contratto = readFileSync("contenuti/termini.md", "utf8");
  const nudo = (t: string) => t.replace(/[\s ]+/g, " ");

  it("dice le tre cose, e nessuna in più", () => {
    expect(PRIMA_DI_PAGARE).toBe(
      "Paghi, il contratto è concluso e ricevi la chiave per email entro la fine del primo "
        + "giorno lavorativo successivo. Rimborso integrale entro 30 giorni.",
    );
  });

  it("il termine di consegna è, parola per parola, quello del punto 3", () => {
    const punto3 = nudo(contratto.split(/^##\s+3\./m)[1]?.split(/^##\s/m)[0] ?? "");
    expect(
      punto3,
      `Nel punto 3 non c'è più la frase «${CONSEGNA_CHIAVE}».\n`
        + "La pagina la mostra comunque: è una promessa che nessuna clausola sostiene.",
    ).toContain(CONSEGNA_CHIAVE);
  });

  /*
    E la forma breve è un **prefisso** di quella intera. È la proprietà che
    tiene insieme le due: accorciare la coda è permesso — sul pulsante «alla
    conferma del pagamento» ripete quello che «paghi» ha appena detto — ma
    cambiare le parole no. «Entro un giorno lavorativo» romperebbe il
    prefisso, e qui cadrebbe.
  */
  it("e la forma breve della pagina è un prefisso di quella del contratto", () => {
    expect(CONSEGNA_CHIAVE.startsWith(CONSEGNA_CHIAVE_BREVE)).toBe(true);
    expect(PRIMA_DI_PAGARE).toContain(CONSEGNA_CHIAVE_BREVE);
  });

  /*
    ─────────────────────────────────────────────────────────────────────────
    E nessuna pagina riscrive quel termine a mano
    ─────────────────────────────────────────────────────────────────────────

    Il controllo qui sopra tiene insieme `acquisto.ts` e il contratto. Non
    diceva niente, però, delle **altre** superfici che lo ripetono: la FAQ del
    simulatore e la descrizione di `/grazie/` lo avevano scritto a mano, e il
    commento accanto diceva che «quando è cambiato sono cambiati tutti e cinque
    insieme». Era vero, ed era una cosa andata bene — non un presidio. La copia
    giusta oggi è la copia vecchia alla prossima riscrittura.

    Qui si scandiscono i sorgenti del sito e si pretende che la frase non
    compaia **scritta**: dove serve, si importa la costante. L'unico file che
    può contenerla è quello che la definisce.

    Il testo delle scadenze fiscali dice «spostate al primo giorno lavorativo
    successivo» e non è questo termine: per quello si cerca la frase intera,
    «entro la fine del…», e non tre parole che vogliono dire un'altra cosa.
  */
  it("e nessun'altra pagina la scrive a mano", () => {
    const radice = "src";
    const esclusi = ["src/lib/sito/acquisto.ts"];
    const colpevoli: string[] = [];
    const visita = (cartella: string) => {
      for (const voce of readdirSync(cartella, { withFileTypes: true })) {
        const percorso = `${cartella}/${voce.name}`;
        if (voce.isDirectory()) {
          visita(percorso);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(voce.name) || voce.name.endsWith(".test.ts")) continue;
        if (esclusi.includes(percorso)) continue;
        if (codiceDi(percorso).includes(CONSEGNA_CHIAVE_BREVE)) colpevoli.push(percorso);
      }
    };
    visita(radice);
    expect(
      colpevoli,
      `Il termine di consegna è scritto a mano in:\n${colpevoli.join("\n")}\n\n`
        + "Importa CONSEGNA_CHIAVE_BREVE da @/lib/sito/acquisto: è la stessa frase, e\n"
        + "un test la tiene dentro il punto 3 del contratto. Una copia resta indietro\n"
        + "senza dirlo il giorno in cui il legale riscrive quella clausola.",
    ).toEqual([]);
  });

  it("i 30 giorni del rimborso sono quelli del punto 7", () => {
    const punto7 = nudo(contratto.split(/^##\s+7\./m)[1]?.split(/^##\s/m)[0] ?? "");
    const nelContratto = punto7.match(/rimborso entro (\d+) giorni/i)?.[1];
    const inPagina = PRIMA_DI_PAGARE.match(/entro (\d+) giorni/)?.[1];
    expect(nelContratto, "il punto 7 non parla più di un rimborso a giorni").toBeDefined();
    expect(inPagina).toBe(nelContratto);
  });

  /*
    E il contratto si conclude dove la pagina dice che si conclude. È la cosa
    che è appena cambiata — prima si concludeva alla consegna della chiave — e
    il verso in cui si rompe è silenzioso: una pagina che dicesse «paghi e il
    contratto è concluso» sopra un contratto che lo fa concludere dopo
    descriverebbe un acquisto che non esiste.
  */
  it("e il contratto si conclude con il pagamento, come la pagina dice", () => {
    const punto3 = nudo(contratto.split(/^##\s+3\./m)[1]?.split(/^##\s/m)[0] ?? "");
    expect(punto3).toContain("Il contratto si conclude con il pagamento");
    expect(PRIMA_DI_PAGARE).toContain("il contratto è concluso");
  });

  /*
    Le due caselle sono **due condizioni**, e il pulsante le guarda tutte e
    due. Il modo in cui questo si rompe è un `href` rimasto attaccato a una
    sola: la pagina mostra due caselle, una sola conta, e nessuno se ne accorge
    finché non lo prova qualcuno che ne spunta una.
  */
  it("il pagamento richiede tutte e due le caselle", () => {
    const codice = codiceDi("src/app/(sito)/acquista/schermata-acquisto.tsx");
    expect(codice).toContain("const puoPagare = accetta && dichiara;");
    expect(codice).toContain("disabled={!puoPagare || inCorso}");
    expect(
      codice,
      "il pulsante guarda ancora una casella sola",
    ).not.toContain("disabled={!dichiara");
  });

  /*
    E il pagamento non è più un collegamento: è un pulsante che **prima**
    registra l'accettazione e solo dopo cambia pagina. Un `<a href>` sarebbe
    tornato a portare via la pagina al primo clic, e la prova si sarebbe
    scritta — quando si scriveva — mentre il browser stava già andando via.
  */
  it("e prima di aprire Stripe passa dalla registrazione dell'accettazione", () => {
    const codice = codiceDi("src/app/(sito)/acquista/schermata-acquisto.tsx");
    expect(codice).toContain("API.accettazione");
    expect(codice).toContain("collegamentoDiPagamento(id)");
    expect(
      codice,
      "il pulsante porta a Stripe senza passare dalla funzione: la prova non verrebbe scritta",
    ).not.toMatch(/href=\{[^}]*PAYMENT_LINK/);
  });

  describe("il collegamento al pagamento", () => {
    const LINK = "https://buy.stripe.com/test_123";

    it("attacca l'identificativo come client_reference_id", () => {
      expect(collegamentoDiPagamento("abc123", LINK)).toBe(
        `${LINK}?client_reference_id=abc123`,
      );
    });

    it("e se il link ha già una query usa &", () => {
      expect(collegamentoDiPagamento("abc", `${LINK}?locale=it`)).toBe(
        `${LINK}?locale=it&client_reference_id=abc`,
      );
    });

    it("quello che ci finisce dentro è codificato", () => {
      expect(collegamentoDiPagamento("a b/c", LINK)).toBe(`${LINK}?client_reference_id=a%20b%2Fc`);
    });
  });

  it("e l'accettazione nomina la versione dei Termini", () => {
    expect(accettazioneTermini(3)).toContain("versione 3");
    expect(accettazioneTermini(4)).toContain("versione 4");
  });
});
