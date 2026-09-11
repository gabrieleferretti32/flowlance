<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Convenzioni di questo repository

Il progetto si chiama **Flowlance**. Si è chiamato "Freelance Finance OS" e poi
"Freelance Flow": i nomi vecchi sopravvivono solo nel nome del database
IndexedDB — dove il nome È la chiave dell'archivio — e nell'elenco dei marcatori
di backup accettati in lettura. Cambiarli perderebbe dati.

- **Messaggi di commit**: in italiano, prima riga all'imperativo. Chiudere con
  `Co-Authored-By` quando il commit è scritto da un agente; **non** aggiungere
  il trailer `Claude-Session` (i commit già in cronologia restano com'erano).
- **Numeri**: mai `Math.round` sugli importi, sempre `round2` da
  `src/lib/fisco/aritmetica.ts` — arrotonda come il foglio di calcolo.
- **Formattazione**: ogni cifra o data passa dai formatter di `src/lib/format.ts`,
  mai `toLocaleString` diretto (il raggruppamento cambia fra Node e browser e
  fa fallire l'idratazione).
- **Sostituzioni di testo**: verificare che il testo da sostituire ci sia
  **prima** di sostituirlo, e fermarsi se non c'è. `str.replace`, `sed` e simili
  quando non trovano niente restituiscono la stringa identica e non lo dicono:
  non è un errore che si ignora, è un successo che si riceve. Il file riscritto
  uguale si scopre più tardi, guardando lo schermo, e intanto si è già andati
  avanti a costruirci sopra. È la stessa famiglia di difetti che questo
  repository insegue nel prodotto — una misura che conferma invece di una che
  rompe — applicata al modo di modificarlo.
