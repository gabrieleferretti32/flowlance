/**
 * Quali fatture l'app sta trattando come «senza IVA», e cosa cambia sul totale.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il sintomo
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Una fattura da 2.500 € che nel registro compare come **2.502,00 €**: non
 * 3.050 (2.500 più IVA al 22 %) e nemmeno il netto dopo uno storno. Quel 2,00
 * è la marca da bollo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il meccanismo, misurato sul codice
 * ─────────────────────────────────────────────────────────────────────────
 *
 * In `src/lib/fisco/documenti.ts` l'IVA e il bollo escono dalla **stessa**
 * variabile:
 *
 *     const aliquotaIvaApplicata = forfettario ? 0 : (fattura.aliquotaIva ?? imp.aliquotaIva);
 *     const iva   = round2(imponibile * aliquotaIvaApplicata);
 *     const bollo = aliquotaIvaApplicata === 0 && imponibile > sogliaBollo ? importoBollo : 0;
 *
 * Quindi i due sintomi — l'IVA che sparisce e i 2 € che compaiono — non sono
 * due difetti: sono **un fatto solo**, l'aliquota applicata che vale zero. Il
 * calcolo fa esattamente quello che gli si chiede; la domanda è perché su
 * quella fattura gli si stia chiedendo zero.
 *
 * Il codice ha tre modi di arrivarci, e solo uno si vede da fuori:
 * il regime dell'anno è forfettario; la fattura porta scritto `aliquotaIva: 0`;
 * la fattura non porta nessuna aliquota e quella dell'anno è 0. La
 * riconciliazione di una nota di credito **non** è fra questi: `riconcilia()`
 * scrive solo sulla nota e non tocca mai la fattura. Se il totale era sbagliato,
 * lo era da prima, e riconciliando è solo stato guardato.
 *
 * Questo script dice quale dei tre, fattura per fattura. Il resto sarebbe
 * indovinare.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Come si usa
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Apri Flowlance, apri la console del browser (⌥⌘I su Mac, F12 su Windows,
 * scheda «Console»), incolla tutto il contenuto di questo file e premi invio.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Cosa NON fa
 * ─────────────────────────────────────────────────────────────────────────
 *
 * — **Non tocca niente.** Legge e stampa.
 * — **Non dice che quelle fatture sono sbagliate.** Un'aliquota a zero è
 *   legittima: esente art. 10, non imponibile, fuori campo. E su quelle il
 *   bollo da 2 € ci va davvero. Sbagliata è la fattura che *non* è di quel
 *   tipo, e questo lo sa solo chi l'ha emessa: qui c'è l'elenco da guardare.
 * — **Non distingue il reverse charge.** Non può: una fattura, in archivio,
 *   porta un numero per l'aliquota e nient'altro. Non c'è un campo «natura»
 *   come ce l'hanno i costi, quindi l'app non sa *perché* l'IVA è zero — e sul
 *   reverse charge il bollo non andrebbe messo. È un limite del modello, non di
 *   questo script.
 */
(async () => {
  /*
    Il database si chiama ancora col primo nome del progetto: lì il nome È la
    chiave dell'archivio, e cambiarlo perderebbe i dati di chi lo usa.
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
    if (tentativo && tentativo.objectStoreNames.contains("fatture")) {
      db = tentativo;
      console.log(`Archivio letto: «${nome}».`);
      break;
    }
  }
  if (!db) {
    console.log("Nessun archivio trovato. Lo script va incollato con l'app aperta.");
    return;
  }

  const fatture = await tutto(db, "fatture");
  const impostazioni = await tutto(db, "impostazioni");
  if (fatture.length === 0) {
    console.log("Nessuna fattura in archivio.");
    return;
  }

  const perAnno = new Map(impostazioni.map((i) => [i.anno, i]));
  const euro = (v) => `${Number(v).toFixed(2).replace(".", ",")} €`;
  const percento = (v) => `${(Number(v) * 100).toFixed(2).replace(/,?0+$/, "")} %`.replace(".", ",");

  const righe = [];
  const senzaAnno = new Set();

  for (const f of fatture) {
    const anno = Number(String(f.dataEmissione).slice(0, 4));
    const imp = perAnno.get(anno);
    if (!imp) {
      senzaAnno.add(anno);
      continue;
    }
    const forfettario = imp.regime === "forfettario";
    const applicata = forfettario ? 0 : (f.aliquotaIva ?? imp.aliquotaIva);
    if (applicata !== 0) continue;

    const sogliaBollo = imp.sogliaBollo ?? 77.47;
    const importoBollo = imp.importoBollo ?? 2;
    const bollo = applicata === 0 && f.imponibile > sogliaBollo ? importoBollo : 0;
    const mostrato = Math.round((f.imponibile + (imp.bolloAddebitato ? bollo : 0)) * 100) / 100;
    const conAliquotaAnno =
      Math.round(f.imponibile * (1 + (imp.aliquotaIva ?? 0)) * 100) / 100;

    righe.push({
      anno,
      numero: f.numero,
      data: f.dataEmissione,
      imponibile: f.imponibile,
      perche: forfettario
        ? "il regime dell'anno è forfettario"
        : f.aliquotaIva === 0
          ? "la fattura porta scritto «aliquota 0»"
          : f.aliquotaIva === undefined || f.aliquotaIva === null
            ? `la fattura non porta un'aliquota, e quella dell'anno è ${percento(imp.aliquotaIva ?? 0)}`
            : `aliquota ${percento(f.aliquotaIva)} — e questo script non se lo aspettava`,
      bollo,
      mostrato,
      conAliquotaAnno,
    });
  }

  if (senzaAnno.size > 0) {
    console.warn(
      `Saltate le fatture degli anni ${[...senzaAnno].sort().join(", ")}: `
        + "in archivio non ci sono impostazioni per quegli anni, quindi non so con quale regime leggerle.",
    );
  }

  if (righe.length === 0) {
    console.log(
      `Nessuna fattura senza IVA: tutte e ${fatture.length} portano un'aliquota diversa da zero.`,
    );
    return;
  }

  console.log(
    `\n${righe.length} fatture su ${fatture.length} sono trattate come senza IVA.`
      + "\nIl bollo è la conseguenza, non la causa: guarda la colonna «perché».\n",
  );
  console.table(
    righe
      .sort((a, b) => (a.data < b.data ? -1 : 1))
      .map((r) => ({
        Anno: r.anno,
        Numero: r.numero,
        Data: r.data,
        Imponibile: euro(r.imponibile),
        Perché: r.perche,
        Bollo: r.bollo ? euro(r.bollo) : "—",
        "Totale mostrato": euro(r.mostrato),
        "Se avesse l'aliquota dell'anno": euro(r.conAliquotaAnno),
      })),
  );
  console.log(
    "Quelle davvero esenti, non imponibili o fuori campo vanno bene così, bollo compreso.\n"
      + "Per le altre: apri la fattura e rimetti l'aliquota. Il totale, l'IVA del mese e la\n"
      + "liquidazione si rifanno da soli — in archivio non c'è nessun numero calcolato.",
  );
})();
