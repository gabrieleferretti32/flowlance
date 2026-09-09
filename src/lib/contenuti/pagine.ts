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
  /** Il corpo, già in HTML. Titolo e data sono stati tolti: li mette la pagina. */
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

const RIGA_DATA = /^\*Ultimo aggiornamento:\s*(.+?)\s*\*$/m;

export function leggiPagina(indirizzo: IndirizzoDiTesto): PaginaTesto {
  const { file } = PAGINE_DI_TESTO[indirizzo];
  const grezzo = readFileSync(join(process.cwd(), file), "utf8");

  const titolo = grezzo.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (!titolo) {
    throw new Error(`${file}: manca il titolo di primo livello. La pagina lo prende da lì.`);
  }
  const aggiornatoIl = grezzo.match(RIGA_DATA)?.[1] ?? null;

  /*
    Titolo e data escono dal corpo: la pagina li mette lei, in testa, con la
    sua tipografia. Lasciarli dentro avrebbe significato un `h1` dentro il
    corpo e un altro nell'intestazione, cioè due titoli per un documento solo.
  */
  const corpo = grezzo.replace(/^#\s+.+$/m, "").replace(RIGA_DATA, "");

  return { titolo, aggiornatoIl, html: marked.parse(corpo, { async: false }) };
}
