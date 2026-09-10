import { leggiPagina } from "@/lib/contenuti/pagine";
import { SITO } from "@/lib/rotte";
import { metadatiDi } from "@/lib/sito/metadati";
import { PaginaDiTesto } from "../pagina-di-testo";

/*
  APPROSSIMAZIONI.md, pubblicato. Non è un allegato tecnico da nascondere in
  fondo: dire cosa il prodotto non calcola, prima che lo scopra chi l'ha
  comprato, è la cosa che lo distingue da chi promette il conto esatto.
*/
const pagina = leggiPagina(SITO.approssimazioni);

export const metadata = metadatiDi(SITO.approssimazioni);

export default function Pagina() {
  return <PaginaDiTesto pagina={pagina} />;
}
