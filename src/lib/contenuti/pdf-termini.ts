/**
 * I Termini in PDF, generati dal Markdown a ogni build.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché esiste
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il punto 3 dei Termini dice che prima di consegnare la chiave il Fornitore
 * trasmette all'acquirente i Termini **in PDF, con l'indicazione della
 * versione**. Quel PDF finisce nel fascicolo dell'ordine, e ci resta per anni:
 * è il documento che dice cosa era stato pattuito, il giorno in cui qualcuno
 * lo chiede.
 *
 * Un PDF fatto a mano da un file di testo è la seconda copia dello stesso
 * contratto, e le seconde copie di questo progetto hanno già una storia: si
 * aggiorna una e non l'altra, e per mesi nessuno se ne accorge perché tutte e
 * due sono plausibili. Qui la copia la fa il build, dal file, ogni volta.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Byte identici a ogni esecuzione
 * ─────────────────────────────────────────────────────────────────────────
 *
 * L'impronta SHA-256 del PDF sta accanto al link, e serve a dimostrare che il
 * file scaricato oggi è quello allegato all'ordine di sei mesi fa. Un'impronta
 * che cambia a ogni build non dimostrerebbe niente — quindi il documento non
 * contiene **niente che venga dall'orologio**: la data di creazione è quella
 * del documento stesso, letta dalla sua riga di versione, e non `new Date()`.
 * Un test genera il PDF due volte e confronta i byte.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Un renderer severo, non uno tollerante
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il Markdown qui dentro è quello che il legale scrive: titoli, paragrafi,
 * grassetto, elenchi puntati. Il renderer conosce quelle quattro cose e
 * **fallisce** davanti a qualunque altra — una tabella, un link, una citazione.
 *
 * È la scelta opposta a quella comoda. Un renderer tollerante che salta ciò che
 * non capisce produrrebbe un contratto **con dentro un pezzo in meno**, senza
 * dirlo a nessuno: il caso peggiore che questo file possa produrre. Meglio un
 * build che si ferma e nomina la riga.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import PDFDocument from "pdfkit";

/** Da dove viene il testo, e dove finisce il PDF. Le due estremità, qui. */
const SORGENTE = "contenuti/termini.md";
const CARTELLA = "public/termini";

const MARGINE = 64;
const NERO = "#14161c";
const TENUE = "#5b6070";

/** L'indirizzo pubblico del PDF di una versione. Il nome porta la versione. */
export function indirizzoPdfTermini(versione: number): string {
  return `/termini/flowlance-termini-v${versione}.pdf`;
}

type Blocco =
  | { tipo: "titolo"; testo: string }
  | { tipo: "sezione"; testo: string }
  | { tipo: "paragrafo"; testo: string }
  | { tipo: "voce"; testo: string };

/**
 * Le righe del Markdown, una per una, senza indovinare.
 *
 * Ogni riga non vuota deve corrispondere a una forma conosciuta. Il messaggio
 * dell'errore porta il numero di riga e la riga stessa, perché chi lo legge
 * sta guardando un file scritto da un'altra persona.
 */
function leggiBlocchi(grezzo: string): Blocco[] {
  const blocchi: Blocco[] = [];
  const righe = grezzo.split("\n");

  for (const [indice, riga] of righe.entries()) {
    const t = riga.trim();
    if (t === "") continue;
    if (/^\*Versione\s+\d+\s*[—–-].+\*$/.test(t)) continue;
    if (/^\*Ultimo aggiornamento:.+\*$/.test(t)) continue;

    if (t.startsWith("# ")) blocchi.push({ tipo: "titolo", testo: t.slice(2).trim() });
    else if (t.startsWith("## ")) blocchi.push({ tipo: "sezione", testo: t.slice(3).trim() });
    else if (t.startsWith("- ")) blocchi.push({ tipo: "voce", testo: t.slice(2).trim() });
    else if (/^[#>|]|^\d+\.\s|^!\[|^```/.test(t)) {
      throw new Error(
        `${SORGENTE}, riga ${indice + 1}: «${t.slice(0, 60)}» è una forma che il PDF dei Termini non sa impaginare.\n`
          + "Il renderer conosce titolo, sezione, paragrafo ed elenco puntato, e si ferma sul resto\n"
          + "invece di saltarlo: un contratto con dentro un pezzo in meno è il caso peggiore.\n"
          + "Aggiungi la forma a src/lib/contenuti/pdf-termini.ts, oppure riscrivi la riga.",
      );
    } else blocchi.push({ tipo: "paragrafo", testo: t });
  }
  return blocchi;
}

/** I pezzi di una riga, alternando normale e grassetto sui `**`. */
function inGrassetto(testo: string): { testo: string; forte: boolean }[] {
  return testo
    .split("**")
    .map((pezzo, i) => ({ testo: pezzo, forte: i % 2 === 1 }))
    .filter((p) => p.testo !== "");
}

/**
 * La data del documento, come data del PDF.
 *
 * `10 settembre 2026` diventa mezzogiorno UTC di quel giorno. Mezzogiorno e
 * non mezzanotte: a mezzanotte un fuso orario a ovest sposta la data al giorno
 * prima, e la data stampata dentro il file smetterebbe di essere quella scritta
 * sopra. Non si legge l'orologio da nessuna parte.
 */
const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

function dataDelDocumento(scritta: string): Date {
  const m = scritta.trim().toLowerCase().match(/^(\d{1,2})\s+([a-zà-ù]+)\s+(\d{4})$/);
  const mese = m ? MESI.indexOf(m[2]) : -1;
  if (!m || mese < 0) {
    throw new Error(
      `${SORGENTE}: la data «${scritta}» non è nella forma «10 settembre 2026».\n`
        + "Il PDF ci mette dentro la propria data di creazione, e da lì dipende la sua impronta:\n"
        + "senza una data leggibile dovrebbe inventarne una, e l'impronta cambierebbe a ogni build.",
    );
  }
  return new Date(Date.UTC(Number(m[3]), mese, Number(m[1]), 12, 0, 0));
}

/**
 * L'impronta del PDF già pubblicato, senza rigenerarlo.
 *
 * La usa la pagina dei Termini, che gira **dopo** `next.config.ts`: il file
 * c'è già, e ricalcolarlo lì significherebbe due strade per lo stesso
 * documento. Se manca, si ferma invece di stampare l'impronta di un file
 * vuoto — un'impronta sbagliata accanto a un link è peggio di nessuna
 * impronta, perché sembra una prova.
 */
export function improntaPdfTermini(versione: number, radice = process.cwd()): string {
  const percorso = join(radice, CARTELLA, `flowlance-termini-v${versione}.pdf`);
  let byte: Buffer;
  try {
    byte = readFileSync(percorso);
  } catch {
    throw new Error(
      `Manca ${percorso}: il PDF dei Termini lo genera next.config.ts a ogni build.\n`
        + "Se stai leggendo questo errore fuori da un build, esegui «npm run build».",
    );
  }
  if (byte.length === 0) {
    throw new Error(`${percorso} è vuoto: l'impronta di un file vuoto sembrerebbe una prova.`);
  }
  return createHash("sha256").update(byte).digest("hex");
}

export type EsitoPdf = { percorso: string; indirizzo: string; impronta: string; byte: number };

/**
 * Genera il PDF e restituisce la sua impronta. Non riscrive un file identico.
 *
 * Il confronto prima della scrittura serve a `next dev`, che rilegge questo
 * modulo a ogni riavvio: riscrivere un file identico dentro `public/` farebbe
 * ripartire il watcher in un giro senza fine.
 */
export async function generaPdfTermini(radice = process.cwd()): Promise<EsitoPdf> {
  const grezzo = readFileSync(join(radice, SORGENTE), "utf8");

  const versioneScritta = grezzo.match(/^\*Versione\s+(\d+)\s*[—–-]\s*(.+?)\s*\*$/m);
  if (!versioneScritta) {
    throw new Error(
      `${SORGENTE}: manca la riga «*Versione N — data*» sotto il titolo.\n`
        + "Il nome del PDF, la data che ci sta dentro e il numero che la pagina mostra vengono\n"
        + "tutti da lì: è l'unico posto in cui la versione è scritta.",
    );
  }
  const versione = Number(versioneScritta[1]);
  const dataScritta = versioneScritta[2];
  const quando = dataDelDocumento(dataScritta);

  const blocchi = leggiBlocchi(grezzo);
  const titolo = blocchi.find((b) => b.tipo === "titolo")?.testo ?? "Termini di servizio";

  const doc = new PDFDocument({
    size: "A4",
    /*
      `bufferPages` tiene le pagine aperte fino alla fine, ed è la condizione
      perché `bufferedPageRange()` le veda tutte. Senza, il piede finiva solo
      sull'ultima e diceva «pagina 1 di 1» su un documento di tre — un numero
      plausibile e sbagliato su un foglio che va nel fascicolo di un ordine.
    */
    bufferPages: true,
    margins: { top: MARGINE, bottom: MARGINE + 24, left: MARGINE, right: MARGINE },
    info: {
      Title: `${titolo} — versione ${versione}`,
      Author: "Gabriele Ferretti",
      Subject: `Flowlance — ${titolo}, versione ${versione} del ${dataScritta}`,
      Creator: "Flowlance",
      Producer: "Flowlance",
      CreationDate: quando,
      ModDate: quando,
    },
  });

  const pezzi: Buffer[] = [];
  doc.on("data", (c: Buffer) => pezzi.push(c));
  const finito = new Promise<void>((ok) => doc.on("end", () => ok()));

  const scrivi = (testo: string, opzioni: PDFKit.Mixins.TextOptions & { forte?: boolean } = {}) => {
    const { forte, ...resto } = opzioni;
    doc.font(forte ? "Helvetica-Bold" : "Helvetica").text(testo, resto);
  };

  doc.fillColor(NERO).fontSize(20).font("Helvetica-Bold").text(titolo);
  doc
    .moveDown(0.35)
    .fontSize(10)
    .font("Helvetica")
    .fillColor(TENUE)
    .text(`Versione ${versione} — ${dataScritta}`);
  doc.moveDown(1.4).fillColor(NERO);

  for (const blocco of blocchi) {
    if (blocco.tipo === "titolo") continue;

    if (blocco.tipo === "sezione") {
      doc.moveDown(0.9).fontSize(12.5);
      scrivi(blocco.testo, { forte: true });
      doc.moveDown(0.45).fontSize(10.5);
      continue;
    }

    doc.fontSize(10.5);
    const pezziRiga = inGrassetto(blocco.testo);
    const rientro = blocco.tipo === "voce" ? 16 : 0;

    if (blocco.tipo === "voce") {
      doc.font("Helvetica").text("•", { continued: true, indent: 4 });
      doc.text("  ", { continued: true });
    }
    pezziRiga.forEach((p, i) => {
      scrivi(p.testo, {
        forte: p.forte,
        continued: i < pezziRiga.length - 1,
        indent: blocco.tipo === "voce" || i > 0 ? 0 : rientro,
        align: "left",
        lineGap: 1.5,
      });
    });
    doc.moveDown(blocco.tipo === "voce" ? 0.3 : 0.7);
  }

  /*
    Il piede su ogni pagina: senza, un foglio staccato dal fascicolo non dice
    più di quale versione fa parte — ed è proprio nel fascicolo che questo
    documento va a finire.
  */
  const pagine = doc.bufferedPageRange();
  for (let i = 0; i < pagine.count; i += 1) {
    doc.switchToPage(pagine.start + i);
    doc
      .fontSize(8)
      .fillColor(TENUE)
      .font("Helvetica")
      .text(
        `Flowlance — ${titolo}, versione ${versione} del ${dataScritta}    ·    pagina ${i + 1} di ${pagine.count}`,
        MARGINE,
        doc.page.height - MARGINE - 6,
        { width: doc.page.width - MARGINE * 2, align: "center", lineBreak: false },
      );
  }

  doc.end();
  /*
    `doc.end()` non finisce di scrivere: pdfkit impagina su uno stream, e i
    pezzi arrivano dopo. La prima stesura dava per scontato il contrario e
    scriveva un PDF di **zero byte** — con l'impronta di un file vuoto accanto
    al link, che è esattamente la forma di difetto che questo modulo esiste per
    non avere: un valore plausibile al posto di quello giusto. Da qui la scelta
    di rendere asincrona anche la configurazione di Next.
  */
  await finito;

  const byte = Buffer.concat(pezzi);
  const impronta = createHash("sha256").update(byte).digest("hex");

  const indirizzo = indirizzoPdfTermini(versione);
  const percorso = join(radice, CARTELLA, `flowlance-termini-v${versione}.pdf`);
  mkdirSync(dirname(percorso), { recursive: true });

  let identico = false;
  try {
    identico = readFileSync(percorso).equals(byte);
  } catch {
    identico = false;
  }
  if (!identico) writeFileSync(percorso, byte);

  return { percorso, indirizzo, impronta, byte: byte.length };
}
