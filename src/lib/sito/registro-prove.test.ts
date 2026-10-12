import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BLOCCHI,
  CONSERVAZIONE_PROVE,
  bloccato,
  nomeEvento,
  proveDaCancellare,
  scadenzaProve,
  testoCorrente,
  type Blocco,
  type EventoProva,
} from "./registro-prove";
import { TESTI_CONSENSI, VERSIONE_CORRENTE, testoDellaVersione } from "./testi-consensi";

/**
 * Gli archivi del servizio promemoria.
 *
 * Quello che si prova qui non è che il codice funzioni: è che **una prova
 * resti una prova**. Un evento che non sa dire su quale testo è stato dato, un
 * termine che cancella mentre il trattamento è in corso, un blocco che non
 * blocca: tre modi di arrivare, fra due anni, con un archivio che non dimostra
 * niente e con la faccia di uno che l'archivio ce l'ha.
 */

const evento = (parziale: Partial<EventoProva> = {}): EventoProva =>
  ({
    archivio: "servizio-promemoria",
    email: "mario@example.com",
    tipo: "richiesta",
    quando: "2026-10-12T09:00:00.000Z",
    ...testoCorrente(),
    ...parziale,
  }) as EventoProva;

describe("il testo dei consensi, archiviato per intero", () => {
  it("ogni versione porta la sua impronta, calcolata sul testo", () => {
    for (const t of TESTI_CONSENSI) {
      expect(t.impronta).toMatch(/^[0-9a-f]{64}$/);
      expect(t.impronta).toBe(createHash("sha256").update(t.testo, "utf8").digest("hex"));
    }
  });

  it("le versioni non si ripetono, e la corrente è l'ultima", () => {
    const viste = TESTI_CONSENSI.map((t) => t.versione);
    expect(new Set(viste).size).toBe(viste.length);
    expect(VERSIONE_CORRENTE.versione).toBe(viste[viste.length - 1]);
  });

  /*
    Il giro completo, che è la ragione per cui l'impronta sta dentro l'evento:
    da una prova registrata si torna al documento esatto che la persona aveva
    davanti, e si verifica che quel documento non sia stato toccato dopo.
  */
  it("da un evento si risale al testo esatto, e l'impronta lo conferma", () => {
    const e = evento();
    const testo = testoDellaVersione(e.versioneTesto);
    expect(testo, `la versione ${e.versioneTesto} non è in archivio`).not.toBeNull();
    expect(createHash("sha256").update(testo!.testo, "utf8").digest("hex")).toBe(e.improntaTesto);
    expect(testo!.testo).toContain("Voglio i promemoria delle scadenze");
  });

  it("e un evento che cita una versione inesistente non trova niente", () => {
    expect(testoDellaVersione("1999-01-01")).toBeNull();
  });

  /*
    E il testo archiviato è **quello che la pagina mostra**.

    È la metà che si rompe in silenzio: si corregge una virgola nell'etichetta
    di una casella, l'archivio resta quello di ieri, e da quel momento ogni
    evento registra il consenso su un testo che nessuno ha mai visto. Qui si
    legge il sorgente della pagina, senza commenti e con gli spazi appianati —
    i commenti di questo progetto ripetono le stesse frasi, e cercarle lì
    dentro vorrebbe dire trovarle sempre.
  */
  describe("e combacia con quello che la pagina mostra", () => {
    /*
      Senza **nessuno** spazio, e non con gli spazi appianati.

      Nel sorgente una frase attraversa i marcatori del JSX: «Ho letto l'<Link
      …>informativa privacy</Link>.» Tolti i tag restano dei buchi dove i tag
      stavano, e nessuna normalizzazione degli spazi li richiude — la frase
      «Ho letto l'informativa privacy.» non si troverebbe mai, e «non si trova»
      avrebbe voluto dire «la pagina non lo dice», cioè la regola soddisfatta a
      vuoto. Lo stesso vale per i `{" "}` che il JSX usa per tenere uno spazio
      a fine riga.

      Togliendo ogni spazio da tutte e due le parti il confronto resta esatto
      sulle parole e cieco all'impaginazione, che è l'unica cosa che qui non
      conta.
    */
    const nudo = (t: string) => t.replace(/\s+/g, "");
    const copy = nudo(
      readFileSync(new URL("../../app/(sito)/simulatore/promemoria.tsx", import.meta.url), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/^\s*\/\/.*$/gm, " ")
        .replace(/\{\s*["']\s*["']\s*\}/g, " ")
        .replace(/&apos;/g, "'")
        .replace(/<[^>]*>/g, " "),
    );

    const frasi = VERSIONE_CORRENTE.testo
      .split("\n\n")
      .flatMap((p) => p.split(". "))
      .map((f) => f.replace(/\s+/g, " ").trim())
      .filter((f) => f.length > 25);

    it("c'è qualcosa da confrontare", () => {
      expect(frasi.length).toBeGreaterThan(4);
    });

    it("ogni frase del testo archiviato sta nella pagina", () => {
      const mancanti = frasi.filter((f) => !copy.includes(nudo(f)));
      expect(
        mancanti,
        "Frasi archiviate come «testo mostrato» che nella pagina non ci sono:\n"
          + mancanti.map((m) => `  «${m}»`).join("\n")
          + "\n\nO la pagina è cambiata senza una versione nuova in testi-consensi.ts,\n"
          + "o l'archivio dice di aver mostrato qualcosa che non è mai stato a schermo.",
      ).toEqual([]);
    });
  });
});

describe("la conservazione delle prove", () => {
  it("sono cinque anni, e si contano dalla cessazione", () => {
    expect(CONSERVAZIONE_PROVE.anniDallaCessazione).toBe(5);
  });

  /*
    Il verso che conta: finché il trattamento è in corso non c'è nessun termine
    che corre. Contarlo dalla raccolta vorrebbe dire cancellare la prova di un
    consenso ancora in uso — restare col dato e senza la prova.
  */
  it("finché il trattamento è in corso, non scade niente", () => {
    expect(scadenzaProve([evento({ tipo: "richiesta" })])).toBeNull();
    expect(
      scadenzaProve([evento({ tipo: "richiesta" }), evento({ tipo: "attivazione", quando: "2027-01-01T00:00:00.000Z" })]),
    ).toBeNull();
  });

  it("dopo la disattivazione il termine parte, e dura cinque anni", () => {
    const eventi = [
      evento({ tipo: "richiesta", quando: "2026-10-12T09:00:00.000Z" }),
      evento({ tipo: "disattivazione", quando: "2027-03-04T09:00:00.000Z" }),
    ];
    expect(scadenzaProve(eventi)).toBe("2032-03-04");
    expect(proveDaCancellare(eventi, "2032-03-03")).toBe(false);
    expect(proveDaCancellare(eventi, "2032-03-04")).toBe(true);
  });

  /*
    E una richiesta arrivata **dopo** una disattivazione riapre tutto: la
    persona è tornata, il trattamento è in corso, e il termine che stava
    correndo non corre più. Senza questo, chi si riscrive si vedrebbe
    cancellare le prove cinque anni dopo la volta che se n'era andato.
  */
  it("una riscrizione ferma il termine che stava correndo", () => {
    const eventi = [
      evento({ tipo: "disattivazione", quando: "2027-03-04T09:00:00.000Z" }),
      evento({ tipo: "richiesta", quando: "2028-01-10T09:00:00.000Z" }),
    ];
    expect(scadenzaProve(eventi)).toBeNull();
    expect(proveDaCancellare(eventi, "2040-01-01")).toBe(false);
  });

  it("l'ordine in cui arrivano gli eventi non cambia la risposta", () => {
    const a = evento({ tipo: "richiesta", quando: "2026-10-12T09:00:00.000Z" });
    const b = evento({ tipo: "disattivazione", quando: "2027-03-04T09:00:00.000Z" });
    expect(scadenzaProve([b, a])).toBe(scadenzaProve([a, b]));
  });

  it("anche la revoca del marketing è una cessazione", () => {
    const eventi = [
      evento({ archivio: "consensi-marketing", tipo: "consenso", quando: "2026-10-12T09:00:00.000Z" }),
      evento({ archivio: "consensi-marketing", tipo: "revoca", quando: "2026-11-01T09:00:00.000Z" }),
    ];
    expect(scadenzaProve(eventi)).toBe("2031-11-01");
  });
});

describe("il blocco per contestazione", () => {
  const BLOCCO: Blocco[] = [
    { email: "Mario@Example.com", dal: "2027-02-01", motivo: "reclamo al Garante n. 123" },
  ];

  it("oggi non c'è nessun blocco", () => {
    expect(BLOCCHI).toEqual([]);
  });

  it("riconosce l'indirizzo anche scritto con altre maiuscole", () => {
    expect(bloccato("mario@example.com", BLOCCO)).toBe(true);
    expect(bloccato("  MARIO@EXAMPLE.COM ", BLOCCO)).toBe(true);
    expect(bloccato("altro@example.com", BLOCCO)).toBe(false);
  });

  /*
    Il blocco vince sul termine, sempre: è il suo mestiere. Senza, una funzione
    notturna distruggerebbe documenti rilevanti per un procedimento in corso —
    e non per decisione di qualcuno, ma perché stava facendo il suo lavoro.
  */
  it("un indirizzo bloccato non si cancella, nemmeno dopo i cinque anni", () => {
    const eventi = [evento({ tipo: "disattivazione", quando: "2027-03-04T09:00:00.000Z" })];
    expect(proveDaCancellare(eventi, "2040-01-01")).toBe(true);
    expect(proveDaCancellare(eventi, "2040-01-01", BLOCCO)).toBe(false);
  });

  it("ogni blocco porta il suo perché, se no non si sa più perché c'è", () => {
    for (const b of BLOCCHI) {
      expect(b.motivo.trim().length, `il blocco di ${b.email} non dice perché`).toBeGreaterThan(5);
      expect(b.dal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("i nomi dei file nel magazzino", () => {
  it("l'archivio è la prima cartella: i tre restano separati anche da fuori", () => {
    expect(nomeEvento(evento())).toBe("servizio-promemoria/2026-10-12/richiesta.json");
    expect(nomeEvento(evento({ archivio: "consensi-marketing", tipo: "consenso" }))).toBe(
      "consensi-marketing/2026-10-12/consenso.json",
    );
    expect(
      nomeEvento({ archivio: "esclusione", email: "x@y.it", quando: "2026-10-12T09:00:00.000Z" }),
    ).toBe("esclusione/2026-10-12/esclusione.json");
  });

  it("l'indirizzo non entra nel nome: un elenco di nomi sarebbe una rubrica", () => {
    expect(nomeEvento(evento())).not.toContain("mario");
  });
});
