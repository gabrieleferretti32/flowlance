# Il checkout: com'è deciso, e cosa resta da fare

*Aggiornato il 10 settembre 2026, con la versione 2 dei Termini.*

Il legale ha risposto, e la risposta ha chiuso metà di questo documento.
**Flowlance è offerto ai soli professionisti** (Termini, punto 1), il contratto
si conclude **alla consegna della chiave** e non al pagamento (punto 3), il
recesso del Codice del consumo non si applica e resta la sola garanzia
contrattuale di rimborso a 30 giorni (punto 7), e le clausole ex artt. 1341 e
1342 sono elencate per numero al punto 13.

Da lì discende un flusso preciso, che è quello descritto qui sotto. Le tre
strade che questo file confrontava — Brevo, identificativo generato dalla
pagina, funzione serverless — **non servono nessuna delle tre**, e la ragione
non è tecnica: se il contratto si conclude alla consegna della chiave, non c'è
più niente da registrare *durante* il pagamento.

---

## Il flusso, in quattro passi

| | Dove accade | Cosa resta come prova |
|---|---|---|
| 1 · Lettura e dichiarazione | `/acquista` sul sito | niente, ed è voluto — vedi sotto |
| 2 · Pagamento | Payment Link di Stripe | ricevuta e dati di fatturazione, in Stripe |
| 3 · Termini in PDF + richiesta di approvazione | email, a mano | il PDF con la sua impronta, nel fascicolo |
| 4 · Risposta dell'acquirente, poi la chiave | email, a mano | l'email di risposta, e la riga in `emesse.jsonl` |

La pagina `/acquista` esiste ed è `src/app/(sito)/acquista/`. Mostra il testo
integrale dei Termini, il PDF con la sua impronta SHA-256, e la dichiarazione di
acquisto professionale come **casella obbligatoria**: senza spunta il
collegamento al pagamento non ha un indirizzo, quindi non è raggiungibile
neanche da tastiera.

Il Payment Link non esiste ancora: `PAYMENT_LINK` in `src/lib/sito/acquisto.ts`
vale `"DA-CREARE"`, e finché è così la pagina lo **dichiara** invece di mostrare
un pulsante muto. Stessa forma del segnaposto della chiave pubblica, stessa
ragione: una pagina che manda su un indirizzo inventato prende i soldi di
nessuno e li perde in silenzio.

---

## Niente OTP, niente funzione serverless

Erano le due cose che questo documento considerava probabili, e la versione 2
dei Termini le ha rese inutili tutte e due.

**Niente OTP.** Serviva a legare una dichiarazione raccolta sul sito a una
persona verificabile. Ma la dichiarazione che conta — l'approvazione specifica
del punto 13 — non si raccoglie più sul sito: arriva per email, **dallo stesso
indirizzo indicato in fase di acquisto**, e lo dice il punto 13 stesso. Un'email
che arriva da quell'indirizzo è già la prova che un OTP avrebbe dovuto
costruire, e non ha bisogno di infrastruttura.

**Niente funzione serverless.** Serviva a registrare l'accettazione con orario,
IP e versione del testo. Ma il contratto si conclude alla consegna della chiave,
e a quel punto la prova è già tutta in mano: la ricevuta di Stripe, il PDF dei
Termini con la sua impronta, l'email di risposta dell'acquirente. Il sito resta
`output: "export"` — solo file statici, nessun segreto nel bundle, nessun
servizio che possa andare giù e impedire un acquisto.

**Niente `client_reference_id`.** Non serve legare una riga propria al
pagamento, perché non c'è nessuna riga propria: l'unica cosa che il sito
raccoglie è una spunta che non conserva. Resta scritto qui sotto solo perché
qualcuno, un giorno, avrà la tentazione di usarlo.

> **La trappola, se un domani servisse.** `client_reference_id` si passa a un
> Payment Link come parametro dell'indirizzo: alfanumerico, trattini e
> underscore, fino a 200 caratteri
> ([documentazione Stripe](https://docs.stripe.com/payment-links/url-parameters)).
> **Un valore non valido viene scartato in silenzio, e la pagina di pagamento
> continua a funzionare.** Un incasso senza riferimento, e nessun errore da
> nessuna parte: la stessa famiglia di difetti che questo progetto insegue da
> settimane. Se mai si userà, il riferimento va **verificato dopo**, mai dato
> per riuscito.

---

## Perché la spunta sul sito non è una prova, e va bene così

Su un sito statico una casella spuntata non lascia traccia da nessuna parte:
non c'è un server che la registri. Una dichiarazione che nessuno conserva non è
una prova — è un'animazione.

Quindi la casella di `/acquista` è una cosa sola, e la pagina lo dice: **un
filtro all'ingresso**, che mette davanti agli occhi il punto 1 prima che
qualcuno paghi, e un promemoria di cosa arriverà per email. La prova la fa
l'email, che resta nel fascicolo dell'ordine.

Fingere sulla pagina un'approvazione che non si può conservare sarebbe peggio
che non chiederla, perché farebbe credere di averla.

---

## Cosa resta da fare, in ordine

1. **Creare il Payment Link su Stripe** — 97 € + IVA 22 %, prodotto «Flowlance
   — licenza 12 mesi», raccolta dei dati di fatturazione attiva. Incollarlo in
   `PAYMENT_LINK`, che è l'unico posto in cui va.
2. **Attivare la notifica email di Stripe a ogni pagamento riuscito**: è
   l'unico segnale che l'acquisto è avvenuto, e senza non parte niente.
3. **Preparare le due email**, quella dei Termini e quella della chiave. La
   sequenza dei passi sta in `strumenti/licenza/LEGGIMI.md`, sotto «L'ordine dei
   passi, per un acquisto vero».
4. **Decidere cosa fare della fatturazione elettronica.** Stripe raccoglie
   partita IVA e indirizzo, **non** il codice destinatario e non la PEC. Per una
   fattura elettronica verso un titolare di partita IVA italiano serve uno dei
   due. Le opzioni:
   - chiederli nella stessa email in cui si chiede l'approvazione delle clausole
     (nessun codice da scrivere, un giro in più per l'acquirente — ma il giro
     c'è già);
   - trasmettere al codice convenzionale `0000000`, che lo SdI accetta e recapita
     nel cassetto fiscale del destinatario. È legittimo e va detto in fattura;
   - aggiungere un campo personalizzato al Payment Link. Stripe ne ammette tre e
     nessuno è obbligatorio in modo condizionale: chi non ha una PEC scriverebbe
     qualcosa lo stesso.

   **La prima è la scelta suggerita**, perché l'email c'è comunque e perché un
   campo compilato male in un checkout non si corregge più.

---

## Le righe non dicono da dove vengono

Non è un obbligo dei Termini: è una **mancanza del modello** che si è vista
quando è servita, e che qui sta perché la prossima volta si vedrà di nuovo.

Fatture, costi e note non portano la loro provenienza. Chi le ha scritte — la
mano, un file CSV, un backup importato — non è ricostruibile: la tabella
`importazioni` esiste ma tiene **solo l'ultimo import**, perché è la rete per
annullarlo e non un registro storico, e al secondo import il primo sparisce.

Si è vista due volte, e tutte e due le volte è costata una diagnosi
approssimata:

- `strumenti/diagnosi-iva-importata.js` cerca le righe **per sintomo** — quelle
  al 22 % dove l'utente dichiara un'altra aliquota — invece che per origine, e
  quindi elenca anche righe scritte a mano che al 22 % ci stavano benissimo;
- `strumenti/diagnosi-coefficiente.js` fa lo stesso col coefficiente ATECO: dice
  che gruppo e coefficiente non si parlano, non che quell'anno è arrivato da un
  import.

Un campo `origine` sulle righe le renderebbe esatte tutte e due, e renderebbe
esatta ogni diagnosi futura della stessa forma. Non si aggiunge adesso — cambia
lo schema, e va deciso insieme a cosa farne nell'interfaccia — ma quando si
toccherà lo schema per un'altra ragione, questa è la cosa da infilarci dentro.

---

## Quello che i Termini promettono, ed è già mantenuto

Perché non venga rifatto per sbaglio, e perché la prossima revisione sappia cosa
esiste:

- **Offerta ai soli professionisti, con dichiarazione in fase di acquisto**
  (punto 1): fatto, `src/app/(sito)/acquista/`.
- **Termini in PDF con l'indicazione della versione, trasmessi prima della
  chiave** (punto 3): il PDF lo genera ogni build da `contenuti/termini.md`
  (`src/lib/contenuti/pdf-termini.ts`), con l'impronta SHA-256 stampata accanto
  al link su `/termini` e su `/acquista`.
- **Sola lettura alla scadenza, dati e stampa sempre accessibili** (punto 4):
  fatto, `src/lib/dati/sola-lettura.ts`.
- **L'elenco pubblico delle semplificazioni** (punto 2): è
  [`APPROSSIMAZIONI.md`](APPROSSIMAZIONI.md), pubblicato su `/cosa-non-calcola`.
- **Il promemoria periodico del backup** (punto 5): fatto,
  `src/lib/dati/promemoria-backup.ts`.
- **I parametri fiscali aggiornati per gli anni coperti** (punto 8):
  `src/lib/fisco/parametri/`, un file per anno.
- **La versione vale per le licenze in corso** (punto 12): i PDF portano la
  versione nel nome (`flowlance-termini-v2.pdf`) e non si sovrascrivono. Il
  fascicolo di un ordine vecchio continua a puntare al testo che lo governava.
