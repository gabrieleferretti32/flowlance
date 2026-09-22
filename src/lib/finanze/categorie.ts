/**
 * Le categorie con cui il modulo nasce.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché un elenco di partenza, e non una pagina bianca
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Chi apre un modulo di budget e trova zero categorie deve inventarsele prima
 * di poter fare qualunque cosa, e le inventa male: troppe, o tutte diverse da
 * come le chiama la banca. Questo elenco è il punto di partenza — si tolgono,
 * si rinominano, se ne aggiungono — ma esiste perché il primo import abbia
 * dove mettere le righe.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le tre che nascono già «pagate dall'accantonamento»
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Tasse, INPS e F24. Sono la destinazione dei soldi che il motore fiscale
 * dice di mettere da parte ogni mese: contarle anche come spesa le
 * conterebbe due volte, e farebbe crollare il limite proprio a giugno e a
 * novembre — i mesi in cui il denaro c'era già.
 *
 * È il difetto che il flag esiste per evitare, e lasciarlo spento sulle tre
 * categorie in cui serve quasi sempre vorrebbe dire scoprirlo la prima volta
 * che si paga un acconto, guardando un limite negativo senza capire perché.
 *
 * Il commercialista **no**: è una spesa fissa vera. La paghi tu, non esce dal
 * fondo delle tasse, e nessun accantonamento l'ha già messa da parte.
 */
import type { CategoriaPf } from "./tipi";

type Seme = Omit<CategoriaPf, "id"> & { id: string };

export const CATEGORIE_INIZIALI: Seme[] = [
  // ——— Entrate ———
  /*
    «Fatture incassate» nasce con «arriva dall'attività» acceso: un bonifico di
    un cliente sul conto personale è denaro che ha lasciato la cassa della
    partita IVA. Lasciarlo spento vorrebbe dire che il flag esiste e non lo usa
    nessuno, e che il giorno della derivazione il doppio conteggio arriva lo
    stesso — che è esattamente ciò per cui il campo è stato aggiunto adesso.
  */
  { id: "fatture", tipo: "entrata", nome: "Fatture incassate", fissa: false, pagataDallAccantonamento: false, arrivaDallAttivita: true, icona: "💼" },
  { id: "altre-entrate", tipo: "entrata", nome: "Altre entrate", fissa: false, arrivaDallAttivita: false, pagataDallAccantonamento: false, icona: "➕" },

  // ——— Il fisco: già coperto dall'accantonamento ———
  { id: "tasse", tipo: "spesa", nome: "Tasse", fissa: true, arrivaDallAttivita: false, pagataDallAccantonamento: true, icona: "🏛️" },
  { id: "inps", tipo: "spesa", nome: "INPS", fissa: true, arrivaDallAttivita: false, pagataDallAccantonamento: true, icona: "🏛️" },
  { id: "f24", tipo: "spesa", nome: "F24", fissa: true, arrivaDallAttivita: false, pagataDallAccantonamento: true, icona: "🏛️" },

  // ——— Spese fisse ———
  {
    /*
      Il commercialista è una spesa fissa e basta: la paghi tu, non esce dal
      fondo delle tasse. Metterla fra le coperte toglierebbe dal limite una
      spesa che nessun accantonamento ha mai messo da parte.
    */
    id: "commercialista", tipo: "spesa", nome: "Commercialista", fissa: true,
    pagataDallAccantonamento: false, arrivaDallAttivita: false, icona: "📋",
  },
  { id: "affitto", tipo: "spesa", nome: "Affitto e casa", fissa: true, arrivaDallAttivita: false, pagataDallAccantonamento: false, icona: "🏠" },
  { id: "bollette", tipo: "spesa", nome: "Bollette", fissa: true, arrivaDallAttivita: false, pagataDallAccantonamento: false, icona: "💡" },
  { id: "abbonamenti", tipo: "spesa", nome: "Abbonamenti e software", fissa: true, arrivaDallAttivita: false, pagataDallAccantonamento: false, icona: "🔁" },
  { id: "assicurazioni", tipo: "spesa", nome: "Assicurazioni", fissa: true, arrivaDallAttivita: false, pagataDallAccantonamento: false, icona: "🛡️" },

  // ——— Spese variabili: quelle su cui il limite si può davvero decidere ———
  { id: "spesa-alimentare", tipo: "spesa", nome: "Spesa alimentare", fissa: false, arrivaDallAttivita: false, pagataDallAccantonamento: false, icona: "🛒" },
  { id: "ristoranti", tipo: "spesa", nome: "Bar e ristoranti", fissa: false, arrivaDallAttivita: false, pagataDallAccantonamento: false, icona: "🍽️" },
  { id: "trasporti", tipo: "spesa", nome: "Trasporti", fissa: false, arrivaDallAttivita: false, pagataDallAccantonamento: false, icona: "🚌" },
  { id: "salute", tipo: "spesa", nome: "Salute", fissa: false, arrivaDallAttivita: false, pagataDallAccantonamento: false, icona: "💊" },
  { id: "tempo-libero", tipo: "spesa", nome: "Tempo libero", fissa: false, arrivaDallAttivita: false, pagataDallAccantonamento: false, icona: "🎬" },
  { id: "acquisti", tipo: "spesa", nome: "Acquisti e regali", fissa: false, arrivaDallAttivita: false, pagataDallAccantonamento: false, icona: "🎁" },
  /*
    «Non definito» non è una categoria come le altre: è il posto in cui
    l'import mette quello che non ha saputo riconoscere. Serve che esista e
    che si veda, perché una riga non categorizzata che sparisce in un'altra
    categoria è una spesa attribuita a caso.
  */
  { id: "non-definito", tipo: "spesa", nome: "Non definito", fissa: false, arrivaDallAttivita: false, pagataDallAccantonamento: false, icona: "❓" },

  // ——— Risparmi e rate ———
  { id: "risparmio", tipo: "risparmio", nome: "Risparmio", fissa: false, arrivaDallAttivita: false, pagataDallAccantonamento: false, icona: "🐖" },
  { id: "investimenti", tipo: "risparmio", nome: "Investimenti", fissa: false, arrivaDallAttivita: false, pagataDallAccantonamento: false, icona: "📈" },
  { id: "rate", tipo: "rata", nome: "Rate e prestiti", fissa: false, arrivaDallAttivita: false, pagataDallAccantonamento: false, icona: "🏦" },
];

/** Dove finisce quello che l'import non ha saputo riconoscere. */
export const CATEGORIA_NON_DEFINITO = "non-definito";

/**
 * Due categorie dello stesso tipo non possono chiamarsi uguale.
 *
 * Non è pignoleria di forma: il nome è l'unica cosa che si legge scegliendo
 * una categoria in un elenco a tendina, e due «Trasporti» nello stesso elenco
 * sono due righe indistinguibili che portano in due posti diversi. Chi
 * sbaglia non se ne accorge — le spese finiscono metà di qua e metà di là — e
 * a fine mese il budget di una delle due sembra sforato senza motivo.
 *
 * Il confronto ignora maiuscole, spazi ai bordi e spazi doppi: «  Trasporti »
 * e «trasporti» sono lo stesso nome per chi legge, e la macchina deve leggere
 * come chi guarda. Gli accenti no: «però» e «pero» sono due parole diverse.
 *
 * Tipi diversi convivono: una categoria di spesa «Auto» e un risparmio «Auto»
 * non compaiono mai nello stesso elenco, perché il tipo del movimento decide
 * quale elenco si apre.
 */
export function nomeNormalizzato(nome: string): string {
  return nome.trim().replace(/\s+/g, " ").toLocaleLowerCase("it-IT");
}

export function nomeGiaUsato(
  categorie: CategoriaPf[],
  tipo: CategoriaPf["tipo"],
  nome: string,
  escludiId?: string,
): boolean {
  const cercato = nomeNormalizzato(nome);
  if (cercato === "") return false;
  return categorie.some(
    (c) => c.tipo === tipo && c.id !== escludiId && nomeNormalizzato(c.nome) === cercato,
  );
}

/**
 * Quanti movimenti ha ogni categoria in un anno.
 *
 * Serve a sapere quali categorie sono vive **prima** di toccarle: rinominare
 * una categoria con duecento movimenti dentro è una cosa, rinominarne una mai
 * usata è un'altra. I giroconti non hanno categoria e non si contano.
 */
export function usoDelleCategorie(
  movimenti: { data: string; tipo: string; categoriaId: string }[],
  anno: number,
): Map<string, number> {
  const conta = new Map<string, number>();
  for (const m of movimenti) {
    if (m.tipo === "giroconto") continue;
    if (Number(m.data.slice(0, 4)) !== anno) continue;
    conta.set(m.categoriaId, (conta.get(m.categoriaId) ?? 0) + 1);
  }
  return conta;
}

/** Tutti i movimenti che puntano a una categoria, di qualunque anno. */
export function movimentiDellaCategoria<T extends { tipo: string; categoriaId: string }>(
  movimenti: T[],
  categoriaId: string,
): T[] {
  return movimenti.filter((m) => m.tipo !== "giroconto" && m.categoriaId === categoriaId);
}
