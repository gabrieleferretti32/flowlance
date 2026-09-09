/**
 * Gli indirizzi del sito e dell'app, scritti in un posto solo.
 *
 * L'app viveva alla radice; da quando la radice è la pagina di vendita, vive
 * sotto `/app`. Lo spostamento è il tipo di modifica che rompe **in silenzio**:
 * un `href="/fatture"` continua a compilare, continua a passare i test, e in
 * produzione porta su una pagina che non esiste. Erano una settantina, sparsi
 * in ventitré file.
 *
 * Da qui in avanti nessun percorso si scrive a mano. La regola è tenuta da
 * `no-restricted-syntax` in `eslint.config.mjs`, che rifiuta le stringhe di
 * percorso dentro `href` e `router.push`, e da `strumenti/verifica-link.mjs`,
 * che dopo il build apre ogni pagina di `out/` e controlla che ogni link
 * interno abbia un file dall'altra parte.
 *
 * `output: "export"` e nessun `basePath`: `basePath` avrebbe spostato anche la
 * pagina di vendita, che deve restare alla radice del dominio. L'app è quindi
 * una cartella vera, `src/app/app/`, e questi sono i suoi indirizzi.
 */

/** La radice dell'app. Cambiarla qui sposta tutte le schermate. */
export const BASE_APP = "/app";

/**
 * Le schermate dell'app.
 *
 * `cruscotto` è la radice di `/app` e non porta lo slash finale: `usePathname`
 * lo toglie, e la barra laterale confronta l'indirizzo corrente con questi
 * valori per sapere quale voce illuminare.
 */
export const ROTTE = {
  cruscotto: BASE_APP,
  fatture: `${BASE_APP}/fatture`,
  note: `${BASE_APP}/note`,
  costi: `${BASE_APP}/costi`,
  clienti: `${BASE_APP}/clienti`,
  fisco: `${BASE_APP}/fisco`,
  iva: `${BASE_APP}/iva`,
  confronto: `${BASE_APP}/confronto`,
  scadenzario: `${BASE_APP}/scadenzario`,
  chiusura: `${BASE_APP}/chiusura`,
  cashflow: `${BASE_APP}/cashflow`,
  patrimonio: `${BASE_APP}/patrimonio`,
  pianificazione: `${BASE_APP}/pianificazione`,
  avvio: `${BASE_APP}/avvio`,
  parametri: `${BASE_APP}/parametri`,
  dati: `${BASE_APP}/dati`,
  importa: `${BASE_APP}/importa`,
  licenza: `${BASE_APP}/licenza`,
  scorciatoie: `${BASE_APP}/scorciatoie`,
} as const;

export type NomeRotta = keyof typeof ROTTE;

/**
 * L'indirizzo che apre la demo: l'app vera, con un dataset già dentro.
 *
 * Sta qui e non nella pagina di vendita perché è un indirizzo, e gli indirizzi
 * stanno in un posto solo — il pulsante «Apri la demo» ne è un consumatore
 * come la barra che ci si trova dentro. Il parametro accende la demo per
 * questa scheda: da lì in poi la tiene accesa `sessionStorage`, e l'indirizzo
 * torna pulito alla prima navigazione.
 */
export function rottaDemo(dataset: string): string {
  return `${ROTTE.cruscotto}/?demo=${encodeURIComponent(dataset)}`;
}

/**
 * Le pagine pubbliche: la vendita e i documenti legali.
 *
 * Stanno accanto alle rotte dell'app perché il piede le nomina tutte e cinque
 * su **ogni** pagina, dentro e fuori dall'applicazione, e due elenchi separati
 * si sarebbero disallineati al primo documento nuovo.
 */
export const SITO = {
  vendita: "/",
  privacy: "/privacy",
  termini: "/termini",
  cookie: "/cookie",
  approssimazioni: "/cosa-non-calcola",
  /** Dove Stripe rimanda dopo il pagamento. Non sa chi sia arrivato, e lo dice. */
  grazie: "/grazie",
} as const;

/**
 * L'indirizzo corrente è questa rotta?
 *
 * `trailingSlash: true` fa sì che `usePathname()` restituisca `/app/fatture/`,
 * con lo slash in coda, mentre le rotte qui sopra non ce l'hanno. Il confronto
 * secco fra i due non è mai vero, e la barra laterale non illuminava **nessuna**
 * voce — su nessuna schermata. È il difetto che si guarda ogni giorno senza
 * vederlo: la barra funzionava, portava dove doveva, e diceva soltanto una cosa
 * in meno di quello che sembrava dire.
 *
 * Normalizza tutti e due i lati invece di aggiungere lo slash alle costanti:
 * così regge anche in `next dev`, dove il percorso arriva senza.
 */
export function rottaAttiva(percorso: string | null | undefined, rotta: string): boolean {
  if (!percorso) return false;
  const nudo = (s: string) => (s.length > 1 ? s.replace(/\/+$/, "") : s);
  return nudo(percorso) === nudo(rotta);
}
