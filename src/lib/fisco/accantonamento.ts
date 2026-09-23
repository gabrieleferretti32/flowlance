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
 * Sui numeri del dataset di vetrina, al 20 settembre: restano 1.015,85 € da
 * accantonare e tre mesi per farlo — il secondo acconto scade il 30 novembre —
 * e l'app diceva 84,65 € al mese, cioè un dodicesimo di un residuo che ha tre
 * mesi di vita. La cifra vera è 338,62 €: quattro volte tanto. E il consiglio
 * *si era abbassato* da gennaio, perché i soldi erano usciti: la quota scendeva
 * proprio mentre il bisogno per mese rimasto saliva.
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
 * clienti — ed è la più grossa delle due, sul dataset di vetrina 8.476,48 € di
 * IVA da versare nell'anno contro 8.454,38 € di imposte e contributi.
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
import { euro } from "@/lib/format";
import { scadenzeAnno, type Adempimento } from "./scadenze";
import type { LiquidazioneIva } from "./iva";
import type { Prospetto } from "./motore";
import type { Impostazioni, ParametriAnno, VersamentoF24 } from "./tipi";

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
  /**
   * I versamenti in archivio. Servono **all'IVA**: la liquidazione calcola i
   * periodi e non sa niente di quello che è uscito, quindi senza questi un
   * trimestre scaduto e non versato sparirebbe dalla quota, e un trimestre
   * versato in anticipo verrebbe chiesto due volte. Per le imposte non
   * servono — `fabbisognoDaAccantonare` è già al netto dei versamenti.
   */
  versamenti: VersamentoF24[];
  oggi: string;
};

/** Il giorno in cui si salda l'anno: 30 giugno di quello dopo. */
export function giornoDelSaldo(anno: number): string {
  return `${anno + 1}-06-30`;
}

/**
 * L'IVA: ogni scadenza divisa per i mesi che la separano da oggi, al netto
 * di quello che risulta già versato.
 *
 * Metodo C come per le imposte, ma **senza distribuire un residuo**, e la
 * differenza ha una ragione. Il residuo delle imposte esiste — è
 * `fabbisognoDaAccantonare`, già al netto di quello che hai versato — mentre
 * per l'IVA un residuo non c'è: `calcolaIva` liquida i periodi e non sa
 * niente dei versamenti. Il netto se lo fa questa funzione, qui, leggendo i
 * versamenti di tipo «iva» dall'archivio.
 *
 * Una sola regola, per le scadenze passate come per quelle future: i
 * versamenti coprono le scadenze in ordine di data, e quello che resta
 * scoperto è quello che va ancora messo da parte. Cambia solo dove lo si
 * mette — su questo mese se la scadenza è passata, spalmato sui mesi che
 * mancano se deve ancora arrivare.
 */
/**
 * Quanto resta scoperto su ogni scadenza, coprendole in ordine di data.
 *
 * È la regola che `quotaIva` applicava dentro di sé, tirata fuori perché la
 * usa anche chi cerca le **scadenze spuntate senza un F24**: due regole
 * diverse per rispondere alla stessa domanda — «questo è stato versato?» —
 * sono due risposte che prima o poi si contraddicono, e si contraddirebbero
 * proprio in una schermata che esiste per segnalare una contraddizione.
 *
 * Chi ha versato in anticipo copre anche una scadenza futura: lasciare
 * l'avanzo inutilizzato sarebbe un soldo che esiste in archivio e sparisce
 * dal conto.
 */
export function scopertoInOrdine(
  dovute: Adempimento[],
  versato: number,
): { scadenza: Adempimento; scoperto: number }[] {
  let residuo = versato;
  const esito: { scadenza: Adempimento; scoperto: number }[] = [];
  for (const scadenza of [...dovute].sort((a, b) => a.data.localeCompare(b.data))) {
    const importo = scadenza.importo ?? 0;
    const coperto = Math.min(residuo, importo);
    residuo = round2(residuo - coperto);
    esito.push({ scadenza, scoperto: round2(importo - coperto) });
  }
  return esito;
}

/** Quanto è uscito per un tipo di F24, nell'anno d'imposta guardato. */
export function versatoDelTipo(
  versamenti: VersamentoF24[],
  tipo: VersamentoF24["tipo"],
  anno: number,
): number {
  return round2(
    versamenti
      /* L'anno di competenza si legge come lo legge il motore: `annoImposta`
         se c'è, altrimenti l'anno della data. */
      .filter((v) => v.tipo === tipo && (v.annoImposta ?? Number(v.data.slice(0, 4))) === anno)
      .reduce((tot, v) => tot + v.importo, 0),
  );
}

function quotaIva(
  scadenze: Adempimento[],
  liquidazione: LiquidazioneIva,
  versamenti: VersamentoF24[],
  anno: number,
  oggi: string,
): ParteQuota {
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

  const dovute = scadenze
    .filter((s) => s.categoria === "iva" && s.importo !== null && s.importo > 0)
    .sort((a, b) => a.data.localeCompare(b.data));

  /*
    Quanto è già uscito per l'IVA di quest'anno, e che cosa resta scoperto.

    I versamenti di tipo «iva» ci sono in archivio — è `giaVersato` del motore
    che li esclude, perché il suo perimetro è imposte e contributi. Qui servono,
    e vanno usati: senza, un trimestre scaduto e non versato sparirebbe dalla
    quota, e la persona non saprebbe di doverlo mettere da parte.

    La copertura in ordine di data sta in `scopertoInOrdine` e l'attribuzione
    all'anno in `versatoDelTipo`: le usa anche `spunteSenzaF24`, perché è la
    stessa domanda, e due regole diverse per attribuire lo stesso versamento
    sono due numeri che prima o poi smettono di essere d'accordo.
  */
  const voci: VoceQuota[] = [];
  for (const { scadenza: s, scoperto } of scopertoInOrdine(
    dovute,
    versatoDelTipo(versamenti, "iva", anno),
  )) {
    const mesiMancanti = mesiFinoA(s.data, oggi);
    if (scoperto === 0) continue;

    /*
      Quello che resta scoperto su una scadenza passata è un arretrato, e porta
      **la sua data**, non quella di oggi: «entro il 20/09» su una scadenza del
      16 maggio non è un'informazione, è un errore di etichetta. E va su questo
      mese per intero — zero mesi mancanti non è un denominatore.
    */
    voci.push({
      componente: "iva",
      id: s.id,
      titolo: s.titolo,
      data: s.data,
      quota: scoperto,
      mesiMancanti,
      alMese: mesiMancanti === 0 ? scoperto : round2(scoperto / mesiMancanti),
      scaduta: mesiMancanti === 0,
    });
  }
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
  const iva = quotaIva(tutte, ing.iva, ing.versamenti, ing.impostazioni.anno, ing.oggi);
  const finanziate = tutte.filter(
    (s) => FINANZIATE.includes(s.categoria) && s.importo !== null && s.importo > 0,
  );

  const arretratiIva = iva.voci.filter((v) => v.scaduta);
  if (arretratiIva.length > 0) {
    const totale = round2(arretratiIva.reduce((tot, v) => tot + v.quota, 0));
    avvisi.push(
      `${euro(totale)} di IVA risultano non versati su scadenze già passate: vanno messi da parte adesso.`,
    );
  }

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
      Quello che avanza dopo le scadenze di quest'anno è **il saldo dell'anno**,
      e si versa il 30 giugno di quello dopo.

      La prima stesura lo chiamava «scadenza già passata» e lo datava a oggi,
      con l'avviso arancione. Era sbagliato due volte. Primo, non è un
      arretrato: nel dataset dimostrativo quei 2.878,78 € sono esattamente
      7.680,08 di residuo meno 4.801,30 del secondo acconto — cioè quello che
      resterà da saldare a giugno, un debito che non è ancora scaduto e che
      nessuno ha mancato di pagare. Secondo, la data era quella di oggi: «entro
      il 20/09 — scadenza già passata» mette insieme un giorno che non è una
      scadenza e un giudizio che non è vero.

      Il calendario di `scadenzeAnno` si ferma al 31 dicembre, e questa è la
      riga che gli manca: dieci mesi di tempo, non zero.
    */
    const dataSaldo = giornoDelSaldo(ing.impostazioni.anno);
    const mesiMancanti = mesiFinoA(dataSaldo, ing.oggi);
    voci.push({
      componente: "imposte",
      id: "saldo-anno",
      titolo: `Saldo ${ing.impostazioni.anno}, da versare a giugno`,
      data: dataSaldo,
      quota: residuo,
      mesiMancanti,
      /*
        Se anche il 30 giugno fosse passato — si guarda un anno chiuso da un
        pezzo — allora sì che è un arretrato, e vale la regola di sempre:
        l'intero importo su questo mese, nessuna divisione per zero.
      */
      alMese: mesiMancanti === 0 ? residuo : round2(residuo / mesiMancanti),
      scaduta: mesiMancanti === 0,
    });
    if (mesiMancanti === 0) {
      avvisi.push(
        `Il saldo ${ing.impostazioni.anno} andava versato entro il 30 giugno ${ing.impostazioni.anno + 1}: va messo da parte adesso.`,
      );
    }
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

// ————————————————————————————————————————————————————————————
// La spunta dello Scadenzario e i versamenti: dove si contraddicono
// ————————————————————————————————————————————————————————————

/**
 * Le scadenze spuntate che il calcolo considera ancora da versare.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Due schermate che leggono due cose diverse
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Lo Scadenzario legge **la spunta**: una riga in archivio che dice «questo
 * l'ho fatto», senza importo e senza data di pagamento. La quota
 * d'accantonamento legge **i versamenti F24**, che sono denaro con una data.
 * Sono due cose diverse e va bene che lo siano — una è un promemoria, l'altra
 * è un fatto contabile — ma chi guarda vede «Versato» in verde su una
 * scadenza e, nella stessa app, «1.329,67 € già scaduti» che comprendono
 * quella scadenza. Da fuori è l'app che si contraddice.
 *
 * Questa funzione trova esattamente quelle righe, così che tutte e due le
 * schermate possano dirlo invece di lasciarlo scoprire.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La copertura è quella della quota, non una nuova
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un F24 solo copre più scadenze — a giugno si versano insieme saldo e primo
 * acconto — quindi «questa scadenza ha il suo versamento?» non si può
 * rispondere guardando una riga alla volta. Si guarda come guarda la quota:
 * i versamenti di quel tipo, per quell'anno d'imposta, coprono le scadenze di
 * quella categoria **in ordine di data**, e scoperto è quello che la
 * copertura non raggiunge. Stessa regola, stessa funzione, un solo numero.
 *
 * Le scadenze senza un F24 corrispondente — dichiarazioni, bollo — non
 * entrano: spuntare «invio della dichiarazione IVA» non ha niente a che fare
 * con il denaro, e segnalarlo sarebbe un avviso che non si può risolvere.
 */
export type ScadenzaSpuntataScoperta = {
  /** L'id dell'adempimento, quello con cui la spunta è salvata. */
  id: string;
  titolo: string;
  data: string;
  /** Quanto di quella scadenza la copertura non raggiunge. */
  scoperto: number;
  componente: Componente;
};

/**
 * Le due metà sono quelle della quota: IVA da una parte, imposte **e**
 * contributi dall'altra.
 *
 * Tenere separati i due tipi di F24 non-IVA sembrava più preciso ed era
 * sbagliato: la scadenza di giugno si chiama «Saldo di imposte e contributi
 * più il primo acconto» e si versa con F24 che portano tutti e due i tipi.
 * Sui numeri di vetrina — 62,12 € di imposte e 3.267,59 € di contributi
 * contro una scadenza da 3.329,71 € — dividerli faceva risultare scoperti
 * 3.267,59 €, cioè un avviso costruito sulla nostra classificazione e non
 * sui fatti. `fabbisognoDaAccantonare` somma le due cose per la stessa
 * ragione, e qui si fa come fa lui.
 */
const POOL: { componente: Componente; categorie: Adempimento["categoria"][]; tipi: VersamentoF24["tipo"][] }[] = [
  { componente: "iva", categorie: ["iva"], tipi: ["iva"] },
  { componente: "imposte", categorie: ["imposte", "contributi"], tipi: ["imposte", "contributi"] },
];

export function spunteSenzaF24(ing: {
  scadenze: Adempimento[];
  versamenti: VersamentoF24[];
  anno: number;
  /** Gli id degli adempimenti spuntati, già senza il prefisso dell'anno. */
  spuntati: Set<string>;
}): { voci: ScadenzaSpuntataScoperta[]; totale: number } {
  const voci: ScadenzaSpuntataScoperta[] = [];

  for (const pool of POOL) {
    const dovute = ing.scadenze.filter(
      (s) => pool.categorie.includes(s.categoria) && s.importo !== null && s.importo > 0,
    );
    const versato = round2(
      pool.tipi.reduce((tot, t) => tot + versatoDelTipo(ing.versamenti, t, ing.anno), 0),
    );
    for (const { scadenza, scoperto } of scopertoInOrdine(dovute, versato)) {
      if (scoperto === 0) continue;
      if (!ing.spuntati.has(scadenza.id)) continue;
      voci.push({
        id: scadenza.id,
        titolo: scadenza.titolo,
        data: scadenza.data,
        scoperto,
        componente: pool.componente,
      });
    }
  }

  return {
    voci: voci.sort((a, b) => a.data.localeCompare(b.data)),
    totale: round2(voci.reduce((tot, v) => tot + v.scoperto, 0)),
  };
}
