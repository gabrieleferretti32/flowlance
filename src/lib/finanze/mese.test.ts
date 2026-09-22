import { describe, expect, it } from "vitest";
import { catenaAnni } from "@/lib/analisi/anno";
import { datiVetrina } from "@/lib/dati/vetrina";
import { round2 } from "@/lib/fisco/aritmetica";
import { situazioneDelMese } from "./mese";
import { dodiciMesi } from "./budget";
import type { BudgetPf, CategoriaPf, ContoPersonale, MovimentoPf } from "./tipi";

/*
  Si passa da `catenaAnni`, la stessa porta da cui passa il cruscotto: un test
  che costruisce il prospetto a mano prova un percorso che l'app non fa. È la
  lezione scritta in testa ad `accantonamento.test.ts`, e vale doppio qui,
  dove il numero in uscita è «quanto puoi spendere».
*/
const OGGI = "2026-09-20";
const d = datiVetrina();
const catena = catenaAnni(
  {
    impostazioni: d.impostazioni,
    fatture: d.fatture,
    note: d.note,
    costi: d.costi,
    versamenti: d.versamenti,
    movimentiAttivita: d.movimentiAttivita,
    movimentiPersonali: d.movimentiPersonali,
    chiusure: d.chiusure,
  },
  2026,
  OGGI,
);

const CATEGORIE: CategoriaPf[] = [
  { id: "fatture", tipo: "entrata", nome: "Fatture incassate", fissa: false, pagataDallAccantonamento: false, arrivaDallAttivita: true },
  { id: "spesa", tipo: "spesa", nome: "Spesa alimentare", fissa: false, pagataDallAccantonamento: false, arrivaDallAttivita: false },
  { id: "casa", tipo: "spesa", nome: "Affitto", fissa: true, pagataDallAccantonamento: false, arrivaDallAttivita: false },
];

const CONTO: ContoPersonale = {
  id: "c1",
  nome: "Conto",
  tipo: "corrente",
  saldoRiferimento: 12_000,
  dataRiferimento: "2026-09-01",
  professionale: false,
};

const situazione = (extra: {
  movimenti?: MovimentoPf[];
  budget?: BudgetPf[];
  conti?: ContoPersonale[];
  cuscinetto?: number;
}) =>
  situazioneDelMese({
    anno: 2026,
    oggi: OGGI,
    calcolo: catena.get(2026)!,
    precedente: catena.get(2025) ?? null,
    versamenti: d.versamenti,
    conti: extra.conti ?? [CONTO],
    movimenti: extra.movimenti ?? [],
    categorie: CATEGORIE,
    budget: extra.budget ?? [],
    impostazioniPf:
      extra.cuscinetto === undefined
        ? null
        : { id: "unico", cuscinetto: extra.cuscinetto, riportoAttivo: true },
  });

const mov = (categoriaId: string, data: string, importo: number, tipo: MovimentoPf["tipo"]): MovimentoPf => ({
  id: `${categoriaId}-${data}`,
  data,
  tipo,
  categoriaId,
  contoId: "c1",
  importo,
  descrizione: "",
});

describe("il mese guardato", () => {
  it("è quello di `oggi`, non il primo della tabella", () => {
    const s = situazione({});
    expect(s.meseCorrente).toBe(9);
    expect(s.riga.mese).toBe(9);
    expect(s.righe).toHaveLength(12);
  });

  it("senza impostazioni del modulo vale il predefinito: nessun cuscinetto", () => {
    expect(situazione({}).impostazioni.cuscinetto).toBe(0);
    expect(situazione({}).impostazioni.riportoAttivo).toBe(true);
  });
});

describe("**un mese senza movimenti e senza budget non è un mese a zero**", () => {
  it("sul registro vuoto lo dichiara, invece di calcolare un limite negativo", () => {
    const s = situazione({});
    expect(s.meseSenzaDati).toBe(true);
    /*
      Era il difetto: con il motore fiscale pieno e il registro vuoto, il
      limite del mese usciva negativo — l'accantonamento sottratto a zero
      entrate. Il numero esiste ancora, ma la schermata sa di non doverlo
      mostrare.
    */
    expect(s.riga.limite).toBeLessThan(0);
  });

  it("un movimento nel mese lo riaccende", () => {
    const s = situazione({ movimenti: [mov("spesa", "2026-09-04", 80, "spesa")] });
    expect(s.meseSenzaDati).toBe(false);
    expect(s.riga.conMovimenti).toBe(true);
  });

  it("**anche un budget scritto per quel mese lo riaccende, senza nessun movimento**", () => {
    const s = situazione({ budget: [{ categoriaId: "spesa", anno: 2026, importi: dodiciMesi(400) }] });
    expect(s.meseSenzaDati).toBe(false);
    expect(s.riga.conMovimenti).toBe(false);
  });

  it("ma un budget di un altro anno no", () => {
    const s = situazione({ budget: [{ categoriaId: "spesa", anno: 2025, importi: dodiciMesi(400) }] });
    expect(s.meseSenzaDati).toBe(true);
  });
});

describe("il tetto dal conto", () => {
  it("toglie dal saldo il cuscinetto, gli impegni e **il fisco non ancora versato**", () => {
    const s = situazione({ cuscinetto: 1_000 });
    const fisco = round2(s.quota.imposte.daAccantonare + s.quota.iva.daAccantonare);
    expect(fisco).toBeGreaterThan(0);
    expect(s.tetto.fiscoNonVersato).toBe(fisco);
    expect(s.tetto.tetto).toBe(
      round2(12_000 - 1_000 - s.tetto.impegniDelMese - fisco),
    );
  });

  it("il cuscinetto scende dal tetto euro per euro", () => {
    const senza = situazione({ cuscinetto: 0 }).tetto.tetto;
    const con = situazione({ cuscinetto: 1_000 }).tetto.tetto;
    expect(round2(senza - con)).toBe(1_000);
  });

  it("senza conti il saldo è zero, e il tetto è negativo quanto il fisco da versare", () => {
    const s = situazione({ conti: [] });
    expect(s.tetto.saldoConti).toBe(0);
    expect(s.tetto.tetto).toBeLessThan(0);
  });
});

describe("chi dei due vincoli decide", () => {
  const conEntrate = (saldo: number) => {
    const conto = { ...CONTO, saldoRiferimento: saldo };
    return situazione({
      conti: [conto],
      movimenti: [mov("fatture", "2026-09-02", 9_000, "entrata"), mov("casa", "2026-09-03", 900, "spesa")],
    });
  };

  it("con il conto pieno decide il mese", () => {
    const s = conEntrate(90_000);
    expect(s.effettivo.vincolo).toBe("mese");
    expect(s.effettivo.limite).toBe(s.dalMese.resta);
  });

  it("con il conto quasi vuoto decide il conto, e la differenza si può dire", () => {
    const s = conEntrate(1_000);
    expect(s.effettivo.vincolo).toBe("conto");
    expect(s.effettivo.limite).toBeLessThan(s.dalMese.resta);
    expect(s.effettivo.differenza).toBe(round2(s.dalMese.resta - s.effettivo.limite));
  });
});
