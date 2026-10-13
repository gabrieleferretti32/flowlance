import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FORNITORE,
  MARGINE,
  esigiNienteApprovazioneSpecifica,
  generaPdfTermini,
  indirizzoPdfTermini,
  senzaCollegamenti,
} from "./pdf-termini";
import { leggiPagine, stessoColore, terna } from "./geometria-pdf";
import { leggiMarchio } from "./marchio-pdf";
import { PAGINE_DI_TESTO, leggiPagina } from "./pagine";
import { DOMINIO } from "@/lib/sito/impostazioni";
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

/**
 * Il testo del contratto, senza il piede.
 *
 * Il piede si scrive in coda al flusso della **sua** pagina, quindi in un
 * documento letto per intero finisce **in mezzo** al paragrafo che scavalca
 * l'interruzione: «…la dichiarazione di acquisto  Flowlance — Termini…pagina 1
 * di 4  professionale e l'approvazione…». Cercarci dentro le righe del
 * Markdown fallirebbe su quella, e fallirebbe per una ragione che non c'entra
 * niente col contratto.
 *
 * Toglierlo non è indebolire il controllo: il piede lo verifica il gruppo delle
 * misure, pagina per pagina, dove sta e cosa dice.
 */
function corpoDelPdf(byte: Buffer): string {
  return leggiPagine(byte)
    .flatMap((p) => p.testi)
    .filter((t) => !/pagina \d+ di \d+/.test(t.testo))
    .map((t) => t.testo)
    .join(" ");
}

/**
 * Senza spazi e senza asterischi: l'impaginazione manda a capo dove vuole.
 *
 * E senza la sintassi dei collegamenti, per la stessa ragione per cui il PDF
 * non la stampa: `[flowlance.it/requisiti-tecnici/](https://…)` sul foglio è
 * il solo testo fra parentesi quadre. Il confronto deve guardare quello che il
 * PDF contiene davvero — e se un giorno il renderer smettesse di ridurre i
 * collegamenti, il testo nel PDF conterrebbe l'indirizzo due volte e questo
 * controllo cadrebbe.
 */
const nudo = (s: string) =>
  senzaCollegamenti(s).replace(/\*\*/g, "").replace(/\s+/g, "");

describe("i Termini in PDF", () => {
  it("contiene tutte le righe del Markdown, nessuna esclusa", async () => {
    const { percorso } = await generaPdfTermini();
    const dentro = nudo(corpoDelPdf(readFileSync(percorso)));

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

  /**
   * Il piede si verifica **in geometria**, non cercandone il testo.
   *
   * La versione precedente di questo test contava le stringhe «pagina N di M»
   * nel testo estratto, le trovava tutte e quattro in fila e diceva che
   * andava bene. Erano su quattro pagine vuote in fondo al documento, in alto,
   * e il contratto stava sulle prime quattro senza nessun piede. Il testo era
   * giusto e il documento sbagliato: è la seconda volta che questo generatore
   * inganna un controllo scritto sulle parole.
   */
  describe("le pagine, misurate", () => {
    /** La fascia in cui il piede può stare: sotto l'area di testo, dentro il foglio. */
    const ALTO_DEL_PIEDE = MARGINE;

    /**
     * Quanto bianco si tollera in fondo a una pagina che non è l'ultima.
     *
     * Un'interruzione di pagina lascia libero al massimo l'ingombro del blocco
     * che non ci stava — nel documento di adesso il caso peggiore sono 39 punti,
     * poco più di tre righe. La soglia sta molto sopra perché il testo cambia e
     * questo test non deve diventare un allarme da ignorare; resta sotto un
     * quarto di pagina, che è il punto: una pagina mezza vuota, o vuota del
     * tutto, non passa.
     */
    const BIANCO_TOLLERATO = 200;

    it("una pagina sola per foglio, e nessun foglio vuoto", async () => {
      const { percorso } = await generaPdfTermini();
      const pagine = leggiPagine(readFileSync(percorso));

      expect(pagine.length, "il PDF non ha pagine").toBeGreaterThan(2);
      for (const p of pagine) {
        const corpo = p.testi.filter((t) => !/pagina \d+ di \d+/.test(t.testo));
        expect(
          corpo.length,
          `pagina ${p.numero} di ${pagine.length}: non ha nessun testo oltre al piede.\n`
            + "Un foglio vuoto in un contratto è un foglio che qualcuno, un giorno, cercherà\n"
            + "di capire cosa doveva contenere.",
        ).toBeGreaterThan(0);
      }
    });

    it("il piede sta su ogni pagina, dentro quella pagina, in fondo", async () => {
      const { percorso } = await generaPdfTermini();
      const pagine = leggiPagine(readFileSync(percorso));

      for (const p of pagine) {
        const piedi = p.testi.filter((t) => /pagina \d+ di \d+/.test(t.testo));
        expect(
          piedi.length,
          `pagina ${p.numero}: ${piedi.length} piedi invece di uno`,
        ).toBe(1);

        const piede = piedi[0];
        // Sotto l'area di testo e dentro il foglio: non in cima, non fuori.
        expect(
          piede.y,
          `pagina ${p.numero}: il piede sta a y=${piede.y.toFixed(0)}, fuori dalla fascia bassa `
            + `(0 – ${ALTO_DEL_PIEDE}) del foglio alto ${p.altezza.toFixed(0)}`,
        ).toBeLessThan(ALTO_DEL_PIEDE);
        expect(piede.y).toBeGreaterThan(0);

        // E dice il numero di questa pagina, su quante sono davvero.
        const numeri = piede.testo.match(/pagina (\d+) di (\d+)/)!;
        expect(Number(numeri[1]), `pagina ${p.numero}: il piede dice un altro numero`).toBe(p.numero);
        expect(Number(numeri[2]), `pagina ${p.numero}: il totale nel piede`).toBe(pagine.length);

        // Il testo del contratto non scende dentro la fascia del piede.
        const corpo = p.testi.filter((t) => t !== piede);
        const piuBasso = Math.min(...corpo.map((t) => t.y));
        expect(
          piuBasso,
          `pagina ${p.numero}: l'ultima riga di testo (y=${piuBasso.toFixed(0)}) scende sul piede `
            + `(y=${piede.y.toFixed(0)})`,
        ).toBeGreaterThan(piede.y + 8);
      }
    });

    it("nessuna pagina si interrompe a metà, tranne l'ultima", async () => {
      const { percorso } = await generaPdfTermini();
      const pagine = leggiPagine(readFileSync(percorso));

      for (const p of pagine.slice(0, -1)) {
        const corpo = p.testi.filter((t) => !/pagina \d+ di \d+/.test(t.testo));
        const piuBasso = Math.min(...corpo.map((t) => t.y));
        const piede = p.testi.find((t) => /pagina \d+ di \d+/.test(t.testo))!;
        const bianco = piuBasso - piede.y;
        expect(
          bianco,
          `pagina ${p.numero}: fra l'ultima riga e il piede restano ${bianco.toFixed(0)} punti di `
            + "bianco. Una pagina che si interrompe così presto vuol dire che il generatore\n"
            + "sbaglia a calcolare dove finisce il foglio — è già successo, e la conseguenza\n"
            + "visibile erano quattro pagine vuote in fondo al contratto.",
        ).toBeLessThan(BIANCO_TOLLERATO);
      }
    });
  });

  describe("la carta intestata", () => {
    it("il marchio è disegnato sulla prima pagina, e solo lì", async () => {
      const { percorso } = await generaPdfTermini();
      const pagine = leggiPagine(readFileSync(percorso));
      const marchio = leggiMarchio();

      /*
        I colori si prendono dal file SVG, non da costanti scritte qui: se il
        marchio cambia tinta, questo test segue senza che nessuno lo aggiorni —
        ed è la stessa ragione per cui il PDF lo legge invece di ricopiarlo.
      */
      const attesi = [...new Set(marchio.rettangoli.map((r) => r.colore))].map(terna);
      const usati = pagine[0].riempimenti;
      const mancanti = attesi.filter((a) => !usati.some((u) => stessoColore(u, a)));
      expect(
        mancanti.length,
        `Sulla prima pagina mancano ${mancanti.length} dei ${attesi.length} colori del marchio.`,
      ).toBe(0);

      // Sulle pagine successive il marchio non c'è: le identifica il piede, che
      // dice più di un logo — documento, versione, e quale pagina è.
      for (const p of pagine.slice(1)) {
        const intrusi = attesi.filter((a) => p.riempimenti.some((u) => stessoColore(u, a)));
        expect(intrusi.length, `pagina ${p.numero}: c'è il marchio, che va solo sulla prima`).toBe(0);
      }
    });

    it("i dati del fornitore stanno sopra il titolo", async () => {
      const { percorso } = await generaPdfTermini();
      const prima = leggiPagine(readFileSync(percorso))[0];
      const riga = (frammento: string) =>
        prima.testi.find((t) => t.testo.replace(/\s+/g, " ").includes(frammento));

      const titolo = riga("Termini di servizio");
      expect(titolo, "sulla prima pagina non trovo il titolo").toBeDefined();
      for (const atteso of [FORNITORE.nome, FORNITORE.partitaIva, FORNITORE.email]) {
        const trovata = riga(atteso);
        expect(trovata, `«${atteso}» non compare sulla prima pagina`).toBeDefined();
        expect(
          trovata!.y,
          `«${atteso}» sta sotto il titolo: la carta intestata va sopra`,
        ).toBeGreaterThan(titolo!.y);
      }
    });

    /**
     * I dati della carta intestata sono quelli del contratto.
     *
     * Sono scritti due volte — nell'intestazione e dentro il punto 1 — e non si
     * può leggere l'una dall'altra: là stanno in una frase di contratto. Ma due
     * copie che si muovono separate sono la solita cosa peggiore, quindi non si
     * legge, si verifica.
     */
    it("partita IVA e indirizzo coincidono con quelli del punto 1", () => {
      const punto1 = markdown.split(/^##\s+1\./m)[1]?.split(/^##\s/m)[0] ?? "";
      const testo = punto1.replace(/\s+/g, " ");
      for (const atteso of [FORNITORE.nome, FORNITORE.partitaIva, FORNITORE.indirizzo]) {
        expect(
          testo.includes(atteso),
          `«${atteso}» è nella carta intestata del PDF ma non nel punto 1 dei Termini.\n`
            + "Se la sede o la partita IVA cambiano, devono cambiare insieme.",
        ).toBe(true);
      }
    });
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
   * Il contratto **si cita da solo**: il 6-bis rimanda «al punto 7» per le
   * licenze rimborsate, l'art. 4 «al punto 5» per i dati, l'art. 12 «al punto
   * 6-bis» per le garanzie dei Fondatori. Un contratto con due «7.» rimanda a
   * un articolo che non si sa quale sia, e quel rinvio è il contenuto della
   * clausola, non una comodità tipografica.
   *
   * Non è una regola di stile: è la condizione perché i rinvii significhino
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
      "Due sezioni con lo stesso numero: il contratto si cita da solo, e un numero\n"
        + "che ne indica due manda il lettore su un testo indeterminato.",
    ).toEqual([]);
  });

  it("i numeri vanno da 1 in su, senza salti", () => {
    expect(numeri.map((n) => n.numero)).toEqual(
      Array.from({ length: numeri.length }, (_, i) => i + 1),
    );
  });

  /*
    ─────────────────────────────────────────────────────────────────────
    Ogni rinvio interno porta a un articolo che esiste
    ─────────────────────────────────────────────────────────────────────

    Prima questo controllo guardava le clausole elencate dal punto 13, che
    nominava gli articoli per numero. Il punto 13 non c'è più — nella versione
    3 non ci sono clausole da approvare specificamente — ma i rinvii interni
    sono rimasti, e sono la cosa che la sua sparizione poteva rompere: via un
    articolo, i numeri scalano, e «ai sensi del punto 7» indica un'altra
    clausola senza che niente si rompa. Il contratto resta valido, resta
    impaginato, e dice una cosa diversa.

    Qui si raccolgono **tutti** i rinvii del testo — «punto 7», «punto 6-bis»,
    «art. 5» — e si pretende che dall'altra parte ci sia un articolo.
  */
  it("ogni rinvio interno porta a un articolo che esiste", () => {
    const etichette = new Set<string>([
      ...numeri.map((n) => String(n.numero)),
      ...[...markdown.matchAll(/^##\s+(\d+-bis)\./gm)].map((m) => m[1]),
    ]);
    const rinvii = [...markdown.matchAll(/\b(?:punto|art\.)\s+(\d+(?:-bis)?)/g)].map((m) => m[1]);
    expect(rinvii.length, "il contratto non si cita mai da solo: controlla la regex").toBeGreaterThan(2);
    const rotti = [...new Set(rinvii.filter((r) => !etichette.has(r)))];
    expect(
      rotti,
      `Il contratto rimanda a punti che non esistono: ${rotti.join(", ")}.\n`
        + "Succede rinumerando: il rinvio non si rompe, cambia bersaglio.",
    ).toEqual([]);
  });

  /*
    ─────────────────────────────────────────────────────────────────────
    E gli articoli «bis», che al controllo di sopra sono invisibili
    ─────────────────────────────────────────────────────────────────────

    Il controllo qui sopra cerca `**art. N**`: su `**art. 6-bis, commi 3 e
    4**` la cifra è seguita da un trattino e la riga non viene nemmeno
    catturata. Non fallisce — **non guarda**, che è peggio: il punto 13
    potrebbe approvare specificamente una clausola che nel contratto non
    esiste, e nessuno se ne accorgerebbe.

    Lo stesso vale per la numerazione: `## 6-bis.` non corrisponde a
    `^##\s+(\d+)\.` e resta fuori dal conto «da 1 in su senza salti». Giusto
    così — un «bis» non è un numero della serie — ma vuol dire che la sua
    esistenza non la verifica nessun altro.
  */
  const bis = [...markdown.matchAll(/^##\s+(\d+)-bis\.\s+(.+)$/gm)].map((m) => ({
    etichetta: `${m[1]}-bis`,
    titolo: m[2].trim(),
  }));

  it("gli articoli «bis» hanno un titolo e non si ripetono", () => {
    const visti = new Map<string, string[]>();
    for (const b of bis) visti.set(b.etichetta, [...(visti.get(b.etichetta) ?? []), b.titolo]);
    expect([...visti].filter(([, t]) => t.length > 1)).toEqual([]);
  });

  /*
    E la tagliola che tiene chiusa la porta da cui il punto 13 è uscito.

    Il controllo vero sta in `pdf-termini.ts` e ferma il **build**: è là perché
    una clausola vessatoria tornata nel contratto non si vede — è numerata,
    impaginata, dentro il PDF allegato all'ordine — e senza approvazione
    specifica è inefficace (art. 1341 c. 2 c.c.). Qui si prova che quella
    tagliola morde, nei due versi: tace sul contratto di oggi e parla su un
    contratto che il rinvio ce l'ha.
  */
  it("il contratto di oggi non rinvia agli artt. 1341-1342", () => {
    expect(() => esigiNienteApprovazioneSpecifica(markdown)).not.toThrow();
  });

  it("e se il rinvio tornasse, il build si fermerebbe", () => {
    const conClausola = markdown
      + "\n## 14. Clausole soggette ad approvazione specifica\n\n"
      + "Ai sensi e per gli effetti degli artt. 1341 e 1342 del Codice civile, l'acquirente "
      + "approva specificamente le clausole seguenti.\n";
    expect(() => esigiNienteApprovazioneSpecifica(conClausola)).toThrow(/1341/);
    expect(() => esigiNienteApprovazioneSpecifica(conClausola)).toThrow(/inefficace/);
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

/*
  ─────────────────────────────────────────────────────────────────────────
  Quello che il punto 4 promette alla scadenza, il codice lo fa
  ─────────────────────────────────────────────────────────────────────────

  «Alla scadenza restano consultabili i dati, resta attiva l'esportazione
  dell'archivio, resta attiva la stampa del prospetto, non è più possibile
  inserire o modificare»: è una clausola, non una preferenza d'interfaccia. Da
  quando dall'art. 5 e dall'art. 9 sono sparite le esclusioni di
  responsabilità, è anche una delle poche cose che il contratto **promette** di
  fare, invece di dire cosa non garantisce.

  Nel codice la differenza fra «si può» e «non si più» è un marcatore solo:
  `<Button scrive>` e `BloccoScrittura` spengono il controllo a licenza
  scaduta. Mettere `scrive` sul pulsante «Esporta» — per simmetria, per
  distrazione, perché sta accanto a «Importa» che invece ce l'ha — spegnerebbe
  l'esportazione a chi ha una licenza scaduta: niente si romperebbe, nessun
  test cadrebbe, e la promessa del punto 4 sarebbe falsa esattamente per le
  persone a cui serve.

  Questo controllo guarda il sorgente dei due pulsanti. È una misura grezza — è
  testo — ma è l'unica disponibile senza un browser, e cade nel verso giusto:
  se il pulsante cambia forma, il test non lo trova e fallisce invece di
  tacere.
*/
describe("la sola lettura alla scadenza, come la scrive il punto 4", () => {
  /** La riga del pulsante, con quello che la segue fino alla chiusura del tag. */
  function pulsante(file: string, etichetta: string): string {
    const testo = readFileSync(file, "utf8");
    const dal = testo.indexOf(etichetta);
    expect(dal, `in ${file} non trovo più «${etichetta}»`).toBeGreaterThan(-1);
    const apertura = testo.lastIndexOf("<Button", dal);
    expect(apertura, `«${etichetta}» non sta dentro un <Button>`).toBeGreaterThan(-1);
    return testo.slice(apertura, dal);
  }

  it("l'esportazione dell'archivio non si spegne a licenza scaduta", () => {
    expect(
      pulsante("src/app/app/dati/pannello-dati.tsx", "Esporta\n"),
      "Il pulsante «Esporta» è marcato `scrive`: a licenza scaduta sarebbe spento,\n"
        + "e il punto 4 dei Termini promette che l'esportazione resta attiva.",
    ).not.toMatch(/\bscrive\b/);
  });

  it("la stampa del prospetto nemmeno", () => {
    expect(
      pulsante("src/app/app/fisco/schermata-fisco.tsx", "Stampa il prospetto"),
      "Il pulsante della stampa è marcato `scrive`: il punto 4 promette che resta attiva.",
    ).not.toMatch(/\bscrive\b/);
  });

  /*
    E la controprova: se nessun pulsante di quella schermata portasse il
    marcatore, i due controlli qui sopra passerebbero su un file in cui
    `scrive` non esiste più — cioè su un'app che non si spegne mai.
  */
  it("ma l'importazione sì, se no questo controllo non misura niente", () => {
    expect(pulsante("src/app/app/dati/pannello-dati.tsx", "Importa\n")).toMatch(/\bscrive\b/);
  });
});

/*
  ─────────────────────────────────────────────────────────────────────────
  Il punto 8 rimanda a una pagina che esiste
  ─────────────────────────────────────────────────────────────────────────

  La clausola dice che l'uso offline vale «nei limiti dei requisiti tecnici
  indicati sul sito all'indirizzo …». Per un mese quel rinvio è stato a
  vuoto: il contratto nominava dei requisiti che sul sito non c'erano, e
  niente lo segnalava — un contratto non si rompe, si legge.

  Qui si pretende che l'indirizzo nominato dal contratto sia una pagina che il
  sito pubblica davvero. Il controllo sul **sito costruito** lo fa
  `verifica-link.mjs`, che da oggi guarda anche gli indirizzi assoluti: i due
  si dividono il lavoro, il contratto a questo e le pagine all'altro.
*/
describe("i rimandi del contratto fuori da sé stesso", () => {
  const indirizzi = [...markdown.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((m) => m[1]);

  it("il contratto nomina almeno un indirizzo del sito", () => {
    expect(indirizzi.length).toBeGreaterThan(0);
  });

  it("ogni indirizzo di flowlance.it nominato dal contratto è una pagina pubblicata", () => {
    const nostri = indirizzi
      .filter((i) => i.startsWith(DOMINIO))
      .map((i) => i.slice(DOMINIO.length).replace(/\/$/, ""));
    expect(nostri.length, "il contratto non nomina nessuna pagina del sito").toBeGreaterThan(0);
    const pubblicate = new Set<string>(Object.keys(PAGINE_DI_TESTO));
    const mancanti = nostri.filter((i) => !pubblicate.has(i));
    expect(
      mancanti,
      `Il contratto rimanda a ${mancanti.join(", ")}, che il sito non pubblica.\n`
        + "Un rinvio a vuoto in una clausola non si rompe: si legge, e manda chi legge da nessuna parte.",
    ).toEqual([]);
  });

  it("e il punto 8 nomina proprio quella dei requisiti tecnici", () => {
    const punto8 = markdown.split(/^##\s+8\./m)[1]?.split(/^##\s/m)[0] ?? "";
    expect(punto8).toContain(`${DOMINIO}${SITO.requisitiTecnici}/`);
    // L'indirizzo è anche il **testo** del collegamento: nel PDF, che non ha
    // link, resta scritto. Un testo diverso lascerebbe il foglio senza.
    expect(punto8).toContain(`[flowlance.it${SITO.requisitiTecnici}/]`);
  });
});
