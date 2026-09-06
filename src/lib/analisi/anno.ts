/**
 * Il calcolo di un anno intero, e la catena degli anni.
 *
 * Un anno non si calcola da solo: apre con quello che gli ha lasciato il
 * precedente — saldo di cassa, tasse accantonate, credito IVA, crediti
 * d'imposta — e chiude lasciando la stessa cosa al successivo. Questo modulo è
 * il punto in cui la catena si costruisce, una volta sola, e da cui pescano sia
 * l'interfaccia sia i test: se il test provasse un percorso diverso da quello
 * dell'app, non proverebbe niente.
 */
import { calcolaProspetto, type Acconti, type Prospetto } from "@/lib/fisco/motore";
import { calcolaIva, type LiquidazioneIva } from "@/lib/fisco/iva";
import {
  calcolaRiporto,
  controlliChiusura,
  proponiRegime,
  riportoVuoto,
  scostamentiDaChiusura,
  type ChiusuraAnno,
  type Controllo,
  type PropostaRegime,
  type Riporto,
  type Scostamento,
} from "@/lib/fisco/chiusura";
import { annoDi } from "@/lib/fisco/documenti";
import {
  impostazioniDaPrecedente,
  impostazioniPrecedenti,
} from "@/lib/fisco/impostazioni";
import { parametriDi } from "@/lib/fisco/parametri";
import type {
  Costo,
  Fattura,
  NotaCredito,
  Impostazioni,
  ParametriAnno,
  VersamentoF24,
} from "@/lib/fisco/tipi";
import type { MovimentoAttivita, MovimentoPersonale } from "@/lib/dati/tipi";
import { calcolaCashflow, type Cashflow } from "./cashflow";

export type AnnoCalcolato = {
  anno: number;
  impostazioni: Impostazioni;
  parametri: ParametriAnno;
  prospetto: Prospetto;
  iva: LiquidazioneIva;
  cashflow: Cashflow;
  /** Quello che è arrivato dall'anno precedente. */
  riportoInIngresso: Riporto;
  /** Quello che questo anno lascia al successivo. */
  riportoInUscita: Riporto;
  chiusura: ChiusuraAnno | null;
  chiuso: boolean;
  regime: PropostaRegime;
  controlli: Controllo[];
  /** Cosa è cambiato dopo la chiusura. Vuoto se l'anno è aperto o nulla si è mosso. */
  scostamenti: Scostamento[];
};

export type ArchivioPerAnni = {
  impostazioni: Impostazioni[];
  fatture: Fattura[];
  note: NotaCredito[];
  costi: Costo[];
  versamenti: VersamentoF24[];
  movimentiAttivita: MovimentoAttivita[];
  movimentiPersonali: MovimentoPersonale[];
  chiusure: ChiusuraAnno[];
};

/** Oltre questo numero di anni la catena si ferma: si sta navigando, non calcolando. */
const MASSIMO_ANNI_IN_CATENA = 50;

/**
 * Gli anni da calcolare per arrivare a quello richiesto.
 *
 * Non basta l'anno chiesto: per sapere quanto era accantonato al 1° gennaio
 * bisogna aver percorso tutti gli anni precedenti in cui è successo qualcosa.
 */
export function anniDaCalcolare(archivio: ArchivioPerAnni, annoRichiesto: number): number[] {
  const anni = new Set<number>([annoRichiesto]);
  for (const i of archivio.impostazioni) anni.add(i.anno);
  for (const c of archivio.chiusure) anni.add(c.anno);
  for (const f of archivio.fatture) {
    anni.add(annoDi(f.dataEmissione));
    if (f.dataIncasso) anni.add(annoDi(f.dataIncasso));
  }
  // Le note hanno le stesse due date delle fatture e vanno contate come loro:
  // un anno in cui esiste solo una nota di credito è un anno con dei numeri
  // dentro, e saltarlo significa perderne il riporto.
  for (const n of archivio.note) {
    anni.add(annoDi(n.dataDocumento));
    if (n.dataRimborso) anni.add(annoDi(n.dataRimborso));
  }
  for (const c of archivio.costi) {
    anni.add(annoDi(c.dataDocumento));
    if (c.dataPagamento) anni.add(annoDi(c.dataPagamento));
  }
  // Un versamento conta due volte: nell'anno in cui è uscito dal conto e in
  // quello d'imposta a cui si riferisce. Un saldo 2025 pagato a giugno 2026
  // dice che il 2025 esiste e ha dei numeri dentro — saltarlo significherebbe
  // perderne il riporto, esattamente come per le note di credito.
  for (const v of archivio.versamenti) {
    anni.add(annoDi(v.data));
    if (v.annoImposta !== undefined) anni.add(v.annoImposta);
  }
  for (const m of archivio.movimentiAttivita) anni.add(m.anno);
  for (const m of archivio.movimentiPersonali) anni.add(m.anno);

  // Il tetto serve contro le date sbagliate: un costo datato 1970 per un refuso
  // non deve far calcolare mezzo secolo. Ma va applicato tagliando la coda
  // vecchia, non quella nuova: troncando in avanti l'anno richiesto poteva
  // restare fuori dalla catena, e la sua schermata non si apriva più — uno
  // scheletro di caricamento per sempre, senza un errore da nessuna parte.
  const minimo = Math.min(...anni);
  const massimo = Math.max(...anni);
  const ultimo = Math.max(annoRichiesto, Math.min(massimo, minimo + MASSIMO_ANNI_IN_CATENA));
  const primo = Math.max(minimo, ultimo - MASSIMO_ANNI_IN_CATENA);
  // La catena dev'essere continua: un anno saltato è un riporto perso.
  const continua: number[] = [];
  for (let a = primo; a <= ultimo; a++) continua.push(a);
  return continua;
}

/**
 * Calcola un anno a partire da quello che gli arriva dall'anno precedente.
 *
 * @param riportoInIngresso `null` per il primo anno della catena: solo allora il
 * saldo iniziale viene dalle impostazioni scritte a mano.
 */
export function calcolaAnno(
  anno: number,
  archivio: ArchivioPerAnni,
  riportoInIngresso: Riporto | null,
  oggi: string,
  /**
   * Gli acconti che l'anno prima ha calcolato per questo: si versano a giugno e
   * novembre di quest'anno e riducono il suo saldo. Non passano dal riporto —
   * il riporto conserva quello che avanza, non quello che si deve ancora — e
   * arrivano perciò come argomento a sé, dalla catena che ha in mano entrambi.
   */
  accontiDelPrecedente: Acconti | null = null,
): AnnoCalcolato {
  const parametri = parametriDi(anno);
  // L'anno va forzato: per un anno senza parametri propri `parametriDi` ricade
  // sull'anno censito più recente, e le impostazioni predefinite ne erediterebbero
  // l'anno. Il motore filtra i documenti su `impostazioni.anno`, quindi un anno
  // sbagliato qui significa il prospetto di un altro anno, senza alcun errore.
  const impostazioni: Impostazioni =
    archivio.impostazioni.find((i) => i.anno === anno) ??
    impostazioniDaPrecedente(parametri, anno, impostazioniPrecedenti(anno, archivio.impostazioni));
  const entrata = riportoInIngresso ?? riportoVuoto(anno - 1);
  const chiusura = archivio.chiusure.find((c) => c.anno === anno) ?? null;

  const prospetto = calcolaProspetto({
    impostazioni,
    parametri,
    fatture: archivio.fatture,
    note: archivio.note,
    costi: archivio.costi,
    versamenti: archivio.versamenti,
    impostazioniPerAnno: archivio.impostazioni,
    creditoAnnoPrecedente: entrata.creditoImposte,
    accontiDelPrecedente,
    oggi,
  });

  const iva = calcolaIva(
    prospetto.fattureCalcolate,
    prospetto.costiCalcolati,
    impostazioni,
    parametri,
    entrata.creditoIvaInLiquidazione,
    prospetto.noteCalcolate,
  );

  const cashflow = calcolaCashflow({
    anno,
    // Il primo anno apre con il saldo dichiarato nelle impostazioni; ogni anno
    // successivo apre con quello che ha lasciato il precedente.
    saldoIniziale: riportoInIngresso ? riportoInIngresso.saldoCassa : impostazioni.saldoInizialeAttivita,
    accantonatoIniziale: entrata.accantonato,
    percentualeAccantonamento: impostazioni.percentualeAccantonamento,
    fatture: prospetto.fattureCalcolate,
    costi: prospetto.costiCalcolati,
    versamenti: archivio.versamenti,
    movimentiAttivita: archivio.movimentiAttivita,
    movimentiPersonali: archivio.movimentiPersonali,
  });

  const riportoInUscita = calcolaRiporto({ anno, prospetto, iva, cashflow, chiusura });
  const regime = proponiRegime(prospetto, impostazioni, parametri);

  return {
    anno,
    impostazioni,
    parametri,
    prospetto,
    iva,
    cashflow,
    riportoInIngresso: entrata,
    riportoInUscita,
    chiusura,
    chiuso: chiusura !== null,
    regime,
    controlli: controlliChiusura({ riporto: riportoInUscita, prospetto, parametri, oggi }),
    scostamenti: chiusura ? scostamentiDaChiusura(chiusura, riportoInUscita, prospetto) : [],
  };
}

/**
 * Tutti gli anni della catena, ciascuno con i riporti di quello prima.
 * L'ordine non è un dettaglio: è la catena stessa.
 */
export function catenaAnni(
  archivio: ArchivioPerAnni,
  annoRichiesto: number,
  oggi: string,
): Map<number, AnnoCalcolato> {
  const risultato = new Map<number, AnnoCalcolato>();
  let precedente: Riporto | null = null;
  let accontiPrecedenti: Acconti | null = null;

  for (const anno of anniDaCalcolare(archivio, annoRichiesto)) {
    const calcolato = calcolaAnno(anno, archivio, precedente, oggi, accontiPrecedenti);
    risultato.set(anno, calcolato);
    precedente = calcolato.riportoInUscita;
    accontiPrecedenti = calcolato.prospetto.acconti;
  }

  return risultato;
}
