/**
 * Il pixel di Meta: gli eventi, e i tre presidi sull'acquisto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Dove **non** sta la decisione «questa è una pagina di marketing»
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Non qui, e non in un controllo sul percorso. Il pixel viene montato da
 * `Statistiche`, che il guscio di `(sito)` monta e quello di `/app` no: la
 * garanzia è **dove sta il componente nell'albero delle rotte**, la stessa che
 * vale per Google Analytics e per Clarity. Una funzione `èMarketing(percorso)`
 * sarebbe una seconda definizione accanto a quella che già esiste, e il giorno
 * in cui nasce una pagina pubblica fuori da `(sito)` — o `/app` cambia
 * prefisso — le due direbbero cose diverse.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il numero su cui la campagna impara
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `Purchase` è il segnale con cui Meta decide chi portare. Se conta gente che
 * non ha pagato, impara a portare quella gente. Senza un server non si può
 * verificare un pagamento, quindi non esiste la soluzione pulita — esistono tre
 * presidi che si sommano, e un residuo dichiarato:
 *
 * 1. **Il parametro di ritorno.** Stripe rimanda su `/grazie/?sessione=…` con
 *    l'identificativo della sessione di pagamento. Senza quel parametro
 *    l'evento non parte: chi digita l'indirizzo a mano non conta.
 * 2. **La memoria locale.** L'identificativo già contato si ricorda in
 *    `localStorage` — non in `sessionStorage`, che muore con la scheda e
 *    lascerebbe ricontare chi riapre il link in una scheda nuova. Blocca
 *    ricaricamenti, tasto indietro, seconde schede.
 * 3. **L'impronta come `eventID`.** Meta scarta gli eventi con lo stesso
 *    identificativo entro 48 ore: è la rete per quello che sfugge al punto 2.
 *    Si manda l'**impronta** e non l'identificativo, così l'unica cosa che esce
 *    dal browser è una stringa che non identifica nessuna transazione.
 *
 * Quello che resta, e va saputo guardando la campagna: un acquisto rimborsato
 * resta contato, e — molto più pesante — `Purchase` scatta **solo per chi ha
 * accettato la profilazione**. Il numero di Meta è strutturalmente più basso di
 * quello di Stripe, non più alto. Il rapporto fra i due è il tasso di consenso,
 * ed è scritto in CHECKOUT.md.
 */
import { PREZZO } from "./acquisto";

/** Gli eventi che la campagna usa. Non ce ne sono altri, e non è un caso. */
export type EventoMeta = "PageView" | "ViewContent" | "InitiateCheckout" | "Purchase";

/**
 * Il valore di una conversione: **l'imponibile**, non il totale incassato.
 *
 * L'IVA non è un ricavo: è denaro che transita e che va allo Stato. È la stessa
 * frase che Flowlance dice ai suoi utenti dal primo giorno, e sarebbe curioso
 * non applicarla a sé.
 */
export const VALORE = { value: PREZZO.imponibile, currency: "EUR" } as const;

/** Il nome del prodotto negli eventi. Uno solo, quindi una costante sola. */
export const CONTENUTO = { content_name: "Flowlance", content_type: "product" } as const;

/** Dove si ricordano gli acquisti già contati. */
export const CHIAVE_ACQUISTI = "flowlance:acquisti-contati";

/** Il parametro con cui Stripe rimanda su `/grazie`. */
export const PARAMETRO_SESSIONE = "sessione";

declare global {
  interface Window {
    fbq?: (...argomenti: unknown[]) => void;
  }
}

/**
 * Manda un evento, se il pixel c'è.
 *
 * Se non c'è — consenso non dato, script bloccato, pagina aperta senza rete —
 * non succede niente e non si lancia niente: un evento di misurazione non deve
 * poter rompere una pagina che sta vendendo.
 */
export function tracciaMeta(
  evento: EventoMeta,
  parametri?: Record<string, unknown>,
  opzioni?: { eventID: string },
): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", evento, parametri ?? {}, opzioni);
}

// ————————————————————————————————————————————————————————————
// I tre presidi, puri e provabili
// ————————————————————————————————————————————————————————————

/**
 * L'identificativo della sessione di pagamento, dall'indirizzo di ritorno.
 *
 * `null` quando non c'è: è il primo presidio, e vuol dire che su questa pagina
 * non ci si è arrivati pagando.
 */
export function identificativoAcquisto(ricerca: string): string | null {
  try {
    const valore = new URLSearchParams(ricerca).get(PARAMETRO_SESSIONE)?.trim();
    // Stripe manda `cs_live_…` o `cs_test_…`. Qualunque cosa di forma diversa
    // non viene da lì, e non è un acquisto da contare.
    return valore && /^cs_[a-zA-Z0-9_]{10,}$/.test(valore) ? valore : null;
  } catch {
    return null;
  }
}

/** Gli acquisti già contati in questo browser. Mai più di venti: non serve la storia. */
export function acquistiContati(grezzo: string | null): string[] {
  try {
    const letto: unknown = grezzo === null ? [] : JSON.parse(grezzo);
    return Array.isArray(letto) ? letto.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function conAcquisto(giaContati: string[], id: string): string[] {
  return [...giaContati.filter((x) => x !== id), id].slice(-20);
}

/**
 * L'impronta dell'identificativo: quello che viaggia al posto suo.
 *
 * Sedici cifre esadecimali di SHA-256 bastano a distinguere due acquisti e non
 * bastano a risalire a niente. È l'unico pezzo dell'evento che dipende dalla
 * transazione, e non la nomina.
 */
export async function improntaAcquisto(id: string): Promise<string> {
  const byte = new TextEncoder().encode(id);
  const digest = await crypto.subtle.digest("SHA-256", byte);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}
