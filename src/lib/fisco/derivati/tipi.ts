/**
 * Un valore che il sistema ricava, con accanto **da dove viene**.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il difetto che questo modulo esiste per rendere impossibile
 * ─────────────────────────────────────────────────────────────────────────
 *
 * In due settimane il progetto ne ha incontrate cinque istanze, tutte della
 * stessa specie: **un valore mostrato e uno calcolato che non si parlano, con
 * nessuno dei due che segnala l'altro.**
 *
 * - L'aliquota sostitutiva era scritta da un interruttore e il motore
 *   moltiplicava per quella: chi l'aveva acceso restava al 5 % al sesto anno.
 * - I contributi fissi mostrati nei Parametri erano quelli degli artigiani
 *   mentre il motore usava quelli dei commercianti.
 * - Il netto del semaforo era calcolato due volte, in due file, e le due
 *   formule erano già divergenti.
 * - `messaggioSoglia` citava la soglia dei parametri mentre la decisione era
 *   stata presa su quella delle impostazioni.
 * - `backup.ts` riempiva i campi mancanti con dodici costanti del 2026, in
 *   righe di qualunque anno.
 *
 * Nessuna è stata trovata da un test sui numeri, perché **ciascuno dei due
 * valori, preso da solo, era plausibile**. Sono state trovate aprendo il
 * browser e guardando.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La forma della soluzione: una fonte sola, per costruzione
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un registro che *verifica* la coincidenza fra il valore mostrato e quello
 * usato sarebbe già qualcosa, ma resterebbe un controllo: due strade che
 * portano allo stesso numero, più un test che le confronta. Questo modulo fa
 * una cosa diversa e più forte — **rende le due strade una sola**. Il motore e
 * la schermata chiedono lo stesso `derivato(...)`, e non esiste più un «valore
 * mostrato» separato da un «valore usato»: c'è un valore, e la sua storia.
 *
 * La storia non è decorazione. `origine` e `motivo` sono la ragione per cui il
 * numero si può difendere davanti a un accertamento: dire «26,07 %» senza dire
 * *perché* è la stessa cosa che un difetto silenzioso, solo più lenta a
 * manifestarsi.
 */
import type { CampoUtente } from "../parametri-utente";

/**
 * Da dove viene un numero.
 *
 * Le cinque origini non sono sfumature dello stesso concetto: sono cinque
 * gradi diversi di **quanto quel numero è difendibile**, e su questa scala
 * l'app decide cosa può uscire in un documento e cosa no.
 */
export type Origine =
  /** Pubblicato dalla legge, per quell'anno. Il grado più alto. */
  | { tipo: "legge"; anno: number; fonte?: string }
  /** L'utente l'ha confermato dalla schermata Parametri: è suo, e lo difende lui. */
  | { tipo: "dichiarato"; campo: CampoUtente }
  /** Dedotto da un altro dato che l'utente ha dato: una data, una gestione. */
  | { tipo: "dedotto"; da: string }
  /** Una media dell'app. Vale per calcolare, non per dichiarare. */
  | { tipo: "media" }
  /** Una regola di prodotto, non di legge: una tolleranza, una soglia d'avviso. */
  | { tipo: "prodotto" };

export type Derivato<T> = {
  /**
   * Il valore. `null` dove la voce **non si applica**, che non è zero.
   *
   * «Zero euro di contributi fissi» e «i contributi fissi qui non esistono»
   * sono due frasi diverse, e in un prospetto la prima è una risposta a una
   * domanda che nessuno ha fatto. Le voci che possono non applicarsi si
   * dichiarano `Derivato<number | null>`, e il `motivo` dice perché.
   */
  valore: T;
  origine: Origine;
  /**
   * Perché vale questo, **coi numeri dentro**, in una frase da mettere a
   * schermo così com'è.
   *
   * Non «l'aliquota agevolata»: «5 %: hai aperto nel 2024, quindi il 2026 è il
   * 3° dei 5 anni agevolati». Un motivo che non contiene il valore è un motivo
   * che può restare indietro quando il valore cambia — ed è la forma esatta
   * del difetto che questo modulo previene, in piccolo. Un test lo verifica per
   * ogni voce del registro.
   */
  motivo: string;
  /**
   * Un valore dell'utente sta prendendo il posto di uno che l'app conosceva.
   *
   * Vero solo quando **esisteva** un valore di legge e l'utente ne ha messo un
   * altro: chi ha una riduzione contributiva scavalca i fissi INPS. Un campo
   * che l'app non poteva conoscere — l'addizionale del tuo comune — non
   * scavalca niente, lo riempie.
   */
  scavalcato: boolean;
};

/** Come si nomina l'origine in una frase, quando la si mostra accanto al numero. */
export function origineInParole(origine: Origine): string {
  switch (origine.tipo) {
    case "legge":
      return `valore di legge ${origine.anno}`;
    case "dichiarato":
      return "valore che hai dichiarato";
    case "dedotto":
      return `dedotto da ${origine.da}`;
    case "media":
      return "media dell'app, non confermata";
    case "prodotto":
      return "impostazione dell'app";
  }
}

/**
 * Il numero si può mettere in un documento che va dal commercialista?
 *
 * Una media dell'app no: sembrerebbe un dato dichiarato, e nessuno
 * riaprirebbe la domanda. È la stessa regola che oggi blocca l'export del
 * prospetto, detta sul singolo valore invece che sull'insieme.
 */
export function difendibile(origine: Origine): boolean {
  return origine.tipo !== "media";
}
