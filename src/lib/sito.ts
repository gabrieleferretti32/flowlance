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
