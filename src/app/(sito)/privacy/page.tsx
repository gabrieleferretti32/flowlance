import { leggiPagina } from "@/lib/contenuti/pagine";
import { SITO } from "@/lib/rotte";
import { metadatiDi } from "@/lib/sito/metadati";
import { PaginaDiTesto } from "../pagina-di-testo";

const pagina = leggiPagina(SITO.privacy);

export const metadata = metadatiDi(SITO.privacy);

export default function Pagina() {
  return <PaginaDiTesto pagina={pagina} />;
}
