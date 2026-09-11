"use client";

import * as React from "react";
import {
  CHIAVE_ACQUISTI,
  CONTENUTO,
  VALORE,
  acquistiContati,
  conAcquisto,
  identificativoAcquisto,
  improntaAcquisto,
  tracciaMeta,
} from "@/lib/sito/pixel";

/**
 * `Purchase`, con i tre presidi.
 *
 * Non disegna niente: esiste per far partire un evento una volta sola, e la
 * ragione per cui è un componente a sé è che `/grazie` resta una pagina server
 * con i suoi metadati.
 *
 * I tre presidi e il residuo stanno in `src/lib/sito/pixel.ts`. Qui c'è solo
 * l'ordine in cui si applicano: se manca il parametro di ritorno non si conta;
 * se quell'acquisto è già stato contato in questo browser non si riconta; e
 * quello che parte porta l'impronta come `eventID`, così Meta scarta un
 * doppione che fosse sfuggito alle prime due.
 */
export function AcquistoContato() {
  React.useEffect(() => {
    const id = identificativoAcquisto(window.location.search);
    if (id === null) return;

    let annullato = false;
    try {
      const gia = acquistiContati(localStorage.getItem(CHIAVE_ACQUISTI));
      if (gia.includes(id)) return;
      /*
        Si segna **prima** di mandare, non dopo. Fra la chiamata e la scrittura
        ci sta un ricaricamento, e in quel caso è meglio perdere un evento vero
        che contarne due: il numero serve a una campagna che impara, e impara
        peggio da un doppione che da un buco.
      */
      localStorage.setItem(CHIAVE_ACQUISTI, JSON.stringify(conAcquisto(gia, id)));
    } catch {
      // Memoria bloccata: si conta comunque, e la deduplica resta a Meta
      // tramite l'eventID. È la direzione giusta in cui sbagliare.
    }

    void improntaAcquisto(id).then((impronta) => {
      if (annullato) return;
      tracciaMeta("Purchase", { ...CONTENUTO, ...VALORE }, { eventID: impronta });
    });

    return () => {
      annullato = true;
    };
  }, []);

  return null;
}
