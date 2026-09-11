/**
 * Il flusso di cassa mensile.
 *
 * Qui conta solo quando il denaro si muove davvero: gli incassi alla data di
 * accredito, i costi alla data di pagamento, gli F24 alla data del versamento.
 * È l'unica schermata che deve quadrare con l'estratto conto.
 *
 * La liquidità netta sottrae le tasse accantonate: sono soldi che stanno sul
 * conto ma non sono spendibili, ed è la differenza fra sentirsi ricchi a
 * maggio e non riuscire a versare a giugno.
 */
import { rapporto, round2, somma } from "@/lib/fisco/aritmetica";
import { annoDi, meseDi } from "@/lib/fisco/documenti";
import type { CostoCalcolato, FatturaCalcolata, VersamentoF24 } from "@/lib/fisco/tipi";
import type { MovimentoAttivita, MovimentoPersonale } from "@/lib/dati/tipi";

export type MeseCassa = {
  mese: number;
  etichetta: string;
  incassiClienti: number;
  altreEntrate: number;
  totaleEntrate: number;
  costiPagati: number;
  ivaVersata: number;
  imposteEContributi: number;
  prelieviPersonali: number;
  altreUscite: number;
  totaleUscite: number;
  flussoNetto: number;
  saldoCassa: number;
  accantonamentoTasse: number;
  accantonamentoCumulato: number;
  liquiditaNetta: number;
};

export type Cashflow = {
  mesi: MeseCassa[];
  saldoIniziale: number;
  /**
   * Tasse già accantonate al 1° gennaio, riportate dall'anno precedente.
   *
   * È il numero che, se non attraversa la chiusura, fa risalire da solo la
   * liquidità netta il primo dell'anno: il conto è lo stesso di ieri, ma una
   * parte di quei soldi serve a pagare a giugno. Non produce un errore,
   * produce un numero plausibile e sbagliato.
   */
  accantonatoIniziale: number;
  /** Liquidità davvero disponibile al 1° gennaio: saldo meno accantonato. */
  liquiditaNettaIniziale: number;
  totaleEntrate: number;
  totaleUscite: number;
  saldoFinale: number;
  accantonatoTotale: number;
  liquiditaNettaFinale: number;
  /** Il mese peggiore dell'anno: quello da cui ci si accorge dei problemi. */
  meseNegativo: MeseCassa | null;
};

const MESI_BREVI = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu",
  "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

export type IngressoCashflow = {
  anno: number;
  saldoIniziale: number;
  /** Accantonamento residuo che arriva dall'anno precedente. Zero al primo anno. */
  accantonatoIniziale?: number;
  percentualeAccantonamento: number;
  fatture: FatturaCalcolata[];
  costi: CostoCalcolato[];
  versamenti: VersamentoF24[];
  movimentiAttivita: MovimentoAttivita[];
  movimentiPersonali: MovimentoPersonale[];
};

export function calcolaCashflow(ing: IngressoCashflow): Cashflow {
  const { anno } = ing;
  const nelMese = <T>(righe: T[], data: (r: T) => string | null | undefined, mese: number) =>
    righe.filter((r) => {
      const d = data(r);
      return Boolean(d) && annoDi(d as string) === anno && meseDi(d as string) === mese;
    });

  const mesi: MeseCassa[] = [];
  let saldo = ing.saldoIniziale;
  // L'accantonato non riparte da zero a gennaio: quello dell'anno prima serve a
  // pagare il saldo di giugno, e finché non è versato resta denaro impegnato.
  const accantonatoIniziale = round2(Math.max(0, ing.accantonatoIniziale ?? 0));
  let accantonato = accantonatoIniziale;

  for (let m = 1; m <= 12; m++) {
    // Quello che è entrato in banca, non il totale della fattura: su un incasso
    // parziale sono due numeri diversi, e questo è un conto di cassa.
    const incassiClienti = somma(
      ...nelMese(ing.fatture, (f) => f.dataIncasso, m).map((f) => f.incassato),
    );
    const movimento = ing.movimentiAttivita.find((x) => x.anno === anno && x.mese === m);
    const altreEntrate = movimento?.altreEntrate ?? 0;
    const altreUscite = movimento?.altreUscite ?? 0;

    const costiPagati = somma(
      ...nelMese(ing.costi, (c) => c.dataPagamento, m).map((c) => c.totale),
    );
    const versamentiMese = nelMese(ing.versamenti, (v) => v.data, m);
    const ivaVersata = somma(...versamentiMese.filter((v) => v.tipo === "iva").map((v) => v.importo));
    const imposteEContributi = somma(
      ...versamentiMese.filter((v) => v.tipo !== "iva").map((v) => v.importo),
    );
    const prelieviPersonali =
      ing.movimentiPersonali.find((x) => x.anno === anno && x.mese === m)?.prelievi ?? 0;

    const totaleEntrate = somma(incassiClienti, altreEntrate);
    const totaleUscite = somma(
      costiPagati, ivaVersata, imposteEContributi, prelieviPersonali, altreUscite,
    );
    const flussoNetto = round2(totaleEntrate - totaleUscite);
    saldo = round2(saldo + flussoNetto);

    // L'accantonamento si calcola sugli incassi del mese, non sul fatturato.
    const accantonamentoTasse = round2(incassiClienti * ing.percentualeAccantonamento);
    accantonato = round2(accantonato + accantonamentoTasse - ivaVersata - imposteEContributi);
    if (accantonato < 0) accantonato = 0;

    mesi.push({
      mese: m,
      etichetta: MESI_BREVI[m - 1],
      incassiClienti,
      altreEntrate,
      totaleEntrate,
      costiPagati,
      ivaVersata,
      imposteEContributi,
      prelieviPersonali,
      altreUscite,
      totaleUscite,
      flussoNetto,
      saldoCassa: saldo,
      accantonamentoTasse,
      accantonamentoCumulato: accantonato,
      liquiditaNetta: round2(saldo - accantonato),
    });
  }

  const negativi = mesi.filter((m) => m.saldoCassa < 0);
  const peggiore = mesi.reduce((a, m) => (m.saldoCassa < a.saldoCassa ? m : a), mesi[0]);

  return {
    mesi,
    saldoIniziale: ing.saldoIniziale,
    accantonatoIniziale,
    liquiditaNettaIniziale: round2(ing.saldoIniziale - accantonatoIniziale),
    totaleEntrate: somma(...mesi.map((m) => m.totaleEntrate)),
    totaleUscite: somma(...mesi.map((m) => m.totaleUscite)),
    saldoFinale: mesi[11].saldoCassa,
    accantonatoTotale: mesi[11].accantonamentoCumulato,
    liquiditaNettaFinale: mesi[11].liquiditaNetta,
    meseNegativo: negativi.length > 0 ? peggiore : null,
  };
}

/** Mesi di autonomia con la liquidità disponibile, data la spesa media. */
export function mesiDiAutonomia(liquidita: number, spesaMensileMedia: number): number | null {
  if (spesaMensileMedia <= 0) return null;
  return round2(rapporto(liquidita, spesaMensileMedia));
}
