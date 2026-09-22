/**
 * Lettura di un file Excel, scritta a mano e caricata a richiesta.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché non una libreria
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le due che si usano pesano 900 KB e 2,4 MB una volta srotolate, e quella
 * pubblicata su npm con il nome più noto è ferma a una versione con una falla
 * nota — proprio nel pezzo che legge i file che arrivano da fuori, che è
 * esattamente quello che facciamo qui. Un rendiconto bancario è un file che
 * qualcun altro ha scritto: il programma che lo apre non dovrebbe essere il
 * pezzo di codice di cui sappiamo di meno.
 *
 * Un `.xlsx` è uno ZIP con dentro dell'XML. Quello che serve a un rendiconto —
 * un foglio, le stringhe condivise, i numeri, le date — si legge in meno righe
 * di quante ne costi portarsi dietro un parser generale. È la stessa scelta
 * già fatta per il CSV, per gli stessi motivi, scritta in `csv/parser.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Quello che **non** legge, e lo dice invece di indovinare
 * ─────────────────────────────────────────────────────────────────────────
 *
 * File protetti da password, i vecchi `.xls` binari, gli ZIP in formato zip64
 * e le compressioni diverse da «nessuna» e «deflate». In tutti questi casi
 * torna un motivo scritto in italiano e **nessuna riga**: mezzo rendiconto
 * letto male è peggio di un file rifiutato, perché il mezzo che manca non lo
 * cerca nessuno.
 *
 * Legge il **primo foglio che ha delle righe**, e dice quale ha preso: un file
 * con tre fogli dove il secondo è quello buono è un caso che esiste, e la
 * schermata deve poterlo nominare.
 */
import type { Tabella } from "@/lib/csv/parser";

export type EsitoXlsx =
  | { ok: true; tabella: Tabella; foglio: string }
  | { ok: false; motivo: string };

// ————————————————————————————————————————————————————————————
// Lo ZIP
// ————————————————————————————————————————————————————————————

type VoceZip = { nome: string; metodo: number; compressa: number; offset: number };

const FIRMA_EOCD = 0x06054b50;
const FIRMA_CENTRALE = 0x02014b50;
const FIRMA_LOCALE = 0x04034b50;

/**
 * La coda dello ZIP, cercata all'indietro.
 *
 * Non sta a un offset fisso: dopo di lei può esserci un commento lungo fino a
 * 65.535 byte, quindi si cerca la firma partendo dalla fine.
 */
function trovaEocd(dv: DataView): number {
  const minimo = Math.max(0, dv.byteLength - 22 - 0xffff);
  for (let i = dv.byteLength - 22; i >= minimo; i -= 1) {
    if (dv.getUint32(i, true) === FIRMA_EOCD) return i;
  }
  return -1;
}

function leggiIndice(dv: DataView, byte: Uint8Array): VoceZip[] | null {
  const eocd = trovaEocd(dv);
  if (eocd < 0) return null;
  const quante = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  if (p === 0xffffffff) return null; // zip64: vedi il commento in testa.

  const voci: VoceZip[] = [];
  const nomi = new TextDecoder("utf-8");
  for (let i = 0; i < quante; i += 1) {
    if (p + 46 > dv.byteLength || dv.getUint32(p, true) !== FIRMA_CENTRALE) return null;
    const metodo = dv.getUint16(p + 10, true);
    const compressa = dv.getUint32(p + 20, true);
    const lunghezzaNome = dv.getUint16(p + 28, true);
    const extra = dv.getUint16(p + 30, true);
    const commento = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    const nome = nomi.decode(byte.subarray(p + 46, p + 46 + lunghezzaNome));
    voci.push({ nome, metodo, compressa, offset });
    p += 46 + lunghezzaNome + extra + commento;
  }
  return voci;
}

/** Il contenuto di una voce, come testo. `null` se non si sa scompattarla. */
async function estrai(dv: DataView, byte: Uint8Array, voce: VoceZip): Promise<string | null> {
  const p = voce.offset;
  if (p + 30 > dv.byteLength || dv.getUint32(p, true) !== FIRMA_LOCALE) return null;
  const lunghezzaNome = dv.getUint16(p + 26, true);
  const extra = dv.getUint16(p + 28, true);
  const inizio = p + 30 + lunghezzaNome + extra;
  const dati = byte.subarray(inizio, inizio + voce.compressa);

  if (voce.metodo === 0) return new TextDecoder("utf-8").decode(dati);
  if (voce.metodo !== 8) return null;
  /*
    `DecompressionStream` è nel browser e in Node: il deflate lo fa la
    piattaforma, che è l'unico pezzo di questo file che non ha senso scrivere
    a mano.
  */
  const flusso = new Blob([dati.slice()]).stream().pipeThrough(
    new DecompressionStream("deflate-raw"),
  );
  return await new Response(flusso).text();
}

// ————————————————————————————————————————————————————————————
// L'XML, solo i pezzi che servono
// ————————————————————————————————————————————————————————————

const ENTITA: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
};

function disfaEntita(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (intero, corpo: string) => {
    if (corpo.startsWith("#x") || corpo.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(corpo.slice(2), 16));
    }
    if (corpo.startsWith("#")) return String.fromCodePoint(Number(corpo.slice(1)));
    return ENTITA[corpo] ?? intero;
  });
}

function attributo(tag: string, nome: string): string | null {
  const m = new RegExp(`\\b${nome}="([^"]*)"`).exec(tag);
  return m ? disfaEntita(m[1]) : null;
}

/** Il testo di un blocco, cioè tutti i suoi `<t>` messi in fila. */
function testoDi(blocco: string): string {
  let fuori = "";
  const t = /<t\b[^>]*\/>|<t\b[^>]*>([\s\S]*?)<\/t>/g;
  let m: RegExpExecArray | null;
  while ((m = t.exec(blocco)) !== null) fuori += disfaEntita(m[1] ?? "");
  return fuori;
}

function stringheCondivise(xml: string): string[] {
  const fuori: string[] = [];
  const si = /<si\b[^>]*\/>|<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = si.exec(xml)) !== null) fuori.push(m[1] === undefined ? "" : testoDi(m[1]));
  return fuori;
}

// ————————————————————————————————————————————————————————————
// Le date, che sono la parte insidiosa
// ————————————————————————————————————————————————————————————

/** I formati di data e ora predefiniti di Excel, per numero. */
const FORMATI_DATA = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/**
 * Un formato personalizzato che parla di date.
 *
 * Si tolgono prima i pezzi fra virgolette e fra parentesi quadre — «"kg"» e
 * «[Rosso]» — perché una lettera dentro un'etichetta non fa di un numero una
 * data. Quello che resta si guarda: se c'è un giorno, un mese o un anno, è una
 * data.
 */
function formatoDiData(codice: string): boolean {
  const pulito = codice.replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "");
  return /[dmy]/i.test(pulito);
}

/**
 * Da numero di serie Excel a `gg/mm/aaaa`.
 *
 * L'epoca è il 30 dicembre 1899 e non il 1° gennaio 1900 perché Excel conta
 * un 29 febbraio 1900 che non è mai esistito: con questa epoca i seriali dal
 * 1° marzo 1900 in poi — cioè tutti quelli di un estratto conto — tornano
 * giusti.
 */
function dataDaSeriale(seriale: number): string | null {
  if (!Number.isFinite(seriale) || seriale < 61 || seriale > 2_958_465) return null;
  const giorni = Math.floor(seriale);
  const d = new Date(Date.UTC(1899, 11, 30) + giorni * 86_400_000);
  const due = (n: number) => String(n).padStart(2, "0");
  return `${due(d.getUTCDate())}/${due(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// ————————————————————————————————————————————————————————————
// Il foglio
// ————————————————————————————————————————————————————————————

/** Da `BC` a 54: la colonna come numero, partendo da zero. */
function colonnaDi(riferimento: string): number {
  const lettere = /^([A-Z]+)/.exec(riferimento.toUpperCase());
  if (!lettere) return 0;
  let n = 0;
  for (const c of lettere[1]) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

function righeDelFoglio(xml: string, condivise: string[], dataPerStile: boolean[]): string[][] {
  const righe: string[][] = [];
  const row = /<row\b[^>]*\/>|<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let r: RegExpExecArray | null;
  while ((r = row.exec(xml)) !== null) {
    const dentro = r[1] ?? "";
    const celle: string[] = [];
    const c = /<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let m: RegExpExecArray | null;
    while ((m = c.exec(dentro)) !== null) {
      const tag = m[1] ?? m[2] ?? "";
      const corpo = m[3] ?? "";
      const riferimento = attributo(tag, "r");
      const indice = riferimento ? colonnaDi(riferimento) : celle.length;
      while (celle.length < indice) celle.push("");
      celle[indice] = valoreCella(tag, corpo, condivise, dataPerStile);
    }
    righe.push(celle);
  }
  return righe;
}

function valoreCella(
  tag: string,
  corpo: string,
  condivise: string[],
  dataPerStile: boolean[],
): string {
  const tipo = attributo(tag, "t") ?? "n";
  if (tipo === "s") {
    const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(corpo);
    const i = v ? Number(v[1]) : Number.NaN;
    return condivise[i] ?? "";
  }
  if (tipo === "inlineStr") return testoDi(corpo);
  if (tipo === "str" || tipo === "e") {
    const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(corpo);
    return v ? disfaEntita(v[1]) : "";
  }

  const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(corpo);
  if (!v) return "";
  const grezzo = v[1].trim();
  if (tipo === "b") return grezzo === "1" ? "VERO" : "FALSO";

  const stile = Number(attributo(tag, "s") ?? "");
  if (Number.isFinite(stile) && dataPerStile[stile]) {
    const data = dataDaSeriale(Number(grezzo));
    if (data) return data;
  }
  return grezzo;
}

/** Quali stili sono formati di data, nell'ordine di `cellXfs`. */
function stiliDiData(xml: string | null): boolean[] {
  if (!xml) return [];
  const personalizzati = new Map<number, string>();
  const nf = /<numFmt\b([^>]*)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = nf.exec(xml)) !== null) {
    const id = Number(attributo(m[1], "numFmtId") ?? "");
    const codice = attributo(m[1], "formatCode") ?? "";
    if (Number.isFinite(id)) personalizzati.set(id, codice);
  }

  const blocco = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml);
  if (!blocco) return [];
  const fuori: boolean[] = [];
  const xf = /<xf\b([^>]*?)(?:\/>|>[\s\S]*?<\/xf>)/g;
  while ((m = xf.exec(blocco[1])) !== null) {
    const id = Number(attributo(m[1], "numFmtId") ?? "0");
    const codice = personalizzati.get(id);
    fuori.push(FORMATI_DATA.has(id) || (codice !== undefined && formatoDiData(codice)));
  }
  return fuori;
}

/** I fogli del file, nell'ordine in cui stanno nella cartella. */
function fogliDelLibro(workbook: string | null, rels: string | null): { nome: string; file: string }[] {
  if (!workbook) return [];
  const percorsi = new Map<string, string>();
  const rel = /<Relationship\b([^>]*)\/>/g;
  let m: RegExpExecArray | null;
  while (rels && (m = rel.exec(rels)) !== null) {
    const id = attributo(m[1], "Id");
    const target = attributo(m[1], "Target");
    if (id && target) percorsi.set(id, target.replace(/^\/?xl\//, "").replace(/^\//, ""));
  }

  const fuori: { nome: string; file: string }[] = [];
  const sheet = /<sheet\b([^>]*)\/>/g;
  while ((m = sheet.exec(workbook)) !== null) {
    const nome = attributo(m[1], "name") ?? "Foglio";
    const id = attributo(m[1], "r:id") ?? attributo(m[1], "id") ?? "";
    const file = percorsi.get(id);
    if (file) fuori.push({ nome, file: `xl/${file}` });
  }
  return fuori;
}

/**
 * Legge il primo foglio con delle righe.
 *
 * La prima riga non vuota diventa l'intestazione, come nel CSV: da lì in poi
 * il rendiconto passa per la stessa strada — la mappatura delle colonne,
 * l'anteprima, i duplicati — e non c'è un secondo percorso da tenere allineato.
 */
export async function leggiXlsx(byte: ArrayBuffer): Promise<EsitoXlsx> {
  const dati = new Uint8Array(byte);
  const dv = new DataView(byte);

  if (dati.length >= 8 && dv.getUint32(0, false) === 0xd0cf11e0) {
    return {
      ok: false,
      motivo:
        "Questo è un Excel vecchio (.xls). Aprilo e salvalo come .xlsx o come CSV: il formato binario non si legge.",
    };
  }
  if (dati.length < 22 || dati[0] !== 0x50 || dati[1] !== 0x4b) {
    return { ok: false, motivo: "Questo non è un file Excel: non è nemmeno uno ZIP." };
  }

  const voci = leggiIndice(dv, dati);
  if (!voci) {
    return {
      ok: false,
      motivo: "Il file è uno ZIP che non riesco a leggere: forse è troncato, o in formato zip64.",
    };
  }
  if (voci.some((v) => v.nome.startsWith("EncryptedPackage"))) {
    return { ok: false, motivo: "Il file è protetto da password: toglila e riprova." };
  }

  const cerca = (nome: string) => voci.find((v) => v.nome === nome) ?? null;
  const testo = async (nome: string) => {
    const voce = cerca(nome);
    return voce ? await estrai(dv, dati, voce) : null;
  };

  const workbook = await testo("xl/workbook.xml");
  if (!workbook) {
    return { ok: false, motivo: "Dentro il file non c'è nessuna cartella di lavoro." };
  }
  const fogli = fogliDelLibro(workbook, await testo("xl/_rels/workbook.xml.rels"));
  if (fogli.length === 0) return { ok: false, motivo: "Dentro il file non c'è nessun foglio." };

  const condivise = stringheCondivise((await testo("xl/sharedStrings.xml")) ?? "");
  const dataPerStile = stiliDiData(await testo("xl/styles.xml"));

  for (const foglio of fogli) {
    const voce = cerca(foglio.file);
    if (!voce) continue;
    const xml = await estrai(dv, dati, voce);
    if (xml === null) {
      return {
        ok: false,
        motivo: "Il foglio è compresso in un modo che non conosco: riprova salvandolo di nuovo.",
      };
    }
    const righe = righeDelFoglio(xml, condivise, dataPerStile).filter((r) =>
      r.some((c) => c.trim() !== ""),
    );
    if (righe.length === 0) continue;

    const [intestazioni, ...resto] = righe;
    return {
      ok: true,
      foglio: foglio.nome,
      // Nessun separatore: in un foglio le colonne sono già colonne, ed è il
      // motivo per cui l'Excel non ha il problema che il CSV ha.
      tabella: { intestazioni, righe: resto, separatore: "" },
    };
  }

  return { ok: false, motivo: "Tutti i fogli del file sono vuoti." };
}
