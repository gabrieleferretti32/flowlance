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
 * deposito, quel saldo non è l'avanzamento di nessuna delle due: è il saldo di
 * un conto che ne alimenta due. Mostrarlo intero sotto ognuna dava per
 * raggiunta una meta da 900 € con 2.000 € sul conto che dovevano bastare anche
 * per le altre — **una percentuale del 222% su soldi che non erano suoi.**
 *
 * Quindi quando una fonte è condivisa **l'avanzamento non si sa**, ed è la
 * stessa risposta che si dà quando la fonte non c'è: niente barra, niente
 * percentuale, niente «raggiunta». Dividere il saldo fra le mete vorrebbe dire
 * decidere noi quale viene prima, e quella decisione non è nostra: chi vuole
 * misurarle separatamente apre due conti, o due categorie.
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
  /**
   * Un'altra meta misura la stessa fonte, quindi l'avanzamento non si sa.
   *
   * Non è un avviso accanto a un numero: è il motivo per cui il numero non
   * c'è. `accumulato`, `quota`, `mancano` e `alMese` restano `null`, e
   * `raggiunto` resta falso — con il saldo diviso fra due mete, «raggiunta»
   * non si può dire di nessuna delle due.
   */
  condivisa: boolean;
  /** I nomi delle altre mete che leggono la stessa fonte, per poterle nominare. */
  altreSullaStessaFonte: string[];
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
  /* Chi legge cosa: serve a sapere se una fonte è di una meta sola. */
  const sulla = new Map<string, ObiettivoPf[]>();
  for (const o of ing.obiettivi) {
    const chiave = chiaveFonte(o);
    if (!chiave) continue;
    sulla.set(chiave, [...(sulla.get(chiave) ?? []), o]);
  }

  return ing.obiettivi.map((obiettivo) => {
    const chiave = chiaveFonte(obiettivo);
    const altre = (chiave ? sulla.get(chiave) ?? [] : [])
      .filter((o) => o.id !== obiettivo.id)
      .map((o) => o.nome);
    const condivisa = altre.length > 0;

    /*
      La fonte condivisa non si misura: vedi il commento in testa al file. Il
      saldo esisterebbe — `accumulatoDi` lo leggerebbe — ma non è
      l'avanzamento di questa meta, ed è proprio la cifra che si leggeva bene
      e diceva il falso.
    */
    const accumulato = condivisa
      ? null
      : accumulatoDi(obiettivo, ing.conti, ing.movimenti, ing.oggi);
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

    return {
      obiettivo,
      accumulato,
      mancano,
      quota: accumulato === null ? null : round2(accumulato / obiettivo.obiettivo),
      raggiunto,
      mesiMancanti,
      alMese,
      scaduto,
      condivisa,
      altreSullaStessaFonte: altre,
      /*
        «Manca» vuol dire che la fonte dichiarata non c'è più. Una fonte
        condivisa c'è eccome: è il motivo opposto per cui non si misura, e
        confonderli farebbe dire «il conto è stato eliminato» di un conto che
        sta lì.
      */
      fonteMancante: obiettivo.fonte !== "nessuna" && !condivisa && accumulato === null,
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
