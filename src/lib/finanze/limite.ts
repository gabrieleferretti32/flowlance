/**
 * Quanto puoi spendere questo mese, dopo aver messo da parte le tasse.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La riga che le app di budget generiche non possono scrivere
 * ─────────────────────────────────────────────────────────────────────────
 *
 *     Limite = Entrate − Accantonamento − Fisse − Risparmi − Rate + Riporto
 *
 * Il secondo termine è tutta la differenza. Un'app di budget guarda il conto e
 * dice «hai 4.000 €». Di quei 4.000, per un freelance, una parte è già del
 * fisco: non è un risparmio prudente, è denaro di qualcun altro depositato sul
 * suo conto. Toglierlo **per primo**, prima di ogni altra voce, è il motivo per
 * cui questo modulo sta dentro Flowlance.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'accantonamento arriva, non si calcola
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `accantonamentoMensile` entra come parametro e viene dal motore fiscale —
 * la stessa cifra che l'app mostra nella card degli accantonamenti. Qui non si
 * ricalcola niente, nemmeno una divisione per dodici: due strade per lo stesso
 * numero sono due numeri il giorno in cui una delle due cambia, e su questa in
 * particolare significherebbe dire a una persona che può spendere soldi che
 * deve al fisco.
 */
import { round2, somma } from "@/lib/fisco/aritmetica";
import type { BudgetPf, CategoriaPf, MovimentoPf } from "./tipi";

export type IngressoLimite = {
  anno: number;
  /** Il mese di «oggi», da 1 a 12. Separa il passato dal futuro. */
  meseCorrente: number;
  movimenti: MovimentoPf[];
  categorie: CategoriaPf[];
  budget: BudgetPf[];
  /** Dal motore fiscale. Mai ricalcolato qui. */
  accantonamentoMensile: number;
  riportoAttivo: boolean;
};

/** Le voci che in un mese sono una stima e non un numero letto dai movimenti. */
export type VoceStimata = "entrate" | "fisse" | "risparmi" | "rate";

export type RigaLimite = {
  mese: number;
  entrate: number;
  accantonamento: number;
  fisse: number;
  risparmi: number;
  rate: number;
  riporto: number;
  limite: number;
  /** Le spese variabili già registrate nel mese. */
  speso: number;
  /** Limite meno speso. Può essere negativo, e va mostrato negativo. */
  resta: number;
  /** Un mese senza nessun movimento non è un mese a zero: è un mese che non si sa. */
  conMovimenti: boolean;
  stimate: VoceStimata[];
};

const meseDi = (data: string) => Number(data.slice(5, 7));
const annoDi = (data: string) => Number(data.slice(0, 4));

/** I movimenti dell'anno, raggruppati per mese. */
function perMese(movimenti: MovimentoPf[], anno: number): MovimentoPf[][] {
  const mesi: MovimentoPf[][] = Array.from({ length: 12 }, () => []);
  for (const m of movimenti) {
    if (annoDi(m.data) !== anno) continue;
    mesi[meseDi(m.data) - 1]?.push(m);
  }
  return mesi;
}

/**
 * Somma i movimenti di un gruppo di categorie.
 *
 * I giroconti non entrano mai: non sono né entrate né spese, e contarli
 * gonfierebbe tutte e due le colonne dello stesso importo.
 */
function totale(movimenti: MovimentoPf[], categorie: Set<string>): number {
  return round2(
    somma(
      ...movimenti
        .filter((m) => m.tipo !== "giroconto" && categorie.has(m.categoriaId))
        .map((m) => m.importo),
    ),
  );
}

function budgetDi(budget: BudgetPf[], categorie: Set<string>, mese: number): number {
  return round2(
    somma(...budget.filter((b) => categorie.has(b.categoriaId)).map((b) => b.importi[mese - 1] ?? 0)),
  );
}

/**
 * Il previsto di una voce, con l'avviso quando è una stima.
 *
 * L'ordine è: il budget se c'è, altrimenti la media dei mesi con movimenti.
 * La media è una stima e si dichiara — una cella che dice 800 € senza dire da
 * dove vengono è indistinguibile da una che li ha letti in banca, e su questa
 * tabella la differenza è fra un numero e un auspicio.
 *
 * I mesi senza movimenti non entrano nella media: uno zero lì non vuol dire
 * «non ho speso», vuol dire «non ho ancora importato».
 */
function previsto(
  budget: BudgetPf[],
  categorie: Set<string>,
  mese: number,
  mesi: MovimentoPf[][],
): { valore: number; stimato: boolean } {
  const daBudget = budgetDi(budget, categorie, mese);
  if (daBudget > 0) return { valore: daBudget, stimato: false };
  const conMovimenti = mesi.filter((m) => m.length > 0);
  if (conMovimenti.length === 0) return { valore: 0, stimato: false };
  const media = somma(...conMovimenti.map((m) => totale(m, categorie))) / conMovimenti.length;
  return { valore: round2(media), stimato: media > 0 };
}

/**
 * Le dodici righe dell'anno.
 *
 * Si calcolano in ordine perché il riporto di un mese è quello che è rimasto
 * nel mese prima, e quello che è rimasto nel mese prima contiene a sua volta
 * il suo riporto: l'avanzo si accumula, e uno sforamento si porta dietro.
 * È una scelta, ed è in APPROSSIMAZIONI.md.
 */
export function tabellaLimite(ing: IngressoLimite): RigaLimite[] {
  const idDi = (filtro: (c: CategoriaPf) => boolean) =>
    new Set(ing.categorie.filter(filtro).map((c) => c.id));

  const entrateCat = idDi((c) => c.tipo === "entrata");
  const fisseCat = idDi((c) => c.tipo === "spesa" && c.fissa);
  const variabiliCat = idDi((c) => c.tipo === "spesa" && !c.fissa);
  const risparmiCat = idDi((c) => c.tipo === "risparmio");
  const rateCat = idDi((c) => c.tipo === "rata");

  const mesi = perMese(ing.movimenti, ing.anno);
  const righe: RigaLimite[] = [];
  let riportoDalPrecedente = 0;

  for (let mese = 1; mese <= 12; mese += 1) {
    const dentro = mesi[mese - 1];
    const conMovimenti = dentro.length > 0;
    const stimate: VoceStimata[] = [];

    const reale = (cat: Set<string>) => totale(dentro, cat);
    const stima = (cat: Set<string>, voce: VoceStimata) => {
      const p = previsto(ing.budget, cat, mese, mesi);
      if (p.stimato) stimate.push(voce);
      return p.valore;
    };

    /*
      Le entrate del mese in corso sono **il maggiore** fra quello che è già
      arrivato e quello che è previsto. Prendere solo il reale il giorno 3
      direbbe che non si può spendere niente; prendere solo il previsto il
      giorno 28, con una fattura incassata in più, direbbe meno del vero.
    */
    let entrate: number;
    if (mese < ing.meseCorrente) {
      entrate = reale(entrateCat);
    } else if (mese === ing.meseCorrente) {
      const p = previsto(ing.budget, entrateCat, mese, mesi);
      const r = reale(entrateCat);
      entrate = Math.max(r, p.valore);
      if (entrate === p.valore && p.stimato && p.valore > r) stimate.push("entrate");
    } else {
      entrate = stima(entrateCat, "entrate");
    }

    const passato = mese < ing.meseCorrente;
    const fisse = passato && conMovimenti ? reale(fisseCat) : stima(fisseCat, "fisse");
    const risparmi = passato && conMovimenti ? reale(risparmiCat) : stima(risparmiCat, "risparmi");
    const rate = passato && conMovimenti ? reale(rateCat) : stima(rateCat, "rate");

    /*
      Il riporto arriva solo da un mese che ha movimenti. Un mese passato e
      vuoto non è un mese in cui non è successo niente: è un mese che non è
      stato importato, e trattarlo come un avanzo pieno regalerebbe al mese
      dopo un limite che non esiste.
    */
    const riporto = ing.riportoAttivo ? riportoDalPrecedente : 0;

    const limite = round2(
      entrate - ing.accantonamentoMensile - fisse - risparmi - rate + riporto,
    );
    const speso = reale(variabiliCat);
    const resta = round2(limite - speso);

    righe.push({
      mese,
      entrate,
      accantonamento: ing.accantonamentoMensile,
      fisse,
      risparmi,
      rate,
      riporto,
      limite,
      speso,
      resta,
      conMovimenti,
      stimate,
    });
    riportoDalPrecedente = conMovimenti ? resta : 0;
  }
  return righe;
}

export type QuantoResta = {
  limite: number;
  speso: number;
  resta: number;
  giorniRimasti: number;
  /** Quanto si può spendere al giorno, per i giorni che restano. Zero se il mese è finito. */
  alGiorno: number;
};

/**
 * La card della Panoramica: quanto resta, e quanto fa al giorno.
 *
 * `oggi` entra come parametro e non si legge dall'orologio: una funzione che
 * guarda l'ora non si può provare due volte con lo stesso risultato, e il
 * giorno in cui sbaglia lo fa solo a fine mese.
 */
export function quantoResta(riga: RigaLimite, oggi: string): QuantoResta {
  const anno = Number(oggi.slice(0, 4));
  const mese = Number(oggi.slice(5, 7));
  const giorno = Number(oggi.slice(8, 10));
  const giorniDelMese = new Date(Date.UTC(anno, mese, 0)).getUTCDate();
  const giorniRimasti = Math.max(0, giorniDelMese - giorno + 1);
  return {
    limite: riga.limite,
    speso: riga.speso,
    resta: riga.resta,
    giorniRimasti,
    /*
      Sotto zero non si divide: «−12,40 € al giorno» non è un'istruzione che
      qualcuno possa seguire. Il numero che conta in quel caso è `resta`, ed è
      già negativo — la schermata dirà quello.
    */
    alGiorno: giorniRimasti > 0 && riga.resta > 0 ? round2(riga.resta / giorniRimasti) : 0,
  };
}
