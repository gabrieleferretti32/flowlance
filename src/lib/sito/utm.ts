/**
 * I parametri di campagna sui collegamenti interni.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Dove si mettono, e soprattutto dove no
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Servono a sapere quanta parte di chi compra è passata dal simulatore: è il
 * numero che dice se quella pagina vale i soldi degli annunci. Li legge Google
 * Analytics, che vive **solo** sulle pagine di `(sito)` — montato dal guscio di
 * `(sito)`, che non avvolge `/app`.
 *
 * Da qui una conseguenza che va detta invece di scoprirla guardando un rapporto
 * vuoto: un `utm_source` su un collegamento verso `/app` non lo legge nessuno.
 * Dentro l'applicazione non c'è misurazione, in nessun caso, e quel parametro
 * resterebbe scritto nella barra degli indirizzi senza finire in nessun
 * conteggio. Non è innocuo: sarebbe una decorazione che sembra una misura, e il
 * giorno in cui si cerca «quante demo sono partite dal simulatore» si
 * troverebbe zero e si penserebbe che nessuno ci clicca.
 *
 * Perciò `conUtm` si usa sui collegamenti verso le pagine del sito — l'acquisto
 * — e i collegamenti verso la demo restano nudi.
 */

/** Le sorgenti che esistono. Una stringa libera diventa tre grafie dello stesso dato. */
export type Sorgente = "simulatore";

/**
 * La rotta con i parametri di campagna in coda.
 *
 * Prende una rotta da `SITO`, non una stringa scritta a mano: è la stessa
 * regola che tiene `eslint.config.mjs`, e vale anche qui — un `conUtm("/acquista")`
 * sopravvivrebbe a uno spostamento della pagina e porterebbe su un indirizzo
 * che non esiste.
 *
 * `trailingSlash: true` vuole la barra prima della query: senza, il sito
 * risponde con un rimando e il parametro sopravvive al rimando ma costa un
 * salto in più — su un telefono in 4G è un decimo di secondo prima del primo
 * byte.
 */
export function conUtm(rotta: string, sorgente: Sorgente, mezzo = "landing"): string {
  const conBarra = rotta.endsWith("/") ? rotta : `${rotta}/`;
  const parametri = new URLSearchParams({
    utm_source: sorgente,
    utm_medium: mezzo,
    utm_campaign: sorgente,
  });
  return `${conBarra}?${parametri.toString()}`;
}
