/**
 * Due movimenti che sono lo stesso spostamento.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il difetto che questa funzione esiste per evitare
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Chi sposta 1.000 € dal conto corrente al deposito, e importa l'estratto di
 * tutti e due i conti, si ritrova 1.000 € di spesa e 1.000 € di entrata. Il
 * saldo totale torna — una esce, l'altra entra — ma il **report del mese** no:
 * dice che ha speso mille euro che non ha speso e guadagnato mille euro che non
 * ha guadagnato. E il limite delle variabili, che parte dalle entrate, sale di
 * mille euro che non esistono.
 *
 * Qui le due metà diventano un movimento solo, di tipo `giroconto`, che non è
 * né entrata né spesa e non cambia il totale.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le tre condizioni, e perché sono tre
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Stesso importo, conti **diversi** e tutti e due tracciati, entro tre giorni.
 * La finestra c'è perché le banche non datano allo stesso modo: l'addebito è
 * del 3, l'accredito del 4. Zero giorni perderebbe la metà dei casi veri.
 *
 * Tre e non trenta perché l'abbinamento **cancella** due movimenti veri per
 * farne uno: sbagliarlo non lascia un doppione da correggere, fa sparire una
 * spesa. Meglio un giroconto non riconosciuto — che si vede, è una spesa
 * strana in un conto — che uno riconosciuto per sbaglio.
 */
import type { MovimentoPf } from "./tipi";

export const GIORNI_DI_TOLLERANZA = 3;

const distanzaInGiorni = (a: string, b: string) =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;

export type EsitoAbbinamento = {
  /** I movimenti dopo l'abbinamento: le coppie sostituite da un giroconto. */
  movimenti: MovimentoPf[];
  /** Quante coppie sono state unite, per poterlo dire in anteprima. */
  abbinati: number;
};

/**
 * Trova le coppie e le fonde.
 *
 * Deterministico: i candidati si guardano in ordine di data e poi di id, e
 * ogni movimento entra in una coppia sola. Senza un ordine fisso lo stesso
 * file importato due volte produrrebbe abbinamenti diversi, e il conteggio
 * dei duplicati direbbe che sono movimenti nuovi.
 */
export function abbinaGiroconti(
  movimenti: MovimentoPf[],
  contiTracciati: string[],
): EsitoAbbinamento {
  const tracciato = new Set(contiTracciati);
  const ordinati = [...movimenti].sort((a, b) =>
    a.data === b.data ? a.id.localeCompare(b.id) : a.data.localeCompare(b.data),
  );
  const consumati = new Set<string>();
  const risultato: MovimentoPf[] = [];
  let abbinati = 0;

  for (const uscita of ordinati) {
    if (consumati.has(uscita.id)) continue;
    if (uscita.tipo !== "spesa" || !tracciato.has(uscita.contoId)) {
      risultato.push(uscita);
      continue;
    }
    const entrata = ordinati.find(
      (m) =>
        !consumati.has(m.id)
        && m.id !== uscita.id
        && m.tipo === "entrata"
        && tracciato.has(m.contoId)
        && m.contoId !== uscita.contoId
        && m.importo === uscita.importo
        && distanzaInGiorni(m.data, uscita.data) <= GIORNI_DI_TOLLERANZA,
    );
    if (!entrata) {
      risultato.push(uscita);
      continue;
    }
    consumati.add(uscita.id);
    consumati.add(entrata.id);
    abbinati += 1;
    /*
      Il giroconto tiene la data dell'**uscita**: è il giorno in cui la persona
      ha dato l'ordine. L'accredito è la conseguenza, e datarlo lì sposterebbe
      lo spostamento nel mese dopo ogni volta che cade a cavallo.
    */
    risultato.push({
      ...uscita,
      tipo: "giroconto",
      contoDestinazioneId: entrata.contoId,
      descrizione: uscita.descrizione || entrata.descrizione,
    });
  }

  for (const m of ordinati) {
    if (!consumati.has(m.id) && !risultato.some((r) => r.id === m.id)) risultato.push(m);
  }
  return { movimenti: risultato, abbinati };
}
