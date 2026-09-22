/**
 * Il budget: quanto avevi previsto, quanto è successo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Tre cose che non sono zero
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 1. **Una categoria senza budget non ha budget zero.** Dire «speso 240 € su 0
 *    previsti, sforato del 100%» a chi non ha mai compilato quella riga è un
 *    allarme costruito sul niente, e insegna a ignorare gli allarmi.
 * 2. **Un mese senza movimenti non è un mese senza spese.** È un mese non
 *    importato. Mostrarlo come «0 € spesi, sei rimasto sotto» è la bugia più
 *    gentile che questo modulo possa raccontare, ed è comunque una bugia.
 * 3. **Il confronto non giudica.** `sotto`, `vicino` e `oltre` dicono dove sta
 *    il consumato rispetto al previsto, e basta: su una spesa stare oltre è
 *    una cosa, su un'entrata è un'altra, e a decidere il colore è la
 *    schermata, che sa di che tipo di categoria sta parlando.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La media è un suggerimento, non un budget
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `media` è quello che si spende davvero in quella categoria nei mesi che
 * hanno movimenti — la stessa media che `limite.ts` usa quando un budget non
 * c'è. Qui si mostra accanto alla casella perché **compilare un budget senza
 * sapere quanto si spende è un esercizio di fantasia**, ma non si scrive da
 * sola: un numero che compare in una casella senza che nessuno lo abbia
 * digitato diventa una decisione di chi ha scritto il programma.
 */
import { round2, somma } from "@/lib/fisco/aritmetica";
import type { BudgetPf, CategoriaPf, MovimentoPf } from "./tipi";

export type StatoBudget = "senza-budget" | "senza-dati" | "sotto" | "vicino" | "oltre";

export type RigaBudget = {
  categoria: CategoriaPf;
  /** Il previsto del mese guardato. Zero quando non c'è budget: vedi `stato`. */
  previsto: number;
  /** Il previsto dei dodici mesi. */
  previstoAnno: number;
  /** Quello che i movimenti dicono, nel mese guardato. */
  speso: number;
  /** Quello che i movimenti dicono, in tutto l'anno. */
  spesoAnno: number;
  /** Previsto meno speso. Negativo vuol dire oltre il previsto. */
  differenza: number;
  /** Speso diviso previsto. `null` senza budget: non si divide per zero. */
  quota: number | null;
  stato: StatoBudget;
  /** La media dei mesi con movimenti. Il suggerimento, mai scritto da solo. */
  media: number;
  /** Su quanti mesi è fatta quella media. Una media su un mese solo si dice. */
  mesiMisurati: number;
  /** I dodici importi sono tutti uguali: la riga si può riassumere in uno. */
  uniforme: boolean;
};

export type ConfrontoBudget = {
  righe: RigaBudget[];
  /** Il mese guardato ha movimenti registrati. Se no, «speso» non si sa. */
  conMovimenti: boolean;
  totale: { previsto: number; speso: number; differenza: number };
};

/** Quando il consumato sfiora il previsto senza superarlo. */
const SOGLIA_VICINO = 0.9;

const annoDi = (data: string) => Number(data.slice(0, 4));
const meseDi = (data: string) => Number(data.slice(5, 7));

/** I dodici importi di una categoria, o dodici zeri se non c'è la riga. */
export function importiDi(budget: BudgetPf[], categoriaId: string, anno: number): number[] {
  const riga = budget.find((b) => b.categoriaId === categoriaId && b.anno === anno);
  const importi = riga?.importi ?? [];
  return Array.from({ length: 12 }, (_, i) => importi[i] ?? 0);
}

/** Dodici caselle con lo stesso importo dentro. */
export function dodiciMesi(importo: number): number[] {
  return Array.from({ length: 12 }, () => round2(importo));
}

/** I dodici importi sono uguali fra loro. Dodici zeri contano come uniformi. */
export function uniforme(importi: number[]): boolean {
  return importi.every((n) => n === importi[0]);
}

/**
 * Il confronto di un mese, categoria per categoria.
 *
 * Le categorie pagate dall'accantonamento restano fuori, e non per ordine: il
 * limite di spesa le toglie da **tutti** i gruppi — sono la destinazione di
 * soldi già messi da parte — quindi un budget scritto lì non cambierebbe
 * nessun numero. Una casella che accetta una cifra e non la usa è peggio di
 * una casella che non c'è.
 */
export function confrontoBudget(ing: {
  anno: number;
  mese: number;
  movimenti: MovimentoPf[];
  categorie: CategoriaPf[];
  budget: BudgetPf[];
}): ConfrontoBudget {
  const dellAnno = ing.movimenti.filter(
    (m) => m.tipo !== "giroconto" && annoDi(m.data) === ing.anno,
  );
  const mesiConMovimenti = new Set(dellAnno.map((m) => meseDi(m.data)));
  const conMovimenti = mesiConMovimenti.has(ing.mese);

  const righe = ing.categorie
    .filter((c) => !c.pagataDallAccantonamento)
    .map((categoria) => {
      const suoi = dellAnno.filter((m) => m.categoriaId === categoria.id);
      const importi = importiDi(ing.budget, categoria.id, ing.anno);
      const previsto = importi[ing.mese - 1];
      const speso = round2(
        somma(...suoi.filter((m) => meseDi(m.data) === ing.mese).map((m) => m.importo)),
      );
      const spesoAnno = round2(somma(...suoi.map((m) => m.importo)));

      /*
        La media si fa sui mesi che hanno movimenti, non sui mesi passati:
        un mese mai importato conta zero e tirerebbe giù la media di chi ha
        caricato solo metà anno — che è esattamente chi sta compilando il
        budget per la prima volta.
      */
      const mesiMisurati = mesiConMovimenti.size;
      const media = mesiMisurati === 0 ? 0 : round2(spesoAnno / mesiMisurati);

      const senzaBudget = previsto === 0;
      /*
        La quota è arrotondata perché si stampa; lo **stato** non la guarda.

        400,50 su 400 fa 1,00125, che arrotondato a due decimali è 1,00: uno
        stato deciso sulla quota direbbe «vicino» a chi ha già sforato. Il
        confronto si fa sugli importi, che sono la cosa vera, e
        l'arrotondamento resta un fatto di stampa. È lo stesso difetto che
        questo progetto insegue — una misura che conferma invece di una che
        rompe — e qui l'ha trovato un test.
      */
      const quota = senzaBudget ? null : round2(speso / previsto);
      const stato: StatoBudget = !conMovimenti
        ? "senza-dati"
        : senzaBudget
          ? "senza-budget"
          : speso > previsto
            ? "oltre"
            : speso >= round2(previsto * SOGLIA_VICINO)
              ? "vicino"
              : "sotto";

      return {
        categoria,
        previsto,
        previstoAnno: round2(somma(...importi)),
        speso,
        spesoAnno,
        differenza: round2(previsto - speso),
        quota,
        stato,
        media,
        mesiMisurati,
        uniforme: uniforme(importi),
      };
    });

  return {
    righe,
    conMovimenti,
    totale: {
      previsto: round2(somma(...righe.map((r) => r.previsto))),
      speso: round2(somma(...righe.map((r) => r.speso))),
      differenza: round2(somma(...righe.map((r) => r.differenza))),
    },
  };
}

/** Le righe di un tipo solo, nell'ordine in cui arrivano le categorie. */
export function righeDelTipo(confronto: ConfrontoBudget, tipo: CategoriaPf["tipo"]): RigaBudget[] {
  return confronto.righe.filter((r) => r.categoria.tipo === tipo);
}

/** Previsto e speso di un gruppo di righe. */
export function totaleDi(righe: RigaBudget[]): { previsto: number; speso: number; differenza: number } {
  const previsto = round2(somma(...righe.map((r) => r.previsto)));
  const speso = round2(somma(...righe.map((r) => r.speso)));
  return { previsto, speso, differenza: round2(previsto - speso) };
}
