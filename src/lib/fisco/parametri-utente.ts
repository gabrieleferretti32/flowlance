/**
 * I parametri che solo l'utente conosce.
 *
 * Non sono parametri di legge — quelli stanno in `parametri/<anno>.ts` e valgono
 * per tutti — e non sono scelte di comodo. Sono numeri che dipendono da dove
 * vivi e a quale cassa versi: l'addizionale del tuo comune, i contributi fissi
 * della tua gestione, l'aliquota della tua cassa professionale. L'app un valore
 * ce l'ha, altrimenti non potrebbe calcolare niente, ma è una media: presentarlo
 * come «la tua aliquota» è la bugia da cui nasce questo modulo.
 *
 * Da qui discendono tre cose: la schermata che li chiede, la marcatura
 * «predefinito» ovunque compaiano, e il blocco dell'export del prospetto quando
 * un'aliquota che entra nell'IRPEF non è mai stata confermata. Un documento che
 * finisce dal commercialista non deve contenere numeri che nessuno ha detto.
 */
import { aliquota, analizzaNumero, euro, interoIt } from "@/lib/format";
import { frazioneDaPercentuale } from "./aritmetica";
import type { Impostazioni, ScaglioneIrpef } from "./tipi";

/** I campi che l'utente può dichiarare. La chiave è il campo di `Impostazioni`. */
export type CampoUtente =
  | "addizionaleRegionale"
  | "addizionaleComunale"
  | "contributiFissi"
  | "aliquotaSoggettivaCassa"
  | "giorniLavorativi"
  | "oreFatturabiliGiorno";

export type Formato = "percentuale" | "euro" | "intero";

export type DefinizioneCampo = {
  campo: CampoUtente;
  etichetta: string;
  /**
   * Come si nomina dentro una frase.
   *
   * Minuscolare l'etichetta dava «addizionale regionale irpef»: le sigle non si
   * minuscolano, e una frase che le storpia sembra scritta da una macchina.
   */
  nelTesto: string;
  /** A cosa serve, in una riga. */
  aCosaServe: string;
  /** Dove sta scritto il valore vero. Mai «chiedi al commercialista» e basta. */
  doveTrovarlo: string;
  /**
   * Il collegamento, solo dove regge nel tempo.
   *
   * Un link rotto dentro un prodotto venduto è peggio di nessun link, e i siti
   * delle singole regioni cambiano indirizzo ogni riorganizzazione. Qui vanno
   * solo i domini istituzionali che non si spostano; la pagina esatta la dice
   * `doveTrovarlo`. Dove non c'è un indirizzo stabile, non c'è link — e nemmeno
   * l'icona che ne promette uno.
   */
  fonte?: { etichetta: string; href: string };
  formato: Formato;
  /**
   * Entra nel calcolo dell'IRPEF. Se non è dichiarato, il prospetto non si
   * esporta: sarebbe un documento con dentro un'aliquota inventata.
   */
  nellIrpef: boolean;
  /**
   * Dove si sente la sua mancanza: nei conti col fisco, o nel calcolo di quante
   * ore hai da vendere. Serve a segnalarlo nella schermata giusta — le ore
   * fatturabili in mezzo a un avviso sulle imposte sono rumore.
   */
  incideSu: "imposte" | "capacita";
  /** Il campo ha senso in questa configurazione. */
  pertinente: (imp: Impostazioni) => boolean;
  /** Un valore fuori da qui è un errore di battitura, non una scelta. */
  minimo: number;
  massimo: number;
};

const ordinario = (imp: Impostazioni) => imp.regime === "ordinario";

export const CAMPI_UTENTE: DefinizioneCampo[] = [
  {
    campo: "addizionaleRegionale",
    etichetta: "Addizionale regionale IRPEF",
    nelTesto: "l'addizionale regionale",
    aCosaServe:
      "Si applica al tuo imponibile insieme all'IRPEF. Cambia da regione a regione: alcune hanno un'aliquota sola, molte — Piemonte, Lombardia, Lazio e altre — la applicano a scaglioni come l'IRPEF, e diverse esentano i redditi sotto una soglia.",
    doveTrovarlo:
      "Nel quadro RV della dichiarazione dell'anno prima, se ne hai una: è l'aliquota che ti è stata applicata davvero. Se hai anche un lavoro dipendente sta sulla Certificazione Unica, fra le ritenute. Per l'anno in corso, sul portale del Dipartimento delle Finanze qui sotto, o nella delibera della tua regione.",
    incideSu: "imposte",
    fonte: {
      etichetta: "Aliquote sul portale del Dipartimento delle Finanze",
      href: "https://www.finanze.gov.it",
    },
    formato: "percentuale",
    nellIrpef: true,
    pertinente: ordinario,
    minimo: 0,
    massimo: 0.05,
  },
  {
    campo: "addizionaleComunale",
    etichetta: "Addizionale comunale IRPEF",
    nelTesto: "l'addizionale comunale",
    aCosaServe:
      "Come quella regionale, ma decisa dal tuo comune: c'è chi non la applica e chi arriva allo 0,9 %. Quasi tutti i comuni che la applicano esentano i redditi sotto una soglia, e qualcuno usa gli scaglioni.",
    doveTrovarlo:
      "Nel quadro RV della dichiarazione dell'anno prima, o sulla Certificazione Unica se hai anche un lavoro dipendente. Per l'anno in corso, sul portale del Dipartimento delle Finanze qui sotto, sezione «Addizionale comunale all'IRPEF»: cercando il comune di residenza trovi aliquota, soglia di esenzione e delibera.",
    incideSu: "imposte",
    fonte: {
      etichetta: "Aliquote sul portale del Dipartimento delle Finanze",
      href: "https://www.finanze.gov.it",
    },
    formato: "percentuale",
    nellIrpef: true,
    pertinente: ordinario,
    minimo: 0,
    massimo: 0.01,
  },
  {
    campo: "contributiFissi",
    etichetta: "Contributi fissi artigiani e commercianti",
    nelTesto: "i contributi fissi INPS",
    aCosaServe:
      "La quota dovuta comunque, anche a reddito zero, divisa in quattro rate. Sopra il minimale si aggiunge la percentuale sull'eccedenza.",
    doveTrovarlo:
      "Nel Cassetto previdenziale del sito INPS, alla voce «contributi dovuti», o nella circolare INPS di inizio anno per artigiani e commercianti.",
    incideSu: "imposte",
    fonte: { etichetta: "inps.it", href: "https://www.inps.it" },
    formato: "euro",
    nellIrpef: false,
    pertinente: (imp) => imp.gestione === "artigiani",
    minimo: 0,
    massimo: 20_000,
  },
  {
    campo: "aliquotaSoggettivaCassa",
    etichetta: "Aliquota soggettiva della cassa",
    nelTesto: "l'aliquota della tua cassa",
    aCosaServe:
      "Il contributo soggettivo che versi alla tua cassa professionale sul reddito. Ogni cassa ha la sua: Forense, Inarcassa, ENPAM e le altre non si somigliano.",
    doveTrovarlo:
      "Sul sito della tua cassa, nel regolamento dei contributi, o nell'ultimo modello reddituale che hai inviato.",
    incideSu: "imposte",
    formato: "percentuale",
    nellIrpef: false,
    pertinente: (imp) => imp.gestione === "cassa",
    minimo: 0,
    massimo: 0.3,
  },
  {
    campo: "giorniLavorativi",
    etichetta: "Giorni lavorativi all'anno",
    nelTesto: "i giorni lavorativi",
    aCosaServe:
      "Quanti giorni lavori davvero, tolte ferie, festivi e malattia. Serve a capire quante ore hai da vendere, non a calcolare imposte.",
    doveTrovarlo:
      "Lo decidi tu. Un anno pieno con quattro settimane di ferie sta intorno ai 220 giorni.",
    incideSu: "capacita",
    formato: "intero",
    nellIrpef: false,
    pertinente: () => true,
    minimo: 1,
    massimo: 366,
  },
  {
    campo: "oreFatturabiliGiorno",
    etichetta: "Ore fatturabili al giorno",
    nelTesto: "le ore fatturabili al giorno",
    aCosaServe:
      "Le ore che finiscono davvero in fattura, non quelle in cui lavori: amministrazione, preventivi e riunioni non si fatturano quasi mai.",
    doveTrovarlo:
      "Lo decidi tu. Chi ci prova onestamente arriva a quattro o cinque ore su otto.",
    incideSu: "capacita",
    formato: "intero",
    nellIrpef: false,
    pertinente: () => true,
    minimo: 1,
    massimo: 24,
  },
];

/**
 * Il valore scritto nel campo, letto nell'unità del campo.
 *
 * `analizzaPercentuale` qui non va: decide se un numero è già una frazione
 * guardando se supera 1, e un'addizionale comunale dello 0,6 % cade proprio in
 * quella zona ambigua — verrebbe letta come 60 %. In un campo marcato «%» ciò
 * che si scrive sono punti percentuali, sempre, e non c'è niente da indovinare.
 */
export function leggiValore(testo: string, d: DefinizioneCampo): number | null {
  const n = analizzaNumero(testo);
  if (n === null) return null;
  return d.formato === "percentuale" ? frazioneDaPercentuale(n) : n;
}

/** Il valore sta nell'intervallo in cui quel parametro può stare? */
export function nellaScala(valore: number, d: DefinizioneCampo): boolean {
  return valore >= d.minimo && valore <= d.massimo;
}

/**
 * Cosa dire quando il valore è fuori scala.
 *
 * Rifiutare in silenzio è peggio che accettare: chi scrive 8 pensando all'8 %
 * vede il campo non muoversi e non sa se ha sbagliato lui o l'app.
 */
export function messaggioFuoriScala(d: DefinizioneCampo): string {
  if (d.formato === "percentuale") {
    return `Un valore fuori dall'intervallo ${aliquota(d.minimo)} – ${aliquota(d.massimo)}: controlla se hai scritto punti percentuali.`;
  }
  if (d.formato === "euro") {
    return `Un valore fuori dall'intervallo ${euro(d.minimo)} – ${euro(d.massimo)}: controlla la cifra.`;
  }
  return `Dev'essere fra ${interoIt.format(d.minimo)} e ${interoIt.format(d.massimo)}.`;
}

/**
 * L'elenco dei campi in una frase: «l'addizionale regionale e quella comunale».
 * Nomina, non elenca etichette: è quello che va dentro un avviso.
 */
export function elencoInTesto(campi: readonly DefinizioneCampo[]): string {
  const nomi = campi.map((c) => c.nelTesto);
  if (nomi.length <= 1) return nomi[0] ?? "";
  return `${nomi.slice(0, -1).join(", ")} e ${nomi[nomi.length - 1]}`;
}

export function definizioneDi(campo: CampoUtente): DefinizioneCampo {
  const d = CAMPI_UTENTE.find((c) => c.campo === campo);
  if (!d) throw new Error(`campo utente sconosciuto: ${campo}`);
  return d;
}

/** L'utente ha confermato questo valore per quest'anno? */
export function dichiarato(imp: Impostazioni, campo: CampoUtente): boolean {
  return (imp.dichiarati ?? []).includes(campo);
}

/**
 * Il valore viene dall'anno precedente e nessuno l'ha riconfermato qui.
 *
 * È dichiarato — vale, e non blocca l'export — ma non è una risposta data per
 * *questo* anno, e regioni e comuni ritoccano le aliquote ogni gennaio. La
 * differenza va detta: è la stessa cautela dei parametri di legge provvisori.
 */
export function ereditato(imp: Impostazioni, campo: CampoUtente): boolean {
  return dichiarato(imp, campo) && (imp.ereditati ?? []).includes(campo);
}

/** Toglie un campo dall'elenco degli ereditati: è stato toccato o confermato. */
function senzaEredita(imp: Impostazioni, campo: CampoUtente): Impostazioni {
  const gia = imp.ereditati ?? [];
  if (!gia.includes(campo)) return imp;
  return { ...imp, ereditati: gia.filter((c) => c !== campo) };
}

/**
 * «Sì, vale anche per quest'anno.»
 *
 * Non cambia il numero: cambia chi se ne prende la responsabilità e per quale
 * anno. Senza questo gesto l'unico modo di togliere l'etichetta «ereditato»
 * sarebbe riscrivere a mano un valore identico.
 */
export function conEreditaConfermata(imp: Impostazioni, campo: CampoUtente): Impostazioni {
  return senzaEredita(imp, campo);
}

/**
 * La regione a cui si riferisce l'addizionale regionale.
 *
 * Sceglierla non dichiara l'aliquota: quella che si compila da sola è
 * l'aliquota base di legge, uguale per tutte le regioni, e resta «predefinita»
 * finché l'utente non ci mette la sua. La regione dice a quale delibera
 * guardare, ed è quello che serve a chi legge il prospetto.
 */
export function conRegione(imp: Impostazioni, codice: string | null): Impostazioni {
  return { ...imp, regione: codice };
}

/** Il nome del comune, scritto a mano: nessun elenco da tenere aggiornato. */
export function conComune(imp: Impostazioni, nome: string | null): Impostazioni {
  const pulito = nome?.trim();
  return { ...imp, comune: pulito ? pulito : null };
}

/** Il valore, formattato come si legge. */
export function valoreDi(imp: Impostazioni, campo: CampoUtente): string {
  const d = definizioneDi(campo);
  const v = imp[campo];
  if (d.formato === "percentuale") return aliquota(v);
  if (d.formato === "euro") return euro(v);
  return interoIt.format(v);
}

/** I campi che in questa configurazione hanno senso, nell'ordine in cui si chiedono. */
export function campiPertinenti(imp: Impostazioni): DefinizioneCampo[] {
  return CAMPI_UTENTE.filter((c) => c.pertinente(imp));
}

/** Quelli che valgono per questa configurazione e nessuno ha ancora confermato. */
export function campiDaDichiarare(imp: Impostazioni): DefinizioneCampo[] {
  return campiPertinenti(imp).filter((c) => !dichiarato(imp, c.campo));
}

/**
 * Le aliquote che entrano nell'IRPEF e non sono state confermate.
 *
 * È la lista che blocca l'export del prospetto. Le altre — contributi, giorni
 * lavorativi — restano segnalate ma non bloccano: sbagliare il numero di ore
 * fatturabili non manda un documento sbagliato al commercialista.
 */
export function aliquoteIrpefNonDichiarate(imp: Impostazioni): DefinizioneCampo[] {
  return campiDaDichiarare(imp).filter((c) => c.nellIrpef);
}

/**
 * Come si nomina un valore quando se ne parla in una formula.
 *
 * Dichiarato è «la tua», predefinito è «predefinita». La differenza non è di
 * cortesia: è quella fra un numero che l'utente può difendere davanti a un
 * accertamento e uno che ha trovato lì.
 */
export function noteDelValore(imp: Impostazioni, campo: CampoUtente): string {
  const d = definizioneDi(campo);
  if (dichiarato(imp, campo)) return d.campo === "addizionaleRegionale"
    ? "l'aliquota della tua regione"
    : d.campo === "addizionaleComunale"
      ? "l'aliquota del tuo comune"
      : "il valore che hai dichiarato";
  return "valore predefinito, non ancora confermato";
}

/** Dichiara un valore: lo scrive e lo marca come confermato dall'utente. */
export function conValoreDichiarato(
  imp: Impostazioni,
  campo: CampoUtente,
  valore: number,
): Impostazioni {
  const d = definizioneDi(campo);
  const dentro = Math.min(d.massimo, Math.max(d.minimo, valore));
  const gia = imp.dichiarati ?? [];
  // Scrivere un valore è rispondere per quest'anno: quale che fosse il numero
  // di partenza, da qui in poi non è più ereditato.
  return senzaEredita(
    {
      ...imp,
      [campo]: dentro,
      dichiarati: gia.includes(campo) ? gia : [...gia, campo],
    },
    campo,
  );
}

/**
 * Scrive un valore **senza** dichiararlo.
 *
 * È il punto di partenza che l'app propone quando sa qualcosa di più della sua
 * media — l'aliquota base di legge, una volta scelta la regione — ma non sa
 * ancora la risposta. Il campo cambia numero e resta marcato «predefinito»:
 * contarlo come una dichiarazione sbloccherebbe il PDF su un valore che nessuno
 * ha confermato, che è esattamente ciò che questo modulo impedisce.
 */
export function conValoreProposto(
  imp: Impostazioni,
  campo: CampoUtente,
  valore: number,
): Impostazioni {
  if (dichiarato(imp, campo)) return imp;
  const d = definizioneDi(campo);
  return { ...imp, [campo]: Math.min(d.massimo, Math.max(d.minimo, valore)) };
}

/** Le due addizionali, le sole che possono avere scaglioni e soglia propri. */
export type CampoAddizionale = "addizionaleRegionale" | "addizionaleComunale";

export function eAddizionale(campo: CampoUtente): campo is CampoAddizionale {
  return campo === "addizionaleRegionale" || campo === "addizionaleComunale";
}

/**
 * Scrive gli scaglioni di un'addizionale. `null` torna all'aliquota unica.
 *
 * `conferma` distingue due gesti che sembrano uno. Scegliere «a scaglioni» dice
 * solo in che forma si risponderà, e le righe partono dall'aliquota media
 * dell'app: contarlo come una dichiarazione sbloccherebbe il PDF su numeri che
 * nessuno ha ancora scritto. Modificare una riga invece è la risposta, e
 * conferma il parametro come farebbe scrivere un'aliquota unica.
 */
export function conScaglioni(
  imp: Impostazioni,
  campo: CampoAddizionale,
  scaglioni: ScaglioneIrpef[] | null,
  conferma = true,
): Impostazioni {
  const chiave =
    campo === "addizionaleRegionale"
      ? "scaglioniAddizionaleRegionale"
      : "scaglioniAddizionaleComunale";
  const gia = imp.dichiarati ?? [];
  const prossime: Impostazioni = {
    ...imp,
    [chiave]: scaglioni,
    dichiarati:
      scaglioni === null || !conferma || gia.includes(campo) ? gia : [...gia, campo],
  };
  return conferma ? senzaEredita(prossime, campo) : prossime;
}

/**
 * Scrive la soglia di esenzione.
 *
 * Da sola non conferma il parametro: sotto la soglia non si paga, ma sopra si
 * paga con un'aliquota che resta quella media finché non la si dichiara. Dire
 * «confermato» qui sbloccherebbe il PDF su un numero ancora inventato.
 */
export function conEsenzione(
  imp: Impostazioni,
  campo: CampoAddizionale,
  valore: number,
): Impostazioni {
  const chiave =
    campo === "addizionaleRegionale"
      ? "esenzioneAddizionaleRegionale"
      : "esenzioneAddizionaleComunale";
  return { ...imp, [chiave]: Math.max(0, valore) };
}

/**
 * Rimette un campo al valore predefinito.
 * Serve a poter tornare indietro: chi ha sbagliato a copiare l'aliquota deve
 * poter dire «non lo so» invece di lasciare un numero suo e sbagliato.
 */
export function senzaDichiarazione(
  imp: Impostazioni,
  campo: CampoUtente,
  predefinito: number,
): Impostazioni {
  const pulito: Impostazioni = {
    ...imp,
    [campo]: predefinito,
    dichiarati: (imp.dichiarati ?? []).filter((c) => c !== campo),
    ereditati: (imp.ereditati ?? []).filter((c) => c !== campo),
  };
  // Tornare a «non lo so» toglie anche scaglioni e soglia: lasciarli sarebbe
  // tenere metà di una risposta ritirata, e il calcolo continuerebbe a usarli.
  if (!eAddizionale(campo)) return pulito;
  return conEsenzione(conScaglioni(pulito, campo, null), campo, 0);
}
