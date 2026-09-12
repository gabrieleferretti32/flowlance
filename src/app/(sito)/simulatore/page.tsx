import { SITO } from "@/lib/rotte";
import { metadatiDi } from "@/lib/sito/metadati";
import { SchermataSimulatore } from "./schermata-simulatore";

export const metadata = metadatiDi(SITO.simulatore);

/**
 * Il simulatore pubblico.
 *
 * La pagina non calcola niente e non passa niente: il conto si fa nel browser,
 * a ogni battuta, con il motore vero. Non c'è un `getStaticProps` con dentro
 * dei risultati precotti perché non ci sono risultati da precuocere — e non
 * c'è niente che esca dal browser, che è la promessa scritta in cima.
 */
export default function Simulatore() {
  return <SchermataSimulatore />;
}
