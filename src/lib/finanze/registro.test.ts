import { describe, expect, it } from "vitest";
import {
  FILTRO_VUOTO,
  filtraRegistro,
  mesiConMovimenti,
  riguardaIlConto,
  totaliRegistro,
} from "./registro";
import { saldoConto } from "./saldo";
import type { ContoPersonale, MovimentoPf } from "./tipi";

const mov = (p: Partial<MovimentoPf> & { id: string; data: string; importo: number }): MovimentoPf => ({
  tipo: "spesa", categoriaId: "c", contoId: "a", descrizione: "", ...p,
});

const REGISTRO: MovimentoPf[] = [
  mov({ id: "1", data: "2026-01-10", tipo: "entrata", importo: 2_000 }),
  mov({ id: "2", data: "2026-01-20", tipo: "spesa", importo: 300 }),
  mov({ id: "3", data: "2026-02-05", tipo: "rata", importo: 250, contoId: "b" }),
  mov({ id: "4", data: "2026-03-01", tipo: "giroconto", importo: 1_000, contoId: "a", contoDestinazioneId: "b" }),
  mov({ id: "5", data: "2026-03-08", tipo: "risparmio", importo: 400, contoId: "b" }),
  mov({ id: "6", data: "2025-12-30", tipo: "spesa", importo: 99 }),
];

describe("il filtro del registro", () => {
  const base = FILTRO_VUOTO(2026);

  it("tiene solo l'anno guardato", () => {
    expect(filtraRegistro(REGISTRO, base).map((m) => m.id)).toEqual(["5", "4", "3", "2", "1"]);
  });

  it("mostra il più recente per primo", () => {
    const righe = filtraRegistro(REGISTRO, base);
    expect(righe[0].data >= righe[righe.length - 1].data).toBe(true);
  });

  it("per mese", () => {
    expect(filtraRegistro(REGISTRO, { ...base, mese: 1 }).map((m) => m.id)).toEqual(["2", "1"]);
  });

  it("per tipo", () => {
    expect(filtraRegistro(REGISTRO, { ...base, tipo: "entrata" }).map((m) => m.id)).toEqual(["1"]);
  });

  /**
   * **Il conto di destinazione conta quanto quello d'origine.**
   *
   * I mille euro arrivati sul libretto sono nel saldo del libretto, perché
   * `saldoConto` legge tutti e due i capi del giroconto. Se l'elenco filtrato
   * per libretto non li mostrasse, il saldo e la lista direbbero due cose
   * diverse sulla stessa cassa — e la lista sembrerebbe incompleta senza che
   * nessuno possa dire perché.
   */
  it("**per conto, e un giroconto si vede da tutti e due i capi**", () => {
    expect(filtraRegistro(REGISTRO, { ...base, contoId: "a" }).map((m) => m.id)).toEqual([
      "4", "2", "1",
    ]);
    expect(filtraRegistro(REGISTRO, { ...base, contoId: "b" }).map((m) => m.id)).toEqual([
      "5", "4", "3",
    ]);
  });

  it("e la misura al contrario: un conto che non c'entra non trova niente", () => {
    expect(filtraRegistro(REGISTRO, { ...base, contoId: "z" })).toEqual([]);
    expect(riguardaIlConto(REGISTRO[3], "z")).toBe(false);
  });

  it("i filtri si sommano", () => {
    expect(
      filtraRegistro(REGISTRO, { ...base, mese: 3, tipo: "giroconto", contoId: "b" }).map((m) => m.id),
    ).toEqual(["4"]);
  });

  it("i mesi offerti sono quelli che hanno qualcosa", () => {
    expect(mesiConMovimenti(REGISTRO, 2026)).toEqual([1, 2, 3]);
    expect(mesiConMovimenti(REGISTRO, 2025)).toEqual([12]);
    expect(mesiConMovimenti(REGISTRO, 2024)).toEqual([]);
  });
});

/**
 * La ricerca per testo: trovare una riga che si ricorda a memoria.
 *
 * Con qualche centinaio di movimenti, filtrare per mese e tipo e scorrere a
 * occhio non basta. Il confronto passa dallo stesso normalizzatore del
 * dizionario, quindi quello che si trova scrivendo è quello che si vede
 * scritto — accenti e punteggiatura compresi.
 */
describe("la ricerca nella descrizione", () => {
  const CON_TESTO: MovimentoPf[] = [
    mov({ id: "t1", data: "2026-01-10", tipo: "entrata", importo: 394, descrizione: "Giroconto dal cc n. 6098032" }),
    mov({ id: "t2", data: "2026-01-11", importo: 12, descrizione: "CAFFE' CENTRALE" }),
    mov({ id: "t3", data: "2026-02-11", importo: 30, descrizione: "Supermercato" }),
  ];
  const cerca = (testo: string, extra = {}) =>
    filtraRegistro(CON_TESTO, { ...FILTRO_VUOTO(2026), testo, ...extra }).map((m) => m.id);

  it("**trova senza accenti e senza maiuscole**", () => {
    expect(cerca("caffè")).toEqual(["t2"]);
    expect(cerca("CAFFE")).toEqual(["t2"]);
    expect(cerca("caffe centrale")).toEqual(["t2"]);
  });

  /* La punteggiatura sparisce da tutte e due le parti: «n. 6098032» si trova
     scrivendo il numero, che è come uno se lo ricorda. */
  it("e il numero di conto dentro la formula della banca", () => {
    expect(cerca("6098032")).toEqual(["t1"]);
    expect(cerca("giroconto")).toEqual(["t1"]);
  });

  it("vuoto non filtra niente", () => {
    expect(cerca("")).toEqual(["t3", "t2", "t1"]);
    expect(cerca("   ")).toEqual(["t3", "t2", "t1"]);
  });

  it("quello che non c'è non si trova, e non si inventa", () => {
    expect(cerca("esselunga")).toEqual([]);
  });

  /*
    E si combina **in e** con gli altri filtri: una ricerca che scavalcasse il
    mese mostrerebbe righe fuori dal periodo che si sta guardando, cioè
    risponderebbe a una domanda diversa da quella sullo schermo.
  */
  it("vale insieme agli altri filtri, non al loro posto", () => {
    expect(cerca("o", { mese: 2 })).toEqual(["t3"]);
    expect(cerca("giroconto", { mese: 2 })).toEqual([]);
    expect(cerca("giroconto", { tipo: "spesa" })).toEqual([]);
  });
});

describe("i totali del registro", () => {
  const dellAnno = filtraRegistro(REGISTRO, FILTRO_VUOTO(2026));

  it("entrate e uscite hanno il loro nome", () => {
    const t = totaliRegistro(dellAnno, null);
    expect(t.quanti).toBe(5);
    expect(t.entrate).toBe(2_000);
    expect(t.uscite).toBe(950);
    expect(t.netto).toBe(1_050);
  });

  /*
    E le entrate restano intere anche quando una di loro era già tua: sul conto
    quei soldi sono arrivati davvero, e il registro racconta il conto. Quello
    che cambia è che la cifra si dichiara a parte — senza, il registro direbbe
    un numero e il limite del mese ne userebbe un altro, e la differenza non
    avrebbe nessuna spiegazione a portata d'occhio.
  */
  it("un'entrata arrivata da un altro tuo conto resta nelle entrate, ma si dichiara", () => {
    const marcate = dellAnno.map((m) =>
      m.tipo === "entrata" ? { ...m, daUnAltroTuoConto: true } : m,
    );
    const t = totaliRegistro(marcate, null);
    expect(t.entrate).toBe(2_000);
    expect(t.trasferimenti).toBe(2_000);
    expect(totaliRegistro(dellAnno, null).trasferimenti).toBe(0);
  });

  it("**il giroconto non entra nei totali: non entra né esce niente**", () => {
    const soloGiro = filtraRegistro(REGISTRO, { ...FILTRO_VUOTO(2026), tipo: "giroconto" });
    const t = totaliRegistro(soloGiro, null);
    expect(t.quanti).toBe(1);
    expect(t.entrate).toBe(0);
    expect(t.uscite).toBe(0);
    expect(t.netto).toBe(0);
  });

  it("senza un conto scelto l'effetto non si calcola, perché non vorrebbe dire niente", () => {
    expect(totaliRegistro(dellAnno, null).effettoSulConto).toBeNull();
  });

  /**
   * **L'effetto sul conto è quello che il saldo conta.**
   *
   * Questo test lega il registro al saldo: se un giorno le due funzioni
   * leggessero i giroconti in modo diverso, la somma qui sotto e il saldo del
   * conto smetterebbero di coincidere, ed è esattamente il difetto che
   * nessuno si accorgerebbe di avere.
   */
  it("**con un conto scelto, coincide con quello che muove il saldo**", () => {
    const conto: ContoPersonale = {
      id: "b", nome: "Libretto", tipo: "deposito",
      saldoRiferimento: 5_000, dataRiferimento: "2025-12-31", professionale: false,
    };
    const suoi = filtraRegistro(REGISTRO, { ...FILTRO_VUOTO(2026), contoId: "b" });
    const t = totaliRegistro(suoi, "b");
    expect(t.effettoSulConto).toBe(350);
    expect(saldoConto(conto, REGISTRO)).toBe(5_000 + 350);
  });
});
