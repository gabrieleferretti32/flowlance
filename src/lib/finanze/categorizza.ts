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
  { categoriaId: "spesa-alimentare", parole: ["supermercat*", "esselunga", "coop", "conad", "carrefour", "lidl", "eurospin", "penny", "crai", "famila", "todis", "pam", "despar", "aliment*", "macelleri*", "panetteri*", "panificio", "fruttivendolo", "salumeria"] },
  { categoriaId: "ristoranti", parole: ["ristorant*", "pizzeri*", "trattoria", "osteria", "bar", "caffe*", "caffè", "pub", "birreria", "gelateri*", "pasticceri*", "rosticceria", "paninoteca", "sushi", "bistrot", "enoteca", "deliveroo", "glovo", "just eat", "mcdonald*", "mc donald", "burger king", "kfc"] },
  { categoriaId: "trasporti", parole: ["carburant*", "benzina", "gasolio", "distributore", "eni station", "q8", "ip", "tamoil", "esso", "autostrad*", "telepass", "trenitalia", "italo", "atm", "gtt", "amat", "taxi", "uber", "parchegg*", "revisione", "pneumatic*", "bollo auto", "officina", "carrozzeria"] },
  { categoriaId: "bollette", parole: ["enel", "servizio elettrico", "eni luce", "eni gas", "plenitude", "edison", "sorgenia", "illumia", "engie", "hera", "a2a", "iren", "acea", "acqua", "gas", "energia", "bolletta*", "tim", "telecom", "vodafone", "windtre", "wind tre", "wind", "iliad", "fastweb", "tiscali", "eolo", "ho mobile", "very mobile", "poste mobile", "sky wifi", "telefon*", "internet"] },
  { categoriaId: "abbonamenti", parole: ["netflix", "spotify", "disney", "prime video", "amazon prime", "dazn", "now tv", "sky", "abbonament*", "icloud", "google one", "dropbox", "adobe", "microsoft 365", "canva", "figma"] },
  { categoriaId: "salute", parole: ["farmaci*", "parafarmac*", "dentist*", "medic*", "analisi clinic", "laboratorio analisi", "poliambulatorio", "asl", "azienda sanitaria", "ottica", "fisioterap*", "psicolog*", "oculist*", "pediatr*", "veterinar*"] },
  { categoriaId: "affitto", parole: ["affitto", "locazione", "canone locazione", "condominio", "amministratore condominiale", "mutuo casa"] },
  { categoriaId: "assicurazioni", parole: ["assicuraz*", "polizza", "unipol", "generali", "allianz", "axa", "zurich"] },
  { categoriaId: "tempo-libero", parole: ["cinema", "teatro", "palestr*", "piscin*", "libreria", "museo", "concerto", "vivaticket", "ticketone"] },
  { categoriaId: "acquisti", parole: ["amazon", "zalando", "shein", "ikea", "decathlon", "mediaworld", "unieuro", "euronics", "leroy merlin", "bricoman", "abbigliament*"] },
  { categoriaId: "tasse", parole: ["agenzia entrate", "f24", "imu", "tari", "tasi", "tarsu", "irpef", "tributi", "canone rai"] },
  { categoriaId: "inps", parole: ["inps", "contributi previdenz"] },
  { categoriaId: "commercialista", parole: ["commercialista", "studio associato", "consulenza fiscale"] },
  { categoriaId: "rate", parole: ["rata", "rate", "finanziament*", "prestito", "leasing", "findomestic", "agos", "compass"] },
  { categoriaId: "risparmio", parole: ["giroconto risparmio", "accantonament*", "salvadanaio"] },
  { categoriaId: "investimenti", parole: ["etf", "fondo comune", "directa", "degiro", "fineco investiment", "piano di accumulo", "pac"] },
  /*
    «per fattura» e «fattura n» sono stretti apposta. Un incasso da cliente
    arriva scritto in dieci modi, e questa categoria conta più delle altre: è
    l'unica marcata «arriva dall'attività», quindi quello che finisce qui
    domani diventerà un prelievo dalla cassa dell'attività. La parola
    «fattura» da sola prenderebbe anche «rimborso fattura», che è un'altra
    cosa. Per il bonifico da una società c'è `sembraIncassoDaCliente`.
  */
  { categoriaId: "fatture", parole: ["bonifico da", "accredito fattura", "compenso", "saldo fattura", "pagamento fattura", "per fattura", "fattura n"] },
];

/**
 * Come si legge una voce del dizionario.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché non basta cercare la sottostringa
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Cercare `testo.includes(parola)` è la via ovvia e mente in silenzio:
 * «tari» sta dentro «saniTARIa», e un pagamento all'azienda sanitaria locale
 * finiva in **Tasse**. Misurato su un rendiconto vero, non immaginato. È la
 * stessa famiglia del «sport» dentro «traSPORTi» che questo repository ha già
 * incontrato altrove: una misura che conferma invece di una che rompe.
 *
 * Quindi le voci dicono cosa sono:
 *
 * - `bar` — una **parola intera**: prende «BAR CENTRALE», non «BARbiere».
 * - `supermercat*` — un **inizio di parola**: prende «supermercato» e
 *   «supermercati», non «ipersupermercato» (che non esiste) e soprattutto non
 *   pezzi in mezzo a un'altra parola.
 * - `wind tre` — una **frase**: si cerca nel testo intero, perché due parole
 *   separate da uno spazio parole intere non sono.
 *
 * Le frasi si guardano **prima**: sono più specifiche, e senza quest'ordine
 * «eni luce» perderebbe contro «eni» dei carburanti solo perché i carburanti
 * stanno più in alto nell'elenco.
 */
function combacia(testo: string, parole: string[], frasi: boolean): boolean {
  const parti = testo.split(" ");
  for (const parola of parole) {
    if (parola.includes(" ") !== frasi) continue;
    if (frasi) {
      if (testo.includes(parola)) return true;
    } else if (parola.endsWith("*")) {
      const inizio = parola.slice(0, -1);
      if (parti.some((w) => w.startsWith(inizio))) return true;
    } else if (parti.includes(parola)) {
      return true;
    }
  }
  return false;
}

/**
 * Un bonifico in entrata da una **società**: quasi sempre è un cliente.
 *
 * Il dizionario da solo non ci arriva: «Bonifico Istantaneo Disposto Da ACME
 * SRL» non contiene «bonifico da» — in mezzo c'è la formula della banca — e
 * senza la parola «fattura» quell'incasso finiva nella prima categoria di
 * entrata che capitava. Misurato su un rendiconto vero.
 *
 * Le due condizioni insieme contano: **bonifico** dice che è un accredito
 * disposto da qualcuno, la **forma societaria** dice che quel qualcuno è
 * un'azienda. Un bonifico da una persona resta fuori: fra amici ci si manda
 * denaro per mille motivi, e sbagliare qui costa il doppio, perché «Fatture
 * incassate» è la categoria marcata «arriva dall'attività».
 *
 * `testoConfrontabile` toglie i punti, quindi «S.R.L.» diventa «s r l»: le due
 * forme si cercano tutte e due.
 */
const FORME_SOCIETARIE = ["srl", "srls", "spa", "snc", "sas", "sapa", "scarl"];
const FORME_PUNTEGGIATE = ["s r l", "s p a", "s n c", "s a s", "s r l s"];

export function sembraIncassoDaCliente(testo: string): boolean {
  const parti = testo.split(" ");
  if (!parti.includes("bonifico") && !parti.includes("accredito")) return false;
  return (
    parti.some((w) => FORME_SOCIETARIE.includes(w))
    || FORME_PUNTEGGIATE.some((f) => testo.includes(f))
  );
}

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

  /* Prima le frasi, poi le parole: vedi `combacia`. */
  for (const frasi of [true, false]) {
    for (const voce of DIZIONARIO) {
      const c = categoriaBuona(voce.categoriaId);
      if (!c) continue;
      if (combacia(testo, voce.parole, frasi)) {
        return { categoriaId: c.id, tipo: c.tipo, origine: "dizionario" };
      }
    }
  }

  /*
    L'incasso da un cliente che il dizionario non può riconoscere da solo:
    bonifico più forma societaria. Sta qui, dopo il dizionario, perché è la
    regola più larga delle due e non deve scavalcare una parola esplicita.
  */
  if (verso === "entrata" && sembraIncassoDaCliente(testo)) {
    const c = categoriaBuona("fatture");
    if (c) return { categoriaId: c.id, tipo: c.tipo, origine: "dizionario" };
  }

  const predefinito: TipoMovimento = verso === "entrata" ? "entrata" : "spesa";
  if (verso === "uscita" && perId.has(CATEGORIA_NON_DEFINITO)) {
    return { categoriaId: CATEGORIA_NON_DEFINITO, tipo: predefinito, origine: "nessuna" };
  }

  /*
    **Un'entrata che non si è riconosciuta non finisce in un prelievo.**

    Per le uscite il ripiego è «Non definito», che è un'ammissione. Per le
    entrate quella categoria non esiste, e si prendeva la prima di tipo
    entrata che capitava nell'elenco — cioè una scelta decisa dall'ordine con
    cui l'archivio restituisce le categorie. Su un archivio quella prima era
    «Altre entrate» e non si vedeva; su un altro sarebbe «Fatture incassate»,
    che è marcata **arriva dall'attività**: lo stesso movimento non
    riconosciuto diventerebbe un prelievo dalla cassa della partita IVA, e il
    riepilogo conterebbe due volte gli stessi euro. Misurato: «Movimento
    Salvadanaio» finito in «Fatture incassate» solo per l'ordine dell'elenco.

    Quindi il ripiego evita le categorie marcate «arriva dall'attività»: se
    proprio non c'è altro resta la prima, ma quel caso vuol dire che l'unica
    categoria di entrata è quella, e allora non è più un'ipotesi.
  */
  const entrate = categorie.filter((c) => c.tipo === predefinito);
  const ripiego =
    entrate.find((c) => !c.arrivaDallAttivita)?.id ?? entrate[0]?.id ?? "";
  return { categoriaId: ripiego, tipo: predefinito, origine: "nessuna" };
}

/** Il tipo di categoria che un movimento di questo tipo può usare. */
export function tipoDiCategoria(tipo: TipoMovimento): CategoriaPf["tipo"] {
  return tipo === "giroconto" ? "spesa" : tipo;
}
