import { describe, expect, it } from "vitest";
import { calcolaIva } from "./iva";
import { calcolaProspetto } from "./motore";
import {
  AVVISI_DETTI_ALTROVE,
  type AvvisoNota,
  type GenereAvviso,
  calcolaNota,
  controlliNote,
  dateNota,
  notaGrezza,
  storniDiCassa,
  stornoPerFattura,
} from "./note";
import { ripartisci } from "./competenza";
import { calcolaFattura } from "./documenti";
import { impostazioniForfettario, impostazioniOrdinario, OGGI_FIXTURE } from "./fixture";
import { PARAMETRI_2026 } from "./parametri/2026";
import type { Fattura, NotaCredito } from "./tipi";
import { euro } from "@/lib/format";

function nota(p: Partial<NotaCredito> = {}): NotaCredito {
  return {
    id: "n1",
    dataDocumento: "2026-03-10",
    numero: "NC/2026/1",
    clienteId: "c1",
    descrizione: "Storno retainer",
    imponibile: 500,
    aliquotaIva: 0.22,
    dataRimborso: null,
    ...p,
  };
}

function fattura(p: Partial<Fattura> = {}): Fattura {
  return {
    id: "f1",
    dataEmissione: "2026-02-01",
    numero: "2026/001",
    clienteId: "c1",
    descrizione: "Retainer",
    tipoRicavo: "ricorrente",
    imponibile: 1_000,
    aliquotaIva: 0.22,
    dataIncasso: "2026-02-20",
    ...p,
  };
}

const ORDINARIO = impostazioniOrdinario();

/** Una fattura con i suoi derivati, come la costruisce il motore. */
function calcolata(p: Partial<Fattura> = {}, stornato = 0) {
  return calcolaFattura(fattura(p), ORDINARIO, OGGI_FIXTURE, stornato);
}

// ————————————————————————————————————————————————————————————
// La nota come documento
// ————————————————————————————————————————————————————————————

describe("una nota di credito è uno storno, non una fattura col meno", () => {
  it("si scompone come una fattura, con l'IVA sull'imponibile", () => {
    const c = calcolaNota(nota(), ORDINARIO);
    expect(c.imponibile).toBe(500);
    expect(c.iva).toBe(110);
    expect(c.totale).toBe(610);
  });

  it("**l'imponibile resta positivo anche se arriva negativo**", () => {
    // Il segno lo dà il tipo di documento. Conservarlo negativo aprirebbe la
    // porta alla doppia negazione: uno storno che aumenta il fatturato.
    const c = calcolaNota(nota({ imponibile: -500 }), ORDINARIO);
    expect(c.imponibile).toBe(500);
    expect(c.iva).toBe(110);
  });

  it("in forfettario non c'è IVA da stornare, come non ce n'è da addebitare", () => {
    const c = calcolaNota(nota(), impostazioniForfettario());
    expect(c.iva).toBe(0);
    expect(c.totale).toBe(500);
  });

  it("porta le stesse due date di una fattura", () => {
    expect(dateNota(nota({ dataRimborso: "2026-04-05" }))).toEqual({
      documento: "2026-03-10",
      cassa: "2026-04-05",
    });
    expect(dateNota(nota()).cassa).toBeNull();
  });

  it("la forma grezza non porta dentro i derivati", () => {
    const grezza = notaGrezza(calcolaNota(nota(), ORDINARIO));
    expect(Object.keys(grezza).sort()).toEqual([
      "aliquotaIva",
      "clienteId",
      "dataDocumento",
      "dataRimborso",
      "descrizione",
      "id",
      "imponibile",
      "numero",
      "riconciliazioni",
    ]);
  });
});

// ————————————————————————————————————————————————————————————
// La riconciliazione, e il residuo dai due lati
// ————————————————————————————————————————————————————————————

describe("il residuo si legge da entrambi i lati e non si salva mai", () => {
  it("una nota parziale lascia residuo sulla nota e netto sulla fattura", () => {
    const n = nota({ imponibile: 500, riconciliazioni: [{ fatturaId: "f1", imponibile: 300 }] });
    const c = calcolaNota(n, ORDINARIO);
    expect(c.riconciliato).toBe(300);
    expect(c.residuo).toBe(200);
    expect(c.riconciliataDelTutto).toBe(false);

    const storni = stornoPerFattura([n], [fattura()]);
    expect(storni.get("f1")).toMatchObject({ stornato: 300, netto: 700 });
  });

  it("**una nota si spalma su più fatture**: due mesi di retainer, uno storno solo", () => {
    // Senza questo si finisce per inserire due note finte pur di farle stare,
    // cioè per sporcare i dati aggirando il vincolo.
    const n = nota({
      imponibile: 800,
      riconciliazioni: [
        { fatturaId: "f1", imponibile: 500 },
        { fatturaId: "f2", imponibile: 300 },
      ],
    });
    const fatture = [fattura(), fattura({ id: "f2", numero: "2026/002" })];
    const storni = stornoPerFattura([n], fatture);
    expect(storni.get("f1")?.netto).toBe(500);
    expect(storni.get("f2")?.netto).toBe(700);
    expect(calcolaNota(n, ORDINARIO).residuo).toBe(0);
  });

  it("più note sulla stessa fattura si sommano", () => {
    const note = [
      nota({ id: "n1", riconciliazioni: [{ fatturaId: "f1", imponibile: 200 }] }),
      nota({ id: "n2", numero: "NC/2026/2", riconciliazioni: [{ fatturaId: "f1", imponibile: 150 }] }),
    ];
    const storni = stornoPerFattura(note, [fattura()]);
    expect(storni.get("f1")?.stornato).toBe(350);
    expect(storni.get("f1")?.netto).toBe(650);
    expect(storni.get("f1")?.note.map((x) => x.numero)).toEqual(["NC/2026/1", "NC/2026/2"]);
  });

  it("il netto non scende sotto zero", () => {
    const n = nota({ imponibile: 2_000, riconciliazioni: [{ fatturaId: "f1", imponibile: 2_000 }] });
    expect(stornoPerFattura([n], [fattura()]).get("f1")?.netto).toBe(0);
  });

  it("una fattura senza note resta intera", () => {
    expect(stornoPerFattura([], [fattura()]).get("f1")).toMatchObject({ stornato: 0, netto: 1_000 });
  });
});

// ————————————————————————————————————————————————————————————
// Gli avvisi
// ————————————————————————————————————————————————————————————

describe("una nota non riconciliata resta valida e viene segnalata", () => {
  it("senza agganci dice che vale comunque", () => {
    const a = controlliNote([nota()], [fattura()]);
    expect(a).toHaveLength(1);
    expect(a[0].gravita).toBe("avviso");
    expect(a[0].messaggio).toContain("riduce comunque ricavi e IVA");
  });

  it("agganciata a metà dice quanto resta", () => {
    const n = nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 300 }] });
    /*
      L'attesa viene dal formattatore, non riscritta a mano: `euro()` separa
      la cifra dal simbolo con uno spazio unificatore (U+00A0), non con uno
      normale, e un test che scrive lo spazio a mano fallisce per una ragione
      che non c'entra niente con quello che sta verificando.
    */
    expect(controlliNote([n], [fattura()])[0].messaggio).toContain(euro(200));
  });

  it("agganciata del tutto e pagata al netto non produce avvisi", () => {
    const n = nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }] });
    expect(controlliNote([n], [fattura({ dataIncasso: "2026-03-25" })])).toEqual([]);
  });

  /**
   * La fattura era già incassata per intero quando la nota è nata: o il denaro
   * è tornato, e allora serve la data, oppure quell'incasso in archivio è al
   * lordo di uno storno che il cliente non ha mai pagato — e sotto ci sono
   * reddito, contributi e imposte. L'app non lo indovina: lo chiede.
   */
  it("**incassata prima della nota e senza rimborso: lo dice invece di indovinare**", () => {
    const n = nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }] });
    const a = controlliNote([n], [fattura({ dataIncasso: "2026-02-20" })]);
    expect(a).toHaveLength(1);
    expect(a[0].gravita).toBe("avviso");
    expect(a[0].messaggio).toContain("20/02/2026");
  });

  it("con la data di rimborso l'avviso sparisce", () => {
    const n = nota({
      riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }],
      dataRimborso: "2026-04-05",
    });
    expect(controlliNote([n], [fattura({ dataIncasso: "2026-02-20" })])).toEqual([]);
  });

  it("se la fattura non è ancora incassata non c'è niente da chiedere", () => {
    const n = nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }] });
    expect(controlliNote([n], [fattura({ dataIncasso: null })])).toEqual([]);
  });

  it("un aggancio a una fattura sparita è un errore, non fa sparire la nota", () => {
    const n = nota({ riconciliazioni: [{ fatturaId: "morta", imponibile: 500 }] });
    const a = controlliNote([n], [fattura()]);
    expect(a.some((x) => x.gravita === "errore" && x.messaggio.includes("non esiste più"))).toBe(true);
    // E il calcolo regge: la nota conta lo stesso.
    expect(calcolaNota(n, ORDINARIO).imponibile).toBe(500);
  });

  it("stornare più dell'imponibile della fattura è un errore", () => {
    const n = nota({ imponibile: 1_500, riconciliazioni: [{ fatturaId: "f1", imponibile: 1_500 }] });
    const a = controlliNote([n], [fattura()]);
    expect(a.some((x) => x.gravita === "errore" && x.messaggio.includes("superano"))).toBe(true);
  });
});

/**
 * Ogni avviso arriva davvero a schermo.
 *
 * Il difetto che questo blocco chiude non era nel motore: `controlliNote`
 * calcolava l'avviso giusto, e la schermata delle note lo scartava con un
 * filtro che cercava due frasi dentro il testo del messaggio. Il risultato per
 * chi usava l'app era che l'avviso **non esisteva** — nessun errore, nessuna
 * riga vuota, niente da notare.
 *
 * Adesso il filtro è per genere, e la lista dei generi nascosti sta accanto al
 * tipo. Qui si verifica che tutti gli altri passino: il giorno in cui nasce un
 * quinto avviso, o questo test lo copre o qualcuno ha deciso di nasconderlo di
 * proposito, che è una decisione e non una dimenticanza.
 */
describe("ogni avviso che il motore produce arriva a schermo", () => {
  const mostrato = (a: AvvisoNota) => !AVVISI_DETTI_ALTROVE.includes(a.genere);

  const casi: [GenereAvviso, () => AvvisoNota[]][] = [
    ["residuo", () => controlliNote([nota({ riconciliazioni: [] })], [fattura()])],
    [
      "fatturaSparita",
      () =>
        controlliNote(
          [nota({ riconciliazioni: [{ fatturaId: "sparita", imponibile: 500 }] })],
          [fattura()],
        ),
    ],
    [
      "incassoPrimaDellaNota",
      () =>
        controlliNote(
          [nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }] })],
          [fattura({ dataIncasso: "2026-02-20" })],
        ),
    ],
    [
      "rimborsoDovuto",
      () =>
        controlliNote(
          [nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }] })],
          // 1.000 di imponibile, storno 500: dopo la nota il cliente doveva
          // 610 lordi, e ne ha pagati 1.220. Il rimborso è 610, e si calcola.
          [calcolata({ dataIncasso: "2026-02-20", importoIncassato: 1_220 }, 500)],
        ),
    ],
    [
      "stornoEccessivo",
      () =>
        controlliNote(
          [nota({ imponibile: 5_000, riconciliazioni: [{ fatturaId: "f1", imponibile: 5_000 }] })],
          [fattura({ dataIncasso: "2026-03-25" })],
        ),
    ],
  ];

  it.each(casi)("«%s» si può produrre", (genere, produci) => {
    expect(produci().map((a) => a.genere)).toContain(genere);
  });

  it("e tutti i generi esistenti sono coperti da questo elenco", () => {
    const provati = casi.map(([g]) => g).sort();
    const tutti: GenereAvviso[] = [
      "fatturaSparita",
      "incassoPrimaDellaNota",
      "residuo",
      "rimborsoDovuto",
      "stornoEccessivo",
    ];
    expect(provati).toEqual(tutti);
  });

  /**
   * Quello che il difetto ha colpito: l'avviso che chiede la data del rimborso
   * quando la fattura era già incassata. È l'unico modo che l'app ha di dire
   * che i ricavi per cassa di quell'anno sono al lordo di uno storno — e per
   * settimane è stato calcolato e buttato via.
   */
  it("**quello sulla fattura incassata prima della nota non è fra i nascosti**", () => {
    const avvisi = controlliNote(
      [nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }] })],
      [fattura({ dataIncasso: "2026-02-20" })],
    );
    expect(avvisi.filter(mostrato).map((a) => a.genere)).toEqual(["incassoPrimaDellaNota"]);
  });

  it("il residuo resta nascosto: la riga lo dice già con la sua targhetta", () => {
    const avvisi = controlliNote([nota({ riconciliazioni: [] })], [fattura()]);
    expect(avvisi.map((a) => a.genere)).toEqual(["residuo"]);
    expect(avvisi.filter(mostrato)).toEqual([]);
  });
});

// ————————————————————————————————————————————————————————————
// Quando lo storno tocca la cassa
// ————————————————————————————————————————————————————————————

/**
 * Il caso che mancava, e che è il caso normale.
 *
 * La nota si emette **prima** che il cliente paghi, il cliente paga il netto, e
 * nessun denaro torna indietro: nessun rimborso, nessuna data di rimborso. Fino
 * a ieri per l'app quello storno non era mai sceso dalla cassa, mentre la
 * fattura risultava incassata per intero — e il cruscotto diceva un incassato
 * più alto dell'emesso, della differenza esatta dello storno.
 */
describe("uno storno scende dalla cassa quando il denaro si muove", () => {
  // La fattura è incassata **dopo** la nota: il cliente ha pagato il netto.
  const pagataDopo = fattura({ dataIncasso: "2026-03-25" });
  const agganciata = (p: Partial<NotaCredito> = {}) =>
    nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }], ...p });

  it("**pagata al netto: lo storno scende il giorno dell'incasso**", () => {
    const m = storniDiCassa([agganciata()], [pagataDopo]);
    expect(m).toEqual([
      { notaId: "n1", fatturaId: "f1", importo: 500, data: "2026-03-25", via: "compensazione" },
    ]);
  });

  it("rimborsata: scende alla data del rimborso, e non due volte", () => {
    const m = storniDiCassa([agganciata({ dataRimborso: "2026-04-05" })], [pagataDopo]);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ importo: 500, data: "2026-04-05", via: "rimborso" });
  });

  /**
   * La fattura era già stata pagata **per intero** quando la nota è nata:
   * quello che deve succedere è un rimborso, e finché non parte la cassa è
   * quella che è. Senza il confronto fra le due date questo caso direbbe
   * «pagato netto» su un bonifico arrivato intero il mese prima.
   */
  it("pagata prima della nota: non scende niente, il rimborso deve ancora partire", () => {
    expect(storniDiCassa([agganciata()], [fattura({ dataIncasso: "2026-02-20" })])).toEqual([]);
  });

  it("fattura non ancora incassata: si vedrà quando sarà pagata", () => {
    expect(storniDiCassa([agganciata()], [fattura({ dataIncasso: null })])).toEqual([]);
  });

  it("non agganciata a niente: non si sa da quale incasso togliere", () => {
    expect(storniDiCassa([nota()], [pagataDopo])).toEqual([]);
  });

  it("un aggancio a una fattura sparita non muove niente", () => {
    expect(storniDiCassa([agganciata()], [])).toEqual([]);
  });

  it("**non scende mai più dell'imponibile della nota**, anche se gli agganci dicono di più", () => {
    const gonfia = nota({
      imponibile: 500,
      riconciliazioni: [
        { fatturaId: "f1", imponibile: 400 },
        { fatturaId: "f2", imponibile: 400 },
      ],
    });
    const due = [pagataDopo, fattura({ id: "f2", dataIncasso: "2026-03-26" })];
    const m = storniDiCassa([gonfia], due);
    expect(m.reduce((a, s) => a + s.importo, 0)).toBe(500);
  });

  it("una nota su due fatture scende a due date diverse", () => {
    const spalmata = nota({
      imponibile: 800,
      riconciliazioni: [
        { fatturaId: "f1", imponibile: 300 },
        { fatturaId: "f2", imponibile: 500 },
      ],
    });
    const due = [pagataDopo, fattura({ id: "f2", dataIncasso: "2026-05-02" })];
    expect(storniDiCassa([spalmata], due).map((s) => [s.data, s.importo])).toEqual([
      ["2026-03-25", 300],
      ["2026-05-02", 500],
    ]);
  });
});

// ————————————————————————————————————————————————————————————
// Il motore
// ————————————————————————————————————————————————————————————

function prospetto(note: NotaCredito[], imp = ORDINARIO) {
  return calcolaProspetto({
    impostazioni: imp,
    parametri: PARAMETRI_2026,
    fatture: [fattura()],
    costi: [],
    note,
    oggi: OGGI_FIXTURE,
  });
}

describe("nel motore: due date, due effetti", () => {
  it("senza note il prospetto è quello di prima", () => {
    const p = prospetto([]);
    expect(p.compensiIncassati).toBe(1_000);
    expect(p.fatturatoEmesso).toBe(1_000);
    expect(p.note.numero).toBe(0);
  });

  it("**la nota rimborsata riduce i ricavi per cassa alla data del rimborso**", () => {
    const p = prospetto([nota({ dataRimborso: "2026-04-05" })]);
    expect(p.compensiIncassati).toBe(500);
    expect(p.ricaviRilevanti).toBe(500);
    expect(p.note.stornoIncassato).toBe(500);
  });

  it("**non ancora rimborsata non tocca i ricavi, ma riduce l'IVA e il fatturato**", () => {
    const p = prospetto([nota()]);
    expect(p.compensiIncassati).toBe(1_000); // il denaro non è ancora tornato
    expect(p.note.stornoIncassato).toBe(0);
    expect(p.note.stornoDaRimborsare).toBe(500);
    expect(p.fatturatoEmesso).toBe(500); // ma il documento è emesso
    expect(p.note.ivaStornata).toBe(110);
  });

  /**
   * Il difetto visto con dati veri, in forma di prospetto.
   *
   * Fattura da 1.000 emessa a febbraio, nota da 500 a marzo, fattura pagata
   * al netto a fine marzo. Prima: incassato 1.000 su 500 emessi — il 200 %,
   * dello stesso importo della nota. E su quei 1.000 finti si calcolavano
   * reddito, contributi, imposte e accantonamento.
   */
  it("**pagata al netto: l'incassato scende come l'emesso, non resta sopra**", () => {
    const p = calcolaProspetto({
      impostazioni: ORDINARIO,
      parametri: PARAMETRI_2026,
      fatture: [fattura({ dataIncasso: "2026-03-25" })],
      costi: [],
      note: [nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }] })],
      oggi: OGGI_FIXTURE,
    });
    expect(p.compensiIncassati).toBe(500);
    expect(p.note.stornoIncassato).toBe(500);
    // Lo storno è sceso una volta sola: non resta anche fra quelli in attesa.
    expect(p.note.stornoDaRimborsare).toBe(0);
    expect(p.fatturatoEmesso).toBe(500);
    expect(p.ricaviRilevanti).toBeLessThanOrEqual(p.fatturatoEmesso);
  });

  it("rimborsata l'anno dopo: l'IVA cala quest'anno, i ricavi l'anno prossimo", () => {
    const p = prospetto([nota({ dataRimborso: "2027-01-15" })]);
    expect(p.note.ivaStornata).toBe(110);
    expect(p.note.stornoIncassato).toBe(0);
    expect(p.note.stornoDaRimborsare).toBe(500);
    expect(p.compensiIncassati).toBe(1_000);
  });

  it("una nota dell'anno prima rimborsata quest'anno riduce i ricavi di quest'anno", () => {
    const p = prospetto([nota({ dataDocumento: "2025-12-20", dataRimborso: "2026-01-10" })]);
    expect(p.compensiIncassati).toBe(500);
    expect(p.note.ivaStornata).toBe(0); // l'IVA era già del 2025
  });

  it("la doppia attribuzione passa dalla stessa funzione delle fatture", () => {
    // Non una copia della regola: la stessa `ripartisci`, con le date della nota.
    const r = ripartisci([nota({ dataRimborso: "2027-01-15" })], 2026, dateNota);
    expect(r.perCompetenza).toHaveLength(1);
    expect(r.versoAnniSuccessivi).toHaveLength(1);
    expect(r.perCassa).toHaveLength(0);
  });

  it("**una nota non riconciliata conta lo stesso**: il fisco non guarda gli agganci", () => {
    const senza = prospetto([nota({ dataRimborso: "2026-04-05" })]);
    const con = prospetto([
      nota({ dataRimborso: "2026-04-05", riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }] }),
    ]);
    expect(senza.ricaviRilevanti).toBe(con.ricaviRilevanti);
    expect(senza.note.nonRiconciliato).toBe(500);
    expect(con.note.nonRiconciliato).toBe(0);
  });

  it("in forfettario lo storno riduce i ricavi ma non tocca l'IVA", () => {
    const p = prospetto([nota({ dataRimborso: "2026-04-05" })], impostazioniForfettario());
    expect(p.note.stornoIncassato).toBe(500);
    expect(p.note.ivaStornata).toBe(0);
  });

  it("lo storno abbassa anche la base della soglia forfettaria", () => {
    const p = prospetto([nota({ dataRimborso: "2026-04-05" })], impostazioniForfettario());
    expect(p.soglia.baseCassa).toBe(p.ricaviRilevanti);
    expect(p.soglia.baseCassa).toBe(500);
  });
});

// ————————————————————————————————————————————————————————————
// La liquidazione IVA
// ————————————————————————————————————————————————————————————

describe("nella liquidazione IVA lo storno è una voce a sé", () => {
  const p = prospetto([nota()]);

  it("toglie dal debito del mese del documento, non da quello del rimborso", () => {
    const l = calcolaIva(p.fattureCalcolate, p.costiCalcolati, ORDINARIO, PARAMETRI_2026, 0, p.noteCalcolate);
    expect(l.stornoNote.perMese[2]).toBe(110); // marzo, data del documento
    expect(l.stornoNote.totale).toBe(110);
    expect(l.mesi[1].debito).toBe(220); // febbraio: la fattura, intatta
    expect(l.mesi[2].debito).toBe(-110); // marzo: solo lo storno
  });

  it("il totale a debito dell'anno è già al netto delle note", () => {
    const senza = calcolaIva(p.fattureCalcolate, p.costiCalcolati, ORDINARIO, PARAMETRI_2026, 0, []);
    const con = calcolaIva(p.fattureCalcolate, p.costiCalcolati, ORDINARIO, PARAMETRI_2026, 0, p.noteCalcolate);
    expect(senza.totaleDebito).toBe(220);
    expect(con.totaleDebito).toBe(110);
    expect(con.stornoNote.totale).toBe(110);
  });
});

// ————————————————————————————————————————————————————————————
// Con l'importo incassato scritto sulla fattura
// ————————————————————————————————————————————————————————————

/**
 * Il campo chiude la domanda invece di sceglierne una risposta.
 *
 * Prima l'app doveva indovinare, dalle date, se una fattura incassata prima
 * della nota fosse stata pagata per intero — e quindi ci fosse un rimborso in
 * arrivo — oppure pagata corta, con la nota venuta dopo a chiudere. Indovinava
 * «per intero», e sbagliava nel verso che gonfia reddito e contributi.
 */
describe("quando la fattura dice quanto è arrivato", () => {
  /*
    Le fatture passano da `calcolaFattura`, come nell'app: il rimborso dovuto è
    un derivato, e provarlo su un oggetto costruito a mano vorrebbe dire provare
    un'altra cosa. È il difetto che ha fatto passare la prima stesura — il
    rimborso si ricavava da imponibile e aliquota, su una base che con una
    ritenuta attiva non è quella del bonifico, e lo scenario del test non aveva
    ritenute.
  */
  const conImporto = (importoIncassato: number, stornato = 0) =>
    calcolata({ dataIncasso: "2026-02-20", importoIncassato }, stornato);

  it("**pagata corta e nota dopo: non si deduce niente, il numero c'è già**", () => {
    // 1.000 + 22 % = 1.220; il cliente ne ha pagati 610, cioè il netto dopo lo
    // storno da 500. Nessuna compensazione da dedurre: è già scritto.
    const m = storniDiCassa(
      [nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }] })],
      [conImporto(610)],
    );
    expect(m).toEqual([]);
  });

  it("senza importo il ramo di ieri resta, per gli archivi di prima", () => {
    const m = storniDiCassa(
      [nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }] })],
      [fattura({ dataIncasso: "2026-03-25" })],
    );
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ via: "compensazione", importo: 500 });
  });

  it("l'avviso che indovinava dalle date tace, perché non c'è più da indovinare", () => {
    const a = controlliNote(
      [nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }] })],
      [conImporto(610, 500)],
    );
    expect(a.map((x) => x.genere)).not.toContain("incassoPrimaDellaNota");
  });

  it("**il rimborso dovuto si calcola, con il suo importo**", () => {
    const a = controlliNote(
      [nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }] })],
      [conImporto(1_220, 500)],
    );
    const r = a.find((x) => x.genere === "rimborsoDovuto");
    expect(r?.messaggio).toContain(euro(610));
  });

  /**
   * Con la ritenuta attiva, che è il caso in cui la prima stesura sbagliava.
   *
   * Quello che arriva in banca è il totale **meno la ritenuta**: 1.220 − 200 =
   * 1.020. Il rimborso si misura su quella base, non su imponibile più IVA —
   * altrimenti il confronto è fra due numeri che parlano di cose diverse, e non
   * scatta mai. Nessun test con una ritenuta attiva lo copriva, e il difetto è
   * uscito solo aprendo la schermata su un archivio che le ha.
   */
  it("**con la ritenuta il rimborso si misura su quello che arriva in banca**", () => {
    const conRitenuta = { ...ORDINARIO, ritenutaAttiva: true, aliquotaRitenuta: 0.2 };
    const f = calcolaFattura(
      fattura({ dataIncasso: "2026-02-20", importoIncassato: 1_020 }),
      conRitenuta,
      OGGI_FIXTURE,
      500,
    );
    // 1.020 di netto incasso, dovuto dopo lo storno 510: il rimborso è 510.
    expect(f.nettoIncasso).toBe(1_020);
    expect(f.rimborsoDovuto).toBe(510);
    const a = controlliNote([nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }] })], [f]);
    expect(a.find((x) => x.genere === "rimborsoDovuto")?.messaggio).toContain(euro(510));
  });

  it("pagata esatta dopo la nota: nessun rimborso da segnalare", () => {
    const a = controlliNote(
      [nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }] })],
      [conImporto(610, 500)],
    );
    expect(a.map((x) => x.genere)).not.toContain("rimborsoDovuto");
  });

  it("pagata meno del dovuto: è un residuo, non un rimborso e non un errore", () => {
    const a = controlliNote(
      [nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }] })],
      [conImporto(400, 500)],
    );
    expect(a.map((x) => x.genere)).toEqual([]);
  });
});

describe("nel prospetto, un incasso parziale entra per quello che è", () => {
  const conProspetto = (f: Fattura, note: NotaCredito[] = []) =>
    calcolaProspetto({
      impostazioni: ORDINARIO,
      parametri: PARAMETRI_2026,
      fatture: [f],
      costi: [],
      note,
      oggi: OGGI_FIXTURE,
    });

  it("senza importo la fattura vale tutta, come prima del campo", () => {
    const p = conProspetto(fattura({ dataIncasso: "2026-02-20" }));
    expect(p.compensiIncassati).toBe(1_000);
    expect(p.soglia.inSospeso).toBe(0);
  });

  /**
   * Il caso raccontato: fattura da 1.000 + IVA, nota da 500 di aprile, e il
   * cliente che a febbraio aveva già pagato il netto — 610 lordi. Prima
   * l'incassato diceva 1.000 su 500 emessi.
   */
  it("**pagata al netto di una nota: incassato ed emesso tornano a coincidere**", () => {
    const p = conProspetto(fattura({ dataIncasso: "2026-02-20", importoIncassato: 610 }), [
      nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }] }),
    ]);
    expect(p.compensiIncassati).toBe(500);
    expect(p.fatturatoEmesso).toBe(500);
    expect(p.ricaviRilevanti).toBeLessThanOrEqual(p.fatturatoEmesso);
  });

  it("un acconto: entra la quota incassata, e il resto resta da incassare", () => {
    // 305 su 1.220 è un quarto della fattura.
    const p = conProspetto(fattura({ dataIncasso: "2026-02-20", importoIncassato: 305 }));
    expect(p.compensiIncassati).toBe(250);
    expect(p.soglia.inSospeso).toBe(750);
    expect(p.ivaIncassata).toBe(55);
  });

  it("l'IVA della liquidazione non si muove: segue il documento, non la cassa", () => {
    const intera = conProspetto(fattura({ dataIncasso: "2026-02-20" }));
    const parziale = conProspetto(fattura({ dataIncasso: "2026-02-20", importoIncassato: 305 }));
    expect(parziale.note.ivaStornata).toBe(intera.note.ivaStornata);
    expect(parziale.fatturatoEmesso).toBe(intera.fatturatoEmesso);
  });
});
