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
};

export const IMPOSTAZIONI_PF_PREDEFINITE: ImpostazioniPf = {
  id: "unico",
  cuscinetto: 0,
  riportoAttivo: true,
};

export type ImportPf = {
  id: string;
  data: string;
  file: string;
  contoId: string;
  numeroMovimenti: number;
};
