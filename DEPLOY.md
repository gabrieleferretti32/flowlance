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
next build && node strumenti/verifica-link.mjs
```

e il secondo pezzo apre un **Chromium** per controllare che nessun link interno
sia morto. Su Vercel quel binario non c'è: lo script esce con codice 1 e la
build fallisce, dopo che `next build` è andato a buon fine — cioè con un errore
che sembra un problema del sito e non lo è.

Per questo `vercel.json` fissa `buildCommand: "next build"`. La verifica dei
link resta il cancello locale, dove il browser c'è: si passa da lì prima di
spingere, non dopo.

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
```

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

### Conservazione — **tre termini da decidere**

I termini li decide il legale. Qui sta il resto: che cosa va cancellato, e come
si eseguirebbe. **Niente di tutto questo è costruito**, e nessun termine va
scritto nell'informativa finché non si sa come rispettarlo — una cancellazione
promessa e non eseguita è peggio di nessuna promessa.

| | Che cosa | Termine | Cosa andrebbe fatto |
| --- | --- | --- | --- |
| 1 | I dati del calcolo, dopo l'ultima scadenza | *da decidere* | svuotare i sei attributi; il contatto resta iscritto |
| 2 | Indirizzi confermati e inattivi | *da decidere* | cancellare il contatto |
| 3 | Indirizzi mai confermati | *da decidere* | cancellare il contatto |

Il primo è diverso dagli altri due e conviene non confonderlo: **non è una
disiscrizione**. Passato il 30 giugno a cui si riferiscono, `SCAD_2_DATA` e il
suo importo non servono più a niente — il promemoria è già partito — e tenerli
vuol dire tenere un dato economico oltre la sua utilità. Svuotarli non toglie
nessuno dalla lista: chi tornasse sul simulatore e si reiscrivesse li
riscriverebbe aggiornati.

#### Cosa sa fare Brevo da solo

Verificato sul centro assistenza di Brevo — **con un limite dichiarato: da
questo ambiente `help.brevo.com` e `developers.brevo.com` sono bloccati dal
proxy di rete, quindi quanto segue viene dagli estratti di ricerca di quelle
stesse pagine e non da una lettura diretta.** Va riletto sul pannello prima di
costruirci sopra.

- **Svuotare un attributo: sì.** L'azione *Update contact attribute* di
  un'automazione «allows you to update **or delete** the value of a specific
  contact attribute for a contact».
- **Togliere da una lista: sì.** L'azione *Remove contact from a list*.
- **Cancellare un contatto: sì.** L'azione *Delete a contact*, descritta per il
  caso di chi «has not interacted with you in a long time».

#### Cosa **non** è verificato, ed è il punto che decide tutto

**«Dopo l'ultimo invio» non si sa se si può esprimere.** Il trigger a data
(*Anniversary*) fa entrare un contatto in un'automazione un tot di giorni prima
o dopo una data contenuta in un attributo — che sarebbe esattamente
`SCAD_2_DATA` — ma la documentazione dice che **ignora l'anno**: i contatti
«can enter the automation every year on the same date». Un trigger che si
ripete ogni anno non esprime «una volta sola, trenta giorni dopo». Se esista un
altro modo di dirlo, da qui non l'ho potuto verificare.

Non è verificato nemmeno il caso 3. Per il doppio opt-in costruito **come
workflow di Brevo** — quello per i moduli esterni — esiste un «Wait time» dopo
il quale il contatto non confermato viene *blocklisted*. Noi però non usiamo
quel workflow: usiamo l'endpoint API `doubleOptinConfirmation`, che il doppio
opt-in se lo gestisce da sé. Che quell'impostazione valga anche per questa
strada **non risulta**, e comunque *blocklisted* non vuol dire cancellato: il
contatto resta in archivio.

#### Le due strade, per ciascuno dei tre

**Pulizia manuale periodica.** Un promemoria in calendario — trimestrale,
semestrale — e due filtri sul pannello di Brevo. Costo: zero da costruire,
qualche minuto a giro. Rischio: dipende da una persona che si ricorda, e
l'informativa invece promette. Regge se il termine è generoso (mesi, non
giorni) e se il numero di contatti resta piccolo.

**Job esterno.** Uno script che chiama l'API di Brevo e fa il giro: cerca i
contatti oltre il termine, svuota o cancella. Da far partire da qualcosa che
gira da solo — un Vercel Cron o una GitHub Action pianificata — perché qui non
c'è niente che giri ogni notte: `api/promemoria.ts` risponde a una richiesta e
muore. Costo: mezza giornata più la chiave API con i permessi di scrittura in
un secondo posto. Vantaggio: fa quello che l'informativa dice, ogni giorno,
senza che nessuno se ne ricordi.

**Il caso 1 potrebbe non aver bisogno di nessuna delle due**, se il trigger a
data si rivelasse utilizzabile: sarebbe un'automazione dentro Brevo, senza
codice nostro. È la prima cosa da guardare sul pannello, perché se funziona
toglie di mezzo il termine più delicato dei tre.

### Quando accendere

1. L'informativa privacy descrive i sei attributi e le due finalità separate.
2. Le tre variabili sono su Vercel, e l'iscrizione di prova arriva davvero.
3. Solo allora `PROMEMORIA_ATTIVI = true` in `src/lib/sito/impostazioni.ts`.

---

## Prima di spingere, sempre

```sh
npm run test
npm run build                 # timbra out/ e verifica i link
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
