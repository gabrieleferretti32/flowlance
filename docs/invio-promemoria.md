# L'invio dei promemoria: cosa sta sul pannello, cosa sta nel codice

*12 ottobre 2026. L'invio **non è ancora acceso**: `PROMEMORIA_ATTIVI` è
`false` in `src/lib/sito/impostazioni.ts` e le variabili d'ambiente non sono
configurate. Questo documento è il progetto, non il resoconto.*

Le decisioni legali che lo governano sono del 12 ottobre 2026 e stanno qui
sotto, riga per riga, perché il codice le implementa e non le ridiscute.

---

## Il confine, in una tabella

| | Dove vive | Chi lo fa |
| --- | --- | --- |
| Raccolta dell'iscrizione, doppio opt-in, due consensi | **codice** | `api/promemoria.ts` |
| Email di conferma (modello, testo, link) | **pannello Brevo** | tu |
| Email di riepilogo del calcolo | **pannello Brevo** | tu |
| Promemoria a −7 giorni dalle due scadenze | **pannello Brevo** | tu |
| Centro preferenze e disiscrizione granulare | **pannello Brevo** | tu |
| Esecuzione dei termini di conservazione | **codice** | `api/pulizia.ts`, ogni notte |

La riga che conta è la terz'ultima: **l'invio è tutto sul pannello.** Il codice
scrive gli attributi e se ne va. Chi legge quegli attributi per mandare
qualcosa è Brevo, e nessun file di questo repository lo descrive — perciò
questo documento, e perciò la sezione «Da annotare quando esisterà» in fondo.

---

## Quello che configuri tu, in ordine

### 1 · Le due liste

- **Promemoria scadenze** — ci entra chiunque confermi l'indirizzo.
- **Comunicazioni Flowlance** — ci entra solo chi ha spuntato la seconda
  casella.

Due liste e non un attributo «marketing: sì/no», perché la disiscrizione deve
poter essere separata. Gli id numerici vanno in `BREVO_LISTA_PROMEMORIA` e
`BREVO_LISTA_MARKETING`.

### 2 · Gli attributi di contatto

Sei li manda il browser, uno lo scrive il server.

| Attributo | Tipo | Chi lo scrive |
| --- | --- | --- |
| `REGIME` | testo | il browser |
| `ACCANTONAMENTO_MESE` | numero | il browser |
| `SCAD_1_DATA` | **data** | il browser |
| `SCAD_1_IMPORTO` | numero | il browser |
| `SCAD_2_DATA` | **data** | il browser |
| `SCAD_2_IMPORTO` | numero | il browser |
| `ULTIMA_ATTIVITA` | **data** | `api/promemoria.ts`, e le automazioni del clic |

`SCAD_1_DATA` e `SCAD_2_DATA` **devono essere di tipo data**, non testo: ci si
appoggia il trigger dei promemoria. `ULTIMA_ATTIVITA` pure, perché ci si
appoggia la conservazione.

Un attributo che in Brevo non esiste fa fallire l'iscrizione intera: vanno
creati prima di accendere.

### 3 · Il modello della conferma (doppio opt-in)

*Campaigns → Templates*, tipo «Double opt-in confirmation». Il collegamento di
conferma si scrive con `{{ params.DOIurl }}`. L'id va in
`BREVO_TEMPLATE_DOI`.

**Non deve contenere offerte né inviti all'acquisto**: fino alla conferma non
c'è nessun consenso al marketing, e la seconda casella può essere rimasta
vuota.

### 4 · L'automazione del riepilogo — **servizio, non marketing**

> **Decisione del legale.** Il riepilogo del calcolo è parte del servizio
> (punto d), non una comunicazione commerciale. Parte **dopo** la conferma del
> doppio opt-in, e parte **anche a chi non ha dato il consenso marketing**.
> Contiene solo risultati, scadenze e istruzioni: nessuna offerta, nessun
> invito all'acquisto.

Quindi:

- **Trigger:** contatto aggiunto alla lista *Promemoria scadenze*. Quella
  lista si popola solo dopo la conferma, quindi è il momento giusto — e non
  guarda la lista marketing, che è esattamente il punto.
- **Contenuto:** `ACCANTONAMENTO_MESE`, le due scadenze con date e importi, e
  come si versa. Niente prezzo, niente «scopri Flowlance», niente pulsanti
  verso `/acquista`.
- Un invito all'acquisto dentro questa email sposterebbe il trattamento sotto
  il punto (e), che ha un'altra base giuridica e un altro consenso. Non è una
  questione di tono: è la differenza fra eseguire un servizio e fare
  pubblicità a chi ha detto di no.

### 5 · Le automazioni dei promemoria, a −7 giorni

Due automazioni gemelle, trigger a data (*Anniversary*):

| | Attributo | Quando |
| --- | --- | --- |
| Promemoria 1 | `SCAD_1_DATA` | 7 giorni **prima** |
| Promemoria 2 | `SCAD_2_DATA` | 7 giorni **prima** |

Condizione su entrambe: il contatto è nella lista *Promemoria scadenze*.

**Il trigger a data ignora l'anno** — i contatti rientrano ogni anno nella
stessa giornata. Qui non fa danno, per una ragione precisa: la pulizia notturna
**svuota** `SCAD_1_*` e `SCAD_2_*` trenta giorni dopo l'ultima scadenza, e un
attributo data vuoto non fa scattare niente. È il motivo per cui i due pezzi —
invio e pulizia — vanno accesi insieme: con l'invio acceso e la pulizia spenta,
un contatto che non rifà mai il calcolo riceverebbe ogni anno, per sempre, lo
stesso promemoria con l'importo di quel giorno.

Che un attributo data vuoto davvero non faccia scattare il trigger **non è
verificato** — vedi `DEPLOY.md`. È la prima cosa da provare sul pannello.

### 6 · Il centro preferenze

*Contacts → Forms → Preference centre*, con le due liste visibili e
spuntabili, impostato come destinazione del collegamento di disiscrizione.
Senza, il collegamento toglie il contatto da tutto — e spegnerebbe un servizio
chiesto per rifiutare una pubblicità.

### 7 · Il clic che rinnova il termine del marketing

> **Decisione del legale.** La lista marketing si conserva 24 mesi dal consenso
> o dall'ultima interazione **attiva documentabile** (clic, nuovo calcolo).
> **I nostri invii non rinnovano.**

Un nuovo calcolo lo gestisce il codice: `api/promemoria.ts` riscrive
`ULTIMA_ATTIVITA` a ogni iscrizione, e una reiscrizione è un nuovo calcolo.

Il clic no: lo vede solo Brevo. Serve un'automazione — trigger «link cliccato»,
azione *Update contact attribute* che scrive `ULTIMA_ATTIVITA` alla data del
giorno. **Finché non esiste, il termine dei 24 mesi conta solo dal consenso e
dai nuovi calcoli**, cioè cancella prima del dovuto: è il verso prudente, ma va
saputo.

---

## Quello che fa il codice

### L'iscrizione — `api/promemoria.ts`

Già costruito e provato. Chiama
`POST /v3/contacts/doubleOptinConfirmation` con i sei attributi del browser,
più `ULTIMA_ATTIVITA` scritto dal server, e con `includeListIds` che contiene
la lista marketing **solo** se la seconda casella era spuntata.

> **Decisione del legale.** La base giuridica del punto (d) è l'esecuzione del
> servizio (art. 6.1.b), non il consenso. Il consenso (art. 6.1.a) resta solo
> per il punto (e).
>
> Il codice non cambia: la casella «voglio i promemoria» resta, perché è il
> modo in cui la richiesta del servizio si manifesta e si documenta. Cambia
> l'informativa, e cambia una cosa pratica — il rifiuto del marketing non può
> in nessun caso impedire il servizio, che era già vero e ora è obbligato.

### La pulizia — `api/pulizia.ts`, ogni notte

| | Che cosa | Termine | Che cosa fa |
| --- | --- | --- | --- |
| 1 | Iscrizioni mai confermate | 30 giorni dalla richiesta | cancella il contatto |
| 2 | Dati del calcolo | 30 giorni dall'ultima scadenza | svuota `SCAD_1_*` e `SCAD_2_*` |
| 3 | Lista promemoria | con il caso 2, e comunque 12 mesi senza attività se non restano scadenze | toglie dalla lista |
| 4 | Lista marketing | 24 mesi dal consenso o dall'ultima attività | toglie dalla lista |

Tre cose che il codice fa e che vale la pena sapere:

- **«Mai confermata» si riconosce dall'assenza dalle liste**, non da un campo
  di Brevo. Le liste si popolano solo dopo la conferma, quindi un contatto in
  nessuna delle due non ha mai confermato. Vale comunque Brevo rappresenti i
  contatti in attesa — che è una cosa non verificata, vedi `DEPLOY.md`.
- **L'ultima scadenza è `SCAD_2_DATA`, oppure `SCAD_1_DATA` se la seconda è
  vuota.** Nel primo anno di attività, e sotto la soglia degli acconti,
  `SCAD_2_*` è vuoto fin dall'inizio: una pulizia ancorata solo alla seconda
  non scatterebbe mai per quei contatti.
- **La pulizia non scrive mai `ULTIMA_ATTIVITA`.** Se lo facesse rinnoverebbe
  il termine del marketing proprio mentre fa pulizia, e quei contatti non
  uscirebbero mai. Un test lo verifica.

Si prova senza cancellare niente: `GET /api/pulizia?prova=1` con
l'intestazione `Authorization: Bearer $CRON_SECRET` decide tutto ed esegue
niente.

---

## Da annotare qui quando esisterà

Oggi nessun file del repository descrive l'invio, perché l'invio non c'è.
Quando le automazioni saranno sul pannello, qui vanno scritte: **nome
dell'automazione, trigger, attributo, condizioni**. Senza, fra sei mesi
l'unico modo di sapere perché a qualcuno è arrivata un'email sarà aprire Brevo
e dedurlo.

- [ ] Riepilogo — trigger: … · condizione: …
- [ ] Promemoria 1 — trigger: … su `SCAD_1_DATA` · condizione: …
- [ ] Promemoria 2 — trigger: … su `SCAD_2_DATA` · condizione: …
- [ ] Clic → `ULTIMA_ATTIVITA` — trigger: … · azione: …
- [ ] Verificato che un attributo data vuoto non fa scattare il trigger: …

---

## Quello che resta aperto, e non è codice

**Le prove di consenso.** Il legale chiede una conservazione minima separata
delle prove di consenso e delle revoche, non utilizzabile per il marketing.
Oggi quelle prove stanno **dentro Brevo**, legate al contatto — e il caso 1
della pulizia cancella il contatto. Cancellando il contatto si cancella anche
la prova che aveva chiesto e poi non confermato.

Non è un difetto del codice: è una decisione che manca. Le strade sono due, e
nessuna delle due è costruita:

1. **Un registro separato**, scritto dalla funzione di iscrizione: data,
   indirizzo in forma non identificabile, quale consenso. Vuol dire un archivio
   che oggi non esiste, cioè la cosa che questo prodotto ha scelto di non
   avere.
2. **L'esportazione periodica** dei log di Brevo, tenuta fuori dal sistema di
   invio. Manuale, e quindi con lo stesso difetto dei termini manuali: dipende
   da qualcuno che si ricorda.

Va deciso prima di accendere, perché il giorno dopo averlo acceso le prime
prove cominciano a scadere.
