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
import { scadenzeAnno } from "@/lib/fisco/scadenze";
import {
  chiPagaIlFisco,
  dichiarazioneContraddetta,
  rispostaChiPaga,
  type ChiPagaIlFisco,
  type FonteRisposta,
  type LetturaChiPaga,
} from "./chi-paga-il-fisco";
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

/**
 * Chi paga il fisco, e cosa ne consegue sul limite.
 *
 * `quota` resta sempre quella vera — è la cifra del cruscotto, e l'attività
 * quei soldi li deve comunque. Quello che cambia è se il **limite del mese**
 * la sottrae: se le tasse escono dal conto dell'attività, il prelievo che
 * arriva sul conto personale è già netto, e toglierla di nuovo la toglierebbe
 * due volte.
 *
 * La riga non sparisce dalla schermata: va a zero e dice perché. Una riga che
 * sparisce è un numero cambiato senza spiegazione.
 */
export type FiscoDelMese = {
  chiPaga: ChiPagaIlFisco;
  fonte: FonteRisposta;
  lettura: LetturaChiPaga;
  /** La dichiarazione salvata dice il contrario di quello che i segnali misurano. */
  contraddetta: boolean;
  /** Quanto il limite ha davvero sottratto: `quota.alMese`, oppure zero. */
  accantonamentoApplicato: number;
};

export type SituazioneMese = {
  impostazioni: ImpostazioniPf;
  quota: QuotaAccantonamento;
  fisco: FiscoDelMese;
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
  /**
   * Il mese ha movimenti, ma **nessuna entrata registrata**.
   *
   * È il caso di chi importa il rendiconto di una carta di credito, o di un
   * conto su cui gli incassi non arrivano: di quel mese si sanno le uscite e
   * non le entrate. Il limite del mese, che parte dalle entrate, esce
   * negativo — l'accantonamento e le spese fisse sottratti a zero — e quel
   * numero non è un limite: è la misura di quanto manca all'importazione.
   *
   * Vale come `meseSenzaDati`: si mostra il tetto dal conto, e si dice
   * perché.
   */
  meseSenzaEntrate: boolean;
  /**
   * Il riporto arriva da un mese che a sua volta non aveva entrate
   * registrate.
   *
   * Un mese così lascia un disavanzo grande quanto l'accantonamento più le
   * spese, e se lo porta appresso: è il modo in cui un mese importato a metà
   * abbassa il limite di un mese che invece i suoi incassi ce li ha. Il
   * calcolo non cambia — distinguere «non ho incassato» da «non ho importato»
   * non si può fare senza indovinare — ma la schermata lo dice.
   */
  riportoDaMeseSenzaEntrate: boolean;
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

  /*
    Da quale conto escono le tasse. Si misura qui e non nella schermata perché
    da questa risposta dipende una sottrazione, e una sottrazione decisa dentro
    un componente è una sottrazione che nessun test guarda.
  */
  const lettura = chiPagaIlFisco({
    anno: ing.anno,
    oggi: ing.oggi,
    movimenti: ing.movimenti,
    categorie: ing.categorie,
    versamenti: ing.versamenti,
    scadenze: scadenzeAnno(
      ing.calcolo.impostazioni,
      parametriDi(ing.anno),
      ing.calcolo.prospetto,
      ing.calcolo.iva,
      ing.precedente?.prospetto ?? null,
    ),
    nettoDisponibile: ing.calcolo.prospetto.nettoDisponibile,
    caricoTotale: ing.calcolo.prospetto.caricoTotale,
  });
  const { chiPaga, fonte } = rispostaChiPaga(impostazioni.fiscoPagatoDa, lettura);
  const accantonamentoApplicato = chiPaga === "attivita" ? 0 : quota.alMese;

  const righe = tabellaLimite({
    anno: ing.anno,
    meseCorrente,
    movimenti: ing.movimenti,
    categorie: ing.categorie,
    budget: ing.budget,
    accantonamentoMensile: accantonamentoApplicato,
    riportoAttivo: impostazioni.riportoAttivo,
  });
  const riga = righe[meseCorrente - 1];
  const dalMese = quantoResta(riga, ing.oggi);

  const tetto = tettoDalConto({
    saldoConti: saldoTotale(ing.conti, ing.movimenti, ing.oggi),
    cuscinetto: impostazioni.cuscinetto,
    impegniDelMese: riga.fisse + riga.risparmi + riga.rate,
    /*
      Stessa ragione della riga sopra, dall'altro lato: quei soldi si tolgono
      dal saldo perché sono in banca e non sono tuoi. Se il fisco lo paga il
      conto dell'attività, sul conto personale non ci sono mai stati.
    */
    fiscoNonVersato:
      chiPaga === "attivita" ? 0 : quota.imposte.daAccantonare + quota.iva.daAccantonare,
  });

  const effettivo = limiteEffettivo(dalMese.resta, tetto.tetto - riga.speso);

  const budgetDelMese = ing.budget.some(
    (b) => b.anno === ing.anno && (b.importi[meseCorrente - 1] ?? 0) !== 0,
  );

  const precedente = meseCorrente > 1 ? righe[meseCorrente - 2] : null;

  return {
    impostazioni,
    quota,
    fisco: {
      chiPaga,
      fonte,
      lettura,
      contraddetta: dichiarazioneContraddetta(impostazioni.fiscoPagatoDa, lettura),
      accantonamentoApplicato,
    },
    righe,
    riga,
    dalMese,
    tetto,
    effettivo,
    meseCorrente,
    meseSenzaDati: !riga.conMovimenti && !budgetDelMese,
    meseSenzaEntrate: riga.conMovimenti && riga.entrate === 0,
    riportoDaMeseSenzaEntrate:
      riga.riporto < 0 && precedente !== null && precedente.conMovimenti && precedente.entrate === 0,
  };
}
