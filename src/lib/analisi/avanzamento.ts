/**
 * A che punto è l'anno rispetto al piano.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché non basta la percentuale
 * ─────────────────────────────────────────────────────────────────────────
 *
 * «Il 37 % dell'obiettivo» a ottobre non dice niente da solo: tre quarti
 * dell'anno sono passati, quindi quel 37 % è una notizia pessima, mentre lo
 * stesso 37 % a maggio sarebbe una notizia normale. Quello che decide è il
 * **ritmo**: quanto fatturi al mese contro quanto te ne servirebbe. Da lì si
 * capisce in due secondi se l'obiettivo è ambizioso o irreale, che è l'unica
 * domanda che chi guarda si sta facendo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il ritmo si misura sui mesi chiusi
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un mese in corso non è ancora un ritmo. Misurato sull'archivio di chi ha
 * scritto questo modulo, il 1° ottobre: contando tutto il fatturato — ottobre
 * compreso — sui soli nove mesi chiusi usciva 4.180,17 € al mese, contro i
 * 3.766,23 veri. Un complimento dell'11 %, costruito mettendo una fattura del
 * giorno prima al numeratore di una divisione che al denominatore si ferma a
 * settembre.
 *
 * Quindi: il **totale** è tutto quello che hai emesso, perché è una somma; il
 * **ritmo** guarda solo i mesi chiusi, perché è una velocità. I mesi che
 * restano comprendono quello in corso, e chiusi più restanti fanno sempre 12.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Tre stati, perché l'anno del piano non è sempre quello di oggi
 * ─────────────────────────────────────────────────────────────────────────
 *
 * La Pianificazione segue l'anno scelto nella barra in alto. Se è l'anno in
 * corso, «a che punto sono» ha un senso. Se è l'anno prossimo, di quell'anno
 * non c'è niente da confrontare, e confrontarlo con l'anno in corso senza
 * dirlo sarebbe il modo più elegante di mentire. Se è un anno chiuso, non è un
 * ritmo: è un consuntivo, e i mesi che restano sono zero.
 */
import { round2, somma } from "@/lib/fisco/aritmetica";

export type StatoAnno = "inCorso" | "futuro" | "chiuso";

export type IngressoAvanzamento = {
  /** L'anno del piano: quello della barra in alto, non quello di oggi. */
  anno: number;
  oggi: string;
  fatture: readonly { dataEmissione: string; imponibile: number; clienteId: string }[];
  /**
   * Le note di credito, che **tolgono** fatturato.
   *
   * Contano dalla data del documento, come l'emesso: una nota è uno storno di
   * quello che hai fatturato, e la data in cui il denaro torna indietro
   * riguarda la cassa, non il fatturato.
   */
  note: readonly { dataDocumento: string; imponibile: number }[];
  obiettivoFatturato: number;
  obiettivoClienti: number;
};

export type Avanzamento = {
  anno: number;
  stato: StatoAnno;
  /** Dodici mesi di emesso, note tolte. Può essere negativo: è la verità. */
  mensili: number[];
  /** Tutto quello che hai emesso nell'anno, mese in corso compreso. */
  fatturato: number;
  obiettivo: number;
  /** Frazione dell'obiettivo. `null` quando un obiettivo non c'è. */
  quota: number | null;
  mesiChiusi: number;
  mesiRestanti: number;
  /** Il ritmo vero, sui soli mesi chiusi. `null` se non ce n'è ancora uno. */
  ritmo: number | null;
  /** Il ritmo che l'obiettivo chiede **su tutto l'anno**: è la riga del grafico. */
  ritmoNecessario: number;
  /** Quanto manca. Zero quando l'obiettivo è superato o non c'è. */
  manca: number;
  /** Il ritmo che servirebbe **da adesso**. `null` quando non resta tempo. */
  ritmoDaAdesso: number | null;
  /** Dove arrivi tenendo il ritmo dei mesi chiusi. `null` senza ritmo. */
  proiezione: number | null;
  superato: boolean;
  /**
   * Il ritmo che servirebbe da adesso è oltre il doppio di quello vero.
   *
   * È la soglia oltre la quale la divisione smette di essere un consiglio:
   * «ti servono 21.263 € al mese» detto a chi ne fa 3.766 non è un obiettivo,
   * è un numero che fa chiudere la schermata. Al suo posto si dice dove si
   * arriva davvero, e che l'obiettivo vale per l'anno dopo.
   */
  fuoriScala: boolean;
  clienti: { fatti: number; necessari: number };
};

const meseDi = (data: string) => Number(data.slice(5, 7));
const annoDi = (data: string) => Number(data.slice(0, 4));

export function avanzamentoAnno(ing: IngressoAvanzamento): Avanzamento {
  const mensili = Array.from({ length: 12 }, () => 0);
  const fattureAnno = ing.fatture.filter((f) => annoDi(f.dataEmissione) === ing.anno);
  for (const f of fattureAnno) mensili[meseDi(f.dataEmissione) - 1] += f.imponibile;
  for (const n of ing.note) {
    if (annoDi(n.dataDocumento) !== ing.anno) continue;
    mensili[meseDi(n.dataDocumento) - 1] -= n.imponibile;
  }
  for (let i = 0; i < 12; i += 1) mensili[i] = round2(mensili[i]);

  const annoOggi = annoDi(ing.oggi);
  const stato: StatoAnno =
    ing.anno > annoOggi ? "futuro" : ing.anno < annoOggi ? "chiuso" : "inCorso";
  const mesiChiusi = stato === "chiuso" ? 12 : stato === "futuro" ? 0 : meseDi(ing.oggi) - 1;
  const mesiRestanti = 12 - mesiChiusi;

  const fatturato = round2(somma(...mensili));
  const obiettivo = round2(Math.max(0, ing.obiettivoFatturato));
  const quota = obiettivo > 0 ? fatturato / obiettivo : null;
  const superato = obiettivo > 0 && fatturato >= obiettivo;
  const manca = obiettivo > 0 && !superato ? round2(obiettivo - fatturato) : 0;

  const ritmo =
    mesiChiusi > 0 ? round2(somma(...mensili.slice(0, mesiChiusi)) / mesiChiusi) : null;
  const ritmoDaAdesso = mesiRestanti > 0 && manca > 0 ? round2(manca / mesiRestanti) : null;
  /*
    La proiezione è il ritmo dei mesi chiusi steso su dodici mesi, non il
    fatturato di adesso più il ritmo sui mesi che restano. Le due cose
    differiscono di quello che il mese in corso ha già dentro, e la prima è la
    più prudente delle due: dice dove arrivi se continui così, senza contare
    due volte un mese che deve ancora finire.
  */
  const proiezione = ritmo === null ? null : round2(ritmo * 12);

  const fuoriScala =
    ritmo !== null
    && ritmoDaAdesso !== null
    && (ritmo <= 0 ? ritmoDaAdesso > 0 : ritmoDaAdesso > 2 * ritmo);

  return {
    anno: ing.anno,
    stato,
    mensili,
    fatturato,
    obiettivo,
    quota,
    mesiChiusi,
    mesiRestanti,
    ritmo,
    ritmoNecessario: round2(obiettivo / 12),
    manca,
    ritmoDaAdesso,
    proiezione,
    superato,
    fuoriScala,
    clienti: {
      fatti: new Set(fattureAnno.map((f) => f.clienteId)).size,
      necessari: Math.max(0, Math.round(ing.obiettivoClienti)),
    },
  };
}
