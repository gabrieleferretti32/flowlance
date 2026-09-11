/**
 * Il consenso ai cookie di statistica: cosa si ricorda, e per quanto.
 *
 * Modulo puro — nessun React, nessun `document` — così le regole che contano
 * si possono verificare senza montare niente. Quello che scrive nel browser
 * sta in fondo, in tre funzioni sole.
 *
 * Le regole non sono negoziabili e sono tre:
 *
 * 1. **Tutto spento finché non si dice di sì.** Non «si carica e poi rispetta
 *    la scelta»: lo script non viene proprio inserito nella pagina. È la
 *    differenza fra un consenso e una formalità, e si misura aprendo la rete
 *    del browser: prima di un sì non parte una richiesta.
 * 2. **Rifiutare costa quanto accettare.** Stesso posto, stessa dimensione,
 *    stessa evidenza. Una X che chiude senza scegliere vale rifiuto, perché
 *    chi chiude una finestra non sta acconsentendo a niente.
 * 3. **Si cambia idea quando si vuole**, dal piede di ogni pagina, e la
 *    domanda non torna prima di sei mesi.
 */

/** Le categorie che si possono accendere. I cookie tecnici non sono qui: non si scelgono. */
export type Categoria = "statistiche" | "registrazioni" | "pubblicita";

export type Consenso = Record<Categoria, boolean>;

export const CATEGORIE: {
  id: Categoria;
  titolo: string;
  /** Cosa fa, in una frase che non usa la parola «esperienza». */
  cosaFa: string;
  /** Chi la fa e per quanto tiene i dati: sta nel banner, non solo nella policy. */
  chi: string;
}[] = [
  {
    id: "statistiche",
    titolo: "Statistiche di visita",
    cosaFa:
      "Conta quante persone aprono il sito, da dove arrivano e quali pagine leggono. Serve a capire se quello che c'è scritto funziona.",
    chi: "Google Analytics 4 — Google Ireland Ltd. · fino a 14 mesi",
  },
  {
    id: "pubblicita",
    titolo: "Profilazione pubblicitaria",
    /*
      Detta per quello che è. «Migliorare gli annunci» sarebbe una perifrasi per
      la stessa cosa, e questo banner esiste perché la persona sappia a che cosa
      sta dicendo di sì — non perché la frase suoni meglio.

      Ed è una categoria a sé e non un'aggiunta alle statistiche: un consenso
      raccolto per contare le visite non copre la profilazione a fini
      pubblicitari, e riusarlo sarebbe esattamente la cosa che questo banner è
      stato costruito per non fare.
    */
    cosaFa:
      "Segnala a Meta quando arrivi da un annuncio e quando compri, per misurare la pubblicità e mostrarti annunci in base a quello che hai fatto qui. Non è attivo dentro l'applicazione.",
    chi: "Meta Pixel — Meta Platforms Ireland Ltd. · fino a 90 giorni",
  },
  {
    id: "registrazioni",
    titolo: "Registrazione della navigazione",
    cosaFa:
      "Registra i movimenti del mouse e i clic su queste pagine, in forma anonima, per vedere dove ci si ferma. Non è attivo dentro l'applicazione: non registra in alcun modo l'uso di Flowlance né i dati che vi inserisci.",
    chi: "Microsoft Clarity — Microsoft Ireland Operations Ltd. · fino a 12 mesi",
  },
];

export const NIENTE: Consenso = { statistiche: false, registrazioni: false, pubblicita: false };
export const TUTTO: Consenso = { statistiche: true, registrazioni: true, pubblicita: true };

/** Dove sta scritto, nel browser. */
export const CHIAVE = "flowlance:consenso-cookie";

/**
 * Quanto vale una risposta prima di richiedere.
 *
 * Sei mesi è il termine oltre il quale la domanda si può rifare. Sotto, il
 * banner non torna: ripresentarlo a ogni visita è il modo di far cliccare
 * «accetta» per levarselo di torno, che è un consenso che non vale niente.
 */
export const MESI_DI_VALIDITA = 6;

export type Scelta = {
  consenso: Consenso;
  /** Quando è stata data, in ISO. */
  il: string;
  /**
   * La versione delle categorie a cui la risposta si riferisce.
   *
   * Aggiungere una categoria domani rende vecchia ogni risposta data finora:
   * chi ha detto sì alle statistiche non ha detto sì a una cosa che ancora non
   * esisteva. Alzare questo numero rifà la domanda a tutti.
   */
  versione: number;
};

/*
  Da 1 a 2 l'11 settembre 2026, con l'arrivo della profilazione pubblicitaria.

  Alzare questo numero rifà la domanda a **tutti**, compreso chi aveva già
  risposto. È un costo — il banner riappare a chi l'aveva già chiuso — ed è il
  costo giusto: chi ha detto sì alle statistiche non ha detto sì a una cosa che
  quel giorno non esisteva, e far valere quel sì anche per la pubblicità
  sarebbe raccogliere un consenso per una finalità e usarlo per un'altra.
*/
export const VERSIONE = 2;

/** La risposta salvata è ancora buona, o la domanda va rifatta? */
export function ancoraValida(scelta: Scelta | null, adesso: Date): boolean {
  if (!scelta) return false;
  if (scelta.versione !== VERSIONE) return false;
  const data = new Date(scelta.il);
  if (Number.isNaN(data.getTime())) return false;
  const scadenza = new Date(data);
  scadenza.setMonth(scadenza.getMonth() + MESI_DI_VALIDITA);
  return adesso < scadenza;
}

/** Cosa vale davvero, adesso: una risposta scaduta o assente vale «niente acceso». */
export function consensoEffettivo(scelta: Scelta | null, adesso: Date): Consenso {
  return ancoraValida(scelta, adesso) ? scelta!.consenso : NIENTE;
}

export function nuovaScelta(consenso: Consenso, adesso: Date): Scelta {
  return { consenso, il: adesso.toISOString(), versione: VERSIONE };
}

// ————————————————————————————————————————————————————————————
// Quel poco che tocca il browser
// ————————————————————————————————————————————————————————————

export function leggiScelta(): Scelta | null {
  try {
    const grezzo = localStorage.getItem(CHIAVE);
    if (!grezzo) return null;
    const letto: unknown = JSON.parse(grezzo);
    if (typeof letto !== "object" || letto === null) return null;
    const s = letto as Partial<Scelta>;
    if (typeof s.il !== "string" || typeof s.versione !== "number") return null;
    if (typeof s.consenso !== "object" || s.consenso === null) return null;
    return {
      il: s.il,
      versione: s.versione,
      consenso: {
        statistiche: s.consenso.statistiche === true,
        registrazioni: s.consenso.registrazioni === true,
        pubblicita: s.consenso.pubblicita === true,
      },
    };
  } catch {
    // Memoria bloccata o valore illeggibile: vale «non ha mai risposto», che
    // tiene tutto spento. È la direzione giusta in cui sbagliare.
    return null;
  }
}

export function salvaScelta(scelta: Scelta): void {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(scelta));
  } catch {
    // Senza memoria la scelta vale per questa pagina e basta. Meglio che
    // impedire di scegliere.
  }
}

/** L'evento con cui il piede riapre il banner. */
export const EVENTO_PREFERENZE = "flowlance:preferenze-cookie";
