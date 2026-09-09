/**
 * Export e import del file di backup.
 *
 * È l'unico modo per portare i dati su un altro dispositivo, quindi deve essere
 * leggibile a occhio, verificabile e severo in lettura: un file sbagliato va
 * respinto con un messaggio comprensibile, non importato a metà.
 *
 * L'import ripulisce anche i campi derivati: se un file ne contiene, vengono
 * scartati. Nel database non deve finire nulla che si possa ricalcolare.
 */
import { VERSIONE_SCHEMA } from "./db";
import { parametriDi, parametriSonoDellAnno } from "@/lib/fisco/parametri";
import { GESTIONI, type Gestione, type ScaglioneIrpef } from "@/lib/fisco/tipi";
import {
  COLLEZIONI,
  datiVuoti,
  type Dati,
  type NomeCollezione,
} from "./tipi";

export const FORMATO = "flowlance";

/**
 * I nomi precedenti del progetto, in ordine cronologico.
 *
 * I backup esportati prima di un rename portano il marcatore di allora e devono
 * continuare a importarsi: un file di backup che l'app rifiuta è un archivio
 * perso. L'elenco cresce a ogni cambio di nome e non si accorcia mai.
 */
export const FORMATI_STORICI = ["freelance-finance-os", "freelance-flow"] as const;

const FORMATI_ACCETTATI: readonly string[] = [FORMATO, ...FORMATI_STORICI];

export type Backup = {
  formato: typeof FORMATO | (typeof FORMATI_STORICI)[number];
  versioneSchema: number;
  esportatoIl: string;
  dati: Dati;
};

export type RisultatoAnalisi =
  | { ok: true; backup: Backup; avvisi: string[] }
  | {
      ok: false;
      errori: string[];
      /**
       * Il file è sbagliato riga per riga, non nella sua natura.
       *
       * L'import è tutto-o-niente di proposito: un archivio che sembra completo
       * e non lo è produce calcoli fiscali sbagliati in silenzio, che è molto
       * peggio di un rifiuto. Ma il rifiuto va detto per quello che è — «tre
       * righe su millecinquecento non vanno» — perché il file resta un file di
       * testo, le righe sono indicate una per una, e chi ha perso l'archivio
       * può correggerle e riprovare invece di darsi per vinto.
       *
       * Falso quando non c'è niente da correggere: un file troncato, un JSON
       * che non è un backup, o un backup di una versione futura.
       */
      recuperabile: boolean;
    };

export function creaBackup(dati: Dati, adesso = new Date()): Backup {
  return {
    formato: FORMATO,
    versioneSchema: VERSIONE_SCHEMA,
    esportatoIl: adesso.toISOString(),
    dati,
  };
}

export function serializzaBackup(backup: Backup): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

/** Nome file parlante: `flowlance-2026-09-01.json`. */
export function nomeFileBackup(adesso = new Date()): string {
  return `${FORMATO}-${adesso.toISOString().slice(0, 10)}.json`;
}

// ————————————————————————————————————————————————————————————
// Validazione
// ————————————————————————————————————————————————————————————

const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/;

function oggetto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function testo(v: unknown, predefinito = ""): string {
  return typeof v === "string" ? v : predefinito;
}

function numero(v: unknown, predefinito = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : predefinito;
}

/**
 * I campi che possono legittimamente non essere stati dichiarati.
 * Uno zero al loro posto non sarebbe «non lo so», sarebbe «zero»: un backup
 * vecchio riaperto direbbe che i costi fissi sono zero euro.
 */
function numeroOpzionale(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Scaglioni letti da un backup: `null` se non ce ne sono o sono illeggibili. */
function leggiScaglioni(v: unknown): ScaglioneIrpef[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const letti = v
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({
      limite: typeof r.limite === "number" && Number.isFinite(r.limite) ? r.limite : null,
      aliquota: numero(r.aliquota),
    }));
  return letti.length > 0 ? letti : null;
}

function booleano(v: unknown, predefinito = false): boolean {
  return typeof v === "boolean" ? v : predefinito;
}

function dataOpzionale(v: unknown): string | null {
  return typeof v === "string" && ISO_DATA.test(v) ? v : null;
}

function fraZeroEUno(v: unknown, predefinito: number): number {
  const n = numero(v, predefinito);
  return n >= 0 && n <= 1 ? n : predefinito;
}

type Convalida<T> = (riga: Record<string, unknown>, indice: number, errori: string[]) => T | null;

function convalidaElenco<T>(
  valore: unknown,
  collezione: NomeCollezione,
  convalida: Convalida<T>,
  errori: string[],
): T[] {
  if (valore === undefined) return [];
  if (!Array.isArray(valore)) {
    errori.push(`La collezione «${collezione}» non è un elenco.`);
    return [];
  }
  const risultato: T[] = [];
  for (const [indice, riga] of valore.entries()) {
    if (!oggetto(riga)) {
      errori.push(`${collezione}, riga ${indice + 1}: non è un oggetto.`);
      continue;
    }
    const convalidata = convalida(riga, indice, errori);
    if (convalidata) risultato.push(convalidata);
  }
  return risultato;
}

function richiedeId(
  riga: Record<string, unknown>,
  collezione: NomeCollezione,
  indice: number,
  errori: string[],
): string | null {
  const id = testo(riga.id);
  if (!id) {
    errori.push(`${collezione}, riga ${indice + 1}: manca l'identificatore.`);
    return null;
  }
  return id;
}

const convalidaFattura: Convalida<Dati["fatture"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "fatture", i, errori);
  if (!id) return null;
  const dataEmissione = dataOpzionale(riga.dataEmissione);
  if (!dataEmissione) {
    errori.push(`fatture, riga ${i + 1}: data di emissione mancante o non in formato aaaa-mm-gg.`);
    return null;
  }
  const imponibile = numero(riga.imponibile, Number.NaN);
  if (!Number.isFinite(imponibile)) {
    errori.push(`fatture, riga ${i + 1}: imponibile mancante o non numerico.`);
    return null;
  }
  const tipo = riga.tipoRicavo;
  return {
    id,
    dataEmissione,
    numero: testo(riga.numero),
    clienteId: testo(riga.clienteId),
    descrizione: testo(riga.descrizione),
    tipoRicavo:
      tipo === "ricorrente" || tipo === "progetto" || tipo === "unaTantum" ? tipo : "progetto",
    imponibile,
    ...(typeof riga.aliquotaIva === "number"
      ? { aliquotaIva: fraZeroEUno(riga.aliquotaIva, 0) }
      : {}),
    dataIncasso: dataOpzionale(riga.dataIncasso),
  };
};

/**
 * Una nota di credito.
 *
 * L'imponibile si normalizza in positivo anche qui: un backup scritto a mano, o
 * uscito da una versione futura che decidesse altrimenti, non deve poter far
 * entrare in archivio uno storno che aumenta il fatturato.
 */
const convalidaNota: Convalida<Dati["note"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "note", i, errori);
  if (!id) return null;
  const dataDocumento = dataOpzionale(riga.dataDocumento);
  if (!dataDocumento) {
    errori.push(`note, riga ${i + 1}: data del documento mancante o non in formato aaaa-mm-gg.`);
    return null;
  }
  const imponibile = numero(riga.imponibile, Number.NaN);
  if (!Number.isFinite(imponibile)) {
    errori.push(`note, riga ${i + 1}: imponibile mancante o non numerico.`);
    return null;
  }
  const grezze = Array.isArray(riga.riconciliazioni) ? riga.riconciliazioni : [];
  const riconciliazioni = grezze
    .filter(oggetto)
    .map((r) => ({ fatturaId: testo(r.fatturaId), imponibile: Math.abs(numero(r.imponibile)) }))
    .filter((r) => r.fatturaId !== "" && r.imponibile > 0);

  return {
    id,
    dataDocumento,
    numero: testo(riga.numero),
    clienteId: testo(riga.clienteId),
    descrizione: testo(riga.descrizione),
    imponibile: Math.abs(imponibile),
    ...(typeof riga.aliquotaIva === "number"
      ? { aliquotaIva: fraZeroEUno(riga.aliquotaIva, 0) }
      : {}),
    dataRimborso: dataOpzionale(riga.dataRimborso),
    riconciliazioni,
  };
};

const convalidaCosto: Convalida<Dati["costi"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "costi", i, errori);
  if (!id) return null;
  const dataDocumento = dataOpzionale(riga.dataDocumento);
  if (!dataDocumento) {
    errori.push(`costi, riga ${i + 1}: data del documento mancante o non in formato aaaa-mm-gg.`);
    return null;
  }
  const imponibile = numero(riga.imponibile, Number.NaN);
  if (!Number.isFinite(imponibile)) {
    errori.push(`costi, riga ${i + 1}: imponibile mancante o non numerico.`);
    return null;
  }
  return {
    id,
    dataDocumento,
    fornitore: testo(riga.fornitore),
    categoria: testo(riga.categoria, "Altro"),
    descrizione: testo(riga.descrizione),
    natura: riga.natura === "fisso" ? "fisso" : "variabile",
    imponibile,
    aliquotaIva: fraZeroEUno(riga.aliquotaIva, 0),
    percentualeDeducibilita: fraZeroEUno(riga.percentualeDeducibilita, 1),
    percentualeDetraibilitaIva: fraZeroEUno(riga.percentualeDetraibilitaIva, 1),
    dataPagamento: dataOpzionale(riga.dataPagamento),
  };
};

const convalidaCliente: Convalida<Dati["clienti"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "clienti", i, errori);
  if (!id) return null;
  const nome = testo(riga.nome);
  if (!nome) {
    errori.push(`clienti, riga ${i + 1}: manca il nome.`);
    return null;
  }
  return {
    id,
    nome,
    ...(typeof riga.colore === "string" ? { colore: riga.colore } : {}),
    canaleAcquisizione: testo(riga.canaleAcquisizione),
    note: testo(riga.note),
  };
};

const convalidaMovimentoPersonale: Convalida<Dati["movimentiPersonali"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "movimentiPersonali", i, errori);
  if (!id) return null;
  return {
    id,
    anno: numero(riga.anno),
    mese: numero(riga.mese, 1),
    prelievi: numero(riga.prelievi),
    altreEntrate: numero(riga.altreEntrate),
    speseFisse: numero(riga.speseFisse),
    speseVariabili: numero(riga.speseVariabili),
    risparmio: numero(riga.risparmio),
  };
};

const convalidaMovimentoAttivita: Convalida<Dati["movimentiAttivita"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "movimentiAttivita", i, errori);
  if (!id) return null;
  return {
    id,
    anno: numero(riga.anno),
    mese: numero(riga.mese, 1),
    altreEntrate: numero(riga.altreEntrate),
    altreUscite: numero(riga.altreUscite),
  };
};

const convalidaVersamento: Convalida<Dati["versamenti"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "versamenti", i, errori);
  if (!id) return null;
  const data = dataOpzionale(riga.data);
  if (!data) {
    errori.push(`versamenti, riga ${i + 1}: data mancante o non in formato aaaa-mm-gg.`);
    return null;
  }
  const tipo = riga.tipo;
  // L'anno d'imposta manca nei backup scritti prima che il campo esistesse, e
  // manca per davvero: non si deduce dalla data, si lascia assente. Chi lo
  // legge sa che cosa farne — vale l'anno della data, dichiarandolo.
  const annoImposta = Number(riga.annoImposta);
  return {
    id,
    data,
    tipo: tipo === "iva" || tipo === "imposte" || tipo === "contributi" ? tipo : "imposte",
    importo: numero(riga.importo),
    ...(Number.isFinite(annoImposta) && annoImposta > 1900 ? { annoImposta } : {}),
  };
};

const convalidaSpunta: Convalida<Dati["spunte"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "spunte", i, errori);
  if (!id) return null;
  return {
    id,
    anno: numero(riga.anno),
    idAdempimento: testo(riga.idAdempimento),
    completatoIl: dataOpzionale(riga.completatoIl) ?? new Date().toISOString().slice(0, 10),
  };
};

/**
 * Una chiusura d'anno.
 *
 * L'istantanea si accetta così com'è nel file ma non entra mai in un calcolo:
 * anche importata sbagliata non può spostare un riporto, al massimo mostra uno
 * scostamento che non c'è.
 */
const convalidaChiusura: Convalida<Dati["chiusure"][number]> = (riga, i, errori) => {
  const anno = numero(riga.anno, Number.NaN);
  if (!Number.isInteger(anno) || anno < 2000 || anno > 2100) {
    errori.push(`chiusure, riga ${i + 1}: anno mancante o fuori intervallo.`);
    return null;
  }
  const istantanea = oggetto(riga.istantanea) ? riga.istantanea : {};
  return {
    anno,
    chiusaIl: testo(riga.chiusaIl) || new Date().toISOString(),
    destinazioneCreditoIva: riga.destinazioneCreditoIva === "rimborso" ? "rimborso" : "compensazione",
    regimeAnnoSuccessivo: riga.regimeAnnoSuccessivo === "ordinario" ? "ordinario" : "forfettario",
    note: testo(riga.note),
    istantanea: {
      saldoCassa: numero(istantanea.saldoCassa),
      accantonato: numero(istantanea.accantonato),
      creditoIva: numero(istantanea.creditoIva),
      creditoImposte: numero(istantanea.creditoImposte),
      ricaviRilevanti: numero(istantanea.ricaviRilevanti),
      fattureDaIncassare: numero(istantanea.fattureDaIncassare),
      costiDaPagare: numero(istantanea.costiDaPagare),
    },
  };
};

/** L'avanzamento in un percorso di configurazione. */
const convalidaPercorso: Convalida<Dati["percorsi"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "percorsi", i, errori);
  if (!id) return null;
  const contesto = riga.contesto;
  if (contesto !== "primoAvvio" && contesto !== "aperturaAnno" && contesto !== "cambioRegime") {
    errori.push(`percorsi, riga ${i + 1}: contesto «${String(contesto)}» sconosciuto.`);
    return null;
  }
  const elencoDiId = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return {
    id,
    contesto,
    anno: numero(riga.anno),
    confermati: elencoDiId(riga.confermati),
    saltati: elencoDiId(riga.saltati),
    completatoIl: typeof riga.completatoIl === "string" ? riga.completatoIl : null,
    aggiornatoIl: testo(riga.aggiornatoIl) || new Date().toISOString(),
  };
};

const convalidaVocePatrimonio: Convalida<Dati["patrimonio"][number]> = (riga, i, errori) => {
  const id = richiedeId(riga, "patrimonio", i, errori);
  if (!id) return null;
  return {
    id,
    tipo: riga.tipo === "passivo" ? "passivo" : "attivo",
    categoria: testo(riga.categoria),
    descrizione: testo(riga.descrizione),
    valore: numero(riga.valore),
  };
};

/**
 * Le impostazioni di un anno, con i ripieghi presi **dai parametri di
 * quell'anno**.
 *
 * Erano dodici costanti di legge riscritte a mano — 85.000, 122.295, 0,2607 —
 * cioè i valori del 2026 messi in qualunque riga, compresa una del 2025. Due
 * divergono davvero: il massimale della Gestione Separata (122.295 contro
 * 120.607) e il minimale (18.808 contro 18.555), che sono esattamente i due
 * che l'INPS rivaluta ogni gennaio — quindi la divergenza cresce a ogni anno
 * nuovo invece di restare ferma. `MINIMALE_PREDEFINITO` non faceva eccezione:
 * veniva dai parametri invece che da una cifra scritta a mano, ma erano quelli
 * del 2026 messi in una riga del 2025, cioè lo stesso difetto travestito
 * meglio.
 *
 * L'anno della riga è già noto e già preteso: la riga che non ce l'ha viene
 * rifiutata poche righe più sotto, prima che un ripiego serva. Non esiste il
 * caso in cui l'app debba indovinare da quale anno pescare.
 */
function costruisciConvalidaImpostazioni(
  avvisi: string[],
): Convalida<Dati["impostazioni"][number]> {
  return (riga, i, errori) => {
  const anno = numero(riga.anno, Number.NaN);
  if (!Number.isInteger(anno) || anno < 2000 || anno > 2100) {
    errori.push(`impostazioni, riga ${i + 1}: anno mancante o fuori intervallo.`);
    return null;
  }

  const par = parametriDi(anno);
  /*
    I campi che il file non porta, e che quindi arrivano dalla legge. Si
    raccolgono qui e si dicono tutti insieme in fondo: un avviso per campo
    sarebbe un muro che nessuno legge.
  */
  const caduti: string[] = [];

  /**
   * Legge un campo, e **segna se è caduto sul ripiego**.
   *
   * Cade anche un valore presente ma illeggibile — una stringa dove ci vuole
   * un numero, un'aliquota fuori da zero-uno — perché per chi importa non
   * cambia niente: in archivio entra comunque un numero che nel file non c'era.
   */
  const preso = (
    campo: string,
    ripiego: number,
    leggi: (v: unknown, predefinito: number) => number = numero,
  ): number => {
    const grezzo = riga[campo];
    const letto = leggi(grezzo, ripiego);
    if (typeof grezzo !== "number" || !Number.isFinite(grezzo) || letto !== grezzo) {
      caduti.push(campo);
    }
    return letto;
  };
  const scaglioni = Array.isArray(riga.scaglioniIrpef)
    ? riga.scaglioniIrpef
        .filter(oggetto)
        .map((s) => ({
          limite: typeof s.limite === "number" ? s.limite : null,
          aliquota: fraZeroEUno(s.aliquota, 0),
        }))
    : [];
  if (scaglioni.length === 0) {
    errori.push(`impostazioni, riga ${i + 1}: scaglioni IRPEF mancanti.`);
    return null;
  }
  const regime = riga.regime === "ordinario" ? "ordinario" : "forfettario";
  /*
    La lista bianca delle gestioni.

    Va tenuta allineata al tipo `Gestione`: un valore che non c'è qui dentro
    diventa «separata» **in silenzio**, e chi importa il proprio backup si
    ritrova in un'altra cassa previdenziale senza che niente lo dica. Quando
    «commercianti» è stata aggiunta al tipo, questa riga non la conosceva.
    Un test la confronta con l'elenco dei valori ammessi.
  */
  const gestione = GESTIONI.includes(riga.gestione as Gestione)
    ? (riga.gestione as Gestione)
    : "separata";

  // Un backup scritto prima della schermata Parametri non ha l'elenco: vale
  // «niente confermato», che è la verità di quel backup.
  const dichiarati = Array.isArray(riga.dichiarati)
    ? riga.dichiarati.filter((c): c is string => typeof c === "string")
    : [];

  /*
    Contributi fissi dichiarati ma non scritti: la riga si rifiuta.

    Il ripiego era zero, ed è il peggiore possibile. Il campo entra nel calcolo
    **solo** se è dichiarato: un file che dice «li ho dichiarati» senza portare
    il valore fa entrare nel prospetto zero euro di contributi fissi —
    quattromilacinquecento in meno su un documento che va dal commercialista,
    senza che niente lo dica. Un archivio che non entra si vede; questo no.
  */
  const fissiDichiarati = dichiarati.includes("contributiFissi");
  const fissiScritti =
    typeof riga.contributiFissi === "number" && Number.isFinite(riga.contributiFissi);
  if (fissiDichiarati && !fissiScritti) {
    errori.push(
      `impostazioni, riga ${i + 1} (${anno}): i contributi fissi risultano dichiarati ma il valore manca. ` +
        "Scrivilo nel file accanto a «contributiFissi», oppure togli la voce da «dichiarati».",
    );
    return null;
  }

  const lette: Dati["impostazioni"][number] = {
    anno,
    nome: testo(riga.nome),
    dataAperturaPiva: dataOpzionale(riga.dataAperturaPiva),
    saldoInizialeAttivita: numero(riga.saldoInizialeAttivita),
    saldoInizialePersonale: numero(riga.saldoInizialePersonale),
    regime,
    gruppoAteco: testo(riga.gruppoAteco, "professionali"),
    coefficienteRedditivita: preso("coefficienteRedditivita", par.gruppiAteco[0].coefficiente, fraZeroEUno),
    nuovaAttivita: booleano(riga.nuovaAttivita),
    limiteForfettario: preso("limiteForfettario", par.limiteForfettario),
    sogliaUscita: preso("sogliaUscita", par.sogliaUscitaImmediata),
    aliquotaIva: preso("aliquotaIva", par.aliquotaIvaOrdinaria, fraZeroEUno),
    periodicitaIva: riga.periodicitaIva === "mensile" ? "mensile" : "trimestrale",
    maggiorazioneTrimestrale: preso("maggiorazioneTrimestrale", par.maggiorazioneTrimestrale, fraZeroEUno),
    scaglioniIrpef: scaglioni,
    addizionaleRegionale: fraZeroEUno(riga.addizionaleRegionale, 0),
    addizionaleComunale: fraZeroEUno(riga.addizionaleComunale, 0),
    detrazioniPersonali: numero(riga.detrazioniPersonali),
    fondoPensione: numero(riga.fondoPensione),
    gestione,
    aliquotaGestioneSeparata: preso("aliquotaGestioneSeparata", par.aliquotaGestioneSeparata, fraZeroEUno),
    massimaleGs: preso("massimaleGs", par.massimaleGestioneSeparata),
    minimaleGs: preso("minimaleGs", par.minimaleAnnuo),
    contributiFissi: numero(riga.contributiFissi),
    aliquotaSoggettivaCassa: fraZeroEUno(riga.aliquotaSoggettivaCassa, 0.15),
    aliquotaIntegrativaCassa: fraZeroEUno(riga.aliquotaIntegrativaCassa, 0.04),
    rivalsaAttiva: booleano(riga.rivalsaAttiva),
    aliquotaRivalsa: preso("aliquotaRivalsa", par.aliquotaRivalsaInps, fraZeroEUno),
    ritenutaAttiva: booleano(riga.ritenutaAttiva),
    aliquotaRitenuta: preso("aliquotaRitenuta", par.aliquotaRitenuta, fraZeroEUno),
    importoBollo: preso("importoBollo", par.importoBollo),
    sogliaBollo: preso("sogliaBollo", par.sogliaBollo),
    bolloAddebitato: booleano(riga.bolloAddebitato, true),
    terminiPagamento: numero(riga.terminiPagamento, 30),
    giorniLavorativi: numero(riga.giorniLavorativi, 220),
    oreFatturabiliGiorno: numero(riga.oreFatturabiliGiorno, 5),
    tariffaOraria: numeroOpzionale(riga.tariffaOraria),
    nettoDesiderato: numeroOpzionale(riga.nettoDesiderato),
    percentualeAccantonamento: fraZeroEUno(riga.percentualeAccantonamento, 0.3),
    costiFissiAnnui: numeroOpzionale(riga.costiFissiAnnui),
    // Le addizionali possono avere scaglioni propri: un backup più vecchio non
    // li ha, e l'assenza vale «aliquota unica», che è com'era davvero.
    scaglioniAddizionaleRegionale: leggiScaglioni(riga.scaglioniAddizionaleRegionale),
    esenzioneAddizionaleRegionale: numero(riga.esenzioneAddizionaleRegionale),
    scaglioniAddizionaleComunale: leggiScaglioni(riga.scaglioniAddizionaleComunale),
    esenzioneAddizionaleComunale: numero(riga.esenzioneAddizionaleComunale),
    dichiarati,
  };

  /*
    L'avviso nomina i campi e l'anno da cui vengono i valori.

    Due cose distinte, e servono tutte e due: **quali** campi il file non
    portava, perché chi importa possa andarli a guardare, e **da quale anno**
    arrivano i numeri che li hanno riempiti. Coincidono quasi sempre; quando
    non coincidono — un anno d'imposta per cui i parametri non sono ancora
    censiti — la riga sta prendendo aliquote di un altro anno, e questa è
    l'unica occasione in cui qualcuno può accorgersene.
  */
  if (caduti.length > 0) {
    const altroAnno = parametriSonoDellAnno(anno)
      ? ""
      : ` — attenzione: per il ${anno} non ci sono ancora parametri censiti, quindi i valori sono quelli del ${par.anno}`;
    const quanti =
      caduti.length === 1
        ? "un valore mancante nel file è stato preso"
        : `${caduti.length} valori mancanti nel file sono stati presi`;
    avvisi.push(
      `Impostazioni ${anno}: ${quanti} dai parametri di legge del ${par.anno}${altroAnno}. ${caduti.join(", ")}.`,
    );
  }

  return lette;
  };
}

/**
 * Legge un file di backup. Non lancia mai: restituisce gli errori da mostrare
 * all'utente, perché un import fallito non deve somigliare a un crash.
 */
export function analizzaBackup(testoGrezzo: string): RisultatoAnalisi {
  let radice: unknown;
  try {
    radice = JSON.parse(testoGrezzo);
  } catch {
    return {
      ok: false,
      recuperabile: false,
      errori: [
        "Il file non è JSON valido: probabilmente è stato troncato durante una copia o un trasferimento.",
      ],
    };
  }
  if (!oggetto(radice)) {
    return { ok: false, recuperabile: false, errori: ["Il file non contiene un oggetto di backup."] };
  }
  if (typeof radice.formato !== "string" || !FORMATI_ACCETTATI.includes(radice.formato)) {
    return {
      ok: false,
      recuperabile: false,
      errori: ["Questo file non è un backup di Flowlance: manca il marcatore di formato."],
    };
  }

  const avvisi: string[] = [];
  const versione = numero(radice.versioneSchema, 0);
  if (versione > VERSIONE_SCHEMA) {
    return {
      ok: false,
      recuperabile: false,
      errori: [
        `Il file è stato creato con una versione più recente dell'app (schema ${versione}, qui ${VERSIONE_SCHEMA}). Aggiorna l'app prima di importarlo.`,
      ],
    };
  }
  if (versione < VERSIONE_SCHEMA) {
    // Quali campi, e da quale anno: lo dicono le convalide riga per riga.
    // Questo avviso dice soltanto perché può succedere.
    avvisi.push(
      `Backup con schema ${versione}, più vecchio dell'attuale (${VERSIONE_SCHEMA}): quello che il file non porta viene riempito con i valori di legge dell'anno della riga.`,
    );
  }

  const contenuto = oggetto(radice.dati) ? radice.dati : {};
  const errori: string[] = [];
  const dati = datiVuoti();
  dati.impostazioni = convalidaElenco(
    contenuto.impostazioni,
    "impostazioni",
    costruisciConvalidaImpostazioni(avvisi),
    errori,
  );
  dati.clienti = convalidaElenco(contenuto.clienti, "clienti", convalidaCliente, errori);
  dati.fatture = convalidaElenco(contenuto.fatture, "fatture", convalidaFattura, errori);
  dati.note = convalidaElenco(contenuto.note, "note", convalidaNota, errori);
  dati.costi = convalidaElenco(contenuto.costi, "costi", convalidaCosto, errori);
  dati.movimentiPersonali = convalidaElenco(
    contenuto.movimentiPersonali, "movimentiPersonali", convalidaMovimentoPersonale, errori,
  );
  dati.movimentiAttivita = convalidaElenco(
    contenuto.movimentiAttivita, "movimentiAttivita", convalidaMovimentoAttivita, errori,
  );
  dati.versamenti = convalidaElenco(contenuto.versamenti, "versamenti", convalidaVersamento, errori);
  dati.patrimonio = convalidaElenco(contenuto.patrimonio, "patrimonio", convalidaVocePatrimonio, errori);
  dati.spunte = convalidaElenco(contenuto.spunte, "spunte", convalidaSpunta, errori);
  dati.chiusure = convalidaElenco(contenuto.chiusure, "chiusure", convalidaChiusura, errori);
  dati.percorsi = convalidaElenco(contenuto.percorsi, "percorsi", convalidaPercorso, errori);

  // Qui gli errori sono di riga: il file è un backup vero, con dentro dei
  // guasti localizzati. Si dice, perché si può rimediare.
  if (errori.length > 0) return { ok: false, errori, recuperabile: true };

  // Le fatture che puntano a un cliente inesistente restano importabili: meglio
  // un dato orfano visibile che un import respinto in blocco.
  const idClienti = new Set(dati.clienti.map((c) => c.id));
  const orfane = dati.fatture.filter((f) => f.clienteId && !idClienti.has(f.clienteId)).length;
  if (orfane > 0) {
    avvisi.push(
      `${orfane} ${orfane === 1 ? "fattura fa riferimento a un cliente" : "fatture fanno riferimento a clienti"} non presenti nel backup.`,
    );
  }

  return {
    ok: true,
    backup: {
      formato: FORMATO,
      versioneSchema: versione,
      esportatoIl: testo(radice.esportatoIl, new Date().toISOString()),
      dati,
    },
    avvisi,
  };
}

export { COLLEZIONI };
