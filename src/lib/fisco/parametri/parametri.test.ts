/**
 * Le costanti di legge, asserite una per una contro la loro fonte.
 *
 * `parametri/<anno>.ts` è l'unico file del progetto che contiene **solo**
 * numeri che nessuno ricalcola. Ogni altra parte del motore ha un test che la
 * esercita: si dà un input, si guarda l'output, e se la formula è sbagliata il
 * numero cambia. Qui no — qui il numero *è* il dato, e un 35 scritto 53 produce
 * un prospetto perfettamente coerente e completamente falso.
 *
 * Questo file è nato dopo un difetto di quella forma. Il dataset da vetrina
 * portava due aliquote regionali sbagliate — i valori precedenti alla riforma
 * del 2025 — e sono rimaste lì senza che un solo test diventasse rosso, perché
 * l'imponibile del dataset non arrivava a quelle fasce. Nessun importo
 * cambiava. Un test sugli effetti non verifica un dato che gli effetti non
 * attraversano; l'unica difesa è confrontare il valore **scritto** con quello
 * pubblicato.
 *
 * Da qui la regola di questo file: **ogni asserzione porta accanto la sua
 * fonte**. Un test che dice «35 %» senza dire da dove viene protegge dalla
 * distrazione di domani, non dall'errore di oggi — e l'errore di oggi è quello
 * che poi si copia negli anni successivi.
 *
 * Che cosa questo file NON fa: non verifica che i valori siano quelli giusti
 * — nessun test può, sono fatti del mondo. Li fissa, con la fonte accanto, così
 * che cambiarli sia un gesto deliberato e ricontrollabile invece di una riga
 * modificata di passaggio. Dove la fonte è una circolare che l'autore non ha
 * potuto leggere, il commento lo dice.
 */
import { describe, expect, it } from "vitest";
import { PARAMETRI_2025 } from "./2025";
import { PARAMETRI_2026 } from "./2026";
import { PARAMETRI_2027 } from "./2027";
import { PARAMETRI_PER_ANNO, ANNO_DEFINITIVO_PIU_RECENTE, parametriDi } from ".";
import { impostaProgressiva } from "../scaglioni";
import type { ParametriAnno, ScaglioneIrpef } from "../tipi";

/** Gli scaglioni in forma leggibile, per confrontarli in un colpo d'occhio. */
const forma = (s: readonly ScaglioneIrpef[]) => s.map((x) => [x.limite, x.aliquota]);

// ————————————————————————————————————————————————————————————
// IRPEF
// ————————————————————————————————————————————————————————————

describe("IRPEF · scaglioni e aliquote", () => {
  /*
    Tre scaglioni, resi strutturali dalla Legge di Bilancio 2025 (L. 207/2024),
    che ha consolidato l'accorpamento dei primi due introdotto in via transitoria
    per il 2024. Prima erano quattro.

    La differenza fra i due anni è **una sola**, ed è la ragione per cui
    `2025.ts` esiste come file a sé invece di lasciare che l'app ricada sui
    parametri dell'anno più vicino: lo scaglione centrale scende dal 35 % al
    33 % con la Legge di Bilancio 2026. Chi ha lavorato in ordinario nel 2025
    paga con il 35 %, e un prospetto 2025 calcolato al 33 % sarebbe più basso
    del vero senza che niente lo segnali.
  */
  it("2025: 23 % fino a 28.000, 35 % fino a 50.000, 43 % oltre — L. 207/2024", () => {
    expect(forma(PARAMETRI_2025.scaglioniIrpef)).toEqual([
      [28_000, 0.23],
      [50_000, 0.35],
      [null, 0.43],
    ]);
  });

  /*
    Art. 1 commi 3 e 4 della legge n. 199/2025 (Legge di Bilancio 2026), come
    riepilogati dall'Agenzia delle Entrate nella pagina «Aliquote e calcolo
    dell'Irpef» aggiornata al 13 gennaio 2026: 23 % fino a 28.000, 33 % da
    28.001 a 50.000, 43 % oltre.
  */
  it("2026: lo scaglione centrale scende al 33 % — art. 1 c. 3-4 L. 199/2025", () => {
    expect(forma(PARAMETRI_2026.scaglioniIrpef)).toEqual([
      [28_000, 0.23],
      [50_000, 0.33],
      [null, 0.43],
    ]);
  });

  /*
    L'Agenzia pubblica anche la forma abbreviata: sopra i 50.000 l'imposta è
    13.700 € più il 43 % sull'eccedenza. Era 14.140 € con il 35 %.

    Vale più delle tre aliquote messe in fila, perché è un numero **derivato**:
    se una soglia o un'aliquota fosse sbagliata, la somma non tornerebbe. È il
    controllo incrociato che gli scaglioni da soli non danno.
  */
  it("a 50.000 € l'IRPEF è 13.700 € nel 2026 e 14.140 € nel 2025", () => {
    expect(impostaProgressiva(50_000, PARAMETRI_2026.scaglioniIrpef)).toBe(13_700);
    expect(impostaProgressiva(50_000, PARAMETRI_2025.scaglioniIrpef)).toBe(14_140);
    // E oltre: 13.700 più il 43 % dell'eccedenza.
    expect(impostaProgressiva(60_000, PARAMETRI_2026.scaglioniIrpef)).toBe(13_700 + 0.43 * 10_000);
  });

  it("le soglie non si muovono fra i due anni: cambia solo l'aliquota centrale", () => {
    // Se un domani cambiassero anche le soglie, questo test va aggiornato
    // insieme ai due sopra — e va aggiornato a mano, che è il punto.
    expect(PARAMETRI_2025.scaglioniIrpef.map((s) => s.limite)).toEqual(
      PARAMETRI_2026.scaglioniIrpef.map((s) => s.limite),
    );
    expect(PARAMETRI_2025.scaglioniIrpef[1].aliquota).not.toBe(
      PARAMETRI_2026.scaglioniIrpef[1].aliquota,
    );
  });

  /*
    Detrazione per redditi di lavoro autonomo — art. 13 comma 5 e 5-bis TUIR,
    nella formulazione della L. 234/2021 (Legge di Bilancio 2022), invariata nei
    due anni:

      RC ≤ 5.500                →  1.265 €
      5.500 < RC ≤ 28.000       →  500 + 765 × (28.000 − RC) ÷ (28.000 − 5.500)
      28.000 < RC ≤ 50.000      →  500 × (50.000 − RC) ÷ (50.000 − 28.000)
      11.000 < RC ≤ 17.000      →  + 50 €

    I sette campi qui sotto sono esattamente i sette numeri di quella spezzata.
  */
  it("detrazione art. 13 TUIR: la spezzata della L. 234/2021, uguale nei due anni", () => {
    const atteso = {
      sogliaPiena: 5_500,
      importoPieno: 1_265,
      sogliaMedia: 28_000,
      importoFisso: 500,
      quotaDecrescente: 765,
      sogliaAzzeramento: 50_000,
      maggiorazione: { importo: 50, da: 11_000, a: 17_000 },
    };
    expect(PARAMETRI_2026.detrazioneLavoroAutonomo).toEqual(atteso);
    expect(PARAMETRI_2025.detrazioneLavoroAutonomo).toEqual(atteso);
  });

  it("il tetto di deducibilità del fondo pensione è 5.164,57 € — art. 10 c. 1 lett. e-bis TUIR", () => {
    expect(PARAMETRI_2026.tettoFondoPensione).toBe(5_164.57);
    expect(PARAMETRI_2025.tettoFondoPensione).toBe(5_164.57);
  });
});

// ————————————————————————————————————————————————————————————
// Regime forfettario
// ————————————————————————————————————————————————————————————

describe("forfettario · limiti, aliquote, coefficienti", () => {
  /*
    Limite di ricavi 85.000 €: art. 1 c. 54 L. 190/2014, come elevato dalla
    L. 197/2022 (Legge di Bilancio 2023) da 65.000 a 85.000.

    Soglia di uscita immediata 100.000 €: art. 1 c. 71 L. 190/2014, introdotta
    dalla stessa legge. Superarla fa decadere il regime **nell'anno stesso**,
    non dall'anno dopo: è una soglia diversa dalla prima, non un suo multiplo.
  */
  it("limite 85.000 € e uscita immediata a 100.000 € — L. 190/2014 come mod. da L. 197/2022", () => {
    for (const par of [PARAMETRI_2025, PARAMETRI_2026]) {
      expect(par.limiteForfettario).toBe(85_000);
      expect(par.sogliaUscitaImmediata).toBe(100_000);
    }
  });

  it("imposta sostitutiva 15 %, ridotta al 5 % per cinque anni — art. 1 c. 64 e 65 L. 190/2014", () => {
    for (const par of [PARAMETRI_2025, PARAMETRI_2026]) {
      expect(par.aliquotaSostitutiva).toBe(0.15);
      expect(par.aliquotaSostitutivaNuovaAttivita).toBe(0.05);
      expect(par.anniNuovaAttivita).toBe(5);
    }
  });

  /*
    Coefficienti di redditività — Allegato n. 2 alla L. 190/2014, mai modificato
    dall'introduzione del regime.

    Sono nove gruppi, e l'elenco è chiuso: un codice ATECO che non ricade in
    nessuno di questi non esiste nel regime. Il coefficiente è la parte di
    ricavi che lo Stato presume essere reddito — cambiarne uno significa
    cambiare l'imposta di tutti quelli che ci ricadono, senza che nessun altro
    numero del motore se ne accorga.
  */
  it("i nove coefficienti dell'Allegato 2 alla L. 190/2014", () => {
    const atteso: Record<string, number> = {
      professionali: 0.78,   // 64-66, 69-75, 85, 86-88
      altre: 0.67,           // attività non altrimenti classificate
      costruzioni: 0.86,     // 41, 42, 43, 68
      intermediari: 0.62,    // 46.1
      commercio: 0.4,        // 45, 46.2-46.9, 47.1-47.7, 47.9
      ambulanteAlimentari: 0.4, // 47.81
      ambulanteAltri: 0.54,  // 47.82-47.89
      alimentari: 0.4,       // 10-11
      ristorazione: 0.4,     // 55-56
    };
    for (const par of [PARAMETRI_2025, PARAMETRI_2026]) {
      const scritti = Object.fromEntries(par.gruppiAteco.map((g) => [g.codice, g.coefficiente]));
      expect(scritti).toEqual(atteso);
      // L'elenco è chiuso: un gruppo in più o in meno va deciso, non subìto.
      expect(par.gruppiAteco).toHaveLength(9);
    }
  });
});

// ————————————————————————————————————————————————————————————
// Previdenza
// ————————————————————————————————————————————————————————————

describe("previdenza · aliquote, minimali, massimali", () => {
  /*
    Gestione Separata, professionisti senza altra copertura: 26,07 %.
    È 25 % di aliquota IVS più 0,72 % (maternità, ANF, malattia, congedo
    parentale) più 0,35 % (ISCRO, art. 1 c. 398 L. 234/2021). Invariata fra il
    2025 e il 2026.

    Artigiani e commercianti, quota sull'eccedenza del minimale: 24,48 %, dalla
    circolare INPS di inizio anno. L'app tiene **una sola** aliquota per le due
    gestioni, che l'INPS pubblica separate: è un'approssimazione dichiarata in
    APPROSSIMAZIONI.md, e questo test fissa il valore usato, non la differenza
    fra le due gestioni.
  */
  it("Gestione Separata al 26,07 % in tutti e due gli anni — circolari INPS di inizio anno", () => {
    expect(PARAMETRI_2025.aliquotaGestioneSeparata).toBe(0.2607);
    expect(PARAMETRI_2026.aliquotaGestioneSeparata).toBe(0.2607);
  });

  /*
    Artigiani e commercianti 2026 — Circolare INPS n. 14 del 9 febbraio 2026.

    par. 1: artigiani 24 %, commercianti 24,48 %. Lo 0,48 % di differenza è
    l'aliquota aggiuntiva dovuta dai soli commercianti per l'indennizzo di
    cessazione (art. 5 D.Lgs. 207/1996). Erano una voce sola, e l'artigiano
    pagava lo 0,48 % di troppo su tutto il reddito eccedente il minimale.

    par. 3: oltre la prima fascia di retribuzione pensionabile l'aliquota sale
    di un punto (art. 3-ter D.L. 384/1992, conv. L. 438/1992).

    par. 2: i contributi fissi sono importi, non percentuali — la quota di
    maternità è 0,62 € al mese, cioè 7,44 € l'anno, e negli artigiani si somma
    ai 4.513,92 € di IVS.
  */
  it("2026 · aliquote e fissi di artigiani e commercianti — circ. INPS 14/2026 par. 1, 2 e 3", () => {
    expect(PARAMETRI_2026.artigianiCommercianti.artigiani).toEqual({
      fissi: 4_521.36,
      aliquota: 0.24,
      aliquotaOltreFascia: 0.25,
    });
    expect(PARAMETRI_2026.artigianiCommercianti.commercianti).toEqual({
      fissi: 4_611.64,
      aliquota: 0.2448,
      aliquotaOltreFascia: 0.2548,
    });
  });

  it("lo scarto fra le due gestioni è esattamente lo 0,48 % dei commercianti", () => {
    const { artigiani, commercianti } = PARAMETRI_2026.artigianiCommercianti;
    expect(commercianti.aliquota - artigiani.aliquota).toBeCloseTo(0.0048, 10);
    expect(commercianti.aliquotaOltreFascia - artigiani.aliquotaOltreFascia).toBeCloseTo(0.0048, 10);
  });

  it("oltre la prima fascia l'aliquota sale di un punto esatto, in tutte e due", () => {
    for (const g of ["artigiani", "commercianti"] as const) {
      const s = PARAMETRI_2026.artigianiCommercianti[g];
      expect(s.aliquotaOltreFascia - s.aliquota).toBeCloseTo(0.01, 10);
    }
  });

  it("prima fascia 56.224 € e massimale 122.295 € — circ. INPS 14/2026 par. 3 e 4", () => {
    expect(PARAMETRI_2026.artigianiCommercianti.primaFasciaPensionabile).toBe(56_224);
    expect(PARAMETRI_2026.artigianiCommercianti.massimale).toBe(122_295);
  });

  /*
    Il massimale è un numero solo che serve due gestioni: discende dall'art. 2
    comma 18 della L. 335/1995, e vale sia per la Gestione Separata sia per i
    «nuovi iscritti» di artigiani e commercianti — chi è privo di anzianità
    contributiva al 31 dicembre 1995. Se un domani divergessero, uno dei due
    starebbe citando la norma sbagliata.
  */
  it("il massimale della Separata e quello di artigiani e commercianti coincidono", () => {
    for (const par of [PARAMETRI_2025, PARAMETRI_2026]) {
      expect(par.artigianiCommercianti.massimale).toBe(par.massimaleGestioneSeparata);
    }
  });

  it("il minimale è una costante sola, non due copie che divergono", () => {
    for (const par of [PARAMETRI_2025, PARAMETRI_2026]) {
      expect(par.artigianiCommercianti.minimale).toBe(par.minimaleAnnuo);
    }
  });

  /*
    Due valori del 2025 sono ereditati dal 2026 e non verificati: la prima
    fascia pensionabile e i due importi dei contributi fissi, che si rivalutano
    ogni anno come il minimale. Questo test **non** li dichiara giusti: fissa
    che sono ancora quelli del 2026, così quando arriveranno i valori veri il
    test cade e ricorda che vanno messi.
  */
  it("2025 · fissi e prima fascia sono ancora quelli del 2026, in attesa della circolare", () => {
    expect(PARAMETRI_2025.artigianiCommercianti.primaFasciaPensionabile).toBe(
      PARAMETRI_2026.artigianiCommercianti.primaFasciaPensionabile,
    );
    expect(PARAMETRI_2025.artigianiCommercianti.artigiani.fissi).toBe(
      PARAMETRI_2026.artigianiCommercianti.artigiani.fissi,
    );
    // Minimale e massimale invece sono quelli veri del 2025.
    expect(PARAMETRI_2025.artigianiCommercianti.minimale).toBe(18_555);
    expect(PARAMETRI_2025.artigianiCommercianti.massimale).toBe(120_607);
  });

  /*
    Minimale e massimale si rivalutano ogni anno con l'indice ISTAT dei prezzi
    al consumo, e l'INPS li pubblica in una circolare a gennaio o febbraio. Sono
    gli unici valori di questo file che **cambiano per forza tutti gli anni**:
    trovarne due uguali in anni diversi è di per sé un sospetto.

    Nota su chi legge questo test: i valori 2026 sono presi dalla circolare
    citata in `fonti` e non sono stati riletti sul documento originale. Vanno
    riconfermati al primo gennaio utile — e il test serve proprio a rendere
    quella riconferma una modifica visibile.
  */
  it("minimale di reddito annuo: 18.555 € nel 2025, 18.808 € nel 2026 — circolari INPS", () => {
    expect(PARAMETRI_2025.minimaleAnnuo).toBe(18_555);
    expect(PARAMETRI_2026.minimaleAnnuo).toBe(18_808);
  });

  it("massimale: 120.607 € nel 2025, 122.295 € nel 2026 — circ. INPS 14/2026 par. 4, art. 2 c. 18 L. 335/1995", () => {
    expect(PARAMETRI_2025.massimaleGestioneSeparata).toBe(120_607);
    expect(PARAMETRI_2026.massimaleGestioneSeparata).toBe(122_295);
  });

  it("minimale e massimale si rivalutano: due anni non possono averli uguali", () => {
    expect(PARAMETRI_2026.minimaleAnnuo).toBeGreaterThan(PARAMETRI_2025.minimaleAnnuo);
    expect(PARAMETRI_2026.massimaleGestioneSeparata).toBeGreaterThan(
      PARAMETRI_2025.massimaleGestioneSeparata,
    );
  });

  /*
    Come si versano in acconto i contributi, gestione per gestione. Non è la
    regola delle imposte, ed è la ragione per cui questi campi esistono.

    Gestione Separata: 80 % del dovuto, in due rate del 40 % alle scadenze del
    primo e del secondo acconto IRPEF (regole di riscossione del quadro RR,
    richiamate ogni anno nella circolare INPS).

    Artigiani e commercianti: il contributo sull'eccedenza del minimale si versa
    per intero in due rate del 50 %. I contributi sul minimale non hanno acconto
    — vanno in quattro rate fisse — e infatti restano fuori dalla base.

    Casse professionali: `null`, perché ogni cassa ha il suo regolamento e l'app
    non li conosce. Meglio nessun acconto che un acconto inventato.
  */
  it("acconto dei contributi: 80 % in due rate per la Separata, 100 % in due per gli artigiani", () => {
    for (const par of [PARAMETRI_2025, PARAMETRI_2026]) {
      expect(par.accontoContributi.separata).toEqual({ quota: 0.8, rate: 2 });
      expect(par.accontoContributi.artigiani).toEqual({ quota: 1, rate: 2 });
      expect(par.accontoContributi.cassa).toBeNull();
    }
  });
});

// ————————————————————————————————————————————————————————————
// IVA, ritenute, bollo
// ————————————————————————————————————————————————————————————

describe("IVA, ritenuta d'acconto, rivalsa e bollo", () => {
  it("aliquota IVA ordinaria al 22 % — art. 16 DPR 633/1972", () => {
    expect(PARAMETRI_2025.aliquotaIvaOrdinaria).toBe(0.22);
    expect(PARAMETRI_2026.aliquotaIvaOrdinaria).toBe(0.22);
  });

  /*
    Maggiorazione dell'1 % sulle liquidazioni trimestrali: art. 7 DPR 542/1999.
    Non si applica al quarto trimestre, che confluisce nella dichiarazione
    annuale — è un `false` che vale come un numero, perché applicarla anche lì
    gonficerebbe l'ultima liquidazione dell'anno di un punto percentuale.
  */
  it("maggiorazione trimestrale dell'1 %, mai sul quarto trimestre — art. 7 DPR 542/1999", () => {
    for (const par of [PARAMETRI_2025, PARAMETRI_2026]) {
      expect(par.maggiorazioneTrimestrale).toBe(0.01);
      expect(par.maggiorazioneSuQuartoTrimestre).toBe(false);
    }
  });

  it("ritenuta d'acconto al 20 % — art. 25 DPR 600/1973", () => {
    expect(PARAMETRI_2025.aliquotaRitenuta).toBe(0.2);
    expect(PARAMETRI_2026.aliquotaRitenuta).toBe(0.2);
  });

  it("rivalsa INPS al 4 % — art. 1 c. 212 L. 662/1996", () => {
    expect(PARAMETRI_2025.aliquotaRivalsaInps).toBe(0.04);
    expect(PARAMETRI_2026.aliquotaRivalsaInps).toBe(0.04);
  });

  it("bollo da 2 € sulle fatture senza IVA oltre 77,47 € — DPR 642/1972, tariffa art. 13", () => {
    for (const par of [PARAMETRI_2025, PARAMETRI_2026]) {
      expect(par.importoBollo).toBe(2);
      expect(par.sogliaBollo).toBe(77.47);
    }
  });
});

// ————————————————————————————————————————————————————————————
// Saldo, acconti, compensazione
// ————————————————————————————————————————————————————————————

describe("saldo e acconti", () => {
  /*
    Le tre soglie dell'acconto IRPEF, art. 17 DPR 435/2001:
      — sotto 51,65 € non si versa acconto;
      — fra 51,65 e 257,52 € si versa in unica soluzione a novembre;
      — sopra, in due rate del 40 % e del 60 %.
    Sono importi in lire convertiti, ed è il motivo per cui hanno quella forma.
  */
  it("soglie e quote dell'acconto: 51,65 €, 257,52 €, 40/60 — art. 17 DPR 435/2001", () => {
    for (const par of [PARAMETRI_2025, PARAMETRI_2026]) {
      expect(par.sogliaAcconti).toBe(51.65);
      expect(par.sogliaAccontoUnico).toBe(257.52);
      expect(par.quotaPrimoAcconto).toBe(0.4);
      expect(par.quotaSecondoAcconto).toBe(0.6);
      // Le due quote sono una partizione: se non fanno 1 manca o avanza imposta.
      expect(par.quotaPrimoAcconto + par.quotaSecondoAcconto).toBeCloseTo(1, 10);
    }
  });

  /*
    Le addizionali non seguono l'IRPEF nemmeno negli acconti.

    Regionale: nessun acconto, si versa tutta a saldo con i termini del saldo
    IRPEF (art. 50 D.Lgs. 446/1997) — da qui il `null`, che è un dato e non
    un'omissione.

    Comunale: acconto del 30 % in **unica soluzione** a giugno, non spalmato su
    due rate come l'IRPEF (art. 1 c. 4 D.Lgs. 360/1998; codici tributo 3843
    acconto e 3844 saldo).
  */
  it("acconto delle addizionali: niente sulla regionale, 30 % in una rata sulla comunale", () => {
    for (const par of [PARAMETRI_2025, PARAMETRI_2026]) {
      expect(par.accontoAddizionali.regionale).toBeNull();
      expect(par.accontoAddizionali.comunale).toEqual({ quota: 0.3, rate: 1 });
    }
  });

  /*
    Il visto di conformità sulle compensazioni oltre soglia: art. 1 c. 574
    L. 147/2013, che introdusse l'obbligo a 15.000 €, **come modificato
    dall'art. 3 D.L. 50/2017**, che ha portato la soglia a 5.000 €. Citare solo
    la legge del 2013 farebbe sembrare corretti anche i 15.000: la soglia in
    vigore è quella del 2017.
  */
  it("visto di conformità sulle compensazioni oltre 5.000 € — art. 3 D.L. 50/2017", () => {
    expect(PARAMETRI_2025.sogliaVistoCompensazione).toBe(5_000);
    expect(PARAMETRI_2026.sogliaVistoCompensazione).toBe(5_000);
  });

  /*
    Attenzione a che cosa è legge e che cosa no, in questa riga.

    Il **4 % annuo** — cioè lo 0,33 % al mese — è l'interesse di rateazione
    dell'art. 20 D.Lgs. 241/1997. Le **sei rate** invece non sono un valore di
    legge: il numero di rate lo sceglie il contribuente entro il termine
    massimo, e sei è la proposta dell'app. Sta in questo file per comodità, ma
    non ha una fonte da citare, e chi lo cambia non deve cercarne una.
  */
  it("interesse di rateazione allo 0,33 % mensile — 4 % annuo, art. 20 D.Lgs. 241/1997", () => {
    for (const par of [PARAMETRI_2025, PARAMETRI_2026]) {
      expect(par.interesseRateizzazioneMensile).toBe(0.0033);
      // Default di prodotto, non di legge: fissato perché cambiarlo sposta la
      // rata mostrata nel prospetto, non perché lo imponga una norma.
      expect(par.rateRateizzazione).toBe(6);
    }
  });
});

// ————————————————————————————————————————————————————————————
// Il registro degli anni
// ————————————————————————————————————————————————————————————

describe("il registro per anno", () => {
  it("ogni file dichiara l'anno che dice di essere", () => {
    for (const [anno, par] of Object.entries(PARAMETRI_PER_ANNO)) {
      expect(par.anno, `parametri/${anno}.ts`).toBe(Number(anno));
    }
  });

  /*
    2025 e 2026 sono fatti compiuti, il 2027 no.

    `provvisorio` non è decorativo: finché è `true` l'interfaccia dichiara che i
    numeri sono stimati e l'export del prospetto resta bloccato. Un 2025 marcato
    provvisorio sarebbe un errore innocuo; un 2027 marcato definitivo mentre
    porta dentro le aliquote del 2026 farebbe uscire dall'app un prospetto che
    sembra definitivo e non lo è.
  */
  it("gli anni passati sono definitivi, il 2027 è provvisorio", () => {
    expect(PARAMETRI_2025.provvisorio).toBe(false);
    expect(PARAMETRI_2026.provvisorio).toBe(false);
    expect(PARAMETRI_2027.provvisorio).toBe(true);
    expect(ANNO_DEFINITIVO_PIU_RECENTE).toBe(2026);
  });

  it("il 2027 eredita il 2026 finché resta provvisorio, e lo dice nelle fonti", () => {
    expect(forma(PARAMETRI_2027.scaglioniIrpef)).toEqual(forma(PARAMETRI_2026.scaglioniIrpef));
    expect(PARAMETRI_2027.minimaleAnnuo).toBe(PARAMETRI_2026.minimaleAnnuo);
    expect(PARAMETRI_2027.fonti.join(" ")).toMatch(/ereditati|Legge di Bilancio 2027/);
  });

  it("ogni anno cita le sue fonti: un parametro senza provenienza non si difende", () => {
    for (const par of Object.values(PARAMETRI_PER_ANNO)) {
      expect(par.fonti.length, `fonti di ${par.anno}`).toBeGreaterThan(0);
      for (const f of par.fonti) expect(f.trim().length).toBeGreaterThan(0);
    }
  });

  /*
    L'ereditarietà fra file è comoda e silenziosa: `2025.ts` fa lo spread di
    `2026.ts` e riscrive solo ciò che cambia. Va bene finché qualcuno ricorda
    che l'anno vecchio pesca dal nuovo — ma se un domani una voce del 2026
    cambia e non era cambiata nel 2025, il 2025 la eredita senza dire niente.

    Questo test non lo impedisce: elenca le voci in cui i due anni **devono**
    differire, così una modifica al 2026 che le appiattisce diventa rossa.
  */
  it("le voci che devono restare diverse fra 2025 e 2026 lo restano", () => {
    const diverse: (keyof ParametriAnno)[] = ["minimaleAnnuo", "massimaleGestioneSeparata"];
    for (const campo of diverse) {
      expect(PARAMETRI_2025[campo], `${campo} identico nei due anni`).not.toBe(
        PARAMETRI_2026[campo],
      );
    }
    expect(PARAMETRI_2025.scaglioniIrpef[1].aliquota).not.toBe(
      PARAMETRI_2026.scaglioniIrpef[1].aliquota,
    );
  });

  it("un anno non censito ricade sull'anno più recente, dichiarandolo provvisorio", () => {
    expect(parametriDi(2030).anno).toBe(2027);
    expect(parametriDi(2030).provvisorio).toBe(true);
  });
});
