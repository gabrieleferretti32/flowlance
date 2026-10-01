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
  /**
   * Il fatturato previsto dell'anno, dodici importi.
   *
   * Si legge **solo per i mesi che devono ancora succedere**: per i mesi
   * chiusi vale sempre quello che hai emesso. Così una previsione non può mai
   * contraddire un fatto, e invecchia da sola — a dicembre l'ottobre previsto
   * non lo guarda più nessuno.
   */
  previsioni?: readonly number[] | null;
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
  /**
   * Dove arrivi: con una previsione sono fatti più promesse, senza è il ritmo
   * dei mesi chiusi steso su dodici. `null` quando non c'è né l'una né l'altro.
   */
  proiezione: number | null;
  /** Da dove viene la proiezione. Le due cose non si sommano in silenzio. */
  proiezioneDa: "ritmo" | "previsione" | null;
  /** Le previsioni dei mesi non ancora chiusi, mese per mese. Zero altrove. */
  previsti: number[];
  /** La loro somma: la parte «già concordata» della proiezione. */
  previsto: number;
  /**
   * Quanto mancherebbe **oltre** quello che è già previsto, e a che ritmo.
   * `null` quando una previsione non c'è o l'obiettivo è già coperto.
   */
  oltreLaPrevisione: { manca: number; alMese: number } | null;
  /**
   * I mesi chiusi che avevano una previsione: le due cifre, una accanto
   * all'altra, senza nessun giudizio. Servono a sapere se le previsioni
   * valgono qualcosa, ed è una domanda a cui risponde chi le ha scritte.
   */
  verificate: { mese: number; previsto: number; emesso: number }[];
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
  const proiezioneDalRitmo = ritmo === null ? null : round2(ritmo * 12);

  /*
    Le previsioni valgono solo dai mesi non chiusi in poi. Quelle dei mesi
    passati non si sommano a niente: lì c'è l'emesso, che è un fatto.
  */
  const dichiarate = ing.previsioni ?? [];
  const previsti = Array.from({ length: 12 }, (_, m) =>
    m >= mesiChiusi ? round2(Math.max(0, dichiarate[m] ?? 0)) : 0,
  );
  const previsto = round2(somma(...previsti));
  const verificate = Array.from({ length: mesiChiusi }, (_, m) => m)
    .filter((m) => (dichiarate[m] ?? 0) > 0)
    .map((m) => ({ mese: m + 1, previsto: round2(dichiarate[m] ?? 0), emesso: mensili[m] }));

  /*
    Con una previsione la proiezione smette di essere un'estrapolazione: è
    quello che hai emesso più quello che è già concordato. Le due parti restano
    separate — `fatturato` e `previsto` — perché una proiezione che somma fatti
    e promesse senza dirlo è il numero di cui ci si fida troppo.
  */
  const proiezione = previsto > 0 ? round2(fatturato + previsto) : proiezioneDalRitmo;
  const proiezioneDa = previsto > 0 ? "previsione" : proiezioneDalRitmo === null ? null : "ritmo";

  const mancaOltre = previsto > 0 && obiettivo > 0
    ? round2(Math.max(0, obiettivo - fatturato - previsto))
    : 0;
  const oltreLaPrevisione =
    previsto > 0 && mancaOltre > 0 && mesiRestanti > 0
      ? { manca: mancaOltre, alMese: round2(mancaOltre / mesiRestanti) }
      : null;

  /*
    Fuori scala si misura su quello che resta **dopo** la previsione: se i
    canoni già concordati coprono il divario, dire «non è un divario che si
    recupera» sarebbe smentito dalla riga sopra.
  */
  const daRecuperare = previsto > 0 ? oltreLaPrevisione?.alMese ?? 0 : ritmoDaAdesso;
  const fuoriScala =
    ritmo !== null
    && daRecuperare !== null
    && daRecuperare > 0
    && (ritmo <= 0 ? true : daRecuperare > 2 * ritmo);

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
    proiezioneDa,
    previsti,
    previsto,
    oltreLaPrevisione,
    verificate,
    superato,
    fuoriScala,
    clienti: {
      fatti: new Set(fattureAnno.map((f) => f.clienteId)).size,
      necessari: Math.max(0, Math.round(ing.obiettivoClienti)),
    },
  };
}
