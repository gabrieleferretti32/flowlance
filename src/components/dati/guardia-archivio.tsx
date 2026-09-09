"use client";

import * as React from "react";
import { preparaArchivio, type StatoArchivio } from "@/lib/dati/demo-isolata";

/**
 * Decide quale archivio usa questa scheda, e monta l'app solo dopo.
 *
 * L'ordine è la sostanza di questo componente. `archivio()` è un singolo
 * costruito alla prima richiesta: se una schermata leggesse prima che la
 * decisione è presa, si aggancerebbe all'archivio vero e resterebbe lì anche
 * dopo — un visitatore vedrebbe l'archivio di chi possiede quel computer, e
 * peggio, la demo ci scriverebbe dentro. Perciò i figli non esistono finché
 * questa non ha risposto.
 *
 * Sostituisce `SoloClient` nel layout dell'app: fa la stessa cosa — non toccare
 * IndexedDB durante la generazione statica — più la scelta dell'archivio.
 */
const Contesto = React.createContext<StatoArchivio>({ demo: null, appenaCaricata: false });

export function useArchivioScelto(): StatoArchivio {
  return React.useContext(Contesto);
}

export function GuardiaArchivio({
  children,
  segnaposto = null,
}: {
  children: React.ReactNode;
  segnaposto?: React.ReactNode;
}) {
  const [stato, setStato] = React.useState<StatoArchivio | null>(null);
  const [errore, setErrore] = React.useState<string | null>(null);

  React.useEffect(() => {
    let vivo = true;
    void preparaArchivio(window.location.search)
      .then((s) => {
        if (vivo) setStato(s);
      })
      .catch((e: unknown) => {
        if (vivo) setErrore(e instanceof Error ? e.message : String(e));
      });
    return () => {
      vivo = false;
    };
  }, []);

  if (errore !== null) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-corpo font-medium">Non riesco ad aprire l&apos;archivio locale.</p>
          <p className="mt-2 text-etichetta text-inchiostro-tenue">
            {errore} — succede quando il browser blocca la memoria dei siti, per esempio in
            navigazione privata o con i dati del sito disattivati.
          </p>
        </div>
      </div>
    );
  }

  if (stato === null) return <>{segnaposto}</>;
  return <Contesto.Provider value={stato}>{children}</Contesto.Provider>;
}
