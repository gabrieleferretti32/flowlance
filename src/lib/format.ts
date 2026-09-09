/**
 * Formattazione italiana. Ogni importo che l'utente legge passa da qui:
 * 1.234,56 €, mai €1,234.56.
 */
import { format as formatDate, parseISO } from "date-fns";
import { it } from "date-fns/locale";

/**
 * `useGrouping: "always"` non è un dettaglio: con l'impostazione predefinita
 * alcune versioni di ICU applicano il raggruppamento «min2» e scrivono
 * 1234,56 € invece di 1.234,56 €. Il risultato cambia fra il rendering sul
 * server e quello nel browser, e il prodotto mostra due forme diverse dello
 * stesso importo. Qui il raggruppamento è imposto ovunque.
 */
const OPZIONI_BASE = { useGrouping: "always" } as const;

const valuta = new Intl.NumberFormat("it-IT", {
  ...OPZIONI_BASE,
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const valutaCompatta = new Intl.NumberFormat("it-IT", {
  ...OPZIONI_BASE,
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numero = new Intl.NumberFormat("it-IT", {
  ...OPZIONI_BASE,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Intero con separatore di migliaia: 122.295. Usato anche dal motore fiscale. */
export const interoIt = new Intl.NumberFormat("it-IT", {
  ...OPZIONI_BASE,
  maximumFractionDigits: 0,
});

/** 1.234,56 € */
export function euro(valore: number | null | undefined): string {
  if (valore == null || !Number.isFinite(valore)) return "—";
  return valuta.format(valore);
}

/** 1.235 € — per i titoloni dove i centesimi sono rumore. */
export function euroTondo(valore: number | null | undefined): string {
  if (valore == null || !Number.isFinite(valore)) return "—";
  return valutaCompatta.format(valore);
}

/** 28,98 % — il valore in ingresso è una frazione (0,2898). */
export function percentuale(frazione: number | null | undefined, decimali = 2): string {
  if (frazione == null || !Number.isFinite(frazione)) return "—";
  return `${new Intl.NumberFormat("it-IT", {
    ...OPZIONI_BASE,
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  }).format(frazione * 100)} %`;
}

/**
 * L'aliquota come si dice parlando: «22 %», non «22,00 %».
 *
 * I decimali restano quando ci sono davvero — il 26,23 % della Gestione
 * Separata arrotondato a 26 % sarebbe un numero sbagliato detto bene. Serve
 * dentro le frasi, dove «78,00 %» si legge come un modulo; nelle tabelle di
 * numeri incolonnati resta `percentuale`, che allinea i decimali.
 */
export function aliquota(frazione: number | null | undefined): string {
  if (frazione == null || !Number.isFinite(frazione)) return "—";
  return percentuale(frazione, percentualeIntera(frazione) ? 0 : 2);
}

/**
 * La frazione vale un numero intero di punti percentuali?
 *
 * `Number.isInteger(frazione * 100)` sembra la stessa domanda e non lo è: in
 * virgola mobile `0.29 * 100` fa 28,999999999999996, e otto percentuali intere
 * su cento — 7, 14, 28, 29, 55, 56, 57, 58 — finivano stampate «29,00 %»
 * dentro una frase, che è esattamente ciò che `aliquota` esiste per evitare.
 * Si è visto quando un avviso del cruscotto ha cominciato a consigliare di
 * «portare la percentuale almeno al 29,00 %».
 */
function percentualeIntera(frazione: number): boolean {
  const punti = frazione * 100;
  return Math.abs(punti - Math.round(punti)) < 1e-9;
}

/** +12,4 % oppure −3,1 %, con il segno esplicito per i chip di variazione. */
export function variazione(frazione: number | null | undefined, decimali = 1): string {
  if (frazione == null || !Number.isFinite(frazione)) return "—";
  const segno = frazione > 0 ? "+" : frazione < 0 ? "−" : "";
  return `${segno}${new Intl.NumberFormat("it-IT", {
    ...OPZIONI_BASE,
    minimumFractionDigits: decimali,
    maximumFractionDigits: decimali,
  }).format(Math.abs(frazione) * 100)} %`;
}

export function num(valore: number | null | undefined): string {
  if (valore == null || !Number.isFinite(valore)) return "—";
  return numero.format(valore);
}

/** 15/01/2026 */
export function data(valore: Date | string | null | undefined): string {
  if (!valore) return "—";
  const d = typeof valore === "string" ? parseISO(valore) : valore;
  if (Number.isNaN(d.getTime())) return "—";
  return formatDate(d, "dd/MM/yyyy", { locale: it });
}

/** 15 gennaio 2026 */
export function dataEstesa(valore: Date | string | null | undefined): string {
  if (!valore) return "—";
  const d = typeof valore === "string" ? parseISO(valore) : valore;
  if (Number.isNaN(d.getTime())) return "—";
  return formatDate(d, "d MMMM yyyy", { locale: it });
}

/** gennaio, febbraio, … — indice 1-12. */
export function nomeMese(indice: number): string {
  return formatDate(new Date(2026, indice - 1, 1), "MMMM", { locale: it });
}

/** Gen, Feb, … per gli assi dei grafici. */
export function meseBreve(indice: number): string {
  const s = formatDate(new Date(2026, indice - 1, 1), "MMM", { locale: it });
  return s.charAt(0).toUpperCase() + s.slice(1).replace(".", "");
}

/** AS, MR — iniziali per gli avatar cliente. */
export function iniziali(nome: string): string {
  return nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

/** Colore stabile derivato dal nome: stesso cliente, stesso colore, sempre. */
export function coloreDaNome(nome: string): string {
  const tavolozza = [
    "#4C5BF5", "#0EA5E9", "#10B981", "#F5A524",
    "#E5484D", "#8B5CF6", "#EC4899", "#14B8A6",
  ];
  let somma = 0;
  for (let i = 0; i < nome.length; i++) somma = (somma * 31 + nome.charCodeAt(i)) >>> 0;
  return tavolozza[somma % tavolozza.length];
}

/**
 * Legge un numero scritto da una persona italiana. Accetta «1.234,56»,
 * «1234,56», «1234.56», «1 234,56», con o senza € e %.
 *
 * Il punto isolato è ambiguo: in «1.234» sono migliaia, in «12.5» è un
 * decimale. La regola è quella che un lettore italiano applica a occhio —
 * un punto seguito da esattamente tre cifre, ripetibile, è un separatore
 * di migliaia; in ogni altro caso è la virgola decimale scritta all'inglese.
 */
export function analizzaNumero(grezzo: string): number | null {
  const pulito = grezzo
    .replace(/[\s\u00a0\u202f]/g, "")
    .replace(/[€%]/g, "")
    .replace(/^\+/, "")
    .replace(/−/g, "-");
  if (pulito === "" || pulito === "-") return null;

  let normalizzato: string;
  if (pulito.includes(",")) {
    // La virgola, quando c'è, è sempre il separatore decimale.
    normalizzato = pulito.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(pulito)) {
    normalizzato = pulito.replace(/\./g, "");
  } else {
    normalizzato = pulito;
  }

  const valore = Number(normalizzato);
  return Number.isFinite(valore) ? valore : null;
}

/**
 * Una data scritta a mano o esportata da un gestionale → ISO `aaaa-mm-gg`.
 *
 * Accetta quello che si trova davvero nei file italiani: `31/12/2026`,
 * `31-12-2026`, `31.12.2026`, l'anno a due cifre, e l'ISO che esce dai
 * gestionali. La regola per distinguere `03/04/2026` è che in Italia il primo
 * numero è il giorno: sempre, anche quando sarebbe un mese valido. Un file
 * americano importato così darebbe date sbagliate — ed è per questo che
 * l'anteprima mostra le date formattate prima di scrivere qualcosa.
 *
 * @returns `null` se non è una data, o se è una data impossibile come il
 * 31 febbraio: meglio scartare la riga che salvare un giorno che non esiste.
 */
export function analizzaData(grezzo: string): string | null {
  const pulito = grezzo.trim();
  if (pulito === "") return null;

  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(pulito);
  const italiana = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(pulito);

  let anno: number;
  let mese: number;
  let giorno: number;
  if (iso) {
    [anno, mese, giorno] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (italiana) {
    giorno = Number(italiana[1]);
    mese = Number(italiana[2]);
    anno = Number(italiana[3]);
    // Due cifre: la finestra è quella dei gestionali, 70→1970, 69→2069.
    if (italiana[3].length === 2) anno += anno >= 70 ? 1900 : 2000;
  } else {
    return null;
  }

  if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
  const data = new Date(Date.UTC(anno, mese - 1, giorno));
  // Il rimbalzo di `Date` trasformerebbe il 31 febbraio nel 3 marzo: qui invece
  // si scarta, perché una data inventata in un registro fiscale non si nota più.
  if (data.getUTCFullYear() !== anno || data.getUTCMonth() !== mese - 1 || data.getUTCDate() !== giorno) {
    return null;
  }
  return `${String(anno).padStart(4, "0")}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

/** Percentuale digitata: «22», «22%», «0,22» sopra 1 diventa 22 → 0,22. */
export function analizzaPercentuale(grezzo: string): number | null {
  const valore = analizzaNumero(grezzo);
  if (valore === null) return null;
  return valore > 1 ? valore / 100 : valore;
}

/** Il valore così come va mostrato dentro un campo in modifica. */
export function perCampo(valore: number, decimali = 2): string {
  return new Intl.NumberFormat("it-IT", {
    ...OPZIONI_BASE,
    minimumFractionDigits: 0,
    maximumFractionDigits: decimali,
  }).format(valore);
}
