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
