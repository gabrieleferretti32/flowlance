import { describe, expect, it } from "vitest";
import { catenaAnni } from "@/lib/analisi/anno";
import { datiVetrina } from "@/lib/dati/vetrina";
import { scadenzeAnno } from "./scadenze";
import type { VersamentoF24 } from "./tipi";
import { round2 } from "./aritmetica";
import { euro } from "@/lib/format";
import { mesiFinoA, mesiRimastiNellAnno, quotaAccantonamento } from "./accantonamento";

/*
  Si passa da `catenaAnni`, la stessa porta da cui passa il cruscotto.

  La prima stesura costruiva il prospetto e la liquidazione a mano, con
  `calcolaProspetto` e `calcolaIva` chiamati qui. Sembrava equivalente e non lo
  era: `catenaAnni` passa a `calcolaIva` anche le note di credito e il credito
  IVA in ingresso, che quella chiamata a mano non aveva. Il secondo trimestre
  della vetrina usciva 2.871,58 € invece di 2.796,03 €, e il test «vedeva» un
  arretrato di 75,55 € che nell'app non c'è — il difetto che il commento in
  testa ad `anno.ts` descrive: un test che prova un percorso diverso da quello
  dell'app non prova niente.
*/
const d = datiVetrina();
const archivioCon = (versamenti: VersamentoF24[]) => ({
  impostazioni: d.impostazioni,
  fatture: d.fatture,
  note: d.note,
  costi: d.costi,
  versamenti,
  movimentiAttivita: d.movimentiAttivita,
  movimentiPersonali: d.movimentiPersonali,
  chiusure: d.chiusure,
});

const annoDi = (oggi: string, versamenti: VersamentoF24[] = d.versamenti) =>
  catenaAnni(archivioCon(versamenti), 2026, oggi);

const impDi = (a: number) => d.impostazioni.find((i) => i.anno === a)!;

const quotaCon = (oggi: string, versamenti: VersamentoF24[], conAnnoPrima = true) => {
  const catena = annoDi(oggi, versamenti);
  const a = catena.get(2026)!;
  return quotaAccantonamento({
    prospetto: a.prospetto,
    impostazioni: a.impostazioni,
    parametri: a.parametri,
    iva: a.iva,
    versamenti,
    precedente: conAnnoPrima ? catena.get(2025)!.prospetto : null,
    oggi,
  });
};

const quota = (oggi: string, conAnnoPrima = true) => quotaCon(oggi, d.versamenti, conAnnoPrima);

describe("i mesi che mancano", () => {
  it("una scadenza di questo mese è un mese, non zero", () => {
    expect(mesiFinoA("2026-09-30", "2026-09-20")).toBe(1);
  });
  it("il mese dopo sono due", () => {
    expect(mesiFinoA("2026-10-05", "2026-09-20")).toBe(2);
  });
  it("attraversa l'anno", () => {
    expect(mesiFinoA("2027-06-30", "2026-09-20")).toBe(10);
  });
  it("**una scadenza passata è zero, e non uno**", () => {
    expect(mesiFinoA("2026-06-30", "2026-09-20")).toBe(0);
  });
  it("i mesi rimasti nell'anno non scendono sotto uno", () => {
    expect(mesiRimastiNellAnno("2026-09-20")).toBe(4);
    expect(mesiRimastiNellAnno("2026-12-31")).toBe(1);
  });
});

/**
 * La prova che il brief chiede: **se gli acconti escono senza importo, questo
 * test fallisce.**
 *
 * `scadenzeAnno` calcola gli acconti sui numeri dell'anno prima. Senza quel
 * prospetto restituisce le due righe con `importo: null`, e le due scadenze
 * più grosse dell'anno diventano invisibili al calcolo della quota — che
 * uscirebbe più bassa del vero, in silenzio. È il difetto che questa funzione
 * esiste per non avere.
 */
describe("**gli acconti devono avere un importo**", () => {
  const catena = annoDi("2026-09-20");
  const a = catena.get(2026)!;
  const p2025 = catena.get(2025)!.prospetto;
  const scadenze = (precedente: typeof p2025 | null) =>
    scadenzeAnno(a.impostazioni, a.parametri, a.prospetto, a.iva, precedente)
      .filter((s) => s.categoria === "imposte" && s.importo !== null && s.importo > 0);

  it("con il prospetto dell'anno prima, le due scadenze di imposte hanno una cifra", () => {
    const imposte = scadenze(p2025);
    expect(imposte.length).toBeGreaterThanOrEqual(2);
    for (const s of imposte) expect(s.importo, s.titolo).toBeGreaterThan(0);
  });

  it("e la misura vede la differenza: senza l'anno prima non ce l'hanno", () => {
    expect(scadenze(null)).toHaveLength(0);
  });

  it("**quindi senza l'anno prima si passa al ripiego, e lo si dice**", () => {
    const q = quota("2026-09-20", false);
    expect(q.metodo).toBe("ripiego");
    expect(q.avvisi.join(" ")).toMatch(/anno scorso/);
    expect(q.imposte.alMese).toBe(Math.round((q.imposte.daAccantonare / 4) * 100) / 100);
  });
});

describe("**la quota di settembre, sui numeri veri della vetrina**", () => {
  const q = quota("2026-09-20");

  it("distribuisce il residuo sulle scadenze future, non la somma delle scadenze", () => {
    expect(q.metodo).toBe("scadenze");
    expect(q.imposte.daAccantonare).toBe(1_015.85);
    // Il 30 giugno è passato: non entra. Resta il secondo acconto del 30 novembre.
    expect(q.imposte.voci.map((v) => v.data)).toEqual(["2026-11-30"]);
    expect(q.imposte.voci[0].quota).toBe(1_015.85);
    expect(q.imposte.voci[0].mesiMancanti).toBe(3);
  });

  it("e fa 338,62 € al mese, non 84,65 €", () => {
    expect(q.imposte.alMese).toBe(338.62);
    expect(annoDi("2026-09-20").get(2026)!.prospetto.accantonamentoMensile).toBe(84.65);
  });

  it("nessun avviso, e nessuna voce scaduta: il calendario basta", () => {
    /*
      Nel dataset di vetrina i due trimestri IVA già scaduti risultano versati
      per l'importo esatto, e le imposte non hanno arretrati. Quando qualcosa
      non torna la quota lo dice — i test più sotto lo provano togliendo un
      versamento — ma qui non c'è niente da dire, e il silenzio è il risultato.
    */
    expect(q.imposte.voci.some((v) => v.scaduta)).toBe(false);
    expect(q.iva.voci.some((v) => v.scaduta)).toBe(false);
    expect(q.avvisi).toEqual([]);
  });
});

describe("la quota si muove con il calendario, invece di scendere quando paghi", () => {
  it("più ci si avvicina alla scadenza, più sale", () => {
    const mesi = ["2026-09-20", "2026-10-20", "2026-11-20"].map((o) => quota(o).imposte.alMese);
    expect(mesi[0]).toBeLessThan(mesi[1]);
    expect(mesi[1]).toBeLessThan(mesi[2]);
  });

  it("l'ultimo mese utile chiede tutto quello che manca", () => {
    const q = quota("2026-11-20");
    expect(q.imposte.voci[0].mesiMancanti).toBe(1);
    expect(q.imposte.alMese).toBe(q.imposte.daAccantonare);
  });
});

describe("**dopo l'ultima scadenza dell'anno: è il saldo, non un arretrato**", () => {
  /*
    Il difetto che ha trovato Gabriele provando il dataset dimostrativo. A
    dicembre, passato il secondo acconto, quello che resta non è denaro in
    ritardo: è il saldo dell'anno, che si versa il 30 giugno di quello dopo.
    Il calendario di `scadenzeAnno` si ferma al 31 dicembre, e la prima
    stesura chiamava «scadenza già passata» tutto ciò che avanzava, datandolo
    a oggi — un giorno che non è una scadenza, con un giudizio che non è vero.
  */
  const q = quota("2026-12-10");

  it("la voce che resta è il saldo, datata al 30 giugno dell'anno dopo", () => {
    const saldo = q.imposte.voci.find((v) => v.id === "saldo-anno");
    expect(saldo).toBeDefined();
    expect(saldo?.data).toBe("2027-06-30");
    expect(saldo?.scaduta).toBe(false);
    expect(saldo?.mesiMancanti).toBe(7);
  });

  it("**e non finisce fra gli arretrati**", () => {
    expect(q.imposte.voci.some((v) => v.scaduta)).toBe(false);
    for (const a of q.avvisi) expect(a).toMatch(/IVA/);
  });

  it("niente divisione per zero, e la quota resta un numero", () => {
    expect(Number.isFinite(q.alMese)).toBe(true);
    for (const v of [...q.imposte.voci, ...q.iva.voci]) expect(Number.isFinite(v.alMese)).toBe(true);
  });
});

describe("**a settembre, con l'acconto di giugno versato**", () => {
  /*
    Il test che il brief chiede per nome: il saldo dell'anno dopo non deve mai
    finire in «scadenza già passata». Si guarda tutto l'arco dei mesi, non uno
    solo: il difetto compariva solo dopo l'ultima scadenza dell'anno, e un
    test su settembre soltanto non l'avrebbe visto.
  */
  for (const oggi of ["2026-09-20", "2026-10-15", "2026-12-01", "2026-12-31"]) {
    it(`il ${oggi}: nessuna voce di imposte marcata come scaduta`, () => {
      const q = quota(oggi);
      const scadute = q.imposte.voci.filter((v) => v.scaduta);
      expect(scadute.map((v) => `${v.data} ${v.quota}`)).toEqual([]);
    });
  }

  it("e quando c'è, il saldo porta la data di giugno e i suoi mesi", () => {
    const q = quota("2026-12-31");
    const saldo = q.imposte.voci.find((v) => v.id === "saldo-anno")!;
    expect(saldo).toBeDefined();
    expect(saldo.data).toBe("2027-06-30");
    expect(saldo.mesiMancanti).toBeGreaterThan(0);
    expect(saldo.alMese).toBe(Math.round((saldo.quota / saldo.mesiMancanti) * 100) / 100);
  });
});

describe("i casi che non devono rompere niente", () => {
  /*
    La versione precedente di questo test pretendeva che la quota intera fosse
    zero. Era vero quando le componenti erano una sola: adesso non lo è più, ed
    è giusto che non lo sia. Chi non deve più niente di imposte può dovere
    ancora l'IVA del trimestre — sono due denari diversi, e il secondo non
    smette di esistere perché il primo è finito.
  */
  it("senza fabbisogno di imposte resta comunque l'IVA", () => {
    const catena = annoDi("2026-09-20");
    const a = catena.get(2026)!;
    const q = quotaAccantonamento({
      prospetto: { ...a.prospetto, fabbisognoDaAccantonare: 0 },
      impostazioni: a.impostazioni,
      parametri: a.parametri,
      iva: a.iva,
      versamenti: d.versamenti,
      precedente: catena.get(2025)!.prospetto,
      oggi: "2026-09-20",
    });
    expect(q.imposte.alMese).toBe(0);
    expect(q.imposte.voci).toEqual([]);
    expect(q.alMese).toBe(q.iva.alMese);
  });

  it("la somma delle voci è la quota, e le quote sommano il residuo", () => {
    const q = quota("2026-09-20");
    const tutte = [...q.imposte.voci, ...q.iva.voci];
    const somma = tutte.reduce((t, v) => t + v.alMese, 0);
    expect(Math.abs(somma - q.alMese)).toBeLessThan(0.02);
    const distribuito = q.imposte.voci.reduce((t, v) => t + v.quota, 0);
    expect(Math.abs(distribuito - q.imposte.daAccantonare)).toBeLessThan(0.02);
  });
});

/**
 * L'IVA è la seconda componente, e in forfettario sparisce da sé.
 *
 * Per chi è in ordinario l'IVA incassata non è sua, e il limite di spesa del
 * modulo parte dalle entrate in banca — che la comprendono. Una quota che la
 * escludesse lascerebbe spendere l'IVA dei clienti: sul dataset di vetrina
 * sono più del carico fiscale intero.
 */
describe("**la componente IVA**", () => {
  const oggiIva = "2026-09-20";
  const ordinario = quota(oggiIva);

  it("c'è, e sta su scadenze di sola IVA", () => {
    expect(ordinario.iva.voci.length).toBeGreaterThan(0);
    for (const v of ordinario.iva.voci) expect(v.componente).toBe("iva");
  });

  it("le imposte restano su scadenze di sole imposte e contributi", () => {
    for (const v of ordinario.imposte.voci) expect(v.componente).toBe("imposte");
  });

  it("**il totale è esattamente la somma delle due**", () => {
    expect(ordinario.alMese).toBe(
      Math.round((ordinario.imposte.alMese + ordinario.iva.alMese) * 100) / 100,
    );
  });

  it("ogni scadenza IVA futura è il suo importo diviso i mesi che mancano", () => {
    for (const v of ordinario.iva.voci.filter((x) => !x.scaduta)) {
      expect(v.mesiMancanti).toBeGreaterThan(0);
      expect(v.alMese).toBe(Math.round((v.quota / v.mesiMancanti) * 100) / 100);
    }
  });

  /**
   * **Un trimestre scaduto e non versato adesso si vede, con la sua data.**
   *
   * I versamenti di tipo IVA sono in archivio — è `giaVersato` del motore che
   * li esclude, perché il suo perimetro è imposte e contributi. Prima la quota
   * non li guardava, e un trimestre non versato spariva: la persona non sapeva
   * di doverlo mettere da parte.
   *
   * Nella vetrina i due trimestri scaduti sono versati per l'importo esatto,
   * quindi il caso non c'è da guardare: va costruito. Qui si toglie e si
   * dimezza il versamento del 20 agosto — 2.796,03 € — e si guarda che cosa
   * cambia. Il numero atteso non è scritto a mano: è quello che la
   * liquidazione dice del secondo trimestre, così se un giorno cambia il
   * dataset il test resta vero.
   */
  const versamentiSenza = (id: string) => d.versamenti.filter((v) => v.id !== id);
  const secondoTrimestre = round2(
    annoDi(oggiIva).get(2026)!.iva.trimestri[1].totaleDaVersare,
  );

  it("un trimestre versato per intero non compare", () => {
    expect(ordinario.iva.voci.find((v) => v.data.startsWith("2026-05"))).toBeUndefined();
    expect(ordinario.iva.voci.find((v) => v.data === "2026-08-20")).toBeUndefined();
  });

  it("**tolto il versamento, il trimestre compare con la sua data e i mesi a zero**", () => {
    const q = quotaCon(oggiIva, versamentiSenza("vet-f24-iva2"));
    const agosto = q.iva.voci.find((v) => v.data === "2026-08-20")!;
    expect(agosto).toBeDefined();
    expect(agosto.scaduta).toBe(true);
    expect(agosto.mesiMancanti).toBe(0);
    expect(agosto.quota).toBe(secondoTrimestre);
    /* Tutto su questo mese: zero mesi mancanti non è un denominatore. */
    expect(agosto.alMese).toBe(secondoTrimestre);
  });

  it("**versato per meno, resta solo la differenza**", () => {
    const meta = round2(secondoTrimestre / 2);
    const q = quotaCon(oggiIva, [
      ...versamentiSenza("vet-f24-iva2"),
      { id: "vet-f24-iva2", data: "2026-08-20", tipo: "iva" as const, importo: meta, annoImposta: 2026 },
    ]);
    const agosto = q.iva.voci.find((v) => v.data === "2026-08-20")!;
    expect(agosto.quota).toBe(round2(secondoTrimestre - meta));
  });

  it("e l'avviso lo dice, con la cifra scoperta", () => {
    const q = quotaCon(oggiIva, versamentiSenza("vet-f24-iva2"));
    expect(q.avvisi.join(" ")).toMatch(/IVA risultano non versati/);
    expect(q.avvisi.join(" ")).toContain(euro(secondoTrimestre));
  });

  it("e quando il versamento c'è, l'avviso non c'è: la misura non grida sempre", () => {
    expect(ordinario.avvisi.join(" ")).not.toMatch(/IVA risultano non versati/);
  });
});

/**
 * **I versamenti coprono le scadenze in ordine di data, anche quelle future.**
 *
 * Se la regola valesse solo per le scadenze passate, chi versa in anticipo si
 * sentirebbe chiedere di accantonare una seconda volta soldi già usciti: il
 * versamento è in archivio e sparirebbe dal consiglio. È lo stesso difetto
 * dell'arretrato invisibile, rovesciato.
 *
 * Nella vetrina, al 20 settembre 2026, resta da versare il terzo trimestre
 * entro il 16 novembre. I casi qui sotto pagano quella scadenza in anticipo,
 * tutta o in parte.
 */
describe("**un versamento IVA in anticipo**", () => {
  const oggi = "2026-09-20";
  const conVersamentoDi = (importo: number) =>
    quotaCon(oggi, [
      ...d.versamenti,
      { id: "prova-anticipo", data: "2026-09-10", tipo: "iva" as const, importo, annoImposta: 2026 },
    ]);

  const senza = quota(oggi);
  const novembre = senza.iva.voci.find((v) => v.data === "2026-11-16")!;

  /* La verifica al contrario: la misura vede la voce quando c'è. */
  it("senza il versamento, la scadenza di novembre c'è e pesa", () => {
    expect(novembre.quota).toBeGreaterThan(0);
    expect(novembre.alMese).toBeGreaterThan(0);
    expect(novembre.mesiMancanti).toBe(3);
  });

  it("**coprendola tutta, la componente IVA va a zero**", () => {
    const con = conVersamentoDi(novembre.quota);
    expect(con.iva.voci).toEqual([]);
    expect(con.iva.alMese).toBe(0);
    expect(con.alMese).toBe(con.imposte.alMese);
  });

  it("una copertura parziale lascia solo la differenza, divisa per i mesi", () => {
    const con = conVersamentoDi(500);
    const dopo = con.iva.voci.find((v) => v.data === "2026-11-16")!;
    expect(dopo.quota).toBe(round2(novembre.quota - 500));
    expect(dopo.alMese).toBe(round2(dopo.quota / dopo.mesiMancanti));
  });

  /**
   * **Il debito più vecchio si copre per primo.**
   *
   * Con un trimestre scaduto scoperto e uno futuro aperto, un versamento che
   * basta solo per il primo deve andare lì: è il debito che esiste già.
   */
  it("con un arretrato aperto, l'anticipo va prima su quello", () => {
    const senzaAgosto = d.versamenti.filter((v) => v.id !== "vet-f24-iva2");
    const arretrato = round2(annoDi(oggi).get(2026)!.iva.trimestri[1].totaleDaVersare);
    const con = quotaCon(oggi, [
      ...senzaAgosto,
      { id: "prova-anticipo", data: "2026-09-10", tipo: "iva" as const, importo: arretrato, annoImposta: 2026 },
    ]);
    expect(con.iva.voci.filter((v) => v.scaduta)).toEqual([]);
    expect(con.avvisi.join(" ")).not.toMatch(/IVA risultano non versati/);
    const dopo = con.iva.voci.find((v) => v.data === "2026-11-16")!;
    expect(dopo.quota).toBe(novembre.quota);
  });
});

describe("**stesso mese, ordinario contro forfettario**", () => {
  const oggi = "2026-09-20";
  const ordinario = quota(oggi);

  /*
    Lo stesso archivio, lo stesso mese, cambiata una cosa sola: il regime.
    Non un dataset diverso — sarebbero due situazioni diverse, e il confronto
    non direbbe niente sul regime.
  */
  const forfettario = (() => {
    const imp = { ...impDi(2026), regime: "forfettario" as const };
    const catena = catenaAnni(
      {
        ...archivioCon(d.versamenti),
        impostazioni: d.impostazioni.map((i) => (i.anno === 2026 ? imp : i)),
      },
      2026,
      oggi,
    );
    const a = catena.get(2026)!;
    return quotaAccantonamento({
      prospetto: a.prospetto,
      impostazioni: a.impostazioni,
      parametri: a.parametri,
      iva: a.iva,
      versamenti: d.versamenti,
      precedente: catena.get(2025)!.prospetto,
      oggi,
    });
  })();

  it("in forfettario la componente IVA è zero", () => {
    expect(forfettario.iva.alMese).toBe(0);
    expect(forfettario.iva.voci).toEqual([]);
    expect(forfettario.iva.daAccantonare).toBe(0);
  });

  it("**e la quota totale è la sola parte di imposte**", () => {
    expect(forfettario.alMese).toBe(forfettario.imposte.alMese);
  });

  it("**in ordinario la quota è più alta di esattamente la parte IVA**", () => {
    /*
      Il confronto che conta: la differenza fra i due totali non è un numero
      qualunque, è la componente IVA. Se un giorno l'IVA finisse anche dentro
      il residuo delle imposte, questa uguaglianza si romperebbe — ed è
      esattamente il doppio conteggio da evitare.
    */
    const soloIva = round2(ordinario.alMese - ordinario.imposte.alMese);
    expect(soloIva).toBe(ordinario.iva.alMese);
    expect(ordinario.iva.alMese).toBeGreaterThan(0);
  });

  it("la parte di imposte esiste in tutti e due i regimi", () => {
    expect(ordinario.imposte.alMese).toBeGreaterThan(0);
    expect(forfettario.imposte.alMese).toBeGreaterThan(0);
  });
});
