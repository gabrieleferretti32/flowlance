/**
 * Dove i due registri del denaro personale si sovrappongono.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché questo file esiste
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il denaro personale si scrive in **due posti**. Nel Cashflow c'è un
 * riepilogo mensile — prelievi, altre entrate, altre uscite — che una persona
 * compila a mano, mese per mese, e che serve alla cassa dell'attività. Nel
 * modulo delle finanze personali c'è il registro, una riga per movimento.
 *
 * Sono lo stesso denaro. Un prelievo di 800 € scritto in tutti e due i posti
 * viene contato due volte, e nessuna delle due schermate se ne accorge: la
 * prima non sa che il registro esiste, la seconda non sa del riepilogo.
 *
 * Questa funzione è nata come la misura che rompeva il silenzio, quando il
 * doppione c'era davvero. **Adesso il riepilogo si deriva dal registro**
 * (`derivazione.ts`), quindi nei mesi derivati il doppio conteggio non esiste
 * più e l'avviso che c'era in cima al Cashflow è sparito con lui.
 *
 * Quello che resta a questa funzione è il caso in cui le due scritture
 * convivono ancora per una ragione dichiarata: **l'anno chiuso**, che non si
 * deriva perché una chiusura è una dichiarazione e un import non la riscrive.
 * Lì il Cashflow dice quanti movimenti ci sono e quanto pesano, e che il
 * riepilogo resta quello della chiusura.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Entrate e uscite separate, e non un saldo
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un saldo netto andrebbe interpretato — «di che segno è un mese in cui entra
 * uno stipendio ed esce un affitto?» — e nella riga di un avviso
 * l'interpretazione è la parte che si legge male. Due cifre con il loro nome
 * si confrontano da sole con i prelievi e le altre uscite scritti accanto.
 *
 * I giroconti si contano fra i movimenti ma **non** nei totali: spostare soldi
 * da un conto personale a un altro non fa entrare né uscire niente, e sommarli
 * gonfierebbe le due cifre di una somma che non esiste.
 */
import { round2, somma } from "@/lib/fisco/aritmetica";
import type { MovimentoPf } from "./tipi";

export type MeseSovrapposto = {
  mese: number;
  quanti: number;
  entrate: number;
  uscite: number;
};

export type Sovrapposizione = {
  anno: number;
  /** Solo i mesi che hanno qualcosa, in ordine. Vuoto quando non c'è niente. */
  mesi: MeseSovrapposto[];
  quanti: number;
  entrate: number;
  uscite: number;
};

const anno = (d: string) => Number(d.slice(0, 4));
const mese = (d: string) => Number(d.slice(5, 7));

/** Le uscite: tutto quello che non è un'entrata né un giro interno. */
const USCITE: MovimentoPf["tipo"][] = ["spesa", "risparmio", "rata"];

export function sovrapposizionePersonale(
  movimenti: MovimentoPf[],
  annoScelto: number,
): Sovrapposizione {
  const dellAnno = movimenti.filter((m) => anno(m.data) === annoScelto);
  const perMese = new Map<number, MovimentoPf[]>();
  for (const m of dellAnno) {
    const k = mese(m.data);
    perMese.set(k, [...(perMese.get(k) ?? []), m]);
  }

  const conti = (righe: MovimentoPf[]) => ({
    quanti: righe.length,
    entrate: round2(somma(...righe.filter((m) => m.tipo === "entrata").map((m) => m.importo))),
    uscite: round2(somma(...righe.filter((m) => USCITE.includes(m.tipo)).map((m) => m.importo))),
  });

  const mesi = [...perMese.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([numero, righe]) => ({ mese: numero, ...conti(righe) }));

  return { anno: annoScelto, mesi, ...conti(dellAnno) };
}
