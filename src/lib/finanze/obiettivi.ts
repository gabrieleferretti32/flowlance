/**
 * Le mete di risparmio: quanto manca, e in quanto tempo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'avanzamento si misura, non si dichiara
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il modo diffuso di fare questa schermata è un campo «quanto hai messo da
 * parte finora» che si aggiorna a mano. È un numero che invecchia dal giorno
 * dopo: dice 3.000 € per mesi mentre sul conto ce ne sono 1.800, e la barra
 * colorata continua a riempirsi. Chi la guarda non ha modo di sapere che sta
 * guardando una fotografia vecchia.
 *
 * Qui l'accumulato viene sempre da qualcosa che esiste già: **il saldo di un
 * conto** — quello ancorato, lo stesso che si vede in Conti e patrimonio — o
 * **la somma dei movimenti di una categoria** da una data in poi. Quando non
 * c'è nessuna fonte, l'avanzamento è `null` e la schermata scrive che non si
 * sa. Una meta senza misura resta una meta: quello che non può restare è una
 * percentuale inventata.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Due mete sulla stessa fonte sono gli stessi euro, due volte
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Se «Vacanza» e «Fondo emergenza» misurano tutte e due il saldo del conto
 * deposito, quel saldo compare intero sotto tutte e due, e la somma delle
 * barre racconta un patrimonio che non c'è. È la stessa famiglia di difetti
 * che questo progetto insegue — gli stessi soldi disponibili in due posti — e
 * qui si può almeno **dire**: `condivisa` marca le mete che si contendono una
 * fonte, e la schermata lo scrive accanto alla barra.
 */
import { round2, somma } from "@/lib/fisco/aritmetica";
import { mesiFinoA } from "@/lib/fisco/accantonamento";
import { saldoConto } from "./saldo";
import type { ContoPersonale, MovimentoPf, ObiettivoPf } from "./tipi";

export type StatoObiettivo = {
  obiettivo: ObiettivoPf;
  /** Quanto c'è, misurato. `null` quando non c'è una fonte da cui misurarlo. */
  accumulato: number | null;
  /** Quanto manca. `null` insieme ad `accumulato`. Mai negativo. */
  mancano: number | null;
  /** Accumulato diviso obiettivo. `null` senza fonte; può superare 1. */
  quota: number | null;
  raggiunto: boolean;
  /** I mesi che mancano alla data, questo compreso. `null` senza data. */
  mesiMancanti: number | null;
  /**
   * Quanto mettere via al mese per arrivarci.
   *
   * Senza data è `null`: «quanto al mese» non vuol dire niente se non c'è un
   * quando. A data passata è tutto quello che manca, subito — la stessa
   * scelta che fa l'accantonamento con una scadenza scaduta, e per la stessa
   * ragione: dividere per zero mesi, o per uno, direbbe una cifra più bassa
   * di quella che serve.
   */
  alMese: number | null;
  /** La data è passata e la meta non è raggiunta. */
  scaduto: boolean;
  /** Un'altra meta misura la stessa fonte: gli stessi euro contano due volte. */
  condivisa: boolean;
  /** La fonte dichiarata non esiste più: cancellata, o mai esistita. */
  fonteMancante: boolean;
};

export type IngressoObiettivi = {
  obiettivi: ObiettivoPf[];
  conti: ContoPersonale[];
  movimenti: MovimentoPf[];
  oggi: string;
};

/** La chiave con cui due mete si accorgono di guardare la stessa cosa. */
const chiaveFonte = (o: ObiettivoPf) => (o.fonteId ? `${o.fonte}|${o.fonteId}` : null);

/**
 * Quanto c'è, secondo la fonte dichiarata.
 *
 * `null` è una risposta: vuol dire «non misurabile», e va tenuta distinta da
 * zero. Zero è «non hai ancora messo via niente», che è un fatto; `null` è
 * «non lo sappiamo», che è un'altra cosa e si scrive diversamente.
 */
function accumulatoDi(
  obiettivo: ObiettivoPf,
  conti: ContoPersonale[],
  movimenti: MovimentoPf[],
  oggi: string,
): number | null {
  if (obiettivo.fonte === "nessuna" || !obiettivo.fonteId) return null;

  if (obiettivo.fonte === "conto") {
    const conto = conti.find((c) => c.id === obiettivo.fonteId);
    if (!conto) return null;
    return saldoConto(conto, movimenti, oggi);
  }

  /*
    La categoria: si sommano i movimenti **da `dal` in poi**, estremo
    compreso. Senza quella data entrerebbero anche i risparmi di tre anni fa,
    già spesi per altro, e una meta scritta stamattina risulterebbe quasi
    raggiunta. I giroconti restano fuori: spostare soldi fra due conti propri
    non è metterli da parte.
  */
  const suoi = movimenti.filter(
    (m) =>
      m.categoriaId === obiettivo.fonteId &&
      m.tipo !== "giroconto" &&
      m.data >= obiettivo.dal &&
      m.data <= oggi,
  );
  return round2(somma(...suoi.map((m) => m.importo)));
}

export function statoObiettivi(ing: IngressoObiettivi): StatoObiettivo[] {
  const quante = new Map<string, number>();
  for (const o of ing.obiettivi) {
    const chiave = chiaveFonte(o);
    if (chiave) quante.set(chiave, (quante.get(chiave) ?? 0) + 1);
  }

  return ing.obiettivi.map((obiettivo) => {
    const accumulato = accumulatoDi(obiettivo, ing.conti, ing.movimenti, ing.oggi);
    const mancano = accumulato === null ? null : round2(Math.max(0, obiettivo.obiettivo - accumulato));
    const raggiunto = accumulato !== null && accumulato >= obiettivo.obiettivo;
    const mesiMancanti = obiettivo.entro ? mesiFinoA(obiettivo.entro, ing.oggi) : null;
    const scaduto = obiettivo.entro !== null && obiettivo.entro < ing.oggi && !raggiunto;

    /*
      Il fabbisogno mensile si calcola su quello che manca, non sull'obiettivo
      intero: chi ha già 2.000 dei 3.000 non deve mettere via 3.000 diviso i
      mesi. E quando la fonte non c'è resta `null`, perché non si sa quanto
      manchi — un «al mese» calcolato sull'intero sarebbe una cifra sicura di
      sé costruita sul niente.
    */
    const alMese =
      mesiMancanti === null || mancano === null || raggiunto
        ? null
        : mesiMancanti === 0
          ? mancano
          : round2(mancano / mesiMancanti);

    const chiave = chiaveFonte(obiettivo);
    return {
      obiettivo,
      accumulato,
      mancano,
      quota: accumulato === null ? null : round2(accumulato / obiettivo.obiettivo),
      raggiunto,
      mesiMancanti,
      alMese,
      scaduto,
      condivisa: chiave !== null && (quante.get(chiave) ?? 0) > 1,
      fonteMancante: obiettivo.fonte !== "nessuna" && accumulato === null,
    };
  });
}

/**
 * Quanto chiedono in tutto le mete, al mese.
 *
 * Le mete senza data non entrano — non chiedono niente entro una data — e
 * nemmeno quelle senza fonte: sommare un fabbisogno calcolato su un
 * avanzamento sconosciuto farebbe un totale con dentro un'invenzione. Il
 * numero di quelle escluse torna insieme al totale, perché una somma che
 * lascia fuori qualcosa deve dire quanto.
 */
export function fabbisognoMensile(stati: StatoObiettivo[]): {
  totale: number;
  contate: number;
  escluse: number;
} {
  const conQuota = stati.filter((s) => s.alMese !== null);
  return {
    totale: round2(somma(...conQuota.map((s) => s.alMese!))),
    contate: conQuota.length,
    escluse: stati.filter((s) => s.alMese === null && !s.raggiunto).length,
  };
}

/**
 * L'ordine in cui si leggono: prima quelle da finire, poi quelle finite.
 *
 * Senza un ordine dichiarato l'elenco esce come capita — in archivio le righe
 * stanno nell'ordine dell'identificatore, che è casuale — e una meta scaduta
 * può finire in fondo, sotto due già raggiunte. Dentro i due gruppi decide la
 * data: prima quella che scade prima, e le mete senza data in coda, perché
 * «senza fretta» è l'ultima cosa da guardare.
 */
export function inOrdine(stati: StatoObiettivo[]): StatoObiettivo[] {
  return [...stati].sort((a, b) => {
    if (a.raggiunto !== b.raggiunto) return a.raggiunto ? 1 : -1;
    const da = a.obiettivo.entro;
    const db = b.obiettivo.entro;
    if (da !== db) {
      if (!da) return 1;
      if (!db) return -1;
      return da < db ? -1 : 1;
    }
    return a.obiettivo.nome.localeCompare(b.obiettivo.nome, "it");
  });
}
