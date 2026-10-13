# Emettere le licenze di Flowlance

Questa cartella contiene lo strumento con cui si firmano le licenze. **Tienila
fuori dal repository pubblico** insieme alla chiave privata: lo script non è un
segreto — l'algoritmo è standard, e la verifica lato client si aggira comunque —
ma la chiave privata sì. Con quella chiunque emette licenze valide.

`chiavi/` è già in `.gitignore`: la chiave privata non finisce in un commit
neanche per sbaglio. Se preferisci, sposta l'intera cartella `strumenti/` fuori
dal progetto: allo script non serve nient'altro che Node.

## La prima volta

```
node strumenti/licenza/genera-licenza.mjs --nuove-chiavi
```

Crea la coppia Ed25519, scrive la privata in `chiavi/privata.pem` e stampa la
pubblica. **Incolla la pubblica in `src/lib/licenza/chiave-pubblica.ts`,
sostituendo la stringa di `CHIAVE_PUBBLICA`** — quel file esporta quella sola
costante, ed è l'unica cosa da toccare.

`--privata <percorso>` vale anche qui, e scrive davvero lì: serve per una
coppia di prova, che non deve finire accanto a quella di produzione.

```
node strumenti/licenza/genera-licenza.mjs --nuove-chiavi --privata /tmp/prova/privata.pem
```

**Il comando si rifiuta di scrivere se quel file esiste già**, e non c'è nessun
`--force`. Sovrascrivere una chiave privata invalida ogni licenza emessa finora,
e non è un errore che si vede subito: si vede dai clienti che scrivono che la
chiave non funziona più. Se la sostituzione è davvero quello che si vuole, il
file vecchio si sposta a mano — un gesto in più, nel punto in cui conviene
averlo.

Se qualcosa non torna — l'app dice di non avere una chiave e il file sembra a
posto — `npm run licenza:stato` mostra cosa legge davvero l'app: il valore, la
lunghezza in byte, il verdetto e le righe di codice del file.

Finché lì c'è il segnaposto `DA-GENERARE`, `next dev` funziona e l'app dichiara
di non poter verificare nessuna licenza, senza bloccare nessuno — comodo mentre
si sviluppa. **`next build` invece si ferma**, e dice cosa manca: un'app di
produzione senza chiave pubblica uscirebbe senza alcun controllo di licenza e
senza un sintomo che lo faccia notare. Il controllo sta in `next.config.ts`, che
ogni `next build` legge comunque lo si invochi, e scarta anche una chiave
incollata a metà.

Si fa una volta sola. Rigenerare la coppia invalida tutte le licenze già
emesse, che andrebbero riemesse una per una.

**La chiave privata va salvata dove non si perde** (un password manager va
bene). Perderla significa non poter più emettere licenze per i clienti che
hai già: dovresti generare una coppia nuova, aggiornare l'app e riemettere
tutto.

## Dopo ogni acquisto — la riga da tenere nel mansionario

Una sola, con l'email dell'acquirente al posto di quella d'esempio:

```sh
node strumenti/licenza/genera-licenza.mjs cliente@esempio.it --anni 1
```

Genera **e firma**: non ci sono due passaggi. Lo script legge la chiave privata
da `chiavi/privata.pem`, firma con Ed25519 e stampa la chiave già pronta da
incollare nella risposta.

Cosa stampa, per esteso:

```
  Licenza per cliente@esempio.it
  Valida fino al 2027-09-10 compreso · emessa il 2026-09-10
  Annotata in strumenti/licenza/chiavi/emesse.jsonl

  Da mandare all'acquirente — si incolla in Impostazioni › Licenza:

FLW1.eyJlIjoiY2xpZW50ZUBlc2VtcGlvLml0IiwicyI6IjIwMjctMDktMTAiLCJkIjoiMjAyNi0wOS0xMCJ9.yFoEwgLt7B2ThQ7VsYVqjee00SRYW3HEyLD2RbcXIkYbOXKxSPaq-zySVt20gVOvHEzhHADqyeeNGY78NdzUBA
```

L'ultima riga è la chiave: si copia per intero, `FLW1.` compreso, e va
nell'email. Le due parti dopo il punto sono i dati in chiaro — email, scadenza,
data di emissione — e la firma: chiunque può leggerli, nessuno può cambiarli
senza la privata.

> La chiave d'esempio qui sopra è vera nella forma e **inutilizzabile**: viene
> da una coppia usa-e-getta creata per scrivere questa pagina e buttata subito
> dopo. Con la chiave pubblica di Flowlance non verifica.

Le altre due durate, se servono:

```sh
node strumenti/licenza/genera-licenza.mjs cliente@esempio.it --mesi 6
node strumenti/licenza/genera-licenza.mjs cliente@esempio.it 2027-09-30
```

Ogni emissione viene annotata in `chiavi/emesse.jsonl`, una riga per licenza:
serve a ritrovare una chiave quando un cliente la perde, e a sapere quando
scade.

### Chi è già cliente, e da quanto

```sh
node strumenti/licenza/genera-licenza.mjs cliente@esempio.it --storico
```

```
È la 3ª licenza per questo indirizzo — 2 rinnovi dopo il primo acquisto.
Precedenti:
  1. emessa il 2026-09-12, valida fino al 2027-09-12
  2. emessa il 2027-09-14, valida fino al 2028-09-14
```

Non emette niente e non tocca il registro: si legge soltanto. È il comando da
usare **prima** di rispondere a un'email di rinnovo, quando serve sapere che
prezzo fare. Le stesse righe compaiono comunque sopra ogni emissione vera, così
il conto si vede anche quando non lo si è chiesto.

Tre cose che fa, e che sembrano dettagli finché non costano:

- **Confronta gli indirizzi senza guardare le maiuscole.** `Mario@Example.com`
  e `mario@example.com` sono la stessa casella per qualunque server di posta, e
  trattarli come due clienti vorrebbe dire far pagare il prezzo pieno a chi ha
  diritto al rinnovo — senza che niente lo segnali, perché nel registro le due
  righe ci sono entrambe. Quando capita, lo dice.
- **Dice due numeri, non uno.** «Rinnovo n. 3» da solo è ambiguo: fra la terza
  licenza e il terzo rinnovo c'è una licenza di differenza, cioè il prezzo
  sbagliato. Si stampano tutti e due, con le date, e chi legge non deve contare.
- **Non si ferma su una riga rotta.** Un file accumulato per anni può averne
  una troncata; saltarla in silenzio farebbe risultare nuovo un cliente che non
  lo è, quindi le conta e lo dice.

La logica sta in `storico.mjs`, separata dallo script perché si possa provare
senza emettere licenze vere: `npx vitest run strumenti/licenza/storico.test.mjs`.

### L'ordine dei passi, per un acquisto vero

Dalla versione 3 dei Termini il contratto si conclude **con il pagamento**
(punto 3). Non c'è più niente da far approvare prima: l'email è una sola, ed è
una consegna.

1. arriva la notifica di pagamento da Stripe;
2. generi la chiave con la riga qui sopra;
3. mandi una sola email all'indirizzo dell'acquisto, **entro la fine del
   primo giorno lavorativo successivo alla conferma del pagamento**, con
   dentro:
   - la chiave di licenza;
   - il PDF dei Termini **nella versione che ha accettato**, con la sua
     impronta SHA-256 — quella stampata accanto al link su `/termini/`. È la
     copia su supporto durevole, ed è la prova di cosa è stato concluso;
   - in coda, la **richiesta** dei dati che Stripe non raccoglie: codice
     destinatario (o PEC) e codice fiscale. Ragione sociale, indirizzo e
     partita IVA arrivano già da Stripe. È una richiesta e non una condizione:
     la chiave è in quella stessa email e non aspetta nessuna risposta. Senza
     codice destinatario la fattura si trasmette al convenzionale `0000000`,
     che lo SdI recapita nel cassetto fiscale — rete di sicurezza, non scelta
     normale;
4. nel fascicolo dell'ordine finiscono: la ricevuta Stripe, il PDF dei Termini
   con la sua impronta, l'email di consegna e la riga di `emesse.jsonl`.

Non ci sono scadenze da tenere d'occhio dopo il pagamento, e non c'è nessun
contratto che possa non concludersi: l'unica data che resta è quella della
garanzia di rimborso, 30 giorni dal pagamento (punto 7).

## Rinnovi

Un rinnovo è una licenza nuova con la stessa email. Non c'è niente da revocare:
la vecchia scade da sola, e incollare la nuova sostituisce quella salvata.

**Da quando decorre.** Il punto 3 dei Termini: «il rinnovo acquistato prima
della scadenza della licenza in corso decorre dalla scadenza di quest'ultima,
senza perdita dei giorni già pagati». Lo fa lo strumento da solo, e non c'è
niente da calcolare a mano:

| Quando si rinnova | Da dove parte la nuova scadenza |
| --- | --- |
| prima della scadenza | dalla **scadenza della licenza in corso** |
| il giorno stesso della scadenza | dalla scadenza: la licenza vale tutto il giorno |
| dopo la scadenza | dal **giorno di emissione** |

Il resoconto lo dice quando succede: «Rinnovo anticipato: decorre dalla
scadenza della licenza in corso (2027-03-31)». È la riga da controllare, perché
è l'unico modo di accorgersi che il conto è stato fatto sulla data giusta: una
scadenza calcolata da oggi, a chi ne aveva una valida per altri cinque mesi,
sarebbe plausibile e sbagliata, e la differenza la vedrebbe solo lui.

Una data scritta a mano vince su tutto: `node genera-licenza.mjs
cliente@esempio.it 2028-06-30` emette esattamente quella.

## Rimborsi

```sh
node genera-licenza.mjs cliente@esempio.it --rimborso
node genera-licenza.mjs cliente@esempio.it --rimborso --cessa 2026-11-05
```

Annota nel registro il rimborso dell'**ultima** licenza di quell'indirizzo e la
data da cui cessa il diritto d'uso — che per il punto 4 è la data di esecuzione
del rimborso, salvo indicarne un'altra. Non emette niente, non cancella niente
e non disattiva nessuna chiave: il registro è un giornale, e la chiave non si
può spegnere a distanza. Il resoconto stampa la data da comunicare
all'interessato; il testo dell'email sta in `CHECKOUT.md`.

Il posto fra i 50 Fondatori **si libera** (punto 6-bis, comma 2) e l'ordine
degli altri non cambia: è un ordine per data di primo acquisto, e togliere una
riga non sposta le altre. `--storico` stampa quanti posti sono occupati e che
posizione ha l'indirizzo che si sta guardando.

## Cosa succede all'acquirente

- La verifica avviene nel suo browser, con Web Crypto. Nessuna richiesta di
  rete, nessun dato che esce dal dispositivo.
- Dagli ultimi 15 giorni compare un avviso discreto in testa all'app.
- Dal giorno dopo la scadenza l'app è in **sola lettura**: si consulta tutto,
  non si inserisce più niente.
- **L'esportazione del backup funziona sempre**, anche a licenza scaduta.
- Senza nessuna chiave valgono 14 giorni di prova dal primo avvio
  (`GIORNI_DI_PROVA` in `src/lib/licenza/stato.ts`; a 0 l'app parte già in sola
  lettura).
