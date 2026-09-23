/**
 * Finanze personali: i sette archivi del modulo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il prefisso `pf`, e perché non è cosmetico
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Questi dati non sono dati fiscali. Un movimento del conto corrente non è una
 * fattura, e la somma dei movimenti di un mese non è un ricavo: il motore
 * fiscale lavora per cassa sui documenti, e se le due famiglie finissero
 * mescolate il primo errore sarebbe contare due volte lo stesso incasso — una
 * volta come fattura riscossa e una come entrata in banca.
 *
 * Il prefisso tiene separate le due cose nel nome della collezione, che è anche
 * la chiave nel file di backup: guardando un backup si vede subito che cosa
 * appartiene a chi.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Importi sempre positivi
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il segno lo dà il **tipo**, mai il numero. Un importo negativo dentro un
 * campo che tutti sommano è la porta della doppia negazione: «−200 di spesa»
 * sottratto produce un totale plausibile e sbagliato, ed è il difetto che
 * questo progetto insegue da mesi. La stessa scelta che le note di credito
 * hanno già in `NotaCredito`.
 */

import type { MappaturaColonne } from "./rendiconto";

/** Dove stanno i soldi. */
export type TipoConto = "corrente" | "deposito" | "carta" | "contanti" | "wallet";

export type ContoPersonale = {
  id: string;
  nome: string;
  tipo: TipoConto;
  colore?: string;
  /**
   * Il saldo che l'utente ha letto sull'estratto conto, con la sua data.
   *
   * Non è «il saldo»: è un'**ancora**. Il saldo di oggi si ottiene partendo da
   * qui e sommando solo i movimenti successivi a `dataRiferimento`. Vedi
   * `saldo.ts` per il perché — in due righe: perché importare marzo non deve
   * cambiare quanto c'è in banca stasera.
   */
  saldoRiferimento: number;
  dataRiferimento: string;
  /** Il conto della partita IVA, quando ce n'è uno dedicato. */
  professionale: boolean;
  /**
   * Come si leggono i rendiconti **di questo conto**: quale colonna è la data,
   * quale la descrizione, dove sta l'importo.
   *
   * Sta sul conto e non in una tabella di profili per banca, perché il
   * tracciato è una proprietà del file che quella banca esporta per quel
   * conto: salvarla qui vuol dire che il mese dopo l'import non chiede niente,
   * e che il giorno in cui la banca cambia colonne si rifà una mappatura sola.
   *
   * Assente vuol dire «non ne è ancora entrato nessuno»: il primo import la
   * chiede, e da lì in poi la propone già fatta.
   */
  mappaturaImport?: MappaturaColonne;
};

/**
 * Il tipo di un movimento, che è anche il suo segno.
 *
 * `risparmio` e `rata` sono spese a tutti gli effetti — i soldi escono — ma
 * stanno fuori dal limite delle variabili, perché non sono cose che si
 * decidono ogni mese. `giroconto` non è né entrata né spesa: sposta.
 */
export type TipoMovimento = "entrata" | "spesa" | "risparmio" | "rata" | "giroconto";

export type MovimentoPf = {
  id: string;
  data: string;
  tipo: TipoMovimento;
  categoriaId: string;
  contoId: string;
  /** Solo sui giroconti. `null` quando l'altro capo è un conto non tracciato. */
  contoDestinazioneId?: string | null;
  /** Sempre positivo. Il segno è in `tipo`. */
  importo: number;
  descrizione: string;
  /** A quale import appartiene, per poterlo annullare. */
  importId?: string;
  /**
   * L'impronta con cui si riconosce lo stesso movimento importato due volte.
   *
   * Salvata e non ricalcolata al volo: si calcola sulla descrizione
   * normalizzata, e la normalizzazione può cambiare. Se cambiasse dopo un
   * import, le impronte vecchie e quelle nuove non coinciderebbero più e i
   * duplicati tornerebbero a passare — in silenzio.
   */
  hashDuplicato?: string;
};

export type TipoCategoria = "entrata" | "spesa" | "risparmio" | "rata";

export type CategoriaPf = {
  id: string;
  tipo: TipoCategoria;
  nome: string;
  /**
   * Spesa non comprimibile: affitto, bollette, commercialista.
   *
   * Esce dal limite delle variabili perché non è una cosa su cui si può
   * decidere questo mese. Metterla dentro farebbe dire «puoi spendere 1.200 €»
   * a chi ne ha già 900 impegnati il giorno 5.
   */
  fissa: boolean;
  /**
   * Questa spesa è già coperta dall'accantonamento fiscale.
   *
   * F24, INPS, acconti, saldo: soldi che escono davvero dal conto, ma che
   * erano già stati messi da parte — sono la **destinazione** di quei
   * risparmi, non una spesa nuova. Contarli nel limite li conterebbe due
   * volte: una quando si accantona ogni mese, una quando si pagano.
   *
   * Senza questo flag il limite di giugno e novembre — i mesi degli acconti —
   * crollava proprio nei mesi in cui il denaro c'era già, e la persona si
   * vedeva dire che non poteva spendere niente mentre pagava con soldi
   * accantonati apposta.
   *
   * Il saldo del conto, invece, scende: quei soldi escono per davvero. È la
   * differenza fra «quanto ho» e «quanto di quello che ho è mio», ed è tutto
   * il mestiere di questo modulo.
   */
  pagataDallAccantonamento: boolean;
  /**
   * Il denaro di questa categoria **viene dall'attività**: è un prelievo.
   *
   * Una fattura incassata sul conto personale è un'entrata personale vera —
   * si può spendere, e il limite di spesa fa bene a contarla — ma è anche
   * denaro che ha lasciato la cassa dell'attività. Oggi il motore fiscale non
   * lo sa: tiene quei soldi nella liquidità dell'attività mentre il modulo li
   * tiene nel saldo personale, e gli stessi euro risultano disponibili in due
   * posti. Misurato: 2.402 € di cassa attività e 2.400 € di conto personale
   * per una sola fattura da 2.400 €.
   *
   * **Per adesso il campo è dichiarativo: non cambia nessun numero.** Diventa
   * una regola il giorno in cui il riepilogo mensile del Cashflow deriverà dal
   * registro — allora un'entrata marcata così sarà anche un'uscita di cassa
   * dell'attività. Senza il campo, quella derivazione sommerebbe 2.402 + 2.400
   * per 2.400 € veri: la divergenza diventerebbe un doppio conteggio.
   * Vedi APPROSSIMAZIONI.md.
   */
  arrivaDallAttivita: boolean;
  icona?: string;
};

export type BudgetPf = {
  /** La chiave è la coppia: una riga per categoria e anno. */
  categoriaId: string;
  anno: number;
  /** Dodici importi, gennaio per primo. */
  importi: number[];
};

export type ClasseBene =
  | "investimenti"
  | "beni"
  | "crediti"
  | "pensione"
  | "altro"
  | "debiti";

export type BenePf = {
  id: string;
  classe: ClasseBene;
  nome: string;
  /** Positivo anche per i debiti: il segno lo dà la classe. */
  valore: number;
  aggiornatoIl: string;
};

export type RegolaPf = {
  id: string;
  /** Confrontato con la descrizione normalizzata, senza maiuscole. */
  testoDaCercare: string;
  categoriaId: string;
  tipo: TipoMovimento;
};

/**
 * Le impostazioni del modulo: una riga sola, in archivio.
 *
 * In archivio e non nel browser, perché viaggiano nel backup: un cuscinetto
 * scritto in `localStorage` sparisce al primo cambio di computer, e sparisce
 * in silenzio — il limite di spesa si alza di colpo e nessuno sa perché.
 */
/**
 * Da quale conto escono le tasse.
 *
 * Sta qui e non in `chi-paga-il-fisco.ts` perché `ImpostazioniPf` lo usa, e
 * quel modulo usa i tipi di questo file: il tipo nel posto più in basso dei
 * due è l'unico modo di non farli girare in tondo.
 */
export type ChiPagaIlFisco = "attivita" | "personale";

export type ImpostazioniPf = {
  /** Sempre `unico`: la riga è una sola, e la chiave lo dice. */
  id: "unico";
  /**
   * Quanto lasciare sul conto senza contarlo fra i soldi spendibili.
   *
   * Non è risparmio: è il margine per l'imprevisto, e serve che resti lì. Zero
   * è una scelta legittima — vuol dire «conto tutto» — e infatti è il valore
   * di partenza, perché un cuscinetto messo da noi al posto di chi legge
   * sarebbe una cifra sua decisa da altri.
   */
  cuscinetto: number;
  /** Quello che avanza in un mese si somma al mese dopo. */
  riportoAttivo: boolean;
  /**
   * Da quale conto escono gli F24, dichiarato da chi usa l'app.
   *
   * `null` vuol dire che non l'ha ancora detto: allora vale quello che i
   * segnali misurano, e se non bastano vale «personale». Non è un campo da
   * riempire di default — vedi `rispostaChiPaga` — perché una dichiarazione
   * che nessuno ha fatto non si distingue più da una fatta, e su questa
   * risposta si decide se togliere o no la quota di accantonamento dal limite
   * del mese.
   */
  fiscoPagatoDa: ChiPagaIlFisco | null;
};

export const IMPOSTAZIONI_PF_PREDEFINITE: ImpostazioniPf = {
  id: "unico",
  cuscinetto: 0,
  riportoAttivo: true,
  fiscoPagatoDa: null,
};

/**
 * Una meta di risparmio: quanto, per quando, e **da dove si misura**.
 *
 * La fonte è la parte che di solito manca. Un obiettivo con un importo
 * aggiornato a mano è un numero che invecchia dal giorno dopo: dice 3.000 €
 * per mesi mentre sul conto ce ne sono 1.800, e nessuno se ne accorge finché
 * non serve. Qui l'accumulato si **misura**: il saldo di un conto, o la somma
 * dei movimenti di una categoria di risparmio da una data in poi.
 *
 * `nessuna` è una scelta legittima e dichiarata: la meta esiste, l'importo
 * pure, e l'avanzamento **non si sa**. Meglio di una barra colorata che si
 * riempie per finta.
 */
export type FonteObiettivo = "conto" | "categoria" | "nessuna";

export type ObiettivoPf = {
  id: string;
  nome: string;
  /** Quanto serve mettere insieme. Sempre positivo. */
  obiettivo: number;
  /** La data entro cui, se c'è. `null` vuol dire «senza fretta». */
  entro: string | null;
  fonte: FonteObiettivo;
  /** L'id del conto o della categoria. `null` quando la fonte è `nessuna`. */
  fonteId: string | null;
  /**
   * Da quando si conta, per la fonte «categoria».
   *
   * Senza questa data la somma prenderebbe anche i risparmi di anni fa, che
   * sono già stati spesi per altro: una meta nata oggi risulterebbe quasi
   * raggiunta il giorno in cui la si scrive. Sul conto non serve — lì il
   * saldo è quello che c'è adesso.
   */
  dal: string;
  icona?: string;
};

export type ImportPf = {
  id: string;
  data: string;
  file: string;
  /**
   * Il conto su cui è finito l'import, quando è uno solo.
   *
   * Vuoto quando i file erano più d'uno e andavano su conti diversi: prima
   * teneva il conto del **primo** file e lo chiamava «il conto dell'import»,
   * che su due file era falso. Chi vuole sapere dove sono finiti i movimenti
   * li conta — `movimentiPerConto` — invece di fidarsi di questa riga.
   */
  contoId: string;
  numeroMovimenti: number;
};
