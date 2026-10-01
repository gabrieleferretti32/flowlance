/**
 * Il registro dei movimenti: cosa si vede, e quanto fa.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il filtro per conto deve vedere i due capi di un giroconto
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un giroconto ha un'origine e una destinazione. Filtrando per conto, tenere
 * solo le righe con `contoId` uguale vuol dire che i mille euro **arrivati**
 * sul libretto non compaiono nel libretto: il saldo li conta — `saldoConto`
 * legge tutti e due i capi — e l'elenco no. Due letture della stessa cassa che
 * smettono di essere d'accordo, con l'elenco che sembra incompleto e nessuno
 * che possa dire perché.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Due totali con il loro nome, invece di uno da interpretare
 * ─────────────────────────────────────────────────────────────────────────
 *
 * «Entrate» e «uscite» si confrontano da sole. Un saldo unico andrebbe letto
 * sapendo che cosa ci è dentro, e quando c'è un conto selezionato quello che
 * serve è un'altra cosa ancora: **l'effetto su quel conto**, che comprende i
 * giroconti e ne conosce il verso. Sono tre domande diverse, e ognuna ha il
 * suo numero invece di un totale che prova a rispondere a tutte.
 */
import { round2, somma } from "@/lib/fisco/aritmetica";
import { testoConfrontabile } from "./parole";
import { effettoSulConto } from "./saldo";
import type { ContoPersonale, MovimentoPf, TipoMovimento } from "./tipi";

export type FiltroRegistro = {
  anno: number;
  /** `null` vuol dire «tutti i mesi». */
  mese: number | null;
  tipo: TipoMovimento | null;
  contoId: string | null;
  /**
   * Un pezzo di descrizione da cercare. Vuoto vuol dire «tutte».
   *
   * Solo la descrizione, non la categoria e non il conto: quelli hanno già il
   * loro menu, e cercando «bollette» uscirebbero anche le righe che quella
   * parola non la contengono — «trovato» smetterebbe di voler dire una cosa
   * sola.
   *
   * Il confronto passa da `testoConfrontabile` — minuscole, senza
   * punteggiatura, spazi ridotti — **più gli accenti tolti**: «n.6098032» si
   * trova scrivendo «6098032», e «caffè» trova «CAFFE' CENTRALE». Chi cerca
   * una riga che ricorda a memoria non ricorda come la banca ha scritto gli
   * accenti.
   */
  testo: string;
};

export const FILTRO_VUOTO = (anno: number): FiltroRegistro => ({
  anno,
  mese: null,
  tipo: null,
  contoId: null,
  testo: "",
});

const anno = (d: string) => Number(d.slice(0, 4));
const mese = (d: string) => Number(d.slice(5, 7));

/** Le uscite vere: quello che lascia il perimetro personale. */
const USCITE: TipoMovimento[] = ["spesa", "risparmio", "rata"];

/**
 * Il testo come lo si cerca: quello del dizionario, più gli accenti tolti.
 *
 * Gli accenti si tolgono **qui e non in `testoConfrontabile`**, che sembrerebbe
 * il posto giusto. Quella funzione calcola anche l'impronta con cui si
 * riconosce un movimento già importato (`firmaMovimento`): cambiandola, le
 * impronte scritte in archivio e quelle calcolate domani non coinciderebbero
 * più, e lo stesso rendiconto ricaricato rientrerebbe tutto come nuovo. Una
 * comodità di ricerca non vale un archivio raddoppiato.
 */
const perCercare = (testo: string) =>
  testoConfrontabile(testo)
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

/** Il movimento riguarda questo conto, da qualunque dei due capi. */
export function riguardaIlConto(m: MovimentoPf, contoId: string): boolean {
  return m.contoId === contoId || m.contoDestinazioneId === contoId;
}

/** Dal più recente al più vecchio: il registro si guarda dalla fine. */
export function filtraRegistro(movimenti: MovimentoPf[], f: FiltroRegistro): MovimentoPf[] {
  /* Normalizzato una volta sola, non a ogni riga: con qualche migliaio di
     movimenti sarebbero qualche migliaio di normalizzazioni per ogni tasto. */
  const cercato = perCercare(f.testo);
  return movimenti
    .filter((m) => anno(m.data) === f.anno)
    .filter((m) => f.mese === null || mese(m.data) === f.mese)
    .filter((m) => f.tipo === null || m.tipo === f.tipo)
    .filter((m) => f.contoId === null || riguardaIlConto(m, f.contoId))
    .filter((m) => cercato === "" || perCercare(m.descrizione).includes(cercato))
    .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
}

export type TotaliRegistro = {
  quanti: number;
  entrate: number;
  uscite: number;
  /**
   * Quanto, delle entrate, è denaro che era già tuo.
   *
   * Il totale delle entrate resta intero — su quel conto quei soldi sono
   * arrivati davvero, ed è quello che il registro racconta — ma senza questa
   * cifra la riga del registro e il limite del mese direbbero due numeri
   * diversi senza che niente spieghi la differenza. È lo scarto che si scopre
   * mesi dopo, contando a mano.
   */
  trasferimenti: number;
  /** Entrate meno uscite. I giroconti non ci sono: non entra né esce niente. */
  netto: number;
  /**
   * L'effetto sul conto selezionato, giroconti compresi. `null` quando i conti
   * sono tutti: la somma degli effetti su conti diversi non vuol dire niente.
   */
  effettoSulConto: number | null;
};

export function totaliRegistro(
  movimenti: MovimentoPf[],
  contoId: string | null,
): TotaliRegistro {
  const entrate = round2(
    somma(...movimenti.filter((m) => m.tipo === "entrata").map((m) => m.importo)),
  );
  const uscite = round2(
    somma(...movimenti.filter((m) => USCITE.includes(m.tipo)).map((m) => m.importo)),
  );
  const trasferimenti = round2(
    somma(
      ...movimenti
        .filter((m) => m.tipo === "entrata" && m.daUnAltroTuoConto)
        .map((m) => m.importo),
    ),
  );
  return {
    quanti: movimenti.length,
    entrate,
    uscite,
    trasferimenti,
    netto: round2(entrate - uscite),
    effettoSulConto:
      contoId === null
        ? null
        : round2(somma(...movimenti.map((m) => effettoSulConto(m, contoId)))),
  };
}

/** I mesi che hanno almeno un movimento nell'anno, per non offrire mesi vuoti. */
export function mesiConMovimenti(movimenti: MovimentoPf[], annoScelto: number): number[] {
  return [
    ...new Set(movimenti.filter((m) => anno(m.data) === annoScelto).map((m) => mese(m.data))),
  ].sort((a, b) => a - b);
}

/**
 * Quanti movimenti su quale conto, contati **sui movimenti**.
 *
 * Serve a dire dove sono finiti, subito dopo un import e nello storico, e a
 * dirlo leggendo l'archivio invece della scelta fatta in anteprima. È la
 * differenza fra una misura e un'eco: se il conto si perde per strada — è
 * successo, con due file che si chiamavano uguale — una frase costruita sulla
 * scelta continuerebbe a dire «su Intesa Sanpaolo» mentre in archivio c'è
 * scritto un altro conto. Questa no.
 *
 * L'ordine è per quantità, poi per nome: la riga più grossa per prima, e a
 * parità un ordine che non cambia fra un render e l'altro.
 */
export function movimentiPerConto(
  /* Basta il conto: così la stessa funzione conta le righe dell'anteprima —
     che movimenti non sono ancora — e i movimenti scritti in archivio. */
  movimenti: { contoId: string }[],
  conti: ContoPersonale[],
): { contoId: string; nome: string; quanti: number }[] {
  const nomi = new Map(conti.map((c) => [c.id, c.nome]));
  const conteggio = new Map<string, number>();
  for (const m of movimenti) {
    conteggio.set(m.contoId, (conteggio.get(m.contoId) ?? 0) + 1);
  }
  return [...conteggio]
    .map(([contoId, quanti]) => ({
      contoId,
      /* Un conto cancellato resta un conto: dirlo è meglio che non dirlo. */
      nome: nomi.get(contoId) ?? "conto non più in elenco",
      quanti,
    }))
    .sort((a, b) => b.quanti - a.quanti || a.nome.localeCompare(b.nome, "it"));
}
