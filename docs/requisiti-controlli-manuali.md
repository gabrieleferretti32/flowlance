# I controlli che non posso fare io

*Scritto il 13 ottobre 2026, per la pagina [`/requisiti-tecnici/`](../contenuti/requisiti-tecnici.md).*

La pagina dei requisiti tecnici contiene **solo cose provate**, e le prove le ha
fatte un programma (`strumenti/misura-requisiti.mjs`) su **Chromium 141, su
Linux**: è l'unico browser installato nell'ambiente da cui lavoro. Firefox e
WebKit non ci sono — ho guardato in `/opt/pw-browsers`, c'è solo Chromium —
e installarli da lì non si fa.

Quello che manca sta in fondo alla pagina, sotto «Quello che non abbiamo ancora
verificato», scritto come quello che è: non verificato. **Questi dieci
controlli lo tolgono da lì.** Sono circa quindici minuti in tutto, e vanno
fatti sul sito pubblicato (flowlance.it), non in locale.

Per ciascuno serve una riga di risposta: **sì / no / cosa è successo**. Quando
me le mandi le porto in pagina, con la data e il browser accanto.

## Safari su Mac (5 minuti)

1. **Si apre.** Vai su `flowlance.it/app/` con Safari. L'applicazione compare?
2. **Scrive e rilegge.** Carica il dataset dimostrativo (il pulsante
   «Dimostrativo · forfettario» nella barra in alto), poi **ricarica la
   pagina**: i dati sono ancora lì?
3. **Esporta.** Dalle impostazioni, esporta l'archivio: scarica un file `.json`?
   Che dimensione ha?
4. **Stampa.** Apri `flowlance.it/app/fisco` e fai Cmd+P: il prospetto si
   compone su una pagina leggibile, o esce tagliato?
5. **Senza rete.** Con la scheda aperta, spegni il Wi-Fi e cambia schermata
   dentro l'applicazione: continua a funzionare? Poi **ricarica**: cosa compare
   — una pagina di errore di Safari, o l'applicazione?

## Safari su iPhone (4 minuti)

6. **Si consulta.** Apri `flowlance.it/app/` dal telefono: si legge senza
   scorrimento laterale? Quali schermate dicono che servono da computer?
7. **Si installa.** Segui `flowlance.it/app/installa` (Condividi → «Aggiungi a
   Home»). L'icona compare? Aprendola **dall'icona**, l'applicazione si apre a
   schermo pieno, senza la barra di Safari?
8. **I dati dell'app installata sono gli stessi?** Nella versione installata
   carica il dataset dimostrativo, chiudi, riapri **dall'icona**: i dati ci
   sono? E aprendo lo stesso indirizzo in Safari normale, li vedi o no? (Mi
   serve la risposta esatta: sono due archivi separati oppure uno.)

## Firefox, su Mac o su Windows (3 minuti)

9. Gli stessi tre gesti del punto 1-3: si apre, scrive e rilegge dopo una
   ricarica, esporta.

## Chrome o Edge veri, su Windows (3 minuti)

10. Gli stessi tre gesti del punto 1-3, più la stampa del punto 4. Qui mi
    aspetto che vada: ho provato il motore su cui sono costruiti, non i
    programmi. Serve a poterlo scrivere.

---

## E una verifica di lettura, se vuoi essere sicuro di quello che ho scritto

Ho aggiunto alla pagina una sezione su Safari che cancella da sé i dati dei
siti non installati. **Non viene da una pagina di documentazione**: webkit.org,
da dove lavoro, è bloccato dal proxy di rete. Viene dal **codice sorgente di
WebKit**, che invece ho potuto leggere
(`Source/WebKit/NetworkProcess/Classifier/ResourceLoadStatisticsStore.cpp`, ramo
`main`):

- `operatingDatesWindowShort { 7 }` e `operatingDatesWindowLong { 30 }`, in
  **giorni di uso del browser** (la tabella `OperatingDates`, non il calendario);
- `shouldRemoveAllButCookiesFor()` usa la finestra **corta** quando il sito è
  segnato `DataRemovalFrequency::Short`, cioè quando ci si è arrivati da un
  collegamento con parametri di tracciamento provenienti da un dominio
  «prevalente» (`logCrossSiteLoadWithLinkDecoration`); altrimenti usa quella
  **lunga**;
- la cancellazione riguarda `domainsToDeleteAllScriptWrittenStorageFor` —
  localStorage, IndexedDB, cache — **non** i cookie. L'archivio di Flowlance è
  IndexedDB, quindi è dentro;
- il valore predefinito è attivo: `m_firstPartyWebsiteDataRemovalMode {
  FirstPartyWebsiteDataRemovalMode::AllButCookies }`;
- un'interazione dell'utente **azzera il conto**
  (`hasHadUnexpiredRecentUserInteraction`);
- e l'esenzione, con le parole del commento nel sorgente: *«Domains permanently
  configured to be exempt. This can be home screen web applications, app-bound
  domains, or similar»* — `domainsExemptFromWebsiteDataDeletion()` contiene
  `m_standaloneApplicationDomain`.

**Quello che il sorgente non dice**, e che resta da verificare: se e come
Safari/iOS popoli quel campo quando un sito viene aggiunto alla schermata Home.
Quella parte è nel codice chiuso di Apple. È per questo che il punto 8 della
lista chiede di guardarlo dal vivo: se l'app installata ha un archivio suo, è
anche la conferma pratica dell'esenzione.

Se preferisci confermarlo da una fonte pubblica, l'annuncio originale è
«Full Third-Party Cookie Blocking and More», sul blog di WebKit (marzo 2020):
apri `webkit.org/blog/10218/` da un browser qualunque — a me risponde 403 dal
proxy.
