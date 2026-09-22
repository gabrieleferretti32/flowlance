import { describe, expect, it } from "vitest";
import { quantoResta, tabellaLimite, type IngressoLimite } from "./limite";
import type { CategoriaPf, MovimentoPf } from "./tipi";

const cat = (p: Partial<CategoriaPf> & { id: string; tipo: CategoriaPf["tipo"] }): CategoriaPf => ({
  nome: p.id, fissa: false, pagataDallAccantonamento: false, arrivaDallAttivita: false, ...p,
});

const CATEGORIE: CategoriaPf[] = [
  cat({ id: "stipendio", tipo: "entrata", nome: "Fatture incassate" }),
  cat({ id: "affitto", tipo: "spesa", nome: "Affitto", fissa: true }),
  cat({ id: "spesa", tipo: "spesa", nome: "Spesa alimentare" }),
  cat({ id: "pac", tipo: "risparmio", nome: "PAC" }),
  cat({ id: "auto", tipo: "rata", nome: "Rata auto" }),
  /*
    Le tasse: una spesa fissa a tutti gli effetti — esce dal conto a scadenza
    fissa — ma già coperta dall'accantonamento, quindi fuori dal limite.
  */
  cat({ id: "f24", tipo: "spesa", nome: "F24", fissa: true, pagataDallAccantonamento: true }),
];

const mov = (
  p: Partial<MovimentoPf> & { id: string; data: string; importo: number; categoriaId: string },
): MovimentoPf => ({ tipo: "spesa", contoId: "a", descrizione: "", ...p });

const base = (p: Partial<IngressoLimite> = {}): IngressoLimite => ({
  anno: 2026,
  meseCorrente: 12,
  movimenti: [],
  categorie: CATEGORIE,
  budget: [],
  accantonamentoMensile: 0,
  riportoAttivo: false,
  ...p,
});

/**
 * Il caso con i numeri scritti a mano, come chiede il brief.
 *
 * 4.000 di entrate, 1.200 di accantonamento fiscale, 900 di affitto, 200 di
 * PAC, 250 di rata: restano **1.450** da spendere. È l'unica riga del modulo
 * che una persona guarderà per decidere se uscire a cena, e il conto va fatto
 * in quest'ordine — il fisco per primo.
 */
describe("**il limite: entrate meno accantonamento, fisse, risparmi e rate**", () => {
  const gennaio = [
    mov({ id: "e", data: "2026-01-10", importo: 4_000, categoriaId: "stipendio", tipo: "entrata" }),
    mov({ id: "a", data: "2026-01-05", importo: 900, categoriaId: "affitto" }),
    mov({ id: "p", data: "2026-01-06", importo: 200, categoriaId: "pac", tipo: "risparmio" }),
    mov({ id: "r", data: "2026-01-07", importo: 250, categoriaId: "auto", tipo: "rata" }),
  ];

  it("fa 1.450", () => {
    const riga = tabellaLimite(base({ movimenti: gennaio, accantonamentoMensile: 1_200 }))[0];
    expect(riga).toMatchObject({
      entrate: 4_000, accantonamento: 1_200, fisse: 900, risparmi: 200, rate: 250, limite: 1_450,
    });
  });

  it("e «resta» toglie quello che si è già speso in variabili", () => {
    const conSpesa = [
      ...gennaio,
      mov({ id: "s", data: "2026-01-20", importo: 300, categoriaId: "spesa" }),
    ];
    const riga = tabellaLimite(base({ movimenti: conSpesa, accantonamentoMensile: 1_200 }))[0];
    expect(riga.speso).toBe(300);
    expect(riga.resta).toBe(1_150);
  });

  it("i giroconti non entrano né nelle entrate né nelle spese", () => {
    const conGiroconto = [
      ...gennaio,
      mov({
        id: "g", data: "2026-01-15", importo: 1_000, categoriaId: "stipendio",
        tipo: "giroconto", contoDestinazioneId: "b",
      }),
    ];
    const riga = tabellaLimite(base({ movimenti: conGiroconto, accantonamentoMensile: 1_200 }))[0];
    expect(riga.entrate).toBe(4_000);
    expect(riga.limite).toBe(1_450);
  });
});

describe("**l'accantonamento fiscale non si ricalcola qui**", () => {
  it("è quello che arriva, qualunque sia", () => {
    for (const a of [0, 1_200, 3_333.33]) {
      const riga = tabellaLimite(base({ accantonamentoMensile: a }))[0];
      expect(riga.accantonamento, `${a}`).toBe(a);
    }
  });

  it("**se supera le entrate il limite è negativo, e resta negativo**", () => {
    /*
      Azzerarlo direbbe «non puoi spendere niente» a chi in realtà ha già
      speso più di quanto poteva: sono due situazioni diverse, e la seconda è
      quella in cui serve saperlo.
    */
    const riga = tabellaLimite(base({
      movimenti: [mov({ id: "e", data: "2026-01-10", importo: 1_000, categoriaId: "stipendio", tipo: "entrata" })],
      accantonamentoMensile: 1_500,
    }))[0];
    expect(riga.limite).toBe(-500);
    expect(riga.resta).toBe(-500);
  });
});

describe("i mesi senza movimenti", () => {
  const soloGennaio = [
    mov({ id: "e", data: "2026-01-10", importo: 3_000, categoriaId: "stipendio", tipo: "entrata" }),
  ];

  it("**un mese passato e vuoto non genera riporto**", () => {
    /*
      Febbraio senza movimenti non è un mese in cui non è successo niente: è un
      mese non ancora importato. Trattarlo come un avanzo pieno regalerebbe a
      marzo un limite che non esiste.
    */
    const righe = tabellaLimite(base({
      movimenti: soloGennaio, meseCorrente: 12, riportoAttivo: true,
    }));
    expect(righe[1].conMovimenti).toBe(false);
    expect(righe[2].riporto).toBe(0);
  });

  it("un mese con movimenti sì", () => {
    const righe = tabellaLimite(base({
      movimenti: soloGennaio, meseCorrente: 12, riportoAttivo: true,
    }));
    expect(righe[0].conMovimenti).toBe(true);
    expect(righe[1].riporto).toBe(righe[0].resta);
  });

  it("e con il riporto spento non riporta niente", () => {
    const righe = tabellaLimite(base({
      movimenti: soloGennaio, meseCorrente: 12, riportoAttivo: false,
    }));
    expect(righe[1].riporto).toBe(0);
  });
});

describe("previsto e stimato", () => {
  it("il budget vince sulla media, e non è una stima", () => {
    const righe = tabellaLimite(base({
      anno: 2026, meseCorrente: 1,
      budget: [{ categoriaId: "stipendio", anno: 2026, importi: Array(12).fill(5_000) }],
    }));
    expect(righe[5].entrate).toBe(5_000);
    expect(righe[5].stimate).not.toContain("entrate");
  });

  it("**senza budget si usa la media dei mesi con movimenti, e si dichiara**", () => {
    const righe = tabellaLimite(base({
      meseCorrente: 3,
      movimenti: [
        mov({ id: "1", data: "2026-01-10", importo: 2_000, categoriaId: "stipendio", tipo: "entrata" }),
        mov({ id: "2", data: "2026-02-10", importo: 4_000, categoriaId: "stipendio", tipo: "entrata" }),
      ],
    }));
    expect(righe[5].entrate).toBe(3_000);
    expect(righe[5].stimate).toContain("entrate");
  });

  it("nel mese in corso vale il maggiore fra incassato e previsto", () => {
    const comune = {
      meseCorrente: 2,
      budget: [{ categoriaId: "stipendio", anno: 2026, importi: Array(12).fill(3_000) }],
    };
    const poco = tabellaLimite(base({
      ...comune,
      movimenti: [mov({ id: "1", data: "2026-02-03", importo: 500, categoriaId: "stipendio", tipo: "entrata" })],
    }))[1];
    const molto = tabellaLimite(base({
      ...comune,
      movimenti: [mov({ id: "1", data: "2026-02-03", importo: 4_500, categoriaId: "stipendio", tipo: "entrata" })],
    }))[1];
    expect(poco.entrate).toBe(3_000);
    expect(molto.entrate).toBe(4_500);
  });
});

describe("quanto resta al giorno", () => {
  const riga = tabellaLimite(base({
    movimenti: [mov({ id: "e", data: "2026-09-01", importo: 1_000, categoriaId: "stipendio", tipo: "entrata" })],
    meseCorrente: 9,
  }))[8];

  it("divide per i giorni che mancano, oggi compreso", () => {
    const r = quantoResta(riga, "2026-09-21");
    expect(r.giorniRimasti).toBe(10);
    expect(r.alGiorno).toBe(100);
  });

  it("**sotto zero non divide**: «−12 € al giorno» non è un'istruzione", () => {
    const rosso = { ...riga, limite: -200, resta: -200 };
    expect(quantoResta(rosso, "2026-09-21").alGiorno).toBe(0);
  });

  it("l'ultimo giorno del mese è un giorno, non zero", () => {
    expect(quantoResta(riga, "2026-09-30").giorniRimasti).toBe(1);
  });
});

/**
 * I due casi che il confronto con il prototipo ha scoperto.
 *
 * La prima stesura di `limite.ts` era stata scritta dalla descrizione del
 * brief, senza il prototipo — che è arrivato dopo. Passava tutti i test che
 * aveva, e sbagliava due cose: applicava «il maggiore fra reale e previsto»
 * alle sole entrate, e lasciava che l'avanzo del mese in corso si riversasse
 * sui mesi successivi. Nessuno dei test di sopra le vedeva, il che è il motivo
 * per cui questi stanno qui.
 */
describe("**le due cose che i test di prima non vedevano**", () => {
  it("nel mese in corso anche le uscite prendono il maggiore fra reale e previsto", () => {
    /*
      L'affitto di questo mese è già uscito e costa 950, a budget ne stavano
      900. Contare 900 direbbe a una persona che ha cinquanta euro che non ha.
    */
    const righe = tabellaLimite(base({
      meseCorrente: 1,
      budget: [
        { categoriaId: "stipendio", anno: 2026, importi: Array(12).fill(3_000) },
        { categoriaId: "affitto", anno: 2026, importi: Array(12).fill(900) },
      ],
      movimenti: [mov({ id: "a", data: "2026-01-05", importo: 950, categoriaId: "affitto" })],
    }));
    expect(righe[0].fisse).toBe(950);
    expect(righe[0].limite).toBe(3_000 - 950);
  });

  it("e il previsto vince quando la spesa fissa non è ancora uscita", () => {
    const righe = tabellaLimite(base({
      meseCorrente: 1,
      budget: [{ categoriaId: "affitto", anno: 2026, importi: Array(12).fill(900) }],
      movimenti: [mov({ id: "e", data: "2026-01-02", importo: 10, categoriaId: "stipendio", tipo: "entrata" })],
    }));
    expect(righe[0].fisse).toBe(900);
  });

  it("**l'avanzo del mese in corso non si riversa sul mese dopo**", () => {
    /*
      A metà settembre «resta 800» non è un avanzo: mancano quindici giorni di
      spese. Passarlo a ottobre sarebbe contare prima che esista, e la tabella
      se lo porterebbe fino a dicembre.
    */
    const righe = tabellaLimite(base({
      meseCorrente: 9,
      riportoAttivo: true,
      movimenti: [
        mov({ id: "e", data: "2026-09-01", importo: 2_000, categoriaId: "stipendio", tipo: "entrata" }),
      ],
    }));
    expect(righe[8].resta).toBeGreaterThan(0);
    expect(righe[9].riporto).toBe(0);
    expect(righe[11].riporto).toBe(0);
  });

  it("mentre quello di un mese passato e importato sì, fino al mese in corso", () => {
    const righe = tabellaLimite(base({
      meseCorrente: 3,
      riportoAttivo: true,
      movimenti: [
        mov({ id: "e1", data: "2026-01-10", importo: 2_000, categoriaId: "stipendio", tipo: "entrata" }),
        mov({ id: "s1", data: "2026-01-12", importo: 500, categoriaId: "spesa" }),
        mov({ id: "e2", data: "2026-02-10", importo: 2_000, categoriaId: "stipendio", tipo: "entrata" }),
      ],
    }));
    expect(righe[0].conMovimenti).toBe(true);
    expect(righe[1].riporto).toBe(righe[0].resta);
    expect(righe[2].riporto).toBe(righe[1].resta);
  });
});

/**
 * Le tasse non si contano due volte.
 *
 * L'accantonamento mensile mette da parte ogni mese la quota del fisco. Quando
 * a giugno esce l'F24, quei soldi **erano già stati tolti**: sono la
 * destinazione del risparmio, non una spesa nuova. Contarli anche come spesa
 * farebbe crollare il limite proprio nei due mesi — giugno e novembre — in cui
 * il denaro c'era già, e direbbe a una persona che non può spendere niente
 * mentre sta pagando con soldi accantonati apposta.
 *
 * Il saldo del conto invece scende davvero, e deve scendere: `saldo.ts` non
 * sa niente di questo flag. È la differenza fra «quanto ho» e «quanto di
 * quello che ho è mio».
 */
describe("**l'F24 di giugno non abbassa il limite**", () => {
  const entrateOgniMese = Array.from({ length: 12 }, (_, m) =>
    mov({
      id: `e${m}`, data: `2026-${String(m + 1).padStart(2, "0")}-10`,
      importo: 4_000, categoriaId: "stipendio", tipo: "entrata",
    }),
  );
  const f24Giugno = mov({
    id: "f24", data: "2026-06-30", importo: 3_500, categoriaId: "f24",
  });

  it("giugno ha lo stesso limite degli altri mesi", () => {
    const righe = tabellaLimite(base({
      movimenti: [...entrateOgniMese, f24Giugno],
      accantonamentoMensile: 1_200,
      meseCorrente: 12,
    }));
    const giugno = righe[5];
    const maggio = righe[4];
    expect(giugno.fisse).toBe(0);
    expect(giugno.limite).toBe(maggio.limite);
    expect(giugno.limite).toBe(4_000 - 1_200);
  });

  it("e non entra nemmeno fra le variabili: «speso» resta a zero", () => {
    const righe = tabellaLimite(base({
      movimenti: [...entrateOgniMese, f24Giugno],
      accantonamentoMensile: 1_200,
      meseCorrente: 12,
    }));
    expect(righe[5].speso).toBe(0);
    expect(righe[5].resta).toBe(righe[5].limite);
  });

  it("**la misura vede la differenza**: senza il flag il limite crollerebbe", () => {
    /*
      Il verso opposto, perché «giugno è uguale a maggio» sarebbe vero anche se
      il movimento non fosse stato letto affatto. Qui la stessa identica riga,
      con la categoria non più coperta, deve far scendere il limite di 3.500.
    */
    const senzaFlag = CATEGORIE.map((c) =>
      c.id === "f24" ? { ...c, pagataDallAccantonamento: false } : c,
    );
    const righe = tabellaLimite(base({
      categorie: senzaFlag,
      movimenti: [...entrateOgniMese, f24Giugno],
      accantonamentoMensile: 1_200,
      meseCorrente: 12,
    }));
    expect(righe[5].fisse).toBe(3_500);
    expect(righe[5].limite).toBe(4_000 - 1_200 - 3_500);
  });

  it("lo stesso F24 catalogato come «rata» resta fuori lo stesso", () => {
    /*
      Chi importa da banca può ritrovarsi l'F24 in una categoria di tipo
      diverso. Il flag lo toglie da tutti e quattro i gruppi, non dai soli
      due nominati nella correzione: lo stesso doppio conteggio da un'altra
      porta nessuno andrebbe a cercarlo.
    */
    const comeRata = CATEGORIE.map((c) => (c.id === "f24" ? { ...c, tipo: "rata" as const } : c));
    const righe = tabellaLimite(base({
      categorie: comeRata,
      movimenti: [...entrateOgniMese, f24Giugno],
      accantonamentoMensile: 1_200,
      meseCorrente: 12,
    }));
    expect(righe[5].rate).toBe(0);
    expect(righe[5].limite).toBe(4_000 - 1_200);
  });

  it("ma i soldi escono dal conto davvero", async () => {
    const { saldoConto } = await import("./saldo");
    const conto = {
      id: "a", nome: "Conto", tipo: "corrente" as const,
      saldoRiferimento: 10_000, dataRiferimento: "2026-06-01", professionale: true,
    };
    expect(saldoConto(conto, [{ ...f24Giugno, contoId: "a" }])).toBe(6_500);
  });
});
