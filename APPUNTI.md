# Appunti

Difetti trovati e **non** corretti, con la data. Non è una lista di cose da
fare: è una lista di cose che si sanno.

## Il criterio

*Dal 9 settembre 2026, fino al lancio.*

> Si chiude prima del lancio **solo ciò che scrive numeri sbagliati in archivio
> o li stampa su un prospetto.** Tutto il resto finisce qui, con la data, e ci
> resta.

La ragione è di tempo, non di gusto: metà delle giornate di settembre se n'è
andata in andate e ritorni su cose che non spostavano né un numero in archivio
né una riga di un documento che va dal commercialista. Chi lavora su questo
progetto **segnala e va avanti**; si ferma solo quando qualcosa supera la
soglia, e quella chiamata la fa lui.

Una voce esce da qui quando diventa un problema per qualcuno di vero, o quando
si passa da quella parte per un'altra ragione e chiuderla costa meno che
lasciarla.

---

## 10 settembre 2026 · Un accesso calcolato è invisibile alle tagliole

Le tre tagliole di `struttura.test.ts` leggono il **sorgente**: cercano
`imp.contributiFissi` come testo. Una lettura scritta `imp[campo]`, con `campo`
in una variabile, non la vedono — né quella che cerca i campi morti, né quella
sulle due fonti, né quella che tiene il registro dei derivati.

Si è visto costruendo il registro: le due addizionali venivano lette con
`imp[campo]` dentro una funzione parametrica, e la prima tagliola le ha
dichiarate morte mentre erano lette eccome. **Le due tagliole si
contraddicevano, e avevano ragione tutte e due.** La lettura è stata scritta per
esteso, così quello che il codice fa e quello che i test vedono tornano a
coincidere.

Il limite resta, e non ha una soluzione a buon mercato: chi scrivesse
`imp[nome]` in un file qualunque scavalcherebbe tutti e tre i controlli senza
che niente lo segnali. Le vie d'uscita sono due, e costano entrambe:

- **leggere l'albero sintattico** invece del testo, con il compilatore
  TypeScript come libreria. Vede gli accessi calcolati, ma non sa comunque
  dire *quale* campo si sta leggendo quando il nome arriva da una variabile:
  sposta il confine, non lo toglie;
- **rendere i campi inaccessibili**, con `Impostazioni` che espone i valori
  derivati solo attraverso il registro. È la soluzione vera, ed è una
  riscrittura del modello dati.

Nel frattempo vale una regola scritta: **nel motore fiscale i campi delle
impostazioni si leggono per nome, mai per indice.** Dove serve una funzione
parametrica, il lettore si passa come argomento — è quello che fa
`addizionale()` nel registro.

---

## 9 settembre 2026 · La stessa trappola, guardata da un lato solo

La più utile delle cose emerse oggi, e non è un difetto: è una forma.

`aritmetica.ts` conosce la coda binaria della virgola mobile e la disinnesca,
**in ingresso**, con tanto di commento che la spiega:

```ts
/**
 * `1,62 / 100` in virgola mobile fa 0,016200000000000003, e quella coda finisce
 * nell'archivio e nei backup. […]
 */
export function frazioneDaPercentuale(punti: number): number {
  return Number((punti / 100).toFixed(6));
}
```

`format.ts` non la conosceva **in uscita**. `aliquota()` decideva quanti
decimali stampare con `Number.isInteger(frazione * 100)`, e `0,29 × 100` fa
28,999999999999996: otto percentuali intere su cento — 7, 14, 28, 29, 55, 56,
57, 58 — uscivano «29,00 %» dentro una frase, che è esattamente ciò che quella
funzione esiste per evitare.

**La consapevolezza c'era e non ha attraversato il confine fra due file.** Non
è distrazione di chi ha scritto il secondo: è che una cosa saputa in un modulo
non è saputa nel progetto finché non diventa una funzione condivisa o un test.
Vale la pena rileggere questa voce prima di scrivere qualunque cosa che
converta numeri in testo, o testo in numeri.

Il difetto di `aliquota` è corretto (`4137aad`). Quello che resta è la domanda:
*quante altre cose sono guardate da un lato solo?*

---

## 9 settembre 2026 · Confronti in virgola mobile: nessun altro

Cercati in tutto `src/`: `Number.isInteger`, prodotti e quozienti confrontati
con un intero, uguaglianze secche fra numeri calcolati, il modulo `% 1`.

| Trovato | Verdetto |
|---|---|
| `backup.ts` × 2, `Number.isInteger(anno)` | Legittimi: `anno` arriva da JSON come intero |
| prodotti confrontati con un intero | nessuno |
| uguaglianze fra numeri calcolati | nessuna |
| `% 1` | nessuno |

Quello di `aliquota` era l'unico. Niente da fare, ma vale la pena sapere che è
stato cercato.

---

## 9 settembre 2026 · Chi scavalca i formattatori

AGENTS.md dice che ogni cifra e ogni data passano dai formattatori di
`src/lib/format.ts`. Misurato quanto è vero:

| Cosa | Quante | Verdetto |
|---|---|---|
| `toLocaleString`, `toLocaleDateString`, `Intl.*` fuori da `format.ts` | **0** | la regola è rispettata |
| date formattate a mano | **0** | gli `.slice(0, 10)` tagliano un timestamp ISO e poi passano da `dataEstesa` o `data` |
| `toFixed` | 4 | due legittimi, due erano difetti |

I due legittimi: `frazioneDaPercentuale` in `aritmetica.ts` (vedi sopra) e
`csv/esporta.ts`, che deve produrre `1234,50` grezzo per Excel — «mai
`1.234,50 €`», dice il suo commento.

I due difetti erano in `note.ts`, negli avvisi di riconciliazione del registro
Note di credito: `restano 1234.50 € senza fattura` e `superano l'imponibile:
12345.67 €`. Punto decimale invece della virgola, nessun separatore delle
migliaia — **un numero in formato inglese dentro una frase italiana**.
Corretti, perché erano una riga.

Da tenere presente: il campione che li ha trovati cercava `€`, e quello prima
cercava `%`. Ogni angolazione nuova ne trova un altro.

---

## 9 settembre 2026 · Le percentuali senza spazio non visibili

Nove occorrenze visibili all'utente sono state corrette. Ne restano
venticinque in `src/`, e restano com'è giusto che siano:

- **CSS e SVG** — `width="100%"`, `offset="100%"`, `basis-[calc(50%-0.25rem)]`,
  `w-[32%]`. Non sono testo.
- **Commenti** — `// Telefonia a uso promiscuo: l'IVA si detrae al 50%.` e
  simili, in nove punti. Prosa nel codice, non la legge nessun utente.
- **Una regex** in `csv/campi.ts`, che normalizza le intestazioni di un CSV.

Non c'è niente da fare. Sta qui perché la prossima persona che cerca `%` in
`src/` trovi la ragione già scritta invece di doverla ricostruire.

---

## 9 settembre 2026 · La colonna ancorata a destra, e la famiglia che manca

Le azioni di riga erano `sticky right-0`: una cella ancorata a destra si àncora
al bordo esterno dello scrollport e **a riposo copre due colonne**. Nel registro
dei costi a 1440 px erano «Totale» e «Deducibile»: `453,84 €` si leggeva `4`,
alla prima apertura, senza toccare niente.

Corretto ancorandole a sinistra (`bb827a6`). Ma correggendolo ne è nato uno
identico: spostata la colonna e non il `colSpan` del piede, i totali sono
finiti incolonnati sotto le intestazioni sbagliate — 15.057,50 € sotto
«Natura». Corretto anche quello.

**Quello che resta è la nota per il `Derivato<T>`:** la somma dei `colSpan` era
*giusta* — undici colonne, undici — e solo le posizioni erano sbagliate. Per
questo né TypeScript, né React, né i test se ne sono accorti: nessuno guarda le
coordinate, tutti guardano i conteggi. Una tagliola su questa famiglia —
«numero plausibile nella casella di un altro» — **deve confrontare coordinate,
non conteggi**: la x dell'intestazione contro la x della cella del piede, in un
browser vero. È il modo in cui l'ho trovato a mano.

Il registro deve quindi coprire due cose, non una: la **provenienza** dei
valori (da dove viene questo numero) e il loro **allineamento** (in quale
casella finisce).

---

## 9 settembre 2026 · Le righe non dicono da dove vengono

Sta in [`CHECKOUT.md`](CHECKOUT.md) al punto 5, perché è lì che serve, ma vale
anche qui: fatture, costi e note non portano la loro provenienza, e la tabella
`importazioni` tiene solo l'ultimo import. Ogni diagnosi della forma «cosa è
entrato da un import e non da una mano» è quindi per **sintomo**, non per
origine, e resta approssimata.

---

## 10 settembre 2026 · La tagliola dell'allineamento non copre le schede a 375

`strumenti/verifica-allineamento.mjs` misura i registri a 1440 e a 1024, dove
sono tabelle. Sotto i 640 gli stessi dati diventano **schede**, con etichetta e
valore uno sotto l'altro: lì non c'è nessuna colonna da sbagliare, e infatti il
difetto del `colSpan` non poteva manifestarsi. Ma lo strumento non guarda
affatto quella forma, e un'etichetta accoppiata al valore sbagliato dentro una
scheda avrebbe esattamente la stessa faccia — un numero plausibile nella
casella di un altro — senza che niente lo veda.

Non supera la soglia: le schede non stampano prospetti e non scrivono in
archivio. Ma è il posto dove nessuno ha ancora guardato, che in questo progetto
è finora stata la definizione operativa di «dove sta il prossimo difetto».

## 10 settembre 2026 · La colonna IVA dei costi si verifica solo di posizione

Nel registro dei costi il totale dell'IVA si controlla sulla colonna che sta
sopra, non sommando le righe: alcune righe portano «—» invece di un importo —
i costi senza IVA detraibile — e la somma delle sole righe con un numero non
farebbe il totale. Il controllo resta quello posizionale, che è più debole:
vede un totale finito sotto la colonna sbagliata, non un totale sbagliato nella
colonna giusta.

Per chiuderla servirebbe che «—» dicesse *quale* zero è, e quella è una
decisione sul modello, non sul controllo.

---

## 10 settembre 2026 · Due tavolozze a un digit di distanza

La pagina di vendita porta le sue tinte — `#4b5bf0`, `#0d1428`, `#f4f6fb` — e i
token dell'app ne hanno tre quasi uguali: `#4c5bf5`, `#0e1330`, `#f2f4f9`. Un
digit di differenza, invisibile a occhio, e due posti da cui parte lo stesso
colore.

Sono due copie di una tavolozza, cioè la forma che questo progetto conosce
meglio: prima o poi una si ritocca e l'altra no, e per mesi nessuno se ne
accorge perché sono tutte e due plausibili. Vanno unificate.

Non adesso, e non da chi scrive il codice: cambiare le tinte di un disegno
approvato è una decisione di prodotto. Le tinte della landing stanno tutte in
`COLORI`, in cima a `src/app/(sito)/page.tsx`, e la landing non ne usa altre:
quando si deciderà, il posto da cui partire è uno.

## 10 settembre 2026 · Su uno schermo alto 667 l'eroe non ci sta

Misurato: a 390 × 844 — l'iPhone più diffuso — i due inviti dell'apertura
stanno tutti e due sopra il banner dei cookie, e una verifica in
`strumenti/verifica-derivati.mjs` lo controlla a ogni giro.

Su uno schermo alto 667 (un iPhone SE) no: con il banner aperto la piega utile
cade a 524 punti, e il primo pulsante comincia a 572. Non è questione di
spaziature — il titolone, il paragrafo di apertura e i due pulsanti misurano
insieme più di quello schermo. Farceli stare vuol dire accorciare il testo
dell'apertura, che è una decisione sul disegno.

Non è bloccante: i due pulsanti della testata sono appiccicati in alto e non
spariscono mai, quindi l'invito resta a portata di pollice in ogni momento. Sta
qui perché il giorno in cui la pagina di vendita si rimette mano, questo è il
vincolo da tenere in mano prima di cominciare, non dopo.

## 11 settembre 2026 · L'anteprima non si rifà dentro il build, e perché

L'immagine che compare quando qualcuno incolla flowlance.it in una chat viene
disegnata da `npm run anteprima:immagine`, che apre la landing costruita in
Chromium e la fotografa. Non da `next build`, come il PDF dei Termini.

La ragione è il carattere. Flowlance spedisce Inter e Plus Jakarta Sans come
**woff2 variabili**, e per disegnare il titolo con quel carattere serve
qualcosa che sappia rasterizzare un woff2 variabile. In questo progetto non
c'è: `fontkit` — che pdfkit si porta dietro — apre il file e ne legge le
tabelle, ma `getVariation()` su un WOFF2 si rompe (ricostruisce il font dal
flusso ancora compresso), e forzando le coordinate a mano si rompe la
ricostruzione della tabella `glyf` trasformata. Il satori dentro `next/og`
accetta ttf, otf e woff, e woff2 no. E il build di Vercel non ha un browser.

Le alternative erano: mettere in repo un ttf statico del carattere (una seconda
copia della tipografia, da tenere allineata alla prima), oppure disegnare il
titolo con un carattere diverso da quello del sito — cioè un'anteprima che non
somiglia alla pagina, che è il difetto che si stava evitando.

La garanzia che si voleva resta intera, spostata: il generatore **firma il
PNG** — dentro il file, in un chunk `iTXt`, la frase disegnata e l'impronta del
marchio — e `next.config.ts` la rilegge a ogni build, quello di Vercel
compreso, e si ferma se non coincide più con `APERTURA`. L'immagine non può
restare indietro in silenzio; può solo fermare un build, dicendo il comando.

Il giorno in cui un woff2 variabile si sa rasterizzare in puro JavaScript —
o il carattere arriva anche in ttf — il generatore può entrare nel build e il
presidio diventa inutile. Fino ad allora vale la pena saperlo scritto.

## 11 settembre 2026 · Le ritenute d'acconto sui costi: cosa comporta aggiungerle

Chi paga un professionista con ritenuta è **sostituto d'imposta**: trattiene il
20 %, paga il fornitore al netto, e versa la ritenuta allo Stato con il codice
tributo 1040, entro il 16 del mese successivo al **pagamento**. Oggi Flowlance
non la vede: né nel costo, né nel cashflow, né nello scadenzario. Sono soldi che
escono e che l'app non conosce.

L'export di Fatture in Cloud porta già la colonna «Rit. acconto» sui costi,
quindi il dato c'è. Quello che manca è tutto il resto.

**Il costo diventa due movimenti di cassa, non uno.** È il punto che cambia più
cose. Oggi `calcolaCosto` produce un `totale` che è l'uscita; con la ritenuta le
uscite sono due, a due date diverse e verso due destinatari: il netto al
fornitore alla data di pagamento, la ritenuta all'erario il 16 del mese dopo.
Tutto ciò che legge «quanto è uscito» — cashflow, cumulato del cruscotto, netto
disponibile — va rivisto, perché oggi somma un numero che non corrisponde a
nessun bonifico.

**La ritenuta non è un costo.** L'imponibile resta deducibile per intero: la
ritenuta è denaro del fornitore che passa dalle tue mani. Se qualcuno registra
anche l'F24 come costo, quel denaro viene dedotto due volte. Serve che il
versamento 1040 sia un `VersamentoF24` con un tipo suo, e che il prospetto lo
tenga fuori dal reddito dicendo che lo sta tenendo fuori.

**Lo scadenzario guadagna una scadenza al mese**, con l'importo che dipende dai
costi **pagati** in quel mese — principio di cassa: l'obbligo nasce al
pagamento, non alla data della fattura. Una ritenuta su una fattura ricevuta a
gennaio e pagata a marzo si versa il 16 aprile.

**E dietro c'è un obbligo che l'app finirebbe per implicare senza dirlo**: chi
opera ritenute deve rilasciare la Certificazione Unica al percipiente entro il
16 marzo e presentarla. Mettere il numero senza nominare l'adempimento è mezzo
lavoro, e la metà che manca è quella sanzionata.

Il campo sul modello è piccolo — `ritenuta` su `Costo`, più la mappatura della
colonna nell'import. Quello che non è piccolo è la catena a valle.

## 11 settembre 2026 · Perché il numero dell'IVA non coincide con l'F24

Un'ora persa a capire perché Flowlance diceva 454,87 e l'F24 821,19. Non era un
errore dell'app: il commercialista non aveva ancora scaricato una nota di
credito, e datava alcune fatture d'acquisto per **ricezione** invece che per
documento. Nessun cliente farà quel lavoro: vedrà due numeri diversi e concluderà
che l'app sbaglia.

**L'ipotesi sulla data è verificata, ed è peggio di come era posta.** Non è che
l'app usa la data sbagliata fra due che ha: in archivio la data di ricezione
**non esiste**. `Costo` (`src/lib/fisco/tipi.ts`) ha `dataDocumento` e
`dataPagamento`, e basta. `calcolaIva` mette l'IVA detraibile nel mese di
`dataDocumento`, punto. Quindi una fattura del 28 settembre ricevuta il 3 ottobre
sta nel terzo trimestre per Flowlance e nel quarto per chi l'ha registrata.

Va detto che la regola di legge dà ragione all'app **quasi sempre**: l'art. 1 del
DPR 100/1998 lascia detrarre nel periodo dell'operazione le fatture ricevute e
registrate entro il 15 del mese successivo. Il caso in cui l'app sbaglia è
preciso: la fattura che arriva dopo quel termine, e quella di dicembre ricevuta a
gennaio — che non può stare in dicembre in nessun caso, e oggi ci sta.

**Cosa serve perché la schermata IVA lo dica, in tre pezzi che valgono anche da
soli:**

1. **Dire perché può non coincidere, con i numeri di chi legge e senza campi
   nuovi.** Oggi si può già calcolare: «3 fatture d'acquisto datate negli ultimi
   giorni del trimestre, 1.240 € di IVA. Se il tuo commercialista le ha
   registrate nel periodo successivo, il suo F24 è più alto di 1.240 €.» Una
   frase con dentro l'importo esatto dello scarto possibile spegne il sospetto
   che l'app sbagli, e costa zero al modello.

2. **Il confronto con l'F24, senza rifare i conti a mano.** Un campo dove si
   scrive quanto si è versato davvero, e la schermata scompone la differenza per
   causa candidata: acquisti al confine del periodo, note di credito emesse e non
   ancora scaricate, documenti che l'archivio non ha. Non «hai una differenza di
   366,32»: **quali righe** possono spiegarla, in ordine di importo.

3. **La data di ricezione come campo, quando si decide di aggiungerla.** Con la
   regola vera: periodo di `dataDocumento` se ricevuta entro il 15 del mese dopo,
   altrimenti periodo di `dataRicezione`, e mai a cavallo d'anno. Facoltativa:
   chi non la compila resta com'è oggi, che è giusto quasi sempre.

I primi due si fanno senza toccare l'archivio. Il terzo è una migrazione.

**Da decidere, e non da me**: questa approssimazione sulla data probabilmente va
anche in `APPROSSIMAZIONI.md`, cioè sulla pagina pubblica «cosa Flowlance non
calcola» — è esattamente il genere di cosa per cui quella pagina esiste, e si
legge prima di comprare invece che a giugno.
