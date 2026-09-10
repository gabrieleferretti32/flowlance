/**
 * Impostazioni predefinite di un anno, derivate dai parametri di legge di
 * quell'anno. L'utente le sovrascrive dal pannello di controllo; i valori di
 * legge restano quelli marcati «da rivedere ogni gennaio».
 */
import { conValoreProposto } from "./parametri-utente";
import { eGestioneCommerciale, type Impostazioni, type ParametriAnno } from "./tipi";

export function impostazioniPredefinite(par: ParametriAnno): Impostazioni {
  const gruppo = par.gruppiAteco[0];
  return {
    anno: par.anno,
    // Nessun parametro confermato: i valori che seguono sono medie dell'app
    // finché qualcuno non li dichiara dalla schermata Parametri.
    dichiarati: [],
    nome: "",
    dataAperturaPiva: null,
    saldoInizialeAttivita: 0,
    saldoInizialePersonale: 0,

    regime: "forfettario",
    gruppoAteco: gruppo.codice,
    coefficienteRedditivita: gruppo.coefficiente,
    nuovaAttivita: false,
    limiteForfettario: par.limiteForfettario,
    sogliaUscita: par.sogliaUscitaImmediata,

    aliquotaIva: par.aliquotaIvaOrdinaria,
    periodicitaIva: "trimestrale",
    maggiorazioneTrimestrale: par.maggiorazioneTrimestrale,

    scaglioniIrpef: par.scaglioniIrpef.map((s) => ({ ...s })),
    addizionaleRegionale: 0.0173,
    scaglioniAddizionaleRegionale: null,
    esenzioneAddizionaleRegionale: 0,
    addizionaleComunale: 0.008,
    scaglioniAddizionaleComunale: null,
    esenzioneAddizionaleComunale: 0,
    detrazioniPersonali: 0,
    fondoPensione: 0,

    gestione: "separata",
    aliquotaGestioneSeparata: par.aliquotaGestioneSeparata,
    massimaleGs: par.massimaleGestioneSeparata,
    minimaleGs: par.minimaleAnnuo,
    /*
      Il valore di legge degli artigiani, che è anche quello che il modulo
      mostra prima di essere toccato. Non entra nel calcolo finché non lo si
      dichiara: il motore legge l'importo della gestione dai parametri
      dell'anno, e questo campo serve solo a scavalcarlo nei casi agevolati.
    */
    contributiFissi: par.artigianiCommercianti.artigiani.fissi,
    // Stessa costante del minimale della Gestione Separata: la legge ne
    // pubblica una sola, e nel modello arriva da un campo solo.
    aliquotaSoggettivaCassa: 0.15,
    aliquotaIntegrativaCassa: 0.04,

    rivalsaAttiva: false,
    aliquotaRivalsa: par.aliquotaRivalsaInps,
    ritenutaAttiva: false,
    aliquotaRitenuta: par.aliquotaRitenuta,
    importoBollo: par.importoBollo,
    sogliaBollo: par.sogliaBollo,
    bolloAddebitato: true,
    terminiPagamento: 30,

    giorniLavorativi: 220,
    oreFatturabiliGiorno: 5,
    // Non inventati: si dichiarano nella configurazione, e finché non lo sono
    // le schermate che ne dipendono dicono che manca un dato invece di
    // mostrare un numero costruito su niente.
    tariffaOraria: null,

    nettoDesiderato: null,
    percentualeAccantonamento: 0.3,
    costiFissiAnnui: null,
  };
}

/**
 * Le impostazioni di un anno che non ne ha ancora di proprie.
 *
 * Un anno nuovo non riparte da zero: eredita il profilo dell'ultimo anno
 * censito prima di lui — nome, regime, gestione, ATECO, le aliquote che
 * l'utente aveva dichiarato — e prende dai parametri solo quello che cambia
 * per legge ogni gennaio. Il saldo iniziale resta a zero di proposito: lo
 * porta la chiusura, non l'eredità.
 *
 * Quello che eredita finisce in `ereditati`. Il valore vale, ma non è una
 * risposta data per *questo* anno, e regioni e comuni ritoccano le aliquote
 * ogni anno: la schermata Parametri lo dice invece di spacciarlo per una
 * conferma.
 *
 * Questa funzione è una sola perché la usano in due: la lettura, che mostra un
 * anno mai aperto, e la scrittura, che lo crea appena si tocca qualcosa. Erano
 * due strade diverse — la lettura non ereditava niente — e chi apriva il 2027
 * con un 2026 in ordinario vedeva un profilo forfettario vuoto che cambiava
 * sotto le mani al primo tasto premuto.
 */
export function impostazioniDaPrecedente(
  par: ParametriAnno,
  anno: number,
  precedente: Impostazioni | null,
): Impostazioni {
  const base: Impostazioni = { ...impostazioniPredefinite(par), anno };
  if (!precedente) return base;

  return {
    ...base,
    nome: precedente.nome,
    dataAperturaPiva: precedente.dataAperturaPiva,
    /*
      Un fatto dell'attività, non una scelta dell'anno: senza ereditarlo
      l'agevolazione spariva al secondo anno. Ereditarlo è sicuro adesso che il
      taglio dei cinque anni lo deriva il motore dalla data — prima avrebbe
      portato avanti un 5 % che nessuno faceva più scadere.
    */
    nuovaAttivita: precedente.nuovaAttivita,
    regime: precedente.regime,
    gruppoAteco: precedente.gruppoAteco,
    coefficienteRedditivita: precedente.coefficienteRedditivita,
    gestione: precedente.gestione,
    periodicitaIva: precedente.periodicitaIva,
    rivalsaAttiva: precedente.rivalsaAttiva,
    ritenutaAttiva: precedente.ritenutaAttiva,
    bolloAddebitato: precedente.bolloAddebitato,
    terminiPagamento: precedente.terminiPagamento,
    percentualeAccantonamento: precedente.percentualeAccantonamento,
    giorniLavorativi: precedente.giorniLavorativi,
    oreFatturabiliGiorno: precedente.oreFatturabiliGiorno,
    tariffaOraria: precedente.tariffaOraria,
    nettoDesiderato: precedente.nettoDesiderato,
    costiFissiAnnui: precedente.costiFissiAnnui,
    regione: precedente.regione ?? null,
    comune: precedente.comune ?? null,
    addizionaleRegionale: precedente.addizionaleRegionale,
    scaglioniAddizionaleRegionale: precedente.scaglioniAddizionaleRegionale ?? null,
    esenzioneAddizionaleRegionale: precedente.esenzioneAddizionaleRegionale ?? 0,
    addizionaleComunale: precedente.addizionaleComunale,
    scaglioniAddizionaleComunale: precedente.scaglioniAddizionaleComunale ?? null,
    esenzioneAddizionaleComunale: precedente.esenzioneAddizionaleComunale ?? 0,
    contributiFissi: precedente.contributiFissi,
    aliquotaSoggettivaCassa: precedente.aliquotaSoggettivaCassa,
    dichiarati: [...(precedente.dichiarati ?? [])],
    ereditati: [...(precedente.dichiarati ?? [])],
    ereditatiDa: precedente.anno,
    // Il saldo iniziale non si eredita: arriva dal riporto della chiusura.
    saldoInizialeAttivita: 0,
    saldoInizialePersonale: 0,
  };
}

/**
 * L'anno censito più vicino **prima** di questo, se c'è.
 *
 * Non `anno - 1` e basta: chi salta dal 2026 al 2028 non deve ritrovarsi un
 * profilo vuoto solo perché il 2027 non l'ha mai aperto.
 */
export function impostazioniPrecedenti(
  anno: number,
  tutte: readonly Impostazioni[],
): Impostazioni | null {
  const prima = tutte.filter((i) => i.anno < anno).sort((a, b) => b.anno - a.anno);
  return prima[0] ?? null;
}

/** Ore fatturabili all'anno: giorni lavorativi × ore al giorno. */
export function oreFatturabiliAnno(imp: Impostazioni): number {
  return imp.giorniLavorativi * imp.oreFatturabiliGiorno;
}

/**
 * Allinea i contributi fissi alla gestione scelta.
 *
 * Il motore l'importo di legge lo legge dai parametri; il campo nei Parametri
 * mostra invece quello scritto in archivio. Se i due divergono — ed è successo:
 * un commerciante vedeva l'importo degli artigiani — il numero calcolato è
 * giusto e quello mostrato no, che è la divergenza peggiore, perché nessuno dei
 * due segnala l'altro.
 *
 * `conValoreProposto` non tocca un valore dichiarato: chi ha una riduzione non
 * se la vede sovrascrivere cambiando gestione.
 */
export function conFissiDiLegge(imp: Impostazioni, par: ParametriAnno): Impostazioni {
  if (!eGestioneCommerciale(imp.gestione)) return imp;
  return conValoreProposto(
    imp,
    "contributiFissi",
    par.artigianiCommercianti[imp.gestione].fissi,
  );
}
