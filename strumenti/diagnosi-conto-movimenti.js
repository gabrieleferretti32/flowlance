/**
 * Che cosa c'è **scritto in archivio** dietro le righe del registro personale.
 *
 * Serve a una domanda sola, e nasce da un caso vero: trentasette movimenti
 * importati su «Intesa Sanpaolo» che nel registro mostrano un altro conto, che
 * il filtro per conto non trova, e che il Budget del loro mese conta come se
 * non ci fossero. Tre sintomi che possono venire da tre difetti diversi o da
 * uno solo, e a dirlo non è la schermata — che è la cosa che sta sbagliando —
 * ma il record com'è salvato.
 *
 * **Non tocca niente**: apre l'archivio in lettura e stampa. Nessuna scrittura,
 * nessuna cancellazione.
 *
 * Come si usa: apri l'app, apri la console del browser (⌥⌘I su Mac, F12 su
 * Windows, scheda «Console»), incolla tutto il contenuto di questo file e
 * premi invio. Quello che stampa si può copiare e incollare: sono id, date e
 * tipi, non importi di nessuno — tranne i tre record per esteso, che
 * contengono importo e descrizione di tre movimenti.
 *
 * Come si legge:
 *
 * - `PER TIPO` — se dice `giroconto`, i tre sintomi sono **uno solo**: un
 *   giroconto non ha categoria, il Budget lo esclude per definizione (spostare
 *   denaro non è né incassare né spendere) e il registro lo mostra come
 *   «conto d'origine → conto di destinazione», dove la destinazione manca.
 * - `PER MESE` — è l'anno e il mese **come li legge il Budget**, ricavati dal
 *   campo `data` con le stesse due fette di stringa. Se qui settembre non
 *   compare mentre nel registro le date sono di settembre, il difetto è nella
 *   forma della data.
 * - `contoEsiste` e `nomeDelConto` — se `contoEsiste` è `false`, il movimento
 *   punta a un conto che non c'è: il filtro non lo troverà mai e il registro
 *   mostra un trattino. Se è `true`, il conto salvato è quello che dice
 *   `nomeDelConto`, e il confronto con l'id del conto giusto in `CONTI` dice
 *   se la scelta dell'import si è persa per strada.
 * - `IMPORT` — quando è stato fatto ogni import, con quale file e su che
 *   conto: serve a capire se quei movimenti vengono dall'import di oggi o da
 *   uno precedente.
 */
(async () => {
  const db = await new Promise((ok, no) => {
    const r = indexedDB.open("freelance-finance-os");
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  const leggi = (t) => new Promise((ok) => {
    const q = db.transaction(t).objectStore(t).getAll(); q.onsuccess = () => ok(q.result);
  });
  const [conti, movimenti, categorie, imports] =
    await Promise.all(["pfConti", "pfMovimenti", "pfCategorie", "pfImport"].map(leggi));
  const idConti = new Set(conti.map((c) => c.id));
  const idCategorie = new Set(categorie.map((c) => c.id));
  const recenti = [...movimenti]
    .sort((a, b) => String(b.data).localeCompare(String(a.data))).slice(0, 3);
  const out = (t, v) => console.log(t, JSON.stringify(v, null, 1));
  out("CONTI:", conti.map((c) => ({ id: c.id, nome: c.nome })));
  out("IMPORT:", imports.map((i) => ({ quando: i.data, file: i.file, contoId: i.contoId, n: i.numeroMovimenti })));
  console.log("MOVIMENTI IN ARCHIVIO:", movimenti.length);
  out("PER TIPO:", movimenti.reduce((m, x) => ({ ...m, [x.tipo]: (m[x.tipo] ?? 0) + 1 }), {}));
  out("PER MESE (come lo legge il Budget):",
    movimenti.reduce((m, x) => {
      const k = `${String(x.data).slice(0, 4)}-${String(x.data).slice(5, 7)}`;
      return { ...m, [k]: (m[k] ?? 0) + 1 };
    }, {}));
  out("TRE RECORD GREZZI:", recenti.map((m) => ({
    record: m,
    tipoDelCampoData: typeof m.data,
    annoLetto: Number(String(m.data).slice(0, 4)),
    meseLetto: Number(String(m.data).slice(5, 7)),
    contoEsiste: idConti.has(m.contoId),
    nomeDelConto: (conti.find((c) => c.id === m.contoId) ?? {}).nome ?? "«nessun conto con questo id»",
    categoriaEsiste: idCategorie.has(m.categoriaId),
  })));
})();
