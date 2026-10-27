/**
 * Il concordato preventivo biennale: le regole, in un posto solo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Che cos'è, in una riga
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Chi aderisce paga IRPEF e addizionali su un reddito **concordato** con
 * l'Agenzia per due anni, invece che su quello effettivo. Se guadagna di più,
 * l'eccedenza non è tassata; se guadagna di meno, paga lo stesso su quello
 * concordato. L'IVA non c'entra e non cambia.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché un file a sé, e perché tutte le costanti stanno qui
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le costanti del concordato non sono «parametri dell'anno»: non si rivalutano
 * a gennaio, valgono per **biennio** e alcune dipendono dalla data in cui si è
 * aderito. Metterle in `parametri/<anno>.ts` avrebbe voluto dire copiarle in
 * tre file e vederle divergere al primo ritocco.
 *
 * Stanno quindi in un oggetto solo, `REGOLE_CPB`, con la fonte accanto a
 * ciascuna, e `cpb.test.ts` le fissa una per una come fa `parametri.test.ts`
 * con le aliquote: un numero scritto storto qui produce un prospetto coerente
 * e falso, ed è l'unica famiglia di errori che un test sugli effetti non
 * prende.
 *
 * **Le fonti sono quelle del brief normativo di chi ha commissionato il
 * lavoro, e da questo ambiente non si sono potute aprire** (il proxy di rete
 * nega i siti istituzionali). Vanno rilette prima di fidarsi dei numeri: è
 * scritto anche in APPROSSIMAZIONI.md.
 */
import { nonNegativo, round2 } from "./aritmetica";
import type {
  BiennioCpb,
  Concordato,
  Gestione,
  Impostazioni,
  TipoAdesioneCpb,
} from "./tipi";

/**
 * Le regole, con la loro fonte.
 *
 * Un oggetto `as const` e non costanti sparse: l'elenco delle aliquote ISA e
 * il tetto si leggono insieme, e insieme vanno riletti il giorno in cui una
 * norma li tocca.
 */
export const REGOLE_CPB = {
  /**
   * I bienni per cui esiste una proposta, con il loro primo e ultimo anno.
   *
   * L'ordine conta: il primo anno è quello in cui si paga la maggiorazione
   * dell'acconto, e il biennio dice anche per quali anni il reddito concordato
   * è definito. Un anno fuori dal biennio non ha un concordato, e l'app non ne
   * inventa uno.
   */
  bienni: {
    "2024-2025": { primo: 2024, ultimo: 2025 },
    "2025-2026": { primo: 2025, ultimo: 2026 },
    "2026-2027": { primo: 2026, ultimo: 2027 },
  },

  /**
   * L'imposta sostitutiva sul maggior reddito concordato: tre aliquote, per
   * voto ISA dell'anno precedente al biennio (art. 20-bis D.Lgs. 13/2024).
   *
   * `da` è **inclusivo**: con un ISA esattamente 8 si applica il 10 %, con un
   * 6 il 12 %. I bordi non sono un dettaglio — sono il punto in cui due
   * letture della stessa norma danno due numeri diversi — e `cpb.test.ts` li
   * asserisce uno per uno.
   */
  aliquoteIsa: [
    { da: 8, aliquota: 0.1 },
    { da: 6, aliquota: 0.12 },
    { da: 0, aliquota: 0.15 },
  ],

  /** Il voto ISA è un numero da 1 a 10, decimali ammessi. Fuori: errore. */
  isaMinimo: 1,
  isaMassimo: 10,

  /**
   * Il tetto dell'aliquota agevolata: oltre, si applica l'aliquota massima
   * IRPEF (D.Lgs. 148/2026 secondo il brief).
   *
   * Non è una franchigia e non è uno scaglione dell'IRPEF: è una soglia sulla
   * **base** dell'imposta sostitutiva. Fino a 85.000 € di maggior reddito vale
   * l'aliquota del voto ISA, sull'eccedenza il 43 %.
   */
  tettoMaggiorReddito: 85_000,
  aliquotaOltreTetto: 0.43,

  /**
   * Chi ha aderito ai primi due bienni entro il 12 giugno 2025 il tetto non ce
   * l'ha: la norma che lo ha introdotto non li raggiunge.
   *
   * La data è un confine, quindi è inclusiva: aderito **il** 12 giugno 2025
   * vuol dire dentro.
   */
  tettoEsente: {
    bienni: ["2024-2025", "2025-2026"] as BiennioCpb[],
    entroIl: "2025-06-12",
  },

  /**
   * La maggiorazione della seconda rata di acconto, al primo anno di adesione
   * e con il metodo storico (art. 20 D.Lgs. 13/2024).
   *
   * Il 10 % della differenza **positiva** fra reddito concordato e reddito
   * dell'anno precedente rettificato. Differenza negativa: nessuna
   * maggiorazione, non un credito.
   */
  maggiorazioneAcconto: 0.1,

  /**
   * Lo scostamento oltre il quale l'app **segnala** una possibile causa di
   * cessazione (art. 21 D.Lgs. 13/2024, circostanze eccezionali).
   *
   * Segnala, non applica: la cessazione dipende da circostanze che l'app non
   * conosce, e ricalcolare da soli il prospetto su un'ipotesi del genere
   * vorrebbe dire decidere al posto del commercialista.
   */
  scostamentoDaSegnalare: 0.3,
} as const;

/** Il blocco come nasce: non aderito, e nessun numero inventato. */
export function concordatoPredefinito(anno?: number): Concordato {
  return {
    aderito: false,
    biennio: biennioPerAnno(anno),
    tipoAdesione: "primoIngresso",
    dataAdesione: null,
    redditoConcordato: null,
    redditoPrecedenteRettificato: null,
    votoIsa: null,
    sostitutiva: false,
  };
}

/**
 * Il biennio da proporre per un anno. Solo il valore iniziale: si cambia da
 * un menù, e il motore guarda quello scritto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché «quello che comincia qui» e non «il primo che contiene l'anno»
 * ─────────────────────────────────────────────────────────────────────────
 *
 * I bienni si sovrappongono: il 2026 sta dentro 2025-2026 **e** dentro
 * 2026-2027. La prima stesura prendeva il primo che lo conteneva, e per il
 * 2026 proponeva 2025-2026 — cioè il **secondo** anno di un biennio vecchio.
 * Conseguenza, vista nell'applicazione vera: la maggiorazione del 10 %
 * spariva, perché si paga solo al primo anno. Nessun errore, nessun avviso, un
 * acconto più basso del dovuto.
 *
 * Si preferisce quindi il biennio che **comincia** in quell'anno, che è anche
 * quello a cui si aderisce stando in quell'anno. Se nessuno comincia lì, vale
 * quello che lo contiene — il 2027 è il secondo anno di 2026-2027, e lì ci sta.
 */
export function biennioPerAnno(anno?: number): BiennioCpb {
  if (anno !== undefined) {
    for (const [nome, estremi] of elencoBienni()) {
      if (estremi.primo === anno) return nome;
    }
    for (const [nome, estremi] of elencoBienni()) {
      if (anno >= estremi.primo && anno <= estremi.ultimo) return nome;
    }
  }
  return "2026-2027";
}

/** I bienni in elenco, tipizzati: `Object.entries` da solo perde il tipo. */
export function elencoBienni(): [BiennioCpb, { primo: number; ultimo: number }][] {
  return Object.entries(REGOLE_CPB.bienni) as [BiennioCpb, { primo: number; ultimo: number }][];
}

/** Il blocco di un anno, anche quando l'archivio è più vecchio del blocco. */
export function concordatoDi(imp: Impostazioni): Concordato {
  return imp.concordato ?? concordatoPredefinito(imp.anno);
}

/**
 * L'aliquota dell'imposta sostitutiva per un voto ISA.
 *
 * `null` per un voto fuori scala: non è un valore da arrotondare al bordo più
 * vicino, è un dato sbagliato, e l'unica risposta onesta è non calcolare.
 */
export function aliquotaIsa(voto: number | null): number | null {
  if (voto === null || !Number.isFinite(voto)) return null;
  if (voto < REGOLE_CPB.isaMinimo || voto > REGOLE_CPB.isaMassimo) return null;
  for (const scaglione of REGOLE_CPB.aliquoteIsa) {
    if (voto >= scaglione.da) return scaglione.aliquota;
  }
  return null;
}

/** Il voto ISA è nella scala 1-10? */
export function votoIsaValido(voto: number | null): boolean {
  return aliquotaIsa(voto) !== null;
}

/** Il biennio copre l'anno d'imposta? */
export function biennioCopre(biennio: BiennioCpb, anno: number): boolean {
  const estremi = REGOLE_CPB.bienni[biennio];
  return anno >= estremi.primo && anno <= estremi.ultimo;
}

/** È il primo dei due anni del biennio? Solo lì si paga la maggiorazione. */
export function primoAnnoDelBiennio(biennio: BiennioCpb, anno: number): boolean {
  return REGOLE_CPB.bienni[biennio].primo === anno;
}

/**
 * Il tetto degli 85.000 € si applica?
 *
 * No a chi ha aderito ai primi due bienni entro il 12 giugno 2025. Una data
 * di adesione **mancante** non è una prova di averlo fatto prima: in quel caso
 * il tetto si applica, che è la lettura più cara delle due e l'unica prudente
 * su un numero che finisce in un prospetto.
 */
export function tettoSiApplica(c: Concordato): boolean {
  if (!REGOLE_CPB.tettoEsente.bienni.includes(c.biennio)) return true;
  if (!c.dataAdesione) return true;
  return c.dataAdesione > REGOLE_CPB.tettoEsente.entroIl;
}

/** Il maggior reddito concordato: la differenza, se positiva. */
export function maggiorRedditoConcordato(c: {
  redditoConcordato: number | null;
  redditoPrecedenteRettificato: number | null;
}): number {
  if (c.redditoConcordato === null) return 0;
  return round2(nonNegativo(c.redditoConcordato - (c.redditoPrecedenteRettificato ?? 0)));
}

/** Come si spezza il maggior reddito fra aliquota agevolata ed eccedenza. */
export type SostitutivaCpb = {
  /** La base: il maggior reddito concordato. */
  base: number;
  /** La parte che sconta l'aliquota del voto ISA. */
  quotaAgevolata: number;
  /** Quella oltre il tetto, al 43 %. */
  quotaOltreTetto: number;
  aliquota: number;
  tettoApplicato: boolean;
  imposta: number;
};

/**
 * L'imposta sostitutiva sul maggior reddito concordato.
 *
 * Due aliquote e non una: fino al tetto quella del voto ISA, sull'eccedenza il
 * 43 %. Scriverla come una moltiplicazione sola — la più naturale — su un
 * maggior reddito di 100.000 € sbaglia di 25.050 €, e sbaglia in difetto.
 */
export function impostaSostitutivaCpb(
  base: number,
  aliquota: number,
  tetto: boolean,
): SostitutivaCpb {
  const imponibile = nonNegativo(round2(base));
  const quotaAgevolata = tetto ? Math.min(imponibile, REGOLE_CPB.tettoMaggiorReddito) : imponibile;
  const quotaOltreTetto = round2(imponibile - quotaAgevolata);
  return {
    base: imponibile,
    quotaAgevolata: round2(quotaAgevolata),
    quotaOltreTetto,
    aliquota,
    tettoApplicato: tetto && quotaOltreTetto > 0,
    imposta: round2(quotaAgevolata * aliquota + quotaOltreTetto * REGOLE_CPB.aliquotaOltreTetto),
  };
}

/**
 * La maggiorazione del 10 % sulla seconda rata di acconto.
 *
 * Solo al **primo ingresso** e solo nel **primo anno del biennio**: chi
 * rinnova senza interruzione non la paga, perché l'acconto dell'anno prima era
 * già commisurato a un reddito concordato.
 */
export function maggiorazioneAccontoCpb(p: {
  tipoAdesione: TipoAdesioneCpb;
  biennio: BiennioCpb;
  anno: number;
  maggiorReddito: number;
}): number {
  if (p.tipoAdesione !== "primoIngresso") return 0;
  if (!primoAnnoDelBiennio(p.biennio, p.anno)) return 0;
  return round2(nonNegativo(p.maggiorReddito) * REGOLE_CPB.maggiorazioneAcconto);
}

/**
 * Su quale reddito si versano i contributi.
 *
 * Le casse professionali private restano sul reddito **effettivo**: il
 * concordato è un patto con l'Agenzia, e il regolamento di una cassa non lo
 * conosce. Le gestioni INPS seguono invece il concordato.
 *
 * Resta fuori la **facoltà** di versare sul reddito effettivo quando è più
 * alto: è una scelta di chi versa, l'app non la modella e lo dichiara in
 * APPROSSIMAZIONI.md.
 */
export function baseContributivaCpb(
  gestione: Gestione,
  concordato: number,
  effettivo: number,
): number {
  return gestione === "cassa" ? effettivo : concordato;
}

/** Che cosa il concordato non va bene, detto a chi guarda la schermata. */
export type AvvisoCpb = {
  codice: "isaFuoriScala" | "redditoMancante" | "biennioIncoerente" | "scostamentoOltreSoglia";
  /** Un avviso che impedisce il calcolo, o uno che lo accompagna. */
  bloccante: boolean;
  testo: string;
};

/**
 * Il concordato valutato per un anno: che cosa si applica, e che cosa no.
 *
 * `attivo` è l'unica cosa che il motore guarda. Gli avvisi non lo cambiano:
 * esistono perché un calcolo che non parte **deve dire perché**, e un calcolo
 * che parte può avere lo stesso qualcosa da far sapere — lo scostamento oltre
 * il 30 % non ferma niente, e va detto comunque.
 */
export type EsitoConcordato = {
  attivo: boolean;
  biennio: BiennioCpb;
  tipoAdesione: TipoAdesioneCpb;
  primoAnno: boolean;
  redditoConcordato: number;
  redditoPrecedenteRettificato: number;
  votoIsa: number | null;
  aliquotaIsa: number | null;
  sostitutivaRichiesta: boolean;
  /** L'opzione è richiesta **e** utilizzabile: senza un ISA valido non lo è. */
  sostitutivaApplicata: boolean;
  sostitutiva: SostitutivaCpb | null;
  maggiorReddito: number;
  maggiorazioneAcconto: number;
  avvisi: AvvisoCpb[];
};

/**
 * Legge il blocco e decide che cosa si applica a quest'anno.
 *
 * Non tocca nessun importo del prospetto: dice soltanto se il concordato vale,
 * con quali numeri e che cosa c'è da dire. Il motore fa il resto, e non ripete
 * nessuna di queste condizioni — erano quattro `if` in tre file, la prima
 * volta che li ho scritti.
 */
export function valutaConcordato(imp: Impostazioni, anno: number): EsitoConcordato | null {
  // Fuori dall'ordinario non esiste: dal 2025 i forfettari sono esclusi.
  if (imp.regime !== "ordinario") return null;
  const c = concordatoDi(imp);
  if (!c.aderito) return null;

  const avvisi: AvvisoCpb[] = [];
  const estremi = REGOLE_CPB.bienni[c.biennio];
  const copre = biennioCopre(c.biennio, anno);
  if (!copre) {
    avvisi.push({
      codice: "biennioIncoerente",
      bloccante: true,
      testo:
        `Il biennio ${c.biennio} copre il ${estremi.primo} e il ${estremi.ultimo}, non il ${anno}: `
        + "per quest'anno non c'è un reddito concordato, e il calcolo resta su quello effettivo. "
        + "Correggi il biennio, oppure togli l'adesione da quest'anno.",
    });
  }

  const isaValido = votoIsaValido(c.votoIsa);
  if (c.votoIsa !== null && !isaValido) {
    avvisi.push({
      codice: "isaFuoriScala",
      bloccante: false,
      testo:
        `Il voto ISA ${c.votoIsa} è fuori dalla scala da ${REGOLE_CPB.isaMinimo} a ${REGOLE_CPB.isaMassimo}: `
        + "senza un voto valido non si può scegliere l'aliquota dell'imposta sostitutiva, "
        + "e il reddito concordato va tutto a IRPEF ordinaria.",
    });
  }

  const redditoScritto = c.redditoConcordato;
  if (redditoScritto === null || !Number.isFinite(redditoScritto) || redditoScritto <= 0) {
    avvisi.push({
      codice: "redditoMancante",
      bloccante: true,
      testo:
        "Hai dichiarato di aver aderito al concordato ma il reddito concordato non c'è: "
        + "il calcolo continua sul reddito effettivo. Scrivilo come sta sulla proposta dell'Agenzia.",
    });
  }

  if (c.sostitutiva && !isaValido) {
    avvisi.push({
      codice: "isaFuoriScala",
      bloccante: false,
      testo:
        "Hai scelto l'imposta sostitutiva ma il voto ISA non è valido: l'opzione non si applica, "
        + "e il maggior reddito concordato va a IRPEF ordinaria e addizionali.",
    });
  }

  const attivo = avvisi.every((a) => !a.bloccante);
  const redditoConcordato = attivo ? round2(redditoScritto as number) : 0;
  const redditoPrecedente = round2(c.redditoPrecedenteRettificato ?? 0);
  const maggiorReddito = attivo
    ? maggiorRedditoConcordato({
        redditoConcordato,
        redditoPrecedenteRettificato: redditoPrecedente,
      })
    : 0;
  const aliquota = aliquotaIsa(c.votoIsa);
  const sostitutivaApplicata = attivo && c.sostitutiva && aliquota !== null && maggiorReddito > 0;

  return {
    attivo,
    biennio: c.biennio,
    tipoAdesione: c.tipoAdesione,
    primoAnno: primoAnnoDelBiennio(c.biennio, anno),
    redditoConcordato,
    redditoPrecedenteRettificato: redditoPrecedente,
    votoIsa: c.votoIsa,
    aliquotaIsa: aliquota,
    sostitutivaRichiesta: c.sostitutiva,
    sostitutivaApplicata,
    sostitutiva: sostitutivaApplicata
      ? impostaSostitutivaCpb(maggiorReddito, aliquota as number, tettoSiApplica(c))
      : null,
    maggiorReddito,
    maggiorazioneAcconto: attivo
      ? maggiorazioneAccontoCpb({
          tipoAdesione: c.tipoAdesione,
          biennio: c.biennio,
          anno,
          maggiorReddito,
        })
      : 0,
    avvisi,
  };
}

/**
 * Lo scostamento fra reddito effettivo e concordato, in frazione.
 *
 * Negativo quando l'effettivo è **sotto** il concordato, che è il verso che
 * conta: oltre il 30 % in meno può esserci una causa di cessazione, e l'app la
 * segnala senza applicarla.
 */
export function scostamentoDalConcordato(effettivo: number, concordato: number): number {
  if (concordato <= 0) return 0;
  return (effettivo - concordato) / concordato;
}

/** Lo scostamento è sotto il concordato di oltre il 30 %? */
export function scostamentoDaSegnalare(effettivo: number, concordato: number): boolean {
  if (concordato <= 0) return false;
  return scostamentoDalConcordato(effettivo, concordato) < -REGOLE_CPB.scostamentoDaSegnalare;
}

export const TESTO_SCOSTAMENTO =
  "Scostamento oltre il 30 %: in presenza di circostanze eccezionali potrebbe esserci una "
  + "causa di cessazione, parlane con il commercialista.";

export const TESTO_FORFETTARI =
  "Il concordato preventivo non è accessibile ai forfettari dal 2025";
