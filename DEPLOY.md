# Mettere Flowlance online

*Ultimo aggiornamento: 10 settembre 2026.*

Il sito va online **con il noindex ancora attivo**: si pubblica per vedere che
tutto regga in rete, non per farsi trovare. Chi apre l'indirizzo vede il sito
vero; i motori di ricerca no.

---

## Cosa c'è già, e non va toccato

- `next.config.ts` esporta un sito statico (`output: "export"`): nessun runtime
  server, nessuna API, nessun segreto nel bundle. È la scelta che rende vero il
  «local-first», e vale anche in produzione.
- `vercel.json` dice a Vercel di trattare la cartella `out/` come un sito
  statico e basta, senza il costruttore Next.js. Vedi più sotto perché.
- `src/lib/sito/impostazioni.ts` tiene `CHIUSO_AI_MOTORI = true`. Da lì
  discendono il `robots.txt` e il `<meta name="robots">` di ogni pagina: si
  cambia una riga sola, il giorno che si apre.

---

## La trappola: `npm run build` non gira su Vercel

Il comando del progetto è

```
next build
  && node strumenti/timbra-artefatto.mjs
  && node strumenti/verifica-link.mjs
  && node strumenti/verifica-offerta.mjs
```

e il terzo pezzo apre un **Chromium** per controllare che nessun link interno
sia morto. Su Vercel quel binario non c'è: lo script esce con codice 1 e la
build fallisce, dopo che `next build` è andato a buon fine — cioè con un errore
che sembra un problema del sito e non lo è.

Per questo `vercel.json` fissa `buildCommand: "next build"`. Le verifiche in
coda restano il cancello locale, dove il browser c'è: si passa da lì prima di
spingere, non dopo. Vale anche per `verifica-offerta.mjs`, che un browser non
lo apre ma legge `out/` insieme al suo timbro, e quindi vuole il build appena
fatto.

Per la stessa ragione `framework: null`: non c'è niente da far girare lato
server, e il costruttore Next.js di Vercel aggiungerebbe un livello che questo
progetto non usa. `out/` contiene già `privacy/index.html`, `termini/index.html`
e tutti gli altri — `trailingSlash: true` in `next.config.ts` — che qualunque
hosting statico serve com'è.

---

## I passi, in ordine

### 1 · Prima di spingere, in locale

```sh
npm run test
npm run build                 # comprende la verifica dei link
npm run verifica:derivati     # i conti delle formule del prospetto
npm run verifica:allineamento # i totali sotto la colonna che sommano
```

Se uno dei tre non passa, il deploy aspetta.

### 2 · Il progetto su Vercel

Collegare il repository, e **non toccare i campi** «Build Command», «Output
Directory» e «Framework Preset» nell'interfaccia: `vercel.json` li decide, e un
valore scritto anche nel pannello è una seconda copia che prima o poi diverge da
questa. Se il pannello mostra valori diversi, quelli giusti sono nel file.

Prima distribuzione sull'indirizzo `*.vercel.app`. Da controllare lì, prima del
dominio:

- `/` si apre e la pagina di vendita è quella giusta;
- `/privacy/`, `/termini/`, `/cookie/`, `/cosa-non-calcola/`, `/grazie/`
  rispondono;
- `/app/` apre l'applicazione e l'archivio si crea;
- `curl -s <indirizzo>/robots.txt` risponde `Disallow: /`;
- il sorgente di `/` contiene `<meta name="robots" content="noindex, nofollow">`.

### 3 · Il dominio, su Vercel

Aggiungere `flowlance.it` e `www.flowlance.it` al progetto. Vercel, subito dopo,
mostra i valori DNS da scrivere: **un record A per il dominio nudo e un CNAME
per il `www`**.

> Quei valori si leggono dal pannello di Vercel, in quel momento, e si copiano
> da lì. Non si prendono da un appunto, da una guida o da questo file: Vercel li
> ha già cambiati in passato e un indirizzo IP vecchio manda il dominio in un
> posto che non risponde, per il tempo che ci vuole a scoprirlo.

### 4 · Il DNS, su Aruba

Nel pannello Aruba, sezione DNS del dominio:

- il record **A** del dominio nudo (`@`) sul valore che Vercel ha mostrato;
- il record **CNAME** di `www` sul nome che Vercel ha mostrato.

Poi si aspetta. La propagazione va da qualche minuto a qualche ora; Vercel
segna il dominio «Valid» da solo quando la vede, e il certificato HTTPS lo
richiede senza che nessuno debba chiederglielo.

### 5 · A dominio attivo

- `https://flowlance.it/` e `https://www.flowlance.it/` rispondono tutti e due,
  in HTTPS;
- `https://flowlance.it/robots.txt` dice ancora `Disallow: /`;
- `npm run verifica:link` non serve qui: gira sul sito costruito in locale, ed è
  lo stesso.

---

## Il sito è aperto ai motori

Dal **10 settembre 2026**: `CHIUSO_AI_MOTORI = false` in
`src/lib/sito/impostazioni.ts`. Da quella riga discendono insieme il
`robots.txt`, il `<meta name="robots">` di ogni pagina e la `sitemap.xml`. Non
c'è nient'altro da ricordarsi, ed è il motivo per cui è una costante sola —
`metadati.test.ts` verifica che le tre facce dicano la stessa cosa in tutti e
due gli stati.

È stato l'ultimo gesto, ed è arrivato **dopo un acquisto vero**: pagamento con
una carta vera, IVA, dati fiscali, codice SDI, ricevuta al cliente, notifica al
Fornitore, e il rimborso. Un checkout che funziona in ogni sua parte presa da
sola e non funziona insieme è esattamente il difetto che questo progetto
continua a incontrare, e l'unico modo di escluderlo era percorrerlo.

Per richiuderlo, se mai servisse, si rimette `true` e si ricostruisce: `/app` e
`/grazie` restano fuori dagli indici in tutti e due gli stati.

Un presidio tiene la combinazione impossibile: `next.config.ts` ferma un build
di produzione in cui il sito è aperto ai motori e `PAYMENT_LINK` vale ancora
`"DA-CREARE"` — un sito che si fa trovare e poi chiede di scrivere una mail per
comprare. Da quando il collegamento esiste, quel presidio è a riposo: c'è per il
giorno in cui qualcuno reimposta il segnaposto senza rimettere il noindex.

---

## I promemoria delle scadenze (Brevo) — **spenti**

Il simulatore può raccogliere iscrizioni ai promemoria delle scadenze. Oggi la
cosa è **spenta a due mandate**, e resta spenta finché l'informativa privacy non
descrive i dati che partono.

| Interruttore | Dove | Cosa decide |
| --- | --- | --- |
| `PROMEMORIA_ATTIVI` | `src/lib/sito/impostazioni.ts` | **Cosa si vede.** A `false` la pagina non mostra nessun modulo: al suo posto l'uscita verso la demo, e la barra fissa del telefono porta là. |
| Le tre variabili qui sotto | Vercel | **Cosa può succedere.** Se ne manca una, `api/promemoria.ts` risponde «non ancora attivi» e non contatta nessuno. |

I due sono indipendenti di proposito: un modulo a schermo che raccoglie
un'email per poi dire che non è il momento è una promessa presa e non
mantenuta.

### Che cosa configurare su Brevo

1. **Due liste**, non una. Servono i loro id numerici.
   - *Promemoria scadenze* — ci entra chiunque confermi l'indirizzo.
   - *Comunicazioni Flowlance* — ci entra solo chi ha spuntato anche la
     seconda casella.

   Sono due e non un attributo «marketing: sì/no» perché **la disiscrizione
   deve poter essere separata**: da un'email commerciale si esce senza
   perdere i promemoria. Con una lista sola, il collegamento di disiscrizione
   in fondo a una promozione avrebbe spento anche un servizio che la persona
   aveva chiesto.
2. Il **centro preferenze** di Brevo (*Contacts → Forms → Preference centre*),
   con le due liste visibili e spuntabili, impostato come destinazione del
   collegamento di disiscrizione. È la parte della disiscrizione granulare che
   **non è codice nostro**: senza, il collegamento toglie il contatto da tutto.
3. Un **modello di email di doppio opt-in** (*Campaigns → Templates*, tipo
   «Double opt-in confirmation»). Dentro, il collegamento di conferma si scrive
   con il segnaposto `{{ params.DOIurl }}`. Serve il suo id numerico.
4. I **sei attributi di contatto**, in *Contacts → Settings → Contact
   attributes*, con questi nomi esatti:

   | Attributo | Tipo |
   | --- | --- |
   | `REGIME` | testo |
   | `ACCANTONAMENTO_MESE` | numero |
   | `SCAD_1_DATA` | data |
   | `SCAD_1_IMPORTO` | numero |
   | `SCAD_2_DATA` | data |
   | `SCAD_2_IMPORTO` | numero |

   Un attributo che in Brevo non esiste fa fallire la chiamata intera: il
   contatto non viene creato e chi si iscrive vede l'errore. Vanno creati
   **prima** di accendere.

   **`FATTURATO_STIMATO` non c'è più**, e non va creato: non entrava in
   nessuna email e non decideva niente. Quello che resta permette comunque di
   risalire al reddito — da un acconto di 5.329,48 € in forfettario si arriva
   a circa 40.000 € di fatturato — quindi l'informativa deve descriverlo lo
   stesso.
5. Una **chiave API** (*SMTP & API → API Keys*), con i soli permessi sui
   contatti.

`SCAD_2_*` resta vuoto quando di appuntamenti ce n'è uno solo — primo anno di
attività, o sotto la soglia degli acconti. Il modello dell'email deve reggere
quel caso senza stampare una data vuota.

**Nessun termine di scadenza per i non confermati, per ora.** Brevo non
cancella da solo i contatti che non hanno confermato, e qui non c'è niente che
giri ogni notte: la funzione risponde a una richiesta e muore. Finché non si
decide fra pulizia manuale e cron esterno, l'informativa **non deve promettere
un termine** — una promessa di cancellazione che nessuno esegue è peggio di
nessuna promessa.

### Che cosa configurare su Vercel

*Project → Settings → Environment Variables*, tutte e tre senza
`NEXT_PUBLIC_` (non devono entrare in nessun bundle):

```
BREVO_API_KEY           = xkeysib-…
BREVO_LISTA_PROMEMORIA  = <id numerico della lista dei promemoria>
BREVO_LISTA_MARKETING   = <id numerico della lista delle comunicazioni>
BREVO_TEMPLATE_DOI      = <id numerico del modello>
CRON_SECRET             = <una stringa lunga a caso>
BLOB_READ_WRITE_TOKEN   = <lo dà Vercel collegando il magazzino Blob>
```

`CRON_SECRET` la usa `api/pulizia.ts`: Vercel firma con quella le chiamate di
cron, e senza la funzione risponde 401. È un indirizzo pubblico che cancella
dati — senza segreto non si apre. **Il permesso della chiave Brevo deve
includere la scrittura sui contatti**, non solo la creazione: la pulizia
aggiorna attributi, toglie da liste e cancella.

Tutte e quattro sono obbligatorie. Se manca quella del marketing la funzione
risponde «non attivi» **anche** a chi aveva spuntato solo i promemoria: è
voluto. L'alternativa sarebbe iscrivere alla sola lista dei promemoria chi
aveva spuntato tutte e due, cioè accettare un consenso e non registrarlo — un
errore che non si vedrebbe né da chi si iscrive né dai numeri.

Niente altro da configurare: `api/promemoria.ts` è una funzione Vercel fuori da
Next, e Vercel compila `/api/*` senza configurazione anche con `framework: null`
e l'output statico in `out/`. L'export statico resta quello di prima.

### Provarlo in locale, prima del deploy

`next dev` **non esegue** quella funzione: non è una route di Next, e con
`output: "export"` un route handler in POST dopo il build non esisterebbe. Ci
sono due strade, in ordine di fatica:

1. **La griglia, che prova tutto tranne la firma.** La logica sta in
   `src/lib/sito/promemoria-server.ts` e gira con un `fetch` finto:

   ```sh
   npx vitest run src/lib/sito/promemoria-server.test.ts
   npx vitest run src/lib/sito/promemoria.test.ts
   ```

   Qui si vede che cosa viene mandato a Brevo, che la chiave non finisce nel
   corpo, che senza configurazione non parte niente, e che un 400 di Brevo
   diventa un errore leggibile e non un «fatto».

2. **La funzione vera**, con `npx vercel dev` e un `.env.local` con le tre
   variabili. È l'unico modo di provare la firma `Request → Response` e il
   percorso `/api/promemoria`, che con `trailingSlash: true` potrebbe
   rispondere con un rimando: se succede, si fissa il percorso che risponde
   diretto in `API` dentro `src/lib/rotte.ts`. Meglio ancora, una
   distribuzione di anteprima: `originiAmmesse` ammette già `VERCEL_URL`.

### Conservazione — **i termini sono decisi**

Decisi dal legale il 12 ottobre 2026. Li esegue `api/pulizia.ts`, che Vercel
Cron chiama una volta al giorno (voce `crons` in `vercel.json`).

| | Che cosa | Termine, da quando | Azione |
| --- | --- | --- | --- |
| 1 | Iscrizioni mai confermate | **30 giorni** dalla richiesta | cancella il contatto |
| 2 | Dati del calcolo | **30 giorni** dall'ultima scadenza del calcolo, salvo nuovo calcolo | svuota `SCAD_1_*` e `SCAD_2_*` |
| 3 | Lista promemoria | con il caso 2, **e comunque 12 mesi** senza attività se non restano scadenze future | toglie dalla lista |
| 4 | Lista marketing | **24 mesi** dal consenso o dall'ultima interazione attiva documentabile | toglie dalla lista |

«Ultima scadenza del calcolo» è `SCAD_2_DATA`, **oppure `SCAD_1_DATA` quando la
seconda è vuota** — nel primo anno di attività e sotto la soglia degli acconti
di appuntamenti ce n'è uno solo.

I nostri invii **non** rinnovano il termine 4: lo rinnovano solo un clic o un
nuovo calcolo, e per questo l'orologio sta in un attributo suo,
`ULTIMA_ATTIVITA`, che la pulizia non tocca mai. Appoggiarlo a `modifiedAt`
avrebbe voluto dire che la pulizia del caso 2 rinnova il termine del caso 4, e
quei contatti non sarebbero usciti mai.

Il progetto completo — cosa sta sul pannello e cosa nel codice — è in
[`docs/invio-promemoria.md`](docs/invio-promemoria.md).

#### I tre archivi degli eventi, e per quanto restano

Sono **tre e distinti**, perché hanno tre finalità e tre basi giuridiche
diverse. Stanno tutti fuori da Brevo, nello stesso magazzino di file (Vercel
Blob) ma sotto tre prefissi che li tengono separati anche a guardarli da fuori.

| Archivio | Prefisso | Che cosa ci finisce | Finalità e base | Conservazione |
| --- | --- | --- | --- | --- |
| Probatorio dei consensi marketing | `consensi-marketing/` | consenso, revoca | dimostrare consenso e revoca (art. 7.1; rendicontazione, art. 6.1.c) | durata del trattamento **+ 5 anni** dalla cessazione |
| Eventi del servizio promemoria | `servizio-promemoria/` | richiesta, attivazione, disattivazione | provare che il servizio è stato chiesto e fino a quando è stato prestato (punto d, art. 6.1.b; prova e difesa, art. 6.1.f) | durata del trattamento **+ 5 anni** dalla cessazione |
| Elenco di esclusione | `esclusione/` | **solo** l'indirizzo di chi si è disiscritto | non scrivere più a chi ha chiesto di non essere scritto (artt. 21 e 17) | **senza termine**, finché partono comunicazioni: cancellarlo vorrebbe dire ricominciare a scrivergli |

Due regole che il codice tiene da sé, e che valgono quanto la tabella:

- **gli eventi del servizio non si chiamano consenso né revoca.** Si chiamano
  richiesta, attivazione, disattivazione, e `npm run verifica:registro`
  fallisce se uno di quei nomi contiene una delle due parole. Un registro che
  chiamasse «revoca» la fine di un servizio direbbe, agli atti, che quel
  trattamento si fondava su un consenso — e quindi che tutti i promemoria
  mandati a chi non aveva spuntato nessuna casella erano senza base;
- **ogni evento porta la versione del testo dei consensi e la sua impronta.**
  Il testo integrale di ogni versione è archiviato in
  `src/lib/sito/testi-consensi.ts`, e l'impronta la calcola il codice: da una
  registrazione si risale al documento che la persona aveva davanti, e si
  verifica che non sia stato toccato dopo.

Il termine di cinque anni **non è un obbligo del GDPR** ed è una scelta
motivata del Titolare: la motivazione, da rileggere, sta in
[`docs/legale/proporzionalita-prove.md`](docs/legale/proporzionalita-prove.md).
In caso di contestazione la cancellazione si sospende per quell'indirizzo —
elenco `BLOCCHI`, con il motivo scritto accanto — e riprende quando la
contestazione è definita.

#### Le tre verifiche chieste, e come sono andate

**Non ho potuto aprire nessuna delle due documentazioni.** Da questo ambiente
il proxy di rete nega `vercel.com`, `developers.brevo.com`, `help.brevo.com` e
`api.brevo.com` — risposta 403 al CONNECT. Quello che segue viene dagli
estratti di ricerca di quelle stesse pagine. Va riletto prima di accendere.

**(a) Vercel Cron, disponibilità e frequenza — NON VERIFICATO.**
Le fonti secondarie concordano su un punto: sul piano **Hobby** i cron sono
limitati a **una volta al giorno**, e un orario più fitto fa fallire il deploy
con «Hobby accounts are limited to daily Cron Jobs». Sul numero di job per
piano le fonti si contraddicono (2 su Hobby; 40, «illimitati», o 100 su Pro a
seconda della fonte). Concordano anche su due dettagli che qui contano: le
chiamate possono arrivare **fino a 59 minuti in ritardo**, e i cron girano
**solo sulle distribuzioni di produzione**, in UTC, **senza ritentativi**.

Il piano attuale del progetto non lo so: **vallo a vedere tu**. Una volta al
giorno basta a tutti e quattro i termini, quindi anche Hobby regge — ma se il
piano non prevede cron per niente, il ripiego sta più sotto.

L'orario è `20 3 * * *`, cioè le 3:20 UTC: non in punto, perché gli orari
tondi sono quelli su cui si accalca tutto il mondo e il ritardo di
cinquantanove minuti diventa più probabile.

**(b) Elencare e cancellare i non confermati del doppio opt-in — NON VERIFICATO.**
Le fonti si contraddicono sul fatto stesso che un contatto esista prima della
conferma: una guida di terzi parla di uno stato «pending» non visibile fra i
contatti; una risposta nel forum di Brevo dice che senza conferma il contatto
«non è salvato» e i suoi attributi non sono disponibili; il centro assistenza
descrive invece una lista temporanea, che implica un contatto esistente.

**Il codice è costruito per non dipendere dalla risposta.** La pulizia non
cerca un campo «non confermato»: cerca i contatti che non stanno in **nessuna**
delle due liste, perché le liste si popolano solo dopo la conferma. Se Brevo
non li espone affatto, non c'è niente da cancellare e il termine è rispettato
da solo; se li espone, la pulizia li trova. Da verificare sul pannello quale
dei due mondi è il nostro.

**(c) Data dell'ultimo clic per contatto — NON VERIFICATO, e probabilmente no.**
`GET /v3/contacts/:identifier` restituisce `createdAt`, `modifiedAt` e un
oggetto `statistics`, ma **le statistiche coprono gli ultimi 90 giorni**, e
`GET /v3/contacts/:identifier/campaignStats` accetta un intervallo di **al
massimo 90 giorni**. Il termine del marketing è di **24 mesi**: leggere un clic
di diciotto mesi fa vorrebbe dire otto chiamate paginate per contatto, ogni
notte. Non è una strada.

Per questo il clic lo registra **un'automazione di Brevo** che scrive
`ULTIMA_ATTIVITA`, e la pulizia legge quell'attributo. Finché l'automazione
non esiste il termine conta solo dal consenso e dai nuovi calcoli, cioè
cancella **prima** del dovuto: prudente, ma da sapere.

#### I ripieghi manuali, se la funzione non si può accendere

Settimanali, non mensili: i termini più stretti sono di trenta giorni, e un
giro mensile li sfonda di quasi una settimana nel caso peggiore. Ogni lunedì,
sul pannello di Brevo:

| | Filtro | Azione |
| --- | --- | --- |
| 1 | contatti in nessuna delle due liste, creati da oltre 30 giorni | cancella |
| 2 e 3 | `SCAD_2_DATA` (o `SCAD_1_DATA` se vuota) anteriore a 30 giorni fa | svuota le quattro voci, togli dai promemoria |
| 3 bis | in lista promemoria, senza date, `ULTIMA_ATTIVITA` oltre 12 mesi | togli dalla lista |
| 4 | in lista marketing, `ULTIMA_ATTIVITA` oltre 24 mesi | togli dalla lista |

Vale anche come rete di sicurezza quando la funzione c'è: i cron di Vercel non
ritentano, e una notte saltata non si recupera da sola. Il giro del lunedì la
recupera.

#### Le prove di consenso: **manca una decisione, non del codice**

Il legale chiede una conservazione minima separata delle prove di consenso e
delle revoche, non utilizzabile per il marketing. Oggi quelle prove stanno
dentro Brevo, legate al contatto, e il caso 1 **cancella il contatto** — cioè
cancella anche la prova che qualcuno aveva chiesto e poi non confermato.

Due strade, nessuna costruita, descritte in fondo a
[`docs/invio-promemoria.md`](docs/invio-promemoria.md). Va deciso prima di
accendere: il giorno dopo, le prime prove cominciano a scadere.


### Quando accendere

1. L'informativa privacy descrive i sei attributi, `ULTIMA_ATTIVITA`, le due
   finalità separate e i quattro termini. Il testo pronto è in
   [`docs/legale/privacy-punti-d-e.md`](docs/legale/privacy-punti-d-e.md) e
   **non è ancora dentro `contenuti/privacy.md`**.
2. Liste, attributi, modello e automazioni sono sul pannello, annotati in
   [`docs/invio-promemoria.md`](docs/invio-promemoria.md).
3. Le cinque variabili sono su Vercel, e l'iscrizione di prova arriva davvero.
4. `GET /api/pulizia?prova=1` gira e il resoconto torna sensato — **prima** di
   lasciarla cancellare qualcosa.
5. Il magazzino delle prove (Vercel Blob) è collegato al progetto e
   `BLOB_READ_WRITE_TOKEN` è fra le variabili. Il termine di conservazione
   **c'è** — cinque anni dalla cessazione, `CONSERVAZIONE_PROVE` in
   `src/lib/sito/registro-prove.ts` — ma il controllo che impedisce alla
   pulizia di partire senza un termine utilizzabile resta attivo a ogni
   esecuzione.
6. **Il webhook della conferma**, su Brevo, verso un indirizzo che registri
   l'evento di attivazione. Finché non c'è, l'archivio del servizio sa che
   qualcuno ha *richiesto* i promemoria e non sa dire **quando li ha
   confermati**: la conferma avviene sui server di Brevo e da qui non si vede.
   Registrarla dal rimando del clic è escluso — quell'indirizzo lo può aprire
   chiunque, e una prova che chiunque può fabbricare non è una prova. Vedi
   [`docs/invio-promemoria.md`](docs/invio-promemoria.md).
7. Solo allora `PROMEMORIA_ATTIVI = true` in `src/lib/sito/impostazioni.ts`.

> ### Invio, pulizia e registro delle prove si accendono **insieme**
>
> Mai uno senza gli altri. Non è una raccomandazione: ciascuno dei tre, da
> solo, produce un danno che gli altri due impediscono.
>
> | Acceso da solo | Che cosa succede |
> | --- | --- |
> | **Invio** senza pulizia | il trigger a data di Brevo ignora l'anno: chi non rifà il calcolo riceve ogni anno lo stesso promemoria con l'importo vecchio, per sempre. È la pulizia che gli toglie la data da sotto. |
> | **Invio** senza registro | i contatti si accumulano e nessun termine li tocca: l'informativa promette cancellazioni che non avvengono. |
> | **Pulizia** senza registro | si cancella il contatto **e** la prova che quella persona aveva chiesto qualcosa: si resta senza il dato e senza la prova di averlo trattato legittimamente. Per questo la pulizia si rifiuta di partire se il termine delle prove non è un numero utilizzabile — ma il rifiuto è una rete, non un permesso di accendere a metà. |
> | **Registro** senza gli altri due | non fa danno, e non serve a niente: non c'è nessun evento da registrare. |
>
> L'ordine di accensione è quello della lista qui sopra: prima il magazzino
> delle prove e il termine confermato, poi la pulizia in prova, poi l'invio.

---

## Prima di spingere, sempre

```sh
npm run test
npm run build                 # timbra out/, verifica i link e l'offerta contro i Termini
npm run verifica:derivati     # i conti delle formule, i pulsanti, i prezzi
npm run verifica:allineamento # i totali sotto la colonna che sommano
npm run verifica:consenso     # niente misurazione prima del sì, mai su /app
```

Le verifiche che aprono `out/` si **rifiutano di partire** se il sorgente è
cambiato dopo l'ultimo build riuscito: `npm run build` lascia un timbro in
`.artefatto.json`, e chi misura lo confronta. Serve perché è già capitato di
leggere verde su una cartella rimasta da un build fallito — vedi
`strumenti/LEGGIMI.md`, alla voce `artefatto.mjs`.

---

## Cosa resta fuori da questo documento

Il **checkout** è deciso e in piedi: pagina ponte, Payment Link, chiave a mano.
Quello che resta — la notifica di Stripe, le due email, l'acquisto di prova —
sta in [`CHECKOUT.md`](CHECKOUT.md), sotto «Cosa resta da fare, in ordine».
