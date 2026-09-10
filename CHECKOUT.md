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

## La domanda che viene prima di tutte, ed è per il legale

**Se i Termini dicono che Flowlance è offerto esclusivamente a chi acquista
nell'esercizio della propria attività professionale, la distinzione
Consumatore / Professionista sparisce.** E con lei sparisce il diritto di
recesso, sparisce la casella dell'attivazione immediata che esiste solo per
proteggerlo, e sparisce metà di questo documento.

Non è una forzatura: Flowlance è uno strumento di gestione fiscale per titolari
di partita IVA, e chi lo compra senza esserlo non può usarlo per la cosa a cui
serve. Un'offerta rivolta a soli professionisti è quindi coerente con il
prodotto, non un espediente per togliersi obblighi.

**È una domanda per il legale, non per chi scrive il codice**, e vale la pena
porla prima di progettare il checkout, perché la risposta cambia cosa il
checkout deve fare:

| | Se la risposta è **no** (offerta a tutti) | Se è **sì** (solo professionisti) |
|---|---|---|
| Punto 1 · dichiarare la qualità | serve | non serve |
| Punto 2 · attivazione immediata | serve | non serve — il recesso non c'è |
| Punto 3 · art. 1341 | serve | **serve comunque**: vale nei contratti per adesione, anche fra professionisti |
| Punto 4 · supporto durevole | serve | serve |
| Recesso 14 giorni (Termini, punto 7) | va riconosciuto | non si applica |
| Foro (Termini, punto 11) | quello del consumatore | Alessandria per tutti |

Da chiarire con chi risponde, perché non è ovvio:

- **La garanzia di rimborso a 30 giorni resta comunque**, in tutti e due i
  casi: è contrattuale, non di legge, ed è più ampia del recesso per durata e
  per platea. È il motivo per cui i Termini la tengono anche adesso che il
  recesso è riconosciuto.
- **Una dichiarazione dell'acquirente non basta da sola a escludere la
  qualifica di consumatore**: rileva lo scopo effettivo dell'acquisto, e i
  Termini attuali lo dicono già. Va capito se un'offerta rivolta a soli
  professionisti regge dove una dichiarazione non reggerebbe.
- **Cosa succede a chi compra lo stesso senza esserlo.** Se l'offerta è chiusa
  ai professionisti, serve dire cosa accade a un acquisto fuori perimetro:
  rimborso, o licenza valida lo stesso.

Finché la risposta non c'è, questo documento resta scritto per il caso più
oneroso — offerta a tutti — perché è quello che copre entrambi.

---

## Come si collega Stripe, e dove finiscono le risposte

Il sito è statico — `output: "export"`, nessuna rotta API, nessun segreto nel
bundle — e la licenza si firma a mano con una chiave privata che sta fuori dal
repository. Il collegamento con Stripe è quindi un **Payment Link**: il pulsante
«Acquista» è un `<a href>` verso `buy.stripe.com`, e la notizia del pagamento
arriva per email dalle notifiche di Stripe. Il collo di bottiglia è la mano
sulla chiave privata, non la notifica.

Quello che resta da decidere è **dove finiscono le risposte del modulo che
precede il pagamento** — qualità dell'acquirente, codice fiscale, SDI o PEC, e
le due caselle dei punti 2 e 3. Serve una pagina propria prima del checkout: i
campi personalizzati di Stripe non bastano, e non per un campo di troppo ma per
la natura di due di essi — un Payment Link non fa spuntare caselle.

### La trappola che vale per qualunque strada

`client_reference_id` si può passare a un Payment Link statico come parametro
dell'indirizzo: alfanumerico, trattini e underscore, fino a 200 caratteri
([documentazione Stripe](https://docs.stripe.com/payment-links/url-parameters)).
Serve a legare una riga propria al pagamento senza accoppiarli a occhio.

**Ma un valore non valido viene scartato in silenzio, e la pagina di pagamento
continua a funzionare.** Lo dice la documentazione. Tradotto: un incasso senza
riferimento, e nessun errore da nessuna parte — la stessa famiglia di difetti
che questo progetto insegue da settimane. Qualunque strada si scelga, il
riferimento va **verificato dopo**, non dato per riuscito.

### A · Solo Brevo, due registri da riconciliare a mano

Il form ospitato accetta i campi e ha un'impostazione «reindirizza a questo URL
dopo l'iscrizione» che manda al Payment Link.

- **Regge**: zero codice, zero servizi in più, lo stesso meccanismo del modulo
  email già in uso.
- **Costa**: l'URL di reindirizzamento è configurato *nel form*, uno solo e
  fisso, quindi non può portare un `client_reference_id`. Si riconcilia a
  occhio, per email e orario. Con due vendite al giorno funziona; con venti
  diventa un lavoro.
- **Si rompe**: chi compila e non paga lascia una riga senza pagamento, e non
  si distingue «ci ha ripensato» da «il pagamento è fallito». Chi paga con
  un'email diversa da quella del modulo lascia due righe che non si toccano. E
  le due caselle diventano campi di un'iscrizione a una newsletter: **la prova
  che sono state spuntate è una riga in un contatto Brevo**, che come prova di
  un'approvazione specifica vale poco.

### B · Brevo, con l'identificativo generato dalla pagina

La pagina genera un identificativo, lo mette in `sessionStorage`, lo manda a
Brevo come campo; Brevo rimanda a una pagina propria, che rilegge
l'identificativo e costruisce il link Stripe con `?client_reference_id=`.

- **Regge**, ed è tutto statico. La riconciliazione diventa esatta.
- **Costa**: una catena di cinque passaggi in cui ogni anello può cedere, e uno
  è fuori dal proprio controllo (l'impostazione di reindirizzamento nel
  pannello Brevo). Serve JavaScript.
- **Si rompe**: `sessionStorage` bloccato — navigazione privata, impostazioni
  restrittive — e l'identificativo si perde. Si finisce nel caso A **senza
  accorgersene**, perché Stripe scarta in silenzio il parametro assente. Chi
  apre la pagina di pagamento a mano paga senza riferimento. E la prova delle
  due caselle resta una riga Brevo, come in A.

### C · Una funzione serverless su Vercel

Il modulo fa POST alla funzione. Lei genera l'identificativo, registra la riga —
email, foglio, o contatto Brevo via API — e risponde con un 302 al Payment Link
con `client_reference_id` già dentro.

- **Regge meglio delle altre due**: un salto solo, nessuno stato nel browser,
  funziona anche senza JavaScript, e l'identificativo nasce dove non si può
  perdere.
- **È l'unica in cui l'accettazione si registra come si deve**: orario,
  indirizzo IP, e soprattutto **la versione del testo dei Termini in vigore in
  quel momento** — che è ciò che serve davvero per l'art. 1341 e per il punto 12
  dei Termini, dove si dice che per le licenze in corso valgono i termini
  accettati all'acquisto.
- **Costa**: un segreto in una variabile d'ambiente, e un pezzo di
  infrastruttura che prima non c'era. `output: "export"` resta intatto — la
  funzione sta fuori dal build di Next — ma il progetto smette di essere «solo
  file statici», che finora era una proprietà tenuta apposta.
- **Si rompe**: la funzione va giù e nessuno può comprare, mentre con A e B il
  peggio è perdere un dato. Se fallisce dopo aver preso i dati e prima del 302,
  chi compra resta fermo.

### La scelta non è tecnica

Se l'offerta diventa ai **soli professionisti** (vedi la domanda per il legale
qui sopra), l'attivazione immediata sparisce e resta l'art. 1341, che si può
far approvare via email insieme alla chiave: **A basta, e C non serve.**

Se l'offerta resta **aperta a tutti**, servono due caselle con una prova, e la
prova non può stare in un contatto Brevo: **serve C.**

Sono due progetti di dimensione diversa, e a deciderli è la risposta del
legale. Nessuna delle due si costruisce prima.

---

## 5 · Le righe non dicono da dove vengono

Non è un obbligo dei Termini: è una **mancanza del modello** che si è vista
quando è servita, e che qui sta perché la prossima volta si vedrà di nuovo.

Fatture, costi e note non portano la loro provenienza. Chi le ha scritte — la
mano, un file CSV, un backup importato — non è ricostruibile: la tabella
`importazioni` esiste ma tiene **solo l'ultimo import**, perché è la rete per
annullarlo e non un registro storico, e al secondo import il primo sparisce.

La conseguenza si è vista con il difetto dell'aliquota IVA proposta
dall'import: `strumenti/diagnosi-iva-importata.js` deve cercare le righe **per
sintomo** — quelle al 22 % dove l'utente dichiara un'altra aliquota — invece
che per origine, e quindi elenca anche righe scritte a mano che al 22 % ci
stavano benissimo. È una diagnosi approssimata, e lo è per questa ragione.

Un campo `origine` sulle righe la renderebbe esatta, e renderebbe esatta ogni
diagnosi futura della stessa forma: «cosa è entrato da un import e non da una
mano». Non si aggiunge adesso — cambia lo schema, e va deciso insieme a cosa
farne nell'interfaccia — ma quando si toccherà lo schema per un'altra ragione,
questa è la cosa da infilarci dentro.

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
