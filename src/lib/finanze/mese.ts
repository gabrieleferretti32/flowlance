/**
 * Il mese in corso, visto da tutte e due le parti: quanto permette il mese e
 * quanto permette il conto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché sta qui e non dentro una schermata
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Questo calcolo nasce dentro «Quanto posso spendere», e appena una seconda
 * schermata — il budget — ha avuto bisogno dello stesso numero, è diventato
 * il candidato perfetto a essere scritto due volte. Due copie della stessa
 * catena sono due cifre il giorno in cui una delle due cambia, e su questa
 * catena vuol dire dire a una persona che può spendere soldi che non ha.
 *
 * Portandolo fuori dal componente diventa anche una funzione che si può
 * provare: prima era logica dentro un `useMemo`, e l'unico modo di verificarla
 * era aprire il browser e guardare.
 */
import type { AnnoCalcolato } from "@/lib/analisi/anno";
import type { VersamentoF24 } from "@/lib/fisco/tipi";
import { parametriDi } from "@/lib/fisco/parametri";
import { quotaAccantonamento, type QuotaAccantonamento } from "@/lib/fisco/accantonamento";
import { quantoResta, tabellaLimite, type QuantoResta, type RigaLimite } from "./limite";
import { saldoTotale } from "./saldo";
import { limiteEffettivo, tettoDalConto, type LimiteEffettivo, type Tetto } from "./tetto";
import { IMPOSTAZIONI_PF_PREDEFINITE, type ImpostazioniPf } from "./tipi";
import type { BudgetPf, CategoriaPf, ContoPersonale, MovimentoPf } from "./tipi";

export type IngressoMese = {
  anno: number;
  /** La data di oggi, che entra e non si legge dall'orologio. */
  oggi: string;
  calcolo: AnnoCalcolato;
  /** L'anno prima: senza, gli acconti escono senza importo. */
  precedente: AnnoCalcolato | null;
  versamenti: VersamentoF24[];
  conti: ContoPersonale[];
  movimenti: MovimentoPf[];
  categorie: CategoriaPf[];
  budget: BudgetPf[];
  impostazioniPf: ImpostazioniPf | null;
};

export type SituazioneMese = {
  impostazioni: ImpostazioniPf;
  quota: QuotaAccantonamento;
  righe: RigaLimite[];
  riga: RigaLimite;
  dalMese: QuantoResta;
  tetto: Tetto;
  effettivo: LimiteEffettivo;
  meseCorrente: number;
  /**
   * Il mese non ha né movimenti né budget: il limite del mese **non si può
   * calcolare**, e non vale zero.
   *
   * Sul dataset di vetrina — motore fiscale pieno, registro personale vuoto —
   * il numero grande diceva «puoi ancora spendere −1.026,45 €»: era
   * l'accantonamento sottratto a zero entrate. Una cifra sicura di sé
   * costruita sul niente è peggio di nessuna cifra, perché nessuno la mette in
   * dubbio.
   */
  meseSenzaDati: boolean;
};

export function situazioneDelMese(ing: IngressoMese): SituazioneMese {
  const impostazioni = ing.impostazioniPf ?? IMPOSTAZIONI_PF_PREDEFINITE;
  const meseCorrente = Number(ing.oggi.slice(5, 7));

  /*
    La quota del mese e il fisco non ancora versato vengono dallo stesso
    calcolo del cruscotto: una fonte sola per tutte le schermate, altrimenti
    sono numeri che prima o poi smettono di essere d'accordo.
  */
  const quota = quotaAccantonamento({
    prospetto: ing.calcolo.prospetto,
    impostazioni: ing.calcolo.impostazioni,
    parametri: parametriDi(ing.anno),
    iva: ing.calcolo.iva,
    versamenti: ing.versamenti,
    precedente: ing.precedente?.prospetto ?? null,
    oggi: ing.oggi,
  });

  const righe = tabellaLimite({
    anno: ing.anno,
    meseCorrente,
    movimenti: ing.movimenti,
    categorie: ing.categorie,
    budget: ing.budget,
    accantonamentoMensile: quota.alMese,
    riportoAttivo: impostazioni.riportoAttivo,
  });
  const riga = righe[meseCorrente - 1];
  const dalMese = quantoResta(riga, ing.oggi);

  const tetto = tettoDalConto({
    saldoConti: saldoTotale(ing.conti, ing.movimenti, ing.oggi),
    cuscinetto: impostazioni.cuscinetto,
    impegniDelMese: riga.fisse + riga.risparmi + riga.rate,
    fiscoNonVersato: quota.imposte.daAccantonare + quota.iva.daAccantonare,
  });

  const effettivo = limiteEffettivo(dalMese.resta, tetto.tetto - riga.speso);

  const budgetDelMese = ing.budget.some(
    (b) => b.anno === ing.anno && (b.importi[meseCorrente - 1] ?? 0) !== 0,
  );

  return {
    impostazioni,
    quota,
    righe,
    riga,
    dalMese,
    tetto,
    effettivo,
    meseCorrente,
    meseSenzaDati: !riga.conMovimenti && !budgetDelMese,
  };
}
