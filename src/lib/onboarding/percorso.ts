/**
 * Il percorso di configurazione, scritto una volta sola.
 *
 * Sono tre momenti diversi della stessa conversazione:
 *
 * — **primo avvio**: l'app è vuota e non sa niente di chi la usa;
 * — **apertura di gennaio**: l'anno precedente è chiuso e il nuovo va aperto,
 *   confermando i riporti che arrivano dalla chiusura;
 * — **cambio di regime**: la soglia è stata superata e dal 1° gennaio cambiano
 *   la fattura e il calcolo.
 *
 * Le domande sono le stesse, cambia il contorno. Scriverle tre volte
 * significherebbe che fra sei mesi ne esistono tre versioni divergenti, e che
 * la spiegazione del coefficiente di redditività è aggiornata solo in una.
 *
 * Modulo puro: niente React, niente database. Qui vivono l'ordine dei passi,
 * la loro applicabilità, il default dichiarato di ciascuno e la frase che
 * spiega cosa cambia nei calcoli. I controlli stanno nella schermata.
 */
import { aliquota, euro, interoIt, percentuale } from "@/lib/format";
import { aliquotaSostitutivaEffettiva } from "@/lib/fisco/impostazioni";
import type { Prospetto } from "@/lib/fisco/motore";
import type { Impostazioni, ParametriAnno } from "@/lib/fisco/tipi";

export type ContestoPercorso = "primoAvvio" | "aperturaAnno" | "cambioRegime";

export const CONTESTI: ContestoPercorso[] = ["primoAvvio", "aperturaAnno", "cambioRegime"];

export const NOME_CONTESTO: Record<ContestoPercorso, string> = {
  primoAvvio: "Primo avvio",
  aperturaAnno: "Apertura d'anno",
  cambioRegime: "Cambio di regime",
};

export const DESCRIZIONE_CONTESTO: Record<ContestoPercorso, string> = {
  primoAvvio:
    "L'app non sa ancora niente di te. Poche domande per far tornare i numeri, e puoi saltarne quante vuoi.",
  aperturaAnno:
    "L'anno precedente è chiuso. Prima si confermano i riporti che arrivano da lì, poi si rivede la configurazione: le regole cambiano ogni gennaio.",
  cambioRegime:
    "Cambia il regime, e cambiano la fattura e il calcolo. Prima il confronto sui tuoi numeri, poi le impostazioni che ne conseguono.",
};

/**
 * Dove porta il percorso, in una frase.
 *
 * Sta prima delle domande perché è la cosa che manca a chi comincia: otto
 * caselle da riempire senza sapere a cosa servono si compilano a caso, e la
 * prima impressione dell'app è di un modulo da ufficio.
 */
export const META_CONTESTO: Record<ContestoPercorso, string> = {
  primoAvvio:
    "Alla fine l'app saprà calcolare le tue imposte e i tuoi contributi, dirti quanto accantonare su ogni incasso e quali fatture sono in ritardo. Sono le risposte che non può indovinare da sola.",
  aperturaAnno:
    "Alla fine il nuovo anno sarà aperto con i numeri veri di quello chiuso — cassa, accantonato, credito IVA — e con le regole aggiornate al gennaio in corso.",
  cambioRegime:
    "Alla fine saprai cosa cambia nelle tue fatture e nei tuoi conti, e l'app sarà configurata per il regime nuovo dal primo documento che emetti.",
};

/**
 * Quanto ci vuole, detto per difetto di poco.
 *
 * Una domanda si legge e si risponde in poco meno di un minuto; quelle di sola
 * lettura si guardano e basta. Serve a far decidere se cominciare adesso o
 * dopo: senza, si comincia e si abbandona a metà.
 */
export function durataStimata(passi: readonly Passo[]): string {
  const minuti = Math.max(2, Math.round(passi.length * 0.75));
  return `circa ${minuti} minuti`;
}

/** Il contesto di calcolo che i passi usano per dire cosa cambia davvero. */
export type ContestoCalcolo = {
  impostazioni: Impostazioni;
  parametri: ParametriAnno;
  prospetto: Prospetto;
};

export type Passo = {
  id: string;
  /** Titolo breve, per l'indice laterale. */
  titolo: string;
  /** La domanda, in seconda persona. */
  domanda: string;
  /**
   * Perché la domanda esiste. Non una nota d'aiuto generica: cosa muove nei
   * calcoli, detto a chi non sa cosa sia un coefficiente di redditività.
   */
  perche: string;
  /** Cosa resta impostato se il passo si salta. Sempre un valore dichiarato. */
  seSalti: (c: ContestoCalcolo) => string;
  /** L'effetto sui numeri reali di chi sta rispondendo, quando è calcolabile. */
  effetto?: (c: ContestoCalcolo) => string | null;
  /**
   * Cosa sa fare l'app dopo questa risposta.
   *
   * Otto domande di fila senza sapere dove si va a parare si rispondono a
   * vuoto: si compila e basta. Questa frase compare a risposta data, e resta
   * lì: scorrendo il percorso si vede cosa si è già sbloccato.
   */
  sblocca: string;
  contesti: ContestoPercorso[];
  ordine: number;
  /** Il passo ha senso solo in certe configurazioni. */
  visibile?: (c: ContestoCalcolo) => boolean;
  /**
   * Il passo non scrive impostazioni: conferma qualcosa (i riporti, il
   * confronto). Serve a distinguere le domande dalle schermate di lettura.
   */
  soloLettura?: boolean;
};

const forfettario = (c: ContestoCalcolo) => c.impostazioni.regime === "forfettario";
const ordinario = (c: ContestoCalcolo) => c.impostazioni.regime === "ordinario";

/**
 * I passi, in un elenco solo.
 *
 * `contesti` decide dove compare ciascuno, `ordine` in che posizione. I due
 * passi di sola lettura stanno in testa perché sono il motivo per cui il
 * percorso è partito: prima si guarda cosa è successo, poi si configura.
 */
export const PASSI: Passo[] = [
  {
    id: "riporti",
    titolo: "Riporti dall'anno chiuso",
    domanda: "Questo è quello che arriva dall'anno precedente. Confermi voce per voce?",
    perche:
      "Il 31 dicembre non azzera niente: saldo di cassa, tasse già accantonate, credito IVA e crediti d'imposta attraversano il confine. Confermarli uno per uno serve a dire «li ho guardati», perché se uno di questi è sbagliato l'anno nuovo parte sbagliato senza segnalare nulla.",
    seSalti: () =>
      "I riporti restano quelli calcolati dalla chiusura: saltare non li cambia, toglie solo la conferma.",
    sblocca:
      "Ora il nuovo anno apre con i numeri veri dell'anno chiuso, non da zero.",
    contesti: ["aperturaAnno"],
    ordine: 0,
    soloLettura: true,
  },
  {
    id: "confronto",
    titolo: "Cosa cambia davvero",
    domanda: "Ecco i due regimi sui tuoi numeri. Guarda la differenza prima di procedere.",
    perche:
      "Il cambio di regime non è una casella: cambia l'IVA in fattura, la deducibilità dei costi, l'imposta che paghi e la ritenuta che subisci. Il confronto è calcolato sui ricavi e sui costi che hai davvero registrato, non su un esempio.",
    seSalti: () => "Il confronto è solo da leggere: saltarlo non cambia nessuna impostazione.",
    sblocca:
      "Ora sai cosa cambia in fattura e quanto ti costa il passaggio.",
    contesti: ["cambioRegime"],
    ordine: 0,
    soloLettura: true,
  },
  {
    id: "regime",
    titolo: "Regime fiscale",
    domanda: "In che regime lavori?",
    perche:
      "È la scelta da cui discende tutto il resto. Nel forfettario il reddito si calcola applicando una percentuale fissa ai ricavi, si paga un'imposta unica al posto dell'IRPEF, non si addebita IVA in fattura e i costi non si deducono. Nell'ordinario i costi si deducono uno per uno, l'IVA si addebita e si detrae, e l'imposta è l'IRPEF a scaglioni.",
    seSalti: (c) => `Resta ${c.impostazioni.regime}, come è impostato adesso.`,
    effetto: (c) =>
      c.prospetto.ricaviRilevanti > 0
        ? `Sui tuoi ${euro(c.prospetto.ricaviRilevanti)} di ricavi incassati il carico attuale è ${euro(c.prospetto.caricoTotale)}, cioè il ${percentuale(c.prospetto.pressione)} di ogni euro.`
        : null,
    sblocca:
      "Ora l'app sa quale imposta calcolarti e se i tuoi costi si deducono.",
    contesti: CONTESTI,
    ordine: 10,
  },
  {
    id: "ateco",
    titolo: "Attività e coefficiente",
    domanda: "Che tipo di attività svolgi?",
    perche:
      "Nel forfettario non si tiene la contabilità dei costi: lo Stato presume quanto costi svolgere la tua attività, e tassa solo la parte restante. Quella parte è il coefficiente di redditività, e dipende dal codice ATECO. Un consulente ha il 78 %, un commerciante al dettaglio il 40 %: significa che a parità di incassi il commerciante paga su molto meno.",
    seSalti: (c) =>
      `Resta il ${aliquota(c.impostazioni.coefficienteRedditivita)}, il coefficiente delle attività professionali.`,
    effetto: (c) => {
      const ricavi = c.prospetto.ricaviRilevanti;
      if (ricavi <= 0) return null;
      const attuale = ricavi * c.impostazioni.coefficienteRedditivita;
      return `Con ${euro(ricavi)} di ricavi, il ${aliquota(c.impostazioni.coefficienteRedditivita)} fa ${euro(attuale)} di reddito lordo. Con il ${aliquota(0.4)} ne farebbe ${euro(ricavi * 0.4)}.`;
    },
    sblocca:
      "Ora sa quanta parte dei tuoi incassi è reddito tassabile.",
    contesti: CONTESTI,
    ordine: 20,
    visibile: forfettario,
  },
  {
    id: "sostitutiva",
    titolo: "Imposta sostitutiva",
    domanda: "La tua è un'attività nuova ai fini dell'agevolazione?",
    perche:
      "Nel forfettario si paga un'imposta unica al posto di IRPEF e addizionali. L'aliquota ordinaria è il 15 %, ma per i primi cinque anni di una attività davvero nuova scende al 5 %. Da quanto hai aperto lo sa già l'app, che ha la data della partita IVA e conta da sola: quello che non può sapere è se «nuova» vale nel senso della norma — non aver svolto la stessa attività nei tre anni precedenti, non proseguire quella di qualcun altro.",
    seSalti: (c) =>
      `Resta ${aliquota(aliquotaSostitutivaEffettiva(c.impostazioni, c.parametri).aliquota)}: senza la dichiarazione dei requisiti l'agevolazione non si applica.`,
    effetto: (c) => {
      const imponibile = c.prospetto.imponibile;
      if (imponibile <= 0) return null;
      return `${aliquotaSostitutivaEffettiva(c.impostazioni, c.parametri).motivo} Sul tuo imponibile di ${euro(imponibile)} fa ${euro(imponibile * aliquotaSostitutivaEffettiva(c.impostazioni, c.parametri).aliquota)}.`;
    },
    sblocca:
      "Ora sa con quale aliquota calcolare l'imposta che pagherai.",
    contesti: CONTESTI,
    ordine: 30,
    visibile: forfettario,
  },
  {
    id: "gestione",
    titolo: "Cassa previdenziale",
    domanda: "Dove versi i contributi?",
    perche:
      "I contributi pesano quanto le imposte, spesso di più, e si calcolano in modi diversi. Nella Gestione Separata INPS sono una percentuale del reddito, senza minimo: se guadagni poco versi poco. Artigiani e commercianti hanno un contributo fisso dovuto comunque, più una percentuale sulla parte di reddito eccedente il minimale — e sono due gestioni diverse: i commercianti versano lo 0,48 % in più per l'indennizzo di cessazione. Le casse professionali hanno regole proprie e un contributo integrativo che si addebita in fattura e non fa reddito.",
    seSalti: (c) => `Resta ${nomeGestione(c.impostazioni.gestione)}.`,
    effetto: (c) =>
      c.prospetto.redditoLordo > 0
        ? `Sul tuo reddito lordo di ${euro(c.prospetto.redditoLordo)} i contributi sono ${euro(c.prospetto.totaleContributi)}.`
        : null,
    sblocca:
      "Ora sa calcolare i tuoi contributi e metterli nello scadenzario.",
    contesti: CONTESTI,
    ordine: 40,
  },
  {
    id: "iva",
    titolo: "Periodicità IVA",
    domanda: "Liquidi l'IVA ogni mese o ogni trimestre?",
    perche:
      "Cambia quando l'IVA esce dal conto, non quanta ne paghi. Con la liquidazione trimestrale si versa quattro volte l'anno invece di dodici, ma sui primi tre trimestri si aggiunge l'1 % di maggiorazione. Il quarto trimestre confluisce nella dichiarazione annuale e la maggiorazione non si applica.",
    seSalti: (c) =>
      `Resta la liquidazione ${c.impostazioni.periodicitaIva}, con ${c.impostazioni.periodicitaIva === "trimestrale" ? "quattro scadenze" : "dodici scadenze"} l'anno.`,
    sblocca:
      "Ora sa quando scade la tua IVA e quanto versare a ogni liquidazione.",
    contesti: CONTESTI,
    ordine: 50,
    visibile: ordinario,
  },
  {
    id: "ritenutaRivalsa",
    titolo: "Ritenuta e rivalsa",
    domanda: "Applichi la rivalsa previdenziale? Subisci la ritenuta d'acconto?",
    perche:
      "Sono le due voci che rendono l'incasso diverso dall'imponibile. La rivalsa del 4 % si addebita al cliente per recuperare parte dei contributi: aumenta la fattura e concorre a formare il reddito. La ritenuta d'acconto del 20 % la trattiene il cliente quando è un'impresa o un professionista: incassi meno oggi, ma è un anticipo delle tue imposte e a fine anno si scomputa. Nel forfettario la ritenuta non si applica mai.",
    seSalti: (c) =>
      `Restano ${c.impostazioni.rivalsaAttiva ? "rivalsa attiva" : "rivalsa disattivata"} e ${c.impostazioni.ritenutaAttiva ? "ritenuta attiva" : "ritenuta disattivata"}.`,
    effetto: (c) =>
      c.prospetto.ritenuteSubite > 0
        ? `Quest'anno hai subito ${euro(c.prospetto.ritenuteSubite)} di ritenute: si scomputano dalle imposte dovute.`
        : null,
    sblocca:
      "Ora sa quanto ti arriva davvero in banca su ogni fattura.",
    contesti: CONTESTI,
    ordine: 60,
  },
  {
    id: "pagamenti",
    titolo: "Termini di pagamento",
    domanda: "Entro quanti giorni ti pagano i clienti?",
    perche:
      "Serve a calcolare la scadenza di ogni fattura e quindi a sapere cosa è in ritardo. Non tocca le imposte: quelle seguono l'incasso, non la scadenza. Tocca il cashflow e l'elenco delle fatture da sollecitare, che è dove si perde più denaro.",
    seSalti: (c) => `Restano ${interoIt.format(c.impostazioni.terminiPagamento)} giorni dall'emissione.`,
    effetto: (c) => {
      const scadute = c.prospetto.fattureCalcolate.filter((f) => f.stato === "scaduto");
      if (scadute.length === 0) return null;
      return `Con i termini attuali risultano ${interoIt.format(scadute.length)} fatture scadute.`;
    },
    sblocca:
      "Ora sa dirti quali fatture sono in ritardo e di quanti giorni.",
    contesti: CONTESTI,
    ordine: 70,
  },
  {
    id: "obiettivi",
    titolo: "Obiettivi e accantonamento",
    domanda: "Quanto vuoi in tasca ogni anno, e quanto metti da parte per le tasse?",
    perche:
      "La percentuale di accantonamento è la differenza fra sentirsi ricchi a maggio e non riuscire a versare a giugno: è la quota di ogni incasso che l'app considera già impegnata e sottrae dalla liquidità disponibile. Il netto desiderato serve alla pianificazione, che lo trasforma in fatturato da produrre e clienti da trovare.",
    seSalti: (c) =>
      `Resta il ${aliquota(c.impostazioni.percentualeAccantonamento)} di accantonamento su ogni incasso.`,
    effetto: (c) =>
      c.prospetto.ricaviRilevanti > 0
        ? `La tua pressione effettiva è ${percentuale(c.prospetto.pressione)}: accantonare meno di così significa arrivare corti a giugno.`
        : null,
    sblocca:
      "Ora sa quanto accantonare su ogni incasso perché a giugno i soldi ci siano.",
    contesti: CONTESTI,
    ordine: 80,
  },
  {
    // L'identificativo era «demo» quando il passo offriva solo il dataset
    // dimostrativo. Ora sono due strade, e chi aveva già risposto se lo ritrova
    // da rispondere una volta: nient'altro va perso.
    id: "partenza",
    titolo: "Da dove partiamo",
    domanda: "Vuoi vedere l'app con dei dati dentro, o caricare subito il tuo storico?",
    perche:
      "Un'app di contabilità vuota non si capisce: tutte le schermate mostrano zeri e non si vede a cosa servano. Ma chi arriva a metà anno lo storico ce l'ha già, e non ha bisogno di un esempio: ha bisogno di vedere i propri numeri. Sono due strade diverse e nessuna delle due è quella giusta per tutti.",
    seSalti: () =>
      "L'archivio resta vuoto e si parte dalla prima fattura vera. Sia il dataset dimostrativo sia l'import CSV restano disponibili dopo, da Dati e backup e da Importa.",
    sblocca:
      "Ora l'app è configurata: da qui in poi lavora sui numeri, non sulle ipotesi.",
    contesti: ["primoAvvio"],
    ordine: 90,
  },
];

function nomeGestione(g: Impostazioni["gestione"]): string {
  if (g === "separata") return "la Gestione Separata INPS";
  if (g === "artigiani") return "la gestione artigiani";
  if (g === "commercianti") return "la gestione commercianti";
  return "una cassa professionale";
}

/** I passi di un contesto, nell'ordine, già filtrati su cosa ha senso mostrare. */
export function passiDi(contesto: ContestoPercorso, c: ContestoCalcolo): Passo[] {
  return PASSI.filter((p) => p.contesti.includes(contesto))
    .filter((p) => (p.visibile ? p.visibile(c) : true))
    .sort((a, b) => a.ordine - b.ordine);
}

// ————————————————————————————————————————————————————————————
// Stato del percorso
// ————————————————————————————————————————————————————————————

/**
 * L'avanzamento, persistito.
 *
 * Non è stato di interfaccia: cambia quello che l'app mostra. Un valore
 * confermato e un valore mai toccato sono lo stesso numero, ma il secondo va
 * dichiarato come predefinito invece di essere spacciato per una scelta.
 */
export type StatoPercorso = {
  /** `${contesto}:${anno}`. */
  id: string;
  contesto: ContestoPercorso;
  anno: number;
  /** Passi a cui l'utente ha risposto. */
  confermati: string[];
  /** Passi saltati per scelta: restano al default dichiarato. */
  saltati: string[];
  completatoIl: string | null;
  aggiornatoIl: string;
};

export function chiavePercorso(contesto: ContestoPercorso, anno: number): string {
  return `${contesto}:${anno}`;
}

export function percorsoVuoto(contesto: ContestoPercorso, anno: number, adesso: string): StatoPercorso {
  return {
    id: chiavePercorso(contesto, anno),
    contesto,
    anno,
    confermati: [],
    saltati: [],
    completatoIl: null,
    aggiornatoIl: adesso,
  };
}

export type StatoPasso = "daFare" | "confermato" | "saltato";

export function statoDelPasso(stato: StatoPercorso | null, passo: string): StatoPasso {
  if (!stato) return "daFare";
  if (stato.confermati.includes(passo)) return "confermato";
  if (stato.saltati.includes(passo)) return "saltato";
  return "daFare";
}

export type Avanzamento = {
  totale: number;
  confermati: number;
  saltati: number;
  daFare: number;
  /** Il primo passo non ancora affrontato: è da lì che si riprende. */
  prossimo: Passo | null;
  completo: boolean;
};

export function avanzamento(
  passi: Passo[],
  stato: StatoPercorso | null,
): Avanzamento {
  const confermati = passi.filter((p) => statoDelPasso(stato, p.id) === "confermato").length;
  const saltati = passi.filter((p) => statoDelPasso(stato, p.id) === "saltato").length;
  const prossimo = passi.find((p) => statoDelPasso(stato, p.id) === "daFare") ?? null;
  return {
    totale: passi.length,
    confermati,
    saltati,
    daFare: passi.length - confermati - saltati,
    prossimo,
    completo: prossimo === null,
  };
}

// ————————————————————————————————————————————————————————————
// Quale percorso proporre
// ————————————————————————————————————————————————————————————

export type SituazioneApp = {
  anno: number;
  archivioVuoto: boolean;
  /** L'anno precedente risulta chiuso. */
  precedenteChiuso: boolean;
  /** La chiusura dell'anno precedente propone un cambio di regime. */
  cambioRegimeProposto: boolean;
  /** I percorsi già completati, per chiave. */
  completati: string[];
};

export type Suggerimento = {
  contesto: ContestoPercorso | null;
  motivo: string;
};

/**
 * Il contesto da proporre, dedotto dallo stato dell'app.
 *
 * L'ordine non è arbitrario: un archivio vuoto batte tutto, perché senza
 * configurazione di base gli altri due percorsi non hanno su cosa poggiare. Il
 * cambio di regime viene prima dell'apertura d'anno perché è la notizia: chi
 * apre gennaio dopo aver sforato la soglia deve saperlo subito.
 */
export function contestoSuggerito(s: SituazioneApp): Suggerimento {
  const fatto = (contesto: ContestoPercorso) => s.completati.includes(chiavePercorso(contesto, s.anno));

  if (s.archivioVuoto && !fatto("primoAvvio")) {
    return {
      contesto: "primoAvvio",
      motivo: "L'archivio è vuoto: si comincia dalla configurazione di base.",
    };
  }
  if (s.cambioRegimeProposto && !fatto("cambioRegime")) {
    return {
      contesto: "cambioRegime",
      motivo: `La chiusura del ${s.anno - 1} ha rilevato un cambio di regime per il ${s.anno}.`,
    };
  }
  if (s.precedenteChiuso && !fatto("aperturaAnno")) {
    return {
      contesto: "aperturaAnno",
      motivo: `Il ${s.anno - 1} è chiuso: il ${s.anno} va aperto confermando i riporti.`,
    };
  }
  return {
    contesto: null,
    motivo: `Per il ${s.anno} non c'è niente in sospeso. Puoi comunque ripercorrere la configurazione quando vuoi.`,
  };
}
