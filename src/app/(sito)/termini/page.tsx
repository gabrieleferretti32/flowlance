import { leggiPagina } from "@/lib/contenuti/pagine";
import { improntaPdfTermini, indirizzoPdfTermini } from "@/lib/contenuti/pdf-termini";
import { SITO } from "@/lib/rotte";
import { metadatiDi } from "@/lib/sito/metadati";
import { PaginaDiTesto } from "../pagina-di-testo";

const pagina = leggiPagina(SITO.termini);

export const metadata = metadatiDi(SITO.termini);

/**
 * I Termini, con accanto il file che si allega agli ordini.
 *
 * La versione, l'indirizzo del PDF e la sua impronta escono tutti e tre dallo
 * stesso posto — il file in `contenuti/` e il PDF che il build ne ricava — e
 * nessuno dei tre è scritto qui. Il giorno che il legale consegna la versione
 * 3, questa pagina non si tocca.
 */
export default function Pagina() {
  if (pagina.versione === null) {
    throw new Error(
      "contenuti/termini.md non porta la riga «*Versione N — data*».\n"
        + "Da lì escono il nome del PDF, la versione mostrata e quella scritta dentro il file:\n"
        + "senza, la pagina dovrebbe inventarne una.",
    );
  }
  return (
    <PaginaDiTesto
      pagina={pagina}
      allegato={{
        versione: pagina.versione,
        indirizzo: indirizzoPdfTermini(pagina.versione),
        impronta: improntaPdfTermini(pagina.versione),
      }}
    />
  );
}
