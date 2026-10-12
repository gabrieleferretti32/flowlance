# Il checkout: com'è deciso, e cosa resta da fare

*Aggiornato il 12 ottobre 2026, con la versione 3 dei Termini — quella senza
clausole da approvare specificamente.*

Il legale ha ridotto le clausole vessatorie, e con loro è sparita metà di
questo documento. **Flowlance è offerto ai soli professionisti** (Termini,
punto 1), il contratto si conclude **con il pagamento** (punto 3), il recesso
del Codice del consumo non si applica e resta la sola garanzia contrattuale di
rimborso a 30 giorni (punto 7). **Nessuna clausola è soggetta ad approvazione
specifica ex artt. 1341-1342 c.c.**: niente massimale, niente foro esclusivo,
nessuna esclusione di responsabilità da far approvare per iscritto.

Da lì discende un flusso più corto di quello che questo file descriveva. Il
giro per email — i Termini da approvare, la risposta dall'indirizzo
dell'acquirente, la chiave che partiva solo dopo — **non serve più**: non
proteggeva il contratto, proteggeva un'approvazione che adesso non si deve
raccogliere. Le tre strade che questo file confrontava all'inizio — Brevo,
identificativo generato dalla pagina, funzione serverless — continuano a non
servire, e per la stessa ragione di prima: non c'è niente da registrare
*durante* il pagamento.

---

## Il flusso, in tre passi

| | Dove accade | Cosa resta come prova |
|---|---|---|
| 1 · Lettura, accettazione dei Termini e dichiarazione professionale | `/acquista` sul sito | niente, ed è voluto — vedi sotto |
| 2 · Pagamento: **qui si conclude il contratto** | Payment Link di Stripe | ricevuta e dati di fatturazione, in Stripe |
| 3 · Consegna: chiave **e** Termini in PDF con la loro impronta | email, a mano, entro 24 ore lavorative | il PDF inviato e la riga in `emesse.jsonl` |

La pagina `/acquista` esiste ed è `src/app/(sito)/acquista/`. Mostra il testo
integrale dei Termini, il PDF con la sua impronta SHA-256, e **due caselle
obbligatorie**: l'accettazione dei Termini, che nomina la versione, e la
dichiarazione di acquisto professionale. Senza tutte e due il collegamento al
pagamento non ha un indirizzo, quindi non è raggiungibile neanche da tastiera.
Subito sopra il pulsante c'è scritto cosa succede premendolo: *«Paghi, il
contratto è concluso e ricevi la chiave per email entro 24 ore lavorative.
Rimborso integrale entro 30 giorni.»*

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
dei Termini le ha rese inutili tutte e due (e la 3 non le ha riportate).

**Niente OTP.** Serviva a legare a una persona verificabile una dichiarazione
raccolta sul sito. Con la versione 3 non c'è più nessuna dichiarazione da
verificare: le clausole da approvare specificamente non esistono, e
l'accettazione dei Termini si prova con quello che si **consegna**, non con
quello che si raccoglie.

**Niente funzione serverless.** Serviva a registrare l'accettazione con orario,
IP e versione del testo. Ma la prova che conta è il documento su supporto
durevole: il PDF della versione accettata, con la sua impronta, inviato per
email subito dopo il pagamento, accanto alla ricevuta di Stripe. Il sito resta
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

## Perché le spunte sul sito non sono una prova, e va bene così

Su un sito statico una casella spuntata non lascia traccia da nessuna parte:
non c'è un server che la registri. Una dichiarazione che nessuno conserva non è
una prova — è un'animazione.

Le due caselle di `/acquista` sono quindi quello che sono: **il momento in cui
l'acquirente ha davanti cosa sta concludendo e chi dichiara di essere**, prima
di pagare. La prova la fa la consegna: il PDF della versione accettata, con la
sua impronta, mandato per email subito dopo il pagamento e conservato nel
fascicolo dell'ordine insieme alla ricevuta di Stripe.

Fingere sulla pagina una registrazione che non si può conservare sarebbe peggio
che non farla, perché farebbe credere di averla.

---

## Cosa resta da fare, in ordine

1. ~~Creare il Payment Link su Stripe~~ — **fatto** il 10 settembre 2026.
2. **Attivare la notifica email di Stripe a ogni pagamento riuscito**: è
   l'unico segnale che l'acquisto è avvenuto, e senza non parte niente.
3. **Preparare l'email di consegna**, una sola: la chiave, il PDF dei Termini
   nella versione accettata e la sua impronta. Non chiede niente in risposta —
   il contratto è già concluso. La sequenza dei passi sta in
   `strumenti/licenza/LEGGIMI.md`, sotto «L'ordine dei passi, per un acquisto
   vero».
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

I tre mancanti si chiedono **in coda all'email di consegna**, come richiesta e
non come condizione: la chiave parte comunque, nella stessa email, perché il
contratto è concluso dal pagamento e non c'è niente che possa aspettare una
risposta. Chi non risponde ha la sua licenza lo stesso, e la fattura si emette
con la rete di sicurezza qui sotto.

> **Cos'è cambiato, e perché va detto.** Fino alla versione 2 quei tre dati
> viaggiavano nella stessa email che chiedeva l'approvazione delle clausole, e
> una risposta la si aspettava comunque: chiederli non costava un giro in più.
> Adesso il giro non c'è, e **tenere la chiave in ostaggio dei dati di
> fatturazione sarebbe un passo indietro di un mese** — una condizione nuova
> all'uso di quello che è già stato pagato. Si chiede e si va avanti.

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
- **Termini in PDF con l'indicazione della versione, trasmessi insieme alla
  chiave** (punto 3): il PDF lo genera ogni build da `contenuti/termini.md`
  (`src/lib/contenuti/pdf-termini.ts`), con l'impronta SHA-256 stampata accanto
  al link su `/termini` e su `/acquista`.
- **Alla scadenza: consultazione, esportazione e stampa, niente scrittura**
  (punto 4): fatto. Lo spegnimento della scrittura è `BloccoScrittura` e
  `<Button scrive>`; l'esportazione e la stampa **non** portano quel marcatore,
  ed è deliberato — un test lo verifica sul sorgente, perché è una promessa del
  contratto e non una preferenza d'interfaccia.
- **L'elenco pubblico delle semplificazioni** (punto 2): è
  [`APPROSSIMAZIONI.md`](APPROSSIMAZIONI.md), pubblicato su `/cosa-non-calcola`.
- **Il promemoria periodico del backup** (punto 5): fatto,
  `src/lib/dati/promemoria-backup.ts`.
- **I parametri fiscali aggiornati per gli anni coperti** (punto 8):
  `src/lib/fisco/parametri/`, un file per anno.
- **La versione vale per le licenze in corso** (punto 12): i PDF portano la
  versione nel nome (`flowlance-termini-v3.pdf`) e non si sovrascrivono. Il
  fascicolo di un ordine vecchio continua a puntare al testo che lo governava.
