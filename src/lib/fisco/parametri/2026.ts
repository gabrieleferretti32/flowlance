import type { ParametriAnno } from "../tipi";

/**
 * Parametri fiscali e previdenziali 2026.
 *
 * Aliquote, soglie e minimali cambiano ogni anno con la Legge di Bilancio e le
 * circolari INPS. Questo file è l'unico punto da toccare a gennaio: nessun
 * valore di legge è scritto altrove nel codice.
 */
export const PARAMETRI_2026: ParametriAnno = {
  anno: 2026,
  fonti: [
    "Legge di Bilancio 2026",
    "Allegato n. 2 alla Legge 190/2014 — coefficienti di redditività",
    "Art. 13 TUIR — detrazione per redditi di lavoro autonomo",
    "Circolare INPS n. 8 del 3 febbraio 2026 — Gestione Separata: aliquote e acconti",
    "Circolare INPS n. 14 del 9 febbraio 2026 — artigiani e commercianti",
    "Art. 1 comma 4 D.Lgs. 360/1998 — acconto dell'addizionale comunale",
  ],
  provvisorio: false,

  limiteForfettario: 85_000,
  sogliaUscitaImmediata: 100_000,
  sogliaAvviso: 0.85,
  aliquotaSostitutiva: 0.15,
  aliquotaSostitutivaNuovaAttivita: 0.05,
  anniNuovaAttivita: 5,

  gruppiAteco: [
    {
      codice: "professionali",
      descrizione:
        "Attività professionali, scientifiche, tecniche, sanitarie, di istruzione, servizi finanziari e assicurativi",
      coefficiente: 0.78,
    },
    {
      codice: "altre",
      descrizione: "Altre attività economiche (servizi non altrimenti classificati)",
      coefficiente: 0.67,
    },
    { codice: "costruzioni", descrizione: "Costruzioni e attività immobiliari", coefficiente: 0.86 },
    { codice: "intermediari", descrizione: "Intermediari del commercio", coefficiente: 0.62 },
    {
      codice: "commercio",
      descrizione: "Commercio all'ingrosso e al dettaglio",
      coefficiente: 0.4,
    },
    {
      codice: "ambulanteAlimentari",
      descrizione: "Commercio ambulante di prodotti alimentari e bevande",
      coefficiente: 0.4,
    },
    {
      codice: "ambulanteAltri",
      descrizione: "Commercio ambulante di altri prodotti",
      coefficiente: 0.54,
    },
    {
      codice: "alimentari",
      descrizione: "Industrie alimentari e delle bevande",
      coefficiente: 0.4,
    },
    {
      codice: "ristorazione",
      descrizione: "Servizi di alloggio e ristorazione",
      coefficiente: 0.4,
    },
  ],

  scaglioniIrpef: [
    { limite: 28_000, aliquota: 0.23 },
    { limite: 50_000, aliquota: 0.33 },
    { limite: null, aliquota: 0.43 },
  ],
  // Art. 13 comma 5 e 5-bis TUIR, nella formulazione della Legge 234/2021:
  // 1.265 € fino a 5.500 €, poi in calo fino ad azzerarsi a 50.000 €, con il
  // gradino di 50 € nella fascia fra 11.000 e 17.000 €.
  detrazioneLavoroAutonomo: {
    sogliaPiena: 5_500,
    importoPieno: 1_265,
    sogliaMedia: 28_000,
    importoFisso: 500,
    quotaDecrescente: 765,
    sogliaAzzeramento: 50_000,
    maggiorazione: { importo: 50, da: 11_000, a: 17_000 },
  },
  tettoFondoPensione: 5_164.57,

  aliquotaGestioneSeparata: 0.2607,
  massimaleGestioneSeparata: 122_295,
  // Minimale di reddito annuo 2026: uno solo, per l'accredito della Gestione
  // Separata e per l'eccedenza di artigiani e commercianti.
  minimaleAnnuo: 18_808,
  aliquotaEccedenzaArtigiani: 0.2448,

  aliquotaIvaOrdinaria: 0.22,
  maggiorazioneTrimestrale: 0.01,
  // Il saldo del quarto trimestre confluisce nella dichiarazione annuale
  // e non sconta la maggiorazione dell'1%.
  maggiorazioneSuQuartoTrimestre: false,

  aliquotaRivalsaInps: 0.04,
  aliquotaRitenuta: 0.2,
  importoBollo: 2,
  sogliaBollo: 77.47,

  /*
    L'acconto dei contributi ha regole sue, diverse da quelle delle imposte.

    Gestione Separata: 80 % del contributo dovuto, in due rate del 40 %, alle
    scadenze del primo e del secondo acconto IRPEF (Circolare INPS n. 8 del
    3 febbraio 2026 per le aliquote; le regole di riscossione di saldo e
    acconto sono quelle richiamate ogni anno nella circolare sul quadro RR).

    Artigiani e commercianti: il contributo sul reddito eccedente il minimale
    si versa in due rate di pari importo — 50 % e 50 % — alle stesse scadenze.
    I contributi sul minimale non hanno acconto: vanno in quattro rate fisse
    a febbraio, maggio, agosto e novembre, e infatti restano fuori dalla base.

    Casse professionali: ognuna ha regolamento e scadenze proprie, e l'app non
    le conosce. Meglio non calcolare un acconto che calcolarne uno inventato.
  */
  accontoContributi: {
    separata: { quota: 0.8, rate: 2 },
    artigiani: { quota: 1, rate: 2 },
    cassa: null,
  },

  /*
    Le addizionali non seguono l'IRPEF nemmeno loro.

    Regionale: nessun acconto, si versa tutta a saldo con le modalità e nei
    termini del saldo IRPEF (art. 50 D.Lgs. 446/1997).

    Comunale: acconto del 30 %, calcolato applicando l'aliquota deliberata al
    reddito imponibile dell'anno precedente, e versato in unica soluzione a
    giugno insieme al saldo — non in due rate come l'IRPEF (art. 1 comma 4
    D.Lgs. 360/1998; codici tributo 3843 acconto e 3844 saldo).
  */
  accontoAddizionali: {
    regionale: null,
    comunale: { quota: 0.3, rate: 1 },
  },

  // 100 € o il 2 % del fabbisogno: sotto quello scarto l'accantonamento va
  // bene com'è, e chiedere di alzare la percentuale costerebbe più del buco.
  tolleranzaAccantonamento: { minimo: 100, quota: 0.02 },

  sogliaVistoCompensazione: 5_000,
  sogliaAcconti: 51.65,
  sogliaAccontoUnico: 257.52,
  quotaPrimoAcconto: 0.4,
  quotaSecondoAcconto: 0.6,
  rateRateizzazione: 6,
  interesseRateizzazioneMensile: 0.0033,
};
