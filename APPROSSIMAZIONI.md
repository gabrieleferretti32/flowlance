# Approssimazioni note

Quello che Flowlance **non** calcola, o calcola in modo semplificato. È l'elenco
da leggere prima di vendere il prodotto: ogni voce è una differenza possibile
fra il numero che l'app mostra e quello che scriverà il commercialista.

In fondo, dopo il motore, c'è la stessa cosa per l'interfaccia: quello che si
sa essere stretto e che si è deciso di lasciare così.

Nessuna di queste è un difetto da correggere di corsa. Sono scelte, e la ragione
di ognuna sta scritta accanto. Quando una diventa un problema per un utente
vero, si sposta da qui al codice.

Il prospetto stampato lo dice già in fondo, con altre parole: *«prospetto
gestionale di stima, non è una dichiarazione dei redditi»*. Questo file è la
versione lunga di quella frase.

---

## Redditi che l'app non vede

**Solo i redditi dell'attività.** Scaglioni IRPEF, addizionali e detrazione
dell'art. 13 si calcolano su un reddito complessivo che è solo quello della
partita IVA. Chi ha anche un lavoro dipendente, una casa affittata o dividendi
ha un reddito complessivo più alto: lo scaglione può salire e la detrazione
scendere. *È l'approssimazione più grande dell'intero motore*, ed è dichiarata
nella nota in fondo al prospetto.

**Detrazioni diverse dall'art. 13.** Familiari a carico, spese sanitarie,
ristrutturazioni, erogazioni liberali: si inseriscono a mano come un importo
unico nelle impostazioni. L'app non le calcola e non conosce i loro limiti.

**Oneri deducibili diversi da contributi e fondo pensione.** Assegno al coniuge,
contributi per collaboratori domestici e gli altri dell'art. 10 TUIR non
esistono nel modello.

## Imposte

**La sterilizzazione del beneficio sopra i 200.000 € non è implementata.** La
riduzione del secondo scaglione IRPEF dal 35 % al 33 % (art. 1 commi 3 e 4
della L. 199/2025) è accompagnata da un meccanismo che ne annulla il vantaggio
per chi ha un reddito complessivo oltre i 200.000 €. L'app applica gli
scaglioni e basta: a quei redditi calcola un'imposta più bassa del dovuto.

È fuori dal pubblico di Flowlance — un reddito da 200.000 € di sola partita IVA
non è il caso d'uso — ma il numero sarebbe sbagliato in difetto, che è la
direzione peggiore, e va detto.

**IRAP: non calcolata.** Dal 2022 non è dovuta dalle persone fisiche
esercenti attività di impresa o professione, ma la valutazione
sull'autonoma organizzazione l'app non la fa e non la può fare.

**Esenzioni e soglie delle addizionali: le dichiari tu, l'app non le sa.**
Quasi tutti i comuni che applicano l'addizionale esentano i redditi sotto una
soglia, e diverse regioni fanno lo stesso. C'è un campo per dichiararla, in
Parametri, e il motore la applica come una soglia — sotto non si paga niente,
sopra si paga sull'intero imponibile, non sull'eccedenza. Quello che l'app non
fa è *saperlo*: se il tuo comune ti esenta e non lo scrivi, l'app ti conta
un'imposta che non devi.

Restano fuori anche i casi più fini: le esenzioni legate a qualcosa di diverso
dal reddito, le soglie diverse per scaglione, e i comuni che esentano solo
alcune categorie. Il modello ha una soglia sola per addizionale.

**Nessuna tabella delle aliquote, né delle regioni né dei comuni.** Scegliere
la regione precompila l'**aliquota base di legge**, l'1,23 % dell'art. 6 del
D.Lgs. 68/2011: è uguale per tutte e venti, e quasi tutte la superano o
applicano scaglioni. Non c'è una tabella regione per regione, e nemmeno una dei
comuni — sono quasi ottomila e ritoccano le aliquote ogni anno. Una tabella
scritta oggi dentro un'app local-first invecchia nell'installazione di chi la
usa e continua a mostrare come «la tua aliquota» un numero di due anni fa, che
è il modo più efficace di sbagliare. Il numero vero lo scrive l'utente, e
finché non lo scrive il prospetto non si esporta.

Il Trentino-Alto Adige è una regione sola ma due addizionali: Trento e Bolzano
deliberano ciascuna la propria. L'elenco resta a venti voci e la nota lo dice.

**Soglia dei 12 € sulle addizionali.** Un'addizionale regionale o comunale
sotto i 12 € non si versa. L'app la conta comunque: la differenza è al massimo
di dodici euro, e sta qui perché è un numero che qualcuno prima o poi
verificherà.

**Arrotondamento all'unità di euro.** La dichiarazione arrotonda ogni importo
all'euro; l'app tiene i centesimi ovunque. Sono scarti di pochi euro sul totale,
ma i numeri non coincideranno mai *esattamente* con il modello Redditi.

**Ravvedimento, sanzioni e interessi di mora.** Non esistono nel modello: chi
versa in ritardo vede l'importo pieno, non quello ravveduto.

**Maggiorazione dello 0,40 % del versamento differito a luglio.** La scadenza
c'è nello scadenzario, l'importo no.

## Contributi

**Cassa professionale: una sola aliquota, dichiarata dall'utente.** Ogni cassa
ha regolamento proprio — minimi, massimali, scaglioni, contributo di maternità.
L'app applica l'aliquota soggettiva che l'utente dichiara nei Parametri, e per
le casse **non calcola nessun acconto**: le scadenze le decide il regolamento
della cassa, non l'INPS.

**Artigiani e commercianti: quello che l'app calcola e quello che non chiede.**
Le due gestioni sono distinte, con le loro aliquote e i loro contributi fissi;
il punto in più oltre la prima fascia di retribuzione pensionabile e il
massimale ci sono. Restano fuori tre cose:

- **Le riduzioni.** Il 35 % dei forfettari che l'hanno chiesta all'INPS, il
  50 % di chi ha più di 65 anni ed è già pensionato, il 50 % dei nuovi iscritti.
  L'app non le calcola perché non può sapere chi ne ha diritto: si scavalcano
  scrivendo l'importo nel campo dei contributi fissi, e il testo del campo
  nomina i tre casi. Chi non li legge paga di più nel prospetto che nella
  realtà.
- **I coadiuvanti familiari.** Under 21 o no, hanno aliquote proprie e non
  esistono nel modello: l'app calcola i contributi di una persona sola.
- **L'anzianità contributiva al 31 dicembre 1995**, qui sotto.

**Il massimale applicato è quello dei nuovi iscritti.** L'art. 2 comma 18 della
L. 335/1995 fissa il massimale per chi è privo di anzianità contributiva al
31 dicembre 1995: 120.607 € nel 2025, 122.295 € nel 2026. Chi ha anzianità
precedente ha invece un massimale più basso — 92.413 € e 93.707 €, cioè la
prima fascia di retribuzione pensionabile più due terzi — e l'app **non chiede
l'anzianità**, quindi applica sempre il primo.

È la direzione giusta in cui sbagliare per il pubblico di Flowlance, dove quasi
nessuno era già iscritto prima del 1996, ma per chi lo era il contributo
calcolato è più alto del dovuto sopra quella soglia. Chiederlo significherebbe
una domanda in più nella configurazione per un caso che riguarda pochi; per ora
è dichiarato qui, e un test verifica almeno la relazione da cui i due valori
discendono.

**Un importo del 2025 non è letto sulla fonte primaria.** I contributi fissi
dei commercianti per il 2025 — 4.549,70 € — non sono stati verificati sulla
Circolare INPS n. 38 del 7 febbraio 2025: né inps.it né i mirror sono
raggiungibili dall'ambiente in cui il file è stato scritto. Più fonti
secondarie indipendenti riportano quel valore con la stessa scomposizione
(4.542,26 € di IVS e indennizzo di cessazione, più 7,44 € di maternità), e il
metodo si autoverifica sugli artigiani: 18.555 × 24 % = 4.453,20, più 7,44, dà
esattamente i 4.460,64 € pubblicati. Un test rifà quel conto su tutti e quattro
gli importi dei due anni.

È una corroborazione, non una lettura. Resta da confermare sulla circolare.

**Gestione Separata: una sola aliquota.** L'aliquota cambia a seconda che il
professionista abbia o no un'altra copertura previdenziale; l'app usa quella
dichiarata nelle impostazioni, senza verificarne il presupposto.

**Nessun minimo contributivo per i professionisti.** È corretto per la Gestione
Separata, dove il minimale serve solo all'accredito. Non lo è per tutte le
casse.

## IVA

**Liquidazione senza casi speciali.** Niente pro-rata di detraibilità, niente
reverse charge, niente operazioni intracomunitarie o con l'estero, niente
ventilazione, niente regimi speciali. La detraibilità è per documento, una
percentuale scelta dall'utente.

**Acconto IVA di dicembre.** La scadenza c'è, l'importo no: il calcolo dipende
dal metodo scelto — storico, previsionale o delle operazioni effettuate — e
l'app non chiede quale.

**Bollo virtuale.** Si applica per fattura sopra la soglia, come previsto, ma il
versamento trimestrale del bollo compare nello scadenzario senza importo quando
riguarda un trimestre di un anno che l'archivio non copre.

## Versamenti

**Non si sa se un F24 è un acconto o un saldo.** Il versamento porta l'anno
d'imposta, non la sua natura. Per capire quanta parte degli acconti dell'anno
è ancora da versare, l'app scomputa dal totale degli acconti dovuti tutto
quello che risulta versato per quell'anno — è l'ordine in cui si versa, ma
resta una deduzione. Chi versasse il saldo prima degli acconti vedrebbe gli
acconti calare invece del saldo. Il campo `natura` sul versamento chiuderebbe
la questione, ed è rimandato.

## Ritenute e note di credito

**Uno storno non riconciliato non abbassa la base delle ritenute.** Una nota di
credito agganciata a una fattura riduce anche la ritenuta subita su quella
fattura. Una nota senza aggancio riduce i ricavi ma non le ritenute: non si sa a
quale committente attribuirla, e attribuirla a caso sposterebbe la ritenuta di
qualcun altro. Il prospetto lo scrive nella riga delle ritenute.

## Anni e parametri

**Un anno nuovo eredita i parametri dichiarati, e lo dichiara.** Le aliquote
che l'utente ha confermato passano all'anno successivo col loro valore — è un
punto di partenza migliore della media dell'app — marcate «ereditate dal
<anno>». Valgono, e non bloccano l'export: il numero l'ha scritto una persona,
non l'app. Ma nessuno l'ha confermato per l'anno nuovo, e regioni e comuni le
ritoccano ogni gennaio: chi non ci torna sopra tiene un'aliquota vecchia con
un'etichetta che lo dice, non con una che lo nasconde.

Resta una scelta discutibile in un senso solo: si potrebbe bloccare l'export
finché ogni parametro non è riconfermato per l'anno in corso, come già fanno i
parametri di legge provvisori. Non si fa perché costringerebbe a rispondere di
nuovo, ogni gennaio, anche a chi non ha cambiato né comune né regione.

**Censiti il 2025 e il 2026; il 2027 eredita dal 2026 in attesa della sua
Legge di Bilancio.** Un anno senza parametri propri usa quelli dell'anno censito
più vicino, e l'app lo dichiara: banner «parametri provvisori» e export del
prospetto bloccato. Vale anche per gli anni *precedenti* al primo censito: chi
importa uno storico del 2023 lo vedrà calcolato con le aliquote del 2025.

**Acconti col solo metodo storico.** Il metodo previsionale — pagare meno
perché l'anno prossimo si guadagnerà meno — non è implementato. È una scelta di
prudenza: sbagliare la previsione costa sanzioni.

## Cose che l'app calcola su tutto l'archivio, non sull'anno guardato

**Giorni medi di incasso** e **portafoglio clienti** nel cruscotto sommano tutte
le fatture dell'archivio, non solo quelle dell'anno selezionato. Su un archivio
di un anno solo non si nota; su tre anni la media diventa una media di vita, non
dell'anno.

## Valori di legge copiati nelle impostazioni

**Le impostazioni di un anno conservano i parametri con cui sono nate.**
Aliquote, minimali e massimali vengono copiati dai parametri dell'anno nel
momento in cui la riga di impostazioni viene creata, e da lì in poi restano
quelli. Un anno nuovo riparte dai parametri aggiornati — porta avanti solo le
scelte dell'utente — ma una riga già in archivio non si aggiorna da sola
quando si corregge un parametro. Chi ha un archivio creato prima di una
correzione va servito da una migrazione, che non c'è.

## Domande aperte di prodotto

**Il ÷ 12 della quota mensile.** «Quota mensile del fabbisogno» divide per
dodici quello che resta da versare, anche a settembre, quando i mesi rimasti
sono quattro. L'etichetta ora dice quello che il numero è — una quota, non una
rata da mettere via ogni mese — ma la domanda vera resta senza risposta: *sono
in pari o sono indietro?*

Per rispondere serve **l'accantonato reale**, che nel modello non c'è: il
`accantonamentoCumulato` del cashflow è una simulazione — la percentuale
impostata applicata agli incassi, meno i versamenti — e confrontarla con la
percentuale impostata vorrebbe dire confrontare il piano con se stesso. Il
Patrimonio ha voci libere, senza un modo di marcare un conto come dedicato
alle imposte.

Servirebbe una cosa sola: poter dire che una voce di patrimonio *è* il conto
delle tasse. Da lì il confronto diventa reale — «dovresti averne da parte X, ne
hai Y» — e smette di saltare a ogni versamento.

## Scadenzario

**La riga di giugno mescola due criteri.** «Saldo dell'anno prima più il primo
acconto» mostra il saldo *al netto di quello che hai già versato* e l'acconto
*al lordo*. Se il saldo è stato pagato, il numero è il solo acconto pur restando
titolato su due voci, e non coincide né con quello che esce dal conto quel
giorno né con il totale dovuto alla data.

Per separarli servirebbe sapere se un F24 è un saldo o un acconto: il campo
`natura` sul versamento, rimandato quando è stato introdotto `annoImposta`. In
alternativa una regola sulla data — versato per l'anno N entro il 30 giugno di
N+1 è acconto, dopo è saldo — che funziona ma resta una deduzione.

---

# Interfaccia: cose viste e rimandate

Non sono difetti scoperti dopo. Sono misurati, e la ragione per cui restano
sta accanto.

## Le pagine lunghe non si paginano

Su un telefono da 375 px, con l'archivio dimostrativo, **Costi è alta 14.509
px**: sessantanove schede una sotto l'altra, senza paginazione e senza «carica
altre». Fatture è 5.541, Cashflow 4.644. Si scorre e si legge tutto — niente è
tagliato — ma cercare il costo di marzo vuol dire quindici schermate di pollice.

Non è una correzione di impaginazione: è una funzione che non c'è. Servirebbe
decidere *cosa* pagina — una finestra scorrevole, un «mostra altri 20», o il
filtro per mese già presente in cima usato come navigazione vera. Con un
archivio di tre anni la domanda si pone da sola; con uno di un anno, no.

## La riconciliazione delle note si fa solo da computer

Agganciare una nota di credito alle fatture su cui cade lo storno è un pannello
che vive nella tabella, cioè da 768 px in su. Sulla scheda del telefono
l'azione non c'è, ed è voluto: riconciliare è lavoro, non consultazione, e la
distribuzione di uno storno su più fatture chiede di vederle tutte insieme.

Quello che la scheda deve fare è dirlo. Mostra il residuo — «400,00 € senza
fattura» — e sotto la riga che dice dove si rimedia. Un problema senza via
d'uscita è peggio di un problema rimandato.

Se un giorno la riconciliazione dovesse funzionare anche sul telefono, non
basta scoprire il pulsante: servirebbe una forma diversa dal pannello a lista,
perché il gesto è «distribuisci questo importo fra queste fatture» e su 375 px
non ci stanno né le fatture né gli importi da confrontare.

## Il conto delle tasse non si può marcare

Il Patrimonio ha voci libere e nessun modo di dire che *quella* voce è il conto
dove finiscono i soldi delle imposte. Senza, la domanda «sono in pari o sono
indietro?» resta senza risposta e la card della copertura confronta il piano con
sé stesso. È la stessa cosa scritta sopra sotto «Il ÷ 12 della quota mensile»:
sta anche qui perché è un campo da aggiungere al modello, non solo una domanda
aperta.

## Che cosa succede a licenza scaduta

Non è un'approssimazione: è il comportamento, misurato con una licenza vera —
chiave Ed25519 firmata dallo strumento di emissione, dodici mesi, verificata
dal browser — spostando avanti l'orologio invece di forzare lo stato. Sta qui
perché è la domanda che farà chi compra, e la risposta dev'essere una sola e
rileggibile.

**Il giorno dopo la scadenza l'app si apre come sempre.** Nessuna schermata
bloccata, nessuna finestra da chiudere. In cima a ogni schermata una riga
rossa: «Licenza scaduta il *data*. L'app è in sola lettura: si consulta tutto,
non si inserisce niente. L'esportazione dei dati resta attiva», con i
collegamenti per rinnovare e per incollare una chiave.

- **I dati sono intatti.** L'archivio non viene toccato: la licenza chiude le
  scritture, non l'accesso.
- **Si legge tutto.** Cruscotto, prospetto, scadenzario, cashflow, fatture,
  clienti, patrimonio: coi numeri veri, niente nascosto e niente sfocato.
- **L'export funziona sempre.** È l'unico pulsante acceso in Dati e backup, e
  resta anche nella palette. I dati dell'utente non sono in ostaggio.
- **La stampa del prospetto funziona.** Il PDF si genera: è un documento sui
  propri dati, e la licenza non c'entra.
- **La copia di sicurezza dell'ultimo import si può ripristinare**, anche da
  scaduti. Rimettere i propri dati dove stavano non è inserirne di nuovi — e
  senza questo, chi sbaglia un import e poi scade riesce a esportare solo
  l'archivio sbagliato.
- **Si spegne solo quello che scrive**: nuova fattura, nuovo costo, import da
  CSV e da backup, celle modificabili, spunte dello scadenzario, ricarica del
  dataset, svuotamento. La palette toglie quei comandi dall'elenco e lo dichiara
  in una riga.
- **Il rientro è immediato.** Si incolla la chiave nuova nella schermata
  Licenza: la barra sparisce senza ricaricare, i dati sono gli stessi, le
  scritture tornano. Niente da rifare.
- **Togliere la chiave non riapre niente:** si finisce in «periodo di prova
  finito», che è di nuovo sola lettura.

Il preavviso comincia **quindici giorni prima** — una riga sottile in testa,
con «scade fra N giorni» e il collegamento al rinnovo — e il giorno della
scadenza si scrive ancora: la scadenza è compresa.

Senza nessuna chiave valgono **quattordici giorni di prova** dal primo avvio,
poi lo stesso stato di sola lettura.

## Un anno senza parametri censiti usa quelli dell'anno prima, in silenzio

`parametriDi(anno)` restituisce i parametri dell'anno richiesto, e se quell'anno
non è ancora censito **ricade sull'anno più recente disponibile**. Il commento
accanto dice «meglio una stima dichiarata che un errore», ed è vero — ma la
stima, oggi, è dichiarata solo in parte.

Dove è dichiarata: gli anni che il progetto conosce ma per cui la Legge di
Bilancio non è ancora uscita hanno un file loro con `provvisorio: true`, e
quello l'app lo dice — banner in cima alla schermata, export del prospetto
bloccato. Il 2027 è così adesso.

Dove **non** è dichiarata: un anno oltre l'ultimo file esistente. A gennaio 2028,
se `parametri/2028.ts` non c'è ancora, l'app calcola con i parametri del 2027 e
non lo dice da nessuna parte: `provvisorio` è un campo del file, e un anno senza
file non ha un campo da leggere. Succederà, perché la Legge di Bilancio esce a
fine dicembre e i file si aggiornano dopo.

Non è un dettaglio di comodo: i Termini di servizio, al punto 8, promettono
parametri aggiornati per gli anni coperti dalla licenza. Il giorno in cui la
promessa non è ancora mantenuta deve dirlo l'app, non scoprirlo il cliente
confrontando il prospetto col commercialista.

Il buco è chiuso dove conta, ma **non per costruzione**:

- L'avviso in cima alla schermata c'era già: `AvvisoParametri` distingue i due
  casi e dice «per il 2028 non ci sono parametri censiti».
- L'export e la stampa del prospetto adesso si bloccano quando l'anno chiesto
  non è quello dei parametri, e il motivo nomina tutti e due gli anni.
- Il documento stampato porta la cosa **nell'intestazione, accanto all'anno
  d'imposta**: «2028 — calcolato con i parametri di legge del 2027, non
  definitivi per il 2028». Non nella nota in fondo, che è piccola e grigia e
  sparisce in fotocopia.
- L'import di un backup lo dice nel suo avviso, nominando l'anno da cui vengono
  i valori.

Quello che resta approssimato è **quanto tutto questo si regge da solo**. Il
2027 oggi ha `provvisorio: true`, quindi anche senza il controllo nuovo il
blocco scatterebbe: il caso puro — anno di ripiego definitivo e anno chiesto
senza file — non si presenta finché non si aggiorna il 2027. I test lo
esercitano su un anno lontano, dove il caso è puro, ma nel prodotto vero la
protezione non è ancora stata messa alla prova da un utente. Lo sarà a gennaio.

E resta il fatto che nessuno dei quattro punti dice **quali** valori sarebbero
cambiati: non si sa, e fingere di saperlo sarebbe peggio che dire da dove
vengono.

## Il promemoria del backup ha due punti ciechi

L'app ricorda l'ultimo export in `localStorage`, non nell'archivio: dentro
l'archivio finirebbe nel file di backup, e chi importa il backup di un altro si
vedrebbe dire «hai fatto un backup il 3 marzo», che è la data di un'altra
persona.

Ne discendono due limiti. Chi svuota i dati del sito perde anche il
promemoria, e l'app torna a dire «non hai mai fatto un backup»: è falso, ma è
falso nella direzione giusta — in quel caso è sparito anche l'archivio, e un
avviso di troppo è meglio di uno di meno. E chi apre l'app in un altro browser
sullo stesso computer riparte da zero, perché è un'altra installazione.

Il conteggio dei documenti nuovi è una differenza fra due totali, non un
registro delle modifiche: chi cancella dieci fatture e ne inserisce dieci non
risulta avere niente di nuovo. Un avviso mancato su un lavoro fatto, quindi,
ma solo in un caso che si riconosce da sé.

## Chi svuota l'archivio si lascia dietro una copia

Ogni gesto che sostituisce l'archivio intero — importare, ricaricare il
dataset dimostrativo, svuotare — ne mette da parte una copia che sopravvive
alla chiusura del browser. Sullo svuotamento è una contraddizione: chi svuota
per far sparire i dati se li ritrova ancora sul dispositivo.

Non è nascosta — la scheda in Dati e backup lo dice in chiaro e la si elimina
con un tocco — ma è un secondo passo, e va conosciuto. L'alternativa sarebbe
non tenere niente e rendere lo svuotamento irreversibile, che su un gesto che
si può premere per sbaglio è peggio.

## La card «Prossima scadenza» non mostra sempre la prima scadenza

Mostra il primo versamento **di cui si conosce l'importo**, e nomina quelli che
ha scavalcato con la loro data. Gli adempimenti senza importo stimato non sono
un'eccezione: sono cinque — bollo del trimestre, IVA di dicembre dell'anno
prima, rinvio di luglio, acconto IVA, e saldo e acconti quando manca l'anno da
cui calcolarli — e senza questa regola la card più utile del cruscotto mostrava
un trattino proprio su un archivio appena avviato.

Il prezzo è dichiarato in una riga sotto la data. Se nessuna delle prossime ha
un importo si torna alla prima e il trattino resta: meglio un trattino che un
numero preso da una data diversa da quella scritta accanto.

Un caso limite che resta: se l'anno successivo non ha ancora documenti, la sua
prima liquidazione IVA vale `0,00 €` — che è un importo, quindi vince sul
trattino. La card dice allora «0,00 €» per una data futura, e sotto nomina la
scadenza vera più vicina. Trattare lo zero come «nessun importo» non si può:
un trimestre coperto da un credito vale zero davvero, e chiamarlo «senza
importo stimato» sarebbe falso.

## Due «netto», e il motore ne conosce uno solo

Il semaforo del cruscotto scompone il denaro **entrato in cassa**: i suoi
quattro segmenti — netto, imposte, contributi, IVA incassata — devono sommare a
`incassatoLordo`, e i costi dell'attività restano fuori. Il suo netto è quindi
`incassatoLordo − caricoTotale − ivaIncassata`, e vive in
`segmentiSemaforo`, non nel motore.

Il motore ha invece `nettoDisponibile`, che i costi li toglie:
`ricaviRilevanti − costiNettiACarico − caricoTotale`. Rispondono a due domande
diverse — «di quello che è entrato, quanto è mio» contro «alla fine dell'anno
cosa resta» — e le due schermate lo dicono, perché la riga di dettaglio del
segmento nomina l'altro numero.

La conseguenza da sapere: **chi tocca `caricoTotale` muove anche il semaforo**,
e il semaforo non è coperto dai test del motore perché la sua formula non sta lì.
È il prezzo di una scomposizione che deve sommare a un totale diverso da quello
del prospetto; l'alternativa — portare il netto del semaforo dentro il motore —
metterebbe nel motore una grandezza che serve a una sola schermata.

## Il «Come si calcola» si apre in due modi

Sotto i 768 px il dettaglio del prospetto si apre **sotto la riga**, spingendo
in giù il contenuto; da 768 in su resta il riquadro che compare accanto. Non è
una preferenza estetica: misurato su iPhone, il riquadro sovrapposto copriva le
righe intorno a quella che stava spiegando — fino a quattro per volta — e una
spiegazione che nasconde ciò che spiega non serve a niente.

Il prezzo è che sono due componenti invece di uno, e che serve conoscere la
larghezza in JavaScript (`useSchermoStretto`) invece che in CSS: il
comportamento cambia, non solo l'aspetto, e una media query non sa cambiare
comportamento. È l'unico punto dell'app in cui questo vale la pena; ovunque la
differenza sia di dimensioni o disposizione, resta Tailwind.

Conseguenza sul telefono: il dettaglio in linea non ripete etichetta e valore,
che il riquadro invece porta con sé. La riga è visibile subito sopra.

## I pulsanti principali sono alti 40 px, non 44

Sotto la soglia consigliata per il tocco, sopra la soglia in cui si sbaglia:
Nuova fattura, Nuovo costo, Stampa il prospetto, Esporta, Importa, Attiva,
Conferma e continua e i filtri di ogni elenco misurano 40 px di altezza sul
telefono. Portarli tutti a 44 vuol dire toccare la taglia `md` del componente
`Button`, cioè ogni schermata dell'app e ogni allineamento verticale che ci sta
sopra: un lavoro sproporzionato rispetto al guadagno.

Sono stati portati a 44 solo i due casi in cui sbagliare costa davvero: il ☰,
che sotto i 1024 è l'unica navigazione che esiste, e i quattro «Come si calcola»
del prospetto, che erano 30×30 su una schermata che si consulta.

Restano più piccoli anche, e non sono stati toccati: i selettori a segmenti di
Configurazione e Import da CSV (34 px), i pulsanti dei dataset di esempio e
«Svuota» in Dati e backup (32 px), e il segmento stretto del semaforo fiscale
sul cruscotto (29 px di larghezza — è largo quanto la quota che rappresenta, e
allargarlo vorrebbe dire mentire sulla proporzione; da questa fase risponde
anche al tocco, non solo al passaggio del mouse).

## Le aliquote territoriali del dataset da vetrina: verificate, tranne una

Il dataset da vetrina (`src/lib/dati/vetrina.ts`) è quello che finisce negli
screenshot. Persone, clienti e importi sono inventati e non c'è niente da
verificare; le due addizionali sì, perché dicono «Emilia-Romagna» e «Bologna»,
cioè un territorio vero, e valgono quanto la loro fonte.

**Addizionale regionale Emilia-Romagna — verificata.** Sono maggiorazioni
sull'aliquota base statale dell'1,23 % (art. 6 D.Lgs. 68/2011) deliberate con la
L.R. 19/2006 art. 2, come modificato dalla L.R. 1/2025 e dalla L.R. 9/2025:

| scaglione | 2025 | 2026 |
|---|---|---|
| fino a 15.000 € | 1,33 % | 1,33 % |
| 15.000 – 28.000 € | 1,93 % | 1,93 % |
| 28.000 – 50.000 € | **2,93 %** | **2,78 %** |
| oltre 50.000 € | 3,33 % | 3,33 % |

I due anni del dataset hanno perciò scaglioni diversi, ed è il caso per cui
`Impostazioni` è per anno d'imposta: la terza fascia è stata ridotta a partire
dal 2026.

**Addizionale comunale Bologna — nessuna delle due righe è verificata.** La
fonte primaria è l'elenco delle aliquote allegato alle istruzioni del 730/2026,
e non è raggiungibile né dall'ambiente in cui il dataset è stato costruito né
da chi lo ha commissionato: l'Agenzia delle Entrate blocca il fetch.

Quindi, per essere precisi su che cosa sappiamo:

- **0,80 % di aliquota: plausibile, non verificato.** Viene da fonti
  secondarie. L'unico documento comunale rintracciato è un archivio del 2013
  che riporta 0,7 % con esenzione a 12.000 €. Probabile che sia stata alzata da
  allora — 0,80 % è il massimo che la legge consente — ma «probabile» non è
  «verificato».
- **Soglia di esenzione: non la sappiamo, e perciò non c'è.** Il campo è a
  zero, che nell'app significa «nessuna esenzione dichiarata», non «Bologna non
  ne ha una». Gli aggregatori non concordano fra loro. Sull'imponibile della
  vetrina (poco sotto i 28.000 €) non cambia un centesimo, quindi lasciarla
  fuori non costa niente e non afferma niente.

La regola che ne esce vale oltre questo caso: **se una soglia non è verificabile
dalle fonti secondarie, non lo è nemmeno l'aliquota che sta sulla stessa riga.**
Sono lo stesso documento; sapere di non poterne leggere metà significa non
poterne leggere l'altra metà.

## Quello che il dataset da vetrina non attraversa

Il difetto delle aliquote regionali è passato perché il calcolo non ci arrivava:
l'imponibile della vetrina sta fra 15.000 e 28.000 € in tutti e due gli anni, e
la terza fascia non entra mai. Nessun importo cambiava, nessun test diventava
rosso. Da lì i test che confrontano le aliquote **scritte** con quelle
deliberate: quando un dato non è esercitato dai numeri, verificarne l'effetto
non verifica niente.

Lo stesso vale per tutto quello che segue. Non è un elenco di difetti — è
l'elenco di dove un valore sbagliato non si vedrebbe, cioè dove serve un test di
contenuto invece di uno di effetto. La colonna a destra dice se qualcos'altro,
nel repository, lo tiene fermo.

| Non attraversato dalla vetrina | Coperto altrove? |
|---|---|
| **Scaglioni IRPEF oltre 28.000 €** (33 % nel 2026, 35 % nel 2025, 43 % oltre 50.000): l'imponibile resta nel primo scaglione | solo `spiegazioni.test.ts` cita 23/33/43 per il 2026. **Il 35 % del 2025 non è asserito da nessun test** |
| **Tutti i valori di `PARAMETRI_2025`**: `PARAMETRI_2025` non è importato da nessun file di test | no. Il 2025 entra nella catena della vetrina, ma nessuno ne asserisce le costanti — l'unico valore di legge pinnato è `minimaleAnnuo = 18.808`, che è il 2026 |
| **Detrazione art. 13, secondo tratto** (28.000–50.000) e **il gradino di 50 €** (11.000–17.000): la vetrina cade sempre nel primo tratto decrescente | sì, `detrazioni.test.ts` copre tutti i tratti e il gradino |
| **Imposta di bollo** (`importoBollo`, `sogliaBollo`, `bolloAddebitato`): tutte le fatture hanno IVA al 22 %, e il bollo scatta solo a IVA zero | sì, `motore.test.ts` in forfettario; e il dataset dimostrativo lo esercita |
| **Massimale e minimale della Gestione Separata**: reddito ~32.000 €, nessuno dei due vincola | sì, `motore.test.ts` |
| **Credito IVA riportato al periodo successivo** e la scelta compensazione/rimborso della chiusura: `creditoFinale` è zero in tutti e due gli anni, quindi la decisione registrata nella chiusura 2025 non produce nulla | sì, `iva.test.ts` |
| **Acconto delle imposte 40/60**: le imposte a saldo sono zero per via delle ritenute, quindi si esercita solo l'80 % in due rate dei contributi e il 30 % della comunale | sì, `motore.test.ts` |
| **Soglie `sogliaAcconti`, `sogliaAccontoUnico`, `sogliaVistoCompensazione`**: gli acconti sono molto sopra le prime due, il credito molto sotto la terza | parzialmente |
| **Esenzioni delle addizionali e scaglioni comunali**: entrambe a zero / `null` | sì, `addizionali.test.ts` |
| **Rivalsa INPS 4 % e contributo integrativo cassa**: spenti nel dataset | sì, `motore.test.ts` |
| **Aliquote IVA diverse dal 22 % in fattura** (esente, fuori campo, 10 %): tutte le fatture usano l'aliquota predefinita. I costi invece esercitano 0 %, 10 % e 22 % | sì, per i costi; per le fatture solo il forfettario del dataset dimostrativo |
| **Nota di credito non riconciliata**: quella della vetrina è agganciata alla sua fattura | sì, `note.test.ts` |
| **Parametri del forfettario** (coefficiente, sostitutiva, limite, soglia d'uscita): in ordinario non entrano nel prospetto | li esercita la schermata Confronto regimi, e `regime.test.ts` |

Le due righe che erano senza copertura — **gli scaglioni IRPEF oltre i 28.000 e
i valori di `PARAMETRI_2025`** — adesso ce l'hanno: `parametri/parametri.test.ts`
asserisce le costanti di legge una per una, anno per anno, con la fonte accanto a
ogni riga. È la stessa forma di difesa dei test sulle aliquote territoriali, per
la stessa ragione: quel file contiene solo numeri che nessuno ricalcola.

Restano da riconfermare, e il test lo dice riga per riga, tre valori che
l'autore non ha potuto leggere sul documento originale: **minimale e massimale
INPS 2026** (18.808 € e 122.295 €, da circolare) e la **riduzione dello scaglione
IRPEF centrale al 33 %** nella Legge di Bilancio 2026, di cui il test cita la
misura e non l'articolo.

Due cose che stanno in `parametri/<anno>.ts` ma **non sono valori di legge**, e
non vanno cercate in una norma: `rateRateizzazione` (sei rate è la proposta
dell'app, il contribuente sceglie entro il termine massimo) e `sogliaAvviso`
(l'85 % del limite forfettario oltre il quale scatta l'avviso preventivo).
