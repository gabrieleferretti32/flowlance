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
  /**
   * Chi paga il fisco. **Predefinito «personale»**, e non «quello che i
   * segnali misurano».
   *
   * Questi test studiano la sottrazione della quota, e l'archivio su cui
   * girano è la vetrina — dove gli F24 li paga il conto dell'attività. Senza
   * questo valore di partenza la quota non si toglierebbe, e mezza dozzina di
   * test misurerebbe zero contro zero passando lo stesso. `null` per chiedere
   * il comportamento senza dichiarazione.
   */
  fiscoPagatoDa?: "attivita" | "personale" | null;
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
    impostazioniPf: {
      id: "unico",
      cuscinetto: extra.cuscinetto ?? 0,
      riportoAttivo: true,
      fiscoPagatoDa: extra.fiscoPagatoDa === undefined ? "personale" : extra.fiscoPagatoDa,
    },
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

describe("**un mese con movimenti ma senza entrate registrate**", () => {
  /*
    È il caso di chi carica solo la carta di credito: di quel mese si sanno le
    uscite e non gli incassi. Il limite esce negativo — l'accantonamento
    sottratto a zero — e quel numero non è un limite.
  */
  const soloUscite = [mov("spesa", "2026-09-04", 80, "spesa"), mov("casa", "2026-09-05", 900, "spesa")];

  it("si dichiara, e non è lo stesso caso del mese senza dati", () => {
    const s = situazione({ movimenti: soloUscite });
    expect(s.meseSenzaDati).toBe(false);
    expect(s.meseSenzaEntrate).toBe(true);
    expect(s.riga.limite).toBeLessThan(0);
  });

  it("e la misura vede la differenza: con un'entrata registrata si spegne", () => {
    const s = situazione({
      movimenti: [...soloUscite, mov("fatture", "2026-09-02", 3_000, "entrata")],
    });
    expect(s.meseSenzaEntrate).toBe(false);
  });

  it("anche una previsione di entrate a budget lo spegne: un'entrata prevista è un'entrata", () => {
    const s = situazione({
      movimenti: soloUscite,
      budget: [{ categoriaId: "fatture", anno: 2026, importi: dodiciMesi(3_000) }],
    });
    expect(s.riga.entrate).toBe(3_000);
    expect(s.meseSenzaEntrate).toBe(false);
  });

  it("un mese senza nessun movimento non è «senza entrate»: è senza dati", () => {
    const s = situazione({});
    expect(s.meseSenzaDati).toBe(true);
    expect(s.meseSenzaEntrate).toBe(false);
  });
});

describe("il riporto che arriva da un mese importato a metà", () => {
  it("**si dichiara**: agosto con la sola spesa abbassa il limite di settembre", () => {
    const s = situazione({
      movimenti: [
        mov("spesa", "2026-08-10", 260, "spesa"),
        mov("fatture", "2026-09-02", 9_000, "entrata"),
      ],
    });
    expect(s.riga.riporto).toBeLessThan(0);
    expect(s.riportoDaMeseSenzaEntrate).toBe(true);
  });

  it("e non si dichiara quando il mese prima le entrate ce le aveva", () => {
    const s = situazione({
      movimenti: [
        mov("fatture", "2026-08-01", 9_000, "entrata"),
        mov("spesa", "2026-08-10", 260, "spesa"),
        mov("fatture", "2026-09-02", 9_000, "entrata"),
      ],
    });
    expect(s.riga.riporto).toBeGreaterThan(0);
    expect(s.riportoDaMeseSenzaEntrate).toBe(false);
  });
});

/**
 * La conseguenza della domanda «gli F24 da quale conto li paghi?».
 *
 * Se le paga il conto dell'attività, il prelievo che arriva sul conto
 * personale è già netto del fisco: toglierne di nuovo la quota la
 * toglierebbe due volte. Misurato sulla vetrina prima che questa domanda
 * esistesse, il limite di settembre diceva −9.753,05 € e 9.238,05 € di quel
 * rosso erano solo la doppia sottrazione.
 *
 * `quota` non cambia mai: è la cifra del cruscotto, e l'attività quei soldi
 * li deve comunque. Quello che cambia è se il **limite** la sottrae.
 */
describe("chi paga il fisco cambia il limite, non la quota", () => {
  const entrate = [mov("fatture", "2026-09-03", 2_000, "entrata")];

  it("se lo paga questo conto, la quota si toglie — come ha sempre fatto", () => {
    const s = situazione({ movimenti: entrate });
    expect(s.fisco.chiPaga).toBe("personale");
    expect(s.riga.accantonamento).toBe(s.quota.alMese);
    expect(s.quota.alMese).toBeGreaterThan(0);
  });

  it("se lo paga l'attività, il limite non la toglie più", () => {
    const s = situazione({ movimenti: entrate, fiscoPagatoDa: "attivita" });
    expect(s.riga.accantonamento).toBe(0);
    expect(s.fisco.accantonamentoApplicato).toBe(0);
    /* Ma la quota resta quella vera: la card del cruscotto non si muove. */
    expect(s.quota.alMese).toBeGreaterThan(0);
  });

  it("e la differenza fra i due limiti è esattamente la quota", () => {
    const con = situazione({ movimenti: entrate, fiscoPagatoDa: "personale" });
    const senza = situazione({ movimenti: entrate, fiscoPagatoDa: "attivita" });
    expect(round2(senza.riga.limite - con.riga.limite)).toBe(round2(con.quota.alMese));
  });

  /*
    L'altro lato della stessa cosa. Il tetto toglie dal saldo il fisco non
    ancora versato perché quei soldi sono in banca e non sono tuoi: se li
    paga l'attività, su questo conto non ci sono mai stati.
  */
  it("e nemmeno il tetto toglie più dal saldo il fisco da versare", () => {
    const s = situazione({ movimenti: entrate, fiscoPagatoDa: "attivita" });
    expect(s.tetto.fiscoNonVersato).toBe(0);
    expect(s.tetto.tetto).toBe(
      round2(s.tetto.saldoConti - s.tetto.cuscinetto - s.tetto.impegniDelMese),
    );
  });

  /*
    Senza dichiarazione decidono i segnali, e su questo archivio — la vetrina,
    dove gli F24 del 2026 risultano pagati dal conto personale — dicono
    «questo conto». Il ripiego prudente, quando nemmeno i segnali sanno dire,
    sta in `chi-paga-il-fisco.test.ts`.
  */
  it("senza dichiarazione vale quello che i segnali misurano", () => {
    const s = situazione({ movimenti: entrate, fiscoPagatoDa: null });
    expect(s.fisco.fonte).toBe("misurato");
    expect(s.fisco.chiPaga).toBe("attivita");
    expect(s.riga.accantonamento).toBe(0);
  });

  /*
    E una dichiarazione contraria ai segnali non viene ignorata: vince lei —
    è chi usa l'app che sa come paga — ma la schermata lo dice, invece di
    tenersi una contraddizione muta.
  */
  it("una dichiarazione contraria ai segnali vince, e risulta contraddetta", () => {
    const s = situazione({ movimenti: entrate, fiscoPagatoDa: "personale" });
    expect(s.fisco.chiPaga).toBe("personale");
    expect(s.fisco.lettura.misurato).toBe("attivita");
    expect(s.fisco.contraddetta).toBe(true);
  });
});
