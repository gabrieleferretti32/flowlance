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
import { PARAMETRI_2026 } from "@/lib/fisco/parametri/2026";
import type { ScaglioneIrpef } from "@/lib/fisco/tipi";
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
  | { ok: false; errori: string[] };

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

/*
  Il minimale di reddito annuo, per i backup che non ce l'hanno.

  È lo stesso valore per l'accredito della Gestione Separata e per l'eccedenza
  di artigiani e commercianti: due default diversi erano il modo più rapido di
  far divergere una costante sola.
*/
const MINIMALE_PREDEFINITO = PARAMETRI_2026.minimaleAnnuo;

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

const convalidaImpostazioni: Convalida<Dati["impostazioni"][number]> = (riga, i, errori) => {
  const anno = numero(riga.anno, Number.NaN);
  if (!Number.isInteger(anno) || anno < 2000 || anno > 2100) {
    errori.push(`impostazioni, riga ${i + 1}: anno mancante o fuori intervallo.`);
    return null;
  }
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
  const gestione =
    riga.gestione === "artigiani" || riga.gestione === "cassa" ? riga.gestione : "separata";
  return {
    anno,
    nome: testo(riga.nome),
    dataAperturaPiva: dataOpzionale(riga.dataAperturaPiva),
    saldoInizialeAttivita: numero(riga.saldoInizialeAttivita),
    saldoInizialePersonale: numero(riga.saldoInizialePersonale),
    regime,
    gruppoAteco: testo(riga.gruppoAteco, "professionali"),
    coefficienteRedditivita: fraZeroEUno(riga.coefficienteRedditivita, 0.78),
    nuovaAttivita: booleano(riga.nuovaAttivita),
    aliquotaSostitutiva: fraZeroEUno(riga.aliquotaSostitutiva, 0.15),
    limiteForfettario: numero(riga.limiteForfettario, 85_000),
    sogliaUscita: numero(riga.sogliaUscita, 100_000),
    aliquotaIva: fraZeroEUno(riga.aliquotaIva, 0.22),
    periodicitaIva: riga.periodicitaIva === "mensile" ? "mensile" : "trimestrale",
    maggiorazioneTrimestrale: fraZeroEUno(riga.maggiorazioneTrimestrale, 0.01),
    scaglioniIrpef: scaglioni,
    addizionaleRegionale: fraZeroEUno(riga.addizionaleRegionale, 0),
    addizionaleComunale: fraZeroEUno(riga.addizionaleComunale, 0),
    detrazioniPersonali: numero(riga.detrazioniPersonali),
    fondoPensione: numero(riga.fondoPensione),
    gestione,
    aliquotaGestioneSeparata: fraZeroEUno(riga.aliquotaGestioneSeparata, 0.2607),
    massimaleGs: numero(riga.massimaleGs, 122_295),
    minimaleGs: numero(riga.minimaleGs, MINIMALE_PREDEFINITO),
    contributiFissi: numero(riga.contributiFissi),
    minimaleArtigiani: numero(riga.minimaleArtigiani, MINIMALE_PREDEFINITO),
    aliquotaEccedenza: fraZeroEUno(riga.aliquotaEccedenza, 0.2448),
    aliquotaSoggettivaCassa: fraZeroEUno(riga.aliquotaSoggettivaCassa, 0.15),
    aliquotaIntegrativaCassa: fraZeroEUno(riga.aliquotaIntegrativaCassa, 0.04),
    rivalsaAttiva: booleano(riga.rivalsaAttiva),
    aliquotaRivalsa: fraZeroEUno(riga.aliquotaRivalsa, 0.04),
    ritenutaAttiva: booleano(riga.ritenutaAttiva),
    aliquotaRitenuta: fraZeroEUno(riga.aliquotaRitenuta, 0.2),
    importoBollo: numero(riga.importoBollo, 2),
    sogliaBollo: numero(riga.sogliaBollo, 77.47),
    bolloAddebitato: booleano(riga.bolloAddebitato, true),
    terminiPagamento: numero(riga.terminiPagamento, 30),
    giorniLavorativi: numero(riga.giorniLavorativi, 220),
    oreFatturabiliGiorno: numero(riga.oreFatturabiliGiorno, 5),
    tariffaOraria: numeroOpzionale(riga.tariffaOraria),
    nettoDesiderato: numeroOpzionale(riga.nettoDesiderato),
    percentualeAccantonamento: fraZeroEUno(riga.percentualeAccantonamento, 0.3),
    mesiFondoEmergenza: numero(riga.mesiFondoEmergenza, 6),
    costiFissiAnnui: numeroOpzionale(riga.costiFissiAnnui),
    // Le addizionali possono avere scaglioni propri: un backup più vecchio non
    // li ha, e l'assenza vale «aliquota unica», che è com'era davvero.
    scaglioniAddizionaleRegionale: leggiScaglioni(riga.scaglioniAddizionaleRegionale),
    esenzioneAddizionaleRegionale: numero(riga.esenzioneAddizionaleRegionale),
    scaglioniAddizionaleComunale: leggiScaglioni(riga.scaglioniAddizionaleComunale),
    esenzioneAddizionaleComunale: numero(riga.esenzioneAddizionaleComunale),
    // Un backup scritto prima della schermata Parametri non ha l'elenco: vale
    // «niente confermato», che è la verità di quel backup.
    dichiarati: Array.isArray(riga.dichiarati)
      ? riga.dichiarati.filter((c): c is string => typeof c === "string")
      : [],
  };
};

/**
 * Legge un file di backup. Non lancia mai: restituisce gli errori da mostrare
 * all'utente, perché un import fallito non deve somigliare a un crash.
 */
export function analizzaBackup(testoGrezzo: string): RisultatoAnalisi {
  let radice: unknown;
  try {
    radice = JSON.parse(testoGrezzo);
  } catch {
    return { ok: false, errori: ["Il file non è JSON valido."] };
  }
  if (!oggetto(radice)) {
    return { ok: false, errori: ["Il file non contiene un oggetto di backup."] };
  }
  if (typeof radice.formato !== "string" || !FORMATI_ACCETTATI.includes(radice.formato)) {
    return {
      ok: false,
      errori: [
        "Questo file non è un backup di Flowlance: manca il marcatore di formato.",
      ],
    };
  }

  const avvisi: string[] = [];
  const versione = numero(radice.versioneSchema, 0);
  if (versione > VERSIONE_SCHEMA) {
    return {
      ok: false,
      errori: [
        `Il file è stato creato con una versione più recente dell'app (schema ${versione}, qui ${VERSIONE_SCHEMA}). Aggiorna l'app prima di importarlo.`,
      ],
    };
  }
  if (versione < VERSIONE_SCHEMA) {
    avvisi.push(
      `Backup con schema ${versione}, più vecchio dell'attuale (${VERSIONE_SCHEMA}): i campi mancanti prendono i valori predefiniti.`,
    );
  }

  const contenuto = oggetto(radice.dati) ? radice.dati : {};
  const errori: string[] = [];
  const dati = datiVuoti();
  dati.impostazioni = convalidaElenco(contenuto.impostazioni, "impostazioni", convalidaImpostazioni, errori);
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

  if (errori.length > 0) return { ok: false, errori };

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
