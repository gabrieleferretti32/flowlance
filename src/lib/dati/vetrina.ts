/**
 * Il dataset da vetrina: l'app come si vuole farla vedere.
 *
 * Il dataset dimostrativo di `demo.ts` racconta un forfettario con del lavoro
 * da fare dentro — una fattura scaduta, un costo da pagare, un avviso da
 * chiudere — ed è giusto così: serve a provare l'app, e un'app che non ha mai
 * niente da segnalare non si capisce a cosa serva.
 *
 * Questo racconta l'altra metà, quella che negli screenshot non si vede mai:
 * **regime ordinario, tutto dichiarato, tutto a posto**. IVA che si liquida per
 * trimestri, ritenute d'acconto che si scomputano, costi con deducibilità
 * diverse — auto al 20 %, ristoranti al 75 %, telefonia all'80 % — così la riga
 * «quota deducibile» si stacca da quella pagata invece di ricopiarla. Un anno
 * precedente chiuso davvero, con i suoi riporti. Nessun parametro predefinito,
 * nessun export bloccato, nessuna sezione vuota.
 *
 * Le due cose che restano visibili non sono difetti: il **credito d'imposta**
 * — le ritenute superano le imposte, ed è la ragione per cui in ordinario con
 * la ritenuta si finisce quasi sempre a credito — e le due fatture aperte ma
 * non scadute, che sono il credito commerciale normale di chi lavora.
 *
 * ┌────────────────────────────────────────────────────────────────────────┐
 * │ I NUMERI SONO INVENTATI, LE ALIQUOTE TERRITORIALI NO.                  │
 * │ Persone, clienti e importi non esistono. Le due addizionali sì: dicono │
 * │ «Emilia-Romagna» e «Bologna», cioè un territorio vero, e valgono       │
 * │ quanto la loro fonte — che non è la stessa per tutte e due.            │
 * │                                                                        │
 * │ La regionale è verificata sulla norma: L.R. 19/2006 art. 2 come        │
 * │ modificato da L.R. 1/2025 e L.R. 9/2025, con scaglioni diversi fra il  │
 * │ 2025 e il 2026.                                                        │
 * │                                                                        │
 * │ Quella di Bologna no. Lo 0,80 % viene da fonti secondarie e non è      │
 * │ stato confrontato con l'elenco allegato alle istruzioni del 730/2026,  │
 * │ che è la fonte primaria e non è raggiungibile da qui: è plausibile —   │
 * │ 0,80 % è il massimo di legge — non verificato. La soglia di esenzione  │
 * │ non l'abbiamo affatto, e per questo non c'è. Vedi il commento accanto  │
 * │ ai due campi.                                                          │
 * └────────────────────────────────────────────────────────────────────────┘
 *
 * È deterministico come l'altro: nessun numero casuale, stesso file di backup
 * a ogni esecuzione, e un test che ricontrolla saldo, acconti e chiusura
 * contro quello che il motore calcola davvero.
 */
import type { ChiusuraAnno } from "@/lib/fisco/chiusura";
import { impostazioniPredefinite } from "@/lib/fisco/impostazioni";
import { PARAMETRI_2025 } from "@/lib/fisco/parametri/2025";
import { PARAMETRI_2026 } from "@/lib/fisco/parametri/2026";
import type {
  Cliente,
  Costo,
  Dati,
  Fattura,
  Impostazioni,
  MovimentoAttivita,
  MovimentoPersonale,
  SpuntaAdempimento,
  VersamentoF24,
  VocePatrimonio,
} from "./tipi";

export const ANNO_VETRINA = 2026;
/** L'anno chiuso da cui arrivano riporti, saldo e acconti. */
const ANNO_PRIMA = ANNO_VETRINA - 1;

/**
 * L'ultimo giorno con documenti.
 *
 * Il dataset è datato al 5 settembre e non va oltre: un F24 di novembre o una
 * fattura di ottobre sarebbero versamenti e incassi nel futuro, e la stessa
 * schermata li direbbe insieme già fatti e ancora da fare. Sopra questa data
 * non c'è niente, e le due fatture ancora aperte scadono a sessanta giorni —
 * abbastanza avanti da restare «da incassare» anche a chi guarda fra un mese.
 */
const ULTIMO_GIORNO = `${ANNO_VETRINA}-09-05`;

function iso(mese: number, giorno: number, anno = ANNO_VETRINA): string {
  return `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

function piuGiorni(isoData: string, giorni: number): string {
  return new Date(Date.parse(`${isoData}T00:00:00Z`) + giorni * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

// ————————————————————————————————————————————————————————————
// Anagrafica
// ————————————————————————————————————————————————————————————

/**
 * Sei clienti, tutti imprese o enti.
 *
 * Non è un dettaglio di colore: la ritenuta d'acconto la opera il committente
 * quando è un sostituto d'imposta, e nell'app è un interruttore solo per tutte
 * le fatture. Un privato in mezzo a questo elenco renderebbe la ritenuta
 * globale una forzatura che si vede.
 */
const CLIENTI: Cliente[] = [
  {
    id: "vet-nordest",
    nome: "Nordest Meccanica Srl",
    canaleAcquisizione: "Passaparola",
    note: "Retainer mensile dal 2023, fatturato il 3. Referente: direzione operativa.",
  },
  {
    id: "vet-lambda",
    nome: "Lambda Packaging Spa",
    canaleAcquisizione: "Rete professionale",
    note: "Progetti a fasi, sempre con ordine di acquisto. Pagano a 60 giorni pieni.",
  },
  {
    id: "vet-orsini",
    nome: "Orsini & Figli Srl",
    canaleAcquisizione: "Passaparola",
    note: "Riorganizzazione commerciale. Una fase è stata stornata: vedi la nota di credito.",
  },
  {
    id: "vet-civico12",
    nome: "Civico 12 Architetti",
    canaleAcquisizione: "LinkedIn",
    note: "Studio associato, lavori brevi e ricorrenti.",
  },
  {
    id: "vet-tecnoforma",
    nome: "Tecnoforma Consorzio",
    canaleAcquisizione: "Bando",
    note: "Formazione finanziata: tempi lunghi ma incasso certo.",
  },
  {
    id: "vet-verdi",
    nome: "Farmacia Verdi Snc",
    canaleAcquisizione: "Sito web",
    note: "Consulenza gestionale una volta a semestre.",
  },
];

// ————————————————————————————————————————————————————————————
// Fatture
// ————————————————————————————————————————————————————————————

type SemeFattura = {
  id: string;
  mese: number;
  giorno: number;
  cliente: string;
  descrizione: string;
  tipo: Fattura["tipoRicavo"];
  imponibile: number;
  /** Giorni fra emissione e incasso. `null` se ancora aperta. */
  incassoDopo: number | null;
};

const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

/**
 * Il retainer che regge l'anno: nove mensilità, la nona ancora aperta.
 *
 * I giorni d'incasso oscillano fra i 28 e i 55 e restano tutti sotto i sessanta
 * dei termini: nessuna di queste risulta pagata in ritardo, e la media dei
 * giorni d'incasso resta un numero che si può guardare senza spiegazioni.
 */
const GIORNI_RETAINER = [52, 47, 55, 49, 43, 45, 51, 30];

const SEMI_FATTURE: SemeFattura[] = [
  ...Array.from({ length: 9 }, (_, i): SemeFattura => ({
    id: `vet-fat-ret-${String(i + 1).padStart(2, "0")}`,
    mese: i + 1,
    giorno: 3,
    cliente: "vet-nordest",
    descrizione: `Direzione operativa esterna — ${MESI[i]}`,
    tipo: "ricorrente",
    imponibile: 1_450,
    incassoDopo: GIORNI_RETAINER[i] ?? null,
  })),
  {
    id: "vet-fat-verdi-1", mese: 1, giorno: 30, cliente: "vet-verdi",
    descrizione: "Analisi dei margini di reparto", tipo: "unaTantum",
    imponibile: 1_830, incassoDopo: 33,
  },
  {
    id: "vet-fat-lambda-1", mese: 2, giorno: 15, cliente: "vet-lambda",
    descrizione: "Riassetto della rete vendita — fase 1", tipo: "progetto",
    imponibile: 8_240, incassoDopo: 68,
  },
  {
    id: "vet-fat-orsini-1", mese: 3, giorno: 20, cliente: "vet-orsini",
    descrizione: "Riorganizzazione commerciale — analisi e piano", tipo: "progetto",
    imponibile: 4_870, incassoDopo: 62,
  },
  {
    id: "vet-fat-civico-1", mese: 4, giorno: 14, cliente: "vet-civico12",
    descrizione: "Controllo di gestione per commessa", tipo: "progetto",
    imponibile: 2_690, incassoDopo: 44,
  },
  {
    id: "vet-fat-tecno-1", mese: 5, giorno: 5, cliente: "vet-tecnoforma",
    descrizione: "Percorso formativo — 32 ore d'aula", tipo: "progetto",
    imponibile: 3_920, incassoDopo: 75,
  },
  {
    id: "vet-fat-lambda-2", mese: 6, giorno: 12, cliente: "vet-lambda",
    descrizione: "Riassetto della rete vendita — fase 2", tipo: "progetto",
    imponibile: 6_150, incassoDopo: 59,
  },
  {
    id: "vet-fat-verdi-2", mese: 7, giorno: 15, cliente: "vet-verdi",
    descrizione: "Revisione dell'assortimento", tipo: "unaTantum",
    imponibile: 1_470, incassoDopo: 41,
  },
  {
    id: "vet-fat-orsini-2", mese: 7, giorno: 28, cliente: "vet-orsini",
    descrizione: "Riorganizzazione commerciale — affiancamento", tipo: "progetto",
    imponibile: 3_580, incassoDopo: 38,
  },
  // Le due ancora aperte: emesse ad agosto e a settembre, scadono a sessanta
  // giorni — il 19 ottobre e il 2 novembre. Sono credito commerciale normale,
  // non solleciti da fare.
  {
    id: "vet-fat-tecno-2", mese: 8, giorno: 20, cliente: "vet-tecnoforma",
    descrizione: "Percorso formativo — seconda edizione", tipo: "progetto",
    imponibile: 3_140, incassoDopo: null,
  },
];

function costruisciFatture(): Fattura[] {
  const ordinate = [...SEMI_FATTURE].sort(
    (a, b) => a.mese - b.mese || a.giorno - b.giorno || a.id.localeCompare(b.id),
  );
  return ordinate.map((seme, indice) => {
    const dataEmissione = iso(seme.mese, seme.giorno);
    return {
      id: seme.id,
      dataEmissione,
      numero: `${ANNO_VETRINA}/${String(indice + 1).padStart(3, "0")}`,
      clienteId: seme.cliente,
      descrizione: seme.descrizione,
      tipoRicavo: seme.tipo,
      imponibile: seme.imponibile,
      dataIncasso: seme.incassoDopo === null ? null : piuGiorni(dataEmissione, seme.incassoDopo),
    };
  });
}

// ————————————————————————————————————————————————————————————
// Costi
// ————————————————————————————————————————————————————————————

type SemeCosto = Omit<Costo, "id" | "dataDocumento" | "dataPagamento"> & {
  mese: number;
  giorno: number;
  pagatoDopo: number;
};

function ricorrente(
  base: Omit<SemeCosto, "mese" | "giorno" | "pagatoDopo">,
  giorno: number,
  mesi: number,
  pagatoDopo = 0,
): SemeCosto[] {
  return Array.from({ length: mesi }, (_, i) => ({ ...base, mese: i + 1, giorno, pagatoDopo }));
}

/**
 * I costi del 2026, tutti pagati.
 *
 * Le percentuali di deducibilità sono il motivo per cui questo dataset esiste.
 * L'auto in uso promiscuo si deduce al 20 % e ne detrae il 40 % dell'IVA, i
 * ristoranti al 75 %, la telefonia all'80 % con metà dell'IVA: sono le tre
 * regole che ogni professionista conosce e che nessun foglio di calcolo
 * applica davvero. Su questi numeri la «quota deducibile» del prospetto sta
 * quasi quattromila euro sotto il pagato, e la differenza si vede.
 */
const SEMI_COSTI: SemeCosto[] = [
  ...ricorrente(
    {
      fornitore: "Cantiere 34", categoria: "Affitto e utenze ufficio",
      descrizione: "Ufficio in spazio condiviso", natura: "fisso",
      imponibile: 265, aliquotaIva: 0.22,
      percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
    },
    3, 9,
  ),
  ...ricorrente(
    {
      fornitore: "Studio Bertolini", categoria: "Commercialista e consulenze",
      descrizione: "Tenuta della contabilità ordinaria", natura: "fisso",
      imponibile: 190, aliquotaIva: 0.22,
      percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
    },
    28, 8, 4,
  ),
  ...ricorrente(
    {
      fornitore: "Autonoleggio Reno", categoria: "Auto e carburante",
      descrizione: "Noleggio a lungo termine, uso promiscuo", natura: "fisso",
      imponibile: 372, aliquotaIva: 0.22,
      // Uso promiscuo: 20 % deducibile, 40 % di IVA detraibile.
      percentualeDeducibilita: 0.2, percentualeDetraibilitaIva: 0.4,
    },
    5, 9,
  ),
  ...ricorrente(
    {
      fornitore: "Stazione di servizio", categoria: "Auto e carburante",
      descrizione: "Carburante e pedaggi", natura: "variabile",
      imponibile: 118, aliquotaIva: 0.22,
      percentualeDeducibilita: 0.2, percentualeDetraibilitaIva: 0.4,
    },
    26, 8,
  ),
  ...ricorrente(
    {
      fornitore: "Operatore telefonico", categoria: "Telefonia e connettività",
      descrizione: "Linea mobile e fibra", natura: "fisso",
      imponibile: 47, aliquotaIva: 0.22,
      // Uso promiscuo: 80 % deducibile, metà dell'IVA detraibile.
      percentualeDeducibilita: 0.8, percentualeDetraibilitaIva: 0.5,
    },
    12, 8,
  ),
  ...ricorrente(
    {
      fornitore: "Abbonamenti software", categoria: "Software e abbonamenti",
      descrizione: "Suite di produttività e archivio documenti", natura: "fisso",
      imponibile: 88, aliquotaIva: 0.22,
      percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
    },
    // Otto mensilità, non nove: quella dell'8 settembre cadrebbe oltre il 5,
    // cioè sarebbe una fattura d'acquisto che nessuno ha ancora ricevuto.
    8, 8,
  ),
  ...ricorrente(
    {
      fornitore: "Banca", categoria: "Banca e commissioni",
      descrizione: "Canone conto e commissioni", natura: "fisso",
      imponibile: 9.5, aliquotaIva: 0,
      percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
    },
    1, 9,
  ),
  {
    mese: 1, giorno: 22, pagatoDopo: 0,
    fornitore: "Assicurazioni Tirreno", categoria: "Assicurazioni",
    descrizione: "Polizza di responsabilità professionale", natura: "fisso",
    imponibile: 415, aliquotaIva: 0,
    percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 2, giorno: 19, pagatoDopo: 0,
    fornitore: "Trattoria del Voltone", categoria: "Rappresentanza e ristoranti",
    descrizione: "Pranzo di lavoro con Lambda Packaging", natura: "variabile",
    imponibile: 186, aliquotaIva: 0.1,
    percentualeDeducibilita: 0.75, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 3, giorno: 11, pagatoDopo: 0,
    fornitore: "Scuola di management", categoria: "Formazione",
    descrizione: "Corso di controllo di gestione", natura: "variabile",
    imponibile: 640, aliquotaIva: 0.22,
    percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 4, giorno: 9, pagatoDopo: 0,
    fornitore: "Trenitalia", categoria: "Viaggi e trasferte",
    descrizione: "Trasferte dal cliente Lambda", natura: "variabile",
    imponibile: 437, aliquotaIva: 0.1,
    percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 5, giorno: 21, pagatoDopo: 0,
    fornitore: "Osteria del Guasto", categoria: "Rappresentanza e ristoranti",
    descrizione: "Cena di lavoro con Orsini & Figli", natura: "variabile",
    imponibile: 243, aliquotaIva: 0.1,
    percentualeDeducibilita: 0.75, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 6, giorno: 16, pagatoDopo: 0,
    fornitore: "Rivenditore hardware", categoria: "Attrezzature e hardware",
    descrizione: "Portatile e monitor da lavoro", natura: "variabile",
    imponibile: 1_590, aliquotaIva: 0.22,
    percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 7, giorno: 8, pagatoDopo: 0,
    fornitore: "Google Ireland", categoria: "Pubblicità e advertising",
    descrizione: "Campagna di ricerca sul nome", natura: "variabile",
    imponibile: 780, aliquotaIva: 0,
    percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 8, giorno: 3, pagatoDopo: 0,
    fornitore: "Trattoria del Voltone", categoria: "Rappresentanza e ristoranti",
    descrizione: "Pranzo di lavoro con Tecnoforma", natura: "variabile",
    imponibile: 164, aliquotaIva: 0.1,
    percentualeDeducibilita: 0.75, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 9, giorno: 2, pagatoDopo: 0,
    fornitore: "Studio grafico Ottavo", categoria: "Marketing e contenuti",
    descrizione: "Rifacimento del sito professionale", natura: "variabile",
    imponibile: 1_240, aliquotaIva: 0.22,
    percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
];

function costruisciCosti(semi: SemeCosto[], anno: number, prefisso: string): Costo[] {
  const ordinati = [...semi].sort(
    (a, b) => a.mese - b.mese || a.giorno - b.giorno || a.fornitore.localeCompare(b.fornitore),
  );
  return ordinati.map((seme, indice) => {
    const dataDocumento = iso(seme.mese, seme.giorno, anno);
    return {
      id: `${prefisso}-${String(indice + 1).padStart(3, "0")}`,
      dataDocumento,
      fornitore: seme.fornitore,
      categoria: seme.categoria,
      descrizione: seme.descrizione,
      natura: seme.natura,
      imponibile: seme.imponibile,
      aliquotaIva: seme.aliquotaIva,
      percentualeDeducibilita: seme.percentualeDeducibilita,
      percentualeDetraibilitaIva: seme.percentualeDetraibilitaIva,
      dataPagamento: piuGiorni(dataDocumento, seme.pagatoDopo),
    };
  });
}

// ————————————————————————————————————————————————————————————
// L'anno prima, chiuso
// ————————————————————————————————————————————————————————————

/**
 * Il 2025, per intero e chiuso davvero.
 *
 * Non è un antefatto simbolico: è l'anno da cui arrivano il saldo di giugno,
 * gli acconti, il saldo di cassa iniziale e le tasse già accantonate. Senza un
 * anno prima la schermata della chiusura resta vuota e i riporti mostrano zeri,
 * cioè proprio le due schermate che questo dataset serve a far vedere piene.
 */
const SEMI_FATTURE_ANNO_PRIMA: { mese: number; giorno: number; cliente: string; descrizione: string; imponibile: number; incassoDopo: number }[] = [
  { mese: 1, giorno: 15, cliente: "vet-nordest", descrizione: "Direzione operativa esterna — 1° trimestre", imponibile: 3_900, incassoDopo: 56 },
  { mese: 3, giorno: 10, cliente: "vet-lambda", descrizione: "Analisi della rete vendita", imponibile: 9_600, incassoDopo: 71 },
  { mese: 4, giorno: 14, cliente: "vet-nordest", descrizione: "Direzione operativa esterna — 2° trimestre", imponibile: 3_900, incassoDopo: 63 },
  { mese: 6, giorno: 9, cliente: "vet-orsini", descrizione: "Piano commerciale triennale", imponibile: 7_250, incassoDopo: 64 },
  { mese: 7, giorno: 13, cliente: "vet-nordest", descrizione: "Direzione operativa esterna — 3° trimestre", imponibile: 3_900, incassoDopo: 64 },
  { mese: 9, giorno: 22, cliente: "vet-tecnoforma", descrizione: "Percorso formativo — 40 ore d'aula", imponibile: 5_400, incassoDopo: 64 },
  { mese: 10, giorno: 12, cliente: "vet-nordest", descrizione: "Direzione operativa esterna — 4° trimestre", imponibile: 3_900, incassoDopo: 59 },
  { mese: 11, giorno: 18, cliente: "vet-civico12", descrizione: "Impianto del controllo di gestione", imponibile: 2_980, incassoDopo: 34 },
];

const FATTURE_ANNO_PRIMA: Fattura[] = SEMI_FATTURE_ANNO_PRIMA.map((s, i) => {
  const dataEmissione = iso(s.mese, s.giorno, ANNO_PRIMA);
  return {
    id: `vet-fat-${ANNO_PRIMA}-${String(i + 1).padStart(2, "0")}`,
    dataEmissione,
    numero: `${ANNO_PRIMA}/${String(i + 1).padStart(3, "0")}`,
    clienteId: s.cliente,
    descrizione: s.descrizione,
    tipoRicavo: "progetto" as const,
    imponibile: s.imponibile,
    // Tutte incassate dentro l'anno: il 2025 è un anno chiuso, e una fattura a
    // cavallo sposterebbe i ricavi del 2026 senza raccontare niente di più.
    dataIncasso: piuGiorni(dataEmissione, s.incassoDopo),
  };
});

const SEMI_COSTI_ANNO_PRIMA: SemeCosto[] = [
  ...ricorrente(
    {
      fornitore: "Cantiere 34", categoria: "Affitto e utenze ufficio",
      descrizione: "Ufficio in spazio condiviso", natura: "fisso",
      imponibile: 250, aliquotaIva: 0.22,
      percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
    },
    3, 12,
  ),
  ...ricorrente(
    {
      fornitore: "Studio Bertolini", categoria: "Commercialista e consulenze",
      descrizione: "Tenuta della contabilità ordinaria", natura: "fisso",
      imponibile: 180, aliquotaIva: 0.22,
      percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
    },
    28, 12, 4,
  ),
  ...ricorrente(
    {
      fornitore: "Autonoleggio Reno", categoria: "Auto e carburante",
      descrizione: "Noleggio a lungo termine, uso promiscuo", natura: "fisso",
      imponibile: 372, aliquotaIva: 0.22,
      percentualeDeducibilita: 0.2, percentualeDetraibilitaIva: 0.4,
    },
    5, 12,
  ),
  ...ricorrente(
    {
      fornitore: "Operatore telefonico", categoria: "Telefonia e connettività",
      descrizione: "Linea mobile e fibra", natura: "fisso",
      imponibile: 45, aliquotaIva: 0.22,
      percentualeDeducibilita: 0.8, percentualeDetraibilitaIva: 0.5,
    },
    12, 12,
  ),
  ...ricorrente(
    {
      fornitore: "Abbonamenti software", categoria: "Software e abbonamenti",
      descrizione: "Suite di produttività e archivio documenti", natura: "fisso",
      imponibile: 82, aliquotaIva: 0.22,
      percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
    },
    8, 12,
  ),
  ...ricorrente(
    {
      fornitore: "Banca", categoria: "Banca e commissioni",
      descrizione: "Canone conto e commissioni", natura: "fisso",
      imponibile: 9.5, aliquotaIva: 0,
      percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
    },
    1, 12,
  ),
  {
    mese: 1, giorno: 24, pagatoDopo: 0,
    fornitore: "Assicurazioni Tirreno", categoria: "Assicurazioni",
    descrizione: "Polizza di responsabilità professionale", natura: "fisso",
    imponibile: 395, aliquotaIva: 0,
    percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 3, giorno: 18, pagatoDopo: 0,
    fornitore: "Scuola di management", categoria: "Formazione",
    descrizione: "Seminario di analisi dei costi", natura: "variabile",
    imponibile: 520, aliquotaIva: 0.22,
    percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 6, giorno: 5, pagatoDopo: 0,
    fornitore: "Osteria del Guasto", categoria: "Rappresentanza e ristoranti",
    descrizione: "Cena di lavoro con Orsini & Figli", natura: "variabile",
    imponibile: 210, aliquotaIva: 0.1,
    percentualeDeducibilita: 0.75, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 9, giorno: 11, pagatoDopo: 0,
    fornitore: "Trenitalia", categoria: "Viaggi e trasferte",
    descrizione: "Trasferte dal cliente Tecnoforma", natura: "variabile",
    imponibile: 380, aliquotaIva: 0.1,
    percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
  {
    mese: 10, giorno: 20, pagatoDopo: 0,
    fornitore: "Google Ireland", categoria: "Pubblicità e advertising",
    descrizione: "Campagna di ricerca sul nome", natura: "variabile",
    imponibile: 640, aliquotaIva: 0,
    percentualeDeducibilita: 1, percentualeDetraibilitaIva: 1,
  },
];

// ————————————————————————————————————————————————————————————
// Cassa e patrimonio
// ————————————————————————————————————————————————————————————

function movimentiPersonali(anno: number, prelievi: number, variabili: number[]): MovimentoPersonale[] {
  return variabili.map((speseVariabili, i) => ({
    id: `vet-mp-${anno}-${String(i + 1).padStart(2, "0")}`,
    anno,
    mese: i + 1,
    prelievi,
    altreEntrate: 0,
    speseFisse: 1_050,
    speseVariabili,
    risparmio: 150,
  }));
}

/**
 * Nove mesi di movimenti nel 2026, non dodici.
 *
 * La riga di ottobre non esiste perché ottobre non è ancora arrivato: un
 * prelievo registrato nel futuro farebbe scendere la liquidità di oggi per
 * denaro che nessuno ha ancora preso.
 */
const MOVIMENTI_PERSONALI: MovimentoPersonale[] = [
  ...movimentiPersonali(ANNO_PRIMA, 1_700, [520, 490, 540, 580, 610, 660, 820, 760, 560, 530, 590, 880]),
  ...movimentiPersonali(ANNO_VETRINA, 1_750, [540, 505, 565, 595, 630, 690, 840, 780, 320]),
];

function movimentiAttivita(anno: number, mesi: number, rimborsi: Record<number, number> = {}): MovimentoAttivita[] {
  return Array.from({ length: mesi }, (_, i) => ({
    id: `vet-ma-${anno}-${String(i + 1).padStart(2, "0")}`,
    anno,
    mese: i + 1,
    altreEntrate: rimborsi[i + 1] ?? 0,
    altreUscite: 0,
  }));
}

const PATRIMONIO: VocePatrimonio[] = [
  { id: "vet-pat-01", tipo: "attivo", categoria: "Investimenti finanziari", descrizione: "Piano di accumulo su indice globale", valore: 21_450 },
  { id: "vet-pat-02", tipo: "attivo", categoria: "Fondo pensione", descrizione: "Fondo pensione aperto, versamento annuale", valore: 12_870 },
  { id: "vet-pat-03", tipo: "attivo", categoria: "Liquidità di riserva", descrizione: "Conto deposito vincolato a 12 mesi", valore: 9_000 },
  { id: "vet-pat-04", tipo: "attivo", categoria: "Beni strumentali", descrizione: "Portatile, monitor e arredo dello studio", valore: 3_240 },
  { id: "vet-pat-05", tipo: "passivo", categoria: "Finanziamenti", descrizione: "Prestito per attrezzature, debito residuo", valore: 4_180 },
];

// ————————————————————————————————————————————————————————————
// Impostazioni
// ————————————————————————————————————————————————————————————

const NOME_ATTIVITA = "Elena Marani";
const APERTURA_PIVA = "2019-09-02";

/**
 * L'addizionale regionale dell'Emilia-Romagna, anno per anno.
 *
 * Sono maggiorazioni sull'aliquota base statale dell'1,23 % (art. 6 D.Lgs.
 * 68/2011), deliberate con la L.R. 19/2006 art. 2 come modificato dalla
 * L.R. 1/2025 e dalla L.R. 9/2025. La regione la applica a scaglioni, e gli
 * scaglioni **cambiano fra i due anni del dataset**: la terza fascia scende
 * dal 2,93 % del 2025 al 2,78 % del 2026.
 *
 * Il modello lo regge senza forzature — `Impostazioni` è per anno d'imposta e
 * `scaglioniAddizionaleRegionale` è un campo suo — ed è esattamente il caso per
 * cui è fatto così: uniformare i due anni per comodità del dataset vorrebbe
 * dire mostrare sul 2025 un'aliquota che nel 2025 non esisteva.
 *
 * Il reddito imponibile della vetrina sta poco sotto i 28.000 €, cioè a cavallo
 * fra la seconda e la terza fascia: la differenza fra i due anni si vede in
 * pochi euro sull'addizionale, non in un salto. È giusto così — la fascia alta
 * non la tocca nessuno dei due anni.
 */
function scaglioniRegionali(anno: number) {
  const terza = anno <= 2025 ? 0.0293 : 0.0278;
  return [
    { limite: 15_000, aliquota: 0.0133 },
    { limite: 28_000, aliquota: 0.0193 },
    { limite: 50_000, aliquota: terza },
    { limite: null, aliquota: 0.0333 },
  ];
}

function impostazioniVetrina(anno: number): Impostazioni {
  const base = impostazioniPredefinite(anno === ANNO_PRIMA ? PARAMETRI_2025 : PARAMETRI_2026);
  return {
    ...base,
    anno,
    nome: NOME_ATTIVITA,
    dataAperturaPiva: APERTURA_PIVA,

    regime: "ordinario",
    // Fuori dal forfettario il coefficiente non entra in nessun calcolo, ma
    // resta scritto: chi apre il confronto fra regimi lo vede usato lì.
    gruppoAteco: "professionali",
    coefficienteRedditivita: 0.78,

    periodicitaIva: "trimestrale",

    /*
      Le due addizionali, dichiarate: regione, comune e aliquote.

      `dichiarati` è quello che sblocca l'export del prospetto e toglie la
      marcatura «predefinito» dalle schermate. Qui ci sono tutti e quattro i
      campi pertinenti — le due addizionali dell'ordinario, i giorni lavorativi
      e le ore fatturabili — perché il dataset racconta qualcuno che ha finito
      di configurare, non qualcuno che sta configurando.

      L'aliquota unica resta scritta accanto agli scaglioni: è il valore da cui
      si riparte se qualcuno torna indietro dalla forma a scaglioni, e su questo
      reddito la fascia che si applica è la terza.

      Su Bologna la fonte primaria — l'elenco delle aliquote allegato alle
      istruzioni del 730/2026 — non è raggiungibile, e questo vale per tutte e
      due le righe qui sotto, non solo per una.

      Lo **0,80 %** è plausibile e non verificato: viene da fonti secondarie, e
      l'unico documento comunale rintracciato è un archivio del 2013 che dice
      0,7 % con esenzione a 12.000 €. Probabile che sia stata alzata da allora —
      0,80 % è il massimo che la legge consente — ma «probabile» non è
      «verificato», e finché resta qui va detto così.

      La **soglia di esenzione** è a zero, e non è una dichiarazione che Bologna
      non ne abbia una: è il valore che l'app usa per «non lo so». Scriverne una
      presa da un aggregatore sarebbe il numero plausibile e sbagliato che
      questo file esiste per non produrre. Sull'imponibile della vetrina non
      cambia un centesimo — sta ben sopra qualunque soglia comunale — quindi il
      costo di lasciarla fuori è zero.
    */
    regione: "emilia-romagna",
    comune: "Bologna",
    addizionaleRegionale: anno <= ANNO_PRIMA ? 0.0293 : 0.0278,
    scaglioniAddizionaleRegionale: scaglioniRegionali(anno),
    esenzioneAddizionaleRegionale: 0,
    addizionaleComunale: 0.008,
    scaglioniAddizionaleComunale: null,
    esenzioneAddizionaleComunale: 0,
    dichiarati: [
      "addizionaleRegionale",
      "addizionaleComunale",
      "giorniLavorativi",
      "oreFatturabiliGiorno",
    ],

    gestione: "separata",

    // Le tre voci che rendono l'incasso diverso dall'imponibile: qui c'è solo
    // la ritenuta. La rivalsa resta spenta perché sommarla renderebbe più
    // difficile leggere la ritenuta, che è quello che il dataset deve mostrare.
    rivalsaAttiva: false,
    ritenutaAttiva: true,
    terminiPagamento: 60,

    giorniLavorativi: 216,
    oreFatturabiliGiorno: 5,
    tariffaOraria: 95,
    nettoDesiderato: 34_000,
    costiFissiAnnui: 14_500,
    /*
      La percentuale copre il fabbisogno con un margine, e basta.

      È per anno perché il fabbisogno lo è: nel 2025 le ritenute coprivano meno
      del carico e serviva il 17 %, nel 2026 fra ritenute e credito riportato ne
      resta scoperto molto meno. Una percentuale sola per tutti e due gli anni
      lasciava il 2025 sotto la tolleranza, cioè con l'avviso acceso su una
      schermata che deve essere pulita.
    */
    percentualeAccantonamento: anno === ANNO_PRIMA ? 0.17 : 0.12,
  };
}

// ————————————————————————————————————————————————————————————
// F24, chiusura e scadenzario
// ————————————————————————————————————————————————————————————

/*
  Saldo, acconti e liquidazioni IVA non sono numeri scelti.

  Sono quello che il motore calcola su questo stesso dataset — il saldo del
  2025 e il primo acconto per il 2026, i due trimestri IVA già liquidati — e un
  test li ricontrolla a ogni esecuzione. Se un importo cambia e questi restano
  indietro, il test fallisce invece di lasciare in giro una vetrina che non
  torna.

  Il 30 giugno è il giorno in cui l'anno di cassa e l'anno d'imposta si
  separano: nello stesso F24 escono il saldo del 2025 e il primo acconto del
  2026, e senza `annoImposta` finirebbero tutti e due sul 2026.
*/
const SALDO_ANNO_PRIMA = { imposte: 0, contributi: 1_168.96 };
const ACCONTI = { primoImposte: 62.12, primoContributi: 3_267.59 };
/** L'IVA dei due trimestri già liquidati, maggiorazione dell'1 % compresa. */
const IVA_VERSATA = { primoTrimestre: 3_616.96, secondoTrimestre: 2_796.03 };

/** Gli acconti versati dentro il 2025, calcolati allora sul 2024. */
const ACCONTI_ANNO_PRIMA = {
  giugnoImposte: 620,
  giugnoContributi: 2_180,
  novembreImposte: 930,
  novembreContributi: 3_270,
};
/** Le liquidazioni IVA del 2025, versate alle quattro scadenze. */
const IVA_ANNO_PRIMA = [2_428.66, 2_000.82, 1_572.58, 1_062.61];

const VERSAMENTI: VersamentoF24[] = [
  // 2025
  { id: "vet-f24-2025-iva1", data: iso(5, 16, ANNO_PRIMA), tipo: "iva", importo: IVA_ANNO_PRIMA[0], annoImposta: ANNO_PRIMA },
  { id: "vet-f24-2025-1i", data: iso(6, 30, ANNO_PRIMA), tipo: "imposte", importo: ACCONTI_ANNO_PRIMA.giugnoImposte, annoImposta: ANNO_PRIMA },
  { id: "vet-f24-2025-1c", data: iso(6, 30, ANNO_PRIMA), tipo: "contributi", importo: ACCONTI_ANNO_PRIMA.giugnoContributi, annoImposta: ANNO_PRIMA },
  { id: "vet-f24-2025-iva2", data: iso(8, 20, ANNO_PRIMA), tipo: "iva", importo: IVA_ANNO_PRIMA[1], annoImposta: ANNO_PRIMA },
  { id: "vet-f24-2025-iva3", data: iso(11, 16, ANNO_PRIMA), tipo: "iva", importo: IVA_ANNO_PRIMA[2], annoImposta: ANNO_PRIMA },
  { id: "vet-f24-2025-2i", data: iso(11, 30, ANNO_PRIMA), tipo: "imposte", importo: ACCONTI_ANNO_PRIMA.novembreImposte, annoImposta: ANNO_PRIMA },
  { id: "vet-f24-2025-2c", data: iso(11, 30, ANNO_PRIMA), tipo: "contributi", importo: ACCONTI_ANNO_PRIMA.novembreContributi, annoImposta: ANNO_PRIMA },
  // 2026
  { id: "vet-f24-iva4-2025", data: iso(3, 16), tipo: "iva", importo: IVA_ANNO_PRIMA[3], annoImposta: ANNO_PRIMA },
  { id: "vet-f24-iva1", data: iso(5, 16), tipo: "iva", importo: IVA_VERSATA.primoTrimestre, annoImposta: ANNO_VETRINA },
  { id: "vet-f24-saldo-c", data: iso(6, 30), tipo: "contributi", importo: SALDO_ANNO_PRIMA.contributi, annoImposta: ANNO_PRIMA },
  { id: "vet-f24-acconto-i", data: iso(6, 30), tipo: "imposte", importo: ACCONTI.primoImposte, annoImposta: ANNO_VETRINA },
  { id: "vet-f24-acconto-c", data: iso(6, 30), tipo: "contributi", importo: ACCONTI.primoContributi, annoImposta: ANNO_VETRINA },
  { id: "vet-f24-iva2", data: iso(8, 20), tipo: "iva", importo: IVA_VERSATA.secondoTrimestre, annoImposta: ANNO_VETRINA },
  /*
    Il secondo acconto non c'è, e non è una dimenticanza: il dataset è datato 5
    settembre, e un F24 del 30 novembre sarebbe un versamento nel futuro. Il
    prospetto lo direbbe già pagato e lo scadenzario ancora da pagare, sulla
    stessa schermata.
  */
];

/*
  La chiusura del 2025.

  Dell'anno chiuso si salvano solo le decisioni; gli importi si ricalcolano
  sempre dai documenti. L'istantanea qui sotto non entra in nessun calcolo:
  serve a mostrare che dopo la chiusura non è cambiato niente, ed è la ragione
  per cui i suoi valori sono presi dal motore e non scritti a mano. Se
  divergessero, la schermata direbbe — giustamente — che qualcosa si è mosso.
*/
const CHIUSURA_ANNO_PRIMA: ChiusuraAnno = {
  anno: ANNO_PRIMA,
  chiusaIl: `${ANNO_VETRINA}-01-12T09:40:00.000Z`,
  destinazioneCreditoIva: "compensazione",
  regimeAnnoSuccessivo: "ordinario",
  note: "Anno chiuso con il commercialista. Credito d'imposta da ritenute portato in compensazione sul saldo di giugno.",
  istantanea: {
    saldoCassa: 10_851.18,
    accantonato: 1_192.99,
    creditoIva: 0,
    creditoImposte: 2_020.08,
    ricaviRilevanti: 40_830,
    fattureDaIncassare: 0,
    // La parcella di dicembre del commercialista, pagata il 1° gennaio: un
    // costo che attraversa il confine, ed è la ragione per cui la riga esiste.
    costiDaPagare: 219.6,
    noteDaRimborsare: 0,
  },
};

/**
 * Gli adempimenti già fatti, fino a oggi.
 *
 * Solo quelli passati: spuntare una scadenza di novembre renderebbe lo
 * scadenzario una bugia, e lo scadenzario è la schermata su cui si controlla
 * di non aver dimenticato niente. Il «rinvio di luglio» resta non spuntato
 * perché è l'alternativa al 30 giugno, non un adempimento in più.
 */
const SPUNTE: SpuntaAdempimento[] = [
  ["iva-dicembre-precedente", iso(2, 16)],
  ["lipe-4t-precedente", iso(3, 31)],
  ["dichiarazione-iva", iso(4, 30)],
  ["iva-1t", iso(5, 16)],
  ["lipe-1t", iso(6, 1)],
  ["saldo-e-primo-acconto", iso(6, 30)],
  ["iva-2t", iso(8, 20)],
].map(([idAdempimento, completatoIl]) => ({
  id: `${ANNO_VETRINA}:${idAdempimento}`,
  anno: ANNO_VETRINA,
  idAdempimento,
  completatoIl,
}));

// ————————————————————————————————————————————————————————————
// Il dataset
// ————————————————————————————————————————————————————————————

/**
 * Il saldo di cassa al 1° gennaio 2026.
 *
 * Nella catena degli anni questo campo non viene letto — comanda il riporto
 * della chiusura — ma scriverci un numero diverso lascerebbe in archivio un
 * dato che contraddice quello che l'app mostra. Un test lo tiene legato.
 */
const SALDO_APERTURA_2026 = 10_851.18;

export function datiVetrina(): Dati {
  return {
    impostazioni: [
      { ...impostazioniVetrina(ANNO_PRIMA), saldoInizialeAttivita: 18_000, saldoInizialePersonale: 2_600 },
      { ...impostazioniVetrina(ANNO_VETRINA), saldoInizialeAttivita: SALDO_APERTURA_2026, saldoInizialePersonale: 2_600 },
    ],
    clienti: CLIENTI,
    fatture: [...FATTURE_ANNO_PRIMA, ...costruisciFatture()],
    /*
      Una nota di credito riconciliata alla sua fattura.

      Riconciliata di proposito: una nota che non si aggancia a niente è la cosa
      che l'app segnala da sistemare, e qui non c'è niente da sistemare. Serve
      anche a far vedere che le ritenute seguono lo storno — la base su cui il
      committente ha trattenuto si è ridotta con lui — che è un conto che nessun
      foglio di calcolo fa.
    */
    note: [
      {
        id: "vet-nc-01",
        dataDocumento: iso(6, 10),
        numero: `NC/${ANNO_VETRINA}/1`,
        clienteId: "vet-orsini",
        descrizione: "Storno parziale: due giornate di affiancamento non erogate",
        imponibile: 340,
        aliquotaIva: 0.22,
        dataRimborso: iso(6, 26),
        riconciliazioni: [{ fatturaId: "vet-fat-orsini-1", imponibile: 340 }],
      },
    ],
    costi: [
      ...costruisciCosti(SEMI_COSTI_ANNO_PRIMA, ANNO_PRIMA, `vet-cos-${ANNO_PRIMA}`),
      ...costruisciCosti(SEMI_COSTI, ANNO_VETRINA, "vet-cos"),
    ],
    movimentiPersonali: MOVIMENTI_PERSONALI,
    movimentiAttivita: [
      ...movimentiAttivita(ANNO_PRIMA, 12, { 5: 240, 10: 180 }),
      ...movimentiAttivita(ANNO_VETRINA, 9, { 4: 265, 7: 190 }),
    ],
    versamenti: VERSAMENTI,
    patrimonio: PATRIMONIO,
    spunte: SPUNTE,
    chiusure: [CHIUSURA_ANNO_PRIMA],
    /*
      Il percorso di configurazione risulta finito.

      È la differenza fra questo dataset e quello dimostrativo: lì la
      configurazione resta da fare, ed è giusto, perché serve a provarla. Qui
      l'app deve mostrarsi a lavoro concluso, e una schermata che dice «6 passi
      da rispondere» racconterebbe il contrario.
    */
    percorsi: [
      {
        id: `primoAvvio:${ANNO_VETRINA}`,
        contesto: "primoAvvio",
        anno: ANNO_VETRINA,
        confermati: ["regime", "gestione", "iva", "ritenutaRivalsa", "pagamenti", "obiettivi", "partenza"],
        saltati: [],
        completatoIl: `${ANNO_VETRINA}-01-14T10:05:00.000Z`,
        aggiornatoIl: `${ANNO_VETRINA}-01-14T10:05:00.000Z`,
      },
      /*
        E l'apertura d'anno, che è quella che conta.

        Con il 2025 chiuso l'app propone di aprire il 2026, e finché nessuno lo
        fa mette in cima al cruscotto la card «Apertura d'anno — Comincia». È
        giusta, ed è la prima cosa che finirebbe in uno screenshot del
        cruscotto. Qui il gesto risulta già fatto, riporto per riporto: le sei
        voci confermate sono le stesse che la schermata elenca.
      */
      {
        id: `aperturaAnno:${ANNO_VETRINA}`,
        contesto: "aperturaAnno",
        anno: ANNO_VETRINA,
        confermati: [
          "riporti", "regime", "gestione", "iva", "ritenutaRivalsa", "pagamenti", "obiettivi",
          ...["saldoCassa", "accantonato", "creditoIva", "creditoImposte", "fattureDaIncassare", "costiDaPagare"]
            .map((voce) => `riporti:${voce}`),
        ],
        saltati: [],
        completatoIl: `${ANNO_VETRINA}-01-15T08:20:00.000Z`,
        aggiornatoIl: `${ANNO_VETRINA}-01-15T08:20:00.000Z`,
      },
    ],
  };
}

export { ULTIMO_GIORNO as ULTIMO_GIORNO_VETRINA };
