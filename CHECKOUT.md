# Cosa il checkout dovrà fare

Il checkout non esiste ancora: i pulsanti «Acquista» raccolgono un indirizzo
email e nient'altro. Questo file tiene quello che i **Termini di servizio già
pubblicati** promettono e che il prodotto, nel momento in cui si incasserà il
primo euro, dovrà fare davvero.

Non è un elenco di buone idee. Ogni voce nasce da una clausola scritta, e la
clausola è citata accanto: un testo pubblicato che promette una cosa che il
checkout non fa è una promessa non mantenuta, non una cosa da vedere poi.

Da rileggere **prima** di scrivere il checkout, e a ogni revisione dei Termini.

---

## 1 · Chiedere in quale qualità si acquista

> «In fase di acquisto è richiesto all'acquirente di dichiarare in quale delle
> due qualità agisce.» — Termini, punto 1, *Definizioni*

I Termini distinguono **Consumatore** e **Professionista**, e dicono
espressamente che la partita IVA non basta a stabilire quale dei due sia:
conta lo scopo dell'acquisto. La distinzione non è decorativa — decide se
spetta il diritto di recesso (punto 7) e quale foro è competente (punto 11) —
quindi la domanda va posta per davvero, e la risposta va conservata con
l'ordine.

Due scelte esplicite, non un valore dedotto: se il checkout indovinasse la
qualifica dalla presenza di una partita IVA, direbbe a schermo una cosa e nei
Termini un'altra.

## 2 · La casella dell'attivazione immediata, separata

La chiave di licenza si consegna subito. Per un Consumatore l'esecuzione
immediata di un contenuto digitale entro i 14 giorni di recesso va richiesta
espressamente e riconosciuta come tale: una casella **sua**, non pre-spuntata,
distinta da quella di accettazione dei Termini e da quella della privacy.

Tre caselle diverse per tre consensi diversi. Una casella sola che ne copre
tre non ne raccoglie nessuno.

## 3 · L'approvazione specifica delle clausole ex art. 1341 c.c.

Le clausole vessatorie nei contratti per adesione richiedono una seconda
sottoscrizione specifica, che le elenchi per numero. Nei Termini attuali
riguarda almeno la limitazione di responsabilità (punto 9) e il foro (punto
11).

Va progettata come un secondo momento di approvazione, con l'elenco dei punti
davanti a chi approva — non una riga in fondo alla stessa casella dei Termini.

## 4 · La conferma d'ordine su supporto durevole

Dopo l'acquisto, all'acquirente va inviata la conferma dell'ordine con le
condizioni contrattuali in una forma che possa conservare e rileggere: una
email che contenga i Termini nella versione accettata, o un PDF allegato. Un
link a una pagina che nel frattempo può cambiare non è supporto durevole — e
il punto 12 dice proprio che per le licenze in corso valgono i termini
accettati all'acquisto, il che presuppone che quella versione resti leggibile.

Conseguenza per `contenuti/termini.md`: al primo incasso, le versioni vanno
tenute. Oggi il file ha una sola versione e la storia sta in git; quando gli
ordini esisteranno servirà poter dire *quale* testo una persona ha accettato.

---

## Quello che invece è già mantenuto

Perché non venga rifatto per sbaglio, e perché la prossima revisione dei
Termini sappia cosa esiste:

- **Sola lettura alla scadenza, dati e stampa sempre accessibili** (punto 4):
  fatto, `src/lib/dati/sola-lettura.ts`.
- **L'elenco pubblico delle semplificazioni** (punto 2): è
  [`APPROSSIMAZIONI.md`](APPROSSIMAZIONI.md), pubblicato su `/cosa-non-calcola`.
- **Il promemoria periodico del backup** (punto 5): fatto,
  `src/lib/dati/promemoria-backup.ts`.
- **I parametri fiscali aggiornati per gli anni coperti** (punto 8):
  `src/lib/fisco/parametri/`, un file per anno.
