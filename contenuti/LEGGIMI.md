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

Ne discendono due conseguenze pratiche:

- **La data in testa al file è quella pubblicata.** Sta nella riga in corsivo
  sotto il titolo, la pagina la legge da lì. Non esiste una data scritta
  altrove da tenere allineata: cambiare il testo senza cambiare la data è
  possibile, ma è una scelta, non una svista di due posti che divergono.
- **Le pagine non aggiungono e non riassumono.** Titolo, data, corpo. Se un
  documento deve dire una cosa in più, la dice il documento.

Il Markdown è convertito **a tempo di build**: `marked` gira in Node durante
`next build` e non entra nel bundle che l'utente scarica. Un renderer scritto a
mano si sarebbe rotto al primo costrutto nuovo che il legale usa — una tabella,
una nota, un elenco annidato — e si sarebbe rotto in silenzio, mostrando la
sintassi grezza a chi legge le condizioni di vendita.

## Cosa un cambio di testo può portarsi dietro

Un testo nuovo può creare un obbligo che il prodotto non soddisfa ancora. È
successo alla prima revisione: i Termini hanno cominciato a dire che in fase di
acquisto si dichiara se si agisce da Consumatore o da Professionista, e il
checkout non esiste. Quello che i testi promettono e il prodotto non fa ancora
sta in [`CHECKOUT.md`](../CHECKOUT.md), alla radice.
