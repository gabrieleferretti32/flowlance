# Bozza — Prezzo garantito al rinnovo

*Bozza del 24 settembre 2026. Non pubblicata: né sul sito né nei Termini.*

Questo file serve a una cosa sola: mandare al legale una clausola da valutare,
insieme al contesto che gli serve per valutarla e alle tre domande a cui la
risposta la decide lui.

---

## Perché nasce

Sulla pagina di vendita vorremmo scrivere una riga di questo tipo:

> Da gennaio 147 €. Chi compra adesso tiene il suo prezzo al rinnovo.

È una promessa commerciale che diventa un'obbligazione contrattuale, e oggi il
contratto non la contiene. Finché non la contiene, quella riga **non va in
pagina**: la card del prezzo è stata pubblicata senza.

## Cosa dicono i Termini oggi (versione 2 — 10 settembre 2026)

- **Art. 3** — «L'acquisto dà diritto a una licenza d'uso personale, non
  esclusiva e non trasferibile, **della durata di 12 mesi** dalla data di
  emissione.» Nominativa, per un solo titolare di partita IVA.
- **Art. 4** — Alla scadenza, senza rinnovo, l'applicazione resta in sola
  lettura e i dati restano. «Il rinnovo si effettua **acquistando una nuova
  licenza** e inserendo la nuova chiave.»
- **Art. 6** — «Il prezzo della licenza è di 97 € all'anno, oltre IVA al 22 %,
  per un totale di 118,34 €.» E: «**Il rinnovo non è automatico**: alla
  scadenza l'utente decide se acquistare una nuova licenza.»
- **Art. 7** — Garanzia contrattuale di rimborso entro 30 giorni, senza
  motivazione, per l'intero importo IVA compresa, con nota di credito.

Nessuno dei due documenti dice niente sul prezzo dei rinnovi futuri. E non è
una dimenticanza: nella struttura attuale **non esiste un rinnovo**. Ogni anno
è un acquisto nuovo, e un acquisto nuovo si fa al prezzo di listino di quel
giorno. La garanzia di prezzo è quindi un'obbligazione nuova, non il
chiarimento di una esistente.

## La clausola proposta

Da aggiungere in coda all'**art. 6 — Prezzo e pagamento**:

> **Prezzo garantito al rinnovo.** Il prezzo pagato all'atto del primo acquisto
> resta applicabile ai rinnovi successivi della stessa licenza, purché il
> rinnovo avvenga entro 30 giorni dalla scadenza di quella precedente e la
> titolarità resti invariata. Il Fornitore può modificare in qualsiasi momento
> il prezzo di listino; la modifica non si applica ai rinnovi effettuati nei
> termini sopra indicati. Decorso tale termine, o in caso di cambio di
> titolarità, si applica il prezzo di listino in vigore al momento del nuovo
> acquisto.

E sulla pagina di acquisto, sotto il prezzo, la forma corta:

> Il prezzo che paghi oggi vale anche per i rinnovi, se rinnovi entro 30 giorni
> dalla scadenza. Il rinnovo non è automatico.

La clausola è **a favore dell'acquirente**, quindi non dovrebbe entrare
nell'elenco del punto 13 (clausole da approvare specificamente ex artt. 1341 e
1342 c.c.). Da confermare.

## Le tre domande

**1 · Quanto dura la garanzia.** Come è scritta sopra, dura per sempre: chi
compra oggi e rinnova ogni anno senza saltarne uno paga 97 € anche nel 2040. È
un impegno a tempo indeterminato su un prezzo, e va deciso se è quello che
vogliamo. Le alternative: un numero chiuso di rinnovi (per esempio «per i primi
tre»), oppure una durata a termine («fino al 31 dicembre 2029»), oppure la
formula aperta con una facoltà di recesso del Fornitore con preavviso. Sono
scelte commerciali prima che giuridiche, ma il testo cambia in tutti e tre i
casi.

**2 · Cosa succede se i piani diventassero due.** Oggi il prodotto è uno e
contiene tutto — è il punto della card. Se un domani esistessero un piano base e
uno avanzato, a quale si applica il prezzo garantito? Al perimetro di prodotto
comprato allora, che però non esisterebbe più con quel nome? Al piano più
vicino, deciso da noi? La clausola come è scritta lega il prezzo alla «stessa
licenza», e una licenza che cambia contenuto è un caso che il testo non copre.

**3 · Rimborso e riacquisto.** L'art. 7 dà 30 giorni per farsi rimborsare
tutto, e dice che «la licenza cessa di essere valida». Chi si fa rimborsare e
poi ricompra dopo un anno, al listino nuovo, ha ancora diritto al prezzo
garantito del primo acquisto? Il testo attuale direbbe di sì, perché parla del
«prezzo pagato all'atto del primo acquisto» senza dire che quell'acquisto
dev'essere ancora in piedi. Probabilmente va escluso in modo esplicito.

## Un vincolo pratico, che non è giuridico ma va risolto prima

C'è **un solo** collegamento di pagamento su Stripe, con un solo prezzo. Il
giorno che il listino va a 147 €, chi ha diritto ai 97 arriva sulla stessa
pagina e paga 147: oggi non esiste nessun modo di riconoscerlo. Serve un
secondo collegamento o un codice sconto dedicato ai rinnovi, e un criterio per
stabilire chi ne ha diritto — presumibilmente la chiave scaduta.

Senza quello, la garanzia sarebbe scritta nel contratto e smentita dalla cassa,
che è il modo peggiore di mantenerla.

## E l'aumento in sé

«Da gennaio 147 €» è a sua volta una dichiarazione che deve essere vera. Un
aumento annunciato e poi non praticato è pubblicità ingannevole anche fra
professionisti (d.lgs. 145/2007; il Codice del Consumo qui non si applica
perché l'acquirente è un professionista, ma quella disciplina sì). Serve che
l'aumento sia deciso davvero e con una data, prima che la riga compaia.
