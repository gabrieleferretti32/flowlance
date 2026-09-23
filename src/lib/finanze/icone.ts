/**
 * L'emoji di una categoria: dal nome quando il nome lo dice, dal tipo se no.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché un'emoji, e perché non si indovina
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le categorie di partenza ce l'hanno e quelle scritte a mano no: in un elenco
 * di venti righe la differenza si vede, e quella senza sembra incompleta o
 * rotta. Non è decorazione — è la cosa che fa trovare la riga giusta senza
 * leggere, che è quello che si fa scorrendo un elenco di categorie in
 * anteprima d'import.
 *
 * Il dizionario riconosce parole italiane comuni e basta. Quando il nome non
 * dice niente — «Varie», «Extra», «Mario» — non si prova a indovinare: si
 * mette l'emoji generica del tipo, che è un'ammissione onesta e resta
 * cambiabile. È la stessa regola di `categorizza`: una cosa plausibile e
 * sbagliata è peggio di una cosa ovvia e neutra.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Sceglierla resta possibile, sempre
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Qui si propone; chi guarda decide. `ICONE_SCELTA` è l'elenco che la
 * schermata offre, ed è un elenco corto apposta: cento emoji sono un problema
 * nuovo, non una libertà.
 */
import { testoConfrontabile } from "./categorizza";
import type { TipoCategoria } from "./tipi";

/** L'emoji che tocca a una categoria di cui si sa solo il tipo. */
export const ICONA_DEL_TIPO: Record<TipoCategoria, string> = {
  entrata: "💰",
  spesa: "💳",
  risparmio: "🐖",
  rata: "🏦",
};

/**
 * Parola riconosciuta → emoji. Il primo che combacia vince.
 *
 * Le voci stanno in ordine dalla più specifica alla più generica: «veterinario»
 * prima di «medico», «benzina» prima di «auto». Le parole sono prefissi —
 * «palestr» prende «palestra» e «palestre» — e sono lunghe almeno quattro
 * lettere, perché dentro un nome corto una parola corta combacia per caso.
 */
export const ICONE_PER_PAROLA: { emoji: string; parole: string[] }[] = [
  { emoji: "🏋️", parole: ["palestr", "crossfit", "pesi"] },
  { emoji: "🏊", parole: ["piscina", "nuoto"] },
  { emoji: "⚽", parole: ["calcio", "tennis", "sport", "padel"] },
  { emoji: "🐾", parole: ["veterinar", "animal", "cane", "gatto", "cuccio"] },
  { emoji: "🎓", parole: ["scuola", "scolast", "univers", "master", "corso", "corsi", "formazione", "libri", "librer"] },
  { emoji: "🧸", parole: ["asilo", "bambin", "figli", "nido", "giocatt"] },
  { emoji: "⛽", parole: ["benzina", "carburant", "gasolio", "diesel", "rifornim"] },
  { emoji: "🚌", parole: ["trasport", "treno", "metro", "autobus", "biglietti", "taxi", "mezzi"] },
  { emoji: "🚗", parole: ["auto", "macchina", "bollo", "officina", "gomme", "pneumat", "parchegg", "autostrad"] },
  { emoji: "✈️", parole: ["viaggi", "vacanz", "volo", "aereo", "hotel", "albergo", "ferie"] },
  { emoji: "💊", parole: ["farmac", "medicin", "salute", "medico", "dentist", "analisi", "fisioterap", "psicolog", "ottic"] },
  { emoji: "🛒", parole: ["spesa alim", "supermerc", "aliment", "drogher", "macelleri", "fruttivend"] },
  { emoji: "🍽️", parole: ["ristorant", "pizzer", "trattori", "osteria", "cena", "pranzo"] },
  { emoji: "☕", parole: ["caffe", "caffè", "colazion", "bar e", "aperitiv"] },
  { emoji: "🏠", parole: ["affitto", "casa", "condomin", "locazion", "mutuo", "arredi", "mobili"] },
  { emoji: "💡", parole: ["bollett", "luce", "energia", "elettric", "utenze"] },
  { emoji: "🔥", parole: ["gas", "metano", "riscaldam", "caldaia"] },
  { emoji: "🚿", parole: ["acqua", "idrico"] },
  { emoji: "📶", parole: ["telefon", "internet", "adsl", "fibra", "cellulare"] },
  { emoji: "🔁", parole: ["abbonament", "netflix", "spotify", "streaming"] },
  { emoji: "💻", parole: ["software", "computer", "hosting", "dominio", "licenz", "attrezzatur"] },
  { emoji: "🛡️", parole: ["assicuraz", "polizza", "rc auto"] },
  { emoji: "🏛️", parole: ["tasse", "imposte", "erario", "irpef", "f24", "inps", "contribut", "tribut"] },
  { emoji: "📋", parole: ["commercialist", "consulen", "notaio", "avvocat"] },
  { emoji: "✂️", parole: ["parrucch", "barbier", "estetis", "unghie", "cura person"] },
  { emoji: "👕", parole: ["abbigliam", "vestiti", "scarpe", "moda"] },
  { emoji: "🎁", parole: ["regal", "acquist", "shopping"] },
  { emoji: "🎬", parole: ["cinema", "teatro", "concert", "musica", "tempo libero", "svago", "hobby"] },
  { emoji: "🧹", parole: ["pulizi", "colf", "domestic", "lavander"] },
  { emoji: "🌱", parole: ["giardin", "piante", "orto"] },
  { emoji: "❤️", parole: ["donazion", "beneficen", "offert"] },
  { emoji: "🐖", parole: ["risparmi", "salvadan", "accantonam", "fondo emerg"] },
  { emoji: "📈", parole: ["investim", "etf", "azioni", "titoli", "pac", "pensione"] },
  { emoji: "🏦", parole: ["rata", "rate", "prestito", "finanziam", "leasing", "banca", "commission"] },
  { emoji: "💼", parole: ["fattur", "compens", "onorari", "clienti", "lavoro"] },
  { emoji: "🏘️", parole: ["affitti attivi", "locazioni attive", "immobil"] },
  { emoji: "➕", parole: ["altre entrate", "rimbors", "extra entrate", "bonus"] },
];

/**
 * L'emoji da proporre per un nome.
 *
 * Non torna mai vuoto: senza parole riconosciute risponde l'emoji del tipo.
 * Un valore sempre presente è quello che rende la riga uguale alle altre —
 * ed è il difetto segnalato: «Palestra» scritta a mano restava senza niente
 * accanto mentre le venti di partenza ce l'avevano.
 */
export function iconaDalNome(nome: string, tipo: TipoCategoria): string {
  const testo = testoConfrontabile(nome);
  if (testo === "") return ICONA_DEL_TIPO[tipo];
  const parole = testo.split(" ");

  /*
    **Si guardano le parole, non la stringa.**

    La prima stesura cercava la sottostringa, come fa `categorizza` sulle
    descrizioni della banca. Ma lì il testo è lungo e la parola ci sta dentro;
    qui il testo è il nome di una categoria, ed era già abbastanza per
    sbagliare: «Trasporti» contiene «sport» e prendeva il pallone. Una parola
    di una voce combacia se una parola del nome **comincia** per quella, così
    «palestr» prende «palestra» e «palestre» e «sport» non prende
    «trasporti». Le voci di due parole — «tempo libero», «altre entrate» —
    restano un confronto sull'intera frase, che è l'unico modo per cercarle.
  */
  for (const voce of ICONE_PER_PAROLA) {
    const combacia = voce.parole.some((p) =>
      p.includes(" ") ? testo.includes(p) : parole.some((w) => w.startsWith(p)),
    );
    if (combacia) return voce.emoji;
  }
  return ICONA_DEL_TIPO[tipo];
}

/**
 * Le emoji fra cui si sceglie dalla riga della categoria.
 *
 * Sono quelle del dizionario, senza ripetizioni e nell'ordine in cui stanno
 * lì: un elenco che si costruisce da solo non può divergere da quello che
 * l'app propone da sé, e il giorno in cui si aggiunge una parola l'emoji
 * nuova compare anche qui.
 */
export const ICONE_SCELTA: string[] = [
  ...new Set([...Object.values(ICONA_DEL_TIPO), ...ICONE_PER_PAROLA.map((v) => v.emoji), "❓"]),
];
