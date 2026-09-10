# Contenuti

I testi che il sito pubblica così come sono. Uno per pagina, in Markdown, senza
niente intorno.

| File | Pagina |
|---|---|
| `privacy.md` | `/privacy` |
| `termini.md` | `/termini` |
| `cookie.md` | `/cookie` |

`APPROSSIMAZIONI.md` sta alla radice del repository e non qui, perché è citato
da cinque punti del codice come documento del progetto prima ancora che come
pagina. Si pubblica allo stesso modo, su `/cosa-non-calcola`.

## La regola

**Aggiornare un testo è cambiare questo file e nient'altro.** Non la pagina,
non un componente, non una costante da qualche parte. Questi documenti
cambiano quando torna il legale, e ogni pezzo di testo che finisse nel codice
sarebbe un pezzo che al giro dopo qualcuno dimentica di aggiornare — o peggio,
che aggiorna solo lì, lasciando due versioni dello stesso obbligo.

Ne discendono tre conseguenze pratiche:

- **La data in testa al file è quella pubblicata.** Sta nella riga in corsivo
  sotto il titolo, la pagina la legge da lì. Non esiste una data scritta
  altrove da tenere allineata: cambiare il testo senza cambiare la data è
  possibile, ma è una scelta, non una svista di due posti che divergono.
- **Il numero di versione, dove c'è, sta nella stessa riga.** I Termini portano
  `*Versione 2 — 10 settembre 2026*` invece di `*Ultimo aggiornamento: …*`, e la
  differenza non è di stile: un contratto non si aggiorna, se ne conclude un
  altro, e la versione è il nome di quello che governa un ordine già fatto. Da
  quel numero escono il nome del PDF (`flowlance-termini-v2.pdf`), la versione
  mostrata in pagina e quella scritta dentro il file. Un test verifica che non
  compaia scritto a mano da nessun'altra parte del codice.
- **Le pagine non aggiungono e non riassumono.** Titolo, data, corpo. Se un
  documento deve dire una cosa in più, la dice il documento.

Il Markdown è convertito **a tempo di build**: `marked` gira in Node durante
`next build` e non entra nel bundle che l'utente scarica. Un renderer scritto a
mano si sarebbe rotto al primo costrutto nuovo che il legale usa — una tabella,
una nota, un elenco annidato — e si sarebbe rotto in silenzio, mostrando la
sintassi grezza a chi legge le condizioni di vendita.

## I Termini in PDF

I Termini, e solo loro, hanno un PDF: il punto 3 dice che si trasmettono
all'acquirente in quella forma, con l'indicazione della versione, prima della
consegna della chiave.

Il PDF lo **genera il build** da questo stesso file — `src/lib/contenuti/pdf-termini.ts`,
chiamato da `next.config.ts` — quindi non è una seconda copia da tenere
allineata: è la stessa. Il renderer conosce titolo, sezione, paragrafo,
grassetto ed elenco puntato, e **si ferma** davanti a qualunque altra forma
invece di saltarla. Un contratto con dentro un pezzo in meno, e nessuno che lo
dica, è il caso peggiore che questa cartella possa produrre.

In testa alla prima pagina c'è la carta intestata: il marchio — **letto da
`src/app/icon.svg`**, non ridisegnato, così il logo del contratto e quello
dell'app non possono divergere — e i dati della ditta. Sulle pagine successive
non c'è niente in alto: le identifica il piede, che dice più di un logo —
documento, versione e quale pagina è.

Il file è deterministico: due build, gli stessi byte. La sua impronta SHA-256 è
stampata accanto al link, e serve a chi fra due anni deve dimostrare che il PDF
nel proprio fascicolo è questo.

Che le pagine siano fatte bene lo verifica `termini.test.ts` **misurandole**:
un piede per pagina, dentro quella pagina, nella fascia bassa; nessun foglio
vuoto; nessuna pagina che si interrompe a metà. Non cercando il testo del
piede — quella verifica c'era, e ha lasciato passare un PDF di otto pagine in
cui il contratto stava sulle prime quattro e i quattro piedi su quattro pagine
vuote in fondo. Per guardarlo davvero: `npm run anteprima:pdf`.

Il PDF di ogni versione resta: `flowlance-termini-v2.pdf` non sostituisce
`flowlance-termini-v1.pdf`. Il punto 12 dice che per le licenze in corso valgono
i termini accettati all'acquisto, e un ordine vecchio deve continuare a puntare
al testo che lo governava.

## Cosa un cambio di testo può portarsi dietro

Un testo nuovo può creare un obbligo che il prodotto non soddisfa ancora. È
successo alla prima revisione: i Termini hanno cominciato a dire che in fase di
acquisto si dichiara se si agisce da Consumatore o da Professionista, e il
checkout non esiste. Quello che i testi promettono e il prodotto non fa ancora
sta in [`CHECKOUT.md`](../CHECKOUT.md), alla radice.

Alla quarta revisione — la versione 2 — è successo di nuovo, in piccolo: il
testo era un file solo, ma la **riga in corsivo** ha cambiato forma, da «Ultimo
aggiornamento» a «Versione N —», e quella riga la legge il codice. Un cambio di
testo resta un file solo; un cambio di *struttura* del testo no, ed è giusto che
si veda.
