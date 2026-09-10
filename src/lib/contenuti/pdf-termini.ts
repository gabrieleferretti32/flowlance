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
import { disegnaMarchio, leggiMarchio } from "./marchio-pdf";

/** Da dove viene il testo, e dove finisce il PDF. Le due estremità, qui. */
const SORGENTE = "contenuti/termini.md";
const CARTELLA = "public/termini";

export const MARGINE = 64;
/**
 * Quanto si tiene libero in fondo per il piede.
 *
 * È il margine inferiore vero del testo: il piede sta **sotto** l'area di
 * scrittura, e ci sta perché l'area finisce prima. Un numero più piccolo del
 * piede lo farebbe finire sopra l'ultima riga.
 */
const FASCIA_PIEDE = 34;
const NERO = "#14161c";
const TENUE = "#5b6070";
const RIGA = "#d9dce4";

/**
 * Chi emette il contratto, in testa alla prima pagina.
 *
 * Sono gli stessi dati del punto 1 dei Termini, e sono scritti due volte per
 * una ragione: là stanno dentro una frase di contratto, qui sono
 * un'intestazione. Un test verifica che partita IVA e indirizzo di questa
 * carta intestata compaiano nel testo del punto 1 — se il legale cambia sede,
 * la carta non resta indietro in silenzio.
 */
export const FORNITORE = {
  nome: "Gabriele Ferretti",
  forma: "ditta individuale",
  partitaIva: "02649540065",
  indirizzo: "Via Trinità 3/2 — 15068 Pozzolo Formigaro (AL)",
  email: "info@flowlance.it",
} as const;

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
    margins: { top: MARGINE, bottom: MARGINE + FASCIA_PIEDE, left: MARGINE, right: MARGINE },
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

  /*
    La carta intestata, sulla prima pagina.

    Questo documento il cliente se lo tiene, e nel caso peggiore finisce sul
    tavolo di un avvocato: deve dire chi lo emette senza che nessuno debba
    cercarlo dentro il punto 1. Il marchio è lo stesso file SVG dell'app —
    letto, non ricopiato — e i dati sono quelli della ditta.
  */
  const marchio = leggiMarchio(radice);
  const LATO_MARCHIO = 30;
  const inizio = doc.y;
  disegnaMarchio(doc, marchio, MARGINE, inizio, LATO_MARCHIO);

  doc
    .fillColor(NERO)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text("Flowlance", MARGINE + LATO_MARCHIO + 10, inizio + 7, { lineBreak: false });

  doc.y = inizio + LATO_MARCHIO + 12;
  doc.x = MARGINE;
  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor(TENUE)
    .text(
      `${FORNITORE.nome}, ${FORNITORE.forma} · P. IVA ${FORNITORE.partitaIva}`,
      MARGINE,
      doc.y,
      { lineGap: 1.5 },
    )
    .text(`${FORNITORE.indirizzo} · ${FORNITORE.email}`);

  // Il filetto che separa la carta intestata dal contratto.
  doc.moveDown(0.9);
  const filetto = doc.y;
  doc
    .save()
    .moveTo(MARGINE, filetto)
    .lineTo(doc.page.width - MARGINE, filetto)
    .lineWidth(0.75)
    .strokeColor(RIGA)
    .stroke()
    .restore();
  doc.y = filetto + 22;
  doc.x = MARGINE;

  doc.fillColor(NERO).fontSize(20).font("Helvetica-Bold").text(titolo, MARGINE, doc.y);
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

    doc.fontSize(10.5).fillColor(NERO);
    const pezziRiga = inGrassetto(blocco.testo);

    /*
      Il rientro appeso delle voci d'elenco si fa con la **colonna**, non con
      `indent`.

      `indent` sposta la prima riga di ogni chiamata `text`, e una voce fatta di
      più pezzi — «**la conservazione…** tramite la funzione…» — sono più
      chiamate incatenate: il rientro finiva sul pezzo sbagliato e le righe
      successive tornavano al margine, sotto il pallino invece che sotto il
      testo. Impostando `doc.x` alla colonna del testo e dando la larghezza
      ridotta, il ritorno a capo cade dove deve per costruzione.

      Il pallino si disegna prima, alla sua `y`, e la `y` si rimette com'era:
      scriverlo con `continued` lo legava al primo pezzo, e un pezzo in
      grassetto si portava dietro anche il pallino.
    */
    const colonna = blocco.tipo === "voce" ? MARGINE + 16 : MARGINE;
    if (blocco.tipo === "voce") {
      const y = doc.y;
      doc.font("Helvetica").text("•", MARGINE + 4, y, { lineBreak: false, width: 10 });
      doc.y = y;
    }

    doc.x = colonna;
    pezziRiga.forEach((p, i) => {
      scrivi(p.testo, {
        forte: p.forte,
        continued: i < pezziRiga.length - 1,
        ...(i === 0 ? { width: doc.page.width - MARGINE - colonna } : {}),
        align: "left",
        lineGap: 1.5,
      });
    });
    doc.x = MARGINE;
    doc.moveDown(blocco.tipo === "voce" ? 0.3 : 0.7);
  }

  /*
    Il piede su ogni pagina: senza, un foglio staccato dal fascicolo non dice
    più di quale versione fa parte — ed è proprio nel fascicolo che questo
    documento va a finire.

    ──────────────────────────────────────────────────────────────────────
    I margini si azzerano, e non è un vezzo
    ──────────────────────────────────────────────────────────────────────

    pdfkit, prima di scrivere una riga, controlla se la posizione supera
    `page.maxY()` — cioè l'altezza meno il margine inferiore — e in quel caso
    **aggiunge una pagina**. Il piede sta per definizione sotto quel limite,
    quindi la prima stesura di questo ciclo creava quattro pagine nuove e ci
    scriveva dentro i quattro piedi, in alto: il PDF usciva di **otto** pagine,
    quattro col contratto e senza piede, quattro vuote con solo il piede.

    E il controllo che avevo scritto non lo vedeva: cercava le stringhe
    «pagina N di M» nel testo estratto, le trovava tutte e quattro in fila, e
    concludeva che c'era un piede per pagina. Guardava la presenza del testo
    invece della **geometria** — che è il modo esatto in cui questa famiglia di
    difetti passa. La verifica adesso misura i rettangoli: `termini.test.ts`
    controlla, per ogni pagina, che il piede stia dentro quella pagina e nella
    sua fascia bassa.

    Azzerare i margini per il tempo del piede toglie il motivo del salto: non
    c'è più un limite da superare, e la riga si scrive dove le si dice.
  */
  const pagine = doc.bufferedPageRange();
  for (let i = 0; i < pagine.count; i += 1) {
    doc.switchToPage(pagine.start + i);
    const margini = doc.page.margins;
    doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
    doc
      .fontSize(8)
      .fillColor(TENUE)
      .font("Helvetica")
      .text(
        `Flowlance — ${titolo}, versione ${versione} del ${dataScritta}    ·    pagina ${i + 1} di ${pagine.count}`,
        MARGINE,
        doc.page.height - MARGINE + 6,
        { width: doc.page.width - MARGINE * 2, align: "center", lineBreak: false },
      );
    doc.page.margins = margini;
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
