# Il checkout: com'è deciso, e cosa resta da fare

*Aggiornato il 13 ottobre 2026: versione 3 dei Termini — quella senza clausole
da approvare specificamente — e la registrazione dell'accettazione prima del
pagamento, che è la terza condizione a cui il legale ha legato la
pubblicazione.*

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
raccogliere.

Delle tre strade che questo file confrontava all'inizio — Brevo, identificativo
generato dalla pagina, funzione serverless — ne è stata presa **una**, dal 13
ottobre: la funzione serverless, che registra l'accettazione **prima** che il
pagamento parta. Non perché sia cambiato il contratto, ma perché una prova di
che cosa l'acquirente aveva davanti non può nascere dopo il fatto per mano di
chi la deve esibire. È la terza condizione del legale, e la sezione «Niente
OTP» più sotto racconta per intero il perché del cambio.

---

## Il flusso, in tre passi

| | Dove accade | Cosa resta come prova |
|---|---|---|
| 1 · Lettura, accettazione dei Termini e dichiarazione professionale | `/acquista` sul sito | un evento nell'archivio `accettazioni-termini/`: versione e impronta di quello che era a schermo, ora del server, identificativo casuale |
| 2 · Pagamento: **qui si conclude il contratto** | Payment Link di Stripe | ricevuta e dati di fatturazione, in Stripe |
| 3 · Consegna: chiave **e** Termini in PDF con la loro impronta | email, a mano, entro la fine del primo giorno lavorativo successivo | il PDF inviato e la riga in `emesse.jsonl` |

La pagina `/acquista` esiste ed è `src/app/(sito)/acquista/`. Mostra il testo
integrale dei Termini, il PDF con la sua impronta SHA-256, e **due caselle
obbligatorie**: l'accettazione dei Termini, che nomina la versione, e la
dichiarazione di acquisto professionale. Senza tutte e due il pulsante del
pagamento è disattivato, quindi non si può premere neanche da tastiera.

Il pulsante **non è più un collegamento**. Alla pressione chiama
`/api/accettazione`, che registra cosa c'era a schermo e restituisce un
identificativo; solo allora la pagina apre il Payment Link, con
`?client_reference_id=<identificativo>` attaccato. Se la registrazione non
riesce, **il pagamento non si apre**: resta la pagina con scritto «Non riesco a
registrare l'accettazione dei Termini, e senza quella non apro il pagamento.
Riprova, o scrivi a info@flowlance.it.»
Subito sopra il pulsante c'è scritto cosa succede premendolo: *«Paghi, il
contratto è concluso e ricevi la chiave per email entro la fine del primo
giorno lavorativo successivo. Rimborso integrale entro 30 giorni.»*

Il Payment Link **c'è**, dal 10 settembre 2026: sta in `PAYMENT_LINK`, dentro
`src/lib/sito/impostazioni.ts`. Il riquadro del segnaposto è sparito e il
pulsante «Paga 118,34 € con Stripe» ha preso il suo posto, con la riga sull'IVA
attaccata sotto.


---

## Trasferimento e rimborso: due procedure, una cosa in comune

La cosa in comune è quella che il programma **non** può fare, e che va detta a
voce tutte e due le volte: **le chiavi non si disattivano a distanza.**
L'applicazione funziona nel browser dell'utente, senza collegamento al
Fornitore — è il motivo per cui i dati di chi compra non si possono rubare da
qui, ed è lo stesso motivo per cui una chiave già consegnata resta valida fino
alla sua scadenza, qualunque cosa succeda dopo. I Termini lo scrivono due
volte, al punto 3 per il trasferimento e al punto 4 per il rimborso, e mettono
in capo all'utente l'obbligo di cessare l'utilizzo.

Non è una falla da tappare: tapparla vorrebbe dire un server che ogni app
interroga, cioè il contrario del prodotto. È una condizione da dichiarare, e
quindi la si dichiara.

### Trasferimento (punto 3)

Chi cede scrive, o scrive chi riceve: in tutti e due i casi serve il consenso
di tutti e due, e i dati del nuovo intestatario.

```sh
node genera-licenza.mjs nuovo@esempio.it --trasferisci vecchio@esempio.it
```

Il comando emette una chiave nuova **con la stessa scadenza** — il
trasferimento non prolunga la durata — e annota nel registro da chi arriva. Se
si prova a passargli anche una data, `--mesi` o `--anni`, si ferma: un'opzione
ignorata è una decisione presa da chi legge il comando invece che da chi lo
scrive.

Nell'email al nuovo intestatario vanno due frasi che il comando stampa da sé:

1. la chiave del precedente intestatario **non viene disattivata**, e cessare
   l'utilizzo è un suo obbligo (punto 3);
2. **il prezzo fondatori non si trasferisce** (punto 6-bis, comma 7): resta a
   chi ha comprato per primo, e per il nuovo intestatario vale il listino.

Da quel momento `--storico` lo dice da tutte e due le parti: a chi ha ceduto
che il beneficio è rimasto suo — e che per il comma 8 il suo prossimo acquisto
si misura sulla **scadenza originaria** della licenza trasferita — e a chi ha
ricevuto che non è arrivato con la licenza.

**L'email al precedente intestatario**, pronta da copiare:

> Oggetto: **Flowlance — licenza trasferita a [nuovo indirizzo]**
>
> Ciao [nome],
>
> ho registrato il trasferimento della tua licenza Flowlance a [nuovo
> indirizzo]. La nuova chiave è stata emessa con la **stessa scadenza** della
> tua: [data]. Il trasferimento non prolunga la durata.
>
> Due cose, perché siano scritte:
>
> 1. **Da adesso l'utilizzo della tua chiave deve cessare.** L'applicazione
>    funziona nel tuo browser senza collegarsi a noi, quindi la chiave resta
>    tecnicamente valida fino alla scadenza e non possiamo disattivarla a
>    distanza: il punto 3 dei Termini mette in capo a te l'obbligo di smettere
>    di usarla. I tuoi dati restano sul tuo dispositivo — se ti servono,
>    esportali prima: l'esportazione funziona sempre.
> 2. **Il prezzo riservato ai Fondatori resta tuo** e non passa a chi ha
>    ricevuto la licenza (punto 6-bis, comma 7). Se in futuro comprerai una
>    nuova licenza, vale il prezzo garantito se l'acquisto avviene entro 30
>    giorni dalla scadenza originaria di quella trasferita — il [data] — e il
>    listino dopo (comma 8).
>
> [firma]

### Rimborso (punto 7)

Entro 30 giorni dalla conclusione, senza motivazione, su richiesta a
`info@flowlance.it`. Rimborso dell'intero importo IVA compresa entro 14 giorni,
con lo stesso mezzo di pagamento, con nota di credito.

La licenza cessa di essere valida **alla data di esecuzione del rimborso**
(punto 4), e anche qui la chiave resta tecnicamente funzionante fino alla
scadenza: nell'email del rimborso va scritto che l'utilizzo cessa.

L'evento si registra con lo strumento, che non cancella niente — `emesse.jsonl`
è un giornale, non uno stato — e scrive una riga nuova con la data del rimborso
e quella da cui cessa il diritto d'uso:

```sh
node genera-licenza.mjs cliente@esempio.it --rimborso
node genera-licenza.mjs cliente@esempio.it --rimborso --cessa 2026-11-05
```

Da lì in poi il conto dei Fondatori lo fa lo strumento: il punto 6-bis comma 2
dice che **le licenze rimborsate non contano** nell'ordine dei primi 50, il
posto si libera, e l'ordine degli altri non cambia — è un ordine per data di
primo acquisto, e togliere una riga non sposta le altre. `--storico` stampa
quanti posti sono occupati e che posizione ha l'indirizzo.

**L'email del rimborso**, pronta da copiare:

> Oggetto: **Flowlance — rimborso eseguito**
>
> Ciao [nome],
>
> ho eseguito il rimborso di [importo] € il [data rimborso], con lo stesso
> mezzo di pagamento usato per l'acquisto. Trovi in allegato la nota di
> credito.
>
> **Dal [data di cessazione] la licenza non è più valida e l'utilizzo
> dell'applicazione deve cessare** (punto 4 dei Termini). L'applicazione
> funziona nel tuo browser senza collegarsi a noi, quindi la chiave resta
> tecnicamente valida fino alla scadenza e non possiamo disattivarla a
> distanza: la cessazione è un tuo obbligo.
>
> **I tuoi dati restano sul tuo dispositivo**, e sono tuoi: esportali quando
> vuoi da «Dati e backup» — l'esportazione funziona anche a licenza scaduta.
> Noi non ne abbiamo copia e non possiamo cancellarli né recuperarli.
>
> Se un domani vorrai tornare, basta un acquisto nuovo.
>
> [firma]

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

## Niente OTP. Una funzione serverless sì, dal 13 ottobre

**Niente OTP.** Serviva a legare a una persona verificabile una dichiarazione
raccolta sul sito. Con la versione 3 non c'è più nessuna dichiarazione da
verificare: le clausole da approvare specificamente non esistono, e chi compra
è identificato da Stripe, che incassa il pagamento con cui il contratto si
conclude.

**La funzione serverless invece c'è**, e questo documento ha detto per un mese
il contrario. Vale la pena scrivere perché, perché non è un cambio d'idea: il
ragionamento di prima era che la prova la fa il documento **consegnato** — il
PDF della versione accettata, con la sua impronta, mandato per email subito
dopo il pagamento. Resta vero, e quella consegna continua a esserci. Ma
risponde a una domanda sola: *che cosa gli ho mandato?* La domanda che un
giudice fa è un'altra: *che cosa aveva davanti quando ha pagato?* A quella il
documento consegnato dopo non risponde, perché l'ho scritto io dopo. Il legale
ha messo questa differenza fra le tre condizioni per pubblicare, e ha ragione:
una prova che nasce dopo il fatto e per mano di una delle due parti è la parte
più debole di un fascicolo altrimenti solido.

Quindi `api/accettazione.ts`, che registra **prima** del pagamento e in un
archivio che non si riscrive. Il sito resta `output: "export"`: la funzione
sta fuori da Next, alla radice, come le altre due, e le pagine continuano a
essere file statici.

**Quello che la funzione non registra** è la parte da leggere due volte:
**niente email, niente IP, nessun dato personale.** Dentro l'evento ci sono un
identificativo casuale, l'ora del server, la versione e l'impronta dei Termini
mostrati, la versione e l'impronta del testo delle due dichiarazioni. Chi ha
comprato lo dice Stripe, dove il dato c'è già e per una ragione sua. Il
collegamento fra le due cose è l'identificativo, che viaggia nell'indirizzo
come `client_reference_id`.

> **La trappola, che ora conta davvero.** `client_reference_id` si passa a un
> Payment Link come parametro dell'indirizzo: alfanumerico, trattini e
> underscore, fino a 200 caratteri. **Un valore non valido viene scartato in
> silenzio, e la pagina di pagamento continua a funzionare.** Un incasso senza
> riferimento, e nessun errore da nessuna parte. Per questo l'identificativo
> che genera la funzione è un `randomUUID()` **senza trattini** — 32 caratteri
> esadecimali, dentro il formato qualunque cosa succeda — e per questo il
> riferimento si **guarda dopo**, sul primo acquisto vero: vedi sotto.

**NON VERIFICATO: la documentazione di Stripe, da qui, non si legge.** Il proxy
di rete di questo ambiente nega `docs.stripe.com` (403 al CONNECT, e
`ENOTFOUND` passando per il recupero pagina). Quindi le tre affermazioni qui
sopra — che un Payment Link accetti `client_reference_id` nell'indirizzo, che
Stripe lo conservi sulla **sessione di checkout** (dove si rilegge sia dal
pannello sia nell'evento `checkout.session.completed`), e che un valore non
valido venga scartato in silenzio — vengono da estratti di ricerca di quelle
stesse pagine, non dalle pagine. Gli estratti concordano fra loro e con quanto
questo file diceva già a settembre, ma un estratto non è una verifica: **la
pagina va aperta da un browser vero**, e la prova definitiva è comunque
l'acquisto vero del punto 4 della lista in fondo. Se Stripe non conservasse il
riferimento, il giro non si rompe — l'evento resta registrato e in ordine
cronologico — ma si perde il modo rapido di legare un pagamento alla sua prova,
e allora si lega per data e ora.

---

## Dal pagamento alla prova dell'accettazione

La domanda a cui questa sezione risponde è una: *ho un pagamento in Stripe, dove
sta la prova di che cosa quella persona ha accettato?*

**1 · Da Stripe, prendi il riferimento.** Pannello Stripe → *Payments* → il
pagamento → la sessione di checkout collegata. Il campo è *Client reference ID*
(nell'API, `client_reference_id` sull'oggetto `checkout.session`). È una stringa
di 32 caratteri esadecimali senza trattini. Lo stesso valore arriva nell'evento
`checkout.session.completed`, se un giorno ci sarà un webhook.

**2 · Dal riferimento, trova l'evento.** Pannello Vercel → il progetto →
*Storage* → il Blob store → cartella `accettazioni-termini/`, poi la cartella
del **giorno**, poi il file che **comincia con quel riferimento**.

Il magazzino è **privato**: dal pannello si sfoglia e si scarica perché sei tu,
ma l'indirizzo del file da solo non apre niente. Non incollarlo in un'email
aspettandoti che si apra, e non c'è bisogno di trattarlo come un segreto se
dovesse finire da qualche parte. Il nome è
`accettazioni-termini/<AAAA-MM-GG>/<identificativo>-<suffisso casuale>.json`: il
suffisso lo aggiunge Vercel e cambia a ogni scrittura, quindi si cerca per
inizio del nome, non per nome esatto.

Il giorno è quello **dell'accettazione**, cioè di poco prima del pagamento, in
UTC. Quasi sempre è lo stesso del pagamento; se il pagamento è a cavallo della
mezzanotte UTC, o se qualcuno ha spuntato le caselle e ha pagato molto più
tardi, guarda anche il giorno prima.

**3 · Apri il file.** Dentro c'è questo, e nient'altro:

```json
{
  "archivio": "accettazioni-termini",
  "id": "<lo stesso del client_reference_id>",
  "quando": "2026-10-13T14:31:07.201Z",
  "versioneTermini": 3,
  "improntaTermini": "339ea0254caf98de…",
  "versioneDichiarazioni": "2026-10-12",
  "improntaDichiarazioni": "…"
}
```

**4 · Verifica le due impronte.** `improntaTermini` è il SHA-256 del PDF che la
pagina offriva in quel momento: deve essere identica a quella del PDF
consegnato, e si ricalcola con `shasum -a 256 public/termini/flowlance-termini-v3.pdf`.
`improntaDichiarazioni` è il SHA-256 del testo integrale delle due caselle: il
testo sta in `src/lib/sito/dichiarazioni.ts`, archiviato per versione come i
testi dei consensi, e `versioneDichiarazioni` dice quale rileggere. Le due
impronte sono il motivo per cui l'evento è piccolo: dicono *quale* documento,
non ne tengono una copia a ogni acquisto.

**Nel fascicolo della licenza vanno quattro cose**, e la prima è la nuova:

1. **il file JSON dell'evento**, scaricato dal Blob store, con accanto il testo
   delle due dichiarazioni nella versione che l'evento nomina (copia e incolla
   da `dichiarazioni.ts`): da solo l'evento nomina un testo che sta altrove, e
   un fascicolo che rimanda a un file sorgente non è un fascicolo;
2. **il PDF dei Termini** nella versione accettata, con la sua impronta scritta
   accanto — lo stesso file mandato per email;
3. **la ricevuta di Stripe**, che è dove c'è chi ha comprato, e dove sta il
   *Client reference ID* che lega l'una all'altra;
4. **la riga di `emesse.jsonl`** della chiave consegnata, con data di consegna
   e scadenza.

Con queste quattro cose la catena si legge in un verso e nell'altro: dal
pagamento alla prova, e dalla prova al pagamento. Nessun pezzo della catena sta
in un posto solo, e nessun pezzo contiene due volte lo stesso dato personale.

**Conservazione: dieci anni dalla cessazione della licenza**, e non li esegue
nessuna pulizia automatica — vedi `DEPLOY.md`, «Il quarto archivio».

---

## Il secondo livello, nel pannello Stripe

La funzione registra che cosa c'era a schermo sul **nostro** sito. Il secondo
livello lo dà Stripe, sulla **sua** pagina di pagamento, e serve a una cosa
precisa: che l'accettazione risulti anche nei documenti di chi incassa, non
solo nei nostri. Due impostazioni, cinque minuti, e si fanno una volta.

**A · L'indirizzo pubblico dei Termini.**

1. Pannello Stripe → *Settings* (l'icona dell'ingranaggio, in alto a destra) →
   *Business* → **Public details** (o *Public business information*).
2. Nel campo **Terms of service URL** (*URL dei termini di servizio*) incolla:
   `https://flowlance.it/termini/flowlance-termini-v3.pdf`
3. Nel campo **Privacy policy URL**, quando l'informativa sarà approvata,
   andrà `https://flowlance.it/privacy/`. **Oggi no**: i documenti privacy sono
   in revisione, e un indirizzo che rimanda a un testo non definitivo è peggio
   di un campo vuoto.
4. Salva.

Il PDF e non `https://flowlance.it/termini/`: l'indirizzo che Stripe mostra
deve puntare al **documento con l'impronta**, cioè a quello che si consegna e
che l'evento nomina. La pagina HTML dice le stesse parole, ma non è il file di
cui esiste un SHA-256 nel fascicolo.

**B · L'accettazione obbligatoria sul Payment Link.**

1. Pannello Stripe → *Payment links* → il link di Flowlance (quello in
   `PAYMENT_LINK`, `src/lib/sito/impostazioni.ts`) → *Edit*.
2. Sezione *Options* / *Advanced options* → **Require customers to accept your
   terms of service** (*Richiedi ai clienti di accettare i termini di
   servizio*). Attivala.
3. Salva, e **riapri la pagina di pagamento dal sito** per vedere la casella
   comparire: è l'unico modo di sapere che l'hai attivata sul link giusto.

Quella spunta è registrata da Stripe insieme al pagamento — con il suo orario e
il suo indirizzo IP, che noi non raccogliamo — e diventa la seconda prova,
indipendente dalla nostra, sullo stesso fatto.

> **I nomi delle voci del pannello non li ho potuti verificare**: da qui
> `docs.stripe.com` e `dashboard.stripe.com` sono bloccati dal proxy. Le
> etichette qui sopra sono quelle che Stripe usava; se una non la trovi,
> cercala nella casella di ricerca del pannello con le parole *terms of
> service*. Quello che conta — un indirizzo pubblico dei ToS, e la casella
> obbligatoria sul link — c'è da anni e si chiama più o meno così.

Se attivare la casella su Stripe facesse comparire **due** accettazioni di fila
all'acquirente (una nostra, una loro), va bene: sono due atti diversi davanti a
due soggetti diversi, e nessuno si è mai lamentato di aver dovuto confermare di
aver letto un contratto. Il contrario — una sola, da una parte sola — è il caso
in cui una contestazione diventa la nostra parola contro la sua.

---

## Cosa resta da fare, in ordine

1. ~~Creare il Payment Link su Stripe~~ — **fatto** il 10 settembre 2026.
2. **Collegare il Blob store al progetto su Vercel**, se non è già collegato:
   senza `BLOB_READ_WRITE_TOKEN` la funzione delle accettazioni risponde 503 e
   **nessuno può comprare**. Vedi `DEPLOY.md`, «La funzione delle accettazioni».
   È il primo passo adesso, perché è l'unico che impedisce di vendere.
3. **Le due impostazioni nel pannello Stripe** — l'indirizzo pubblico dei ToS e
   la casella obbligatoria sul Payment Link: passo per passo nella sezione «Il
   secondo livello» qui sopra.
4. **Attivare la notifica email di Stripe a ogni pagamento riuscito**: è
   l'unico segnale che l'acquisto è avvenuto, e senza non parte niente.
5. **Preparare l'email di consegna**, una sola: la chiave, il PDF dei Termini
   nella versione accettata e la sua impronta. Non chiede niente in risposta —
   il contratto è già concluso. La sequenza dei passi sta in
   `strumenti/licenza/LEGGIMI.md`, sotto «L'ordine dei passi, per un acquisto
   vero».
6. **Un acquisto vero, con una carta vera, rimborsato subito**: è l'unico modo
   di vedere tutto il giro — la ricevuta, i dati che Stripe raccoglie e quelli
   che non raccoglie, l'email, la chiave, l'attivazione. Guarda anche le due
   cose nuove: che l'indirizzo di Stripe porti `?client_reference_id=`, e che
   nel Blob store compaia il file dell'evento. Va fatto **prima** di togliere
   il noindex, ed è l'ultimo gesto prima del lancio.
7. **Niente da decidere sulla fatturazione elettronica: è deciso.** Vedi il
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
