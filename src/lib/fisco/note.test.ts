import { describe, expect, it } from "vitest";
import { calcolaIva } from "./iva";
import { calcolaProspetto } from "./motore";
import { calcolaNota, controlliNote, dateNota, notaGrezza, stornoPerFattura } from "./note";
import { ripartisci } from "./competenza";
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

  it("agganciata del tutto non produce avvisi", () => {
    const n = nota({ riconciliazioni: [{ fatturaId: "f1", imponibile: 500 }] });
    expect(controlliNote([n], [fattura()])).toEqual([]);
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
