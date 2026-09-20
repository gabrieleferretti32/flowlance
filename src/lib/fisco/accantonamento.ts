/**
 * Quanto mettere da parte **questo mese**, e non «in un mese qualunque».
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Che cosa c'era prima, e perché non poteva funzionare
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `accantonamentoMensile` era `fabbisognoDaAccantonare / 12`. Il difetto non è
 * la divisione: è che numeratore e denominatore misurano **due tempi diversi**.
 * Il numeratore è un residuo — si accorcia ogni volta che versi e ogni mese che
 * passa — mentre il denominatore è fermo a «un anno intero». Vanno d'accordo in
 * un istante solo: il 1° gennaio, con nulla ancora versato.
 *
 * Sui numeri del dataset di vetrina, al 20 settembre: restano 3.035,93 € da
 * accantonare e quattro mesi per farlo, e l'app diceva 252,99 € al mese —
 * ventiquattro volte dodici invece che per quattro. E il consiglio *si era
 * dimezzato* da gennaio, perché i soldi erano usciti: la quota scendeva proprio
 * mentre il bisogno per mese rimasto saliva.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Come funziona adesso: un fondo che guarda le scadenze
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il residuo si distribuisce sulle scadenze **future**, in ordine di data,
 * riempiendone una alla volta fino al suo importo. Quello che tocca a ciascuna
 * si divide per i mesi che mancano a quella scadenza, questo compreso. La quota
 * del mese è la somma.
 *
 * Non si sommano gli importi delle scadenze: si distribuisce il residuo. È la
 * differenza che conta, perché una scadenza già pagata compare lo stesso nel
 * calendario — il 30 giugno resta scritto anche dopo averlo versato — e
 * sommarla rifinanzierebbe denaro già uscito.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Due componenti, e perché non una sola somma
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Imposte e contributi da una parte, IVA dall'altra. Si sommano solo alla
 * fine, nella cifra che si mostra.
 *
 * L'IVA **deve** esserci: per chi è in ordinario l'IVA incassata non è sua, e
 * il limite di spesa del modulo parte dalle entrate in banca, che la
 * comprendono. Una quota che la escludesse lascerebbe spendere l'IVA dei
 * clienti — ed è la cifra più grossa delle due, sul dataset di vetrina 9.682 €
 * contro 15.167 € di carico fiscale intero.
 *
 * Ma le due metà **non si mescolano nel numeratore**. `fabbisognoDaAccantonare`
 * nasce da `totaleDovuto = imposte + contributi` e dai versamenti non-IVA:
 * infilarci dentro l'IVA vorrebbe dire sommare un residuo già al netto dei
 * versamenti con degli importi lordi, e il risultato non sarebbe né l'uno né
 * l'altro. Restano due conti, con due metodi leggermente diversi e per ragioni
 * diverse — vedi `quotaIva` — e la card li mostra separati.
 *
 * In forfettario la componente IVA è zero, e c'è una riga che lo dice:
 * `quotaIva` guarda `liquidazione.applicabile`, la stessa condizione che usa
 * tutto il resto dell'app. Fidarsi che i dati escano a zero non bastava — un
 * archivio con fatture che portano la loro aliquota produce importi lo stesso.
 */
import { round2, nonNegativo } from "./aritmetica";
import { scadenzeAnno, type Adempimento } from "./scadenze";
import type { LiquidazioneIva } from "./iva";
import type { Prospetto } from "./motore";
import type { Impostazioni, ParametriAnno } from "./tipi";

/** Le categorie di scadenza che l'accantonamento finanzia. */
const FINANZIATE: Adempimento["categoria"][] = ["imposte", "contributi"];

/** Quale delle due metà: il fisco sul reddito, o l'IVA dei clienti. */
export type Componente = "imposte" | "iva";

export type VoceQuota = {
  componente: Componente;
  id: string;
  titolo: string;
  data: string;
  /** Quanto di quello che resta da accantonare è destinato a questa scadenza. */
  quota: number;
  /** Mesi che mancano, questo compreso. **Zero vuol dire scaduta.** */
  mesiMancanti: number;
  alMese: number;
  scaduta: boolean;
};

export type MetodoQuota = "scadenze" | "ripiego";

export type ParteQuota = {
  alMese: number;
  /** Quanto resta da mettere da parte per questa metà, in tutto. */
  daAccantonare: number;
  voci: VoceQuota[];
};

export type QuotaAccantonamento = {
  /** Quanto mettere da parte questo mese, tutto compreso. È il numero grande. */
  alMese: number;
  imposte: ParteQuota;
  iva: ParteQuota;
  metodo: MetodoQuota;
  /** Frasi da mostrare accanto al numero. Vuoto quando non c'è niente da dire. */
  avvisi: string[];
};

const VUOTA: ParteQuota = { alMese: 0, daAccantonare: 0, voci: [] };

const anno = (d: string) => Number(d.slice(0, 4));
const mese = (d: string) => Number(d.slice(5, 7));

/**
 * I mesi che mancano a una scadenza, questo compreso.
 *
 * Zero quando la scadenza è **passata**: non è un errore da arrotondare a uno,
 * è la condizione in cui l'intera quota va messa da parte adesso. Ed è il caso
 * in cui una divisione ingenua troverebbe uno zero al denominatore.
 */
export function mesiFinoA(scadenza: string, oggi: string): number {
  if (scadenza < oggi) return 0;
  return (anno(scadenza) - anno(oggi)) * 12 + (mese(scadenza) - mese(oggi)) + 1;
}

/** Quanti mesi restano nell'anno di `oggi`, questo compreso. Mai meno di uno. */
export function mesiRimastiNellAnno(oggi: string): number {
  return Math.max(1, 13 - mese(oggi));
}

export type IngressoQuota = {
  prospetto: Prospetto;
  impostazioni: Impostazioni;
  parametri: ParametriAnno;
  iva: LiquidazioneIva;
  /**
   * Il prospetto dell'anno prima. **Senza, gli acconti escono senza importo**
   * — `scadenzeAnno` li calcola sui numeri dell'anno precedente — e le due
   * scadenze più grosse dell'anno diventano invisibili al calcolo. Quando
   * manca si passa al ripiego e lo si dice: una quota costruita su un
   * calendario mezzo vuoto sarebbe più bassa del vero, in silenzio.
   */
  precedente: Prospetto | null;
  oggi: string;
};

/**
 * L'IVA: ogni scadenza futura divisa per i mesi che la separano da oggi.
 *
 * Metodo C come per le imposte, ma **senza distribuire un residuo**, e la
 * differenza ha una ragione. Il residuo delle imposte esiste — è
 * `fabbisognoDaAccantonare`, già al netto di quello che hai versato — mentre
 * per l'IVA un residuo non c'è: `calcolaIva` liquida i periodi e non sa
 * niente dei versamenti. L'importo di una scadenza IVA **è** quello che si
 * deve a quella data, quindi si prende com'è.
 *
 * La conseguenza va detta, ed è in APPROSSIMAZIONI.md: un trimestre già
 * scaduto e non versato qui non si vede. Le scadenze passate si saltano, e
 * nessuno può dire se sono state pagate.
 */
function quotaIva(scadenze: Adempimento[], liquidazione: LiquidazioneIva, oggi: string): ParteQuota {
  /*
    In forfettario non c'è componente IVA, e lo si dice qui invece di sperare
    che i dati escano a zero.

    La prima stesura si fidava del fatto che in forfettario non ci fossero
    scadenze IVA con un importo. Un test l'ha smentita: basta un archivio con
    le fatture che portano la loro aliquota — il caso di chi passa a
    forfettario a metà anno, o di chi ha importato un anno da ordinario —
    perché la liquidazione produca importi lo stesso, e la quota chiedeva di
    accantonare un'IVA che quella persona non addebita più.

    `applicabile` è la stessa riga che usa tutto il resto dell'app per
    decidere se l'IVA esiste: qui si legge quella, non si rifà il giudizio.
  */
  if (!liquidazione.applicabile) return VUOTA;

  const voci: VoceQuota[] = [];
  for (const s of scadenze) {
    if (s.categoria !== "iva" || s.importo === null || s.importo <= 0) continue;
    const mesiMancanti = mesiFinoA(s.data, oggi);
    if (mesiMancanti === 0) continue;
    voci.push({
      componente: "iva",
      id: s.id,
      titolo: s.titolo,
      data: s.data,
      quota: round2(s.importo),
      mesiMancanti,
      alMese: round2(s.importo / mesiMancanti),
      scaduta: false,
    });
  }
  voci.sort((a, b) => a.data.localeCompare(b.data));
  return {
    alMese: round2(voci.reduce((tot, v) => tot + v.alMese, 0)),
    daAccantonare: round2(voci.reduce((tot, v) => tot + v.quota, 0)),
    voci,
  };
}

export function quotaAccantonamento(ing: IngressoQuota): QuotaAccantonamento {
  const daAccantonare = round2(nonNegativo(ing.prospetto.fabbisognoDaAccantonare));
  const avvisi: string[] = [];

  const tutte = scadenzeAnno(
    ing.impostazioni,
    ing.parametri,
    ing.prospetto,
    ing.iva,
    ing.precedente,
  );
  const iva = quotaIva(tutte, ing.iva, ing.oggi);
  const finanziate = tutte.filter(
    (s) => FINANZIATE.includes(s.categoria) && s.importo !== null && s.importo > 0,
  );

  const chiudi = (imposte: ParteQuota, metodo: MetodoQuota): QuotaAccantonamento => ({
    alMese: round2(imposte.alMese + iva.alMese),
    imposte,
    iva,
    metodo,
    avvisi,
  });

  if (daAccantonare === 0) return chiudi(VUOTA, "scadenze");

  /*
    Il ripiego, quando il calendario delle imposte non basta: il residuo diviso
    i mesi che restano nell'anno. Riguarda **solo** la componente delle
    imposte: le scadenze IVA hanno i loro importi anche senza l'anno prima —
    li produce la liquidazione di quest'anno — quindi la loro metà resta
    calcolata sulle scadenze.
  */
  if (finanziate.length === 0) {
    avvisi.push(
      ing.precedente === null
        ? "Senza i numeri dell'anno scorso non so quanto valgono gli acconti: la parte di imposte e contributi è il residuo diviso i mesi che restano, non una stima sulle scadenze."
        : "Nessuna scadenza di imposte o contributi con un importo: quella parte è il residuo diviso i mesi che restano nell'anno.",
    );
    return chiudi(
      {
        alMese: round2(daAccantonare / mesiRimastiNellAnno(ing.oggi)),
        daAccantonare,
        voci: [],
      },
      "ripiego",
    );
  }

  /*
    Si riempiono le scadenze **future** in ordine di data, una alla volta, fino
    al loro importo. Quello che avanza dopo averle riempite tutte è denaro che
    doveva già essere versato: va su questo mese, e lo si dice.
  */
  const future = finanziate
    .filter((s) => mesiFinoA(s.data, ing.oggi) > 0)
    .sort((a, b) => a.data.localeCompare(b.data));

  const voci: VoceQuota[] = [];
  let residuo = daAccantonare;
  for (const s of future) {
    if (residuo <= 0) break;
    const quota = round2(Math.min(residuo, s.importo as number));
    const mesiMancanti = mesiFinoA(s.data, ing.oggi);
    voci.push({
      componente: "imposte",
      id: s.id,
      titolo: s.titolo,
      data: s.data,
      quota,
      mesiMancanti,
      alMese: round2(quota / mesiMancanti),
      scaduta: false,
    });
    residuo = round2(residuo - quota);
  }

  if (residuo > 0) {
    /*
      Nessuna divisione per zero, e nessun arrotondamento di comodo: se i mesi
      mancanti sono zero l'importo intero è di questo mese. Succede quando il
      residuo supera tutte le scadenze future — cioè quando qualcosa è già
      scaduto e non è stato versato.
    */
    voci.push({
      componente: "imposte",
      id: "in-ritardo",
      titolo: "Da versare, scadenza già passata",
      data: ing.oggi,
      quota: residuo,
      mesiMancanti: 0,
      alMese: residuo,
      scaduta: true,
    });
    avvisi.push(
      `${residuo.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € superano quello che resta da versare entro le prossime scadenze: è denaro che doveva già essere uscito, e va messo da parte adesso.`,
    );
  }

  return chiudi(
    {
      alMese: round2(voci.reduce((tot, v) => tot + v.alMese, 0)),
      daAccantonare,
      voci,
    },
    "scadenze",
  );
}
