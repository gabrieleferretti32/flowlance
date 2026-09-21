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
import { effettoSulConto } from "./saldo";
import type { MovimentoPf, TipoMovimento } from "./tipi";

export type FiltroRegistro = {
  anno: number;
  /** `null` vuol dire «tutti i mesi». */
  mese: number | null;
  tipo: TipoMovimento | null;
  contoId: string | null;
};

export const FILTRO_VUOTO = (anno: number): FiltroRegistro => ({
  anno,
  mese: null,
  tipo: null,
  contoId: null,
});

const anno = (d: string) => Number(d.slice(0, 4));
const mese = (d: string) => Number(d.slice(5, 7));

/** Le uscite vere: quello che lascia il perimetro personale. */
const USCITE: TipoMovimento[] = ["spesa", "risparmio", "rata"];

/** Il movimento riguarda questo conto, da qualunque dei due capi. */
export function riguardaIlConto(m: MovimentoPf, contoId: string): boolean {
  return m.contoId === contoId || m.contoDestinazioneId === contoId;
}

/** Dal più recente al più vecchio: il registro si guarda dalla fine. */
export function filtraRegistro(movimenti: MovimentoPf[], f: FiltroRegistro): MovimentoPf[] {
  return movimenti
    .filter((m) => anno(m.data) === f.anno)
    .filter((m) => f.mese === null || mese(m.data) === f.mese)
    .filter((m) => f.tipo === null || m.tipo === f.tipo)
    .filter((m) => f.contoId === null || riguardaIlConto(m, f.contoId))
    .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
}

export type TotaliRegistro = {
  quanti: number;
  entrate: number;
  uscite: number;
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
  return {
    quanti: movimenti.length,
    entrate,
    uscite,
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
