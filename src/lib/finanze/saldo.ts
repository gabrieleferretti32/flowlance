/**
 * Il saldo di un conto, ancorato a una data.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché non si somma tutto dall'inizio
 * ─────────────────────────────────────────────────────────────────────────
 *
 * La via ovvia — saldo iniziale più tutti i movimenti — funziona solo se i
 * movimenti ci sono **tutti**. In un'app dove si importano gli estratti conto a
 * pezzi, quella condizione non è mai vera: si comincia importando gennaio,
 * poi arriva marzo, poi si recupera il 2025. Ogni import cambierebbe il saldo
 * di oggi, che è l'unico numero che l'utente può confrontare con la banca.
 *
 * Qui l'utente scrive il saldo che **legge sull'estratto conto**, con la data
 * di quella lettura. Da lì in avanti contano solo i movimenti successivi:
 * quelli precedenti sono già dentro quel numero, per definizione. Importare
 * mesi passati arricchisce la storia e non tocca il presente.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * «Successivo» vuol dire dopo, non da quel giorno
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il confronto è `data > dataRiferimento`, stretto. Il saldo letto il 20
 * settembre comprende già tutto quello che è successo il 20 settembre: contare
 * anche i movimenti di quel giorno li conterebbe due volte. È la riga su cui
 * sbaglia chiunque scriva questa funzione di fretta, e il test la fissa.
 */
import { round2, somma } from "@/lib/fisco/aritmetica";
import type { ContoPersonale, MovimentoPf } from "./tipi";

/** Quanto un movimento sposta su un dato conto: positivo entra, negativo esce. */
export function effettoSulConto(m: MovimentoPf, contoId: string): number {
  if (m.tipo === "giroconto") {
    /*
      Un giroconto ha due capi e va letto da tutti e due: esce dall'origine ed
      entra nella destinazione. Se il conto guardato è l'origine sottrae, se è
      la destinazione somma, e se non è nessuno dei due non lo riguarda.
    */
    if (m.contoId === contoId) return -m.importo;
    if (m.contoDestinazioneId === contoId) return m.importo;
    return 0;
  }
  if (m.contoId !== contoId) return 0;
  return m.tipo === "entrata" ? m.importo : -m.importo;
}

/** Il saldo del conto a una certa data, ancora compresa. */
export function saldoConto(
  conto: ContoPersonale,
  movimenti: MovimentoPf[],
  al?: string,
): number {
  const dopo = movimenti.filter(
    (m) => m.data > conto.dataRiferimento && (al === undefined || m.data <= al),
  );
  return round2(conto.saldoRiferimento + somma(...dopo.map((m) => effettoSulConto(m, conto.id))));
}

/** La somma dei conti tracciati. */
export function saldoTotale(
  conti: ContoPersonale[],
  movimenti: MovimentoPf[],
  al?: string,
): number {
  return round2(somma(...conti.map((c) => saldoConto(c, movimenti, al))));
}

export type PuntoSaldo = { data: string; saldo: number };

/**
 * La serie storica del saldo totale, un punto per ogni giorno con movimenti.
 *
 * Non un punto al giorno di calendario: un anno farebbe 365 punti quasi tutti
 * identici, e il grafico direbbe la stessa cosa con dieci volte i dati. I
 * giorni senza movimenti non cambiano il saldo, quindi non aggiungono
 * informazione — la linea fra due punti è già piatta.
 *
 * Il primo punto è l'ancora più vecchia fra i conti: prima di quella data non
 * si sa niente, e disegnare uno zero direbbe «non avevi soldi» invece di «non
 * lo so».
 */
export function serieSaldo(
  conti: ContoPersonale[],
  movimenti: MovimentoPf[],
): PuntoSaldo[] {
  if (conti.length === 0) return [];
  const ancora = conti.map((c) => c.dataRiferimento).sort()[0];
  const giorni = [
    ...new Set(movimenti.filter((m) => m.data > ancora).map((m) => m.data)),
  ].sort();
  return [
    { data: ancora, saldo: saldoTotale(conti, movimenti, ancora) },
    ...giorni.map((data) => ({ data, saldo: saldoTotale(conti, movimenti, data) })),
  ];
}
