/**
 * Il riepilogo mensile del Cashflow, derivato dal registro.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Che cosa sostituisce, e che cosa no
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il denaro personale si scrive in due posti: il riepilogo mensile che si
 * compila a mano — prelievi, altre entrate, spese, risparmio — e il registro
 * dei movimenti. Sono lo stesso denaro, e finora nessuno dei due sapeva
 * dell'altro.
 *
 * Qui il riepilogo si **ricava** dal registro, con quattro regole decise
 * prima di scrivere il codice (APPROSSIMAZIONI.md):
 *
 * 1. Vale **solo per i mesi che hanno movimenti registrati.** Un mese
 *    compilato a mano prima del modulo resta com'è: riscriverlo cancellerebbe
 *    un dato vero con un dato assente.
 * 2. Ogni mese **dice da quale dei due arriva**. Due fonti che si alternano
 *    senza dirlo sono peggio di due fonti separate.
 * 3. Tocca il motore che usano i clienti, quindi ha i suoi test.
 * 4. Un'entrata di una categoria con `arrivaDallAttivita` acceso è **anche**
 *    un'uscita di cassa dell'attività: è un prelievo. Senza questa regola la
 *    derivazione sommerebbe due volte gli stessi euro — misurato: 2.402 € di
 *    liquidità dell'attività più 2.400 € di conto personale per una fattura
 *    da 2.400 € incassata una volta sola.
 * 5. **Un anno chiuso non si deriva.** La chiusura è una dichiarazione, e un
 *    import non può riscriverla. Misurato: mettendo un registro dentro il
 *    2025 chiuso della vetrina, il saldo di cassa di quell'anno scendeva da
 *    10.851,18 € a 10.301,18 € — con lo scostamento dalla chiusura che
 *    compariva da solo — e il 2026 ereditava 550 € in meno **senza che
 *    nessuno dei suoi mesi cambiasse**: un numero che si muove per una
 *    ragione che in quella schermata non si vede. Se l'anno si riapre la
 *    derivazione riprende, e lì lo scostamento è giusto che compaia: è il
 *    momento in cui si è deciso di rimettere mano a quei numeri.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Dove finisce ogni movimento
 * ─────────────────────────────────────────────────────────────────────────
 *
 *   entrata, categoria «arriva dall'attività»  → prelievi
 *   entrata, tutte le altre categorie          → altreEntrate
 *   spesa, categoria fissa                     → speseFisse
 *   rata                                       → speseFisse
 *   spesa, categoria non fissa                 → speseVariabili
 *   risparmio                                  → risparmio
 *   giroconto                                  → da nessuna parte
 *
 * Le rate stanno con le fisse perché il riepilogo a mano non ha una casella
 * per loro e perché è quello che sono: impegni che non si decidono ogni mese.
 * I giroconti non entrano: spostare denaro fra due conti propri non lo fa né
 * entrare né uscire, e contarli gonfierebbe due colonne di una somma che non
 * esiste.
 *
 * Una categoria che il registro nomina ma che non esiste più — cancellata
 * dopo l'import — non si può classificare: le sue entrate finiscono fra le
 * altre entrate e le sue uscite fra le variabili, che è il posto che non
 * cambia nessuna delle due cifre delicate (i prelievi e le fisse).
 */
import { round2, somma } from "@/lib/fisco/aritmetica";
import type { MovimentoPersonale } from "@/lib/dati/tipi";
import type { CategoriaPf, MovimentoPf } from "./tipi";

/**
 * Da dove arriva il riepilogo di un mese.
 *
 * `chiuso` è il caso che si spiega meno da solo: **ci sono movimenti nel
 * registro, e non si usano**, perché l'anno è chiuso. Non è «manuale» — quello
 * è un mese in cui il registro tace — ed è la differenza che la schermata deve
 * dire, altrimenti chi ha appena importato un estratto conto vede numeri che
 * non si muovono e pensa che l'import non abbia funzionato.
 */
export type FonteRiepilogo = "registro" | "manuale" | "assente" | "chiuso";

export type MeseRiepilogo = {
  anno: number;
  mese: number;
  fonte: FonteRiepilogo;
  /** Quanti movimenti ci sono dietro, quando la fonte è il registro. */
  quanti: number;
  riga: MovimentoPersonale;
};

const annoDi = (d: string) => Number(d.slice(0, 4));
const meseDi = (d: string) => Number(d.slice(5, 7));

const vuota = (anno: number, mese: number, id: string): MovimentoPersonale => ({
  id,
  anno,
  mese,
  prelievi: 0,
  altreEntrate: 0,
  speseFisse: 0,
  speseVariabili: 0,
  risparmio: 0,
});

/**
 * Il riepilogo di un mese, dai suoi movimenti.
 *
 * L'id è quello della riga manuale quando c'è, così chi guarda l'archivio
 * ritrova la stessa riga; altrimenti è costruito dall'anno e dal mese, che è
 * la sua chiave naturale.
 */
export function riepilogoDelMese(
  movimenti: MovimentoPf[],
  categorie: CategoriaPf[],
  anno: number,
  mese: number,
  id: string,
): MovimentoPersonale {
  const perId = new Map(categorie.map((c) => [c.id, c]));
  const riga = vuota(anno, mese, id);
  const prendi = (filtro: (m: MovimentoPf) => boolean) =>
    round2(somma(...movimenti.filter(filtro).map((m) => m.importo)));

  const dallAttivita = (m: MovimentoPf) => perId.get(m.categoriaId)?.arrivaDallAttivita === true;
  const fissa = (m: MovimentoPf) => perId.get(m.categoriaId)?.fissa === true;

  riga.prelievi = prendi((m) => m.tipo === "entrata" && dallAttivita(m));
  riga.altreEntrate = prendi((m) => m.tipo === "entrata" && !dallAttivita(m));
  riga.speseFisse = prendi((m) => (m.tipo === "spesa" && fissa(m)) || m.tipo === "rata");
  riga.speseVariabili = prendi((m) => m.tipo === "spesa" && !fissa(m));
  riga.risparmio = prendi((m) => m.tipo === "risparmio");
  return riga;
}

/**
 * I dodici mesi di un anno, ognuno con la sua fonte.
 *
 * `assente` vuol dire che di quel mese non si sa niente: né movimenti né riga
 * compilata. Non è un mese a zero, ed è la ragione per cui questa funzione
 * restituisce anche i mesi vuoti invece di saltarli.
 */
export function riepilogoDellAnno(
  manuali: MovimentoPersonale[],
  movimenti: MovimentoPf[],
  categorie: CategoriaPf[],
  anno: number,
  /** L'anno è chiuso: il riepilogo resta quello dichiarato. Vedi la regola 5. */
  chiuso = false,
): MeseRiepilogo[] {
  const dellAnno = movimenti.filter((m) => annoDi(m.data) === anno && m.tipo !== "giroconto");
  const perMese = new Map<number, MovimentoPf[]>();
  for (const m of dellAnno) perMese.set(meseDi(m.data), [...(perMese.get(meseDi(m.data)) ?? []), m]);

  return Array.from({ length: 12 }, (_, i) => i + 1).map((mese) => {
    const manuale = manuali.find((r) => r.anno === anno && r.mese === mese) ?? null;
    const suoi = perMese.get(mese) ?? [];
    const id = manuale?.id ?? `pf-${anno}-${String(mese).padStart(2, "0")}`;

    /*
      Regola 1: il registro vince solo dove c'è. Un mese senza movimenti
      tiene la sua riga compilata a mano — anche se quella riga è tutta a
      zero, perché uno zero scritto da qualcuno è una dichiarazione, e un mese
      mai importato non lo è.
    */
    if (suoi.length === 0) {
      return {
        anno,
        mese,
        fonte: manuale ? "manuale" : "assente",
        quanti: 0,
        riga: manuale ?? vuota(anno, mese, id),
      } as MeseRiepilogo;
    }

    /*
      Regola 5: l'anno chiuso tiene quello che è stato dichiarato. I movimenti
      ci sono e si contano — la schermata li nomina — ma non entrano nel
      riepilogo.
    */
    if (chiuso) {
      return {
        anno,
        mese,
        fonte: "chiuso",
        quanti: suoi.length,
        riga: manuale ?? vuota(anno, mese, id),
      };
    }

    return {
      anno,
      mese,
      fonte: "registro",
      quanti: suoi.length,
      riga: riepilogoDelMese(suoi, categorie, anno, mese, id),
    };
  });
}

/**
 * Le righe da dare al motore: le manuali dove il registro tace, le derivate
 * dove parla.
 *
 * È il punto in cui la derivazione entra in funzione, ed è uno solo: il
 * Cashflow e il bilancio dell'attività continuano a leggere
 * `movimentiPersonali` come hanno sempre fatto, e non sanno che alcune di
 * quelle righe adesso sono calcolate. Un innesto in un punto solo si può
 * misurare prima e dopo; sparso in tre schermate, no.
 *
 * Gli anni che il registro non tocca restano intatti, riga per riga: la
 * derivazione di un anno non deve cambiare il saldo iniziale di quello dopo
 * per un anno che non c'entra.
 */
export function riepilogoEffettivo(
  manuali: MovimentoPersonale[],
  movimenti: MovimentoPf[],
  categorie: CategoriaPf[],
  /** Gli anni chiusi, che non si derivano. Vedi la regola 5. */
  anniChiusi: Iterable<number> = [],
): MovimentoPersonale[] {
  const chiusi = new Set(anniChiusi);
  const anni = new Set(
    movimenti
      .filter((m) => m.tipo !== "giroconto")
      .map((m) => annoDi(m.data))
      .filter((a) => !chiusi.has(a)),
  );
  if (anni.size === 0) return manuali;

  const fuori = manuali.filter((r) => !anni.has(r.anno));
  const dentro = [...anni].flatMap((anno) =>
    riepilogoDellAnno(manuali, movimenti, categorie, anno)
      .filter((m) => m.fonte !== "assente")
      .map((m) => m.riga),
  );
  return [...fuori, ...dentro];
}

/**
 * I mesi di un anno in cui il registro ha qualcosa da dire, con la loro fonte.
 *
 * Serve alle schermate: il Cashflow segna le righe che arrivano dal registro e
 * non si scrivono più a mano, e dice quando un anno chiuso sta tenendo ferme
 * cifre che il registro contraddice.
 */
export function mesiConRegistro(righe: MeseRiepilogo[]): MeseRiepilogo[] {
  return righe.filter((r) => r.quanti > 0);
}

/** Gli anni che una chiusura ha dichiarato finiti. */
export function anniChiusi(chiusure: { anno: number }[]): number[] {
  return chiusure.map((c) => c.anno);
}

/**
 * Gli anni chiusi in cui un gruppo di movimenti va a cadere, con quanti sono.
 *
 * Serve all'esito di un import: chi carica l'estratto conto di un anno che ha
 * già chiuso deve leggerlo lì, subito, e non scoprirlo dal fatto che i numeri
 * non si muovono. «Non è successo niente» e «è successo, e non tocca quel
 * riepilogo» sono due cose diverse, e senza la riga si vedono uguali.
 */
export function anniChiusiToccati(
  movimenti: MovimentoPf[],
  chiusure: { anno: number }[],
): { anno: number; quanti: number }[] {
  const chiusi = new Set(chiusure.map((c) => c.anno));
  const quanti = new Map<number, number>();
  for (const m of movimenti) {
    if (m.tipo === "giroconto") continue;
    const a = annoDi(m.data);
    if (!chiusi.has(a)) continue;
    quanti.set(a, (quanti.get(a) ?? 0) + 1);
  }
  return [...quanti.entries()]
    .map(([anno, quanti]) => ({ anno, quanti }))
    .sort((x, y) => x.anno - y.anno);
}

/**
 * Che cosa cambierebbe riaprendo un anno chiuso.
 *
 * Riaprire un anno **cancella la chiusura**, e con lei il termine di
 * paragone: lo scostamento «alla chiusura era X, adesso è Y» non può comparire
 * dopo, perché la X non c'è più. L'unico momento in cui quel confronto si può
 * fare è **prima**, ed è qui: i prelievi dichiarati contro quelli che
 * uscirebbero dal registro, sui soli mesi che il registro conosce.
 *
 * Serve a decidere con un numero in mano invece che al buio. Non cambia
 * niente da solo: è una lettura.
 */
export function seRiaprissi(
  manuali: MovimentoPersonale[],
  movimenti: MovimentoPf[],
  categorie: CategoriaPf[],
  anno: number,
): { dichiarati: number; derivati: number; differenza: number; mesi: number[] } {
  const derivate = riepilogoDellAnno(manuali, movimenti, categorie, anno, false);
  const conRegistro = derivate.filter((r) => r.quanti > 0);
  const dichiarati = round2(
    somma(
      ...conRegistro.map(
        (r) => manuali.find((m) => m.anno === anno && m.mese === r.mese)?.prelievi ?? 0,
      ),
    ),
  );
  const derivati = round2(somma(...conRegistro.map((r) => r.riga.prelievi)));
  return {
    dichiarati,
    derivati,
    differenza: round2(derivati - dichiarati),
    mesi: conRegistro.map((r) => r.mese),
  };
}
