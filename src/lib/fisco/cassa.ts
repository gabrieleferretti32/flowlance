/**
 * La cassa professionale, configurabile: le regole, in un posto solo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Che cosa calcola, e che cosa non prova nemmeno a calcolare
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Chi è iscritto a una cassa privata — avvocati, ingegneri, architetti,
 * psicologi, geometri — non versa alla Gestione Separata INPS. Versa due
 * contributi, e sono due cose molto diverse:
 *
 * - il **soggettivo**, una percentuale del suo reddito, che paga lui. Se viene
 *   meno di un minimo annuo, paga il minimo;
 * - l'**integrativo**, una percentuale dei compensi fatturati, che addebita al
 *   cliente in fattura e gira alla cassa. **Non è suo reddito**: non entra nei
 *   compensi, non conta per la soglia del forfettario, non subisce ritenuta.
 *
 * Più, spesso, qualche **quota fissa** annua: la maternità, per esempio.
 *
 * Questo modulo non è il motore di nessuna cassa in particolare. Gli scaglioni
 * della Forense, le riduzioni per i primi anni di Inarcassa, i tetti di reddito
 * e le decine di regole particolari **non ci sono**: ci sono due aliquote, due
 * minimi e un importo fisso, scritti da chi li conosce. È dichiarato in
 * APPROSSIMAZIONI.md, e lo dice anche la schermata dove si compilano.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché un'aliquota vuota ferma il conto invece di valere zero
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Prima di questo modulo l'app teneva una media del 15 % per il soggettivo, e
 * la usava: un numero che non era di nessuno moltiplicato per un reddito vero
 * dà un contributo preciso e falso. Adesso un'aliquota non dichiarata vale
 * `null`, il contributo resta zero e la schermata dice perché — che è la sola
 * forma in cui uno zero non è una bugia.
 */
import { nonNegativo, round2 } from "./aritmetica";
import {
  gestioneNelTesto,
  nomeGestione,
  type Cassa,
  type Impostazioni,
} from "./tipi";

/** Una cassa non ancora configurata: nessuna aliquota, nessun minimo. */
export function cassaPredefinita(): Cassa {
  return {
    nome: "",
    aliquotaSoggettivo: null,
    minimoSoggettivo: 0,
    aliquotaIntegrativo: null,
    minimoIntegrativo: 0,
    contributiFissi: 0,
  };
}

/** Il blocco di un anno, anche quando l'archivio è più vecchio del blocco. */
export function cassaDi(imp: Impostazioni): Cassa {
  return imp.cassa ?? cassaPredefinita();
}

/** Si versa a una cassa privata, e non all'INPS? */
export function eCassa(imp: Impostazioni): boolean {
  return imp.gestione === "cassa";
}

/** Come si chiama, nelle schermate. Mai una riga vuota. */
export function nomeCassa(c: Cassa): string {
  const scritto = c.nome.trim();
  return scritto === "" ? "Cassa professionale" : scritto;
}

/**
 * Come si chiama la previdenza di questa configurazione, in un'etichetta.
 *
 * «Gestione Separata INPS», «Artigiani» — oppure, con una cassa, **il nome
 * della cassa**: «Cassa Forense», «Inarcassa». Il prospetto che va dal
 * commercialista, il cruscotto e la stampa dicono così la stessa cosa, e chi
 * legge riconosce la sua.
 *
 * Esiste perché lo stesso `switch` stava in tre file — qui, in `stampa.ts` e
 * in `percorso.ts` — e le tre copie sono il modo in cui due schermate finiscono
 * per chiamare la stessa cosa con due nomi diversi.
 */
export function nomePrevidenza(imp: Impostazioni): string {
  return eCassa(imp) ? nomeCassa(cassaDi(imp)) : nomeGestione(imp.gestione);
}

/** Lo stesso, dentro una frase: «versi a la Cassa Forense» non si dice. */
export function previdenzaNelTesto(imp: Impostazioni): string {
  return eCassa(imp) ? nomeCassa(cassaDi(imp)) : gestioneNelTesto(imp.gestione);
}

// ————————————————————————————————————————————————————————————
// Le validazioni
// ————————————————————————————————————————————————————————————

export type ErroreCassa = {
  campo: keyof Cassa;
  testo: string;
};

/** Un'aliquota sta fra 0 e 1 — cioè fra 0 % e 100 %. */
export function aliquotaValida(v: number | null): boolean {
  return v === null || (Number.isFinite(v) && v >= 0 && v <= 1);
}

/**
 * Che cosa, nel blocco, non è un numero accettabile.
 *
 * Due regole sole, e nessuna delle due è un'opinione: un'aliquota fuori da
 * 0-100 % è una cifra digitata male — il 160 % di chi scrive 16 nel campo
 * sbagliato — e un importo negativo è un contributo che la cassa ti restituisce.
 * Il resto (è *questa* la tua aliquota?) l'app non lo può sapere, e non finge.
 */
export function erroriCassa(c: Cassa): ErroreCassa[] {
  const errori: ErroreCassa[] = [];
  const aliquote: [keyof Cassa, number | null, string][] = [
    ["aliquotaSoggettivo", c.aliquotaSoggettivo, "soggettivo"],
    ["aliquotaIntegrativo", c.aliquotaIntegrativo, "integrativo"],
  ];
  for (const [campo, valore, nome] of aliquote) {
    if (!aliquotaValida(valore)) {
      errori.push({
        campo,
        testo: `L'aliquota del ${nome} sta fra 0 % e 100 %: controlla quello che hai scritto.`,
      });
    }
  }
  const importi: [keyof Cassa, number, string][] = [
    ["minimoSoggettivo", c.minimoSoggettivo, "minimo del soggettivo"],
    ["minimoIntegrativo", c.minimoIntegrativo, "minimo dell'integrativo"],
    ["contributiFissi", c.contributiFissi, "contributo fisso"],
  ];
  for (const [campo, valore, nome] of importi) {
    if (!Number.isFinite(valore) || valore < 0) {
      errori.push({ campo, testo: `Il ${nome} non può essere negativo.` });
    }
  }
  return errori;
}

// ————————————————————————————————————————————————————————————
// I due contributi
// ————————————————————————————————————————————————————————————

export type ContributoSoggettivo = {
  /** Aliquota per reddito, prima del confronto con il minimo. */
  calcolato: number;
  minimo: number;
  /** Quello che si versa davvero: il maggiore dei due. */
  applicato: number;
  /** Il minimo ha fatto da pavimento: sotto, si paga lui. */
  alMinimo: boolean;
};

/**
 * Il contributo soggettivo: aliquota per reddito, mai sotto il minimo.
 *
 * Il minimo è un **pavimento, non una franchigia**: chi ha un reddito basso lo
 * paga per intero, non la differenza. È la regola che quasi tutte le casse
 * applicano, ed è anche quella che rende il contributo di un anno magro molto
 * più alto di quanto una percentuale lascerebbe pensare.
 *
 * Senza aliquota dichiarata il contributo è **zero**, non una stima: vedi la
 * testa del file.
 */
export function contributoSoggettivo(reddito: number, c: Cassa): ContributoSoggettivo {
  const minimo = nonNegativo(round2(c.minimoSoggettivo));
  if (c.aliquotaSoggettivo === null || !Number.isFinite(c.aliquotaSoggettivo)) {
    return { calcolato: 0, minimo, applicato: 0, alMinimo: false };
  }
  const calcolato = round2(nonNegativo(reddito) * c.aliquotaSoggettivo);
  const applicato = Math.max(calcolato, minimo);
  return { calcolato, minimo, applicato, alMinimo: minimo > calcolato };
}

/**
 * L'integrativo su un imponibile fatturato.
 *
 * Zero senza aliquota: una fattura non porta un addebito che nessuno ha
 * dichiarato. Zero anche se la gestione non è una cassa — ma quella domanda la
 * fa chi chiama, perché qui arriva già il blocco giusto.
 */
export function integrativoSu(imponibile: number, c: Cassa): number {
  if (c.aliquotaIntegrativo === null || !Number.isFinite(c.aliquotaIntegrativo)) return 0;
  return round2(imponibile * c.aliquotaIntegrativo);
}

/** L'integrativo si addebita in fattura? Solo con una cassa e un'aliquota. */
export function addebitaIntegrativo(imp: Impostazioni): boolean {
  const c = cassaDi(imp);
  return eCassa(imp) && c.aliquotaIntegrativo !== null && c.aliquotaIntegrativo > 0;
}

export type IntegrativoAnnuo = {
  /** Quello addebitato in fattura nell'anno, al netto delle note di credito. */
  fatturato: number;
  minimo: number;
  /** Quello che la cassa vuole: il maggiore fra fatturato e minimo. */
  daVersare: number;
  /**
   * La differenza fra minimo e fatturato, quando il minimo non è coperto.
   *
   * È l'unica parte dell'integrativo che **costa** al professionista: tutto il
   * resto l'ha incassato dai clienti e lo gira. Si mostra come costo, e non si
   * deduce dal reddito — vedi APPROSSIMAZIONI.md, dove la deducibilità è fra le
   * cose da confermare col commercialista.
   */
  aCarico: number;
};

export function integrativoAnnuo(fatturato: number, c: Cassa): IntegrativoAnnuo {
  const netto = round2(nonNegativo(fatturato));
  const minimo = nonNegativo(round2(c.minimoIntegrativo));
  return {
    fatturato: netto,
    minimo,
    daVersare: Math.max(netto, minimo),
    aCarico: round2(nonNegativo(minimo - netto)),
  };
}

// ————————————————————————————————————————————————————————————
// Che cosa la cassa fa, in un anno
// ————————————————————————————————————————————————————————————

export type AvvisoCassa = {
  codice: "aliquotaMancante" | "integrativoMancante" | "datiNonValidi";
  testo: string;
};

export type EsitoCassa = {
  nome: string;
  /**
   * I numeri scritti sono accettabili: nessuna aliquota fuori da 0-100 %,
   * nessun importo negativo.
   *
   * Separato da `configurata` perché le due domande hanno risposte diverse e
   * conseguenze diverse. Un blocco **non valido** non calcola niente, nemmeno
   * l'integrativo: i dati sono da correggere. Un blocco **valido ma senza
   * aliquota soggettiva** è il caso di chi ha appena scelto la cassa: il
   * soggettivo è zero, ma l'integrativo, se l'aliquota c'è, si addebita.
   */
  valida: boolean;
  /** Una cassa configurata abbastanza da calcolare: c'è l'aliquota soggettiva. */
  configurata: boolean;
  soggettivo: ContributoSoggettivo;
  contributiFissi: number;
  /** Soggettivo più fissi: quello che pesa sul tuo reddito, ed è deducibile. */
  dovutoSulReddito: number;
  integrativo: IntegrativoAnnuo;
  avvisi: AvvisoCassa[];
};

/**
 * La cassa di un anno, con i numeri già fatti.
 *
 * `null` quando la gestione non è una cassa: non un oggetto di zeri, che a
 * schermo si distingue male da una cassa configurata male.
 *
 * `integrativoFatturato` arriva da chi ha in mano i documenti — il motore —
 * perché dipende da fatture e note di credito, e questo modulo non li conosce.
 */
export function valutaCassa(
  imp: Impostazioni,
  p: { redditoImponibile: number; integrativoFatturato?: number },
): EsitoCassa | null {
  if (!eCassa(imp)) return null;
  const c = cassaDi(imp);
  const avvisi: AvvisoCassa[] = [];

  const errori = erroriCassa(c);
  if (errori.length > 0) {
    avvisi.push({
      codice: "datiNonValidi",
      testo: `${errori.map((e) => e.testo).join(" ")} Finché non è corretto, i contributi restano a zero.`,
    });
  }
  const valida = errori.length === 0;
  const configurata = valida && c.aliquotaSoggettivo !== null;

  if (valida && c.aliquotaSoggettivo === null) {
    avvisi.push({
      codice: "aliquotaMancante",
      testo:
        "Hai scelto la cassa professionale ma l'aliquota del contributo soggettivo non c'è: "
        + "i contributi restano a zero. Scrivila nei Parametri, la trovi sul sito della tua cassa.",
    });
  }
  if (valida && configurata && c.aliquotaIntegrativo === null) {
    avvisi.push({
      codice: "integrativoMancante",
      testo:
        "L'aliquota del contributo integrativo non c'è: le fatture non lo addebitano, "
        + "e la rivalsa INPS non si applica a chi ha una cassa.",
    });
  }

  const vuota = configurata ? c : { ...c, aliquotaSoggettivo: null };
  const soggettivo = contributoSoggettivo(valida ? p.redditoImponibile : 0, valida ? vuota : cassaPredefinita());
  const fissi = valida ? nonNegativo(round2(c.contributiFissi)) : 0;
  const integrativo = integrativoAnnuo(
    valida ? (p.integrativoFatturato ?? 0) : 0,
    valida ? c : cassaPredefinita(),
  );

  return {
    nome: nomeCassa(c),
    valida,
    configurata,
    soggettivo,
    contributiFissi: fissi,
    dovutoSulReddito: round2(soggettivo.applicato + fissi),
    integrativo,
    avvisi,
  };
}
