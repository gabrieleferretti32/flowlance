/**
 * Le decisioni sul sito pubblico che si prendono una volta e si cambiano in
 * un posto solo.
 */

/**
 * Il sito è chiuso ai motori di ricerca.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  PER APRIRLO SI CAMBIA QUESTA RIGA, E NIENT'ALTRO: `false`.          │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Da qui discendono due cose, ed è per questo che è una costante e non due
 * copie: il `robots.txt` che il build produce, e il `<meta name="robots">` che
 * ogni pagina porta. Servono tutte e due — il file dice al crawler di non
 * passare, il meta dice a chi è passato lo stesso di non indicizzare — e se
 * fossero due valori separati, aprire il sito significherebbe ricordarsene due
 * volte.
 *
 * Vale anche per `/app`: un'applicazione che vive nel browser di chi la usa non
 * ha niente da indicizzare, e resta fuori dai motori anche il giorno in cui la
 * pagina di vendita ci entra.
 */
export const CHIUSO_AI_MOTORI = true;

/** Il dominio, per gli indirizzi assoluti che i metadati richiedono. */
export const DOMINIO = "https://flowlance.it";

/**
 * Il Payment Link di Stripe.
 *
 * `"DA-CREARE"` finché il collegamento non esiste: stessa forma del segnaposto
 * della chiave pubblica, e stessa ragione. Una pagina che manda su un indirizzo
 * inventato prende i soldi di nessuno e li perde in silenzio; una che dichiara
 * di non essere pronta si vede subito.
 *
 * Sta qui e non accanto al resto dell'acquisto perché **lo legge
 * `next.config.ts`**, che gira in Node prima di qualunque cosa React: il
 * presidio che impedisce di aprire il sito ai motori senza saper vendere ha
 * bisogno di questo valore, e questo file non importa niente da nessuna parte.
 * `src/lib/sito/acquisto.ts` lo riespone per le pagine, che è dove si usa.
 */
export const PAYMENT_LINK = "DA-CREARE";

/**
 * I codici dei due strumenti di misurazione.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché costanti e non variabili d'ambiente
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Con `output: "export"` non c'è un server che legga niente a runtime: una
 * `NEXT_PUBLIC_*` verrebbe **sostituita nel bundle durante il build**, e
 * finirebbe nel file JavaScript che il browser scarica esattamente come una
 * costante scritta qui. La differenza non è la riservatezza — è che con la
 * variabile il valore sparisce dal repository: nessuno può più dire quale
 * codice è configurato senza fare un build o aprire un pannello.
 *
 * E riservatezza non ce n'è da proteggere: un identificativo di misurazione sta
 * in chiaro in ogni pagina che carica il tag, per costruzione. È una
 * configurazione pubblica, non un segreto — e le configurazioni pubbliche di
 * questo progetto stanno scritte dove si leggono.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Dove NON stanno, ed è la parte che conta
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Questi codici li usa `src/components/sito/statistiche.tsx`, montato dal
 * layout di `(sito)`, che **non avvolge `/app`**. La promessa «dentro
 * l'applicazione non c'è nessuna misurazione» non poggia su una condizione da
 * ricordarsi: poggia su dove sta quel file nell'albero delle rotte. Una
 * tagliola verifica che nessun modulo raggiungibile da `/app` importi da qui.
 */
export const MISURAZIONE = {
  /** Google Analytics 4 — Google Ireland Ltd. */
  ga4: "G-QGDZ2CZBEW",
  /** Microsoft Clarity — Microsoft Ireland Operations Ltd. */
  clarity: "yfg22ehfxn",
} as const;
