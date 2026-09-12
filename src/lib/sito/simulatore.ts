/**
 * Il simulatore pubblico: tre risposte, e il motore vero dietro.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché questo file è un adattatore e non un calcolo
 * ─────────────────────────────────────────────────────────────────────────
 *
 * La tentazione, su una pagina pubblica, è scrivere quattro moltiplicazioni:
 * ricavi per coefficiente, meno contributi, per aliquota. Verrebbe corta,
 * verrebbe subito, e sarebbe **una seconda copia del prodotto** — quella che
 * diverge al primo gennaio in cui cambiano gli scaglioni, e che nessuno
 * confronta mai con l'altra perché stanno in due cartelle diverse.
 *
 * Qui non si calcola niente. Si costruisce un archivio finto — fatture emesse
 * e incassate, costi pagati — e lo si dà in pasto a `calcolaProspetto`, lo
 * stesso che gira dentro l'applicazione. Se il motore cambia, il simulatore
 * cambia con lui; se sbaglia, sbaglia in tutti e due i posti, e in tutti e due
 * i posti si aggiusta una volta sola.
 *
 * Il costo di questa scelta è che l'adattatore può tradire: costruire fatture
 * che al motore risultano non incassate, o costi che non risultano pagati,
 * darebbe un prospetto perfettamente calcolato **su altri numeri**. È la
 * famiglia di difetti che questo progetto insegue: un risultato giusto sotto
 * una domanda diversa da quella fatta. Perciò la griglia in
 * `simulatore.test.ts` non verifica le imposte — quelle le verifica il motore
 * — ma verifica che quello che entra sia quello che il motore ha visto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Niente archivio, niente rete
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Questo file non importa `@/lib/dati/*` e non deve mai farlo: il simulatore
 * gira su una pagina pubblica e non deve poter scrivere nell'archivio di
 * nessuno, nemmeno per sbaglio, nemmeno una chiave vuota. Non è una promessa
 * scritta in un commento: `strumenti/verifica-import-simulatore.mjs` segue il
 * grafo degli import a partire dalla pagina e fallisce se ci arriva.
 */
import { calcolaProspetto, type Prospetto } from "@/lib/fisco/motore";
import { calcolaIva, type LiquidazioneIva } from "@/lib/fisco/iva";
import { scadenzeAnno, type Adempimento } from "@/lib/fisco/scadenze";
import {
  confrontaRegimi,
  ingressoDaProspetto,
  type Confronto,
} from "@/lib/fisco/confronto";
import { impostazioniPredefinite } from "@/lib/fisco/impostazioni";
import { ANNO_DEFINITIVO_PIU_RECENTE, parametriDi } from "@/lib/fisco/parametri";
import { round2 } from "@/lib/fisco/aritmetica";
import type { Costo, Fattura, Gestione, Impostazioni, Regime } from "@/lib/fisco/tipi";

/**
 * L'anno su cui si simula.
 *
 * L'ultimo con parametri **definitivi**, non l'ultimo in assoluto: una
 * simulazione pubblica fatta su aliquote ancora provvisorie sarebbe un numero
 * che cambia sotto i piedi di chi l'ha letto, senza che lui lo sappia.
 */
export const ANNO = ANNO_DEFINITIVO_PIU_RECENTE;

export type IngressoSimulatore = {
  /** Quanto pensi di fatturare in un anno. Imponibile, IVA esclusa. */
  ricavi: number;
  gruppoAteco: string;
  gestione: Gestione;

  // ——— Da qui in giù: tutto quello che sta dietro «affina il calcolo» ———
  regime: Regime;
  /** Imponibile dei costi documentati e pagati nell'anno. */
  costiAnnui: number;
  /**
   * L'anno di apertura della partita IVA, che decide l'aliquota agevolata.
   *
   * Una domanda e non un interruttore «sono una nuova attività»: i cinque anni
   * si contano dalla data, e un interruttore lasciato acceso è il difetto
   * peggiore che questo progetto abbia avuto — chi l'aveva acceso restava al
   * 5 % al sesto anno. `null` vuol dire «non l'ho detto», e allora l'aliquota
   * è quella piena, che è la risposta prudente.
   */
  annoAperturaPiva: number | null;
  /** Ha i requisiti di novità: non basta la data, e l'app non può dedurlo. */
  requisitiNuovaAttivita: boolean;
};

export const INGRESSO_INIZIALE: IngressoSimulatore = {
  ricavi: 40_000,
  gruppoAteco: "professionali",
  gestione: "separata",
  regime: "forfettario",
  costiAnnui: 0,
  annoAperturaPiva: null,
  requisitiNuovaAttivita: false,
};

/** I ricavi oltre i quali il motore serve a poco e la pagina lo dice. */
export const RICAVI_MASSIMI = 300_000;

/**
 * Dodici importi che sommano **esattamente** al totale.
 *
 * La quota non divide quasi mai: `round2(1000/12) * 12` fa 999,96. Spalmare
 * l'avanzo sull'ultimo mese è l'unico modo perché i ricavi su cui il motore
 * calcola siano quelli scritti nel campo — e la griglia lo verifica, perché
 * quattro centesimi persi qui uscirebbero come un'imposta giusta su un
 * fatturato che nessuno ha digitato.
 */
export function dodicesimi(totale: number): number[] {
  const quota = round2(totale / 12);
  const primi = Array.from({ length: 11 }, () => quota);
  return [...primi, round2(totale - quota * 11)];
}

const giorno = (anno: number, mese: number) =>
  `${anno}-${String(mese).padStart(2, "0")}-15`;

/** Le impostazioni che il motore riceverà: predefinite dell'anno, più le risposte. */
export function impostazioniSimulate(ing: IngressoSimulatore): Impostazioni {
  const par = parametriDi(ANNO);
  const gruppo = par.gruppiAteco.find((g) => g.codice === ing.gruppoAteco) ?? par.gruppiAteco[0];
  return {
    ...impostazioniPredefinite(par),
    anno: ANNO,
    regime: ing.regime,
    gruppoAteco: gruppo.codice,
    coefficienteRedditivita: gruppo.coefficiente,
    gestione: ing.gestione,
    nuovaAttivita: ing.requisitiNuovaAttivita,
    /*
      Il 1° gennaio dell'anno dichiarato, non una data qualsiasi: il registro
      conta gli anni trascorsi dall'anno di apertura, e il giorno non entra nel
      conto. Scrivere «oggi» farebbe risultare nuova un'attività aperta da sei
      anni.
    */
    dataAperturaPiva: ing.annoAperturaPiva ? `${ing.annoAperturaPiva}-01-01` : null,
  };
}

function fattureSimulate(ing: IngressoSimulatore, imp: Impostazioni): Fattura[] {
  const aliquota = imp.regime === "forfettario" ? 0 : imp.aliquotaIva;
  return dodicesimi(ing.ricavi).map((imponibile, i) => ({
    id: `sim-f-${i + 1}`,
    dataEmissione: giorno(ANNO, i + 1),
    numero: String(i + 1),
    clienteId: "sim-cliente",
    descrizione: "Simulazione",
    tipoRicavo: "progetto" as const,
    imponibile,
    aliquotaIva: aliquota,
    /*
      Emessa e incassata lo stesso giorno. Il prospetto lavora per cassa: una
      fattura non incassata non è reddito, e distribuire incassi «realistici»
      a due mesi di distanza farebbe uscire dalla simulazione un imponibile
      diverso da quello digitato, con l'ultimo mese che scivola nell'anno dopo.
      Chi chiede «se fatturo 40.000» sta chiedendo di 40.000 incassati.
    */
    dataIncasso: giorno(ANNO, i + 1),
  }));
}

function costiSimulati(ing: IngressoSimulatore, imp: Impostazioni): Costo[] {
  if (ing.costiAnnui <= 0) return [];
  return dodicesimi(ing.costiAnnui).map((imponibile, i) => ({
    id: `sim-c-${i + 1}`,
    dataDocumento: giorno(ANNO, i + 1),
    fornitore: "Simulazione",
    categoria: "Altro",
    descrizione: "Simulazione",
    natura: "variabile" as const,
    imponibile,
    aliquotaIva: imp.aliquotaIva,
    /*
      Una frazione, non una percentuale: il campo si chiama «percentuale» e
      vale 1 per «tutto». Scritto 100 — che è quello che il nome suggerisce —
      il motore deduceva cento volte i costi, e il prospetto usciva
      impeccabile e falso. Se ne è accorta la griglia, non lo schermo.
    */
    percentualeDeducibilita: 1,
    dataPagamento: giorno(ANNO, i + 1),
  }));
}

/**
 * Le righe del prospetto che il simulatore mostra, e l'ordine in cui le mostra.
 *
 * Arrivano da `prospettoDettagliato`, cioè dalla stessa funzione che le scrive
 * dentro l'applicazione e nell'esportazione per il commercialista. La nota
 * «da dove viene il numero» è il campo `formula` di quella riga: non è un testo
 * scritto per questa pagina, è la formula applicata a questi numeri. Riscriverla
 * qui sarebbe stata la seconda copia che diverge.
 *
 * Un id che sparisse da `spiegazioni.ts` farebbe sparire la riga in silenzio, e
 * la pagina resterebbe bella e monca: lo tiene `simulatore.test.ts`, su tutte
 * e quattro le gestioni.
 */
const RIGA_CONTRIBUTI: Record<Gestione, string> = {
  separata: "gestione-separata",
  artigiani: "artigiani",
  commercianti: "artigiani",
  cassa: "cassa",
};

/**
 * Gli id dipendono dalla gestione, e non potrebbero non dipenderne.
 *
 * La riga che spiega i contributi si chiama `gestione-separata` per un
 * professionista senza albo, `artigiani` per un artigiano **e per un
 * commerciante**, `cassa` per chi ha un albo. La prima stesura chiedeva
 * `totale-contributi`, che esiste sempre: il numero c'era, giusto, e non
 * portava con sé nessuna spiegazione — perché è una riga di totale. Sarebbe
 * stata l'unica voce muta in una pagina che si chiama «da dove viene».
 */
const RIGHE_IMPOSTE: Record<Regime, string[]> = {
  /*
    Nel forfettario l'imposta è una sola riga e una moltiplicazione. Nell'ordinario
    sono tre tributi con tre basi diverse, e il totale da solo non dice niente a
    chi si chiede perché paghi così tanto.

    Non si chiede `totale-imposte`, che pure esisterebbe sempre: è una riga di
    **totale**, e le righe di totale non portano formula. Il numero sarebbe
    uscito giusto e muto, in una pagina intitolata «da dove viene». Se n'è
    accorta la griglia, non lo schermo — a schermo si vedeva una cifra
    perfettamente formattata.
  */
  forfettario: ["sostitutiva"],
  ordinario: ["irpef-lorda", "add-regionale", "add-comunale"],
};

export function righeMostrate(gestione: Gestione, regime: Regime): string[] {
  return [
    "reddito-lordo",
    RIGA_CONTRIBUTI[gestione],
    "imponibile",
    ...RIGHE_IMPOSTE[regime],
  ];
}

export type EsitoSimulazione = {
  ingresso: IngressoSimulatore;
  impostazioni: Impostazioni;
  prospetto: Prospetto;
  iva: LiquidazioneIva;
  scadenze: Adempimento[];
  confronto: Confronto;
};

/**
 * La simulazione intera, da tre risposte.
 *
 * `oggi` è il 31 dicembre dell'anno simulato e non la data vera: il prospetto
 * marca in ritardo le scadenze passate, e su una pagina pubblica aperta a
 * settembre uscirebbe un simulatore che dice «scaduto» a chi non ha ancora
 * aperto la partita IVA.
 */
export function simula(ing: IngressoSimulatore): EsitoSimulazione {
  const par = parametriDi(ANNO);
  const impostazioni = impostazioniSimulate(ing);
  const fatture = fattureSimulate(ing, impostazioni);
  const costi = costiSimulati(ing, impostazioni);

  const prospetto = calcolaProspetto({
    impostazioni,
    parametri: par,
    fatture,
    costi,
    oggi: `${ANNO}-12-31`,
  });
  const iva = calcolaIva(prospetto.fattureCalcolate, prospetto.costiCalcolati, impostazioni, par);

  return {
    ingresso: ing,
    impostazioni,
    prospetto,
    iva,
    scadenze: scadenzeAnno(impostazioni, par, prospetto, iva),
    confronto: confrontaRegimi(ingressoDaProspetto(prospetto), impostazioni, par),
  };
}
