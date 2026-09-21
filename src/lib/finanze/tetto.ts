/**
 * Il tetto: quello che il conto permette, comunque vada il mese.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Due domande diverse, e vince la più severa
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `tabellaLimite` risponde a «quanto posso spendere secondo il mese»: entrate
 * meno accantonamento, fisse, risparmi e rate. È un conto di **flusso**, e non
 * sa niente di quanto c'è in banca: un mese con entrate previste alte dà un
 * limite alto anche se il conto è vuoto, perché quelle entrate devono ancora
 * arrivare.
 *
 * Questo modulo risponde all'altra domanda: «quanto permette il conto». È un
 * conto di **giacenza** — quello che c'è, meno quello che è già impegnato — e
 * non sa niente di quello che arriverà.
 *
 * Nessuna delle due è la risposta. La risposta è la più bassa, e va detto
 * **quale delle due ha vinto**: un numero che scende senza dire perché si
 * legge come un errore dell'app, e il mese dopo non si guarda più.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * I soldi del fisco sono sul conto e non sono tuoi
 * ─────────────────────────────────────────────────────────────────────────
 *
 * È il pezzo che il brief non aveva, ed è il più grosso. A settembre, con due
 * trimestri di IVA da versare e il secondo acconto a novembre, quel denaro è
 * ancora in banca: sta nel saldo, si vede, e non è disponibile. Un tetto che
 * non lo toglie dice una cifra più alta del vero **proprio nei mesi in cui il
 * fondo è più pieno** — cioè quelli in cui uno è più tentato di fidarsi del
 * saldo.
 *
 * Quanto togliere lo sa il motore fiscale, ed è già calcolato per la card del
 * cruscotto: `quotaAccantonamento` dice quanto resta da mettere da parte per
 * imposte, contributi e IVA. Quella cifra è, per definizione, quello che
 * dovrai versare e non hai ancora versato — sia che tu l'abbia già messa da
 * parte, sia che non l'abbia fatto. In tutti e due i casi non si può spendere.
 */
import { round2, nonNegativo } from "@/lib/fisco/aritmetica";

export type IngressoTetto = {
  /** La somma dei conti, oggi. */
  saldoConti: number;
  /** Quanto resta sul conto senza essere contato: la scelta di chi legge. */
  cuscinetto: number;
  /** Fisse, risparmi e rate ancora da pagare in questo mese. */
  impegniDelMese: number;
  /** Imposte, contributi e IVA ancora da versare: `quotaAccantonamento`. */
  fiscoNonVersato: number;
};

export type Tetto = {
  /** Quanto permette il conto: saldo meno cuscinetto, impegni e fisco. */
  tetto: number;
  /** Le tre sottrazioni, per poterle mostrare una per una. */
  saldoConti: number;
  cuscinetto: number;
  impegniDelMese: number;
  fiscoNonVersato: number;
};

export function tettoDalConto(ing: IngressoTetto): Tetto {
  return {
    tetto: round2(
      ing.saldoConti
        - nonNegativo(ing.cuscinetto)
        - nonNegativo(ing.impegniDelMese)
        - nonNegativo(ing.fiscoNonVersato),
    ),
    saldoConti: round2(ing.saldoConti),
    cuscinetto: round2(nonNegativo(ing.cuscinetto)),
    impegniDelMese: round2(nonNegativo(ing.impegniDelMese)),
    fiscoNonVersato: round2(nonNegativo(ing.fiscoNonVersato)),
  };
}

export type Vincolo = "mese" | "conto";

export type LimiteEffettivo = {
  limite: number;
  /** Chi ha deciso: il mese o il conto. Va detto, sempre. */
  vincolo: Vincolo;
  dalMese: number;
  dalConto: number;
  /** Di quanto il vincolo che ha vinto è più stretto dell'altro. */
  differenza: number;
};

/**
 * Il limite vero: il più basso fra i due, con il nome di chi ha vinto.
 *
 * A parità vince «mese»: è il conto che una persona ha in testa quando apre la
 * schermata, e dire «te lo impone il conto» quando il conto non sta
 * stringendo niente sarebbe un allarme senza causa.
 */
export function limiteEffettivo(dalMese: number, dalConto: number): LimiteEffettivo {
  const vincolo: Vincolo = dalConto < dalMese ? "conto" : "mese";
  return {
    limite: round2(Math.min(dalMese, dalConto)),
    vincolo,
    dalMese: round2(dalMese),
    dalConto: round2(dalConto),
    differenza: round2(Math.abs(dalMese - dalConto)),
  };
}
