/**
 * Gli aggregati che il cruscotto legge. Funzioni pure sui documenti già
 * calcolati: nessun accesso all'archivio, nessuna data implicita.
 */
import { rapporto, round2, somma } from "@/lib/fisco/aritmetica";
import { annoDi, meseDi } from "@/lib/fisco/documenti";
import type { CostoCalcolato, FatturaCalcolata } from "@/lib/fisco/tipi";
import type { NotaCalcolata } from "@/lib/fisco/note";
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
    const stornoRimborsato = somma(
      ...note
        .filter(
          (n) =>
            n.dataRimborso &&
            annoDi(n.dataRimborso) === anno &&
            meseDi(n.dataRimborso) === m,
        )
        .map((n) => n.imponibile),
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

/** Il portafoglio clienti, dal più grande al più piccolo. */
export function portafoglioClienti(
  fatture: FatturaCalcolata[],
  clienti: Cliente[],
  anno: number,
  coloreDi: (nome: string) => string,
): RigaCliente[] {
  const emesseNellAnno = fatture.filter((f) => annoDi(f.dataEmissione) === anno);
  const totale = somma(...emesseNellAnno.map((f) => f.imponibile));

  const righe = clienti.map((cliente): RigaCliente => {
    const sue = emesseNellAnno.filter((f) => f.clienteId === cliente.id);
    const emesso = somma(...sue.map((f) => f.imponibile));
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
      incassato: somma(...incassate.map((f) => f.nettoIncasso)),
      daIncassare: somma(...aperte.map((f) => f.nettoIncasso)),
      scaduto: somma(...aperte.filter((f) => f.giorniRitardo > 0).map((f) => f.nettoIncasso)),
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
