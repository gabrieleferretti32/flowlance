/**
 * Il coefficiente di redditività in archivio coincide con il gruppo ATECO?
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il difetto
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Nelle impostazioni di ogni anno ci sono due campi: il gruppo ATECO scelto e
 * il coefficiente che ne discende. Normalmente li scrive insieme la stessa
 * riga di codice, e non possono divergere. **L'import di un backup era
 * l'eccezione**: quando il file non portava il coefficiente, l'import usava
 * quello del *primo gruppo dell'elenco* — i professionali, 78 % — qualunque
 * cosa la riga dichiarasse. Una riga «intermediari» entrava in archivio al
 * 78 % invece che al 62 %.
 *
 * Da lì in poi ogni imposta di quell'anno usciva su un imponibile più alto di
 * un quarto, senza che niente lo dicesse: 78 % è un coefficiente vero, solo di
 * un'altra attività.
 *
 * L'app corretta legge il coefficiente **dal gruppo**, quindi da oggi il conto
 * torna anche se il campo in archivio è rimasto sbagliato. Questo script serve
 * a sapere se lo è: un archivio con i due campi disallineati ha, in ogni
 * prospetto stampato prima della correzione, numeri diversi da quelli che
 * stamperebbe adesso.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Come si usa
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Apri Flowlance, apri la console del browser (⌥⌘I su Mac, F12 su Windows,
 * scheda «Console»), incolla tutto il contenuto di questo file e premi invio.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Cosa NON fa, e va saputo prima
 * ─────────────────────────────────────────────────────────────────────────
 *
 * — **Non tocca niente.** Legge e stampa. Nessuna migrazione automatica: un
 *   coefficiente diverso da quello del gruppo può essere stato messo apposta
 *   da chi sa cosa sta facendo, e riallinearlo d'ufficio rifarebbe lo stesso
 *   errore al contrario.
 * — **Non sa se l'anno viene da un import.** Le righe non portano la loro
 *   provenienza. L'elenco è per *sintomo*: due campi che non si parlano,
 *   qualunque sia il motivo.
 * — **La tabella dei gruppi è quella del 2026**, che vale anche per il 2025 e
 *   il 2027 perché quei due anni la ereditano. Il giorno in cui una legge la
 *   cambia per un anno solo, questo script va aggiornato — e lo dice, invece di
 *   confrontare con la tabella sbagliata: se il gruppo dichiarato non è fra
 *   questi nove, il risultato è «gruppo sconosciuto», non «tutto a posto».
 */
(async () => {
  /*
    Il database si chiama ancora col primo nome del progetto: lì il nome È la
    chiave dell'archivio, e cambiarlo perderebbe i dati di chi lo usa.
  */
  const NOMI_DB = ["freelance-finance-os", "freelance-flow", "flowlance"];

  /** I nove gruppi del forfettario, come stanno in `src/lib/fisco/parametri/2026.ts`. */
  const GRUPPI = {
    professionali: { coefficiente: 0.78, nome: "Attività professionali, scientifiche, tecniche…" },
    altre: { coefficiente: 0.67, nome: "Altre attività economiche" },
    costruzioni: { coefficiente: 0.86, nome: "Costruzioni e attività immobiliari" },
    intermediari: { coefficiente: 0.62, nome: "Intermediari del commercio" },
    commercio: { coefficiente: 0.4, nome: "Commercio all'ingrosso e al dettaglio" },
    ambulanteAlimentari: { coefficiente: 0.4, nome: "Commercio ambulante di alimentari" },
    ambulanteAltri: { coefficiente: 0.54, nome: "Commercio ambulante di altri prodotti" },
    alimentari: { coefficiente: 0.4, nome: "Industrie alimentari e delle bevande" },
    ristorazione: { coefficiente: 0.4, nome: "Servizi di alloggio e ristorazione" },
  };

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
  if (impostazioni.length === 0) {
    console.log("L'archivio non ha impostazioni: niente da confrontare.");
    return;
  }

  const percento = (v) =>
    `${(Number(v) * 100).toFixed(2).replace(/\.?0+$/, "").replace(".", ",")} %`;

  let disallineati = 0;
  let sconosciuti = 0;
  let controllati = 0;

  for (const imp of [...impostazioni].sort((a, b) => a.anno - b.anno)) {
    if (imp.regime !== "forfettario") {
      console.log(`${imp.anno} — ordinario: il coefficiente non entra in nessun conto. Saltato.`);
      continue;
    }
    controllati += 1;

    const gruppo = GRUPPI[imp.gruppoAteco];
    if (!gruppo) {
      sconosciuti += 1;
      console.warn(
        `${imp.anno} — gruppo «${imp.gruppoAteco}» sconosciuto a questo script. `
          + `In archivio c'è ${percento(imp.coefficienteRedditivita)}, ma non ho con cosa confrontarlo.`,
      );
      continue;
    }

    if (Math.abs(gruppo.coefficiente - imp.coefficienteRedditivita) < 1e-9) {
      console.log(
        `${imp.anno} — a posto: ${imp.gruppoAteco} → ${percento(gruppo.coefficiente)}, `
          + "gruppo e coefficiente coincidono.",
      );
      continue;
    }

    disallineati += 1;
    const scarto = imp.coefficienteRedditivita / gruppo.coefficiente - 1;
    console.error(
      `${imp.anno} — DISALLINEATO\n`
        + `   gruppo dichiarato: ${imp.gruppoAteco} (${gruppo.nome})\n`
        + `   coefficiente di quel gruppo: ${percento(gruppo.coefficiente)}\n`
        + `   coefficiente in archivio:    ${percento(imp.coefficienteRedditivita)}\n`
        + `   l'imponibile calcolato prima della correzione era ${scarto > 0 ? "più alto" : "più basso"} `
        + `del ${percento(Math.abs(scarto))} rispetto a quello che l'app calcola adesso.`,
    );
  }

  console.log("\n————————————————————————————————————————");
  if (controllati === 0) {
    console.log("Nessun anno in forfettario: il coefficiente non riguarda questo archivio.");
  } else if (disallineati === 0 && sconosciuti === 0) {
    console.log(`${controllati} anni in forfettario, tutti allineati. Niente da fare.`);
  } else {
    console.log(
      `${controllati} anni in forfettario: ${disallineati} disallineati, ${sconosciuti} con gruppo sconosciuto.`,
    );
    console.log(
      "Cosa fare: apri i Parametri dell'anno segnalato e riscegli l'attività dall'elenco.\n"
        + "Il coefficiente in archivio torna quello del gruppo. I calcoli che vedi adesso sono\n"
        + "già quelli giusti — l'app legge dal gruppo — ma un prospetto stampato prima della\n"
        + "correzione portava numeri diversi, e se è andato dal commercialista va rifatto.",
    );
  }
})();
