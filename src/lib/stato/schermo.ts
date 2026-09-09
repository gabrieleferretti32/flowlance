"use client";

import * as React from "react";

/**
 * Lo schermo è stretto?
 *
 * Serve nei pochi casi in cui la differenza fra telefono e scrivania non è di
 * *aspetto* ma di **comportamento**, e quindi il CSS non basta: un dettaglio
 * che su un monitor si apre accanto alla riga e sul telefono deve aprirsi
 * sotto, spingendo il contenuto. Sono due componenti diversi, non due classi.
 *
 * Ovunque la differenza sia di sole dimensioni, colori o disposizione, la
 * risposta resta una media query in Tailwind: questo hook costa un ascoltatore
 * e un ri-render, e non va speso per qualcosa che il foglio di stile sa fare.
 *
 * `useSyncExternalStore` invece di un `useEffect` con `useState`: l'app è
 * generata staticamente, e la prima passata deve dare lo stesso risultato sul
 * server e in idratazione, altrimenti React scarta l'albero. Lo snapshot
 * lato server dice «non stretto» — la forma da scrivania — e subito dopo
 * l'idratazione il valore vero prende il suo posto. Sul telefono c'è quindi un
 * fotogramma in cui vale la forma larga, ed è innocuo: in quel fotogramma non
 * c'è ancora niente di aperto da spostare.
 */
export function useSchermoStretto(massimoPx = 768): boolean {
  // `- 0.02` perché le media query di Tailwind sono esclusive sul limite
  // superiore: a 768 px esatti si è già «da scrivania», come per `md:`.
  const query = `(max-width: ${massimoPx - 0.02}px)`;

  const iscrivi = React.useCallback(
    (avvisa: () => void) => {
      const lista = window.matchMedia(query);
      lista.addEventListener("change", avvisa);
      return () => lista.removeEventListener("change", avvisa);
    },
    [query],
  );

  return React.useSyncExternalStore(
    iscrivi,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
