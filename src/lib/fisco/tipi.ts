/**
 * Tipi del motore fiscale. Modulo puro: nessun import di React, nessun accesso
 * al database. Solo funzioni da input a output.
 */

export type Regime = "forfettario" | "ordinario";
export type Gestione = "separata" | "artigiani" | "cassa";
export type PeriodicitaIva = "mensile" | "trimestrale";
export type TipoRicavo = "ricorrente" | "progetto" | "unaTantum";
export type NaturaCosto = "fisso" | "variabile";
export type TipoVersamento = "iva" | "imposte" | "contributi";

export type ScaglioneIrpef = {
  /** Limite superiore dello scaglione. `null` per l'ultimo, che non ha tetto. */
  limite: number | null;
  aliquota: number;
};

export type GruppoAteco = {
  codice: string;
  descrizione: string;
  coefficiente: number;
};

/**
 * Parametri di legge, versionati per anno in `parametri/<anno>.ts`.
 * Aliquote e soglie non si scrivono nel codice: l'aggiornamento di gennaio
 * è la modifica di un file solo.
 */
/**
 * La detrazione per redditi di lavoro autonomo, art. 13 comma 5 e 5-bis TUIR.
 *
 * Una spezzata decrescente sul reddito complessivo: piena fino alla prima
 * soglia, poi in calo su due tratti fino ad azzerarsi. Sta nei parametri
 * dell'anno come tutto il resto della legge, perché a gennaio si cambia in un
 * posto solo.
 */
export type DetrazioneLavoroAutonomo = {
  /** Fino a questo reddito complessivo spetta l'importo pieno. */
  sogliaPiena: number;
  importoPieno: number;
  /** Fine del primo tratto decrescente. */
  sogliaMedia: number;
  /** Quota che resta comunque nel primo tratto decrescente. */
  importoFisso: number;
  /** Quota che si consuma linearmente fra la soglia piena e quella media. */
  quotaDecrescente: number;
  /** Oltre questo reddito la detrazione non spetta più. */
  sogliaAzzeramento: number;
  /** Il gradino della fascia intermedia: o c'è tutto o non c'è. */
  maggiorazione: { importo: number; da: number; a: number };
};

/**
 * Come si versa in acconto un'imposta o un contributo.
 *
 * `quota` è la parte del dovuto che si anticipa, `rate` in quante parti uguali
 * si divide fra le scadenze di giugno e novembre. Una sola rata significa
 * tutto a giugno.
 */
export type RegolaAcconto = {
  quota: number;
  rate: number;
};

export type ParametriAnno = {
  anno: number;
  /** Da citare nell'interfaccia accanto ai parametri. */
  fonti: string[];
  /**
   * I valori sono ereditati da un anno precedente, in attesa della Legge di
   * Bilancio. Finché è `true` l'interfaccia lo dichiara e il prospetto non si
   * può esportare: un documento che sembra definitivo e poggia su aliquote
   * dell'anno prima non deve poter uscire dall'app.
   */
  provvisorio: boolean;

  limiteForfettario: number;
  sogliaUscitaImmediata: number;
  /** Frazione del limite oltre la quale scatta l'avviso preventivo. */
  sogliaAvviso: number;
  aliquotaSostitutiva: number;
  aliquotaSostitutivaNuovaAttivita: number;
  anniNuovaAttivita: number;
  gruppiAteco: GruppoAteco[];

  scaglioniIrpef: ScaglioneIrpef[];
  detrazioneLavoroAutonomo: DetrazioneLavoroAutonomo;
  tettoFondoPensione: number;

  aliquotaGestioneSeparata: number;
  massimaleGestioneSeparata: number;
  minimaleAccreditoGestioneSeparata: number;
  minimaleArtigiani: number;
  aliquotaEccedenzaArtigiani: number;

  aliquotaIvaOrdinaria: number;
  maggiorazioneTrimestrale: number;
  /** Il saldo del 4° trimestre si versa con la dichiarazione annuale, senza l'1%. */
  maggiorazioneSuQuartoTrimestre: boolean;

  aliquotaRivalsaInps: number;
  aliquotaRitenuta: number;
  importoBollo: number;
  sogliaBollo: number;

  /**
   * Oltre questo credito annuo la compensazione in F24 richiede il visto di
   * conformità sulla dichiarazione.
   */
  sogliaVistoCompensazione: number;
  /**
   * L'acconto dei contributi, gestione per gestione.
   *
   * Non segue la regola delle imposte, e non è un dettaglio: la Gestione
   * Separata vuole l'80 % in due rate del 40 %, artigiani e commercianti il
   * 100 % del contributo sull'eccedenza in due rate del 50 %. Applicare il
   * 40/60 delle imposte gonfia la rata di novembre di un quinto dei contributi.
   * `null` dove la regola non è dell'INPS: ogni cassa professionale ha la sua.
   */
  accontoContributi: Record<Gestione, RegolaAcconto | null>;
  /**
   * L'acconto delle addizionali, che è una terza regola ancora.
   *
   * La regionale non ha acconto: si versa tutta a saldo. La comunale sì, il
   * 30 %, e in unica soluzione a giugno — non spalmato su due rate come
   * l'IRPEF. `null` dove l'acconto non esiste.
   */
  accontoAddizionali: { regionale: RegolaAcconto | null; comunale: RegolaAcconto | null };
  /**
   * Quanto può mancare all'accantonamento prima di dire che non basta.
   *
   * Non è una regola di legge: è una regola di prodotto, e sta qui con le
   * altre perché è un numero che si ritocca, non una costante sparsa nel
   * codice. Il maggiore fra un importo minimo e una quota del fabbisogno:
   * su cifre piccole conta l'importo, su cifre grandi la percentuale.
   */
  tolleranzaAccantonamento: { minimo: number; quota: number };
  /** Sotto questa soglia di imposta dovuta non si versano acconti. */
  sogliaAcconti: number;
  /** Sotto questa soglia l'acconto è unico, a novembre. */
  sogliaAccontoUnico: number;
  quotaPrimoAcconto: number;
  quotaSecondoAcconto: number;
  rateRateizzazione: number;
  interesseRateizzazioneMensile: number;
};

/** Le impostazioni dell'utente per un anno. Una per anno: i parametri cambiano. */
export type Impostazioni = {
  anno: number;
  /**
   * I parametri che l'utente ha confermato per quest'anno.
   *
   * Alcuni valori l'app non può conoscerli — l'addizionale del tuo comune, i
   * contributi della tua gestione — ma deve averne uno per calcolare: tiene una
   * media. Questo elenco distingue il numero confermato da quello ereditato, e
   * senza la distinzione l'unico modo di dirlo sarebbe non dirlo. Chiave dei
   * campi in `CampoUtente`; assente sui dati vecchi, che vale «nessuno».
   */
  dichiarati?: string[];
  nome: string;
  dataAperturaPiva: string | null;
  saldoInizialeAttivita: number;
  saldoInizialePersonale: number;

  regime: Regime;
  gruppoAteco: string;
  coefficienteRedditivita: number;
  nuovaAttivita: boolean;
  aliquotaSostitutiva: number;
  limiteForfettario: number;
  sogliaUscita: number;

  aliquotaIva: number;
  periodicitaIva: PeriodicitaIva;
  maggiorazioneTrimestrale: number;

  scaglioniIrpef: ScaglioneIrpef[];
  /**
   * Addizionali all'IRPEF: aliquota unica, oppure scaglioni propri.
   *
   * Molte regioni le applicano progressivamente come l'IRPEF, e con un'aliquota
   * sola non sono rappresentabili: chi mettesse quella del proprio scaglione
   * pagherebbe più del dovuto su tutta la parte bassa del reddito. Quando gli
   * scaglioni ci sono comandano loro, e `addizionale*` resta il valore da cui
   * si riparte se si torna all'aliquota unica.
   *
   * La soglia di esenzione non è una franchigia: sotto non si paga niente,
   * sopra si paga sull'intero imponibile. `0` significa nessuna esenzione.
   */
  addizionaleRegionale: number;
  scaglioniAddizionaleRegionale?: ScaglioneIrpef[] | null;
  esenzioneAddizionaleRegionale?: number;
  addizionaleComunale: number;
  scaglioniAddizionaleComunale?: ScaglioneIrpef[] | null;
  esenzioneAddizionaleComunale?: number;
  detrazioniPersonali: number;
  fondoPensione: number;

  gestione: Gestione;
  aliquotaGestioneSeparata: number;
  massimaleGs: number;
  minimaleGs: number;
  contributiFissi: number;
  minimaleArtigiani: number;
  aliquotaEccedenza: number;
  aliquotaSoggettivaCassa: number;
  aliquotaIntegrativaCassa: number;

  rivalsaAttiva: boolean;
  aliquotaRivalsa: number;
  ritenutaAttiva: boolean;
  aliquotaRitenuta: number;
  importoBollo: number;
  sogliaBollo: number;
  bolloAddebitato: boolean;
  terminiPagamento: number;

  giorniLavorativi: number;
  oreFatturabiliGiorno: number;
  /**
   * `null` finché non la si dichiara.
   *
   * Questi tre campi non hanno un valore ragionevole da indovinare: la tariffa
   * di un idraulico e quella di un avvocato non si somigliano, il netto voluto
   * è un desiderio e i costi fissi li conosce solo chi li paga. Un numero
   * plausibile scritto qui dall'app verrebbe lasciato lì, e da quel momento il
   * punto di pareggio e il fatturato necessario sarebbero costruiti su
   * un'invenzione senza che nessuno se ne accorga.
   */
  tariffaOraria: number | null;

  nettoDesiderato: number | null;
  percentualeAccantonamento: number;
  mesiFondoEmergenza: number;
  costiFissiAnnui: number | null;
};

/** Fattura come sta nel database: solo campi inseriti, mai derivati. */
export type Fattura = {
  id: string;
  dataEmissione: string;
  numero: string;
  clienteId: string;
  descrizione: string;
  tipoRicavo: TipoRicavo;
  imponibile: number;
  /** Aliquota IVA della singola operazione: 0 in forfettario, o esente/fuori campo. */
  aliquotaIva?: number;
  dataIncasso?: string | null;
};

/**
 * Nota di credito emessa: uno storno, non una fattura col meno davanti.
 *
 * È un documento a sé perché a sé lo tratta il fisco — ha una numerazione
 * propria, riduce il volume d'affari e l'IVA a debito — e perché un imponibile
 * negativo dentro `Fattura` si sarebbe infilato in ogni somma, ogni filtro e
 * ogni grafico scritti finora, dove nessuno lo aspetta.
 *
 * `imponibile` è **positivo**: il segno lo dà il tipo di documento, non il
 * numero. Chi scrive «-500» nel modulo intende cinquecento di storno, e
 * conservarlo negativo aprirebbe la porta alla doppia negazione — il difetto
 * che qui produce un totale plausibile e sbagliato.
 */
export type NotaCredito = {
  id: string;
  /** Comanda sull'IVA: il debito si riduce alla data del documento. */
  dataDocumento: string;
  numero: string;
  clienteId: string;
  descrizione: string;
  /** Sempre positivo. Lo storno che rappresenta. */
  imponibile: number;
  aliquotaIva?: number;
  /**
   * Quando il denaro torna indietro davvero, o si compensa. Comanda sui ricavi
   * per cassa, esattamente come `dataIncasso` su una fattura. `null` finché non
   * è avvenuto: la nota esiste e riduce l'IVA, ma non ha ancora ridotto incassi.
   */
  dataRimborso?: string | null;
  /**
   * A quali fatture si riferisce, e per quanto.
   *
   * Più di una perché uno storno può coprire due mesi di retainer: senza questo
   * si finisce per spezzare la nota in due note finte pur di farla stare, cioè
   * si sporcano i dati per aggirare il vincolo. Il residuo — di qua e di là —
   * non si salva, si calcola.
   */
  riconciliazioni?: { fatturaId: string; imponibile: number }[];
};

/** Costo come sta nel database. */
export type Costo = {
  id: string;
  dataDocumento: string;
  fornitore: string;
  categoria: string;
  descrizione: string;
  natura: NaturaCosto;
  imponibile: number;
  aliquotaIva: number;
  percentualeDeducibilita: number;
  /** Auto 40%, telefonia 50%, ristoranti 75%: l'Excel forzava 100%. */
  percentualeDetraibilitaIva?: number;
  dataPagamento?: string | null;
};

export type VersamentoF24 = {
  id: string;
  /** Quando è uscito dal conto. Comanda sulla deduzione dei contributi. */
  data: string;
  tipo: TipoVersamento;
  importo: number;
  /**
   * A quale anno d'imposta si riferisce.
   *
   * Non è la data: a giugno si versano insieme il saldo dell'anno prima e il
   * primo acconto di quello in corso, e sono due anni diversi. Senza questo
   * campo un saldo 2025 pagato a giugno 2026 riduceva il dovuto del 2026.
   *
   * Assente sui versamenti registrati prima che il campo esistesse: valgono
   * per l'anno della data, e il prospetto dichiara quali sono e quanto pesano
   * invece di far finta di saperlo.
   */
  annoImposta?: number;
};

/** Fattura con i campi derivati calcolati. Non si salva mai così. */
export type FatturaCalcolata = Fattura & {
  aliquotaIvaApplicata: number;
  iva: number;
  rivalsa: number;
  integrativaCassa: number;
  bollo: number;
  bolloACarico: number;
  ritenuta: number;
  totale: number;
  nettoIncasso: number;
  /** Imponibile + rivalsa: la quota che concorre a formare il reddito. */
  ricavoRilevante: number;
  scadenza: string;
  stato: "incassato" | "daIncassare" | "scaduto";
  giorniIncasso: number | null;
  giorniRitardo: number;
};

export type CostoCalcolato = Costo & {
  iva: number;
  totale: number;
  costoDeducibile: number;
  ivaDetraibile: number;
  /** Uscita di cassa che resta davvero a carico, al netto dell'IVA recuperabile. */
  costoNetto: number;
  stato: "pagato" | "daPagare";
};
