import { describe, expect, it } from "vitest";
import {
  appuntamentiFiscali,
  divario,
  mesiFinoA,
  prossimaOccorrenza,
  type IngressoAppuntamenti,
} from "./appuntamenti";
import { INGRESSO_INIZIALE, simula, ANNO } from "./simulatore";
import type { Regime } from "@/lib/fisco/tipi";

const GIUGNO = `${ANNO}-06-30`;
const NOVEMBRE = `${ANNO}-11-30`;

function ingresso(parziale: Partial<IngressoAppuntamenti> = {}): IngressoAppuntamenti {
  return {
    carico: 11_593.76,
    acconti: { dovuti: true, primo: 4_637.51, secondo: 5_329.48 },
    dataGiugno: GIUGNO,
    dataNovembre: NOVEMBRE,
    primoAnno: false,
    oggi: `${ANNO}-10-01`,
    ...parziale,
  };
}

describe("prossimaOccorrenza", () => {
  it("resta nell'anno quando la data non è ancora passata", () => {
    expect(prossimaOccorrenza("2026-11-30", "2026-10-01")).toEqual({
      data: "2026-11-30",
      anno: 2026,
      rinviata: false,
    });
  });

  it("passa all'anno dopo quando è passata, e lo dice", () => {
    expect(prossimaOccorrenza("2026-06-30", "2026-10-01")).toEqual({
      data: "2027-06-30",
      anno: 2027,
      rinviata: true,
    });
  });

  it("il giorno stesso non è passato: si versa oggi", () => {
    expect(prossimaOccorrenza("2026-11-30", "2026-11-30")).toEqual({
      data: "2026-11-30",
      anno: 2026,
      rinviata: false,
    });
  });

  it("il giorno dopo sì", () => {
    expect(prossimaOccorrenza("2026-11-30", "2026-12-01").data).toBe("2027-11-30");
  });

  /*
    La prova che conta per chi apre la pagina a dicembre: il 30 novembre non
    esiste più, e quello che si mostra è il 30 giugno dell'anno nuovo. Senza
    questa funzione la pagina mostrava una data passata.
  */
  it("a dicembre, sia giugno sia novembre finiscono nell'anno dopo", () => {
    expect(prossimaOccorrenza(GIUGNO, "2026-12-15").data).toBe("2027-06-30");
    expect(prossimaOccorrenza(NOVEMBRE, "2026-12-15").data).toBe("2027-11-30");
  });

  it("il 29 febbraio si schiaccia sul 28 quando l'anno non è bisestile", () => {
    expect(prossimaOccorrenza("2028-02-29", "2027-01-10").data).toBe("2027-02-28");
    expect(prossimaOccorrenza("2028-02-29", "2028-01-10").data).toBe("2028-02-29");
  });

  it("gli anni secolari non bisestili non fanno comparire un 29 febbraio", () => {
    expect(prossimaOccorrenza("2096-02-29", "2100-01-10").data).toBe("2100-02-28");
  });
});

describe("appuntamentiFiscali", () => {
  it("a ottobre: prima novembre, poi il giugno dell'anno dopo", () => {
    const a = appuntamentiFiscali(ingresso());
    expect(a.senzaAcconti).toBe(false);
    expect(a.prossimo).toEqual({
      genere: "secondo-acconto",
      data: `${ANNO}-11-30`,
      anno: ANNO,
      rinviata: false,
      importo: 5_329.48,
    });
    expect(a.seguente).toEqual({
      genere: "saldo-e-primo-acconto",
      data: `${ANNO + 1}-06-30`,
      anno: ANNO + 1,
      rinviata: true,
      importo: 6_264.28,
    });
  });

  it("a gennaio: prima giugno, poi novembre, tutti e due nell'anno in corso", () => {
    const a = appuntamentiFiscali(ingresso({ oggi: `${ANNO}-01-15` }));
    expect(a.prossimo.genere).toBe("saldo-e-primo-acconto");
    expect(a.prossimo.data).toBe(`${ANNO}-06-30`);
    expect(a.seguente?.genere).toBe("secondo-acconto");
    expect(a.seguente?.data).toBe(`${ANNO}-11-30`);
  });

  /*
    L'identità che tiene in piedi la partizione: le due rate di un anno
    regolare sommano al carico di quell'anno, non a qualcosa di più. È la
    prova che non si sta contando due volte lo stesso saldo — che è
    esattamente l'errore della prima stesura, dove uscivano 16.231,27 € a
    giugno invece di 6.264,28.
  */
  it("le due rate sommano al carico dell'anno", () => {
    const a = appuntamentiFiscali(ingresso());
    const totale = a.prossimo.importo + (a.seguente?.importo ?? 0);
    expect(totale).toBeCloseTo(11_593.76, 2);
  });

  it("nel primo anno non c'è novembre, e giugno porta anche il primo acconto", () => {
    const a = appuntamentiFiscali(ingresso({ primoAnno: true }));
    expect(a.senzaAcconti).toBe(true);
    expect(a.seguente).toBeNull();
    expect(a.prossimo.genere).toBe("saldo-e-primo-acconto");
    // 11.593,76 di carico più 4.637,51 di primo acconto.
    expect(a.prossimo.importo).toBe(16_231.27);
    expect(a.prossimo.anno).toBe(ANNO + 1);
  });

  it("sotto la soglia degli acconti: tutto a giugno, e solo il carico", () => {
    const a = appuntamentiFiscali(
      ingresso({ acconti: { dovuti: false, primo: 0, secondo: 0 }, carico: 180 }),
    );
    expect(a.senzaAcconti).toBe(true);
    expect(a.prossimo.importo).toBe(180);
    expect(a.seguente).toBeNull();
  });

  /*
    Un acconto unico — sotto la soglia della seconda rata — resta un
    appuntamento a novembre: il motore lo mette tutto in `secondo`, e la
    partizione continua a sommare al carico.
  */
  it("l'acconto unico resta una rata di novembre, e l'identità tiene", () => {
    const a = appuntamentiFiscali(
      ingresso({ carico: 900, acconti: { dovuti: true, primo: 0, secondo: 400 } }),
    );
    expect(a.prossimo.importo).toBe(400);
    expect(a.seguente?.importo).toBe(500);
  });
});

/*
  La griglia sul motore vero: non verifica le imposte — quelle le verifica il
  motore — verifica che l'identità su cui poggia la partizione sia vera per i
  numeri che il simulatore produce davvero. Se un giorno `saldoResiduo` e
  `caricoTotale` smettessero di coincidere nel simulatore, il riquadro in
  evidenza mostrerebbe una cifra sbagliata senza che nulla cambi a schermo: lo
  dice questo test, non l'occhio.
*/
describe("l'identità vale sui numeri veri del simulatore", () => {
  const casi: [number, Regime][] = [
    [12_000, "forfettario"],
    [25_000, "forfettario"],
    [40_000, "forfettario"],
    [85_000, "forfettario"],
    [12_000, "ordinario"],
    [40_000, "ordinario"],
    [120_000, "ordinario"],
  ];

  for (const [ricavi, regime] of casi) {
    it(`${ricavi} € in ${regime}`, () => {
      const e = simula({ ...INGRESSO_INIZIALE, ricavi, regime });
      const p = e.prospetto;
      /*
        Nel simulatore non ci sono ritenute, crediti né versamenti già fatti:
        il dovuto coincide con il carico di competenza. La partizione poggia su
        questo, quindi lo si pretende invece di darlo per buono.
      */
      expect(p.saldoResiduo).toBe(p.caricoTotale);

      const a = appuntamentiFiscali({
        carico: p.caricoTotale,
        acconti: p.acconti,
        dataGiugno: GIUGNO,
        dataNovembre: NOVEMBRE,
        primoAnno: false,
        oggi: `${ANNO}-10-01`,
      });
      const totale = a.prossimo.importo + (a.seguente?.importo ?? 0);
      expect(totale).toBeCloseTo(p.caricoTotale, 2);
      expect(a.prossimo.importo).toBeGreaterThan(0);
    });
  }
});

/*
  La tagliola sulle due date.

  Il riquadro in evidenza pesca `saldo-e-primo-acconto` e `secondo-acconto`
  dall'elenco del motore per sapere **quando** cadono. Se un giorno uno dei due
  id cambiasse nome, o la voce smettesse di comparire quando non ha un importo,
  il riquadro sparirebbe dalla pagina senza un errore: `find` restituirebbe
  `undefined`, il componente non renderizzerebbe niente, e la cosa più visibile
  della landing non ci sarebbe più. Da uno schermo non si distingue da una
  scelta di disegno.
*/
describe("le due scadenze su cui poggia il riquadro esistono davvero", () => {
  const e = simula(INGRESSO_INIZIALE);

  for (const id of ["saldo-e-primo-acconto", "secondo-acconto"]) {
    it(`il motore produce «${id}», con la sua data`, () => {
      const trovata = e.scadenze.find((s) => s.id === id);
      expect(trovata).toBeDefined();
      expect(trovata?.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  }

  /*
    E l'importo **non** c'è: è il motivo per cui questo file esiste. Gli
    acconti si calcolano sull'anno precedente, e in una simulazione un anno
    precedente non c'è. Il giorno in cui il motore cominciasse a darglielo, la
    partizione qui dentro andrebbe rifatta — e questo test lo dice invece di
    far comparire due numeri diversi per la stessa scadenza in due punti della
    stessa pagina.
  */
  it("ma senza importo: è la ragione della partizione", () => {
    for (const id of ["saldo-e-primo-acconto", "secondo-acconto"]) {
      expect(e.scadenze.find((s) => s.id === id)?.importo).toBeNull();
    }
  });
});

describe("mesiFinoA", () => {
  it("conta i mesi di calendario", () => {
    expect(mesiFinoA("2026-10-01", "2027-06-30")).toBe(8);
    expect(mesiFinoA("2026-01-15", "2026-06-30")).toBe(5);
  });

  it("mai zero: a giugno si versa comunque", () => {
    expect(mesiFinoA("2027-06-01", "2027-06-30")).toBe(1);
    expect(mesiFinoA("2027-07-01", "2027-06-30")).toBe(1);
  });
});

describe("divario", () => {
  const app = appuntamentiFiscali(ingresso());

  it("vuoto: conta tutto quello che esce fino a giugno, non solo giugno", () => {
    const d = divario(app, 0, `${ANNO}-10-01`);
    // 5.329,48 di novembre più 6.264,28 di giugno.
    expect(d?.serve).toBe(11_593.76);
    expect(d?.manca).toBe(11_593.76);
    expect(d?.mesi).toBe(8);
    expect(d?.alMese).toBe(1_449.22);
  });

  it("con qualcosa da parte, manca il resto", () => {
    const d = divario(app, 4_000, `${ANNO}-10-01`);
    expect(d?.manca).toBe(7_593.76);
    expect(d?.alMese).toBe(949.22);
  });

  it("in pari: non manca niente e non c'è una quota mensile", () => {
    const d = divario(app, 12_000, `${ANNO}-10-01`);
    expect(d?.manca).toBe(0);
    expect(d?.alMese).toBe(0);
  });

  it("un importo negativo vale zero: non aumenta il fabbisogno", () => {
    const d = divario(app, -5_000, `${ANNO}-10-01`);
    expect(d?.manca).toBe(11_593.76);
  });

  it("nel primo anno il fabbisogno è la sola rata di giugno", () => {
    const solo = appuntamentiFiscali(ingresso({ primoAnno: true }));
    const d = divario(solo, 0, `${ANNO}-10-01`);
    expect(d?.serve).toBe(16_231.27);
    expect(d?.giugno.anno).toBe(ANNO + 1);
  });
});
