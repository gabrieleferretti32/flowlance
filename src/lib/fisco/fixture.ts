/**
 * I due scenari verificati a mano sull'Excel di partenza.
 * Se il motore non li riproduce al centesimo, è sbagliato il motore.
 * Vivono fuori dal file di test perché servono anche al dataset dimostrativo.
 */
import { impostazioniPredefinite } from "./impostazioni";
import { PARAMETRI_2026 } from "./parametri/2026";
import type { Cassa, Costo, Fattura, Impostazioni } from "./tipi";

export const OGGI_FIXTURE = "2026-09-01";

/** 7.500 € incassati su 10.000 € emessi, tre clienti. */
export const FATTURE_FIXTURE: Fattura[] = [
  {
    id: "f1",
    dataEmissione: "2026-01-15",
    numero: "2026/001",
    clienteId: "alfa",
    descrizione: "Consulenza marketing gennaio",
    tipoRicavo: "ricorrente",
    imponibile: 3000,
    dataIncasso: "2026-02-10",
  },
  {
    id: "f2",
    dataEmissione: "2026-02-03",
    numero: "2026/002",
    clienteId: "beta",
    descrizione: "Progetto posizionamento",
    tipoRicavo: "progetto",
    imponibile: 4500,
    dataIncasso: "2026-03-05",
  },
  {
    id: "f3",
    dataEmissione: "2026-03-20",
    numero: "2026/003",
    clienteId: "gamma",
    descrizione: "Retainer trimestrale",
    tipoRicavo: "ricorrente",
    imponibile: 2500,
    dataIncasso: null,
  },
];

/** 980 € di imponibile, 1.019,60 € di uscita di cassa, 39,60 € di IVA. */
export const COSTI_FIXTURE: Costo[] = [
  {
    id: "c1",
    dataDocumento: "2026-01-08",
    fornitore: "Adobe",
    categoria: "Software e abbonamenti",
    descrizione: "Creative Cloud",
    natura: "fisso",
    imponibile: 60,
    aliquotaIva: 0.22,
    percentualeDeducibilita: 1,
    dataPagamento: "2026-01-08",
  },
  {
    id: "c2",
    dataDocumento: "2026-01-31",
    fornitore: "Studio Rossi",
    categoria: "Commercialista e consulenze",
    descrizione: "Onorario mensile",
    natura: "fisso",
    imponibile: 120,
    aliquotaIva: 0.22,
    percentualeDeducibilita: 1,
    dataPagamento: "2026-02-05",
  },
  {
    id: "c3",
    dataDocumento: "2026-02-12",
    fornitore: "Meta Platforms",
    categoria: "Pubblicità e advertising",
    descrizione: "Campagna lead gen",
    natura: "variabile",
    imponibile: 800,
    aliquotaIva: 0,
    percentualeDeducibilita: 1,
    dataPagamento: "2026-02-12",
  },
];

export function impostazioniForfettario(): Impostazioni {
  return {
    ...impostazioniPredefinite(PARAMETRI_2026),
    regime: "forfettario",
    coefficienteRedditivita: 0.78,
    gestione: "separata",
  };
}

/**
 * Una cassa professionale con numeri tondi, per i test.
 *
 * Il 15 % non è una media di niente: è il numero che rende i conti dei test
 * ricontrollabili a mente, e che prima era il ripiego dell'app — tenerlo qui
 * fa sì che i casi scritti allora continuino a valere gli stessi euro. I due
 * minimi a zero perché il minimo va provato dove è il minimo a essere in
 * prova, non in ogni altro test.
 */
export function cassaProva(modifiche: Partial<Cassa> = {}): Cassa {
  return {
    nome: "Cassa Forense",
    aliquotaSoggettivo: 0.15,
    minimoSoggettivo: 0,
    aliquotaIntegrativo: 0.04,
    minimoIntegrativo: 0,
    contributiFissi: 0,
    ...modifiche,
  };
}

/** L'ordinario, ma iscritto a una cassa invece che alla Gestione Separata. */
export function impostazioniConCassa(modifiche: Partial<Cassa> = {}): Impostazioni {
  return {
    ...impostazioniOrdinario(),
    gestione: "cassa",
    cassa: cassaProva(modifiche),
  };
}

export function impostazioniOrdinario(): Impostazioni {
  return {
    ...impostazioniPredefinite(PARAMETRI_2026),
    regime: "ordinario",
    gestione: "separata",
    addizionaleRegionale: 0.0173,
    addizionaleComunale: 0.008,
  };
}

// ————————————————————————————————————————————————————————————
// Fixture di chiusura d'anno
// ————————————————————————————————————————————————————————————

/**
 * Lo scenario del passaggio d'anno, verificato a mano.
 *
 * Il 2026 chiude e il 2027 apre. Ogni riporto è rappresentato una volta sola,
 * con numeri tondi, così i valori si ricontrollano a mente:
 *
 *   saldo di cassa   10.000 + 48.800 − 2.440 − 9.760 = 46.600
 *   accantonato      48.800 × 30 %                   = 14.640
 *   liquidità netta  46.600 − 14.640                 = 31.960
 *   credito IVA      440 di aprile + 220 di dicembre = 660
 *   da incassare     6.100 + 3.660                   =  9.760
 *   da pagare        1.220                           =  1.220
 *
 * Due documenti stanno a cavallo del 31 dicembre, uno per lato: la fattura
 * `cf2` è IVA del 2026 e ricavo del 2027, il costo `cc2` è IVA detraibile del
 * 2026 e deduzione del 2027.
 */
export const OGGI_CHIUSURA = "2027-03-15";

export const FATTURE_CHIUSURA: Fattura[] = [
  {
    id: "cf1",
    dataEmissione: "2026-03-10",
    numero: "2026/001",
    clienteId: "alfa",
    descrizione: "Progetto annuale",
    tipoRicavo: "progetto",
    imponibile: 40_000,
    aliquotaIva: 0.22,
    dataIncasso: "2026-03-31",
  },
  {
    // Emessa a dicembre, incassata a gennaio: IVA del 2026, ricavo del 2027.
    id: "cf2",
    dataEmissione: "2026-12-20",
    numero: "2026/002",
    clienteId: "beta",
    descrizione: "Consulenza dicembre",
    tipoRicavo: "progetto",
    imponibile: 5_000,
    aliquotaIva: 0.22,
    dataIncasso: "2027-01-15",
  },
  {
    // Emessa e mai incassata: IVA dovuta lo stesso, ricavo ancora senza anno.
    id: "cf3",
    dataEmissione: "2026-11-05",
    numero: "2026/003",
    clienteId: "gamma",
    descrizione: "Retainer novembre",
    tipoRicavo: "ricorrente",
    imponibile: 3_000,
    aliquotaIva: 0.22,
    dataIncasso: null,
  },
];

export const COSTI_CHIUSURA: Costo[] = [
  {
    id: "cc1",
    dataDocumento: "2026-04-10",
    fornitore: "Studio Rossi",
    categoria: "Commercialista e consulenze",
    descrizione: "Onorario",
    natura: "fisso",
    imponibile: 2_000,
    aliquotaIva: 0.22,
    percentualeDeducibilita: 1,
    dataPagamento: "2026-04-20",
  },
  {
    // Documento di dicembre, pagato a gennaio: IVA detraibile del 2026,
    // deduzione del 2027. È il caso speculare della fattura `cf2`.
    id: "cc2",
    dataDocumento: "2026-12-15",
    fornitore: "Zeta Digital",
    categoria: "Servizi e collaborazioni",
    descrizione: "Sviluppo dicembre",
    natura: "variabile",
    imponibile: 1_000,
    aliquotaIva: 0.22,
    percentualeDeducibilita: 1,
    dataPagamento: "2027-01-20",
  },
  {
    id: "cc3",
    dataDocumento: "2026-12-28",
    fornitore: "Tipografia Moderna",
    categoria: "Attrezzature",
    descrizione: "Postazione di lavoro",
    natura: "variabile",
    imponibile: 8_000,
    aliquotaIva: 0.22,
    percentualeDeducibilita: 1,
    dataPagamento: "2026-12-30",
  },
];

/** Ordinario, 30 % di accantonamento, 10.000 € di saldo iniziale. */
export function impostazioniChiusura2026(): Impostazioni {
  return {
    ...impostazioniOrdinario(),
    anno: 2026,
    saldoInizialeAttivita: 10_000,
    percentualeAccantonamento: 0.3,
    periodicitaIva: "trimestrale",
  };
}

/** Lo stesso profilo, un anno dopo. I riporti arrivano dalla chiusura, non da qui. */
export function impostazioniChiusura2027(): Impostazioni {
  return {
    ...impostazioniChiusura2026(),
    anno: 2027,
    // Il saldo iniziale non si scrive a mano: lo porta la chiusura del 2026.
    saldoInizialeAttivita: 0,
  };
}
