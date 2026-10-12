# Il testo dell'approvazione specifica, da mandare per email

Il punto 3 dei Termini dice che il contratto si conclude alla consegna della
chiave, e il punto 13 che l'approvazione delle clausole ex artt. 1341-1342 c.c.
avviene «con la dichiarazione richiesta al punto 3, trasmessa dall'acquirente
dall'indirizzo email indicato in fase di acquisto».

**Quella dichiarazione finora esisteva solo come istruzione in prosa**, in
`strumenti/licenza/LEGGIMI.md`: «chiedi l'approvazione delle clausole del punto
13, elencate per numero». Riscritta a mano a ogni ordine, prima o poi elenca un
numero in meno — e una clausola non elencata è una clausola non approvata, cioè
inefficace. Da qui in avanti il testo sta scritto una volta sola, qui.

`termini.test.ts` verifica che le clausole elencate in questo file siano
esattamente quelle del punto 13: se il contratto ne guadagna una e questo testo
no, la griglia lo dice.

---

## Da incollare nell'email, dopo il pagamento

> Oggetto: **Flowlance — Termini da approvare prima della chiave**
>
> Buongiorno,
>
> grazie per l'acquisto. Prima di inviarle la chiave di attivazione le chiedo
> di rispondere **da questo stesso indirizzo** incollando le due dichiarazioni
> qui sotto, e i dati che mi mancano per la fattura.
>
> In allegato i Termini di servizio in PDF, versione 2 del 10 settembre 2026.
>
> ---
>
> **1 · Dichiarazione di acquisto professionale**
>
> «Dichiaro di acquistare nell'esercizio della mia attività imprenditoriale,
> commerciale, artigianale o professionale, e per finalità connesse a tale
> attività. Flowlance non è destinato ai consumatori.»
>
> **2 · Approvazione specifica delle clausole (artt. 1341-1342 c.c.)**
>
> «Ai sensi e per gli effetti degli artt. 1341 e 1342 del Codice civile,
> approvo specificamente le seguenti clausole dei Termini di servizio di
> Flowlance:
>
> - art. 3 — conclusione del contratto alla consegna della chiave; durata, non
>   trasferibilità e nominatività della licenza;
> - art. 4 — limitazione dell'applicazione alla sola lettura alla scadenza
>   della licenza;
> - art. 5 — esclusione di responsabilità del Fornitore per la conservazione,
>   il backup e il recupero dei dati dell'utente;
> - art. 6-bis, commi 3 e 4 — condizioni del prezzo garantito per i Fondatori:
>   **la garanzia vale solo se rinnovo prima della scadenza della licenza in
>   corso o entro 30 giorni dalla stessa**, e **se non rinnovo entro quel
>   termine la perdo definitivamente**, pagando il prezzo di listino a ogni
>   acquisto successivo;
> - art. 9 — limitazione di responsabilità e relativo massimale;
> - art. 11 — legge applicabile e foro competente;
> - art. 12 — facoltà del Fornitore di modificare i presenti termini.»
>
> ---
>
> **3 · I dati che Stripe non raccoglie**
>
> - codice destinatario SDI (o indirizzo PEC);
> - codice fiscale.
>
> Ragione sociale, indirizzo e partita IVA mi arrivano già dal pagamento.
>
> Appena ricevo la risposta le mando la chiave, di norma entro 24 ore
> lavorative.

---

## Perché il 6-bis è scritto per esteso e gli altri no

Gli altri articoli si approvano per numero: chi risponde ha il PDF allegato e
può leggerli. Il 6-bis no, e per una ragione precisa: è l'unica clausola
dell'elenco che l'acquirente può **perdere senza fare niente**. Le altre
limitano un diritto in casi che si vedono arrivare; questa si estingue da sola
il trentunesimo giorno dopo la scadenza, in silenzio, mentre l'acquirente pensa
di avere ancora tempo.

Un'approvazione che dicesse soltanto «art. 6-bis, commi 3 e 4» sarebbe
formalmente valida e sostanzialmente una firma al buio. I due pezzi che
contano — i trenta giorni e la perdita definitiva — stanno nel testo che si
incolla, in grassetto.
