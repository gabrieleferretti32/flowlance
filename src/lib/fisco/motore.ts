/**
 * Il motore fiscale: dalla catena di calcolo del brief al prospetto completo.
 *
 * Tutto il calcolo delle imposte segue il principio di cassa: contano gli
 * incassi e i pagamenti effettivi, non le date dei documenti.
 * (La liquidazione IVA fa eccezione e sta in `iva.ts`: quella segue la data
 * del documento.)
 */
import { limita, nonNegativo, rapporto, round2, somma } from "./aritmetica";
import {
  addizionaleComunaleDi,
  addizionaleDovuta,
  addizionaleRegionaleDi,
} from "./addizionali";
import { detrazioneLavoroAutonomo } from "./detrazioni";
import {
  baseContributivaCpb,
  scostamentoDalConcordato,
  scostamentoDaSegnalare,
  valutaConcordato,
  type EsitoConcordato,
} from "./cpb";
import { derivato } from "./derivati/registro";
import { eGestioneCommerciale } from "./tipi";
import { impostaProgressiva } from "./scaglioni";
import { aliquota, interoIt } from "../format";
import { annoDi, calcolaCosto, calcolaFattura } from "./documenti";
import { dateCosto, dateFattura, ripartisci } from "./competenza";
import { calcolaNota, dateNota, stornoPerFattura, storniDiCassa, type NotaCalcolata } from "./note";
import type {
  NotaCredito,
  Costo,
  CostoCalcolato,
  Fattura,
  FatturaCalcolata,
  Gestione,
  Impostazioni,
  ParametriAnno,
  RegolaAcconto,
  ScaglioneIrpef,
  VersamentoF24,
} from "./tipi";

export type IngressoMotore = {
  impostazioni: Impostazioni;
  parametri: ParametriAnno;
  fatture: Fattura[];
  costi: Costo[];
  /** Le note di credito emesse. Stornano ricavi e IVA con le stesse due date. */
  note?: NotaCredito[];
  versamenti?: VersamentoF24[];
  /**
   * Le impostazioni degli altri anni presenti in archivio.
   *
   * Serve perché ogni documento va calcolato con le regole del **suo** anno:
   * una fattura del 2026 emessa in forfettario non prende l'IVA al 22% solo
   * perché nel 2027 si è passati all'ordinario. Senza questo elenco il motore
   * ricade sulle impostazioni dell'anno in esame, che è corretto finché di anni
   * ce n'è uno solo.
   */
  impostazioniPerAnno?: Impostazioni[];
  /**
   * Credito d'imposta che arriva dall'anno precedente (eccedenza di acconti,
   * ritenute superiori alle imposte). Si scomputa dal saldo e dagli acconti.
   */
  creditoAnnoPrecedente?: number;
  /**
   * Gli acconti che l'anno precedente ha calcolato *per questo anno*: sono le
   * due rate di giugno e novembre, e quello che se ne versa riduce il saldo.
   * `null` al primo anno di attività, dove un anno prima non c'è.
   */
  accontiDelPrecedente?: Acconti | null;
  /** Data di riferimento per stati e ritardi. Iniettata: il motore resta puro. */
  oggi: string;
};

/**
 * Le impostazioni da usare per un documento, in base al suo anno.
 *
 * Per un anno non censito si prende l'anno censito più vicino **precedente**,
 * e in mancanza il più vicino in assoluto: un documento vecchio calcolato con
 * le regole di un anno futuro è esattamente l'errore che questa funzione evita.
 */
export function risolutoreImpostazioni(
  corrente: Impostazioni,
  tutte: Impostazioni[] = [],
): (anno: number) => Impostazioni {
  const perAnno = new Map<number, Impostazioni>();
  for (const i of tutte) perAnno.set(i.anno, i);
  perAnno.set(corrente.anno, perAnno.get(corrente.anno) ?? corrente);
  const anni = [...perAnno.keys()].sort((a, b) => a - b);

  return (anno) => {
    const esatta = perAnno.get(anno);
    if (esatta) return esatta;
    const precedenti = anni.filter((a) => a < anno);
    if (precedenti.length > 0) return perAnno.get(precedenti[precedenti.length - 1]) as Impostazioni;
    return perAnno.get(anni[0]) ?? corrente;
  };
}

export type StatoSoglia =
  | "nessunLimite"
  | "neiLimiti"
  | "avviso"
  | "limiteSuperato"
  | "uscitaImmediata";

export type Acconti = {
  dovuti: boolean;
  primo: number;
  secondo: number;
  /** Sotto la soglia dei 257,52 € l'acconto è unico e si versa a novembre. */
  accontoUnico: boolean;
  /** Le tre quote di cui ogni rata è fatta, perché il prospetto possa dirlo. */
  imposte: { primo: number; secondo: number; unico: boolean };
  /** Solo l'addizionale comunale: la regionale non ha acconto. */
  addizionali: { primo: number; secondo: number; base: number; quota: number };
  contributi: { primo: number; secondo: number; base: number; quota: number };
  /** Quanto del credito dell'anno precedente è servito a coprire gli acconti. */
  creditoUtilizzato: number;
  /** Quello che resta del credito dopo aver coperto gli acconti. */
  creditoResiduo: number;
  /** Acconti al netto del credito: la cifra che esce davvero dal conto. */
  primoDaVersare: number;
  secondoDaVersare: number;
};

/** Che cosa il concordato fa al prospetto di un anno. */
export type ConcordatoProspetto = {
  /** Quello che il blocco delle impostazioni dice, già valutato per quest'anno. */
  esito: EsitoConcordato;
  /** Il reddito che hai prodotto davvero: ricavi meno costi deducibili. */
  redditoEffettivo: number;
  /** Il reddito su cui si pagano le imposte: quello della proposta. */
  redditoConcordato: number;
  /** Quanto l'effettivo si discosta dal concordato, in frazione. Negativo: sotto. */
  scostamento: number;
  /** Sotto il concordato di oltre il 30 %: si segnala, non si applica niente. */
  oltreSogliaCessazione: boolean;
  /** La base su cui sono stati calcolati i contributi. */
  baseContributiva: number;
  /** Imposte e contributi come sono stati calcolati davvero. */
  conCpb: { imposte: number; contributi: number; carico: number };
  /** Gli stessi, come se non avessi aderito. */
  senzaCpb: { imposte: number; contributi: number; carico: number };
  /**
   * La differenza fra i due: **negativa quando il concordato fa risparmiare**.
   *
   * Il segno è quello del costo, non quello del vantaggio, perché è un carico:
   * «meno 2.000 €» si legge come duemila euro in meno da pagare. Girarlo
   * avrebbe voluto dire una card che mostra un numero positivo quando le cose
   * vanno bene e un motore che ne calcola uno negativo.
   */
  effetto: number;
  /** La maggiorazione del 10 % sulla seconda rata, al primo anno di adesione. */
  maggiorazioneAcconto: number;
  /** Quanto ne resta da versare, visti gli F24 già registrati per l'anno. */
  maggiorazioneDaVersare: number;
};

export type Prospetto = {
  anno: number;
  regime: Impostazioni["regime"];

  /** A · Base di calcolo (principio di cassa) */
  compensiIncassati: number;
  rivalsaIncassata: number;
  ricaviRilevanti: number;
  /** IVA incassata dai clienti sulle fatture riscosse: denaro in cassa che non è tuo. */
  ivaIncassata: number;
  /** Compensi più IVA incassata: il denaro lordo entrato davvero in cassa. */
  incassatoLordo: number;
  costiPagatiTotale: number;
  costiDeducibiliPagati: number;
  ivaDetraibilePagata: number;
  bolloACarico: number;
  fatturatoEmesso: number;

  /**
   * Note di credito, tenute separate e mai annegate nei totali.
   *
   * `stornoIncassato` è già sottratto da `compensiIncassati` e da
   * `ricaviRilevanti`; `stornoEmesso` da `fatturatoEmesso`. Restano qui in
   * chiaro perché un fatturato che cala senza dire perché è il modo più veloce
   * di far perdere fiducia in un prospetto.
   */
  note: {
    /** Storni con data di rimborso nell'anno: hanno già ridotto i ricavi per cassa. */
    stornoIncassato: number;
    /** Storni con data documento nell'anno: hanno già ridotto il fatturato emesso. */
    stornoEmesso: number;
    /** IVA che le note tolgono al debito dell'anno. */
    ivaStornata: number;
    /** Emesse e non ancora rimborsate: ridurranno i ricavi quando il denaro torna. */
    stornoDaRimborsare: number;
    numero: number;
    /** Quanto delle note emesse non è agganciato a nessuna fattura. */
    nonRiconciliato: number;
  };

  /** Soglie del regime forfettario */
  soglia: {
    stato: StatoSoglia;
    baseCassa: number;
    baseCompetenza: number;
    /** Emesso e non ancora incassato: se rientra entro dicembre sposta la soglia. */
    inSospeso: number;
    utilizzoLimite: number;
    messaggio: string;
  };

  /** B · Reddito imponibile */
  redditoLordo: number;
  contributiCompetenza: number;
  contributiDedotti: number;
  fonteContributiDedotti: "versamenti" | "competenza";
  oneriDeducibili: number;
  imponibile: number;

  /** C · Imposte */
  impostaSostitutiva: number;
  irpefLorda: number;
  /** Detrazioni indicate a mano nelle impostazioni: familiari, spese, altro. */
  detrazioni: number;
  /** Art. 13 TUIR: spetta d'ufficio sui redditi di lavoro autonomo. */
  detrazioneAutonomo: number;
  /** Le due sommate, prima del confronto con l'imposta lorda. */
  detrazioniTotali: number;
  /** Quante ne sono servite davvero: oltre l'imposta lorda l'eccedenza si perde. */
  detrazioniApplicate: number;
  irpefNetta: number;
  addizionaleRegionale: number;
  addizionaleComunale: number;
  totaleImposte: number;
  ritenuteSubite: number;
  /** L'imponibile su cui sono state trattenute: netto degli storni riconciliati. */
  baseRitenute: number;
  /** Quanto le note di credito hanno tolto a quella base. */
  stornoDedottoDalleRitenute: number;
  imposteNetteASaldo: number;
  creditoImposta: number;

  /** D · Contributi previdenziali */
  baseContributiva: number;
  contributiGestioneSeparata: number;
  contributiArtigiani: number;
  contributiCassa: number;
  totaleContributi: number;
  accreditoIntero: boolean | null;

  /**
   * D-bis · Il concordato preventivo biennale.
   *
   * `null` quando non c'è: forfettario, o nessuna adesione. Non un oggetto con
   * tutti zero — che a schermo si distingue male da un'adesione senza numeri —
   * ma l'assenza, che è esattamente la condizione di quasi tutti.
   *
   * Dentro c'è anche il conto **senza** concordato, e non è ridondanza: è
   * l'unica risposta possibile alla domanda «mi è convenuto?», e calcolarla
   * fuori di qui significherebbe rifare la catena delle imposte in una
   * schermata.
   */
  concordato: ConcordatoProspetto | null;

  /** E · Sintesi e accantonamento */
  caricoTotale: number;
  pressione: number;
  costiNettiACarico: number;
  nettoDisponibile: number;
  /** La percentuale che coprirebbe il fabbisogno di cassa, non il carico. */
  percentualeTeoricaAccantonamento: number;
  percentualeImpostata: number;
  accantonamentoAnnuo: number;
  /**
   * Quanto resta davvero da mettere da parte: carico totale meno le ritenute
   * già subite e il credito riportato dall'anno prima. Sono imposta già pagata.
   */
  fabbisognoDaAccantonare: number;
  /**
   * Quanto costa l'anno intero, versamenti già fatti compresi: è il termine di
   * confronto della percentuale impostata, che sull'anno intero lavora anche
   * lei. `fabbisognoDaAccantonare` è la stessa cosa al netto di quello che è
   * già uscito — le due righe rispondono a due domande diverse.
   */
  fabbisognoAnnuo: number;
  /** Sotto questo scarto l'accantonamento si considera a posto. */
  tolleranzaAccantonamento: number;
  /** Se la percentuale impostata basta, tolleranza compresa. */
  accantonamentoSufficiente: boolean;
  scostamentoAccantonamento: number;
  accantonamentoMensile: number;

  /** F · Saldo, acconti e rateizzazione */
  totaleDovuto: number;
  giaVersato: number;
  /**
   * Quanto di `giaVersato` è finito qui solo per la data di pagamento, senza
   * un anno d'imposta dichiarato. È la parte che potrebbe essere di un altro
   * anno, e va detta finché resta.
   */
  versamentiSenzaAnno: number;
  /** Versato nell'anno ma riferito ad altri anni d'imposta: non scomputa qui. */
  versamentiAltriAnni: number;
  saldoResiduo: number;
  /**
   * Quanto del saldo residuo se ne andrà con gli acconti *di quest'anno*,
   * ancora da versare. Sta dentro `saldoResiduo`, non si somma.
   */
  accontiAncoraDaVersare: number;
  /** Quello che resta a giugno dell'anno dopo, dopo gli acconti di novembre. */
  saldoDopoAcconti: number;
  acconti: Acconti;
  rataRateizzazione: number;
  rataRateizzazioneConInteressi: number;
  /** Credito arrivato dall'anno precedente, prima di essere utilizzato. */
  creditoAnnoPrecedente: number;
  /** Quanto di quel credito è servito a coprire il saldo. */
  creditoUtilizzatoSuSaldo: number;

  /**
   * G · Documenti a cavallo d'anno.
   *
   * Le grandezze che attraversano il 31 dicembre, tenute a vista perché sono
   * quelle su cui si sbaglia: entrano nelle imposte di un anno e nell'IVA di
   * un altro.
   */
  aCavallo: {
    /** Incassato quest'anno su fatture emesse in anni precedenti: reddito di quest'anno, IVA già liquidata. */
    ricaviDaAnniPrecedenti: number;
    /** Emesso quest'anno e già incassato in un anno successivo: IVA di quest'anno, reddito di quello. */
    ricaviVersoAnniSuccessivi: number;
    /** Emesso quest'anno e non ancora incassato: IVA dovuta, reddito ancora senza anno. */
    ricaviSospesi: number;
    /** IVA di competenza di quest'anno su fatture che incasserai dopo: dovuta comunque. */
    ivaSuIncassiFuturi: number;
    costiDaAnniPrecedenti: number;
    costiVersoAnniSuccessivi: number;
    costiSospesi: number;
    /** IVA detraibile di quest'anno su costi che pagherai dopo: detraibile comunque. */
    ivaDetraibileSuPagamentiFuturi: number;
    /** Quante fatture e quanti costi attraversano il confine. */
    numeroFatture: number;
    numeroCosti: number;
  };

  /** Documenti già calcolati, per non ripetere il lavoro a valle. */
  fattureCalcolate: FatturaCalcolata[];
  costiCalcolati: CostoCalcolato[];
  noteCalcolate: NotaCalcolata[];
};

/** IRPEF a scaglioni progressivi. La formula sta in `scaglioni.ts`: la
 * condividono le addizionali regionali, che molte regioni applicano così. */
export function irpefScaglioni(imponibile: number, scaglioni: ScaglioneIrpef[]): number {
  return impostaProgressiva(imponibile, scaglioni);
}

/** Contributi previdenziali sulla base imponibile contributiva. */
/**
 * I contributi di artigiani e commercianti: fissi, due scaglioni, un massimale.
 *
 * Era un'aliquota piatta sull'eccedenza, e sbagliava in tre modi. Applicava il
 * 24,48 % dei commercianti anche agli artigiani, che versano il 24 %. Ignorava
 * il punto percentuale in più oltre la prima fascia di retribuzione
 * pensionabile. E non aveva massimale, quindi a redditi alti il contributo
 * cresceva senza fermarsi.
 *
 * I tre errori non si sommano: si **compensano**. Su un artigiano a 100.000 €
 * il totale sbagliato era di soli 30 € sopra il vero, con due componenti
 * entrambe fuori posto. È il difetto peggiore possibile in un prospetto che si
 * vende sulla verificabilità di ogni riga — un totale plausibile che nessuno
 * ricontrolla perché non stona.
 *
 * I contributi fissi sono un importo pubblicato, non una percentuale: l'app li
 * conosce e li usa. Il campo `contributiFissi` li scavalca solo se l'utente lo
 * ha dichiarato, che è il caso di chi gode di una riduzione.
 */
export function contributiCommerciali(
  reddito: number,
  imp: Impostazioni,
  par: ParametriAnno,
): number {
  if (!eGestioneCommerciale(imp.gestione)) return 0;
  const regole = par.artigianiCommercianti;
  const sua = regole[imp.gestione];
  const fissi = derivato("contributiFissi", imp, par).valore ?? 0;

  // Sopra il massimale non si versa più niente: il reddito eccedente non è
  // imponibile ai fini contributivi.
  const imponibile = Math.min(nonNegativo(reddito), regole.massimale);
  const primaFascia = nonNegativo(
    Math.min(imponibile, regole.primaFasciaPensionabile) - regole.minimale,
  );
  const oltreFascia = nonNegativo(imponibile - regole.primaFasciaPensionabile);

  return round2(
    fissi + primaFascia * sua.aliquota + oltreFascia * sua.aliquotaOltreFascia,
  );
}

export function contributiPrevidenziali(
  base: number,
  imp: Impostazioni,
  par: ParametriAnno,
): { separata: number; artigiani: number; cassa: number; totale: number } {
  const positiva = nonNegativo(base);
  /*
    La condizione «questa gestione versa qui» non si ripete: sta dentro il
    valore. Un derivato `null` vuol dire che la voce non esiste per questa
    persona, e il contributo è zero perché non c'è, non perché l'aliquota è
    zero. Prima la stessa domanda era scritta qui, nel semaforo, nel prospetto
    e nelle spiegazioni: quattro copie, quattro occasioni di rispondere
    diversamente.
  */
  const aliquotaGs = derivato("aliquotaGestioneSeparata", imp, par).valore;
  const massimaleGs = derivato("massimaleGs", imp, par).valore;
  const separata =
    aliquotaGs === null || massimaleGs === null
      ? 0
      : round2(Math.min(positiva, massimaleGs) * aliquotaGs);
  // Il nome del campo resta `artigiani` perché è la voce del prospetto, e
  // rinominarla romperebbe ogni schermata per un guadagno nullo.
  const artigiani = contributiCommerciali(positiva, imp, par);
  const aliquotaCassa = derivato("aliquotaSoggettivaCassa", imp, par).valore;
  const cassa = aliquotaCassa === null ? 0 : round2(positiva * aliquotaCassa);
  return { separata, artigiani, cassa, totale: somma(separata, artigiani, cassa) };
}

/**
 * Imposte e contributi di un reddito, una volta sola.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché è una funzione e non il corpo del motore
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Da quando c'è il concordato preventivo, questo conto si fa **due volte**: sul
 * reddito che fa testo — il concordato, per chi ha aderito — e sul reddito
 * effettivo, che serve a dire quanto è costato aderire. La differenza fra i due
 * è un numero che il cruscotto mostra, e calcolarla con due formule diverse
 * vorrebbe dire inventarla: basta che una delle due dimentichi un'addizionale
 * e il «risparmio» mostrato diventa quello di un'altra persona.
 *
 * Quindi una funzione sola, chiamata due volte con due redditi. Senza
 * concordato la seconda chiamata non si fa nemmeno: il carico è uno, ed è
 * questo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * I tre redditi che non sono lo stesso reddito
 * ─────────────────────────────────────────────────────────────────────────
 *
 * - `redditoImponibileLordo` forma la base IRPEF: concordato o effettivo.
 * - `redditoPerDetrazioni` è il reddito **complessivo** da cui scende la
 *   detrazione dell'art. 13, e resta quello effettivo anche sotto concordato.
 * - `baseContributiva` è quella dei contributi, che per le casse private non
 *   segue il concordato: vedi `baseContributivaCpb`.
 *
 * Erano un numero solo, e in tre punti del motore si leggeva `redditoLordo`.
 * Tenerli separati è la ragione per cui il concordato non ha dovuto riscrivere
 * la catena di calcolo: l'ha solo chiamata con numeri diversi.
 */
export type CaricoFiscale = {
  contributi: { separata: number; artigiani: number; cassa: number; totale: number };
  contributiDedotti: number;
  imponibile: number;
  impostaSostitutiva: number;
  /** L'imposta sostitutiva del concordato, se l'opzione è attiva. */
  impostaSostitutivaCpb: number;
  irpefLorda: number;
  detrazioni: number;
  detrazioneAutonomo: number;
  detrazioniTotali: number;
  detrazioniApplicate: number;
  irpefNetta: number;
  addizionaleRegionale: number;
  addizionaleComunale: number;
  totaleImposte: number;
  /** Imposte più contributi: il confronto fra due scenari si fa su questo. */
  caricoTotale: number;
};

export function caricoFiscale(p: {
  imp: Impostazioni;
  par: ParametriAnno;
  /** Il reddito che forma la base imponibile delle imposte. */
  redditoImponibileLordo: number;
  /** Il reddito complessivo per detrazioni e deduzioni: sempre l'effettivo. */
  redditoPerDetrazioni: number;
  baseContributiva: number;
  oneriDeducibili: number;
  /** Contributi usciti dal conto nell'anno: se ce ne sono, comandano loro. */
  versamentiContributi: number;
  /**
   * La quota di reddito concordato tassata con l'imposta sostitutiva: esce
   * dalla base IRPEF e dalle addizionali, che la sostitutiva sostituisce.
   */
  quotaSostitutivaCpb?: number;
  impostaSostitutivaCpb?: number;
}): CaricoFiscale {
  const { imp, par } = p;
  const forfettario = imp.regime === "forfettario";

  const contributi = contributiPrevidenziali(p.baseContributiva, imp, par);
  const contributiDedotti =
    p.versamentiContributi > 0 ? p.versamentiContributi : contributi.totale;

  /*
    La quota a sostitutiva esce dalla base: su di lei l'IRPEF e le addizionali
    non si pagano, è esattamente il senso dell'opzione. Quello che resta del
    concordato segue la strada di sempre.
  */
  const quotaSostitutivaCpb = nonNegativo(p.quotaSostitutivaCpb ?? 0);
  const impostaSostitutivaCpb = nonNegativo(p.impostaSostitutivaCpb ?? 0);
  const imponibile = round2(
    nonNegativo(
      p.redditoImponibileLordo - quotaSostitutivaCpb - contributiDedotti - p.oneriDeducibili,
    ),
  );

  // L'aliquota si deriva dalla data di apertura, non si legge da un campo: la
  // regola dei cinque anni è un conto, e i conti li fa il motore.
  const sostitutiva = derivato("aliquotaSostitutiva", imp, par);
  const impostaSostitutiva = forfettario ? round2(imponibile * sostitutiva.valore) : 0;
  const irpefLorda = forfettario ? 0 : irpefScaglioni(imponibile, imp.scaglioniIrpef);
  const detrazioni = forfettario ? 0 : imp.detrazioniPersonali;
  /*
    La detrazione dell'art. 13 spetta d'ufficio a chi ha redditi di lavoro
    autonomo: non si dichiara, non dipende da spese, e senza di lei l'IRPEF
    usciva più alta del vero per ogni reddito sotto i 50.000 €.

    Si calcola sul reddito **complessivo** — il reddito lordo, prima della
    deduzione dei contributi — non sull'imponibile: sono due numeri diversi e
    scambiarli sposta la detrazione senza che si veda.
  */
  const detrazioneAutonomo = forfettario
    ? 0
    : detrazioneLavoroAutonomo(p.redditoPerDetrazioni, par.detrazioneLavoroAutonomo).importo;
  const detrazioniTotali = round2(detrazioni + detrazioneAutonomo);
  // Incapienza: l'eccedenza si perde, non si rimborsa e non si riporta.
  const detrazioniApplicate = forfettario ? 0 : round2(Math.min(detrazioniTotali, irpefLorda));
  const irpefNetta = forfettario ? 0 : round2(nonNegativo(irpefLorda - detrazioniTotali));
  /*
    Le addizionali seguono l'IRPEF: sono dovute solo se l'IRPEF, al netto delle
    detrazioni, risulta dovuta (art. 50 D.Lgs. 446/1997 per la regionale, art. 1
    D.Lgs. 360/1998 per la comunale). Con la detrazione dell'art. 13 che azzera
    l'imposta, un'addizionale che resta in piedi è un importo da versare che
    non esiste — e nessuno lo verificherebbe, perché è piccolo e plausibile.
  */
  const irpefDovuta = !forfettario && irpefNetta > 0;
  // Aliquota unica o scaglioni, e la soglia di esenzione: la regola sta in un
  // posto solo, perché qui e nel confronto fra regimi deve dare lo stesso conto.
  const addizionaleRegionale = irpefDovuta
    ? addizionaleDovuta(imponibile, addizionaleRegionaleDi(imp, par))
    : 0;
  const addizionaleComunale = irpefDovuta
    ? addizionaleDovuta(imponibile, addizionaleComunaleDi(imp, par))
    : 0;
  const totaleImposte = somma(
    impostaSostitutiva,
    impostaSostitutivaCpb,
    irpefNetta,
    addizionaleRegionale,
    addizionaleComunale,
  );

  return {
    contributi,
    contributiDedotti,
    imponibile,
    impostaSostitutiva,
    impostaSostitutivaCpb,
    irpefLorda,
    detrazioni,
    detrazioneAutonomo,
    detrazioniTotali,
    detrazioniApplicate,
    irpefNetta,
    addizionaleRegionale,
    addizionaleComunale,
    totaleImposte,
    caricoTotale: somma(totaleImposte, contributi.totale),
  };
}

/**
 * L'anno di contribuzione si accredita per intero?
 *
 * `null` — non `false` — per chi non versa alla Gestione Separata: lì la
 * domanda non esiste, e rispondere «no» direbbe a un artigiano che quest'anno
 * non gli viene accreditato, che è falso. La condizione arriva dal minimale
 * derivato: se la voce non si applica, non si applica nemmeno la risposta.
 */
function accreditoIntero(
  base: number,
  imp: Impostazioni,
  par: ParametriAnno,
): boolean | null {
  const minimale = derivato("minimaleGs", imp, par).valore;
  return minimale === null ? null : base >= minimale;
}

/**
 * Acconti con metodo storico, su due basi separate.
 *
 * Imposte e contributi non seguono la stessa regola, e trattarli come un unico
 * importo gonfiava la rata di novembre: le imposte vanno 40/60 sul dovuto, i
 * contributi seguono la loro gestione — l'80 % in due rate del 40 % per la
 * Gestione Separata, il 100 % in due rate del 50 % sull'eccedenza al minimale
 * per artigiani e commercianti.
 *
 * Valgono anche le due soglie di legge, ma solo sulle imposte, perché è lì che
 * la norma le mette: sotto 51,65 € non si versa acconto, sotto 257,52 €
 * l'acconto è unico a novembre. Un contributo previdenziale piccolo si versa
 * comunque nelle sue rate.
 */
export function calcolaAcconti(
  basi: {
    /** IRPEF netta, o imposta sostitutiva, già al netto delle ritenute subite. */
    imposta: number;
    /** Addizionale comunale dovuta: la regionale un acconto non ce l'ha. */
    addizionaleComunale: number;
    contributi: { base: number; regola: RegolaAcconto | null };
  },
  par: ParametriAnno,
  creditoInIngresso = 0,
): Acconti {
  const credito = nonNegativo(creditoInIngresso);

  // — Imposta principale: 40/60, con le due soglie ——————————
  const dovutoImposte = nonNegativo(basi.imposta);
  let impostePrimo = 0;
  let imposteSecondo = 0;
  let imposteUnico = false;
  if (dovutoImposte >= par.sogliaAcconti) {
    if (dovutoImposte < par.sogliaAccontoUnico) {
      imposteUnico = true;
      imposteSecondo = round2(dovutoImposte);
    } else {
      impostePrimo = round2(dovutoImposte * par.quotaPrimoAcconto);
      imposteSecondo = round2(dovutoImposte * par.quotaSecondoAcconto);
    }
  }

  // — Addizionali: solo la comunale, e tutta a giugno ——————————
  const addizionali = rateDi(nonNegativo(basi.addizionaleComunale), par.accontoAddizionali.comunale);

  // — Contributi: la regola della gestione ——————————————
  const baseContributi = nonNegativo(basi.contributi.base);
  const contributi = rateDi(baseContributi, basi.contributi.regola);

  const primo = round2(impostePrimo + addizionali.primo + contributi.primo);
  const secondo = round2(imposteSecondo + addizionali.secondo + contributi.secondo);

  return conCredito(
    {
      dovuti: primo + secondo > 0,
      primo,
      secondo,
      // Unico davvero solo se non c'è nulla da versare a giugno.
      accontoUnico: imposteUnico && primo === 0,
      imposte: { primo: impostePrimo, secondo: imposteSecondo, unico: imposteUnico },
      addizionali: {
        primo: addizionali.primo,
        secondo: addizionali.secondo,
        base: nonNegativo(basi.addizionaleComunale),
        quota: par.accontoAddizionali.comunale?.quota ?? 0,
      },
      contributi: {
        primo: contributi.primo,
        secondo: contributi.secondo,
        base: baseContributi,
        quota: basi.contributi.regola?.quota ?? 0,
      },
    },
    credito,
  );
}

/**
 * Una quota del dovuto, divisa in rate uguali fra giugno e novembre.
 *
 * Una rata sola significa tutto a giugno — è il caso dell'addizionale comunale.
 * Nessuna regola significa nessun acconto: la regionale, le casse.
 */
function rateDi(dovuto: number, regola: RegolaAcconto | null): { primo: number; secondo: number } {
  if (!regola) return { primo: 0, secondo: 0 };
  const acconto = round2(nonNegativo(dovuto) * regola.quota);
  if (regola.rate <= 1) return { primo: acconto, secondo: 0 };
  const primo = round2(acconto / regola.rate);
  // L'ultima rata prende il resto: dividendo per due un importo dispari, un
  // centesimo deve pur finire da qualche parte.
  return { primo, secondo: round2(acconto - primo * (regola.rate - 1)) };
}

/**
 * La base su cui si calcola l'acconto dei contributi, gestione per gestione.
 *
 * Per artigiani e commercianti è solo la parte eccedente il minimale: i
 * contributi fissi si versano in quattro rate trimestrali e un acconto non ce
 * l'hanno. Contarli qui li farebbe pagare due volte.
 */
export function baseAccontoContributi(p: {
  gestione: Gestione;
  contributiGestioneSeparata: number;
  contributiArtigiani: number;
  contributiFissi: number;
}): number {
  if (p.gestione === "separata") return nonNegativo(p.contributiGestioneSeparata);
  if (p.gestione === "artigiani") {
    return nonNegativo(round2(p.contributiArtigiani - p.contributiFissi));
  }
  return 0;
}

/**
 * Scomputa il credito dell'anno precedente dagli acconti, nell'ordine in cui si
 * versano: prima quello di giugno, poi quello di novembre. Gli importi `primo` e
 * `secondo` restano quelli dovuti per legge — il credito non li riduce, li paga.
 * La distinzione conta: è dovuto quello che si dichiara, da versare quello che
 * esce dal conto.
 */
function conCredito(
  base: Omit<Acconti, "creditoUtilizzato" | "creditoResiduo" | "primoDaVersare" | "secondoDaVersare">,
  credito: number,
): Acconti {
  const suPrimo = Math.min(credito, base.primo);
  const suSecondo = Math.min(credito - suPrimo, base.secondo);
  const utilizzato = round2(suPrimo + suSecondo);
  return {
    ...base,
    creditoUtilizzato: utilizzato,
    creditoResiduo: round2(credito - utilizzato),
    primoDaVersare: round2(base.primo - suPrimo),
    secondoDaVersare: round2(base.secondo - suSecondo),
  };
}

/*
  Il messaggio cita le stesse soglie con cui lo stato è stato deciso.
  Leggeva `par` mentre la decisione leggeva `imp`: finché nessuno tocca quei
  campi i due numeri coincidono, ma sono due fonti per una cosa sola, e la
  frase che spiega una decisione non può poggiare su un valore diverso da
  quello che l'ha presa.
*/
function messaggioSoglia(
  stato: StatoSoglia,
  imp: Impostazioni,
  par: ParametriAnno,
): string {
  switch (stato) {
    case "nessunLimite":
      return "Regime ordinario: nessun limite di ricavi.";
    case "uscitaImmediata":
      return `Soglia di ${interoIt.format(imp.sogliaUscita)} € superata: esci dal forfettario nello stesso anno, con IVA dovuta dall'operazione che la supera.`;
    case "limiteSuperato":
      return `Limite di ${interoIt.format(imp.limiteForfettario)} € superato: resti forfettario quest'anno, esci dal 1° gennaio successivo.`;
    case "avviso":
      return `Hai usato oltre l'${aliquota(par.sogliaAvviso)} del limite. Pianifica il cambio di regime prima di superarlo.`;
    default:
      return "Nei limiti del regime forfettario.";
  }
}

/**
 * Il prospetto completo dell'anno.
 * Nessun accesso al database, nessun `new Date()` nascosto: stessi ingressi,
 * stesso risultato, sempre.
 */
export function calcolaProspetto(ingresso: IngressoMotore): Prospetto {
  const { impostazioni: imp, parametri: par, oggi } = ingresso;
  const anno = imp.anno;
  const forfettario = imp.regime === "forfettario";

  // Ogni documento con le regole del suo anno: le impostazioni dell'anno in
  // esame valgono per il prospetto, non per una fattura di tre anni fa.
  const impostazioniDi = risolutoreImpostazioni(imp, ingresso.impostazioniPerAnno);
  /*
    Gli storni si calcolano prima delle fatture perché ogni fattura deve sapere
    quanto le è stato tolto: da lì esce «quanto il cliente deve ancora», che
    senza le note sarebbe il totale pieno anche su una fattura già chiusa da una
    nota. `stornoPerFattura` guarda solo id e imponibile, quindi può girare sui
    documenti grezzi.
  */
  const storniPerFattura = stornoPerFattura(ingresso.note ?? [], ingresso.fatture);
  const fattureCalcolate = ingresso.fatture.map((f) =>
    calcolaFattura(
      f,
      impostazioniDi(annoDi(f.dataEmissione)),
      oggi,
      storniPerFattura.get(f.id)?.stornato ?? 0,
    ),
  );
  const costiCalcolati = ingresso.costi.map((c) =>
    calcolaCosto(c, impostazioniDi(annoDi(c.dataDocumento))),
  );
  const noteCalcolate = (ingresso.note ?? []).map((n) =>
    calcolaNota(n, impostazioniDi(annoDi(n.dataDocumento))),
  );

  // — A · Base di calcolo ————————————————————————————————
  // Due criteri, una funzione sola: la cassa comanda sulle imposte, la data del
  // documento sull'IVA e sul bollo.
  const rf = ripartisci(fattureCalcolate, anno, dateFattura);
  const rc = ripartisci(costiCalcolati, anno, dateCosto);
  // Le note passano dalla stessa funzione delle fatture e dei costi: due date,
  // due criteri. La data del rimborso comanda sui ricavi, quella del documento
  // sull'IVA — esattamente come incasso ed emissione su una fattura.
  const rn = ripartisci(noteCalcolate, anno, dateNota);
  const incassateNellAnno = rf.perCassa;
  const emesseNellAnno = rf.perCompetenza;
  const pagatiNellAnno = rc.perCassa;

  // Gli storni entrano nei ricavi con il segno meno, alla data in cui il denaro
  // è tornato indietro. Una nota emessa e non ancora rimborsata non riduce
  // ancora niente di cassa, come una fattura emessa e non incassata.
  /*
    Gli storni di cassa non si contano più «le note rimborsate quest'anno».

    Il rimborso è il caso raro. Quello normale è che la nota si emetta prima
    che il cliente paghi e il cliente paghi il netto: nessun denaro torna
    indietro, quindi nessuna data di rimborso, e lo storno non scendeva da
    nessuna parte mentre la fattura risultava incassata per intero. La regola
    che distingue i due casi sta in `storniDiCassa`, in note.ts, ed è una sola
    per tutti quelli che la usano: qui, le ritenute più sotto, il grafico dei
    dodici mesi e il portafoglio clienti.
  */
  const storniCassa = storniDiCassa(ingresso.note ?? [], ingresso.fatture);
  const storniCassaNellAnno = storniCassa.filter((s) => annoDi(s.data) === anno);
  const stornoIncassato = somma(...storniCassaNellAnno.map((s) => s.importo));
  const stornoEmesso = somma(...rn.perCompetenza.map((n) => n.imponibile));
  const ivaStornata = somma(...rn.perCompetenza.map((n) => n.iva));
  /*
    Quanto delle note emesse quest'anno non è ancora sceso in cassa, alla fine
    dell'anno: né rimborsato, né compensato da un incasso al netto. È il pezzo
    che busserà più avanti.
  */
  const cassaPerNota = new Map<string, number>();
  for (const s of storniCassa) {
    if (annoDi(s.data) > anno) continue;
    cassaPerNota.set(s.notaId, round2((cassaPerNota.get(s.notaId) ?? 0) + s.importo));
  }
  const stornoDaRimborsare = somma(
    ...rn.perCompetenza.map((n) => nonNegativo(round2(n.imponibile - (cassaPerNota.get(n.id) ?? 0)))),
  );

  /*
    Per cassa entra quello che è entrato davvero, non l'intera fattura.

    `quotaIncassata` vale 1 su ogni fattura che non dichiara un importo — cioè
    su tutte quelle scritte prima che il campo esistesse — quindi qui non cambia
    niente per gli archivi di prima. Dove l'importo c'è, la stessa quota divide
    imponibile, rivalsa e IVA: è un bonifico solo, e si scompone in proporzione.
  */
  const compensiIncassati = round2(
    somma(...incassateNellAnno.map((f) => round2(f.imponibile * f.quotaIncassata)))
      - stornoIncassato,
  );
  const rivalsaIncassata = somma(
    ...incassateNellAnno.map((f) => round2(f.rivalsa * f.quotaIncassata)),
  );
  const ricaviRilevanti = somma(compensiIncassati, rivalsaIncassata);
  const ivaIncassata = round2(
    somma(...incassateNellAnno.map((f) => round2(f.iva * f.quotaIncassata))) - ivaStornata,
  );
  const incassatoLordo = somma(ricaviRilevanti, ivaIncassata);

  const costiPagatiTotale = somma(...pagatiNellAnno.map((c) => c.totale));
  const costiDeducibiliPagati = somma(...pagatiNellAnno.map((c) => c.costoDeducibile));
  const ivaDetraibilePagata = somma(...pagatiNellAnno.map((c) => c.ivaDetraibile));
  // Il bollo segue la data del documento: è dovuto all'emissione.
  const bolloACarico = somma(...emesseNellAnno.map((f) => f.bolloACarico));

  const fatturatoEmesso = round2(
    somma(...emesseNellAnno.map((f) => f.ricavoRilevante)) - stornoEmesso,
  );
  /*
    Il «da incassare» è al netto delle note agganciate a quelle fatture: una
    fattura da 2.500 già stornata per 1.000 non vale 2.500 di incasso atteso, e
    il cliente pagherà 1.500. Prima il riquadro del cruscotto ne prometteva
    2.500, e quella promessa entrava anche nella proiezione della soglia.
  */
  /*
    Il sospeso sono due cose, non una: le fatture mai incassate, e **la parte
    che manca** di quelle incassate a metà. Prima le seconde sparivano dal
    conto: bastava una data di incasso e la fattura valeva zero di atteso,
    qualunque cifra fosse arrivata.
  */
  const restaDi = (f: FatturaCalcolata) =>
    nonNegativo(round2(f.ricavoRilevante - (storniPerFattura.get(f.id)?.stornato ?? 0)));
  const inSospeso = round2(
    somma(...rf.sospesi.map(restaDi))
      + somma(
          ...emesseNellAnno
            .filter((f) => f.stato === "parziale")
            .map((f) => nonNegativo(round2(restaDi(f) - round2(f.ricavoRilevante * f.quotaIncassata)))),
        ),
  );

  // La soglia si misura sui compensi percepiti, non sull'emesso: l'emesso resta
  // a fianco come indicatore anticipato di dove chiuderai l'anno.
  let statoSoglia: StatoSoglia = "nessunLimite";
  if (forfettario) {
    if (ricaviRilevanti > imp.sogliaUscita) statoSoglia = "uscitaImmediata";
    else if (ricaviRilevanti > imp.limiteForfettario) statoSoglia = "limiteSuperato";
    else if (ricaviRilevanti > imp.limiteForfettario * par.sogliaAvviso) statoSoglia = "avviso";
    else statoSoglia = "neiLimiti";
  }

  // — B · Reddito imponibile ————————————————————————————
  const coefficiente = derivato("coefficienteRedditivita", imp, par).valore;
  const redditoLordo = forfettario
    ? round2(ricaviRilevanti * coefficiente)
    : round2(ricaviRilevanti - costiDeducibiliPagati);

  /*
    Principio di cassa: si deducono i contributi effettivamente versati
    nell'anno. Se l'utente non ha ancora registrato F24 si ricade sulla
    competenza, come faceva l'Excel, dichiarandolo nel prospetto.

    Qui la data di pagamento è il criterio giusto, e resta: un contributo si
    deduce nell'anno in cui esce dal conto, quale che sia l'anno d'imposta a
    cui si riferisce. È la stessa tabella letta con due criteri diversi —
    `annoImposta` per lo scomputo dal dovuto, `data` per la deduzione — e sono
    corretti entrambi. Uniformarli romperebbe la deduzione.
  */
  const versamentiContributi = somma(
    ...(ingresso.versamenti ?? [])
      .filter((v) => v.tipo === "contributi" && annoDi(v.data) === anno)
      .map((v) => v.importo),
  );

  const oneriDeducibili = forfettario
    ? 0
    : round2(Math.min(imp.fondoPensione, par.tettoFondoPensione));

  /*
    ─────────────────────────────────────────────────────────────────────────
    Il concordato preventivo, e i due conti che si fanno da qui in avanti
    ─────────────────────────────────────────────────────────────────────────

    Chi ha aderito paga sul reddito **concordato**, non su quello effettivo. Il
    reddito effettivo però non sparisce: resta la base dei contributi delle
    casse private, resta il reddito complessivo da cui dipendono le detrazioni,
    e resta il termine di paragone — «quanto mi è costato aderire» è una
    domanda a cui il cruscotto deve saper rispondere con un numero.

    Perciò il carico si calcola **due volte**, con la stessa funzione: una sul
    reddito che fa testo e una sul reddito effettivo. Due funzioni diverse
    sarebbero divergute al primo ritocco di un'aliquota, e la differenza fra
    le due è esattamente il numero che il cruscotto mostra — calcolarla con
    due formule diverse vorrebbe dire inventarla.
  */
  const cpb = valutaConcordato(imp, anno);
  const cpbAttivo = cpb !== null && cpb.attivo;
  const redditoBaseImposte = cpbAttivo ? cpb.redditoConcordato : redditoLordo;
  const baseContributiva = cpbAttivo
    ? baseContributivaCpb(imp.gestione, cpb.redditoConcordato, redditoLordo)
    : redditoLordo;

  const comune = {
    imp,
    par,
    /*
      Le detrazioni e le deduzioni guardano il reddito **effettivo**, anche
      quando le imposte guardano il concordato: la norma tiene il reddito
      effettivo rilevante «ai fini della spettanza di deduzioni, detrazioni e
      benefici». È il comportamento di prima — la funzione riceve lo stesso
      numero che riceveva — e sta in APPROSSIMAZIONI.md fra le cose da
      verificare, perché è il punto del concordato su cui le letture divergono.
    */
    redditoPerDetrazioni: redditoLordo,
    oneriDeducibili,
    versamentiContributi,
  };

  const carico = caricoFiscale({
    ...comune,
    redditoImponibileLordo: redditoBaseImposte,
    baseContributiva,
    quotaSostitutivaCpb: cpb?.sostitutiva?.base ?? 0,
    impostaSostitutivaCpb: cpb?.sostitutiva?.imposta ?? 0,
  });
  /* Lo stesso conto come se non avessi aderito. Senza CPB sono lo stesso oggetto. */
  const caricoSenzaCpb = cpbAttivo
    ? caricoFiscale({
        ...comune,
        redditoImponibileLordo: redditoLordo,
        baseContributiva: redditoLordo,
        quotaSostitutivaCpb: 0,
        impostaSostitutivaCpb: 0,
      })
    : carico;

  const contributi = carico.contributi;
  const contributiCompetenza = contributi.totale;
  const usaVersamenti = versamentiContributi > 0;
  const contributiDedotti = carico.contributiDedotti;
  const imponibile = carico.imponibile;

  // — C · Imposte ————————————————————————————————————
  const impostaSostitutiva = carico.impostaSostitutiva;
  const irpefLorda = carico.irpefLorda;
  const detrazioni = carico.detrazioni;
  const detrazioneAutonomo = carico.detrazioneAutonomo;
  const detrazioniTotali = carico.detrazioniTotali;
  const detrazioniApplicate = carico.detrazioniApplicate;
  const irpefNetta = carico.irpefNetta;
  const addizionaleRegionale = carico.addizionaleRegionale;
  const addizionaleComunale = carico.addizionaleComunale;
  const totaleImposte = carico.totaleImposte;

  /*
    Le ritenute seguono la fattura, e una nota di credito riconciliata segue la
    fattura che rettifica: se lo storno è stato rimborsato nello stesso anno,
    la base su cui il committente ha trattenuto si è ridotta con lui. Calcolarle
    sull'imponibile lordo dava una ritenuta più alta dei compensi dichiarati —
    e un credito d'imposta inventato.

    Uno storno non riconciliato a nessuna fattura resta fuori: riduce i ricavi,
    ma non si sa a quale committente attribuirlo, e attribuirlo a caso
    sposterebbe la ritenuta di qualcun altro. Il prospetto lo dice.
  */
  const stornoSuFatturaNellAnno = new Map<string, number>();
  for (const s of storniCassaNellAnno) {
    if (s.fatturaId === null) continue;
    const gia = stornoSuFatturaNellAnno.get(s.fatturaId) ?? 0;
    stornoSuFatturaNellAnno.set(s.fatturaId, round2(gia + s.importo));
  }
  /*
    La ritenuta la trattiene chi paga, quindi segue il pagamento: su un incasso
    parziale è trattenuta in proporzione, come tutto il resto del bonifico.
  */
  const conRitenuta = incassateNellAnno.filter((f) => f.ritenuta > 0);
  const imponibileIncassatoDi = (f: FatturaCalcolata) => round2(f.imponibile * f.quotaIncassata);
  const baseRitenute = somma(
    ...conRitenuta.map((f) =>
      nonNegativo(imponibileIncassatoDi(f) - (stornoSuFatturaNellAnno.get(f.id) ?? 0)),
    ),
  );
  const ritenuteSubite = somma(
    ...conRitenuta.map((f) => {
      const netto = nonNegativo(imponibileIncassatoDi(f) - (stornoSuFatturaNellAnno.get(f.id) ?? 0));
      // In proporzione, non ricalcolando l'aliquota: la regola della ritenuta
      // sta in `documenti.ts` e deve restare in un posto solo.
      return round2(f.ritenuta * rapporto(netto, f.imponibile));
    }),
  );
  const stornoDedottoDalleRitenute = round2(
    somma(...conRitenuta.map(imponibileIncassatoDi)) - baseRitenute,
  );
  const imposteNetteASaldo = round2(nonNegativo(totaleImposte - ritenuteSubite));
  const creditoImposta = round2(nonNegativo(ritenuteSubite - totaleImposte));

  // — E · Sintesi ————————————————————————————————————
  const caricoTotale = somma(totaleImposte, contributiCompetenza);
  const pressione = rapporto(caricoTotale, ricaviRilevanti);
  // Il credito che arriva dall'anno precedente copre prima il saldo, poi gli
  // acconti: è l'ordine in cui si compensa in F24. Si legge qui perché serve
  // già all'accantonamento, prima ancora che al saldo.
  const creditoAnnoPrecedente = nonNegativo(ingresso.creditoAnnoPrecedente ?? 0);
  // In forfettario l'IVA sugli acquisti è indetraibile e diventa costo pieno.
  const costiNettiACarico = round2(
    (forfettario ? costiPagatiTotale : costiPagatiTotale - ivaDetraibilePagata) + bolloACarico,
  );
  const nettoDisponibile = round2(ricaviRilevanti - costiNettiACarico - caricoTotale);

  // — F · Saldo e acconti ————————————————————————————
  const totaleDovuto = somma(imposteNetteASaldo, contributiCompetenza);
  /*
    Che cosa è già stato versato *per questo anno d'imposta*.

    Non per data di pagamento: il saldo di un anno si versa a giugno di quello
    dopo, insieme al primo acconto dell'anno in corso. Sommare per data
    significava scomputare dal dovuto del 2026 il saldo del 2025.

    I versamenti registrati prima che il campo esistesse non hanno un anno
    d'imposta: continuano a valere per l'anno della loro data — nessun numero
    cambia a chi aggiorna — e il prospetto dice quali sono e quanto pesano,
    perché quello è esattamente il conto che potrebbe essere sbagliato.
  */
  const nonIva = (ingresso.versamenti ?? []).filter((v) => v.tipo !== "iva");
  const diCompetenza = nonIva.filter((v) => (v.annoImposta ?? annoDi(v.data)) === anno);
  const giaVersato = somma(...diCompetenza.map((v) => v.importo));
  const versamentiSenzaAnno = somma(
    ...diCompetenza.filter((v) => v.annoImposta === undefined).map((v) => v.importo),
  );
  // Usciti dal conto quest'anno ma riferiti a un altro anno d'imposta: il
  // saldo di dicembre scorso pagato a giugno. Vanno detti, altrimenti chi
  // guarda l'estratto conto trova denaro versato che nel prospetto non c'è.
  const versamentiAltriAnni = somma(
    ...nonIva
      .filter((v) => annoDi(v.data) === anno && (v.annoImposta ?? anno) !== anno)
      .map((v) => v.importo),
  );
  const dopoVersamenti = nonNegativo(totaleDovuto - giaVersato);
  const creditoSuSaldo = Math.min(creditoAnnoPrecedente, dopoVersamenti);
  const saldoResiduo = round2(dopoVersamenti - creditoSuSaldo);

  /*
    La maggiorazione del concordato è un **acconto di quest'anno**, non una
    tassa in più.

    Al primo anno di adesione l'acconto con il metodo storico è commisurato al
    reddito dell'anno prima, che il concordato ha superato: la maggiorazione del
    10 % colma quella differenza e si versa con la seconda rata, il 30 novembre
    di quest'anno. A saldo si scomputa come ogni altro acconto.

    Sta quindi fra gli acconti dovuti per l'anno — così il già versato la copre
    nell'ordine in cui si versa, che è la logica che il prospetto applica da
    sempre — e **non** dentro `totaleDovuto`: lì sarebbe una seconda tassazione
    dello stesso reddito.
  */
  const maggiorazioneCpb = cpb?.maggiorazioneAcconto ?? 0;
  const accontiOrdinariPerLAnno = somma(
    ingresso.accontiDelPrecedente?.primo ?? 0,
    ingresso.accontiDelPrecedente?.secondo ?? 0,
  );
  const accontiDovutiPerLAnno = round2(accontiOrdinariPerLAnno + maggiorazioneCpb);
  /*
    Quello che è stato versato oltre gli acconti ordinari ha già pagato la
    maggiorazione: è l'ordine in cui si versa, lo stesso con cui il prospetto
    scomputa il già versato dagli acconti.
  */
  const maggiorazioneDaVersare = round2(
    nonNegativo(maggiorazioneCpb - nonNegativo(giaVersato - accontiOrdinariPerLAnno)),
  );
  /*
    Tre basi, tre regole. L'acconto dell'IRPEF si commisura al rigo
    «differenza» della dichiarazione — l'imposta netta meno le ritenute già
    subite — non al totale delle imposte: le addizionali hanno una vita loro,
    e la regionale un acconto non ce l'ha proprio.
  */
  /*
    L'imposta sostitutiva del concordato entra nella base dell'acconto come
    ogni altra imposta dovuta. È la lettura più cara delle due possibili — si
    anticipa di più — ed è quella prudente: un acconto calcolato per difetto si
    scopre a giugno dell'anno dopo, quando il denaro è già stato speso.
  */
  const baseAccontoImposta = nonNegativo(
    (forfettario ? impostaSostitutiva : irpefNetta + carico.impostaSostitutivaCpb)
      - ritenuteSubite,
  );
  const acconti = calcolaAcconti(
    {
      imposta: baseAccontoImposta,
      addizionaleComunale,
      contributi: {
        base: baseAccontoContributi({
          gestione: imp.gestione,
          contributiGestioneSeparata: contributi.separata,
          contributiArtigiani: contributi.artigiani,
          /*
            L'importo applicato, non il campo grezzo.

            `imp.contributiFissi` parte dal valore degli **artigiani** — è così
            che `impostazioniPredefinite` lo inizializza — e viene allineato
            alla gestione solo quando le impostazioni passano da
            `conFissiDiLegge`, cioè al salvataggio. Un prospetto calcolato su
            impostazioni che non ci sono passate riportava agli artigiani il
            numero giusto e ai commercianti quello degli artigiani, e questo
            valore **entra in un conto**: la base dell'acconto contributivo è
            il contributo sull'eccedenza, cioè il totale meno i fissi.
          */
          contributiFissi: derivato("contributiFissi", imp, par).valore ?? 0,
        }),
        regola: par.accontoContributi[imp.gestione],
      },
    },
    par,
    creditoAnnoPrecedente - creditoSuSaldo,
  );
  /*
    Quanto mettere da parte non si misura sul carico: si misura su quello che
    deve ancora uscire dal conto, che è esattamente il saldo residuo calcolato
    qui sopra. Ritenute, credito riportato e versamenti già fatti per questo
    anno d'imposta sono la stessa cosa — imposta di quest'anno già uscita — e
    chiedere di accantonarli di nuovo significa metterla da parte due volte.

    Due righe dello stesso prospetto che rispondono alla stessa domanda devono
    dare lo stesso numero: se divergono, una delle due è sbagliata.

    L'unico scarto possibile dal saldo residuo è il credito d'imposta maturato
    quest'anno — le ritenute che hanno superato le imposte — che si compensa in
    F24 su quello stesso saldo: non è denaro da mettere da parte. Quando c'è, il
    prospetto lo mostra due righe più su, e la differenza si legge.

    Il carico totale e il netto disponibile restano quelli di competenza: sono
    giusti, e rispondono a un'altra domanda.
  */
  /*
    E la maggiorazione del concordato si mette da parte come tutto il resto.

    Non entra in `saldoResiduo` — non è dovuta in più, è dovuta **prima** — ma
    il 30 novembre deve esserci sul conto, e l'accantonamento è esattamente la
    cosa che serve a farcela trovare. Si conta solo la parte non ancora
    versata: gli F24 registrati la coprono come coprono gli acconti.
  */
  const fabbisognoDaAccantonare = round2(
    nonNegativo(saldoResiduo - creditoImposta) + maggiorazioneDaVersare,
  );
  /*
    Il fabbisogno dell'anno intero, che è un'altra domanda ancora.

    «Da accantonare al mese» guarda quello che resta da versare. La percentuale
    impostata, invece, lavora su tutti i ricavi dell'anno e ha già finanziato i
    versamenti fatti: confrontarla con il residuo metteva un lato lordo contro
    un lato netto e dichiarava un margine che non c'era — 4.184,92 € invece di
    62,21 € sui numeri del dataset.

    Quindi il confronto si fa sull'anno intero da tutte e due le parti: quello
    che la percentuale impostata produce in dodici mesi contro quello che i dodici
    mesi costano. Ritenute e crediti restano fuori da entrambi i lati — non
    sono denaro da mettere da parte — ma i versamenti già fatti sì: sono
    esattamente ciò che l'accantonamento serviva a coprire.
  */
  const fabbisognoAnnuo = round2(
    nonNegativo(totaleDovuto - creditoAnnoPrecedente - creditoImposta) + maggiorazioneCpb,
  );
  const percentualeDaAccantonare = rapporto(fabbisognoAnnuo, ricaviRilevanti);
  const accantonamentoAnnuo = round2(ricaviRilevanti * imp.percentualeAccantonamento);
  const scostamentoAccantonamento = round2(accantonamentoAnnuo - fabbisognoAnnuo);
  /*
    Quando lo scarto è dentro la tolleranza, l'accantonamento si considera a
    posto. Senza una soglia la card chiedeva di alzare la percentuale di un
    punto intero — quasi quattrocento euro l'anno sui ricavi del dataset — per
    coprire uno scarto di ventotto euro: un consiglio più caro del problema.
  */
  const tolleranza = round2(
    Math.max(par.tolleranzaAccantonamento.minimo, fabbisognoAnnuo * par.tolleranzaAccantonamento.quota),
  );
  const accantonamentoSufficiente = scostamentoAccantonamento >= -tolleranza;

  /*
    Gli acconti *di questo anno* — quelli calcolati sui numeri dell'anno prima e
    dovuti a giugno e novembre di quest'anno — non sono una voce a parte: sono
    un anticipo sul dovuto, e quello che versi a novembre non lo verserai a
    giugno dell'anno dopo. Stanno dentro il saldo residuo finché non li paghi.

    Senza questa distinzione il prospetto diceva «saldo 7.680,08 € al 30 giugno
    2027» mentre lo scadenzario diceva «secondo acconto 4.801,30 € al 30
    novembre 2026», e chi leggeva le due righe le sommava trovando più del
    dovuto.

    Quale parte del già versato sia acconto e quale saldo non si sa — servirebbe
    la natura del singolo F24 — quindi si scomputa il versato dagli acconti
    dovuti: è l'ordine in cui si versa, e l'approssimazione è dichiarata.
  */
  const accontiAncoraDaVersare = round2(
    Math.min(nonNegativo(accontiDovutiPerLAnno - giaVersato), saldoResiduo),
  );
  const saldoDopoAcconti = round2(saldoResiduo - accontiAncoraDaVersare);

  // A giugno si rateizza quello che resta dopo l'acconto di novembre, più il
  // primo acconto dell'anno nuovo: non il saldo lordo, che quell'acconto lo
  // comprende ancora.
  const daRateizzare = saldoDopoAcconti + acconti.primoDaVersare;
  const rataRateizzazione = round2(daRateizzare / par.rateRateizzazione);
  // Interesse semplice crescente sulle rate successive alla prima.
  const rateMedieConInteressi =
    ((par.rateRateizzazione - 1) / 2) * par.interesseRateizzazioneMensile;
  const rataRateizzazioneConInteressi = round2(
    (daRateizzare * (1 + rateMedieConInteressi)) / par.rateRateizzazione,
  );

  return {
    anno,
    regime: imp.regime,

    compensiIncassati,
    rivalsaIncassata,
    ricaviRilevanti,
    ivaIncassata,
    incassatoLordo,
    costiPagatiTotale,
    costiDeducibiliPagati,
    ivaDetraibilePagata,
    bolloACarico,
    fatturatoEmesso,

    soglia: {
      stato: statoSoglia,
      baseCassa: ricaviRilevanti,
      baseCompetenza: fatturatoEmesso,
      inSospeso,
      utilizzoLimite: forfettario ? rapporto(ricaviRilevanti, imp.limiteForfettario) : 0,
      messaggio: messaggioSoglia(statoSoglia, imp, par),
    },

    redditoLordo,
    contributiCompetenza,
    contributiDedotti,
    fonteContributiDedotti: usaVersamenti ? "versamenti" : "competenza",
    oneriDeducibili,
    imponibile,

    impostaSostitutiva,
    irpefLorda,
    detrazioni,
    detrazioneAutonomo,
    detrazioniTotali,
    detrazioniApplicate,
    irpefNetta,
    addizionaleRegionale,
    addizionaleComunale,
    totaleImposte,
    ritenuteSubite,
    baseRitenute,
    stornoDedottoDalleRitenute,
    imposteNetteASaldo,
    creditoImposta,

    baseContributiva,
    contributiGestioneSeparata: contributi.separata,
    contributiArtigiani: contributi.artigiani,
    contributiCassa: contributi.cassa,
    totaleContributi: contributiCompetenza,
    accreditoIntero: accreditoIntero(baseContributiva, imp, par),

    concordato: cpb
      ? {
          esito: cpb,
          redditoEffettivo: redditoLordo,
          redditoConcordato: cpb.redditoConcordato,
          scostamento: scostamentoDalConcordato(redditoLordo, cpb.redditoConcordato),
          oltreSogliaCessazione: scostamentoDaSegnalare(redditoLordo, cpb.redditoConcordato),
          baseContributiva,
          conCpb: {
            imposte: carico.totaleImposte,
            contributi: carico.contributi.totale,
            carico: carico.caricoTotale,
          },
          senzaCpb: {
            imposte: caricoSenzaCpb.totaleImposte,
            contributi: caricoSenzaCpb.contributi.totale,
            carico: caricoSenzaCpb.caricoTotale,
          },
          effetto: round2(carico.caricoTotale - caricoSenzaCpb.caricoTotale),
          maggiorazioneAcconto: maggiorazioneCpb,
          maggiorazioneDaVersare,
        }
      : null,

    caricoTotale,
    pressione,
    costiNettiACarico,
    nettoDisponibile,
    percentualeTeoricaAccantonamento: percentualeDaAccantonare,
    percentualeImpostata: imp.percentualeAccantonamento,
    accantonamentoAnnuo,
    fabbisognoDaAccantonare,
    fabbisognoAnnuo,
    scostamentoAccantonamento,
    tolleranzaAccantonamento: tolleranza,
    accantonamentoSufficiente,
    accantonamentoMensile: round2(fabbisognoDaAccantonare / 12),

    totaleDovuto,
    giaVersato,
    versamentiSenzaAnno,
    versamentiAltriAnni,
    saldoResiduo,
    accontiAncoraDaVersare,
    saldoDopoAcconti,
    acconti,
    rataRateizzazione,
    rataRateizzazioneConInteressi,

    aCavallo: {
      ricaviDaAnniPrecedenti: somma(...rf.daAnniPrecedenti.map((f) => f.ricavoRilevante)),
      ricaviVersoAnniSuccessivi: somma(...rf.versoAnniSuccessivi.map((f) => f.ricavoRilevante)),
      ricaviSospesi: inSospeso,
      ivaSuIncassiFuturi: somma(
        ...rf.versoAnniSuccessivi.map((f) => f.iva),
        ...rf.sospesi.map((f) => f.iva),
      ),
      costiDaAnniPrecedenti: somma(...rc.daAnniPrecedenti.map((c) => c.totale)),
      costiVersoAnniSuccessivi: somma(...rc.versoAnniSuccessivi.map((c) => c.totale)),
      costiSospesi: somma(...rc.sospesi.map((c) => c.totale)),
      ivaDetraibileSuPagamentiFuturi: somma(
        ...rc.versoAnniSuccessivi.map((c) => c.ivaDetraibile),
        ...rc.sospesi.map((c) => c.ivaDetraibile),
      ),
      numeroFatture: rf.daAnniPrecedenti.length + rf.versoAnniSuccessivi.length,
      numeroCosti: rc.daAnniPrecedenti.length + rc.versoAnniSuccessivi.length,
    },

    creditoAnnoPrecedente,
    creditoUtilizzatoSuSaldo: round2(creditoSuSaldo),

    note: {
      stornoIncassato,
      stornoEmesso,
      ivaStornata,
      stornoDaRimborsare,
      numero: noteCalcolate.length,
      nonRiconciliato: somma(...noteCalcolate.map((n) => n.residuo)),
    },
    fattureCalcolate,
    costiCalcolati,
    noteCalcolate,
  };
}

export { limita };
