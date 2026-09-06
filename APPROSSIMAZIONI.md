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

**Artigiani e commercianti: contributi fissi come importo annuo dichiarato.**
Non sono calcolati sul minimale, e non sono gestite le riduzioni — over 65 già
pensionati, coadiuvanti under 21, agevolazione per i forfettari. Manca anche il
massimale sulla parte eccedente.

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

## Regione e comune non finiscono sul prospetto

La schermata Parametri registra in quale regione e in quale comune si vive: è
quello che rende verificabile un'aliquota dichiarata — «0,8 %» senza il nome
del comune è un numero che nessuno può ricontrollare. Il posto dove
servirebbero davvero è il prospetto stampato, che va da un'altra persona, e lì
non ci sono ancora: il documento riporta le aliquote, non a quale delibera si
riferiscono.

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
Configurazione e Import da CSV (34 px), «Ricarica il dataset dimostrativo» e
«Svuota» in Dati e backup (32 px), e il segmento stretto del semaforo fiscale
sul cruscotto (29 px di larghezza — è largo quanto la quota che rappresenta, e
allargarlo vorrebbe dire mentire sulla proporzione; da questa fase risponde
anche al tocco, non solo al passaggio del mouse).
