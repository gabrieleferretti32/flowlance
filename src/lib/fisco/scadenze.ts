/**
 * Lo scadenzario fiscale dell'anno, con gli importi collegati ai numeri reali.
 *
 * Le voci si filtrano da sole in base al regime e alla gestione previdenziale:
 * chi è in forfettario non deve vedere la LIPE, chi è in Gestione Separata non
 * deve vedere le rate dei contributi fissi degli artigiani.
 *
 * Le date che cadono di sabato, domenica o in un festivo slittano al primo
 * giorno lavorativo successivo.
 */
import { slittaAGiornoLavorativo } from "./calendario";
import type { LiquidazioneIva } from "./iva";
import type { Prospetto } from "./motore";
import { eGestioneCommerciale, type Impostazioni, type ParametriAnno } from "./tipi";
import { dichiarato } from "./parametri-utente";
import { round2 } from "./aritmetica";

export type Adempimento = {
  id: string;
  /** Data effettiva di versamento, già spostata se cadeva in un festivo. */
  data: string;
  /** Data di calendario prima dello slittamento, quando differisce. */
  dataDiCalendario?: string;
  titolo: string;
  /** Importo stimato, `null` quando l'adempimento è solo dichiarativo. */
  importo: number | null;
  /** Perché l'importo non c'è, quando manca per un motivo che si può dire. */
  nota?: string;
  categoria: "iva" | "imposte" | "contributi" | "dichiarazione" | "bollo";
};

type Voce = Omit<Adempimento, "data" | "dataDiCalendario" | "nota"> & {
  nota?: string;
  mese: number;
  giorno: number;
  /** Anno successivo a quello di riferimento. */
  annoDopo?: boolean;
  quando: (ctx: Contesto) => boolean;
};

type Contesto = {
  imp: Impostazioni;
  forfettario: boolean;
  mensile: boolean;
  artigiani: boolean;
};

/**
 * Le quattro rate dei contributi fissi, per **anno di contribuzione**.
 *
 * Non per anno di calendario, ed è la correzione di un difetto di competenza
 * identico a quello già chiuso sui versamenti F24. L'anno di contribuzione
 * 2026 si versa il 16 maggio, il 20 agosto e il 16 novembre del 2026, più il
 * **16 febbraio del 2027**: la rata di febbraio appartiene all'anno prima, non
 * a quello in cui esce dal conto (Circolare INPS n. 14 del 9 febbraio 2026,
 * par. 9).
 *
 * Prima lo scadenzario del 2026 mostrava il 16 febbraio 2026 come «1ª rata» —
 * che è la quarta del 2025 — e non mostrava affatto il 16 febbraio 2027.
 * Nessun importo sbagliato, ma un anno che conteneva la rata di un altro e
 * un'ultima rata che non compariva da nessuna parte.
 */
const RATE_FISSI: [mese: number, giorno: number, annoDopo: boolean][] = [
  [5, 16, false],
  [8, 20, false],
  [11, 16, false],
  [2, 16, true],
];

/**
 * Lo scadenzario di un anno di calendario.
 *
 * @param prospetto l'anno d'imposta corrente: da qui vengono le scadenze IVA,
 * che sono dell'anno in cui si liquidano.
 * @param precedente l'anno d'imposta precedente, `null` al primo anno di
 * attività. Da qui vengono saldo e acconti di giugno e novembre: quello che
 * esce dal conto a giugno del 2027 è il saldo del 2026 più il primo acconto
 * per il 2027, e tutti e due si calcolano sui numeri del 2026. Prenderli dal
 * prospetto dell'anno in corso significava mostrare a giugno un saldo che si
 * verserà l'anno dopo.
 */
export function scadenzeAnno(
  imp: Impostazioni,
  par: ParametriAnno,
  prospetto: Prospetto,
  iva: LiquidazioneIva,
  precedente: Prospetto | null = null,
): Adempimento[] {
  const ctx: Contesto = {
    imp,
    forfettario: imp.regime === "forfettario",
    mensile: imp.periodicitaIva === "mensile",
    artigiani: eGestioneCommerciale(imp.gestione),
  };

  /*
    La rata è un quarto dei contributi fissi **della sua gestione**, non della
    media che l'app teneva prima: l'importo di legge lo conosce il motore, e
    `contributiFissi` lo scavalca solo se l'utente l'ha dichiarato.
  */
  const fissiAnnui = eGestioneCommerciale(imp.gestione)
    ? dichiarato(imp, "contributiFissi")
      ? imp.contributiFissi
      : par.artigianiCommercianti[imp.gestione].fissi
    : 0;
  const rataArtigiani = round2(fissiAnnui / 4);
  const trimestre = (indice: number) => iva.trimestri[indice]?.totaleDaVersare ?? 0;
  const mese = (indice: number) => iva.mesi[indice]?.totaleDaVersare ?? 0;

  const voci: Voce[] = [
    {
      id: "iva-dicembre-precedente", mese: 2, giorno: 16, categoria: "iva",
      titolo: "IVA di dicembre e saldo del 4° trimestre dell'anno precedente",
      importo: null, quando: (c) => !c.forfettario,
    },
    {
      id: "bollo-4t-precedente", mese: 3, giorno: 16, categoria: "bollo",
      titolo: "Imposta di bollo sulle fatture del 4° trimestre precedente",
      importo: null, quando: (c) => c.forfettario,
    },
    {
      id: "lipe-4t-precedente", mese: 3, giorno: 31, categoria: "dichiarazione",
      titolo: "LIPE — liquidazioni periodiche del 4° trimestre precedente",
      importo: null, quando: (c) => !c.forfettario,
    },
    {
      id: "dichiarazione-iva", mese: 4, giorno: 30, categoria: "dichiarazione",
      titolo: "Dichiarazione IVA annuale", importo: null, quando: (c) => !c.forfettario,
    },
    {
      id: "iva-1t", mese: 5, giorno: 16, categoria: "iva",
      titolo: "IVA del 1° trimestre", importo: trimestre(0),
      quando: (c) => !c.forfettario && !c.mensile,
    },
    {
      id: "lipe-1t", mese: 5, giorno: 31, categoria: "dichiarazione",
      titolo: "LIPE — liquidazioni del 1° trimestre", importo: null,
      quando: (c) => !c.forfettario,
    },
    {
      id: "saldo-e-primo-acconto", mese: 6, giorno: 30, categoria: "imposte",
      titolo: precedente
        ? `Saldo ${precedente.anno} di imposte e contributi più il primo acconto ${imp.anno}`
        : "Saldo di imposte e contributi più il primo acconto",
      importo: precedente ? precedente.saldoResiduo + precedente.acconti.primo : null,
      nota: precedente
        ? undefined
        : `Non c'è un ${imp.anno - 1} da cui calcolarlo: a giugno si versa il saldo dell'anno precedente e l'acconto sui suoi numeri. Se il ${imp.anno} è il tuo primo anno, questa scadenza non ti riguarda.`,
      quando: () => true,
    },
    {
      id: "rinvio-luglio", mese: 7, giorno: 31, categoria: "imposte",
      titolo: "Versamento differito con maggiorazione dello 0,40%",
      importo: null, quando: () => true,
    },
    {
      id: "iva-2t", mese: 8, giorno: 20, categoria: "iva",
      titolo: "IVA del 2° trimestre", importo: trimestre(1),
      quando: (c) => !c.forfettario && !c.mensile,
    },
    {
      id: "lipe-2t", mese: 9, giorno: 30, categoria: "dichiarazione",
      titolo: "LIPE — liquidazioni del 2° trimestre", importo: null,
      quando: (c) => !c.forfettario,
    },
    {
      id: "redditi-pf", mese: 10, giorno: 31, categoria: "dichiarazione",
      titolo: "Dichiarazione dei redditi — Modello Redditi PF",
      importo: null, quando: () => true,
    },
    {
      id: "iva-3t", mese: 11, giorno: 16, categoria: "iva",
      titolo: "IVA del 3° trimestre", importo: trimestre(2),
      quando: (c) => !c.forfettario && !c.mensile,
    },
    {
      id: "secondo-acconto", mese: 11, giorno: 30, categoria: "imposte",
      titolo: precedente?.acconti.accontoUnico
        ? `Acconto unico di imposte e contributi per il ${imp.anno}`
        : `Secondo acconto di imposte e contributi per il ${imp.anno}`,
      importo: precedente ? precedente.acconti.secondo : null,
      nota: precedente
        ? undefined
        : `Si calcola sui numeri del ${imp.anno - 1}, che non c'è.`,
      // Senza l'anno prima la voce resta in elenco senza importo: dire che una
      // scadenza non esiste sarebbe peggio che dire che non se ne sa l'importo.
      quando: () => !precedente || precedente.acconti.dovuti,
    },
    {
      id: "lipe-3t", mese: 11, giorno: 30, categoria: "dichiarazione",
      titolo: "LIPE — liquidazioni del 3° trimestre", importo: null,
      quando: (c) => !c.forfettario,
    },
    {
      id: "acconto-iva", mese: 12, giorno: 27, categoria: "iva",
      titolo: "Acconto IVA annuale", importo: null, quando: (c) => !c.forfettario,
    },
  ];

  // Le quattro rate dei contributi fissi, per anno di contribuzione.
  if (ctx.artigiani) {
    RATE_FISSI.forEach(([mese, giorno, annoDopo], i) => {
      voci.push({
        id: `inps-artigiani-${i + 1}`,
        mese,
        giorno,
        annoDopo,
        categoria: "contributi",
        titolo: `Contributi fissi INPS ${imp.gestione === "artigiani" ? "artigiani" : "commercianti"} — ${i + 1}ª rata ${imp.anno}`,
        importo: rataArtigiani,
        quando: () => true,
      });
    });
  }

  // Liquidazioni mensili: una per ciascun mese, il 16 del mese successivo.
  if (!ctx.forfettario && ctx.mensile) {
    for (let m = 0; m < 12; m++) {
      voci.push({
        id: `iva-mensile-${m + 1}`,
        mese: m === 11 ? 1 : m + 2,
        giorno: 16,
        annoDopo: m === 11,
        categoria: "iva",
        titolo: `IVA di ${NOMI_MESI[m]}`,
        importo: mese(m),
        quando: () => true,
      });
    }
  }

  return voci
    .filter((v) => v.quando(ctx))
    .map((v) => {
      const anno = imp.anno + (v.annoDopo ? 1 : 0);
      const dataDiCalendario = `${anno}-${String(v.mese).padStart(2, "0")}-${String(v.giorno).padStart(2, "0")}`;
      const data = slittaAGiornoLavorativo(dataDiCalendario);
      return {
        id: v.id,
        data,
        ...(data === dataDiCalendario ? {} : { dataDiCalendario }),
        titolo: v.titolo,
        importo: v.importo,
        ...(v.nota ? { nota: v.nota } : {}),
        categoria: v.categoria,
      };
    })
    .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
}

/** Le prossime scadenze a partire dalla data indicata. */
export function prossimeScadenze(
  scadenze: Adempimento[],
  oggiIso: string,
  quante = 4,
): Adempimento[] {
  return scadenze.filter((s) => s.data >= oggiIso).slice(0, quante);
}

const NOMI_MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];
