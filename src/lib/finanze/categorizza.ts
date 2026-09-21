/**
 * A che categoria assomiglia una riga di rendiconto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Tre gradini, in ordine di autorità
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 1. **Le regole della persona.** Ha già detto che «ESSELUNGA» è spesa
 *    alimentare: quella parola vince su qualunque cosa sappia il dizionario.
 * 2. **Un dizionario di parole italiane.** Sa che «bolletta», «farmacia» o
 *    «carburante» hanno un posto ovvio, e copre il primo import di chi non ha
 *    ancora nessuna regola.
 * 3. **«Non definito».** Quello che non si riconosce non si indovina: finisce
 *    in una categoria che si vede, e che si corregge in anteprima.
 *
 * Il terzo gradino è il più importante. Una categoria sbagliata ma plausibile
 * è peggio di nessuna categoria: nessuno la controlla, e il budget di fine
 * mese è sbagliato senza che niente lo dica. «Non definito» è un'ammissione,
 * e le ammissioni si correggono.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Nessuna intelligenza artificiale, e nessuna rete
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Tutto qui dentro è confronto di stringhe, in locale, come il resto
 * dell'app: i movimenti bancari di una persona non escono dal suo browser per
 * essere catalogati. È una scelta di prodotto prima che tecnica, ed è il
 * motivo per cui il dizionario è un elenco leggibile e non un modello.
 */
import { CATEGORIA_NON_DEFINITO } from "./categorie";
import type { CategoriaPf, RegolaPf, TipoMovimento } from "./tipi";

/** Il testo su cui si cerca: minuscolo, senza doppi spazi, senza punteggiatura. */
export function testoConfrontabile(descrizione: string): string {
  return descrizione
    .toLocaleLowerCase("it-IT")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Il dizionario di partenza: parola → id della categoria iniziale.
 *
 * Sono le categorie seminate da `CATEGORIE_INIZIALI`: se una non c'è più —
 * perché è stata rinominata o eliminata — la voce non si applica, e
 * `categorizza` se ne accorge da sola invece di scrivere un id morto.
 */
export const DIZIONARIO: { parole: string[]; categoriaId: string }[] = [
  { categoriaId: "spesa-alimentare", parole: ["supermercat", "esselunga", "coop", "conad", "carrefour", "lidl", "eurospin", "pam ", "despar", "alimentar", "macelleria", "panetteria", "fruttivendolo"] },
  { categoriaId: "ristoranti", parole: ["ristorant", "pizzeri", "trattoria", "osteria", "bar ", "caffe", "caffè", "pub ", "gelateri", "deliveroo", "glovo", "just eat"] },
  { categoriaId: "trasporti", parole: ["carburant", "benzina", "gasolio", "eni ", "q8", "ip ", "tamoil", "esso", "autostrad", "telepass", "trenitalia", "italo", "atm ", "gtt", "amat", "taxi", "uber", "parchegg", "revisione", "pneumatic"] },
  { categoriaId: "bollette", parole: ["enel", "eni luce", "hera", "a2a", "iren", "acea", "acqua", "gas ", "energia", "bolletta", "tim ", "vodafone", "windtre", "fastweb", "iliad", "telefon", "internet"] },
  { categoriaId: "abbonamenti", parole: ["netflix", "spotify", "disney", "prime video", "abbonament", "icloud", "google one", "dropbox", "adobe", "microsoft 365", "canva", "figma"] },
  { categoriaId: "salute", parole: ["farmaci", "parafarmac", "dentist", "medic", "analisi clinic", "ottica", "fisioterap", "veterinar"] },
  { categoriaId: "affitto", parole: ["affitto", "canone locazione", "condominio", "amministratore condominiale", "mutuo casa"] },
  { categoriaId: "assicurazioni", parole: ["assicuraz", "polizza", "unipol", "generali", "allianz", "axa", "zurich"] },
  { categoriaId: "tempo-libero", parole: ["cinema", "teatro", "palestra", "piscina", "libreria", "museo", "concerto", "vivaticket", "ticketone"] },
  { categoriaId: "acquisti", parole: ["amazon", "zalando", "ikea", "decathlon", "mediaworld", "unieuro", "leroy merlin", "abbigliament"] },
  { categoriaId: "tasse", parole: ["agenzia entrate", "f24", "imu", "tari", "irpef", "tributi"] },
  { categoriaId: "inps", parole: ["inps", "contributi previdenz"] },
  { categoriaId: "commercialista", parole: ["commercialista", "studio associato", "consulenza fiscale"] },
  { categoriaId: "rate", parole: ["rata", "finanziament", "prestito", "leasing", "findomestic", "agos", "compass"] },
  { categoriaId: "risparmio", parole: ["giroconto risparmio", "accantonament", "salvadanaio"] },
  { categoriaId: "investimenti", parole: ["etf", "fondo comune", "directa", "degiro", "fineco investiment", "piano di accumulo", "pac "] },
  { categoriaId: "fatture", parole: ["bonifico da", "accredito fattura", "compenso", "saldo fattura", "pagamento fattura"] },
];

export type Proposta = {
  categoriaId: string;
  /**
   * Il tipo che viene dietro alla categoria.
   *
   * Il segno del rendiconto dice solo **da che parte** va il denaro: tutto
   * quello che esce sarebbe una «spesa». Ma una riga che dice «RATA PRESTITO
   * AUTO» non è una spesa qualunque, e la categoria che la riconosce è di tipo
   * `rata`: se il movimento restasse `spesa`, quella categoria non gli si
   * potrebbe nemmeno attaccare — i due tipi devono combaciare — e la riga
   * finirebbe in «Non definito» avendo in mano la risposta.
   *
   * Quindi per le uscite il tipo lo decide la categoria riconosciuta: spesa,
   * risparmio o rata. Per le entrate no: un'entrata è un'entrata, e nessuna
   * parola nella descrizione può trasformarla in altro.
   */
  tipo: TipoMovimento;
  /** Da dove viene: serve a dirlo in anteprima, e a non vantarsi di indovinare. */
  origine: "regola" | "dizionario" | "nessuna";
};

/** Da che parte va il denaro. Lo dice il segno, e non è discutibile. */
export type Verso = "entrata" | "uscita";

/**
 * La categoria proposta per una riga, e il tipo che ne consegue.
 *
 * Il verso restringe il campo: una descrizione che parla di «bonifico» su un
 * addebito non può finire in una categoria di entrata. Senza questo filtro un
 * «bonifico a Mario» diventerebbe un incasso, con il segno giusto e la
 * categoria sbagliata — il tipo di errore che non si nota guardando il totale.
 */
export function categorizza(
  descrizione: string,
  verso: Verso,
  categorie: CategoriaPf[],
  regole: RegolaPf[],
): Proposta {
  const testo = testoConfrontabile(descrizione);
  const perId = new Map(categorie.map((c) => [c.id, c]));
  const ammessi: CategoriaPf["tipo"][] =
    verso === "entrata" ? ["entrata"] : ["spesa", "risparmio", "rata"];
  const categoriaBuona = (id: string) => {
    const c = perId.get(id);
    return c !== undefined && ammessi.includes(c.tipo) ? c : null;
  };

  for (const regola of regole) {
    const cercato = testoConfrontabile(regola.testoDaCercare);
    const c = categoriaBuona(regola.categoriaId);
    if (cercato !== "" && c && testo.includes(cercato)) {
      return { categoriaId: c.id, tipo: c.tipo, origine: "regola" };
    }
  }

  for (const voce of DIZIONARIO) {
    const c = categoriaBuona(voce.categoriaId);
    if (!c) continue;
    if (voce.parole.some((p) => testo.includes(p))) {
      return { categoriaId: c.id, tipo: c.tipo, origine: "dizionario" };
    }
  }

  const predefinito: TipoMovimento = verso === "entrata" ? "entrata" : "spesa";
  const ripiego =
    verso === "uscita" && perId.has(CATEGORIA_NON_DEFINITO)
      ? CATEGORIA_NON_DEFINITO
      : (categorie.find((c) => c.tipo === predefinito)?.id ?? "");
  return { categoriaId: ripiego, tipo: predefinito, origine: "nessuna" };
}

/** Il tipo di categoria che un movimento di questo tipo può usare. */
export function tipoDiCategoria(tipo: TipoMovimento): CategoriaPf["tipo"] {
  return tipo === "giroconto" ? "spesa" : tipo;
}
