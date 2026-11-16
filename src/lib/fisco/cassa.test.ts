/**
 * La cassa professionale configurabile.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Che cosa questi test fissano, e che cosa non confermano
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le regole provate qui sono quelle del brief: soggettivo sul reddito con un
 * minimo annuo, integrativo sui compensi fatturati addebitato al cliente,
 * integrativo fuori dal reddito e fuori dalla base della ritenuta, integrativo
 * **dentro** la base IVA in regime ordinario. **Da questo ambiente nessun
 * regolamento di cassa si è potuto aprire** — il proxy di rete nega i siti
 * istituzionali — quindi questi test fissano quelle regole, non le confermano
 * cassa per cassa. È dichiarato in APPROSSIMAZIONI.md.
 *
 * Quello che invece confermano per intero è la **meccanica**: che un minimo
 * faccia da pavimento e non da franchigia, che una nota di credito si porti
 * dietro l'integrativo, che un archivio vecchio non cambi un numero, che
 * cambiare gestione e tornare indietro non lasci dati incoerenti. Sono le cose
 * che l'app può sbagliare da sola, e sono quelle che qui non passano.
 */
import { describe, expect, it } from "vitest";
import {
  addebitaIntegrativo,
  cassaDi,
  cassaPredefinita,
  contributoSoggettivo,
  eCassa,
  erroriCassa,
  integrativoAnnuo,
  integrativoSu,
  nomeCassa,
  nomePrevidenza,
  valutaCassa,
} from "./cassa";
import { round2 } from "./aritmetica";
import { baseContributivaCpb } from "./cpb";
import { calcolaFattura } from "./documenti";
import { calcolaNota } from "./note";
import { calcolaProspetto, contributiPrevidenziali } from "./motore";
import { quotaAccantonamento } from "./accantonamento";
import { adempimentiSenzaData } from "./scadenze";
import { calcolaIva } from "./iva";
import { confrontaRegimi, ingressoDaProspetto } from "./confronto";
import { impostazioniDaPrecedente } from "./impostazioni";
import { analizzaBackup } from "@/lib/dati/backup";
import { PARAMETRI_2026 } from "./parametri/2026";
import {
  COSTI_FIXTURE,
  FATTURE_FIXTURE,
  OGGI_FIXTURE,
  cassaProva,
  impostazioniForfettario,
  impostazioniOrdinario,
} from "./fixture";
import type { Cassa, Fattura, Impostazioni, NotaCredito } from "./tipi";

const par = PARAMETRI_2026;

/** L'avvocato del riepilogo: 16 % con minimo 3.000, integrativo 4 % con minimo 400. */
const FORENSE: Cassa = {
  nome: "Cassa Forense",
  aliquotaSoggettivo: 0.16,
  minimoSoggettivo: 3_000,
  aliquotaIntegrativo: 0.04,
  minimoIntegrativo: 400,
  contributiFissi: 0,
};

function conCassa(c: Partial<Cassa>, base: Impostazioni = impostazioniOrdinario()): Impostazioni {
  return { ...base, gestione: "cassa", cassa: { ...cassaProva(), ...c } };
}

function prospettoDi(
  imp: Impostazioni,
  extra: Partial<Parameters<typeof calcolaProspetto>[0]> = {},
) {
  return calcolaProspetto({
    impostazioni: imp,
    parametri: par,
    fatture: FATTURE_FIXTURE,
    costi: COSTI_FIXTURE,
    oggi: OGGI_FIXTURE,
    ...extra,
  });
}

const FATTURA: Fattura = {
  id: "fx",
  dataEmissione: "2026-05-10",
  numero: "2026/010",
  clienteId: "alfa",
  descrizione: "Parere",
  tipoRicavo: "progetto",
  imponibile: 10_000,
  dataIncasso: null,
};

// ————————————————————————————————————————————————————————————
// Il contributo soggettivo e il suo minimo
// ————————————————————————————————————————————————————————————

describe("il contributo soggettivo", () => {
  it("sopra il minimo è aliquota per reddito", () => {
    // 40.000 × 16 % = 6.400, che sta ben sopra i 3.000 di minimo.
    const c = contributoSoggettivo(40_000, FORENSE);
    expect(c.calcolato).toBe(6_400);
    expect(c.applicato).toBe(6_400);
    expect(c.alMinimo).toBe(false);
  });

  /*
    Il minimo è un **pavimento, non una franchigia**: chi sta sotto paga il
    minimo per intero, non la differenza. È la distinzione che su un anno magro
    vale migliaia di euro, e un'aliquota moltiplicata senza confronto la
    perderebbe restituendo un numero più basso del vero — plausibile, e falso.
  */
  it("sotto il minimo si versa il minimo, intero", () => {
    // 10.000 × 16 % = 1.600, sotto i 3.000: si versano 3.000, non 1.400.
    const c = contributoSoggettivo(10_000, FORENSE);
    expect(c.calcolato).toBe(1_600);
    expect(c.minimo).toBe(3_000);
    expect(c.applicato).toBe(3_000);
    expect(c.alMinimo).toBe(true);
    // La differenza non è il contributo: il minimo è l'importo pieno.
    expect(c.applicato).not.toBe(round2(3_000 - 1_600));
  });

  it("al minimo esatto non scatta il pavimento: è già l'aliquota", () => {
    // 18.750 × 16 % = 3.000 esatti.
    const c = contributoSoggettivo(18_750, FORENSE);
    expect(c.calcolato).toBe(3_000);
    expect(c.applicato).toBe(3_000);
    expect(c.alMinimo).toBe(false);
  });

  it("un reddito negativo non produce un contributo negativo", () => {
    expect(contributoSoggettivo(-5_000, FORENSE).applicato).toBe(3_000);
    expect(contributoSoggettivo(-5_000, { ...FORENSE, minimoSoggettivo: 0 }).applicato).toBe(0);
  });

  /*
    Senza aliquota il contributo è **zero**, non una stima.

    L'app teneva una media del 15 % e la usava: un contributo calcolato al
    centesimo su un'aliquota che non era di nessuno. Uno zero che si spiega è
    una risposta; un numero plausibile che nessuno ha dichiarato è una bugia.
  */
  it("senza aliquota dichiarata resta zero, e il minimo vale comunque", () => {
    const vuota = contributoSoggettivo(40_000, cassaPredefinita());
    expect(vuota.calcolato).toBe(0);
    expect(vuota.applicato).toBe(0);
    expect(vuota.alMinimo).toBe(false);
  });
});

describe("i contributi fissi della cassa", () => {
  it("si sommano al soggettivo e pesano sul reddito", () => {
    const esito = valutaCassa(conCassa({ ...FORENSE, contributiFissi: 72 }), {
      redditoImponibile: 40_000,
    });
    expect(esito?.soggettivo.applicato).toBe(6_400);
    expect(esito?.contributiFissi).toBe(72);
    expect(esito?.dovutoSulReddito).toBe(6_472);
  });
});

// ————————————————————————————————————————————————————————————
// L'integrativo in fattura
// ————————————————————————————————————————————————————————————

describe("il contributo integrativo in fattura", () => {
  it("si addebita al posto della rivalsa INPS, anche con la rivalsa accesa", () => {
    const imp = conCassa(FORENSE, { ...impostazioniOrdinario(), rivalsaAttiva: true });
    const f = calcolaFattura(FATTURA, imp, OGGI_FIXTURE);
    expect(f.integrativaCassa).toBe(400); // 4 % su 10.000
    expect(f.rivalsa).toBe(0);
  });

  /*
    E non passa dall'interruttore della rivalsa.

    Ci passava, e voleva dire che chi aveva una cassa con la rivalsa spenta —
    la configurazione predefinita — emetteva fatture **senza** l'integrativo
    che il regolamento della cassa lo obbliga ad addebitare. La rivalsa è una
    scelta da concordare col cliente; l'integrativo no.
  */
  it("si addebita anche con l'interruttore della rivalsa spento", () => {
    const imp = conCassa(FORENSE, { ...impostazioniOrdinario(), rivalsaAttiva: false });
    expect(addebitaIntegrativo(imp)).toBe(true);
    expect(calcolaFattura(FATTURA, imp, OGGI_FIXTURE).integrativaCassa).toBe(400);
  });

  it("senza aliquota dell'integrativo la fattura non addebita niente", () => {
    const imp = conCassa({ ...FORENSE, aliquotaIntegrativo: null });
    expect(addebitaIntegrativo(imp)).toBe(false);
    const f = calcolaFattura(FATTURA, imp, OGGI_FIXTURE);
    expect(f.integrativaCassa).toBe(0);
    expect(f.rivalsa).toBe(0);
  });

  /*
    L'IVA si calcola su compensi **più** integrativo.

    L'integrativo concorre a formare la base imponibile IVA dell'operazione. Con
    l'IVA sul solo imponibile la fattura usciva con 2.200 € invece di 2.288 €:
    un documento sbagliato mandato a un cliente, non un numero storto a schermo.
  */
  it("in ordinario l'IVA si calcola anche sull'integrativo", () => {
    const imp = conCassa(FORENSE);
    const f = calcolaFattura(FATTURA, imp, OGGI_FIXTURE);
    expect(f.aliquotaIvaApplicata).toBe(0.22);
    expect(f.iva).toBe(round2((10_000 + 400) * 0.22)); // 2.288, non 2.200
    expect(f.iva).not.toBe(round2(10_000 * 0.22));
    expect(f.totale).toBe(round2(10_000 + 400 + 2_288));
  });

  it("in forfettario non c'è IVA da calcolare, e l'integrativo resta", () => {
    const imp = conCassa(FORENSE, impostazioniForfettario());
    const f = calcolaFattura(FATTURA, imp, OGGI_FIXTURE);
    expect(f.integrativaCassa).toBe(400);
    expect(f.iva).toBe(0);
    /*
      E il bollo c'è, perché l'operazione è fuori campo IVA e supera la soglia:
      il totale è 10.000 + 400 + 2. L'integrativo entra nell'imponibile su cui
      la soglia del bollo si misura, come la rivalsa — ed è giusto che ci entri:
      il bollo si deve sulle somme che il documento espone.
    */
    expect(f.bollo).toBe(imp.importoBollo);
    expect(f.totale).toBe(round2(10_000 + 400 + imp.importoBollo));
  });

  /*
    La ritenuta non colpisce l'integrativo: non è compenso del professionista,
    è una somma che attraversa la fattura per finire alla cassa.
  */
  it("la ritenuta d'acconto non si applica all'integrativo", () => {
    const imp = conCassa(FORENSE, { ...impostazioniOrdinario(), ritenutaAttiva: true });
    const f = calcolaFattura(FATTURA, imp, OGGI_FIXTURE);
    expect(f.ritenuta).toBe(round2(10_000 * imp.aliquotaRitenuta)); // 2.000
    expect(f.ritenuta).not.toBe(round2((10_000 + 400) * imp.aliquotaRitenuta));
  });

  it("e non entra nel ricavo rilevante: non è reddito", () => {
    const imp = conCassa(FORENSE);
    expect(calcolaFattura(FATTURA, imp, OGGI_FIXTURE).ricavoRilevante).toBe(10_000);
  });
});

// ————————————————————————————————————————————————————————————
// Le note di credito
// ————————————————————————————————————————————————————————————

describe("le note di credito e l'integrativo", () => {
  const nota: NotaCredito = {
    id: "n1",
    dataDocumento: "2026-06-01",
    numero: "NC/1",
    clienteId: "alfa",
    descrizione: "Storno parziale",
    imponibile: 2_500,
    dataRimborso: "2026-06-10",
    riconciliazioni: [{ fatturaId: "fx", imponibile: 2_500 }],
  };

  /*
    Abbiamo già avuto una ritenuta che non seguiva le note di credito. Lo
    storno dell'integrativo è proporzionale **per costruzione** — è l'aliquota
    applicata all'imponibile stornato — e questo test fissa la proporzione
    confrontando i due percorsi sullo stesso imponibile: la fattura e la nota
    devono dare lo stesso integrativo su 2.500 €.
  */
  it("una nota storna l'integrativo in proporzione all'imponibile", () => {
    const imp = conCassa(FORENSE);
    const n = calcolaNota(nota, imp);
    expect(n.integrativaCassa).toBe(100); // 4 % su 2.500
    expect(n.integrativaCassa).toBe(
      calcolaFattura({ ...FATTURA, imponibile: 2_500 }, imp, OGGI_FIXTURE).integrativaCassa,
    );
    // Un quarto dei compensi stornati, un quarto dell'integrativo.
    expect(n.integrativaCassa / 400).toBeCloseTo(2_500 / 10_000, 10);
  });

  it("e l'IVA della nota si calcola su imponibile più integrativo", () => {
    const n = calcolaNota(nota, conCassa(FORENSE));
    expect(n.iva).toBe(round2((2_500 + 100) * 0.22)); // 572, non 550
    expect(n.totale).toBe(round2(2_500 + 100 + 572));
  });

  it("senza cassa la nota non inventa nessun integrativo", () => {
    const n = calcolaNota(nota, impostazioniOrdinario());
    expect(n.integrativaCassa).toBe(0);
    expect(n.iva).toBe(round2(2_500 * 0.22));
  });

  it("nel prospetto l'integrativo dell'anno è al netto delle note", () => {
    const imp = conCassa(FORENSE);
    const fatture = [FATTURA];
    const pieno = prospettoDi(imp, { fatture, costi: [] });
    const stornato = prospettoDi(imp, { fatture, costi: [], note: [nota] });
    expect(pieno.cassa?.integrativoFatturato).toBe(400);
    expect(stornato.cassa?.integrativoFatturato).toBe(300); // 400 − 100
  });
});

// ————————————————————————————————————————————————————————————
// Il minimo dell'integrativo
// ————————————————————————————————————————————————————————————

describe("il minimo dell'integrativo", () => {
  it("quando le fatture non ci arrivano, la differenza è un costo tuo", () => {
    // 4 % su 5.000 € di compensi = 200, contro un minimo di 400.
    const a = integrativoAnnuo(200, FORENSE);
    expect(a.fatturato).toBe(200);
    expect(a.minimo).toBe(400);
    expect(a.daVersare).toBe(400);
    expect(a.aCarico).toBe(200);
  });

  it("quando le fatture lo superano, non c'è niente a carico", () => {
    const a = integrativoAnnuo(1_600, FORENSE);
    expect(a.daVersare).toBe(1_600);
    expect(a.aCarico).toBe(0);
  });

  it("e il prospetto lo mostra come voce a sé, non sommata al soggettivo", () => {
    const piccola: Fattura = { ...FATTURA, imponibile: 5_000 };
    const p = prospettoDi(conCassa(FORENSE), { fatture: [piccola], costi: [] });
    expect(p.cassa?.integrativoFatturato).toBe(200);
    expect(p.cassa?.integrativoDaVersare).toBe(400);
    expect(p.cassa?.integrativoACarico).toBe(200);
    /*
      Il totale dei contributi del prospetto resta quello che **ti costa** sul
      reddito: soggettivo più quote fisse. L'integrativo non ci entra — lo hai
      incassato dai clienti — e nemmeno la differenza a carico, che è un costo
      ma non un contributo sul reddito: sta nella sua riga perché sommarla
      nasconderebbe l'unico pezzo dell'integrativo che pesa davvero.
    */
    expect(p.totaleContributi).toBe(p.cassa?.dovutoSulReddito);
  });
});

// ————————————————————————————————————————————————————————————
// Il reddito, la soglia, la deducibilità
// ————————————————————————————————————————————————————————————

describe("l'integrativo e il reddito", () => {
  it("non entra nei compensi né nei ricavi rilevanti", () => {
    const p = prospettoDi(conCassa(FORENSE), { fatture: [{ ...FATTURA, dataIncasso: "2026-05-20" }], costi: [] });
    expect(p.compensiIncassati).toBe(10_000);
    expect(p.ricaviRilevanti).toBe(10_000);
    expect(p.rivalsaIncassata).toBe(0);
  });

  /*
    E non conta per la soglia del forfettario. Con 84.800 € di compensi
    l'integrativo del 4 % fa 3.392 €: contarlo porterebbe a 88.192 € e farebbe
    scattare un'uscita dal regime che non è dovuta. Il limite è 85.000 €.
  */
  it("non conta per la soglia del forfettario", () => {
    const grossa: Fattura = { ...FATTURA, imponibile: 84_800, dataIncasso: "2026-05-20" };
    const imp = conCassa(FORENSE, impostazioniForfettario());
    const p = prospettoDi(imp, { fatture: [grossa], costi: [] });
    expect(p.soglia.baseCassa).toBe(84_800);
    expect(p.soglia.baseCassa).toBeLessThan(imp.limiteForfettario);
    expect(p.soglia.stato).toBe("avviso");
    expect(p.soglia.stato).not.toBe("limiteSuperato");
  });
});

describe("la deducibilità del soggettivo e delle quote fisse", () => {
  /*
    In ordinario si deducono dal reddito complessivo come i contributi INPS: il
    reddito imponibile è il lordo meno i contributi. Si verifica sul **meccanismo
    della deduzione**, non su una cifra battuta a mano: `imponibile` deve essere
    esattamente `redditoLordo − contributiDedotti`, e `contributiDedotti` deve
    contenere soggettivo e quote fisse.
  */
  it("in ordinario scendono dal reddito imponibile", () => {
    const imp = conCassa({ ...FORENSE, contributiFissi: 72 });
    const p = prospettoDi(imp);
    expect(p.contributiDedotti).toBe(p.cassa?.dovutoSulReddito);
    expect(p.contributiDedotti).toBe(round2((p.cassa?.soggettivo ?? 0) + 72));
    expect(p.imponibile).toBe(round2(p.redditoLordo - p.contributiDedotti - p.oneriDeducibili));
  });

  it("in forfettario scendono dal reddito forfettario", () => {
    const imp = conCassa({ ...FORENSE, contributiFissi: 72 }, impostazioniForfettario());
    const p = prospettoDi(imp);
    // Il reddito forfettario è ricavi × coefficiente, e i contributi scendono da lì.
    expect(p.redditoLordo).toBe(round2(p.ricaviRilevanti * imp.coefficienteRedditivita));
    expect(p.contributiDedotti).toBe(p.cassa?.dovutoSulReddito);
    expect(p.imponibile).toBe(round2(p.redditoLordo - p.contributiDedotti));
    expect(p.impostaSostitutiva).toBeLessThan(round2(p.redditoLordo * 0.15));
  });

  it("il confronto fra i due regimi usa la cassa da tutte e due le parti", () => {
    const confrontoDi = (imp: Impostazioni) => {
      const p = prospettoDi(imp);
      return confrontaRegimi(
        ingressoDaProspetto({
          ricaviRilevanti: p.ricaviRilevanti,
          costiPagatiTotale: p.costiPagatiTotale,
          costiCalcolati: p.costiCalcolati,
        }),
        imp,
        par,
      );
    };
    /*
      Senza minimo, in questo test, e la ragione è istruttiva: sui numeri della
      fixture — 7.500 € di ricavi — il minimo di 3.000 € fa da pavimento in
      **tutti e due** gli scenari, e il confronto restituisce 3.000 da entrambe
      le parti qualunque sia l'aliquota. È il comportamento giusto, ed è anche
      la ragione per cui un test dell'aliquota con quel minimo non proverebbe
      niente: misurerebbe il pavimento, non l'aliquota.
    */
    const senzaMinimo = { ...FORENSE, minimoSoggettivo: 0 };
    const base = confrontoDi(conCassa(senzaMinimo));
    expect(base.forfettario.contributi).toBeGreaterThan(0);
    expect(base.ordinario.contributi).toBeGreaterThan(0);
    /*
      I due scenari passano dalla stessa `contributiPrevidenziali`, quindi la
      cassa c'è in entrambi. La prova che conta: alzando l'aliquota della cassa
      si muovono **tutti e due** i lati, non uno solo — se uno restasse fermo,
      il confronto direbbe che un regime conviene per una ragione che non
      esiste.
    */
    const alta = confrontoDi(conCassa({ ...senzaMinimo, aliquotaSoggettivo: 0.26 }));
    expect(alta.forfettario.contributi).toBeGreaterThan(base.forfettario.contributi);
    expect(alta.ordinario.contributi).toBeGreaterThan(base.ordinario.contributi);
    // E in Gestione Separata la cassa non entra da nessuno dei due lati.
    const inps = confrontoDi(impostazioniOrdinario());
    expect(inps.forfettario.contributi).not.toBe(base.forfettario.contributi);

    /*
      Il minimo, invece, pareggia i due lati: col minimo di 3.000 € i contributi
      sono 3.000 in entrambi gli scenari, perché su questo reddito nessuna delle
      due aliquote ci arriva. Starebbe bene anche da solo, come test.
    */
    const colMinimo = confrontoDi(conCassa(FORENSE));
    expect(colMinimo.forfettario.contributi).toBe(3_000);
    expect(colMinimo.ordinario.contributi).toBe(3_000);
  });
});

// ————————————————————————————————————————————————————————————
// Il concordato preventivo
// ————————————————————————————————————————————————————————————

describe("la cassa e il concordato preventivo biennale", () => {
  /*
    Con una cassa i contributi si calcolano **sempre** sul reddito effettivo,
    mai su quello concordato: il concordato è un patto con l'Agenzia, e il
    regolamento di una cassa privata non lo conosce.
  */
  it("i contributi restano sul reddito effettivo, non sul concordato", () => {
    const imp: Impostazioni = {
      ...conCassa(FORENSE),
      concordato: {
        aderito: true,
        biennio: "2026-2027",
        tipoAdesione: "primoIngresso",
        dataAdesione: "2026-10-31",
        redditoConcordato: 40_000,
        redditoPrecedenteRettificato: 30_000,
        votoIsa: 9,
        sostitutiva: false,
      },
    };
    const p = prospettoDi(imp);
    expect(p.concordato?.esito.attivo).toBe(true);
    // Le imposte guardano il concordato...
    expect(p.concordato?.redditoConcordato).toBe(40_000);
    // ...i contributi no: la base è il reddito effettivo del prospetto.
    expect(p.baseContributiva).toBe(p.redditoLordo);
    expect(p.baseContributiva).not.toBe(40_000);
    expect(p.cassa?.baseSoggettivo).toBe(p.redditoLordo);
    // E la regola sta in un posto solo, che risponde per la gestione.
    expect(baseContributivaCpb("cassa", 40_000, p.redditoLordo)).toBe(p.redditoLordo);
    expect(baseContributivaCpb("separata", 40_000, p.redditoLordo)).toBe(40_000);
  });

  it("e il soggettivo esce dal reddito effettivo, non dal concordato", () => {
    const effettivo = 20_000;
    expect(contributoSoggettivo(effettivo, FORENSE).applicato).toBe(3_200);
    // Sul concordato sarebbe stato 6.400: un contributo doppio, su un reddito
    // che la cassa non ha mai concordato con nessuno.
    expect(contributoSoggettivo(40_000, FORENSE).applicato).toBe(6_400);
  });
});

// ————————————————————————————————————————————————————————————
// Le validazioni
// ————————————————————————————————————————————————————————————

describe("le validazioni del blocco", () => {
  it("un'aliquota fuori da 0-100 % è un errore", () => {
    expect(erroriCassa({ ...FORENSE, aliquotaSoggettivo: 1.6 })).toHaveLength(1);
    expect(erroriCassa({ ...FORENSE, aliquotaIntegrativo: -0.04 })).toHaveLength(1);
    expect(erroriCassa({ ...FORENSE, aliquotaSoggettivo: 0 })).toHaveLength(0);
    expect(erroriCassa({ ...FORENSE, aliquotaSoggettivo: 1 })).toHaveLength(0);
  });

  it("un importo negativo è un errore", () => {
    expect(erroriCassa({ ...FORENSE, minimoSoggettivo: -1 })).toHaveLength(1);
    expect(erroriCassa({ ...FORENSE, minimoIntegrativo: -1 })).toHaveLength(1);
    expect(erroriCassa({ ...FORENSE, contributiFissi: -1 })).toHaveLength(1);
  });

  it("con dati non validi non si calcola niente, e l'avviso lo dice", () => {
    const esito = valutaCassa(conCassa({ ...FORENSE, aliquotaSoggettivo: 1.6 }), {
      redditoImponibile: 40_000,
      integrativoFatturato: 1_000,
    });
    expect(esito?.valida).toBe(false);
    expect(esito?.configurata).toBe(false);
    expect(esito?.dovutoSulReddito).toBe(0);
    expect(esito?.integrativo.daVersare).toBe(0);
    expect(esito?.avvisi.map((a) => a.codice)).toContain("datiNonValidi");
  });

  /*
    La cassa scelta e il soggettivo vuoto: è lo stato di chi ha appena cambiato
    gestione. I contributi restano zero — e l'avviso è la ragione per cui quello
    zero non è una bugia. Senza, a schermo si vedrebbe una cifra che sembra una
    risposta.
  */
  it("cassa scelta e aliquota vuota: contributi a zero, con un avviso", () => {
    const imp = conCassa({ ...cassaPredefinita(), nome: "" });
    const esito = valutaCassa(imp, { redditoImponibile: 40_000 });
    expect(esito?.valida).toBe(true);
    expect(esito?.configurata).toBe(false);
    expect(esito?.dovutoSulReddito).toBe(0);
    expect(esito?.avvisi.map((a) => a.codice)).toContain("aliquotaMancante");

    // E il prospetto porta l'avviso fino alle schermate.
    const p = prospettoDi(imp);
    expect(p.contributiCassa).toBe(0);
    expect(p.cassa?.configurata).toBe(false);
    expect(p.cassa?.avvisi.map((a) => a.codice)).toContain("aliquotaMancante");
    expect(p.cassa?.nome).toBe("Cassa professionale");
  });

  it("compilata a metà: soggettivo sì, integrativo no, e lo dice", () => {
    const esito = valutaCassa(conCassa({ ...FORENSE, aliquotaIntegrativo: null }), {
      redditoImponibile: 40_000,
    });
    expect(esito?.configurata).toBe(true);
    expect(esito?.soggettivo.applicato).toBe(6_400);
    expect(esito?.avvisi.map((a) => a.codice)).toContain("integrativoMancante");
  });

  it("il nome vuoto non lascia mai una riga muta", () => {
    expect(nomeCassa(cassaPredefinita())).toBe("Cassa professionale");
    expect(nomeCassa({ ...FORENSE, nome: "   " })).toBe("Cassa professionale");
    expect(nomeCassa(FORENSE)).toBe("Cassa Forense");
  });
});

// ————————————————————————————————————————————————————————————
// Il nome, nelle schermate
// ————————————————————————————————————————————————————————————

describe("dove compariva «Gestione Separata INPS»", () => {
  it("con una cassa compare il nome della cassa", () => {
    expect(nomePrevidenza(impostazioniOrdinario())).toBe("Gestione Separata INPS");
    expect(nomePrevidenza(conCassa(FORENSE))).toBe("Cassa Forense");
    expect(nomePrevidenza(conCassa({ ...FORENSE, nome: "" }))).toBe("Cassa professionale");
  });

  it("e il prospetto lo porta con sé", () => {
    expect(prospettoDi(conCassa(FORENSE)).cassa?.nome).toBe("Cassa Forense");
    expect(prospettoDi(impostazioniOrdinario()).cassa).toBeNull();
  });
});

// ————————————————————————————————————————————————————————————
// L'accantonamento e lo scadenzario
// ————————————————————————————————————————————————————————————

describe("l'accantonamento e le date che non ci sono", () => {
  function quotaDi(imp: Impostazioni) {
    const p = prospettoDi(imp);
    return quotaAccantonamento({
      prospetto: p,
      impostazioni: imp,
      parametri: par,
      iva: calcolaIva(p.fattureCalcolate, p.costiCalcolati, imp, par),
      precedente: null,
      versamenti: [],
      oggi: OGGI_FIXTURE,
    });
  }

  it("i contributi della cassa si stendono uniformi sui mesi che restano", () => {
    const q = quotaDi(conCassa(FORENSE));
    expect(q.cassa.daAccantonare).toBeGreaterThan(0);
    // Settembre: restano quattro mesi, questo compreso.
    expect(q.cassa.alMese).toBe(round2(q.cassa.daAccantonare / 4));
    // Nessuna voce: non ci sono date da elencare, e non se ne inventano.
    expect(q.cassa.voci).toEqual([]);
  });

  it("e non si contano due volte: la parte sul reddito esce da «imposte»", () => {
    const imp = conCassa(FORENSE);
    const p = prospettoDi(imp);
    const q = quotaDi(imp);
    const sulRedditoNelFabbisogno = Math.min(
      p.cassa?.dovutoSulReddito ?? 0,
      p.fabbisognoDaAccantonare,
    );
    expect(q.imposte.daAccantonare).toBe(
      round2(p.fabbisognoDaAccantonare - sulRedditoNelFabbisogno),
    );
    // L'integrativo invece si aggiunge: nel fabbisogno non c'era.
    expect(q.cassa.daAccantonare).toBe(
      round2(sulRedditoNelFabbisogno + (p.cassa?.integrativoDaVersare ?? 0)),
    );
  });

  it("senza cassa la terza parte è vuota e niente cambia", () => {
    const q = quotaDi(impostazioniOrdinario());
    expect(q.cassa).toEqual({ alMese: 0, daAccantonare: 0, voci: [] });
    const p = prospettoDi(impostazioniOrdinario());
    expect(q.imposte.daAccantonare).toBe(p.fabbisognoDaAccantonare);
  });

  it("lo scadenzario tiene una voce informativa senza data", () => {
    const voci = adempimentiSenzaData(conCassa(FORENSE));
    expect(voci).toHaveLength(1);
    expect(voci[0].titolo).toBe(
      "Contributi cassa: le date di versamento dipendono dalla tua cassa",
    );
    expect(adempimentiSenzaData(impostazioniOrdinario())).toEqual([]);
  });
});

// ————————————————————————————————————————————————————————————
// Gli archivi vecchi, e il cambio di gestione
// ————————————————————————————————————————————————————————————

describe("gli archivi che la cassa non la conoscono", () => {
  /*
    Un file scritto prima che il blocco esistesse, col marcatore di un nome
    precedente del progetto. L'assenza ha un significato preciso — Gestione
    Separata — e va letta così, senza errori e senza avvisi. È il difetto già
    succeduto una volta col regime: un campo nuovo che su un file vecchio entra
    con un valore inventato.
  */
  const vecchio = {
    formato: "freelance-finance-os",
    versioneSchema: 11,
    esportatoIl: "2026-01-10T10:00:00.000Z",
    dati: {
      impostazioni: [
        {
          anno: 2026,
          nome: "Prova",
          regime: "ordinario",
          gruppoAteco: "professionali",
          coefficienteRedditivita: 0.78,
          scaglioniIrpef: [
            { limite: 28_000, aliquota: 0.23 },
            { limite: 50_000, aliquota: 0.43 },
            { limite: null, aliquota: 0.43 },
          ],
          gestione: "separata",
          // I due numeri sciolti di allora: c'erano su ogni riga, anche a chi
          // non aveva nessuna cassa.
          aliquotaSoggettivaCassa: 0.15,
          aliquotaIntegrativaCassa: 0.04,
          rivalsaAttiva: true,
        },
      ],
    },
  };

  it("entra senza errori, resta in Gestione Separata e la cassa è vuota", () => {
    const esito = analizzaBackup(JSON.stringify(vecchio));
    expect(esito.ok, esito.ok ? "" : esito.errori.join(" · ")).toBe(true);
    if (!esito.ok) return;
    const imp = esito.backup.dati.impostazioni[0];
    expect(imp.gestione).toBe("separata");
    expect(imp.cassa).toBeDefined();
    expect(imp.cassa?.aliquotaSoggettivo).toBeNull();
    expect(imp.cassa?.aliquotaIntegrativo).toBeNull();
    expect(imp.cassa?.minimoSoggettivo).toBe(0);
    // Nessun avviso parla di cassa: non c'era, e non doveva esserci.
    expect(esito.avvisi.join(" ")).not.toMatch(/cassa/i);
  });

  it("e il motore, su quelle impostazioni, non calcola nessun contributo di cassa", () => {
    const esito = analizzaBackup(JSON.stringify(vecchio));
    if (!esito.ok) throw new Error(esito.errori.join(" · "));
    const imp = esito.backup.dati.impostazioni[0];
    expect(eCassa(imp)).toBe(false);
    expect(prospettoDi(imp).cassa).toBeNull();
    expect(prospettoDi(imp).contributiCassa).toBe(0);
    // La rivalsa, che era attiva, continua a funzionare come prima.
    expect(calcolaFattura(FATTURA, imp, OGGI_FIXTURE).rivalsa).toBe(
      round2(10_000 * imp.aliquotaRivalsa),
    );
  });

  /*
    E un archivio vecchio che **era** in cassa: l'integrativo del 4 % stava
    sulle fatture emesse, perché la rivalsa era accesa, e si recupera —
    cambiarlo cambierebbe i totali di documenti già mandati ai clienti. Il
    15 % del soggettivo no: era la media dell'app, non dichiarata da nessuno.
  */
  it("chi era già in cassa tiene l'integrativo delle fatture emesse, non il 15 %", () => {
    const inCassa = structuredClone(vecchio);
    inCassa.dati.impostazioni[0].gestione = "cassa";
    const esito = analizzaBackup(JSON.stringify(inCassa));
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    const c = esito.backup.dati.impostazioni[0].cassa;
    expect(c?.aliquotaIntegrativo).toBe(0.04);
    expect(c?.aliquotaSoggettivo).toBeNull();
    // E l'avviso nomina quello che manca, perché va compilato.
    expect(esito.avvisi.join(" ")).toMatch(/cassa professionale/i);
  });

  it("un oggetto senza il campo si legge come «cassa non configurata», senza lanciare", () => {
    const imp: Impostazioni = { ...impostazioniOrdinario(), anno: 2026 };
    delete (imp as { cassa?: unknown }).cassa;
    expect(() => cassaDi(imp)).not.toThrow();
    expect(cassaDi(imp)).toEqual(cassaPredefinita());
    expect(valutaCassa(imp, { redditoImponibile: 40_000 })).toBeNull();
    expect(contributiPrevidenziali(40_000, imp, par).cassa).toBe(0);
  });
});

describe("cambiare gestione e tornare indietro", () => {
  /*
    Il dato della cassa **non si cancella** passando all'INPS, e non è una
    dimenticanza: chi torna indietro ritrova le sue aliquote invece di
    ricompilarle. Quello che conta è che non vengano **usate**: la condizione
    sta nella gestione, e il motore la legge da `eCassa`.
  */
  it("tornando all'INPS la cassa non calcola più niente, ma i dati restano", () => {
    const inCassa = conCassa(FORENSE);
    expect(prospettoDi(inCassa).contributiCassa).toBeGreaterThan(0);

    const tornato: Impostazioni = { ...inCassa, gestione: "separata" };
    expect(prospettoDi(tornato).contributiCassa).toBe(0);
    expect(prospettoDi(tornato).cassa).toBeNull();
    expect(prospettoDi(tornato).contributiGestioneSeparata).toBeGreaterThan(0);
    // Il blocco è ancora lì, intatto.
    expect(cassaDi(tornato)).toEqual(FORENSE);
    // E in fattura torna la rivalsa, non l'integrativo.
    const f = calcolaFattura(FATTURA, { ...tornato, rivalsaAttiva: true }, OGGI_FIXTURE);
    expect(f.integrativaCassa).toBe(0);
    expect(f.rivalsa).toBe(round2(10_000 * tornato.aliquotaRivalsa));

    // E ritornando in cassa i numeri sono esattamente quelli di prima.
    const diNuovo: Impostazioni = { ...tornato, gestione: "cassa" };
    expect(prospettoDi(diNuovo).contributiCassa).toBe(prospettoDi(inCassa).contributiCassa);
  });

  it("l'anno nuovo eredita la cassa intera", () => {
    const seguente = impostazioniDaPrecedente(PARAMETRI_2026, 2027, conCassa(FORENSE));
    expect(seguente.gestione).toBe("cassa");
    expect(cassaDi(seguente)).toEqual(FORENSE);
    // Una copia, non lo stesso oggetto: modificare il 2027 non tocca il 2026.
    expect(seguente.cassa).not.toBe(conCassa(FORENSE).cassa);
  });

  it("il predefinito di tutti resta la Gestione Separata", () => {
    const imp = impostazioniOrdinario();
    expect(imp.gestione).toBe("separata");
    expect(cassaDi(imp).aliquotaSoggettivo).toBeNull();
    expect(cassaDi(imp).aliquotaIntegrativo).toBeNull();
    expect(cassaDi(imp).nome).toBe("");
  });
});

// ————————————————————————————————————————————————————————————
// Il caso del riepilogo, da cima a fondo
// ————————————————————————————————————————————————————————————

describe("l'avvocato in forfettario del riepilogo", () => {
  /*
    40.000 € di compensi, soggettivo 16 % con minimo 3.000, integrativo 4 % con
    minimo 400. È l'esempio che il riepilogo descrive, e sta qui perché un
    esempio scritto in un documento e non misurato da nessuna parte è il primo a
    diventare falso.

      compensi incassati                 40.000,00
      integrativo in fattura   4 %        1.600,00   (non è reddito)
      reddito forfettario      × 78 %    31.200,00
      soggettivo               16 %       4.992,00   (sopra il minimo di 3.000)
      integrativo da versare              1.600,00   (sopra il minimo di 400)
  */
  const compensi: Fattura[] = [
    { ...FATTURA, id: "a1", imponibile: 40_000, dataIncasso: "2026-05-20" },
  ];
  const imp = conCassa(FORENSE, impostazioniForfettario());

  it("i numeri che il riepilogo promette", () => {
    const p = prospettoDi(imp, { fatture: compensi, costi: [] });
    expect(p.ricaviRilevanti).toBe(40_000);
    expect(p.redditoLordo).toBe(round2(40_000 * imp.coefficienteRedditivita));
    expect(p.redditoLordo).toBe(31_200);
    expect(p.cassa?.soggettivo).toBe(round2(31_200 * 0.16)); // 4.992
    expect(p.cassa?.soggettivoAlMinimo).toBe(false);
    expect(p.cassa?.integrativoFatturato).toBe(1_600);
    expect(p.cassa?.integrativoDaVersare).toBe(1_600);
    expect(p.cassa?.integrativoACarico).toBe(0);
    expect(p.contributiCassa).toBe(4_992);
    expect(p.imponibile).toBe(round2(31_200 - 4_992));
  });

  it("e la fattura che li produce", () => {
    const f = calcolaFattura(compensi[0], imp, OGGI_FIXTURE);
    expect(f.imponibile).toBe(40_000);
    expect(f.integrativaCassa).toBe(1_600);
    expect(f.iva).toBe(0); // forfettario
    expect(f.rivalsa).toBe(0);
    expect(f.ritenuta).toBe(0); // forfettario
    // 40.000 + 1.600 di integrativo + 2 di bollo: l'operazione è fuori campo IVA.
    expect(f.totale).toBe(round2(41_600 + imp.importoBollo));
    expect(f.ricavoRilevante).toBe(40_000);
  });

  it("con un anno magro il minimo del soggettivo morde", () => {
    // 10.000 di compensi → 7.800 di reddito → 1.248 di aliquota, sotto i 3.000.
    const magro: Fattura[] = [{ ...FATTURA, id: "a2", imponibile: 10_000, dataIncasso: "2026-05-20" }];
    const p = prospettoDi(imp, { fatture: magro, costi: [] });
    expect(p.redditoLordo).toBe(7_800);
    expect(p.cassa?.soggettivoCalcolato).toBe(1_248);
    expect(p.cassa?.soggettivo).toBe(3_000);
    expect(p.cassa?.soggettivoAlMinimo).toBe(true);
    expect(p.contributiCassa).toBe(3_000);
    // E l'integrativo, 400 € esatti, è proprio il minimo: niente a carico.
    expect(p.cassa?.integrativoFatturato).toBe(400);
    expect(p.cassa?.integrativoACarico).toBe(0);
  });
});

describe("l'integrativo su un imponibile, nudo", () => {
  it("è l'aliquota applicata all'imponibile, e zero senza aliquota", () => {
    expect(integrativoSu(10_000, FORENSE)).toBe(400);
    expect(integrativoSu(0, FORENSE)).toBe(0);
    expect(integrativoSu(10_000, cassaPredefinita())).toBe(0);
    // `round2`, non un troncamento: 1.234,56 × 4 % = 49,3824 → 49,38.
    expect(integrativoSu(1_234.56, FORENSE)).toBe(49.38);
  });
});
