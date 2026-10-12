/**
 * I punti dei documenti, chiamati per numero.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché il numero e non il titolo
 * ─────────────────────────────────────────────────────────────────────────
 *
 * La card dell'offerta rimanda «al punto 6-bis dei Termini», e un rimando a un
 * punto deve portare **al punto**: una pagina lunga quattordici clausole,
 * aperta in testa, lascia a chi legge il compito di cercarsi la riga che lo
 * riguarda — e quel compito, su un telefono, non lo fa nessuno.
 *
 * L'ancora si ricava dal **numero** della clausola e non dal suo titolo. Un
 * identificativo come `prezzo-garantito-per-i-fondatori` è un titolo scritto
 * due volte: il giorno in cui il legale lo riscrive — e li riscrive — il
 * collegamento continua a esistere, continua a non essere rotto, e porta in
 * testa alla pagina senza dire niente. Il numero, invece, è quello che il
 * contratto usa per citarsi da solo: il punto 13 nomina «l'art. 6-bis, commi 3
 * e 4», non il suo titolo.
 *
 * Qui non si legge nessun file: è un modulo di sole stringhe, e ci sta perché
 * `pagine.ts` — che apre il Markdown con `node:fs` — non può essere importato
 * da un componente del browser. Le due parti dello stesso rimando stanno in un
 * posto solo e nessuna delle due tira dentro l'altra.
 */

/**
 * Il numero in testa a un titolo di clausola: `6-bis. Prezzo garantito…` → `6-bis`.
 *
 * `null` per i titoli che non sono clausole numerate — la privacy policy e le
 * cookie policy hanno titoli in prosa, e un'ancora inventata lì sarebbe un
 * indirizzo che sembra stabile e non lo è.
 */
export function numeroDelPunto(titolo: string): string | null {
  return titolo.match(/^(\d+(?:-(?:bis|ter|quater))?)\.\s/)?.[1] ?? null;
}

/** L'identificativo con cui il punto si raggiunge: `6-bis` → `punto-6-bis`. */
export function ancoraDelPunto(numero: string): string {
  return `punto-${numero}`;
}

/**
 * Il collegamento a un punto di un documento pubblicato.
 *
 * `trailingSlash: true` vuole la barra prima del cancelletto: senza, il sito
 * risponde con un rimando, e un rimando perde il frammento su più di un
 * browser. È la stessa cura che `conUtm` ha per la query.
 */
export function collegamentoAlPunto(indirizzo: string, numero: string): string {
  const conBarra = indirizzo.endsWith("/") ? indirizzo : `${indirizzo}/`;
  return `${conBarra}#${ancoraDelPunto(numero)}`;
}
