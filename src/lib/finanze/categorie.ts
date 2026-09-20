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
  { id: "fatture", tipo: "entrata", nome: "Fatture incassate", fissa: false, pagataDallAccantonamento: false, icona: "💼" },
  { id: "altre-entrate", tipo: "entrata", nome: "Altre entrate", fissa: false, pagataDallAccantonamento: false, icona: "➕" },

  // ——— Il fisco: già coperto dall'accantonamento ———
  { id: "tasse", tipo: "spesa", nome: "Tasse", fissa: true, pagataDallAccantonamento: true, icona: "🏛️" },
  { id: "inps", tipo: "spesa", nome: "INPS", fissa: true, pagataDallAccantonamento: true, icona: "🏛️" },
  { id: "f24", tipo: "spesa", nome: "F24", fissa: true, pagataDallAccantonamento: true, icona: "🏛️" },

  // ——— Spese fisse ———
  {
    /*
      Il commercialista è una spesa fissa e basta: la paghi tu, non esce dal
      fondo delle tasse. Metterla fra le coperte toglierebbe dal limite una
      spesa che nessun accantonamento ha mai messo da parte.
    */
    id: "commercialista", tipo: "spesa", nome: "Commercialista", fissa: true, pagataDallAccantonamento: false, icona: "📋",
  },
  { id: "affitto", tipo: "spesa", nome: "Affitto e casa", fissa: true, pagataDallAccantonamento: false, icona: "🏠" },
  { id: "bollette", tipo: "spesa", nome: "Bollette", fissa: true, pagataDallAccantonamento: false, icona: "💡" },
  { id: "abbonamenti", tipo: "spesa", nome: "Abbonamenti e software", fissa: true, pagataDallAccantonamento: false, icona: "🔁" },
  { id: "assicurazioni", tipo: "spesa", nome: "Assicurazioni", fissa: true, pagataDallAccantonamento: false, icona: "🛡️" },

  // ——— Spese variabili: quelle su cui il limite si può davvero decidere ———
  { id: "spesa-alimentare", tipo: "spesa", nome: "Spesa alimentare", fissa: false, pagataDallAccantonamento: false, icona: "🛒" },
  { id: "ristoranti", tipo: "spesa", nome: "Bar e ristoranti", fissa: false, pagataDallAccantonamento: false, icona: "🍽️" },
  { id: "trasporti", tipo: "spesa", nome: "Trasporti", fissa: false, pagataDallAccantonamento: false, icona: "🚌" },
  { id: "salute", tipo: "spesa", nome: "Salute", fissa: false, pagataDallAccantonamento: false, icona: "💊" },
  { id: "tempo-libero", tipo: "spesa", nome: "Tempo libero", fissa: false, pagataDallAccantonamento: false, icona: "🎬" },
  { id: "acquisti", tipo: "spesa", nome: "Acquisti e regali", fissa: false, pagataDallAccantonamento: false, icona: "🎁" },
  /*
    «Non definito» non è una categoria come le altre: è il posto in cui
    l'import mette quello che non ha saputo riconoscere. Serve che esista e
    che si veda, perché una riga non categorizzata che sparisce in un'altra
    categoria è una spesa attribuita a caso.
  */
  { id: "non-definito", tipo: "spesa", nome: "Non definito", fissa: false, pagataDallAccantonamento: false, icona: "❓" },

  // ——— Risparmi e rate ———
  { id: "risparmio", tipo: "risparmio", nome: "Risparmio", fissa: false, pagataDallAccantonamento: false, icona: "🐖" },
  { id: "investimenti", tipo: "risparmio", nome: "Investimenti", fissa: false, pagataDallAccantonamento: false, icona: "📈" },
  { id: "rate", tipo: "rata", nome: "Rate e prestiti", fissa: false, pagataDallAccantonamento: false, icona: "🏦" },
];

/** Dove finisce quello che l'import non ha saputo riconoscere. */
export const CATEGORIA_NON_DEFINITO = "non-definito";
