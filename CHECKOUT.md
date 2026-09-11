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
| 3 · Termini in PDF, richiesta di approvazione **e dei dati di fatturazione** | email, a mano | il PDF con la sua impronta, nel fascicolo |
| 4 · Risposta dell'acquirente, poi la chiave | email, a mano | l'email di risposta, e la riga in `emesse.jsonl` |

La pagina `/acquista` esiste ed è `src/app/(sito)/acquista/`. Mostra il testo
integrale dei Termini, il PDF con la sua impronta SHA-256, e la dichiarazione di
acquisto professionale come **casella obbligatoria**: senza spunta il
collegamento al pagamento non ha un indirizzo, quindi non è raggiungibile
neanche da tastiera.

Il Payment Link **c'è**, dal 10 settembre 2026: sta in `PAYMENT_LINK`, dentro
`src/lib/sito/impostazioni.ts`. Il riquadro del segnaposto è sparito e il
pulsante «Paga 118,34 € con Stripe» ha preso il suo posto, con la riga sull'IVA
attaccata sotto.


---

## Il numero di Meta non è il numero di Stripe, e non deve esserlo

Dall'11 settembre 2026 la pagina `/grazie` manda a Meta un evento `Purchase`.
Stripe rimanda su `/grazie/?sessione={CHECKOUT_SESSION_ID}`, e l'evento parte
solo con quel parametro, una volta sola per browser, con l'impronta
dell'identificativo come `eventID` perché Meta scarti i doppioni.

**Quel numero è più basso di quello vero, sempre.** `Purchase` scatta soltanto
per chi ha accettato la profilazione pubblicitaria — una categoria di consenso a
sé, dove rifiutare costa quanto accettare — e non scatta per chi usa un blocco
degli annunci o chiude la scheda prima che `/grazie` carichi. Nell'altro verso
resta poco: un acquisto rimborsato resta contato, e chi riapre l'indirizzo di
ritorno da un altro browser.

Quindi: **la verità è Stripe**, e il numero di Meta serve solo alla campagna per
imparare. Il rapporto fra i due — `Purchase` in Meta diviso gli acquisti in
Stripe nello stesso periodo — **è il tasso di consenso alla profilazione**, ed è
l'unica misura che se ne avrà. Guardando i due cruscotti, i due numeri non
devono coincidere: se coincidessero vorrebbe dire che tutti stanno accettando,
che non succede.

Una conseguenza pratica: con pochi `Purchase` la campagna fatica a uscire dalla
fase di apprendimento, e la tentazione diventa ottimizzare su
`InitiateCheckout`. Quello è un clic su un collegamento, e conta anche chi non
ha pagato mai.

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

1. ~~Creare il Payment Link su Stripe~~ — **fatto** il 10 settembre 2026.
2. **Attivare la notifica email di Stripe a ogni pagamento riuscito**: è
   l'unico segnale che l'acquisto è avvenuto, e senza non parte niente.
3. **Preparare le due email**, quella dei Termini e quella della chiave. La
   sequenza dei passi sta in `strumenti/licenza/LEGGIMI.md`, sotto «L'ordine dei
   passi, per un acquisto vero».
4. **Un acquisto vero, con una carta vera, rimborsato subito**: è l'unico modo
   di vedere tutto il giro — la ricevuta, i dati che Stripe raccoglie e quelli
   che non raccoglie, l'email, la chiave, l'attivazione. Va fatto **prima** di
   togliere il noindex, ed è l'ultimo gesto prima del lancio.
4. **Niente da decidere sulla fatturazione elettronica: è deciso.** Vedi il
   punto qui sotto.

---

## I dati di fatturazione: chiesti per email, e non altrove

**Deciso il 10 settembre 2026.** Stripe raccoglie quello che raccoglie —
ragione sociale, indirizzo, partita IVA — e **non** raccoglie il codice
destinatario, la PEC né il codice fiscale, che per una fattura elettronica
verso un titolare di partita IVA italiano servono.

I tre mancanti si chiedono **nella stessa email in cui si chiede la
dichiarazione e l'approvazione delle clausole del punto 13**. Non c'è un giro in
più per l'acquirente: quel giro esiste già, perché il contratto si conclude alla
consegna della chiave e la chiave parte dopo la sua risposta.

Le due strade scartate, e perché:

- **Un campo personalizzato sul Payment Link.** Stripe ne ammette tre, e nessuno
  può essere obbligatorio *in modo condizionale*: chi non ha una PEC scriverebbe
  qualcosa lo stesso, e un campo compilato male in un checkout non si corregge
  più — la fattura la si emette con quello.
- **Il codice convenzionale `0000000`.** Lo SdI lo accetta e recapita nel
  cassetto fiscale del destinatario: è legittimo, e resta la rete di sicurezza
  per chi non risponde. Ma usarlo *per scelta*, quando l'email c'è comunque,
  scaricherebbe sull'acquirente il compito di andarsi a cercare la fattura.

Conseguenza sul prodotto: **nessuna.** Non c'è codice da scrivere — è una riga
del mansionario, e sta in `strumenti/licenza/LEGGIMI.md` sotto «L'ordine dei
passi, per un acquisto vero». È il vantaggio di aver messo la conclusione del
contratto dopo il pagamento: i dati che mancano si chiedono a voce, una volta,
a chi ha già pagato.

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
