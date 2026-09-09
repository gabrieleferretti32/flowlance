import type { Metadata } from "next";
import { leggiPagina } from "@/lib/contenuti/pagine";
import { SITO } from "@/lib/rotte";
import { PaginaDiTesto } from "../pagina-di-testo";

const pagina = leggiPagina(SITO.cookie);

export const metadata: Metadata = { title: `${pagina.titolo} · Flowlance` };

export default function Pagina() {
  return <PaginaDiTesto pagina={pagina} />;
}
