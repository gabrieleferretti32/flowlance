# Mettere Flowlance online

*Ultimo aggiornamento: 10 settembre 2026.*

Il sito va online **con il noindex ancora attivo**: si pubblica per vedere che
tutto regga in rete, non per farsi trovare. Chi apre l'indirizzo vede il sito
vero; i motori di ricerca no.

---

## Cosa c'è già, e non va toccato

- `next.config.ts` esporta un sito statico (`output: "export"`): nessun runtime
  server, nessuna API, nessun segreto nel bundle. È la scelta che rende vero il
  «local-first», e vale anche in produzione.
- `vercel.json` dice a Vercel di trattare la cartella `out/` come un sito
  statico e basta, senza il costruttore Next.js. Vedi più sotto perché.
- `src/lib/sito/impostazioni.ts` tiene `CHIUSO_AI_MOTORI = true`. Da lì
  discendono il `robots.txt` e il `<meta name="robots">` di ogni pagina: si
  cambia una riga sola, il giorno che si apre.

---

## La trappola: `npm run build` non gira su Vercel

Il comando del progetto è

```
next build && node strumenti/verifica-link.mjs
```

e il secondo pezzo apre un **Chromium** per controllare che nessun link interno
sia morto. Su Vercel quel binario non c'è: lo script esce con codice 1 e la
build fallisce, dopo che `next build` è andato a buon fine — cioè con un errore
che sembra un problema del sito e non lo è.

Per questo `vercel.json` fissa `buildCommand: "next build"`. La verifica dei
link resta il cancello locale, dove il browser c'è: si passa da lì prima di
spingere, non dopo.

Per la stessa ragione `framework: null`: non c'è niente da far girare lato
server, e il costruttore Next.js di Vercel aggiungerebbe un livello che questo
progetto non usa. `out/` contiene già `privacy/index.html`, `termini/index.html`
e tutti gli altri — `trailingSlash: true` in `next.config.ts` — che qualunque
hosting statico serve com'è.

---

## I passi, in ordine

### 1 · Prima di spingere, in locale

```sh
npm run test
npm run build                 # comprende la verifica dei link
npm run verifica:derivati     # i conti delle formule del prospetto
npm run verifica:allineamento # i totali sotto la colonna che sommano
```

Se uno dei tre non passa, il deploy aspetta.

### 2 · Il progetto su Vercel

Collegare il repository, e **non toccare i campi** «Build Command», «Output
Directory» e «Framework Preset» nell'interfaccia: `vercel.json` li decide, e un
valore scritto anche nel pannello è una seconda copia che prima o poi diverge da
questa. Se il pannello mostra valori diversi, quelli giusti sono nel file.

Prima distribuzione sull'indirizzo `*.vercel.app`. Da controllare lì, prima del
dominio:

- `/` si apre e la pagina di vendita è quella giusta;
- `/privacy/`, `/termini/`, `/cookie/`, `/cosa-non-calcola/`, `/grazie/`
  rispondono;
- `/app/` apre l'applicazione e l'archivio si crea;
- `curl -s <indirizzo>/robots.txt` risponde `Disallow: /`;
- il sorgente di `/` contiene `<meta name="robots" content="noindex, nofollow">`.

### 3 · Il dominio, su Vercel

Aggiungere `flowlance.it` e `www.flowlance.it` al progetto. Vercel, subito dopo,
mostra i valori DNS da scrivere: **un record A per il dominio nudo e un CNAME
per il `www`**.

> Quei valori si leggono dal pannello di Vercel, in quel momento, e si copiano
> da lì. Non si prendono da un appunto, da una guida o da questo file: Vercel li
> ha già cambiati in passato e un indirizzo IP vecchio manda il dominio in un
> posto che non risponde, per il tempo che ci vuole a scoprirlo.

### 4 · Il DNS, su Aruba

Nel pannello Aruba, sezione DNS del dominio:

- il record **A** del dominio nudo (`@`) sul valore che Vercel ha mostrato;
- il record **CNAME** di `www` sul nome che Vercel ha mostrato.

Poi si aspetta. La propagazione va da qualche minuto a qualche ora; Vercel
segna il dominio «Valid» da solo quando la vede, e il certificato HTTPS lo
richiede senza che nessuno debba chiederglielo.

### 5 · A dominio attivo

- `https://flowlance.it/` e `https://www.flowlance.it/` rispondono tutti e due,
  in HTTPS;
- `https://flowlance.it/robots.txt` dice ancora `Disallow: /`;
- `npm run verifica:link` non serve qui: gira sul sito costruito in locale, ed è
  lo stesso.

---

## Il giorno in cui si apre ai motori

Una riga: `CHIUSO_AI_MOTORI = false` in `src/lib/sito/impostazioni.ts`. Da lì
cambiano insieme il `robots.txt` e i meta di ogni pagina. Non c'è nient'altro da
ricordarsi, ed è il motivo per cui è una costante sola.

**È l'ultimo gesto, e va dopo un acquisto vero.** Prima di toglierlo si compra
Flowlance con una carta vera e ci si rimborsa: è l'unico modo di vedere tutto il
giro — la ricevuta di Stripe, i dati che raccoglie e quelli che no, l'email dei
Termini, la chiave, l'attivazione. Un checkout che funziona in ogni sua parte
presa da sola e non funziona insieme è esattamente il difetto che questo
progetto continua a incontrare.

Un presidio tiene la combinazione impossibile: `next.config.ts` ferma un build
di produzione in cui il sito è aperto ai motori e `PAYMENT_LINK` vale ancora
`"DA-CREARE"` — un sito che si fa trovare e poi chiede di scrivere una mail per
comprare. Da quando il collegamento esiste, quel presidio è a riposo: c'è per il
giorno in cui qualcuno reimposta il segnaposto senza rimettere il noindex.

---

## Prima di spingere, sempre

```sh
npm run test
npm run build                 # timbra out/ e verifica i link
npm run verifica:derivati     # i conti delle formule, i pulsanti, i prezzi
npm run verifica:allineamento # i totali sotto la colonna che sommano
npm run verifica:consenso     # niente misurazione prima del sì, mai su /app
```

Le verifiche che aprono `out/` si **rifiutano di partire** se il sorgente è
cambiato dopo l'ultimo build riuscito: `npm run build` lascia un timbro in
`.artefatto.json`, e chi misura lo confronta. Serve perché è già capitato di
leggere verde su una cartella rimasta da un build fallito — vedi
`strumenti/LEGGIMI.md`, alla voce `artefatto.mjs`.

---

## Cosa resta fuori da questo documento

Il **checkout** è deciso e in piedi: pagina ponte, Payment Link, chiave a mano.
Quello che resta — la notifica di Stripe, le due email, l'acquisto di prova —
sta in [`CHECKOUT.md`](CHECKOUT.md), sotto «Cosa resta da fare, in ordine».
