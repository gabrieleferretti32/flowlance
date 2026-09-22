import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { leggiXlsx } from "./xlsx";
import { trovaIntestazione } from "./intestazione";

/**
 * I file di prova si costruiscono qui, byte per byte.
 *
 * Un `.xlsx` è uno ZIP con dentro dell'XML: scriverne uno a mano costa venti
 * righe e dà una cosa che nessun'altra strada dà — un file vero, con le sue
 * intestazioni e il suo deflate, invece di una finta struttura che somiglia a
 * quello che il lettore si aspetta di trovare. Un test che costruisce
 * l'oggetto che il codice vuole ricevere prova il codice contro se stesso.
 */

type Voce = { nome: string; contenuto: string; comprimi?: boolean };

const ascii = (s: string) => new TextEncoder().encode(s);

function crc32(dati: Uint8Array): number {
  let c = ~0;
  for (const b of dati) {
    c ^= b;
    for (let i = 0; i < 8; i += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

/** Uno ZIP con le sole parti che il lettore guarda. */
function zip(voci: Voce[]): ArrayBuffer {
  const pezzi: Uint8Array[] = [];
  const centrale: Uint8Array[] = [];
  let offset = 0;

  for (const voce of voci) {
    const nome = ascii(voce.nome);
    const crudi = ascii(voce.contenuto);
    const comprimi = voce.comprimi ?? true;
    const dati = comprimi ? new Uint8Array(deflateRawSync(crudi)) : crudi;

    const locale = new Uint8Array(30 + nome.length + dati.length);
    const dvl = new DataView(locale.buffer);
    dvl.setUint32(0, 0x04034b50, true);
    dvl.setUint16(4, 20, true);
    dvl.setUint16(8, comprimi ? 8 : 0, true);
    dvl.setUint32(14, crc32(crudi), true);
    dvl.setUint32(18, dati.length, true);
    dvl.setUint32(22, crudi.length, true);
    dvl.setUint16(26, nome.length, true);
    locale.set(nome, 30);
    locale.set(dati, 30 + nome.length);
    pezzi.push(locale);

    const voceCentrale = new Uint8Array(46 + nome.length);
    const dvc = new DataView(voceCentrale.buffer);
    dvc.setUint32(0, 0x02014b50, true);
    dvc.setUint16(10, comprimi ? 8 : 0, true);
    dvc.setUint32(16, crc32(crudi), true);
    dvc.setUint32(20, dati.length, true);
    dvc.setUint32(24, crudi.length, true);
    dvc.setUint16(28, nome.length, true);
    dvc.setUint32(42, offset, true);
    voceCentrale.set(nome, 46);
    centrale.push(voceCentrale);
    offset += locale.length;
  }

  const indice = centrale.reduce((n, v) => n + v.length, 0);
  const coda = new Uint8Array(22);
  const dvf = new DataView(coda.buffer);
  dvf.setUint32(0, 0x06054b50, true);
  dvf.setUint16(8, voci.length, true);
  dvf.setUint16(10, voci.length, true);
  dvf.setUint32(12, indice, true);
  dvf.setUint32(16, offset, true);

  const tutto = [...pezzi, ...centrale, coda];
  const fuori = new Uint8Array(tutto.reduce((n, v) => n + v.length, 0));
  let p = 0;
  for (const v of tutto) {
    fuori.set(v, p);
    p += v.length;
  }
  return fuori.buffer;
}

const WORKBOOK = `<workbook><sheets><sheet name="Movimenti" sheetId="1" r:id="rId1"/></sheets></workbook>`;
const RELS = `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`;
const STILI = `<styleSheet><numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>` +
  `<cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="4"/></cellXfs></styleSheet>`;
const CONDIVISE = `<sst><si><t>Data</t></si><si><t>Descrizione</t></si><si><t>Importo</t></si>` +
  `<si><r><t>PAGAMENTO </t></r><r><t>POS ESSELUNGA</t></r></si></sst>`;

/** Un rendiconto come lo esporta una banca: intestazioni, una data, un importo. */
const FOGLIO = `<worksheet><sheetData>
  <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
  <row r="2"><c r="A2" s="1"><v>46082</v></c><c r="B2" t="s"><v>3</v></c><c r="C2" s="2"><v>-42.9</v></c></row>
  <row r="3"><c r="A3" s="1"><v>46083</v></c><c r="B3" t="inlineStr"><is><t>BONIFICO da Studio &amp; C.</t></is></c><c r="C3" s="2"><v>1500</v></c></row>
</sheetData></worksheet>`;

const rendiconto = (extra: Partial<Record<string, string>> = {}) =>
  zip([
    { nome: "xl/workbook.xml", contenuto: extra.workbook ?? WORKBOOK },
    { nome: "xl/_rels/workbook.xml.rels", contenuto: RELS },
    { nome: "xl/sharedStrings.xml", contenuto: CONDIVISE },
    { nome: "xl/styles.xml", contenuto: extra.stili ?? STILI },
    { nome: "xl/worksheets/sheet1.xml", contenuto: extra.foglio ?? FOGLIO },
  ]);

describe("un rendiconto in Excel", () => {
  it("si legge: intestazioni, righe, e il nome del foglio", async () => {
    const esito = await leggiXlsx(rendiconto());
    expect(esito.ok, esito.ok ? "" : esito.motivo).toBe(true);
    if (!esito.ok) return;
    expect(esito.foglio).toBe("Movimenti");
    expect(esito.righe[0]).toEqual(["Data", "Descrizione", "Importo"]);
    expect(esito.righe.slice(1)).toHaveLength(2);
  });

  it("**le date tornano giorno/mese/anno, non numeri di serie**", async () => {
    const esito = await leggiXlsx(rendiconto());
    if (!esito.ok) throw new Error(esito.motivo);
    /*
      46082 è il 1° marzo 2026. La prima stesura di questo test diceva 2 marzo,
      e aveva torto: il lettore ha ragione, e il conto si ricontrolla da fuori —
      45658 è il 1° gennaio 2025 e 36526 il 1° gennaio 2000, che sono i due
      seriali che si trovano scritti ovunque.

      Se uscisse «46082» nessuno se ne accorgerebbe fino all'anteprima, dove
      sarebbe una riga scartata per «data non leggibile».
    */
    expect(esito.righe[1][0]).toBe("01/03/2026");
    expect(esito.righe[2][0]).toBe("02/03/2026");
  });

  it("**l'epoca è quella giusta: i due seriali che si trovano scritti ovunque**", async () => {
    const foglio = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c></row>
      <row r="2"><c r="A2" s="1"><v>45658</v></c></row>
      <row r="3"><c r="A3" s="1"><v>36526</v></c></row>
    </sheetData></worksheet>`;
    const esito = await leggiXlsx(rendiconto({ foglio }));
    if (!esito.ok) throw new Error(esito.motivo);
    expect(esito.righe.slice(1).map((r) => r[0])).toEqual(["01/01/2025", "01/01/2000"]);
  });

  it("e un numero con un formato non di data resta un numero", async () => {
    const esito = await leggiXlsx(rendiconto());
    if (!esito.ok) throw new Error(esito.motivo);
    expect(esito.righe[1][2]).toBe("-42.9");
    expect(esito.righe[2][2]).toBe("1500");
  });

  it("le stringhe condivise spezzate in più pezzi si ricompongono", async () => {
    const esito = await leggiXlsx(rendiconto());
    if (!esito.ok) throw new Error(esito.motivo);
    expect(esito.righe[1][1]).toBe("PAGAMENTO POS ESSELUNGA");
  });

  it("le stringhe scritte dentro la cella si leggono, con le entità sciolte", async () => {
    const esito = await leggiXlsx(rendiconto());
    if (!esito.ok) throw new Error(esito.motivo);
    expect(esito.righe[2][1]).toBe("BONIFICO da Studio & C.");
  });

  it("**una cella saltata lascia una colonna vuota, non sposta le altre**", async () => {
    const buchi = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>2</v></c></row>
      <row r="2"><c r="C2" s="2"><v>12</v></c></row>
    </sheetData></worksheet>`;
    const esito = await leggiXlsx(rendiconto({ foglio: buchi }));
    if (!esito.ok) throw new Error(esito.motivo);
    expect(esito.righe[0]).toEqual(["Data", "", "Importo"]);
    // Se l'importo scivolasse in prima colonna finirebbe sotto «Data».
    expect(esito.righe[1]).toEqual(["", "", "12"]);
  });

  it("le righe vuote in coda non contano", async () => {
    const conVuote = FOGLIO.replace("</sheetData>", '<row r="4"><c r="A4"/></row></sheetData>');
    const esito = await leggiXlsx(rendiconto({ foglio: conVuote }));
    if (!esito.ok) throw new Error(esito.motivo);
    expect(esito.righe).toHaveLength(3);
  });

  it("**una riga vuota in mezzo resta al suo posto: i numeri devono tornare**", async () => {
    /*
      Il foglio salta la riga 3 e riprende dalla 4. Leggendo le righe in fila
      tutto scivolerebbe in su di una, e «intestazione alla riga 9» indicherebbe
      la riga 8 del foglio di chi guarda.
    */
    const conBuco = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
      <row r="4"><c r="A4" s="1"><v>46082</v></c><c r="B4" t="s"><v>3</v></c></row>
    </sheetData></worksheet>`;
    const esito = await leggiXlsx(rendiconto({ foglio: conBuco }));
    if (!esito.ok) throw new Error(esito.motivo);
    expect(esito.righe).toHaveLength(4);
    expect(esito.righe[1]).toEqual([]);
    expect(esito.righe[2]).toEqual([]);
    expect(esito.righe[3][0]).toBe("01/03/2026");
  });

  it("e sotto l'intestazione quelle vuote non diventano righe da scartare", async () => {
    const conBuco = `<worksheet><sheetData>
      <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
      <row r="2"><c r="A2" s="1"><v>46082</v></c><c r="B2" t="s"><v>3</v></c></row>
      <row r="4"><c r="A4" s="1"><v>46083</v></c><c r="B4" t="s"><v>3</v></c></row>
    </sheetData></worksheet>`;
    const esito = await leggiXlsx(rendiconto({ foglio: conBuco }));
    if (!esito.ok) throw new Error(esito.motivo);
    const scelta = trovaIntestazione(esito.righe);
    expect(scelta.riga).toBe(1);
    expect(scelta.righe).toHaveLength(2);
  });

  it("legge anche le voci non compresse: negli ZIP capitano", async () => {
    const crudo = zip([
      { nome: "xl/workbook.xml", contenuto: WORKBOOK, comprimi: false },
      { nome: "xl/_rels/workbook.xml.rels", contenuto: RELS, comprimi: false },
      { nome: "xl/sharedStrings.xml", contenuto: CONDIVISE, comprimi: false },
      { nome: "xl/styles.xml", contenuto: STILI, comprimi: false },
      { nome: "xl/worksheets/sheet1.xml", contenuto: FOGLIO, comprimi: false },
    ]);
    const esito = await leggiXlsx(crudo);
    expect(esito.ok, esito.ok ? "" : esito.motivo).toBe(true);
  });
});

describe("**un foglio con la copertina sopra la tabella**", () => {
  /*
    Il primo file vero del giro: un estratto conto con sette righe di
    copertina — banca, intestatario, numero di conto, periodo — e la tabella
    solo dopo. Il lettore consegna tutte le righe, e a trovare l'intestazione
    è `trovaIntestazione`: qui si prova che le due cose insieme fanno quello
    che il file chiede.
  */
  const testi = [
    "Trade Republic Bank GmbH", "Estratto conto", "Intestatario", "Mario Rossi",
    "Conto", "1000/00065493", "Periodo", "01/01/2026 - 31/03/2026",
    "Data", "Tipo", "Descrizione", "Importo", "Pagamento", "POS ESSELUNGA",
    "Accredito", "BONIFICO DA STUDIO",
  ];
  const s = (parola: string) => testi.indexOf(parola);
  const sst = `<sst>${testi.map((x) => `<si><t>${x}</t></si>`).join("")}</sst>`;

  const riga = (n: number, celle: string) => `<row r="${n}">${celle}</row>`;
  const testo = (rif: string, parola: string) => `<c r="${rif}" t="s"><v>${s(parola)}</v></c>`;
  const data = (rif: string, seriale: number) => `<c r="${rif}" s="1"><v>${seriale}</v></c>`;
  const numero = (rif: string, v: string) => `<c r="${rif}" s="2"><v>${v}</v></c>`;

  const foglio = `<worksheet><sheetData>
    ${riga(1, testo("A1", "Trade Republic Bank GmbH"))}
    ${riga(2, testo("A2", "Estratto conto"))}
    ${riga(3, testo("A3", "Intestatario") + testo("B3", "Mario Rossi"))}
    ${riga(4, testo("A4", "Conto") + testo("B4", "1000/00065493"))}
    ${riga(5, testo("A5", "Periodo") + testo("B5", "01/01/2026 - 31/03/2026"))}
    ${riga(6, testo("A6", "Data") + testo("B6", "Tipo") + testo("C6", "Descrizione") + testo("D6", "Importo"))}
    ${riga(7, data("A7", 46034) + testo("B7", "Pagamento") + testo("C7", "POS ESSELUNGA") + numero("D7", "-42.9"))}
    ${riga(8, data("A8", 46037) + testo("B8", "Accredito") + testo("C8", "BONIFICO DA STUDIO") + numero("D8", "1500"))}
    ${riga(9, data("A9", 46060) + testo("B9", "Pagamento") + testo("C9", "POS ESSELUNGA") + numero("D9", "-64.1"))}
  </sheetData></worksheet>`;

  const file = zip([
    { nome: "xl/workbook.xml", contenuto: `<workbook><sheets><sheet name="Lista Operazione" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { nome: "xl/_rels/workbook.xml.rels", contenuto: RELS },
    { nome: "xl/sharedStrings.xml", contenuto: sst },
    { nome: "xl/styles.xml", contenuto: STILI },
    { nome: "xl/worksheets/sheet1.xml", contenuto: foglio },
  ]);

  it("il lettore consegna tutte le righe, copertina compresa", async () => {
    const esito = await leggiXlsx(file);
    expect(esito.ok, esito.ok ? "" : esito.motivo).toBe(true);
    if (!esito.ok) return;
    expect(esito.righe).toHaveLength(9);
    expect(esito.righe[0][0]).toBe("Trade Republic Bank GmbH");
  });

  it("**e l'intestazione si trova alla riga 6, con le sue quattro colonne**", async () => {
    const esito = await leggiXlsx(file);
    if (!esito.ok) throw new Error(esito.motivo);
    const scelta = trovaIntestazione(esito.righe);
    expect(scelta.riga).toBe(6);
    expect(scelta.intestazioni).toEqual(["Data", "Tipo", "Descrizione", "Importo"]);
    expect(scelta.righe).toHaveLength(3);
    expect(scelta.righe.map((r) => r[0])).toEqual(["12/01/2026", "15/01/2026", "07/02/2026"]);
  });

  it("e «Periodo · 01/01/2026 - 31/03/2026» non viene scambiata per una riga di dati", async () => {
    const esito = await leggiXlsx(file);
    if (!esito.ok) throw new Error(esito.motivo);
    // Due date dentro una cella sola non sono una data: se lo fossero, la
    // copertina diventerebbe l'ultima riga di dati e l'intestazione sarebbe
    // quella sbagliata.
    expect(trovaIntestazione(esito.righe).riga).toBe(6);
  });
});

describe("più fogli", () => {
  it("prende il primo che ha delle righe, e lo nomina", async () => {
    const workbook = `<workbook><sheets>` +
      `<sheet name="Istruzioni" sheetId="1" r:id="rId1"/>` +
      `<sheet name="Conto corrente" sheetId="2" r:id="rId2"/>` +
      `</sheets></workbook>`;
    const rels = `<Relationships>` +
      `<Relationship Id="rId1" Target="worksheets/sheet0.xml"/>` +
      `<Relationship Id="rId2" Target="worksheets/sheet1.xml"/>` +
      `</Relationships>`;
    const file = zip([
      { nome: "xl/workbook.xml", contenuto: workbook },
      { nome: "xl/_rels/workbook.xml.rels", contenuto: rels },
      { nome: "xl/sharedStrings.xml", contenuto: CONDIVISE },
      { nome: "xl/styles.xml", contenuto: STILI },
      { nome: "xl/worksheets/sheet0.xml", contenuto: `<worksheet><sheetData/></worksheet>` },
      { nome: "xl/worksheets/sheet1.xml", contenuto: FOGLIO },
    ]);
    const esito = await leggiXlsx(file);
    expect(esito.ok, esito.ok ? "" : esito.motivo).toBe(true);
    if (!esito.ok) return;
    expect(esito.foglio).toBe("Conto corrente");
    expect(esito.righe.slice(1)).toHaveLength(2);
  });
});

describe("**quello che non sa leggere lo dice, e non restituisce mezze righe**", () => {
  const motivo = async (byte: ArrayBuffer) => {
    const esito = await leggiXlsx(byte);
    expect(esito.ok).toBe(false);
    return esito.ok ? "" : esito.motivo;
  };

  it("un CSV rinominato in .xlsx", async () => {
    expect(await motivo(ascii("Data;Importo\n01/01/2026;10").buffer as ArrayBuffer)).toMatch(/ZIP/);
  });

  it("un vecchio .xls binario, con il consiglio giusto", async () => {
    const cfb = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    const detto = await motivo(cfb.buffer);
    expect(detto).toMatch(/\.xls\b/);
    expect(detto).toMatch(/salvalo come \.xlsx/);
  });

  it("un file protetto da password", async () => {
    const protetto = zip([
      { nome: "EncryptedPackage", contenuto: "…" },
      { nome: "xl/workbook.xml", contenuto: WORKBOOK },
    ]);
    expect(await motivo(protetto)).toMatch(/password/);
  });

  it("uno ZIP che non contiene una cartella di lavoro", async () => {
    expect(await motivo(zip([{ nome: "documento.txt", contenuto: "ciao" }]))).toMatch(/cartella di lavoro/);
  });

  it("una cartella senza fogli", async () => {
    const vuoto = zip([
      { nome: "xl/workbook.xml", contenuto: `<workbook><sheets/></workbook>` },
      { nome: "xl/_rels/workbook.xml.rels", contenuto: RELS },
    ]);
    expect(await motivo(vuoto)).toMatch(/nessun foglio/);
  });

  it("fogli tutti vuoti", async () => {
    const esito = await leggiXlsx(
      rendiconto({ foglio: `<worksheet><sheetData/></worksheet>` }),
    );
    expect(esito.ok).toBe(false);
    if (esito.ok) return;
    expect(esito.motivo).toMatch(/vuoti/);
  });
});
