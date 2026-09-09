import { Piede } from "@/components/sito/piede";

/**
 * Il guscio delle pagine pubbliche: vendita e documenti.
 *
 * Un gruppo di rotte e non una cartella vera — `(sito)` non entra
 * nell'indirizzo — perché queste pagine stanno alla radice del dominio:
 * `/privacy`, non `/sito/privacy`.
 *
 * Qui, e non nel layout di radice, perché quello che c'è dentro **non deve
 * arrivare all'applicazione**: le statistiche e il banner dei cookie vivono
 * solo da questa parte. Un `<script>` di analytics messo nel layout di radice
 * sarebbe finito anche su `/app`, che è il posto dove non deve stare per
 * nessuna ragione.
 */
export default function LayoutSito({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-fondo">
      <div className="flex-1">{children}</div>
      <Piede />
    </div>
  );
}
