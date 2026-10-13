import { leggiPagina } from "@/lib/contenuti/pagine";
import { SITO } from "@/lib/rotte";
import { metadatiDi } from "@/lib/sito/metadati";
import { PaginaDiTesto } from "../pagina-di-testo";

const pagina = leggiPagina(SITO.requisitiTecnici);

export const metadata = metadatiDi(SITO.requisitiTecnici);

/**
 * I requisiti tecnici: la pagina che il punto 8 dei Termini richiama.
 *
 * Si pubblica come gli altri documenti — un file in `contenuti/`, convertito
 * dal build — e non come un componente scritto a mano, per la stessa ragione
 * degli altri: quello che una clausola richiama deve stare in un posto solo, e
 * aggiornarlo deve essere cambiare quel file.
 *
 * Quello che ci va dentro lo decide `strumenti/misura-requisiti.mjs`: apre il
 * sito costruito in un browser vero e fa i gesti. Una riga che quel programma
 * non ha misurato non va su questa pagina.
 */
export default function Pagina() {
  return <PaginaDiTesto pagina={pagina} />;
}
