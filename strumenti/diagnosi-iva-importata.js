/**
 * Le righe che l'import da CSV può aver scritto con l'aliquota IVA sbagliata.
 *
 * Fino alla correzione, l'import proponeva alle righe **senza aliquota nel
 * file** l'aliquota ordinaria di legge — il 22 % dei parametri dell'anno —
 * invece di quella dichiarata nelle impostazioni. Il modulo delle fatture, il
 * modulo dei costi e il motore usano `aliquotaIva` delle impostazioni: solo
 * l'import guardava altrove. Chi fattura al 10 % o al 4 % si è visto scrivere
 * 22 su ogni riga importata che non portasse già la sua percentuale.
 *
 * La correzione vale da adesso in avanti. Le righe già in archivio restano
 * come sono, e **questo script non le tocca**: le elenca soltanto. Nessuna
 * migrazione automatica è possibile, perché un 22 % può essere giustissimo —
 * una fattura al 22 % dentro un'attività che di norma fattura al 10 % esiste,
 * e cambiarla d'ufficio sarebbe rifare lo stesso errore al contrario.
 *
 * Come si usa: apri l'app, apri la console del browser (⌥⌘I su Mac, scheda
 * «Console»), incolla tutto il contenuto di questo file e premi invio.
 *
 * Cosa stampa: anno, numero della fattura o descrizione del costo, imponibile
 * e le due aliquote a confronto. Serve per riconoscere le righe nel registro,
 * quindi qui i dati ci sono: è un elenco da guardare, non da incollare in una
 * segnalazione.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Quello che questo script NON può dirti, e va saputo prima di leggerlo:
 *
 * — **Non sa quali righe vengono da un CSV.** Le righe non portano la loro
 *   provenienza, e la tabella `importazioni` tiene solo l'ultimo import,
 *   perché è la rete per annullarlo e non un registro storico. Quindi
 *   l'elenco è per **sintomo**, non per origine: una riga scritta a mano al
 *   22 % ci finisce dentro esattamente come una importata.
 * — **Il sospetto è il 22 % esatto**, perché è quello che il codice sbagliato
 *   scriveva. Se in un anno l'aliquota dichiarata È il 22 %, in quell'anno il
 *   difetto non può aver prodotto niente di sbagliato: l'anno viene saltato e
 *   lo script lo dice.
 * — **In forfettario non si applica**: l'import proponeva zero, che è giusto.
 */
(async () => {
  /*
    Il database si chiama ancora col primo nome del progetto: lì il nome È la
    chiave dell'archivio, e cambiarlo perderebbe i dati di chi lo usa. Gli
    altri due sono per sicurezza, se un giorno cambiasse.
  */
  const NOMI_DB = ["freelance-finance-os", "freelance-flow", "flowlance"];

  const apri = (nome) =>
    new Promise((ok) => {
      const r = indexedDB.open(nome);
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok(null);
    });

  const tutto = (db, tabella) =>
    new Promise((ok) => {
      if (!db || !db.objectStoreNames.contains(tabella)) return ok([]);
      const r = db.transaction(tabella).objectStore(tabella).getAll();
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ok([]);
    });

  let db = null;
  for (const nome of NOMI_DB) {
    const tentativo = await apri(nome);
    if (tentativo && tentativo.objectStoreNames.contains("impostazioni")) {
      db = tentativo;
      console.log(`Archivio letto: «${nome}».`);
      break;
    }
  }
  if (!db) {
    console.log("Nessun archivio trovato. Lo script va incollato con l'app aperta.");
    return;
  }

  const impostazioni = await tutto(db, "impostazioni");
  const fatture = await tutto(db, "fatture");
  const note = await tutto(db, "note");
  const costi = await tutto(db, "costi");

  if (impostazioni.length === 0) {
    console.log("L'archivio non ha impostazioni: niente con cui confrontare.");
    return;
  }

  const percento = (v) => `${(Number(v) * 100).toFixed(2).replace(/\.?0+$/, "")} %`;
  const annoDi = (iso) => Number(String(iso ?? "").slice(0, 4));
  // L'aliquota che il codice sbagliato scriveva: l'ordinaria di legge.
  const SOSPETTA = 0.22;

  let totale = 0;

  for (const imp of [...impostazioni].sort((a, b) => a.anno - b.anno)) {
    const sua = imp.aliquotaIva;

    if (imp.regime === "forfettario") {
      console.log(`\n${imp.anno} — forfettario: l'import proponeva zero, che è giusto. Niente da guardare.`);
      continue;
    }
    if (sua === SOSPETTA) {
      console.log(
        `\n${imp.anno} — la tua aliquota dichiarata è ${percento(sua)}, cioè la stessa che l'import ` +
          `proponeva. In questo anno il difetto non può aver scritto niente di sbagliato.`,
      );
      continue;
    }

    const sospette = [
      ...fatture
        .filter((f) => annoDi(f.dataEmissione) === imp.anno && f.aliquotaIva === SOSPETTA)
        .map((f) => ({ tipo: "fattura", riferimento: f.numero, data: f.dataEmissione, imponibile: f.imponibile, aliquota: f.aliquotaIva })),
      ...note
        .filter((n) => annoDi(n.dataDocumento) === imp.anno && n.aliquotaIva === SOSPETTA)
        .map((n) => ({ tipo: "nota", riferimento: n.numero, data: n.dataDocumento, imponibile: n.imponibile, aliquota: n.aliquotaIva })),
      ...costi
        .filter((c) => annoDi(c.dataDocumento) === imp.anno && c.aliquotaIva === SOSPETTA)
        .map((c) => ({ tipo: "costo", riferimento: c.descrizione, data: c.dataDocumento, imponibile: c.imponibile, aliquota: c.aliquotaIva })),
    ].sort((a, b) => String(a.data).localeCompare(String(b.data)));

    console.log(
      `\n${imp.anno} — aliquota dichiarata ${percento(sua)}. ` +
        `Righe al ${percento(SOSPETTA)}: ${sospette.length}.`,
    );
    if (sospette.length > 0) {
      console.table(
        sospette.map((r) => ({
          tipo: r.tipo,
          riferimento: r.riferimento,
          data: String(r.data).slice(0, 10),
          imponibile: r.imponibile,
          "aliquota sulla riga": percento(r.aliquota),
          "aliquota dichiarata": percento(sua),
          "IVA se corretta": Math.round(r.imponibile * sua * 100) / 100,
          "IVA come sta": Math.round(r.imponibile * r.aliquota * 100) / 100,
        })),
      );
      totale += sospette.length;
    }
  }

  console.log(
    `\n${totale} righe da guardare in tutto.\n` +
      "Non sono righe sbagliate: sono righe la cui aliquota non è quella che dichiari di solito.\n" +
      "Si correggono a mano dal registro, una per una, sulla fattura vera — e quelle che al 22 %\n" +
      "ci stavano per davvero si lasciano dove sono.",
  );
})();
