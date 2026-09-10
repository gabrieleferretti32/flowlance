/**
 * I testi pubblicati, letti dai file e convertiti a tempo di build.
 *
 * Uno per pagina, in Markdown, senza niente intorno: aggiornare un testo è
 * cambiare quel file e nient'altro. Non la pagina, non un componente, non una
 * costante da qualche parte. Questi documenti cambiano quando torna il legale,
 * e ogni pezzo di testo che finisse nel codice sarebbe un pezzo che al giro
 * dopo qualcuno dimentica — o peggio, che aggiorna solo lì, lasciando due
 * versioni dello stesso obbligo.
 *
 * Gira in Node durante `next build`: `marked` sta fra le dipendenze di
 * sviluppo e non entra nel bundle che l'utente scarica. Un renderer scritto a
 * mano si sarebbe rotto al primo costrutto nuovo — una tabella, una nota, un
 * elenco annidato — e si sarebbe rotto in silenzio, mostrando la sintassi
 * grezza a chi legge le condizioni di vendita.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";
import { SITO } from "@/lib/rotte";

export type PaginaTesto = {
  /** Il titolo, preso dall'`# ` in testa al file. */
  titolo: string;
  /**
   * La data dell'ultimo aggiornamento, presa dalla riga in corsivo sotto il
   * titolo. `null` quando il file non ce l'ha: si vede subito, invece di
   * mostrare una data inventata sotto un documento legale.
   */
  aggiornatoIl: string | null;
  /**
   * Il numero di versione, dove il documento ne porta uno.
   *
   * **Si legge da qui e da nessun altro posto.** I Termini si trasmettono
   * all'acquirente in PDF con l'indicazione della versione, e il punto 12 dice
   * che per le licenze in corso valgono i termini «nella versione indicata in
   * testa al documento trasmesso». Un numero scritto due volte — nel file e in
   * una costante — è un numero che al giro dopo dice due cose diverse, e in
   * quel caso la differenza sarebbe fra il contratto che si crede di aver
   * concluso e quello che si è concluso davvero. Una tagliola lo verifica sul
   * sorgente.
   *
   * `null` per i documenti che non sono contratti: la privacy policy e
   * l'elenco delle approssimazioni portano una data e basta.
   */
  versione: number | null;
  /** Il corpo, già in HTML. Titolo, data e versione sono stati tolti: li mette la pagina. */
  html: string;
};

/** I file, e a quale indirizzo escono. La tabella è questa e basta. */
export const PAGINE_DI_TESTO = {
  [SITO.privacy]: { file: "contenuti/privacy.md", nome: "Privacy" },
  [SITO.termini]: { file: "contenuti/termini.md", nome: "Termini" },
  [SITO.cookie]: { file: "contenuti/cookie.md", nome: "Cookie" },
  /*
    APPROSSIMAZIONI.md sta alla radice e non in `contenuti/` perché è citato da
    cinque punti del codice come documento del progetto prima ancora che come
    pagina. Si pubblica allo stesso modo — ed è un argomento di vendita, non un
    allegato tecnico: dice cosa il prodotto non calcola prima che lo scopra chi
    l'ha comprato.
  */
  [SITO.approssimazioni]: { file: "APPROSSIMAZIONI.md", nome: "Cosa Flowlance non calcola" },
} as const;

export type IndirizzoDiTesto = keyof typeof PAGINE_DI_TESTO;

/**
 * Le due forme della riga in corsivo sotto il titolo.
 *
 * `*Ultimo aggiornamento: 9 settembre 2026*` per i documenti che si aggiornano,
 * `*Versione 2 — 10 settembre 2026*` per quelli che si **sostituiscono**. La
 * differenza non è di stile: un contratto non si aggiorna, se ne conclude un
 * altro, e la versione è il nome di quello che governa un ordine già fatto.
 *
 * Tutte e due si tolgono dal corpo e si rimettono in testa alla pagina.
 */
const RIGA_DATA = /^\*Ultimo aggiornamento:\s*(.+?)\s*\*$/m;
const RIGA_VERSIONE = /^\*Versione\s+(\d+)\s*[—–-]\s*(.+?)\s*\*$/m;

export function leggiPagina(indirizzo: IndirizzoDiTesto): PaginaTesto {
  const { file } = PAGINE_DI_TESTO[indirizzo];
  const grezzo = readFileSync(join(process.cwd(), file), "utf8");

  const titolo = grezzo.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (!titolo) {
    throw new Error(`${file}: manca il titolo di primo livello. La pagina lo prende da lì.`);
  }
  const conVersione = grezzo.match(RIGA_VERSIONE);
  const versione = conVersione ? Number(conVersione[1]) : null;
  const aggiornatoIl = conVersione ? conVersione[2] : (grezzo.match(RIGA_DATA)?.[1] ?? null);

  /*
    Titolo e data escono dal corpo: la pagina li mette lei, in testa, con la
    sua tipografia. Lasciarli dentro avrebbe significato un `h1` dentro il
    corpo e un altro nell'intestazione, cioè due titoli per un documento solo.
  */
  const corpo = grezzo
    .replace(/^#\s+.+$/m, "")
    .replace(RIGA_DATA, "")
    .replace(RIGA_VERSIONE, "");

  return { titolo, aggiornatoIl, versione, html: marked.parse(corpo, { async: false }) };
}
