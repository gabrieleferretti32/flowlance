/**
 * I dataset di esempio, in un elenco solo.
 *
 * Ce n'erano uno e una funzione che lo caricava. Adesso sono due, e raccontano
 * due cose diverse: il **dimostrativo** è un forfettario con del lavoro dentro —
 * una fattura scaduta, un costo da pagare, un avviso da chiudere — e serve a
 * provare l'app; la **vetrina** è un ordinario a posto, con IVA, ritenute,
 * deducibilità diverse e un anno chiuso alle spalle, e serve a farla vedere.
 *
 * Stanno qui insieme perché le due strade che li offrono — la schermata di
 * primo avvio e Dati e backup — devono elencarli allo stesso modo. Aggiungerne
 * un terzo un domani significa aggiungere una voce a questo elenco: nessuna
 * delle due schermate va toccata.
 *
 * La differenza che conta davvero non è il regime, è `conservaImpostazioni`.
 * Il dimostrativo sostituisce i documenti ma lascia in piedi le risposte che
 * l'utente ha appena dato in configurazione: chi ha detto «sono forfettario»
 * non deve vederselo cancellare per aver chiesto di guardare le schermate
 * piene. La vetrina no — regime, regione, comune e aliquote *sono* la storia
 * che racconta, e conservarle la trasformerebbe in un forfettario con dentro
 * fatture con l'IVA.
 */
import { datiDemo, datiDemoConservando } from "./demo";
import { datiVetrina } from "./vetrina";
import type { Dati } from "./tipi";

export type IdDataset = "dimostrativo" | "vetrina";

export type Dataset = {
  id: IdDataset;
  /** Come si chiama sul pulsante. */
  nome: string;
  /** Una riga: cosa ci si trova dentro e a cosa serve. */
  sommario: string;
  /** Il regime che racconta, per distinguerli a colpo d'occhio. */
  regime: "forfettario" | "ordinario";
  /** L'anno su cui si apre. */
  anno: number;
  /** Le impostazioni già scelte dall'utente sopravvivono al caricamento. */
  conservaImpostazioni: boolean;
  dati: (attuali: Dati) => Dati;
};

export const DATASET: Dataset[] = [
  {
    id: "dimostrativo",
    nome: "Dimostrativo · forfettario",
    sommario:
      "Un anno di un forfettario che fattura 46.000 €, con una fattura scaduta, un costo da pagare e qualcosa da sistemare: serve a provare l'app, non a farne una cartolina.",
    regime: "forfettario",
    anno: 2026,
    conservaImpostazioni: true,
    dati: (attuali) => datiDemoConservando(attuali, { impostazioni: true, percorsi: true }),
  },
  {
    id: "vetrina",
    nome: "Vetrina · ordinario con IVA",
    sommario:
      "Regime ordinario con IVA trimestrale, ritenute d'acconto, costi a deducibilità diversa e il 2025 chiuso: tutte le sezioni piene, tutti i parametri dichiarati, niente da sistemare.",
    regime: "ordinario",
    anno: 2026,
    conservaImpostazioni: false,
    dati: () => datiVetrina(),
  },
];

export function datasetDi(id: IdDataset): Dataset {
  const trovato = DATASET.find((d) => d.id === id);
  if (!trovato) throw new Error(`dataset sconosciuto: ${id}`);
  return trovato;
}

/** Il dataset che si carica quando nessuno ha scelto: quello di sempre. */
export const DATASET_PREDEFINITO: IdDataset = "dimostrativo";

export { datiDemo, datiVetrina };
