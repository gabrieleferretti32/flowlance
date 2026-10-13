# Bozza — Perché cinque anni per le prove dei consensi

*Bozza del 12 ottobre 2026. Non pubblicata: è un documento interno di
motivazione, da rileggere e correggere prima di tenerlo agli atti.*

Questo file serve a una cosa sola: **scrivere perché il termine è cinque anni**,
in modo che la scelta sia difendibile il giorno in cui qualcuno la contesta, e
che non venga difesa con l'argomento sbagliato.

---

## Primo: non è un obbligo del GDPR, e non va presentato come tale

Il GDPR **non dice per quanto si conservano le prove di un consenso**. Dice due
cose diverse, e tutte e due vanno citate per quello che sono:

- l'art. 7.1 impone al titolare di **essere in grado di dimostrare** che
  l'interessato ha prestato il consenso, senza indicare alcun termine;
- l'art. 5.1.e impone che i dati siano conservati **per un arco di tempo non
  superiore** al conseguimento delle finalità, e l'art. 5.2 impone al titolare
  di **poter dimostrare** di aver rispettato quel principio.

Messe insieme, le due norme producono un obbligo preciso e scomodo: il termine
lo sceglie il titolare, e **deve saperlo motivare**. Un'informativa che
scrivesse «conservati per cinque anni come previsto dal GDPR» direbbe una cosa
falsa su una norma, e la direbbe in un documento che ha la funzione di
dimostrare la diligenza di chi lo ha scritto. È un autogol che si legge da
lontano.

Quindi: il termine è una **scelta motivata del Titolare**, e questo documento è
la motivazione.

---

## Secondo: i cinque anni vengono dal rischio, non da un'analogia

L'argomento che regge il termine è questo: **le prove servono finché qualcuno
può contestare**, e ciò che serve non è il dato, è la capacità di dimostrare di
averlo trattato legittimamente.

Le due contestazioni possibili, per Flowlance, sono:

1. **un reclamo al Garante** — tipicamente «ho ricevuto email che non ho mai
   chiesto». La difesa è esibire la registrazione della richiesta, la conferma
   dell'indirizzo e il testo esatto che la persona aveva davanti;
2. **una richiesta risarcitoria** ex art. 82 GDPR, che segue le regole
   ordinarie della responsabilità civile.

In tutti e due i casi il titolare ha bisogno delle prove **per tutto il tempo
in cui l'azione è esercitabile**, più il tempo del procedimento. È il motivo
per cui il termine si conta **dalla cessazione del trattamento** e non dalla
raccolta: finché le email partono, la prova di poterle mandare serve adesso.

**Perché cinque e non di più.** Dieci anni sarebbero il termine che si usa per
le scritture contabili, ed è un'analogia sbagliata: lì l'obbligo è di legge e
riguarda documenti fiscali; qui non c'è obbligo, e tenere più del necessario è
a sua volta una violazione dell'art. 5.1.e. Conservare dati personali per dieci
anni «per sicurezza» è il modo di trasformare una difesa in un illecito.

**Perché cinque e non di meno.** Due o tre anni lascerebbero scoperta una parte
del periodo in cui un'azione è ancora proponibile: ci si troverebbe convenuti
con l'onere di dimostrare una cosa di cui si è distrutta la prova — e la
distruzione sarebbe stata volontaria, documentata, e fatta con una funzione
automatica. È il verso peggiore in cui sbagliare, perché toglie al titolare
l'unica difesa che aveva.

Cinque anni è quindi il punto in cui le due direzioni si bilanciano, per un
trattamento che riguarda **un indirizzo email e la data di un clic**: il
contenuto delle registrazioni è minimo, e il rischio per l'interessato di una
conservazione di questa durata è basso proprio perché non c'è niente dentro
oltre a quello.

> **Domanda al legale.** È questa la motivazione che vogliamo tenere agli atti,
> o preferisce ancorare il termine a un riferimento diverso (per esempio il
> termine di prescrizione che ritiene applicabile all'azione ex art. 82)? Il
> numero si cambia in una riga di codice; quello che conta è che la
> motivazione scritta sia quella giusta.

---

## Terzo: la minimizzazione è già fatta a monte

La proporzionalità di un termine si giudica anche su **che cosa** resta per
quel tempo. Qui resta pochissimo, e non per promessa:

- indirizzo email, tipo di evento, data e ora;
- la versione del testo dei consensi e la sua impronta informatica;
- **nessun dato del calcolo** — non il regime, non l'accantonamento mensile,
  non le date e gli importi delle scadenze. Un test scrive un contatto pieno di
  importi e verifica che nell'evento non ne compaia nessuno.

Le tre registrazioni stanno inoltre in **archivi distinti**, con finalità e basi
giuridiche diverse, e in un magazzino **irraggiungibile dal codice che manda
email**: lo verifica uno strumento che legge il grafo degli import a partire
dalla funzione di iscrizione e fallisce se ci arriva.

---

## Quarto: la contestazione sospende la cancellazione, e si scrive

Il principio è: **in caso di contestazione si conservano le sole prove
pertinenti, fino alla definizione.** Non tutto l'archivio, e non per sempre.

Nel codice è l'elenco `BLOCCHI` in `src/lib/sito/registro-prove.ts`: ogni voce
porta l'indirizzo, la data di inizio e **il motivo**, in una riga. Finché un
indirizzo è lì dentro, la pulizia notturna non lo tocca.

Due scelte, con la loro ragione:

- **il motivo è obbligatorio** perché un blocco senza motivo diventa, in due
  anni, un indirizzo che nessuno sa più perché non si cancella — e resta lì per
  sempre, che è il modo di conservare dati senza una ragione;
- **il blocco è una riga di codice e non un pannello**, perché capita una volta
  ogni due anni: un'interfaccia per questo sarebbe codice che invecchia senza
  essere usato, e la riga si vede in una revisione, che è esattamente dove deve
  essere vista.

Quando la contestazione è definita, la voce si toglie e i termini riprendono a
correre dal giorno della cessazione — non dal giorno in cui il blocco è stato
rimosso.

---

## Che cosa resta da decidere

1. La motivazione del termine: questa, o un ancoraggio diverso (vedi sopra).
2. Se il punto f dell'informativa debba dichiarare il termine **per archivio**
   (f.1 e f.2 cinque anni, f.3 senza termine) o in un capoverso unico. Oggi la
   bozza lo dichiara per archivio.
3. Se l'elenco di esclusione vada dichiarato come trattamento autonomo o come
   misura attuativa dell'opposizione. Oggi la bozza lo mette fra gli archivi,
   con base giuridica negli artt. 21 e 17.
