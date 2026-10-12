# Punti (d) ed (e) dell'informativa — testo pronto, **non ancora pubblicato**

*12 ottobre 2026, sulle decisioni del legale dello stesso giorno.*

---

## Perché questo testo sta qui e non in `contenuti/privacy.md`

`contenuti/privacy.md` **è** la pagina `/privacy`: la legge `leggiPagina` e la
pubblica il build. Scriverci dentro e committare vuol dire pubblicare alla
prima distribuzione — e la consegna era «non pubblicarlo finché l'invio non è
provato».

Lasciarlo invece non committato in una copia di lavoro vuol dire perderlo: le
sessioni finiscono, i contenitori si riciclano, e quel testo sarebbe sparito
prima di arrivare al giorno in cui serve.

Quindi il testo sta qui, versionato e al sicuro, e la pagina resta quella di
oggi. **Quando l'invio è provato**, l'operazione è una sola: sostituire in
`contenuti/privacy.md` l'attuale punto (d) — *«Newsletter (se e quando
attivata)»* — con i due punti qui sotto, aggiornare la riga di Brevo nella
tabella dei responsabili, e committare quel file. Niente altro cambia:
l'attuale punto (c) resta com'è.

---

## (d) — da inserire al posto dell'attuale «Newsletter»

> ### d) Promemoria delle scadenze fiscali
>
> **Dati trattati.** Indirizzo email e, per chi lo richiede dal simulatore
> pubblico, i dati necessari a redigere il promemoria: regime fiscale
> dichiarato dall'interessato, accantonamento mensile calcolato, data e importo
> stimato delle due successive scadenze di versamento. È inoltre registrata la
> data dell'ultima interazione dell'interessato, al solo fine di applicare i
> termini di conservazione indicati più sotto.
>
> **Si tratta di dati di natura economica.** Pur non essendo raccolto l'importo
> del fatturato, dagli importi delle scadenze e dall'accantonamento mensile è
> possibile risalire per approssimazione al reddito dell'interessato.
>
> **Finalità.** Inviare, sette giorni prima di ciascuna delle due scadenze
> indicate, un messaggio con l'importo stimato sui dati forniti; inviare, dopo
> la conferma dell'indirizzo, il riepilogo del calcolo effettuato. Entrambi i
> messaggi contengono esclusivamente risultati, scadenze e istruzioni di
> versamento: non contengono offerte commerciali né inviti all'acquisto.
>
> **Base giuridica.** Esecuzione di un servizio richiesto dall'interessato
> (art. 6.1.b GDPR). Il servizio è richiesto spuntando l'apposita casella, non
> preselezionata, e si perfeziona con la conferma dell'indirizzo mediante
> doppio opt-in: fino alla conferma non viene inviato alcun messaggio.
> L'interessato può far cessare il servizio in qualsiasi momento tramite il
> collegamento presente in fondo a ogni messaggio, o scrivendo a
> info@flowlance.it.
>
> I dati del calcolo sono **stime dichiarate dall'interessato**, non dati
> fiscali accertati, e non sono utilizzati per finalità diverse da quelle qui
> indicate. Non sono comunicati a terzi diversi dal responsabile indicato più
> sotto, non sono incrociati con altre fonti e non alimentano alcuna
> profilazione pubblicitaria.
>
> **Conservazione.**
>
> - richieste mai confermate: cancellazione entro 30 giorni dalla richiesta,
>   comprensiva dell'indirizzo e dei dati del calcolo;
> - dati del calcolo: cancellazione entro 30 giorni dall'ultima scadenza cui si
>   riferiscono, salvo che l'interessato effettui un nuovo calcolo;
> - iscrizione al servizio: cessazione entro 30 giorni dalla fine del servizio
>   e, in ogni caso, dopo 12 mesi di inattività in assenza di scadenze future.

---

## (e) — nuovo, subito dopo

> ### e) Comunicazioni sul prodotto
>
> **Dati trattati.** Indirizzo email e data dell'ultima interazione.
>
> **Finalità.** Invio di comunicazioni relative a Flowlance: novità,
> aggiornamenti dei parametri fiscali, offerte commerciali.
>
> **Base giuridica.** Consenso dell'interessato (art. 6.1.a GDPR), **distinto e
> autonomo** rispetto al servizio di cui al punto (d) e prestato mediante una
> seconda casella, non preselezionata. **Il rifiuto di questo consenso non
> pregiudica in alcun modo il servizio di cui al punto (d)**, che resta
> ottenibile da solo. Il consenso è revocabile in qualsiasi momento, **senza
> che ciò interrompa il servizio di cui al punto (d)**, tramite il centro
> preferenze raggiungibile dal collegamento presente in fondo a ogni messaggio.
>
> **Conservazione.** 24 mesi dal consenso o dall'ultima interazione attiva
> documentabile dell'interessato (apertura di un collegamento, nuovo calcolo).
> I messaggi inviati dal Titolare non rinnovano il termine.

---

## (f) — la riga sulle prove, se il legale la vuole esplicita

> ### f) Prove dei consensi e delle revoche
>
> Data, indirizzo email e oggetto di ciascun consenso prestato o revocato, al
> solo fine di dimostrarne l'acquisizione ai sensi dell'art. 7.1 GDPR. Questi
> dati sono conservati separatamente e **non sono utilizzati per alcuna
> comunicazione**, commerciale o di servizio.
>
> **Base giuridica.** Obbligo di accountability del Titolare (art. 6.1.c in
> relazione all'art. 7.1 GDPR).

**Questa riga non va pubblicata finché non è deciso dove quelle prove stanno
davvero.** Oggi vivono dentro Brevo, legate al contatto, e il primo termine
del punto (d) cancella il contatto — cancellando anche la prova. Le due strade
sono in fondo a [`../invio-promemoria.md`](../invio-promemoria.md). Scrivere
(f) prima di aver scelto significherebbe dichiarare una conservazione separata
che non esiste.

---

## Riga della tabella dei responsabili

Quella attuale dice «invio email». Va ampliata:

> | Sendinblue SAS (Brevo) | invio email e gestione delle liste dei promemoria e delle comunicazioni sul prodotto | UE |

---

## Che cosa è cambiato rispetto alla bozza di ottobre

| | Bozza del 2 ottobre | Adesso | Perché |
| --- | --- | --- | --- |
| Base giuridica di (d) | consenso, art. 6.1.a | **esecuzione del servizio, art. 6.1.b** | decisione del legale |
| Riepilogo del calcolo | domanda aperta: servizio o marketing? | **servizio**, dentro (d) | decisione del legale |
| Conservazione | «24 mesi dall'ultimo contatto» per entrambi | **quattro termini distinti** | decisione del legale |
| Termine per i non confermati | nessuno, perché non c'era modo di eseguirlo | **30 giorni**, eseguiti da `api/pulizia.ts` | ora c'è il modo |
| Dati elencati | sei attributi | sei **più la data dell'ultima interazione** | serve a eseguire i termini: senza una data, «24 mesi da» non si può applicare |

Due cose del prodotto che la base giuridica nuova non cambia, e che conviene
sapere.

**La casella resta.** Con l'art. 6.1.b non sarebbe un consenso, ma è il modo in
cui la richiesta del servizio si manifesta e si documenta: toglierla
lascerebbe il Titolare senza prova che qualcuno abbia chiesto qualcosa.

**Il rifiuto del marketing non può impedire il servizio.** Nel prodotto era già
così — il pulsante di invio guarda solo la prima casella — e un test lo
verifica. Con le due basi giuridiche separate smette di essere una cortesia e
diventa un obbligo.
