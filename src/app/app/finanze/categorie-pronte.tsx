"use client";

/**
 * Le categorie del modulo ci sono, o si mettono.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché serviva
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le categorie di partenza non si seminavano **da nessuna parte**:
 * né creando un archivio nuovo, né caricando un dataset, né importando un
 * backup. L'unico modo era premere un pulsante che compariva in tre schermate.
 * Chi arrivava da un backup fatto prima che il modulo esistesse — cioè
 * chiunque usasse già l'app — si trovava il registro senza categorie, e
 * l'import di un rendiconto scriveva trentasette movimenti **senza categoria**,
 * che nel limite di spesa non entrano in nessun gruppo: numeri sbagliati in
 * silenzio.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché qui, e non all'avvio dell'app
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `seminaCategorie` aveva scritto, e ha ragione: «scrivere in un archivio che
 * nessuno ha chiesto di riempire è il modo di trovarsi dentro roba che non si
 * è messa». Chi non apre mai le finanze personali non deve trovarsi
 * venti righe in archivio.
 *
 * Aprire il modulo però è chiedere di usarlo, e senza categorie il modulo non
 * funziona: ogni movimento ne vuole una. Quindi la semina sta qui — nel
 * contorno comune delle sue schermate — e non più in un pulsante che si poteva
 * non vedere. Le categorie restano tutte rinominabili ed eliminabili: sono un
 * punto di partenza, non una regola.
 */
import * as React from "react";
import { useDati } from "@/lib/dati/hooks";
import { seminaCategorie } from "@/lib/dati/azioni";

export function CategoriePronte() {
  const dati = useDati();
  /*
    Una volta sola. `seminaCategorie` si difende già da sé — se ne trova una
    non fa niente — ma fra l'effetto e la scrittura passa un attimo, e in
    quell'attimo un secondo render vedrebbe ancora l'archivio vuoto.
  */
  const fatto = React.useRef(false);

  React.useEffect(() => {
    if (!dati || fatto.current) return;
    if (dati.pfCategorie.length > 0) return;
    fatto.current = true;
    /*
      Senza avviso e senza «annulla»: non è un'azione di chi guarda, è la
      condizione perché la schermata che sta aprendo funzioni. Dove si vedono
      — in Categorie — c'è scritto che sono quelle di partenza e che si
      cambiano tutte.
    */
    void seminaCategorie({ silenziosa: true });
  }, [dati]);

  return null;
}
