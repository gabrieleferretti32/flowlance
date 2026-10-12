/**
 * Aritmetica su date ISO, senza `Date`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché non si costruisce nessun `Date`
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Queste funzioni decidono quando si cancellano i dati di una persona. Un
 * `new Date("2027-06-30")` nasce a mezzanotte **UTC** e, letto da un fuso a
 * est, è già il primo luglio: un termine di trenta giorni scatterebbe un
 * giorno prima del dovuto, e nessuno se ne accorgerebbe guardando lo schermo.
 * Qui si lavora sulle cifre della stringa, che non hanno fuso.
 *
 * Il confronto fra date ISO è un confronto fra stringhe — `"2027-07-30"` è
 * maggiore di `"2027-07-01"` carattere per carattere — ed è la ragione per cui
 * tutto questo file restituisce stringhe e non numeri.
 */

const GIORNI_PER_MESE = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function bisestile(anno: number): boolean {
  return (anno % 4 === 0 && anno % 100 !== 0) || anno % 400 === 0;
}

export function giorniDelMese(anno: number, mese: number): number {
  return mese === 2 && bisestile(anno) ? 29 : GIORNI_PER_MESE[mese - 1];
}

function scomponi(data: string): [number, number, number] {
  return [Number(data.slice(0, 4)), Number(data.slice(5, 7)), Number(data.slice(8, 10))];
}

function componi(anno: number, mese: number, giorno: number): string {
  return `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

/** La data ISO è scritta bene? Non dice se esiste: dice se ha la forma. */
export function formaIso(data: unknown): data is string {
  return typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data);
}

/**
 * `data` più `giorni` giorni.
 *
 * Attraversa i mesi e gli anni contando, senza convertire in millisecondi: su
 * un fuso con l'ora legale un conto in millisecondi sbaglia di un'ora due
 * volte l'anno, e due volte l'anno un termine di trenta giorni cadrebbe nel
 * giorno sbagliato.
 */
export function piuGiorni(data: string, giorni: number): string {
  let [anno, mese, giorno] = scomponi(data);
  let resto = giorni;
  while (resto > 0) {
    const nel = giorniDelMese(anno, mese);
    const disponibili = nel - giorno;
    if (resto <= disponibili) {
      giorno += resto;
      resto = 0;
    } else {
      resto -= disponibili + 1;
      giorno = 1;
      mese += 1;
      if (mese > 12) {
        mese = 1;
        anno += 1;
      }
    }
  }
  return componi(anno, mese, giorno);
}

/**
 * `data` più `mesi` mesi, con il giorno schiacciato sulla fine del mese.
 *
 * Il 31 gennaio più un mese è il 28 febbraio (o il 29): non esiste un 31
 * febbraio, e la scelta è fra schiacciare e scivolare al primo marzo.
 * Schiacciare tiene il termine **dentro** il mese che l'utente si aspetta, e
 * su una scadenza di conservazione cancella un giorno prima invece che un
 * giorno dopo — che è il verso prudente.
 */
export function piuMesi(data: string, mesi: number): string {
  const [anno, mese, giorno] = scomponi(data);
  const totale = (anno * 12 + (mese - 1)) + mesi;
  const annoNuovo = Math.floor(totale / 12);
  const meseNuovo = (totale % 12) + 1;
  return componi(annoNuovo, meseNuovo, Math.min(giorno, giorniDelMese(annoNuovo, meseNuovo)));
}

/**
 * Il termine è scaduto?
 *
 * **Il giorno giusto e non il giorno prima.** `scaduto(d, 30, oggi)` è falso
 * per tutti i giorni fino al ventinovesimo compreso e diventa vero il
 * trentesimo: il confronto è `oggi >= data + giorni`, non `>`. Chi scrive
 * «entro 30 giorni» intende che al trentesimo la cosa è fatta, e un `>`
 * la farebbe al trentunesimo — un giorno di ritardo su ogni termine, sempre.
 */
export function scaduto(data: string, giorni: number, oggi: string): boolean {
  return oggi >= piuGiorni(data, giorni);
}

/** Lo stesso, a mesi. */
export function scadutoAMesi(data: string, mesi: number, oggi: string): boolean {
  return oggi >= piuMesi(data, mesi);
}
