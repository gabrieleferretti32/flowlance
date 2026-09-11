/**
 * Gli aggregati che il cruscotto legge. Funzioni pure sui documenti già
 * calcolati: nessun accesso all'archivio, nessuna data implicita.
 */
import { nonNegativo, rapporto, round2, somma } from "@/lib/fisco/aritmetica";
import { annoDi, meseDi } from "@/lib/fisco/documenti";
import type { CostoCalcolato, FatturaCalcolata } from "@/lib/fisco/tipi";
import { type NotaCalcolata, type StornoSuFattura, storniDiCassa, stornoPerFattura } from "@/lib/fisco/note";
import type { Cliente } from "@/lib/dati/tipi";
import type { Adempimento } from "@/lib/fisco/scadenze";

export type MeseAndamento = {
  mese: number;
  etichetta: string;
  emesso: number;
  incassato: number;
  costi: number;
  /** Incassato al netto dei costi pagati, cumulato da gennaio. */
  cumulatoIncassato: number;
};

export type RigaCliente = {
  id: string;
  nome: string;
  colore: string;
  emesso: number;
  incassato: number;
  daIncassare: number;
  scaduto: number;
  numeroFatture: number;
  ticketMedio: number;
  giorniMediIncasso: number | null;
  quota: number;
};

export type FasceScaduto = {
  neiTermini: number;
  entro30: number;
  entro60: number;
  entro90: number;
  oltre90: number;
  totaleScaduto: number;
};

const MESI_BREVI = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

/** Dodici mesi, sempre tutti: un grafico con i buchi è illeggibile. */
export function andamentoMensile(
  fatture: FatturaCalcolata[],
  costi: CostoCalcolato[],
  anno: number,
  note: NotaCalcolata[] = [],
): MeseAndamento[] {
  const righe: MeseAndamento[] = [];
  const storniCassa = storniDiCassa(note, fatture);
  let cumulato = 0;
  for (let m = 1; m <= 12; m++) {
    // `ricavoRilevante` da tutt'e due le parti — imponibile più rivalsa — e non
    // l'imponibile di qua e il ricavo di là: le due colonne stanno sullo stesso
    // asse e si confrontano a vista, e con la rivalsa attiva la stessa fattura
    // ne disegnava due di altezza diversa. Quella differenza si legge come un
    // incasso mancante, che è il modo peggiore di sbagliare un grafico.
    const emesso = somma(
      ...fatture
        .filter((f) => annoDi(f.dataEmissione) === anno && meseDi(f.dataEmissione) === m)
        .map((f) => f.ricavoRilevante),
    );
    const incassato = somma(
      ...fatture
        .filter((f) => f.dataIncasso && annoDi(f.dataIncasso) === anno && meseDi(f.dataIncasso) === m)
        .map((f) => f.ricavoRilevante),
    );
    // Le note di credito abbassano le due serie come abbassano il fatturato:
    // lo storno emesso alla data del documento, quello rimborsato alla data in
    // cui il denaro è tornato indietro. Senza, il grafico diceva un numero e la
    // card sopra ne diceva un altro, sotto la stessa parola.
    const stornoEmesso = somma(
      ...note
        .filter((n) => annoDi(n.dataDocumento) === anno && meseDi(n.dataDocumento) === m)
        .map((n) => n.imponibile),
    );
    /*
      Lo storno di cassa non è «la nota rimborsata questo mese»: è il movimento
      in cui il denaro si è mosso, che quasi sempre è un incasso al netto e non
      un rimborso. La regola sta in `storniDiCassa`, la stessa che usa il
      motore: se qui ne vivesse una seconda, il grafico e il riquadro sopra
      tornerebbero a dire due numeri diversi sotto la stessa parola.
    */
    const stornoRimborsato = somma(
      ...storniCassa
        .filter((s) => annoDi(s.data) === anno && meseDi(s.data) === m)
        .map((s) => s.importo),
    );
    const costiMese = somma(
      ...costi
        .filter((c) => c.dataPagamento && annoDi(c.dataPagamento) === anno && meseDi(c.dataPagamento) === m)
        .map((c) => c.costoNetto),
    );
    const emessoNetto = round2(emesso - stornoEmesso);
    const incassatoNetto = round2(incassato - stornoRimborsato);
    cumulato = round2(cumulato + incassatoNetto - costiMese);
    righe.push({
      mese: m,
      etichetta: MESI_BREVI[m - 1],
      emesso: emessoNetto,
      incassato: incassatoNetto,
      costi: costiMese,
      cumulatoIncassato: cumulato,
    });
  }
  return righe;
}

/** Quanto vale ancora una fattura aperta: il netto dopo le note, non il lordo. */
function nettoAperta(f: FatturaCalcolata, perFattura: Map<string, StornoSuFattura>): number {
  const stornato = perFattura.get(f.id)?.stornato ?? 0;
  if (stornato === 0) return f.nettoIncasso;
  // In proporzione sull'imponibile, così ritenuta e IVA scendono con lui invece
  // di restare intere su una fattura che il cliente pagherà a metà.
  return round2(f.nettoIncasso * rapporto(nonNegativo(round2(f.imponibile - stornato)), f.imponibile));
}

/** Il portafoglio clienti, dal più grande al più piccolo. */
/**
 * @param note le note di credito: senza, ogni colonna di questa tabella è al
 * lordo degli storni, e un cliente che ha stornato metà dell'anno compare come
 * il primo del portafoglio. Il parametro ha un valore predefinito perché il
 * caso «nessuna nota» è la maggioranza degli archivi, non perché sia facoltativo.
 */
export function portafoglioClienti(
  fatture: FatturaCalcolata[],
  clienti: Cliente[],
  anno: number,
  coloreDi: (nome: string) => string,
  note: NotaCalcolata[] = [],
): RigaCliente[] {
  const emesseNellAnno = fatture.filter((f) => annoDi(f.dataEmissione) === anno);
  /*
    Gli storni, dai due lati e con le stesse regole del motore: quello emesso
    segue la data del documento, quello di cassa il movimento vero. E il netto
    per fattura serve alle aperte, che valgono quanto il cliente pagherà.
  */
  const storniCassa = storniDiCassa(note, fatture);
  const perFattura = stornoPerFattura(note, fatture);
  const stornoEmessoDi = (clienteId: string) =>
    somma(
      ...note
        .filter((n) => n.clienteId === clienteId && annoDi(n.dataDocumento) === anno)
        .map((n) => n.imponibile),
    );
  /*
    `incassato` in questa tabella è il netto incasso — imponibile più IVA meno
    ritenuta — mentre `emesso` è l'imponibile. Sono due basi diverse, ed è così
    da prima di questa modifica: qui non si cambia, ma lo storno va tolto
    **sulla stessa base della colonna da cui si toglie**, altrimenti si mette a
    confronto un lordo con un netto e il risultato non è nessuno dei due.
  */
  const notePerId = new Map(note.map((n) => [n.id, n]));
  const stornoCassaDi = (clienteId: string) =>
    somma(
      ...storniCassa
        .filter((s) => annoDi(s.data) === anno && notePerId.get(s.notaId)?.clienteId === clienteId)
        .map((s) => {
          const n = notePerId.get(s.notaId);
          return n ? round2(s.importo * rapporto(n.totale, n.imponibile)) : s.importo;
        }),
    );
  const totale = round2(
    somma(...emesseNellAnno.map((f) => f.imponibile))
      - somma(...clienti.map((c) => stornoEmessoDi(c.id))),
  );

  const righe = clienti.map((cliente): RigaCliente => {
    const sue = emesseNellAnno.filter((f) => f.clienteId === cliente.id);
    const emesso = nonNegativo(
      round2(somma(...sue.map((f) => f.imponibile)) - stornoEmessoDi(cliente.id)),
    );
    const incassate = fatture.filter(
      (f) => f.clienteId === cliente.id && f.dataIncasso && annoDi(f.dataIncasso) === anno,
    );
    const aperte = fatture.filter((f) => f.clienteId === cliente.id && !f.dataIncasso);
    const giorni = incassate
      .map((f) => f.giorniIncasso)
      .filter((g): g is number => g !== null);

    return {
      id: cliente.id,
      nome: cliente.nome,
      colore: coloreDi(cliente.nome),
      emesso,
      incassato: nonNegativo(
        round2(somma(...incassate.map((f) => f.nettoIncasso)) - stornoCassaDi(cliente.id)),
      ),
      daIncassare: somma(...aperte.map((f) => nettoAperta(f, perFattura))),
      scaduto: somma(
        ...aperte.filter((f) => f.giorniRitardo > 0).map((f) => nettoAperta(f, perFattura)),
      ),
      numeroFatture: sue.length,
      ticketMedio: sue.length > 0 ? round2(emesso / sue.length) : 0,
      giorniMediIncasso:
        giorni.length > 0 ? Math.round(giorni.reduce((a, g) => a + g, 0) / giorni.length) : null,
      quota: rapporto(emesso, totale),
    };
  });

  return righe.filter((r) => r.numeroFatture > 0 || r.daIncassare > 0)
    .sort((a, b) => b.emesso - a.emesso);
}

/**
 * Lo scaduto per fascia di ritardo. La concentrazione del credito nelle fasce
 * lunghe è il segnale che una fattura non rientrerà da sola.
 */
export function scadutoPerFascia(fatture: FatturaCalcolata[]): FasceScaduto {
  const aperte = fatture.filter((f) => !f.dataIncasso);
  const inFascia = (da: number, a: number) =>
    somma(
      ...aperte.filter((f) => f.giorniRitardo >= da && f.giorniRitardo <= a).map((f) => f.nettoIncasso),
    );
  const neiTermini = somma(...aperte.filter((f) => f.giorniRitardo === 0).map((f) => f.nettoIncasso));
  const entro30 = inFascia(1, 30);
  const entro60 = inFascia(31, 60);
  const entro90 = inFascia(61, 90);
  const oltre90 = somma(...aperte.filter((f) => f.giorniRitardo > 90).map((f) => f.nettoIncasso));
  return {
    neiTermini,
    entro30,
    entro60,
    entro90,
    oltre90,
    totaleScaduto: somma(entro30, entro60, entro90, oltre90),
  };
}

/** Giorni medi fra emissione e accredito, sulle fatture già incassate. */
export function giorniMediIncasso(fatture: FatturaCalcolata[]): number | null {
  const giorni = fatture.map((f) => f.giorniIncasso).filter((g): g is number => g !== null);
  if (giorni.length === 0) return null;
  return Math.round(giorni.reduce((a, g) => a + g, 0) / giorni.length);
}

/**
 * Quanto pesa il cliente più grande. Sopra il 40% una disdetta dimezza l'anno:
 * è il rischio numero uno di chi lavora da solo.
 */
export function concentrazione(portafoglio: RigaCliente[]): number {
  return portafoglio[0]?.quota ?? 0;
}

// ————————————————————————————————————————————————————————————
// La prossima scadenza da pagare
// ————————————————————————————————————————————————————————————

export type ProssimoVersamento = {
  /** Quello che si versa in quel giorno. Vuoto se non c'è niente in arrivo. */
  dovute: Adempimento[];
  /** La somma degli importi noti. `null` se nessuna delle `dovute` ne ha uno. */
  importo: number | null;
  /** Quante fra le `dovute` non hanno un importo stimato. */
  senzaImporto: number;
  /**
   * I versamenti più vicini di questo, scavalcati perché nessuno di loro ha un
   * importo stimato. Vanno detti: la card mostra una data che non è la prima
   * cosa che succede, e tacerlo la farebbe sembrare la prima.
   */
  scavalcati: Adempimento[];
};

/**
 * Che cosa mostra la card «Prossima scadenza».
 *
 * Non è «il primo adempimento in arrivo»: è **il primo versamento di cui si
 * conosce l'importo**. La differenza nasce da un caso vero — su un archivio
 * appena avviato la prima scadenza non dichiarativa era l'imposta di bollo del
 * 4° trimestre, che un importo stimato non ce l'ha, e la card più utile del
 * cruscotto mostrava un trattino.
 *
 * Gli adempimenti senza importo non sono un'eccezione da ignorare: sono cinque
 * — bollo del trimestre, IVA di dicembre dell'anno prima, rinvio di luglio,
 * acconto IVA, e saldo e acconti quando manca l'anno da cui calcolarli.
 *
 * Quindi si scavalcano, ma **si nominano**: chi legge deve poter sapere che
 * prima di quella data c'è dell'altro. Se nessuno dei prossimi ha un importo si
 * torna al primo in assoluto e la card mostra il trattino — meglio un trattino
 * che un numero preso da una data diversa da quella scritta sotto.
 *
 * Le dichiarazioni restano fuori: una LIPE da inviare non è denaro che esce, e
 * in una card che risponde a «quanto e quando pago» sarebbe fuori posto.
 */
export function prossimoVersamento(
  scadenze: readonly Adempimento[],
  oggi: string,
): ProssimoVersamento {
  const inArrivo = scadenze
    .filter((s) => s.data >= oggi && s.categoria !== "dichiarazione")
    // L'ordine arriva già giusto da `scadenzeAnno`, ma qui si concatenano due
    // anni: ordinare costa niente e toglie di mezzo un'assunzione.
    .sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));

  const dataUtile = inArrivo.find((s) => s.importo !== null)?.data ?? inArrivo[0]?.data ?? null;
  if (dataUtile === null) {
    return { dovute: [], importo: null, senzaImporto: 0, scavalcati: [] };
  }

  // Tutto quello che cade in quel giorno, non solo la prima voce: il 16
  // novembre un artigiano versa la rata INPS *e* l'IVA del trimestre, e una
  // card che ne mostrasse una sola direbbe un numero più basso del vero.
  const dovute = inArrivo.filter((s) => s.data === dataUtile);
  const conImporto = dovute.filter((s) => s.importo !== null);

  return {
    dovute,
    importo:
      conImporto.length > 0
        ? round2(conImporto.reduce((a, s) => a + (s.importo ?? 0), 0))
        : null,
    senzaImporto: dovute.length - conImporto.length,
    scavalcati: inArrivo.filter((s) => s.data < dataUtile),
  };
}
