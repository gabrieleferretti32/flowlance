# Strumenti

Cose che non fanno parte dell'app e servono a chi la sviluppa o la vende.
Nessuna di queste gira nel browser dell'utente e nessuna finisce nel bundle.

| Strumento | A cosa serve |
|---|---|
| `schermate-vendita.mjs` | Rifà le quattro schermate della pagina di vendita dal prodotto vero, sul dataset vetrina |
| `artefatto.mjs` | La guardia: rifiuta di misurare `out/` se non è il sito del sorgente di adesso |
| `timbra-artefatto.mjs` | Timbra il sito appena costruito, dentro `npm run build` |
| `verifica-link.mjs` | Apre ogni pagina del sito costruito e controlla che nessun link interno sia morto |
| `verifica-derivati.mjs` | Rifà i conti delle formule del prospetto e li confronta con gli importi mostrati accanto |
| `verifica-allineamento.mjs` | Misura in pixel che ogni totale del piede stia sotto la colonna che somma, e che la somma torni |
| `verifica-consenso.mjs` | Intercetta la rete: niente misurazione prima di un sì, e mai dentro l'app nemmeno a consenso dato |
| `anteprima-pdf.mjs` | Rende ogni pagina di un PDF in PNG, per guardarlo invece di leggerne il testo |
| `immagine-anteprima.mjs` | Disegna l'immagine che i social mostrano al posto del link, leggendo il titolo dalla landing vera |
| `misura-responsive.mjs` | Misura ogni schermata alle larghezze vere dei telefoni |
| `diagnosi-chiave.mjs` | Dice cosa vede l'app quando cerca la chiave pubblica della licenza |
| `diagnosi-iva-importata.js` | Elenca le righe la cui aliquota IVA non è quella dichiarata, dopo il difetto dell'import da CSV |
| `diagnosi-coefficiente.js` | Dice, anno per anno, se il coefficiente in archivio coincide con quello del gruppo ATECO dichiarato |
| `diagnosi-riporti.js` | Rifà, nel browser dell'utente, i due conteggi che devono coincidere fra registro Fatture e chiusura d'anno |
| `licenza/` | Generazione delle chiavi di licenza — resta fuori dal repository pubblico, vedi il suo LEGGIMI |

---

## `artefatto.mjs` — la guardia, e perché c'è

Non si lancia: la chiamano tutti gli strumenti che aprono `out/`, come prima
cosa. Se `out/` non è il sito del sorgente di adesso, si fermano.

Serve per un difetto che è **un piano sopra** tutti gli altri di questo
progetto. Le verifiche misurano il sito costruito e non il sorgente — è la
scelta giusta, perché online finisce `out/` — ma vuol dire che una verifica non
sa se sta guardando il sito appena costruito o quello di ieri. È successo: un
`npm run build` si è fermato a metà, la verifica lanciata subito dopo ha
misurato la cartella rimasta dal build precedente e ha detto verde su un sito
che non esisteva più. L'unico sintomo era un codice d'uscita 1 in mezzo a un
`&&`.

Non misurare la cosa sbagliata, ma **la copia sbagliata**. Stessa risposta:
meglio fermarsi dicendo «non ho niente da misurare» che promuovere un artefatto
vecchio.

Come funziona: `npm run build` esegue `timbra-artefatto.mjs` subito dopo
`next build`, che scrive in `.artefatto.json` percorso, dimensione e data di
ogni file che decide cosa esce — `src/`, `contenuti/`, `public/` e i file di
configurazione alla radice. Chi verifica ricalcola quell'impronta e la
confronta; se qualcosa è cambiato, si ferma **e dice quale file**.

Sbaglia nella direzione giusta: un build fallito lascia il timbro vecchio, il
sorgente nel frattempo è cambiato, e il controllo non parte. `strumenti/`, i
`*.test.ts` e `out/` stesso restano fuori dall'impronta: cambiarli non cambia il
sito, e farli entrare vorrebbe dire rifiutare una verifica perché qualcuno ha
corretto un'asserzione — cioè addestrare chi lavora a ignorare il messaggio.

---

## `verifica-consenso.mjs`

```sh
npm run build
npm run verifica:consenso
```

Che gli `<Script>` di statistica stiano dentro un ramo condizionale si vede
leggendo `statistiche.tsx`; che quel componente sia montato solo dal layout di
`(sito)` si vede nell'albero delle rotte. Tutte e due le cose sono vere, e tutte
e due sono **argomenti**, non prove.

La prova è la rete. Lo strumento intercetta ogni richiesta che il browser tenta
e la confronta con i domini di misurazione. Tre passaggi:

1. **prima di rispondere al banner**, cinque pagine del sito non contattano
   nessuno — e nemmeno nessun altro: niente caratteri da Google, niente icone da
   una CDN;
2. **dopo «Accetta tutto»** le richieste partono davvero, e portano i codici
   configurati. Se fossero zero, il consenso non starebbe accendendo niente e il
   primo controllo passerebbe per la ragione sbagliata;
3. **con il consenso ACCETTATO, dentro `/app`**: sei schermate, demo compresa,
   e non parte niente. È il caso che conta — la promessa «dentro l'applicazione
   non c'è nessuna misurazione, in nessun caso» può cadere solo lì, e a consenso
   spento non si potrebbe distinguere da un sito che non misura mai.

Il sì si dà premendo il pulsante vero, non scrivendo nel `localStorage` da
fuori: se un giorno cambia il formato di quella riga, una scorciatoia
continuerebbe a scrivere il formato vecchio e il controllo misurerebbe una
pagina che non ha mai acconsentito.

---

## `anteprima-pdf.mjs`

```sh
npm run build
npm run anteprima:pdf              # i Termini
node strumenti/anteprima-pdf.mjs altro.pdf --dove=/tmp/x --scala=2
```

Il testo estratto da un PDF dice cosa c'è scritto e **non dice dov'è**. Il piede
dei Termini è finito, per una versione intera, su quattro pagine vuote in fondo
al documento — e il controllo che cercava le stringhe «pagina N di M» le trovava
tutte e quattro, in fila, e diceva che andava bene.

Quel difetto adesso non passa: `src/lib/contenuti/termini.test.ts` misura la
geometria, pagina per pagina, con il lettore in `geometria-pdf.ts`. Questo
strumento serve all'altra metà del lavoro — **decidere come deve venire**. La
carta intestata, il filetto sotto i dati della ditta, il peso del marchio
accanto al titolo, il rientro appeso di un elenco: sono cose che non si
affermano in un test, si guardano.

Rende ogni pagina con pdf.js dentro Chromium e scrive un PNG per pagina. Nessuna
dipendenza nativa: la stessa libreria con cui il browser mostra i PDF, fatta
girare in un browser.

---

## `immagine-anteprima.mjs`

```sh
npm run build
npm run anteprima:immagine                 # rifà public/anteprima.png
node strumenti/immagine-anteprima.mjs --file=/tmp/prova.png
node strumenti/immagine-anteprima.mjs --niente-scrittura
```

L'immagine che compare quando qualcuno incolla flowlance.it in una chat. Apre
**la landing costruita** in Chromium, le legge dal `<h1>` il titolo e le righe
colorate, dalla riga sopra l'occhiello, da `getComputedStyle` le tinte, e
disegna la scheda dentro quello stesso documento — quindi con lo stesso
carattere, già caricato. Il marchio è `src/app/icon.svg` infilato com'è dentro
un `<img>`: non ridisegnato.

Non gira dentro `npm run build` — il carattere del sito è un woff2 variabile e
il build di Vercel non ha un browser; la storia completa sta in `APPUNTI.md`,
11 settembre 2026. Al posto della rigenerazione automatica c'è una **firma**:
prima di scrivere il PNG ci infila un chunk `iTXt` con la frase disegnata,
l'occhiello e l'impronta del marchio, e `next.config.ts` la rilegge a ogni
build e si ferma se non coincide più con `APERTURA`. Cambiare il titolo della
landing senza rifare l'immagine non è possibile in silenzio: è possibile solo
fermando un build, che lo dice.

`RIFACCIO_ANTEPRIMA=1` è la via d'uscita da quel cerchio, e la usa lo script
`anteprima:immagine`: costruisce il sito con il presidio sospeso, perché è da
quel sito che l'immagine nuova verrà letta.

**Il titolo non viene rimpicciolito.** Va a capo da solo finché sta in tre
righe; alla quarta lo strumento si ferma e dice quante ne servono. Le misure
dell'immagine le verifica `src/lib/sito/anteprima.test.ts`, che ne apre i
pixel: altezza vera dell'inchiostro del titolo — perché un'anteprima 1200 × 630
con il titolo a 20 px sarebbe grande uguale e illeggibile — contrasto sul
fondo, e bordi sgombri dove il ritaglio dei social mangia qualche pixel.

---

## `verifica-allineamento.mjs`

```sh
npm run build
npm run verifica:allineamento
```

Il piede del registro dei costi aveva un `colSpan` sbagliato di una unità, e i
totali erano scivolati di una colonna: «15.057,50 € sotto Natura». Le somme erano
**giuste** — il conto tornava — e solo le posizioni erano sbagliate. Nessun test
l'ha visto: quelli sui numeri non guardano dove finiscono, quelli sul DOM contano
le celle, che erano il numero giusto.

Il difetto vive fra il numero e il posto in cui è scritto, e fra quei due c'è
solo il rendering: un browser. Lo strumento apre i registri a 1440 e a 1024,
prende i rettangoli veri di intestazioni, righe e piede, e per ogni totale
afferma due cose — che cada sopra una colonna di cifre, e, dove tutte le righe
sommate sono a schermo, che la somma della colonna faccia esattamente quel
totale.

Alla prima esecuzione ha trovato lo stesso difetto in altri due registri: nelle
Fatture «48.940,00 €» stava sotto «Tipo» e la colonna «Totale» era vuota; nelle
Note di credito il totale degli storni stava sotto «Descrizione». La colonna
delle azioni si era spostata in testa alla riga e i due piedi non l'avevano
contata.

---

## `verifica-derivati.mjs`

```sh
npm run build
npm run verifica:derivati
```

Ogni riga del prospetto porta la propria formula, coi numeri dentro: «32.429,55 €
× 26,07 %, fino al massimale di 122.295,00 €» accanto a un importo. Sono due cose
che l'app calcola separatamente e mostra insieme — la formula la scrive
`spiegazioni.ts`, l'importo lo calcola `motore.ts` — ed è la forma esatta della
famiglia di difetti che questo progetto continua a incontrare: **un valore
mostrato e uno calcolato che non si parlano, con nessuno dei due che segnala
l'altro**.

Lo strumento fa i conti della formula e li confronta con l'importo scritto
accanto, su due dataset: il contributo della Gestione
Separata, il reddito lordo nei due regimi, il coefficiente ATECO, l'imposta
sostitutiva, l'accredito contributivo, la capacità in ore, e i segmenti del
semaforo che devono sommare il denaro entrato in cassa.

Poi esce dal prospetto e verifica le altre cose della stessa forma:

- che l'impronta SHA-256 stampata accanto al PDF dei Termini sia quella del file
  che il sito serve davvero;
- che ogni pulsante **porti dove dice** — «Acquista» a `/acquista` e non su
  Stripe, «Apri la demo» all'app con la vetrina, e dalla demo «Esci» torni alla
  pagina di vendita invece che a un cruscotto vuoto. Un pulsante con l'etichetta
  giusta e la destinazione sbagliata è la stessa famiglia di difetti di un
  numero mostrato e uno calcolato: tutti e due plausibili, nessuno dei due
  segnala l'altro;
- che il prezzo sia scritto **nella stessa forma** ovunque compaia. Il controllo
  precedente confrontava i valori, e non vedeva che la testata diceva
  «97,00 € + IVA» mentre la sezione del prezzo diceva «97 €»;
- che a 390 × 844, col banner dei cookie aperto, i due inviti dell'apertura
  stiano tutti e due sopra il banner.

Non controlla che le righe ci siano, non conta elementi, non cerca una parola in
una pagina: prende i numeri che l'app mostra e verifica che uno sia il risultato
degli altri. È la sola forma di verifica che il difetto non riesce ad
attraversare, perché il difetto **è** la divergenza fra quei due numeri.

Due trappole imparate scrivendolo, ed è per questo che sono commentate nel
sorgente:

- **Il dimostrativo conserva le impostazioni.** Caricato sopra la vetrina, mette
  i suoi documenti sotto il profilo ordinario di Elena Marani: il prospetto
  mostrava una sottrazione dove doveva esserci la moltiplicazione per il
  coefficiente, e il controllo non falliva — non trovava la riga, che è il modo
  peggiore di passare. Ogni dataset si carica in un contesto nuovo.
- **Le sezioni C e D nascono chiuse**, e le loro righe non stanno nel DOM finché
  il `<details>` non si apre. Un controllo che non le aprisse direbbe «manca la
  riga della Gestione Separata» ogni volta, cioè misurerebbe sé stesso.

---

## `schermate-vendita.mjs`

```sh
npm run build
node strumenti/schermate-vendita.mjs
```

Uno screenshot di un prodotto invecchia in fretta e invecchia in silenzio:
resta bello, e intanto mostra una versione che non esiste più. Lo strumento
rifà tutte e quattro le immagini della pagina di vendita dal sito appena
costruito, così quello che si vede sulla pagina è l'app che si apre premendo
«Apri la demo».

**Solo il dataset vetrina**, caricato dalla schermata vera e non scrivendo in
IndexedDB da fuori: se un giorno il caricamento cambia, queste immagini devono
cambiare con lui invece di continuare a uscire da una scorciatoia.

**Orologio fermo al 5 settembre 2026**, l'ultimo giorno che la vetrina
racconta. Senza fermarlo, due esecuzioni a distanza di un mese darebbero
scadenze e importi diversi.

**Un controllo che vale più di tutto il resto.** Prima di scattare, verifica
che ogni fattura, costo e cliente in archivio abbia un id `vet-`. La prima
stesura non lo faceva: dopo aver caricato la vetrina cercava un'eventuale
conferma con `/^(Carica|Sostituisci|Conferma)/`, e quel motivo corrispondeva al
pulsante «Carica «Dimostrativo · forfettario»» lì accanto. Lo premeva. Il
dimostrativo conserva le impostazioni, quindi l'archivio restava intestato a
Elena Marani in regime ordinario con sotto i documenti di un forfettario:
**quattro schermate perfettamente credibili di un'attività che non esiste.**
Nessun titolo di pagina se n'era accorto, e a occhio non si vedeva niente. Se
il controllo non passa non scrive nulla: meglio nessuna immagine che quattro
sbagliate e convincenti.

**Le misure non sono le stesse per tutte.** Le schermate a card stanno a
1440 × 900, dove il testo resta grande. Il registro dei costi no: la sua
tabella chiede 1537 px e a 1440 il contenitore gliene dà 1136, quindi scorre e
la colonna «Totale» finisce sotto la colonna delle azioni, che è appiccicata a
destra. `453,84 €` diventa `4`. Da 1920 in su ci sta tutta, e il registro si
scatta lì. La proporzione resta 16:10 per tutte e quattro, perché la pagina di
vendita è impaginata attorno a quella. Sempre a densità doppia: la pagina le
mostra attorno ai 1050 px e i file escono a 2880 o 3840.

---

## `verifica-link.mjs`

```sh
npm run build          # lo esegue da solo in coda a next build
npm run verifica:link  # su un out/ già costruito
```

Lo spostamento dell'app sotto `/app` è il tipo di modifica che rompe **in
silenzio**: un `href="/fatture"` rimasto indietro compila, passa i test, e in
produzione mostra la pagina di errore dell'hosting. Il compilatore non può
vederlo — per lui è una stringa — e nessun test di unità apre una pagina.

Lo strumento serve `out/` da un server statico, apre ogni pagina in Chromium,
raccoglie ogni `href` e ogni `src` interno dal DOM **vivo** e chiede al
filesystem se c'è un file dall'altra parte. Segnala anche le pagine che si
aprono senza contenuto. Esce con codice 1 se trova qualcosa, così il build si
ferma.

**Perché un browser e non i file `.html`.** Le schermate dell'app stanno dentro
`SoloClient`: l'HTML esportato contiene un segnaposto, e la barra laterale —
cioè quasi tutti i link interni del prodotto — nasce dopo il montaggio. La
prima stesura leggeva i file, trovava cinque link per pagina (tutti fogli di
stile) e dichiarava che andava tutto bene. Quella col browser, alla prima
esecuzione, ha trovato un `/avvio/` rotto su diciannove pagine.

**Quello che non vede.** Le navigazioni fatte da codice — `router.push` — che
non sono link finché qualcuno non preme. Quelle le tiene la regola
`no-restricted-syntax` in `eslint.config.mjs`, che vieta di scrivere un
percorso a mano: le rotte stanno in `src/lib/rotte.ts` e si nominano da lì. Le
due cose si dividono il lavoro, il sorgente a una e il sito all'altra.

### Opzioni

```sh
node strumenti/verifica-link.mjs --cartella=out --chromium=/percorso/al/binario
```

---

## `misura-responsive.mjs`

```sh
npm run dev                  # in un terminale
npm run misura:responsive    # in un altro
```

Apre ogni schermata a 320, 375, 390 e 430 px — le larghezze vere degli iPhone,
dal SE al Pro Max — e cerca due cose che a occhio non si vedono e che si
rompono di nuovo ogni volta che una schermata cresce di un pulsante.

**Lo sfondamento orizzontale.** Quando qualcosa è più largo della finestra la
pagina scorre di lato, e su un telefono uno scorrimento orizzontale
involontario si sente come un difetto anche quando non si capisce cosa l'ha
causato. Lo strumento non dice solo «sfonda»: nomina l'elemento più profondo
che esce, con le sue classi e il suo testo, così è riconoscibile nel codice.

```
Sfondamenti (1):
  320px /dati → 331px
      <a class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounde"> «Da CSV» arriva a 331px
```

**Le aree di tocco sotto i 32 px.** Sotto quella misura il pollice manca il
bersaglio e colpisce quello che c'è sotto. Chi sta dentro un'etichetta si preme
dall'etichetta, e l'area vera è quella: il quadratino della spunta può restare
piccolo se la riga intera è premibile.

L'unico caso in cui una misura piccola è la scelta giusta è il link dentro una
frase: è alto quanto la riga di testo, e allargarlo spezzerebbe il paragrafo.
Quelli restano nell'elenco e si ignorano a ragion veduta.

Esce con codice 1 se c'è almeno uno sfondamento, così si può mettere in un
controllo automatico.

### Opzioni

```sh
node strumenti/misura-responsive.mjs \
  --url=http://localhost:3000 \
  --larghezze=320,375,390,430 \
  --rotte=/fatture,/costi \
  --json=misure.json \
  --profilo=/tmp/flowlance-misura \
  --chromium=/percorso/al/binario
```

`--rotte` accorcia il giro quando si sta lavorando su una schermata sola;
`--json` scrive il dettaglio completo, elemento per elemento.

### Due cose da sapere

**Serve un archivio con dentro qualcosa.** Una tabella vuota non misura niente:
le colonne che sfondano compaiono quando ci sono le righe. Il profilo del
browser è persistente — la prima volta apri `Dati e backup`, carica il dataset
dimostrativo, e da lì in poi lo strumento se lo ritrova. Vale la pena rifare il
giro anche in regime ordinario, dove le colonne sono di più.

**Non usa il Playwright completo.** Dipende da `playwright-core`, che non
scarica nessun browser: apre il Chrome già installato. Se sul tuo computer non
c'è, o se lo lanci su un runner, passa il binario con `--chromium=`.

### Quello che non misura

Va guardato a occhio, e sono le cose che l'ultima passata ha trovato così:
quanta testata resta prima del contenuto, se un modulo più alto dello schermo
si scorre fino al pulsante che lo chiude, se un testo troncato dice ancora
qualcosa.

---

## `diagnosi-riporti.js`

Non si lancia da terminale: si incolla nella console del browser, con l'app
aperta. Rifà i due conteggi delle fatture da incassare — quello del registro e
quello della chiusura d'anno — sull'archivio vero, e stampa solo anni e numeri:
niente nomi di clienti, niente descrizioni. Serve quando le due schermate danno
risultati diversi sullo stesso anno e la differenza non si riproduce altrove.

Le istruzioni per l'utente stanno in testa al file stesso.

---

## `diagnosi-iva-importata.js`

Come `diagnosi-riporti.js`: si incolla nella console del browser, con l'app
aperta.

Fino alla correzione, l'import da CSV proponeva alle righe **senza aliquota nel
file** l'aliquota ordinaria di legge — il 22 % dei parametri — invece di quella
dichiarata nelle impostazioni. Chi fattura al 10 % o al 4 % si è visto scrivere
22 su quelle righe. La correzione vale da adesso: le righe già in archivio
restano come sono, e questo script le elenca senza toccarle.

**Nessuna migrazione automatica è possibile**, e non è una scorciatoia: un 22 %
può essere giustissimo anche dentro un'attività che di norma fattura al 10 %.
Correggerle d'ufficio sarebbe rifare lo stesso errore al contrario.

Tre limiti da sapere prima di leggere l'elenco:

- **Non sa quali righe vengono da un CSV.** Le righe non portano la loro
  provenienza, e la tabella `importazioni` tiene solo l'ultimo import, perché è
  la rete per annullarlo e non un registro storico. L'elenco è per **sintomo**,
  non per origine: una riga scritta a mano al 22 % ci finisce dentro come una
  importata.
- **Il sospetto è il 22 % esatto**, perché è il valore che il codice sbagliato
  scriveva. Se in un anno l'aliquota dichiarata è già il 22 %, in quell'anno il
  difetto non può aver prodotto niente: l'anno viene saltato e lo script lo
  dice.
- **In forfettario non si applica**: l'import proponeva zero, che è corretto.

Per ogni riga stampa imponibile, aliquota sulla riga, aliquota dichiarata e le
due IVA a confronto — quella che c'è e quella che ci sarebbe. A differenza di
`diagnosi-riporti.js` questo elenco contiene dati veri: è da guardare, non da
incollare in una segnalazione.

---

## `diagnosi-chiave.mjs`

```sh
npm run licenza:stato
```

Stampa cosa vede l'app quando cerca la chiave pubblica: ogni costante del file,
la lunghezza in byte una volta decodificata, il verdetto. Serve quando l'app
dice di non avere una chiave e il file sembra a posto.
