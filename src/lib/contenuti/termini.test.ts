import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { generaPdfTermini, indirizzoPdfTermini } from "./pdf-termini";
import { leggiPagina } from "./pagine";
import { SITO } from "@/lib/rotte";
import { PREZZO } from "@/lib/sito/acquisto";
import { round2 } from "@/lib/fisco/aritmetica";

/**
 * Il PDF dei Termini, verificato contro il file che l'ha generato.
 *
 * Non contro sé stesso, e non contando le pagine: **contro il Markdown**. Un
 * controllo che aprisse il PDF e verificasse che «esiste ed è più grande di
 * zero» avrebbe lasciato passare la prima stesura di questo modulo, che
 * scriveva un file di zero byte, e la seconda, che stampava «pagina 1 di 1» su
 * un documento di quattro. Tutte e due plausibili, tutte e due sbagliate.
 */

const SORGENTE = "contenuti/termini.md";
const markdown = readFileSync(SORGENTE, "utf8");

/** Il testo dentro il PDF, estratto dai flussi di contenuto. */
function testoDelPdf(byte: Buffer): string {
  const pezzi: string[] = [];
  const grezzo = byte.toString("latin1");
  for (const m of grezzo.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      pezzi.push(inflateSync(Buffer.from(m[1], "latin1")).toString("latin1"));
    } catch {
      // Non tutti i flussi sono testo compresso: i font, per esempio.
    }
  }
  const contenuto = pezzi.join("\n");
  let testo = "";
  for (const m of contenuto.matchAll(/<([0-9a-fA-F]+)>/g)) {
    for (let i = 0; i < m[1].length; i += 2) {
      testo += String.fromCharCode(Number.parseInt(m[1].slice(i, i + 2), 16));
    }
  }
  /*
    WinAnsi non è Latin-1 nella fascia 0x80–0x9F, ed è proprio lì che stanno i
    caratteri di questo documento: l'euro, le lineette, le virgolette basse.
    Senza questa tabella il confronto fallirebbe su «97 €» e su ogni «—».
  */
  const WINANSI: Record<number, string> = {
    0x80: "€", 0x91: "‘", 0x92: "’", 0x93: "“", 0x94: "”",
    0x96: "–", 0x97: "—", 0xab: "«", 0xbb: "»",
  };
  return [...testo].map((c) => WINANSI[c.charCodeAt(0)] ?? c).join("");
}

/** Senza spazi e senza asterischi: l'impaginazione manda a capo dove vuole. */
const nudo = (s: string) => s.replace(/\*\*/g, "").replace(/\s+/g, "");

describe("i Termini in PDF", () => {
  it("contiene tutte le righe del Markdown, nessuna esclusa", async () => {
    const { percorso } = await generaPdfTermini();
    const dentro = nudo(testoDelPdf(readFileSync(percorso)));

    const righe = markdown
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r !== "" && !r.startsWith("*Versione"))
      .map((r) => r.replace(/^#+\s+/, "").replace(/^-\s+/, ""));

    const mancanti = righe.filter((r) => !dentro.includes(nudo(r)));
    expect(
      mancanti,
      `Righe del contratto che nel PDF non ci sono:\n${mancanti.map((m) => `  ${m}`).join("\n")}\n\n`
        + "Il PDF va nel fascicolo dell'ordine: un pezzo in meno è una clausola che\n"
        + "l'acquirente non ha mai ricevuto.",
    ).toEqual([]);
    expect(righe.length).toBeGreaterThan(50);
  });

  it("porta il piede su ogni pagina, con il conto giusto", async () => {
    const { percorso } = await generaPdfTermini();
    const dentro = nudo(testoDelPdf(readFileSync(percorso)));
    const piedi = [...dentro.matchAll(/pagina(\d+)di(\d+)/g)].map((m) => [+m[1], +m[2]]);

    expect(piedi.length, "nessun piede di pagina nel PDF").toBeGreaterThan(0);
    const totale = piedi[0][1];
    // Un piede per pagina, numerati in fila, e il totale è quante sono davvero:
    // «pagina 1 di 1» su un documento di quattro è già successo.
    expect(piedi.map(([n]) => n)).toEqual(Array.from({ length: totale }, (_, i) => i + 1));
    expect(piedi.every(([, t]) => t === totale)).toBe(true);
  });

  /**
   * Byte identici a ogni esecuzione.
   *
   * L'impronta accanto al link serve a dimostrare che il file scaricato oggi è
   * quello allegato all'ordine di allora. Se cambiasse a ogni build non
   * dimostrerebbe niente, e nessuno se ne accorgerebbe finché non gli servisse.
   */
  it("è deterministico: due generazioni, gli stessi byte", async () => {
    const a = await generaPdfTermini();
    const primo = readFileSync(a.percorso);
    const b = await generaPdfTermini();
    const secondo = readFileSync(b.percorso);
    expect(a.impronta).toBe(b.impronta);
    expect(primo.equals(secondo)).toBe(true);
    expect(createHash("sha256").update(primo).digest("hex")).toBe(a.impronta);
  });

  it("il file pubblicato è quello dei Termini di adesso", async () => {
    const pagina = leggiPagina(SITO.termini);
    expect(pagina.versione, "i Termini non portano un numero di versione").not.toBeNull();
    const atteso = `public${indirizzoPdfTermini(pagina.versione!)}`;
    const { percorso, impronta } = await generaPdfTermini();
    expect(percorso.endsWith(atteso.replace("public/", "/"))).toBe(true);
    expect(createHash("sha256").update(readFileSync(atteso)).digest("hex")).toBe(impronta);
  });
});

describe("la struttura del contratto", () => {
  /**
   * I numeri di sezione sono unici e in fila.
   *
   * Un contratto con due «7.» rimanda a un articolo che non si sa quale sia, e
   * il punto 13 approva le clausole **per numero**: «art. 5», «art. 9». Se due
   * sezioni portassero lo stesso numero, l'approvazione specifica indicherebbe
   * due testi diversi, e sarebbe la firma su qualcosa di indeterminato.
   *
   * Non è una regola di stile: è la condizione perché il punto 13 significhi
   * qualcosa.
   */
  const numeri = [...markdown.matchAll(/^##\s+(\d+)\.\s+(.+)$/gm)].map((m) => ({
    numero: Number(m[1]),
    titolo: m[2].trim(),
  }));

  it("ha una sezione numerata per ogni articolo", () => {
    expect(numeri.length).toBeGreaterThan(10);
  });

  it("nessun numero è usato due volte", () => {
    const visti = new Map<number, string[]>();
    for (const n of numeri) visti.set(n.numero, [...(visti.get(n.numero) ?? []), n.titolo]);
    const doppi = [...visti].filter(([, titoli]) => titoli.length > 1);
    expect(
      doppi.map(([n, titoli]) => `art. ${n}: ${titoli.map((t) => `«${t}»`).join(" e ")}`),
      "Due sezioni con lo stesso numero: il punto 13 approva le clausole per numero,\n"
        + "e un numero che ne indica due è un'approvazione su un testo indeterminato.",
    ).toEqual([]);
  });

  it("i numeri vanno da 1 in su, senza salti", () => {
    expect(numeri.map((n) => n.numero)).toEqual(
      Array.from({ length: numeri.length }, (_, i) => i + 1),
    );
  });

  it("ogni clausola citata dal punto 13 esiste", () => {
    const punto13 = markdown.split(/^##\s+13\./m)[1] ?? "";
    const citati = [...punto13.matchAll(/\*\*art\.\s*(\d+)\*\*/g)].map((m) => Number(m[1]));
    expect(citati.length, "il punto 13 non cita nessun articolo").toBeGreaterThan(3);
    const esistenti = new Set(numeri.map((n) => n.numero));
    expect(citati.filter((c) => !esistenti.has(c))).toEqual([]);
  });
});

describe("il prezzo mostrato e il prezzo pattuito", () => {
  /**
   * I tre numeri della pagina d'acquisto stanno anche nel punto 6.
   *
   * Non si può leggere l'uno dall'altro: nel contratto il prezzo è dentro una
   * frase in prosa, e una regex su una clausola è un difetto che aspetta il
   * giorno in cui il legale riscrive la riga. Ma due copie di un prezzo che si
   * muovono separate sono la cosa peggiore che questo progetto sa produrre —
   * quindi non si legge, si **verifica**: se uno dei due documenti cambia senza
   * l'altro, questo test lo dice.
   */
  const punto6 = markdown.split(/^##\s+6\./m)[1]?.split(/^##\s/m)[0] ?? "";
  const senzaSpazi = (s: string) => s.replace(/[\s\u00a0]+/g, " ");

  it("il punto 6 esiste e parla di prezzo", () => {
    expect(punto6.length).toBeGreaterThan(100);
  });

  it("imponibile, aliquota e totale sono gli stessi delle due parti", () => {
    const testo = senzaSpazi(punto6);
    const attesi = [
      `${PREZZO.imponibile} €`,
      `${PREZZO.aliquotaIva * 100} %`,
      `${PREZZO.totale.toFixed(2).replace(".", ",")} €`,
    ];
    const mancanti = attesi.filter((a) => !testo.includes(a));
    expect(
      mancanti,
      `Nel punto 6 dei Termini non compaiono: ${mancanti.join(", ")}.\n`
        + "Il prezzo è scritto in due posti — la clausola e src/lib/sito/acquisto.ts — e questo\n"
        + "test è l'unica cosa che li tiene insieme.",
    ).toEqual([]);
  });

  it("il totale è davvero l'imponibile più l'IVA", () => {
    expect(round2(PREZZO.imponibile * (1 + PREZZO.aliquotaIva))).toBe(PREZZO.totale);
  });
});

describe("il numero di versione sta scritto una volta sola", () => {
  /**
   * La versione si legge dal file, e da nessun'altra parte.
   *
   * Il punto 12 dice che per le licenze in corso valgono i termini «nella
   * versione indicata in testa al documento trasmesso all'acquirente». Un
   * numero scritto anche in una costante è un numero che al giro dopo dice due
   * cose diverse — e la differenza sarebbe fra il contratto che si crede di
   * aver concluso e quello concluso davvero.
   */
  it("nel sorgente non compare una versione dei Termini scritta a mano", () => {
    const pagina = leggiPagina(SITO.termini);
    const versione = pagina.versione!;
    const sospette = [
      new RegExp(`[Vv]ersione\\s+${versione}\\b`),
      new RegExp(`versioneTermini\\s*[=:]\\s*${versione}\\b`),
      new RegExp(`termini-v${versione}\\b`),
    ];

    const files = [
      "src/lib/contenuti/pagine.ts",
      "src/lib/contenuti/pdf-termini.ts",
      "src/app/(sito)/pagina-di-testo.tsx",
      "src/app/(sito)/termini/page.tsx",
      "src/app/(sito)/acquista/page.tsx",
      "src/app/(sito)/acquista/schermata-acquisto.tsx",
      "src/lib/rotte.ts",
      "src/lib/sito/acquisto.ts",
    ];

    const colpevoli: string[] = [];
    for (const f of files) {
      let testo: string;
      try {
        testo = readFileSync(f, "utf8");
      } catch {
        continue;
      }
      // I commenti raccontano la storia e possono citare un numero: si tolgono.
      const codice = testo
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      if (sospette.some((r) => r.test(codice))) colpevoli.push(f);
    }

    expect(
      colpevoli,
      `La versione ${versione} dei Termini compare nel codice di:\n${colpevoli.join("\n")}\n\n`
        + `Si legge da ${SORGENTE} con leggiPagina(...).versione, che è l'unico posto in cui è scritta.`,
    ).toEqual([]);
  });
});
