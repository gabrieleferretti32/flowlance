/**
 * Impostazioni predefinite di un anno, derivate dai parametri di legge di
 * quell'anno. L'utente le sovrascrive dal pannello di controllo; i valori di
 * legge restano quelli marcati «da rivedere ogni gennaio».
 */
import type { Impostazioni, ParametriAnno } from "./tipi";

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
    aliquotaSostitutiva: par.aliquotaSostitutiva,
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
    contributiFissi: 4600,
    // Stessa costante del minimale della Gestione Separata: la legge ne
    // pubblica una sola, e nel modello arriva da un campo solo.
    minimaleArtigiani: par.minimaleAnnuo,
    aliquotaEccedenza: par.aliquotaEccedenzaArtigiani,
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
    mesiFondoEmergenza: 6,
    costiFissiAnnui: null,
  };
}

/** Aliquota sostitutiva coerente con l'anzianità della partita IVA. */
export function aliquotaSostitutivaEffettiva(
  imp: Impostazioni,
  par: ParametriAnno,
): number {
  if (!imp.nuovaAttivita) return par.aliquotaSostitutiva;
  if (!imp.dataAperturaPiva) return par.aliquotaSostitutivaNuovaAttivita;
  const anniTrascorsi = imp.anno - Number(imp.dataAperturaPiva.slice(0, 4));
  return anniTrascorsi < par.anniNuovaAttivita
    ? par.aliquotaSostitutivaNuovaAttivita
    : par.aliquotaSostitutiva;
}

/** Ore fatturabili all'anno: giorni lavorativi × ore al giorno. */
export function oreFatturabiliAnno(imp: Impostazioni): number {
  return imp.giorniLavorativi * imp.oreFatturabiliGiorno;
}
