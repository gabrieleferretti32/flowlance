# Approssimazioni note del motore

Quello che Flowlance **non** calcola, o calcola in modo semplificato. È l'elenco
da leggere prima di vendere il prodotto: ogni voce è una differenza possibile
fra il numero che l'app mostra e quello che scriverà il commercialista.

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

## Da verificare

**Minimale di reddito artigiani e commercianti 2026.** In `parametri/2026.ts`
vale 18.555 €, che è il valore del 2025. La pagina INPS sui contributi 2026
indica 18.808 €, come il minimale della Gestione Separata dello stesso anno.
Non l'ho cambiato perché non sono riuscito ad aprire `inps.it` per leggere la
circolare parola per parola: va confrontato con la Circolare INPS n. 14 del 9
febbraio 2026. Se il valore giusto è 18.808, cambia il contributo di chiunque
lavori in gestione artigiani o commercianti.

## Domande aperte di prodotto

**Il ÷ 12 dell'accantonamento mensile.** «Da accantonare al mese» divide per
dodici quello che resta da versare, anche a settembre, quando i mesi rimasti
sono quattro. È semplice e sbagliato dalla metà dell'anno in poi. Le alternative
— dividere per i mesi che mancano alla prossima scadenza, o per quelli che
mancano a fine anno — sono più giuste e più difficili da leggere. Decisione
rimandata.

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
