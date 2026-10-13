# Requisiti tecnici

*Ultimo aggiornamento: 13 ottobre 2026*

Questa pagina dice **che cosa serve per usare Flowlance**, ed è la pagina a cui
rimanda il punto 8 dei Termini di servizio. Per questo contiene soltanto cose
che abbiamo provato: ogni riga qui sotto è il risultato di una prova fatta sul
sito pubblicato, non una previsione.

Dove non abbiamo ancora provato, lo diciamo invece di immaginarlo. L'elenco
delle cose non ancora verificate è in fondo.

## Dove l'abbiamo provato

**Chromium 141** — il motore su cui sono costruiti Chrome ed Edge — su Linux.
Le prove sono fatte dal programma `strumenti/misura-requisiti.mjs`, che apre il
sito costruito e ripete i gesti veri: aprire l'applicazione, incollare una
chiave, caricare dei dati, esportarli, stampare il prospetto, staccare la rete.

## Che cosa funziona, e che cosa abbiamo misurato

| Che cosa | Risultato della prova |
| --- | --- |
| L'applicazione si apre | sì |
| Incollare la chiave di licenza l'attiva | sì, con la scadenza mostrata a schermo |
| I dati inseriti si salvano nel browser | sì, 169 righe scritte dall'applicazione |
| Chiudendo e riaprendo, i dati sono ancora lì | sì, tutte e 169 |
| L'esportazione dell'archivio scarica un file | sì, un file JSON di 56 KB |
| La stampa del prospetto compone il foglio | sì |
| Senza rete, l'applicazione **già aperta** continua a funzionare | sì |
| Senza rete, **ricaricando** la pagina l'applicazione si apre | **no** — vedi sotto |

## Serve una connessione per aprire l'applicazione

Flowlance non si installa sul computer: i suoi file arrivano dal sito ogni
volta che si apre o si ricarica la pagina. Abbiamo provato a staccare la rete,
e succedono due cose diverse:

- **la scheda già aperta continua a funzionare**: si naviga fra le schermate,
  si leggono e si scrivono i dati, perché tutto avviene nel browser;
- **ricaricando la pagina senza rete, l'applicazione non si apre.** Non è un
  guasto: i file dell'applicazione non ci sono ancora nel browser, e senza rete
  non può scaricarli.

Quindi: per **aprire** Flowlance serve una connessione; per **usarlo**, una
volta aperto, no. I dati non viaggiano in nessuno dei due casi.

## Che cosa serve

- **JavaScript attivo.** Flowlance è un programma che gira nel browser: senza
  JavaScript l'applicazione non si apre. Le pagine di testo del sito — Termini,
  privacy, questa — restano invece leggibili senza.
- **Spazio nel browser.** L'applicazione pesa **circa 2,8 MB** da scaricare la
  prima volta. L'archivio dei dati è molto più piccolo: con un anno intero di
  fatture, costi e movimenti di esempio occupa **circa 123 KB**.
- **Un computer, per lavorarci.** Dal telefono l'applicazione si apre e si
  legge bene (provato a 375 px, senza scorrimento laterale), ed è pensata così:
  **dal telefono si consulta**. Le operazioni che chiedono di vedere molte righe
  insieme — per esempio agganciare una nota di credito alle fatture su cui cade
  lo storno — esistono solo da 768 px in su, cioè da computer.

## Che cosa cancella i dati

I dati di Flowlance stanno **solo nel browser del dispositivo**: non ci sono
copie da nessun'altra parte, e nessuno può recuperarli. Queste cose li
cancellano, e le abbiamo provate:

- **cancellare i dati del sito dal browser** (le impostazioni di privacy, «dati
  dei siti web», «svuota la cache e i dati»): provato, l'archivio sparisce
  interamente;
- **la navigazione privata, o una sessione separata**: non vede l'archivio di
  prima, e quello che si scrive lì dentro se ne va con la finestra. Provato.

Si aggiungono le cose che valgono per qualunque dato su un dispositivo:
cambiare computer, formattarlo, perderlo.

**Per questo l'esportazione esiste, funziona sempre — anche a licenza scaduta —
e l'applicazione la ricorda periodicamente.** Un backup esportato è un file sul
computer: non dipende più dal browser.

## Safari: i dati di un sito non installato possono essere cancellati da soli

Questo vale **solo per Safari** — su Mac e su iPhone — e non dipende da
Flowlance. Lo abbiamo verificato leggendo il codice sorgente di WebKit, il
motore di Safari, perché è l'unico posto dove la regola è scritta per esteso.

Safari tiene il conto dei **giorni in cui il browser viene usato**. Se in quel
conto un sito non riceve nessuna interazione — nessun clic, nessuna digitazione
— i dati che il sito ha scritto nel browser vengono **cancellati**: non i
cookie, ma esattamente l'archivio in cui Flowlance tiene i tuoi dati. Le
finestre sono due:

- **30 giorni di uso del browser** è il caso normale;
- **7 giorni di uso del browser** se sei arrivato sul sito da un collegamento
  che portava con sé dei parametri di tracciamento (per esempio il clic su un
  annuncio).

«Giorni di uso del browser» non sono giorni di calendario: se Safari non si
apre, il conto non avanza. E ogni volta che apri Flowlance e ci clicchi dentro,
il conto riparte da zero: chi lo usa una volta al mese non perde niente. Il
rischio è di chi lo apre, inserisce dei dati e poi non lo riapre più per
settimane — su Safari, e senza aver esportato un backup.

**Installando Flowlance questa cancellazione non si applica.** Nel codice di
WebKit l'elenco dei siti esentati dalla cancellazione automatica contiene, con
queste parole, «le applicazioni web aggiunte alla schermata Home»: un sito
installato come applicazione non è più un sito che Safari tiene in conto fra i
tanti. Come si installa è spiegato in [installa Flowlance](/app/installa/).

Due avvertenze, perché questa pagina dice solo cose provate:

- quello che abbiamo letto è il **motore**. Non abbiamo potuto osservare la
  cancellazione accadere su un Mac o su un iPhone veri, né leggere la
  documentazione pubblica di WebKit (da dove lavoriamo è irraggiungibile);
- **degli altri browser non lo sappiamo.** Il loro codice non l'abbiamo letto:
  che Chrome, Edge o Firefox cancellino da soli i dati di un sito per non
  averlo visitato non ci risulta, ma «non ci risulta» non è una prova, e qui
  scriviamo solo prove. È nell'elenco qui sotto.

**La conseguenza pratica è una sola, e vale su tutti i browser: esporta il
backup.** Un file esportato non dipende da nessuna di queste regole.

## Quello che non abbiamo ancora verificato

Non lo scriviamo come se funzionasse. Queste prove sono in corso, e questa
pagina si aggiorna quando le avremo fatte:

- **Safari**, su Mac e su iPhone;
- **Firefox**;
- **Chrome ed Edge veri** (abbiamo provato il motore su cui sono costruiti, non
  i due programmi);
- **Windows**;
- **se gli altri browser cancellino i dati per inattività**, come fa Safari.
  Di Safari abbiamo letto il codice; degli altri no.

Nel frattempo vale la regola che vale sempre, e che non dipende dal browser:
**esporta il backup**. Se qualcosa non funziona, scrivi a info@flowlance.it e
ti rispondiamo noi.
