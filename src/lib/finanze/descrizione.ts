/**
 * La descrizione di un movimento, ripulita dalla formula della banca.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il problema, visto su un estratto conto vero
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Intesa Sanpaolo scrive «Addebito Diretto Disposto A Favore Di ENEL ENERGIA
 * SPA Mandato 00123». Nel registro si legge «Addebito Diretto Disposto A
 * Favo…» — tre righe di fila identiche, e il nome di chi ha preso i soldi
 * oltre il troncamento. La parte che identifica la controparte è l'unica che
 * serve a chi guarda, ed è l'unica che non si vede.
 *
 * Qui la formula iniziale si toglie e resta la controparte. Il tipo di
 * operazione non si perde: sta nel **tipo** del movimento (spesa, entrata,
 * giroconto) e nella categoria, che sono due campi apposta.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Tre cautele
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 1. Si toglie **solo dall'inizio**, e una formula sola: «bonifico» in mezzo a
 *    una descrizione è parte di quello che qualcuno ha scritto.
 * 2. Se dopo il taglio non resta abbastanza — «PRELIEVO BANCOMAT» non ha
 *    nessuna controparte dentro — si tiene l'originale. Meglio una riga lunga
 *    che una riga vuota.
 * 3. **Chi legge le parole per catalogare guarda l'originale.** Il dizionario
 *    conosce «bonifico da» e «rata»: se si catalogasse sul testo ripulito, le
 *    stesse righe finirebbero in «Non definito» per colpa di una pulizia
 *    estetica. Il testo ripulito è quello che si **mostra** e si salva; quello
 *    grezzo resta la base per la categoria, per le regole e per la firma dei
 *    doppioni.
 */

/**
 * Le parole con cui le banche costruiscono le formule.
 *
 * Si tolgono **dall'inizio, finché ce ne sono**: la prima parola che non è di
 * questo elenco è dove comincia la controparte, e da lì non si tocca più
 * niente. Un elenco di parole invece di una lista di frasi intere perché le
 * frasi sono infinite — «bonifico istantaneo disposto a favore di», «pagamento
 * tramite pos presso», «disposizione di pagamento da» sono la stessa cosa
 * ricombinata — mentre le parole che le compongono sono una trentina.
 *
 * Il prezzo è che una controparte il cui nome comincia con una di queste
 * parole perde quella parola: «DI GIOVANNI SRL» diventa «GIOVANNI SRL». È un
 * prezzo accettabile perché resta leggibile e identificabile; il contrario —
 * «Addebito Diretto Disposto A Favo…» ripetuto su tre righe — non lo è.
 */
const PAROLE_DI_FORMULA = new Set([
  "addebito", "accredito", "bonifico", "pagamento", "prelievo", "versamento",
  "operazione", "disposizione", "disposto", "disposta", "diretto", "diretta",
  "istantaneo", "istantanea", "preautorizzato", "preautorizzata", "sdd", "sepa",
  "rid", "pos", "carta", "credito", "debito", "bancomat", "atm", "contanti",
  "contante", "effettuato", "effettuata", "eseguito", "eseguita", "tramite",
  "con", "presso", "favore", "a", "di", "da", "per", "verso", "in", "entrata",
  "uscita", "il", "lo", "la", "del", "della", "dello", "ore", "data", "online",
  "ordinario", "ordinaria", "estero", "italia", "n",
]);

/** Un pezzo che non è una parola: una data, un'ora, un numero d'ordine. */
const PEZZO_DI_SERVIZIO = /^(\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?|\d{1,2}[:.]\d{2}|n\.?\d+|\d{1,2})$/i;

/** Quanto deve restare perché il taglio abbia senso. */
const MINIMO = 4;

/** Spazi normali, niente spazi doppi, niente spazi ai bordi. */
export function spaziNormali(testo: string): string {
  return testo.replace(/\s+/g, " ").trim();
}

const diFormula = (parola: string) => {
  const pulita = parola.toLocaleLowerCase("it-IT").replace(/[.,;:]+$/, "");
  return PAROLE_DI_FORMULA.has(pulita) || PEZZO_DI_SERVIZIO.test(pulita);
};

/**
 * La parte che identifica la controparte, se si riesce a isolarla.
 *
 * Torna l'originale — ripulito solo negli spazi — quando non comincia con una
 * formula, o quando togliere la formula lascerebbe troppo poco: «PRELIEVO
 * BANCOMAT» non contiene nessuna controparte, e una riga vuota sarebbe peggio
 * di una riga lunga.
 */
export function descrizioneUtile(grezza: string): string {
  const testo = spaziNormali(grezza);
  const parole = testo.split(" ");
  let i = 0;
  while (i < parole.length && diFormula(parole[i])) i += 1;
  if (i === 0) return testo;

  const resto = parole.slice(i).join(" ");
  return resto.length >= MINIMO ? resto : testo;
}
