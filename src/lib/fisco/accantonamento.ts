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
 * Che cosa **non** copre, ed è una decisione
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Solo imposte e contributi, non l'IVA. Non è una dimenticanza: è il perimetro
 * di `fabbisognoDaAccantonare`, che nasce da `totaleDovuto = imposte +
 * contributi`. Allargare alle scadenze IVA gonfierebbe la quota rispetto al
 * residuo che la alimenta, e farebbe litigare questa cifra con quella della
 * card della copertura — cioè rifarebbe, da un'altra porta, l'incoerenza che
 * questo lavoro sta togliendo.
 *
 * Resta vero che per chi è in ordinario l'IVA incassata non è sua. È una
 * decisione di prodotto a sé, ed è annotata in APPROSSIMAZIONI.md.
 */
import { round2, nonNegativo } from "./aritmetica";
import { scadenzeAnno, type Adempimento } from "./scadenze";
import type { LiquidazioneIva } from "./iva";
import type { Prospetto } from "./motore";
import type { Impostazioni, ParametriAnno } from "./tipi";

/** Le categorie di scadenza che l'accantonamento finanzia. */
const FINANZIATE: Adempimento["categoria"][] = ["imposte", "contributi"];

export type VoceQuota = {
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

export type QuotaAccantonamento = {
  /** Quanto mettere da parte questo mese. */
  alMese: number;
  /** Quanto resta da accantonare in tutto: il termine che si distribuisce. */
  daAccantonare: number;
  voci: VoceQuota[];
  metodo: MetodoQuota;
  /** Frasi da mostrare accanto al numero. Vuoto quando non c'è niente da dire. */
  avvisi: string[];
};

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

export function quotaAccantonamento(ing: IngressoQuota): QuotaAccantonamento {
  const daAccantonare = round2(nonNegativo(ing.prospetto.fabbisognoDaAccantonare));
  const avvisi: string[] = [];

  if (daAccantonare === 0) {
    return { alMese: 0, daAccantonare: 0, voci: [], metodo: "scadenze", avvisi };
  }

  const tutte = scadenzeAnno(
    ing.impostazioni,
    ing.parametri,
    ing.prospetto,
    ing.iva,
    ing.precedente,
  );
  const finanziate = tutte.filter(
    (s) => FINANZIATE.includes(s.categoria) && s.importo !== null && s.importo > 0,
  );

  /*
    Il ripiego, quando il calendario non basta: il residuo diviso i mesi che
    restano nell'anno. È meno preciso — non sa *quando* scade — ma è sempre
    meglio del dodicesimo fisso, e soprattutto lo dice.
  */
  if (finanziate.length === 0) {
    avvisi.push(
      ing.precedente === null
        ? "Senza i numeri dell'anno scorso non so quanto valgono gli acconti: questa quota è il residuo diviso i mesi che restano, non una stima sulle scadenze."
        : "Nessuna scadenza di imposte o contributi con un importo: questa quota è il residuo diviso i mesi che restano nell'anno.",
    );
    return {
      alMese: round2(daAccantonare / mesiRimastiNellAnno(ing.oggi)),
      daAccantonare,
      voci: [],
      metodo: "ripiego",
      avvisi,
    };
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

  return {
    alMese: round2(voci.reduce((t, v) => t + v.alMese, 0)),
    daAccantonare,
    voci,
    metodo: "scadenze",
    avvisi,
  };
}
