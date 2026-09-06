# Flowlance

Il cruscotto economico, fiscale e finanziario del libero professionista italiano.
La domanda a cui risponde in tre secondi, appena si apre: **di questi soldi,
quanti sono davvero miei?**

Stato: **fasi 1-7 completate** — tutte le schermate del prodotto sono in piedi.
Resta la fase 8 di rifinitura.

## Comandi

```bash
npm run dev        # sviluppo su http://localhost:3000
npm test           # suite del motore fiscale
npm run typecheck  # TypeScript in modalità strict
npm run lint
npm run build      # export statico in out/
npx serve out      # serve la build statica
```

## Architettura

**Local-first, nessun server.** `output: "export"` produce un sito statico: non
esiste un runtime a cui i dati possano arrivare. I dati fiscali di una persona
vivono nel suo browser, con export e import JSON per backup e passaggio di
dispositivo. Il data layer sta dietro un'interfaccia `StorageAdapter` perché un
eventuale sync cloud sia un'aggiunta, non una riscrittura.

```
src/lib/fisco/          motore fiscale — modulo puro, niente React, niente Dexie
  aritmetica.ts         round2 e compagnia: perché Math.round non basta
  parametri/2026.ts     aliquote e soglie di legge, versionate per anno
  tipi.ts               modello dati e parametri
  documenti.ts          campi derivati di fatture e costi
  motore.ts             la catena di calcolo, dal reddito al saldo
  iva.ts                liquidazione mensile e trimestrale
  confronto.ts          simulatore forfettario contro ordinario
  fixture.ts            i due casi verificati a mano sull'Excel
src/lib/dati/           persistenza — tutto dietro l'interfaccia StorageAdapter
  adapter.ts            il contratto: depositi, lettura e scrittura complete
  db.ts                 schema IndexedDB e indici
  dexie-adapter.ts      implementazione su IndexedDB
  memoria-adapter.ts    implementazione in memoria, per i test
  backup.ts             export e import JSON, con convalida riga per riga
  demo.ts               un anno dimostrativo di 46.050 € di fatturato
  hooks.ts              lo strato reattivo su useLiveQuery
src/lib/format.ts       formattazione italiana: 1.234,56 €, mai €1,234.56
src/components/ui/      primitive ristilizzate sui token del progetto
src/components/fisco/   semaforo fiscale
  calendario.ts         festività italiane e slittamento delle scadenze
  scadenze.ts           lo scadenzario dell'anno, filtrato per regime
  spiegazioni.ts        il prospetto riga per riga, con la formula in italiano
src/lib/analisi/        aggregati, avvisi, cashflow e pianificazione, puri e testati
src/lib/periodo.ts      mese, trimestre, anno, personalizzato — puro e testato
src/lib/stato/          preferenze di interfaccia, persistite in localStorage
src/components/guscio/  navigazione, selettore di periodo, toggle di regime
src/components/tabella/ modifica in linea, ordinamento, barra di ricerca
src/app/design/         la pagina che mostra tutto il sistema visivo
src/components/grafici/ i due grafici del cruscotto
src/app/(app)/          le schermate di lavoro, dentro il guscio
```

### Il prospetto fiscale

Ogni riga porta la formula applicata ai numeri di questa persona, in italiano:
«5.850,00 € × 26,07 %, fino al massimale di 122.295,00 €». Non è una nota
d'aiuto generica — serve a fidarsi del totale, o ad accorgersi che
un'impostazione è sbagliata. Vive in `spiegazioni.ts`, fuori dalla schermata,
perché servirà anche all'esportazione da mandare al commercialista.

### Il cruscotto

Il semaforo fiscale scompone il denaro davvero entrato in cassa — compensi più
IVA incassata — in netto, imposte, contributi e IVA da girare all'erario.

Gli avvisi portano un'azione: «vedi le fatture scadute» apre il registro già
filtrato. Un avviso senza un'azione è solo un modo elegante di preoccupare
qualcuno.

I colori dei grafici sono due passi dello stesso indaco, verificati per
contrasto e per le tre forme di daltonismo. Nessun tooltip fluttuante: il
valore del mese sotto il cursore compare in testa alla card, dove l'occhio è
già, e le due serie si aggiornano insieme.

Le scadenze che cadono di sabato, di domenica o in un giorno festivo slittano
al primo giorno lavorativo successivo — festività mobili comprese, il lunedì
dell'Angelo si calcola. L'Excel lo diceva in nota senza applicarlo, e mostrava
date che nella realtà non esistono.

### I registri

Fatture e costi si filtrano sulla **data del documento**, non su quella di
incasso o pagamento: il registro è un elenco di documenti emessi. Il calcolo
delle imposte resta annuale e per cassa, perché scaglioni, massimali e soglie
sono grandezze dell'anno — filtrare il prospetto a «marzo» produrrebbe un
numero privo di significato.

Ogni cella modificabile salva subito e lascia per qualche secondo un toast con
l'annullamento: il valore precedente è tenuto in memoria, non riletto
dall'archivio. Le colonne che il regime non usa spariscono — l'IVA in
forfettario, deducibilità e quota deducibile fra i costi — perché una colonna
di zeri occupa spazio senza dire nulla.

### La persistenza

Due implementazioni di `StorageAdapter`: IndexedDB per l'app, memoria per i
test. La stessa suite gira su entrambe, così l'interfaccia resta un contratto
verificato e non una decorazione — se non bastasse a scrivere l'adapter in
memoria, non basterebbe nemmeno a scrivere un adapter cloud.

L'adapter delega direttamente a Dexie, quindi `useLiveQuery` continua a
osservare le tabelle anche quando la lettura passa dall'interfaccia: la React
layer resta reattiva senza conoscere il database.

Il file di backup porta un marcatore di formato e la versione dello schema. In
lettura è severo: una data nel formato sbagliato o un importo non numerico
fermano l'import e vengono elencati, invece di lasciare l'archivio a metà. I
campi calcolati che si trovassero nel file vengono scartati.

### Il motore fiscale

Funzioni pure da input a output: nessun `new Date()` nascosto, nessuna lettura
dal database. La data di riferimento è un parametro, così stessi ingressi
producono sempre lo stesso risultato.

Le aliquote non sono scritte nel codice: vivono in `lib/fisco/parametri/<anno>.ts`.
L'aggiornamento di gennaio è la modifica di un file solo.

**Perché esiste `aritmetica.ts`.** `Math.round(4324.9 * 0.15 * 100) / 100` in
JavaScript vale 648,73; il foglio di calcolo e l'Agenzia delle Entrate dicono
648,74. Il prodotto in virgola mobile è `648.73499999999989996`. Un centesimo
qui invalida l'intero prospetto, quindi ogni arrotondamento passa da `round2`.

### Scostamenti dichiarati rispetto all'Excel di partenza

Concordati prima di scrivere il codice, tutti verificati dai test:

1. **Contributi dedotti per cassa.** Se nell'anno esistono versamenti F24 di tipo
   `contributi` si deducono quelli; altrimenti si ricade sulla competenza, come
   faceva l'Excel. Il prospetto dichiara quale delle due strade sta usando.
2. **Soglia forfettaria sugli incassi.** La norma guarda i compensi percepiti,
   non il fatturato emesso. L'emesso non ancora incassato resta accanto come
   indicatore anticipato.
3. **Bollo legato all'esenzione IVA**, non al regime: copre anche l'ordinario che
   emette fuori campo IVA o in reverse charge.
4. **Contributo integrativo della cassa** implementato: il parametro esisteva nel
   Setup ma nessuna formula lo usava. A differenza della rivalsa INPS 4%, non
   concorre a formare il reddito.
5. **Maggiorazione IVA dell'1% non applicata al quarto trimestre**, che confluisce
   nella dichiarazione annuale. Nell'Excel era un errore.
6. **Percentuale di detraibilità IVA per singolo documento**: l'Excel forzava il
   100% in ordinario, sbagliato per auto, telefonia e ristoranti.
7. **Soglie di legge sugli acconti** (51,65 € e 257,52 €), dove l'Excel spalmava
   sempre 40/60 producendo rate che nessuno versa.

## Limite dichiarato

Strumento gestionale di pianificazione e controllo: produce stime, non
dichiarazioni fiscali. Non considera altri redditi che in regime ordinario
concorrono a formare il reddito complessivo e possono spostare lo scaglione
IRPEF. I numeri definitivi restano quelli del commercialista.

L'elenco completo di quello che il motore non calcola o semplifica sta in
[`APPROSSIMAZIONI.md`](APPROSSIMAZIONI.md), con la ragione di ogni scelta. In
fondo allo stesso file c'è la parte sull'interfaccia: quello che si sa essere
stretto sul piccolo e che si è deciso di lasciare così.

## Font

Inter e Plus Jakarta Sans arrivano da npm e sono serviti dal progetto: nessuna
CDN, perché un font caricato da rete significa numeri che non si incolonnano
proprio quando servono. Per attivare Satoshi vedi `public/fonts/LEGGIMI.md`.
