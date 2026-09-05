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
import { impostaProgressiva } from "./scaglioni";
import { interoIt } from "../format";
import { annoDi, calcolaCosto, calcolaFattura } from "./documenti";
import { dateCosto, dateFattura, ripartisci } from "./competenza";
import { calcolaNota, dateNota, type NotaCalcolata } from "./note";
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
export function contributiPrevidenziali(
  base: number,
  imp: Impostazioni,
): { separata: number; artigiani: number; cassa: number; totale: number } {
  const positiva = nonNegativo(base);
  const separata =
    imp.gestione === "separata"
      ? round2(Math.min(positiva, imp.massimaleGs) * imp.aliquotaGestioneSeparata)
      : 0;
  const artigiani =
    imp.gestione === "artigiani"
      ? round2(
          imp.contributiFissi + nonNegativo(positiva - imp.minimaleArtigiani) * imp.aliquotaEccedenza,
        )
      : 0;
  const cassa =
    imp.gestione === "cassa" ? round2(positiva * imp.aliquotaSoggettivaCassa) : 0;
  return { separata, artigiani, cassa, totale: somma(separata, artigiani, cassa) };
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

function messaggioSoglia(stato: StatoSoglia, par: ParametriAnno): string {
  switch (stato) {
    case "nessunLimite":
      return "Regime ordinario: nessun limite di ricavi.";
    case "uscitaImmediata":
      return `Soglia di ${interoIt.format(par.sogliaUscitaImmediata)} € superata: esci dal forfettario nello stesso anno, con IVA dovuta dall'operazione che la supera.`;
    case "limiteSuperato":
      return `Limite di ${interoIt.format(par.limiteForfettario)} € superato: resti forfettario quest'anno, esci dal 1° gennaio successivo.`;
    case "avviso":
      return `Hai usato oltre l'${Math.round(par.sogliaAvviso * 100)}% del limite. Pianifica il cambio di regime prima di superarlo.`;
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
  const fattureCalcolate = ingresso.fatture.map((f) =>
    calcolaFattura(f, impostazioniDi(annoDi(f.dataEmissione)), oggi),
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
  const stornoIncassato = somma(...rn.perCassa.map((n) => n.imponibile));
  const stornoEmesso = somma(...rn.perCompetenza.map((n) => n.imponibile));
  const ivaStornata = somma(...rn.perCompetenza.map((n) => n.iva));
  const stornoDaRimborsare = somma(
    ...[...rn.sospesi, ...rn.versoAnniSuccessivi].map((n) => n.imponibile),
  );

  const compensiIncassati = round2(
    somma(...incassateNellAnno.map((f) => f.imponibile)) - stornoIncassato,
  );
  const rivalsaIncassata = somma(...incassateNellAnno.map((f) => f.rivalsa));
  const ricaviRilevanti = somma(compensiIncassati, rivalsaIncassata);
  const ivaIncassata = round2(somma(...incassateNellAnno.map((f) => f.iva)) - ivaStornata);
  const incassatoLordo = somma(ricaviRilevanti, ivaIncassata);

  const costiPagatiTotale = somma(...pagatiNellAnno.map((c) => c.totale));
  const costiDeducibiliPagati = somma(...pagatiNellAnno.map((c) => c.costoDeducibile));
  const ivaDetraibilePagata = somma(...pagatiNellAnno.map((c) => c.ivaDetraibile));
  // Il bollo segue la data del documento: è dovuto all'emissione.
  const bolloACarico = somma(...emesseNellAnno.map((f) => f.bolloACarico));

  const fatturatoEmesso = round2(
    somma(...emesseNellAnno.map((f) => f.ricavoRilevante)) - stornoEmesso,
  );
  const inSospeso = somma(...rf.sospesi.map((f) => f.ricavoRilevante));

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
  const redditoLordo = forfettario
    ? round2(ricaviRilevanti * imp.coefficienteRedditivita)
    : round2(ricaviRilevanti - costiDeducibiliPagati);

  const baseContributiva = redditoLordo;
  const contributi = contributiPrevidenziali(baseContributiva, imp);
  const contributiCompetenza = contributi.totale;

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
  const usaVersamenti = versamentiContributi > 0;
  const contributiDedotti = usaVersamenti ? versamentiContributi : contributiCompetenza;

  const oneriDeducibili = forfettario
    ? 0
    : round2(Math.min(imp.fondoPensione, par.tettoFondoPensione));

  const imponibile = round2(nonNegativo(redditoLordo - contributiDedotti - oneriDeducibili));

  // — C · Imposte ————————————————————————————————————
  const impostaSostitutiva = forfettario ? round2(imponibile * imp.aliquotaSostitutiva) : 0;
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
    : detrazioneLavoroAutonomo(redditoLordo, par.detrazioneLavoroAutonomo).importo;
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
    ? addizionaleDovuta(imponibile, addizionaleRegionaleDi(imp))
    : 0;
  const addizionaleComunale = irpefDovuta
    ? addizionaleDovuta(imponibile, addizionaleComunaleDi(imp))
    : 0;
  const totaleImposte = somma(
    impostaSostitutiva,
    irpefNetta,
    addizionaleRegionale,
    addizionaleComunale,
  );

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
  for (const n of rn.perCassa) {
    for (const r of n.riconciliazioni ?? []) {
      const gia = stornoSuFatturaNellAnno.get(r.fatturaId) ?? 0;
      stornoSuFatturaNellAnno.set(r.fatturaId, round2(gia + Math.abs(r.imponibile)));
    }
  }
  const conRitenuta = incassateNellAnno.filter((f) => f.ritenuta > 0);
  const baseRitenute = somma(
    ...conRitenuta.map((f) => nonNegativo(f.imponibile - (stornoSuFatturaNellAnno.get(f.id) ?? 0))),
  );
  const ritenuteSubite = somma(
    ...conRitenuta.map((f) => {
      const netto = nonNegativo(f.imponibile - (stornoSuFatturaNellAnno.get(f.id) ?? 0));
      // In proporzione, non ricalcolando l'aliquota: la regola della ritenuta
      // sta in `documenti.ts` e deve restare in un posto solo.
      return round2(f.ritenuta * rapporto(netto, f.imponibile));
    }),
  );
  const stornoDedottoDalleRitenute = round2(
    somma(...conRitenuta.map((f) => f.imponibile)) - baseRitenute,
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
    Tre basi, tre regole. L'acconto dell'IRPEF si commisura al rigo
    «differenza» della dichiarazione — l'imposta netta meno le ritenute già
    subite — non al totale delle imposte: le addizionali hanno una vita loro,
    e la regionale un acconto non ce l'ha proprio.
  */
  const baseAccontoImposta = nonNegativo(
    (forfettario ? impostaSostitutiva : irpefNetta) - ritenuteSubite,
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
          contributiFissi: imp.contributiFissi,
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
  const fabbisognoDaAccantonare = round2(nonNegativo(saldoResiduo - creditoImposta));
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
    nonNegativo(totaleDovuto - creditoAnnoPrecedente - creditoImposta),
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
  const accontiDovutiPerLAnno = somma(
    ingresso.accontiDelPrecedente?.primo ?? 0,
    ingresso.accontiDelPrecedente?.secondo ?? 0,
  );
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
      messaggio: messaggioSoglia(statoSoglia, par),
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
    accreditoIntero:
      imp.gestione === "separata" ? baseContributiva >= imp.minimaleGs : null,

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
