"use client";

import * as React from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { impostaSolaLettura } from "@/lib/dati/archivio";
import type { Licenza } from "@/lib/licenza/chiave";
import { CHIAVE_PUBBLICA } from "@/lib/licenza/chiave-pubblica";
import { chiavePubblicaConfigurata, motivoChiavePubblica } from "@/lib/licenza/presidio";
import { verificaChiave } from "@/lib/licenza/verifica";
import {
  preavviso,
  solaLettura,
  statoLicenza,
  type StatoLicenza,
} from "@/lib/licenza/stato";

/**
 * La licenza, per l'interfaccia.
 *
 * In localStorage finisce solo il testo della chiave e la data del primo
 * avvio: la licenza vera si ricava verificando la firma a ogni caricamento,
 * mai fidandosi di un booleano salvato. Un `attiva: true` in localStorage
 * sarebbe una bugia comoda da scrivere a mano.
 *
 * Niente rete, in nessun ramo di questo file.
 */
type StatoStore = {
  /** La chiave incollata dall'utente, com'è. */
  chiave: string | null;
  /** Primo avvio, ISO. Da qui parte il periodo di prova. */
  inizioProva: string | null;

  /** Ricavata, non persistita. `null` finché non si è verificato niente. */
  licenza: Licenza | null;
  verificata: boolean;
  /** Il browser non sa fare Ed25519, o la build non ha una chiave pubblica. */
  nonVerificabile: string | null;

  imposta: (chiave: string | null, licenza: Licenza | null) => void;
  segnaNonVerificabile: (motivo: string | null) => void;
  avvia: (oggi: string) => void;
};

export const useLicenza = create<StatoStore>()(
  persist(
    (set, get) => ({
      chiave: null,
      inizioProva: null,
      licenza: null,
      verificata: false,
      nonVerificabile: null,
      imposta: (chiave, licenza) => set({ chiave, licenza, verificata: true }),
      segnaNonVerificabile: (motivo) => set({ nonVerificabile: motivo, verificata: true }),
      avvia: (oggi) => {
        if (!get().inizioProva) set({ inizioProva: oggi });
      },
    }),
    {
      name: "flowlance-licenza",
      // Solo i due dati grezzi: il resto si ricalcola verificando la firma.
      partialize: (s) => ({ chiave: s.chiave, inizioProva: s.inizioProva }),
      skipHydration: true,
    },
  ),
);

/**
 * Verifica la chiave salvata e accende la guardia dell'archivio.
 *
 * Si monta una volta sola, nel guscio. Finché la verifica non è finita l'app
 * resta scrivibile: bloccarla per un istante a ogni caricamento farebbe
 * lampeggiare mezza interfaccia e, alla prima riga scritta in quell'istante,
 * darebbe un errore a chi la licenza ce l'ha.
 */
export function useAvvioLicenza(oggi: string, demo = false): void {
  React.useEffect(() => {
    let vivo = true;
    /*
      Nella demo la licenza non c'entra: l'archivio è un altro, i dati sono
      inventati, e la prova che scade sarebbe il conto alla rovescia di
      qualcun altro. Peggio: alla scadenza la demo diventerebbe di sola
      lettura, e chi è entrato per provare l'app si troverebbe metà dei
      pulsanti che non rispondono senza capire perché.
    */
    if (demo) return;

    void (async () => {
      await useLicenza.persist.rehydrate();
      if (!vivo) return;

      const { chiave, avvia, imposta, segnaNonVerificabile } = useLicenza.getState();
      avvia(oggi);

      // Una build senza chiave pubblica non può verificare niente: non deve
      // nemmeno far scadere la prova, o dopo due settimane bloccherebbe tutti
      // senza lasciare a nessuno il modo di sbloccarsi.
      if (!chiavePubblicaConfigurata(CHIAVE_PUBBLICA)) {
        segnaNonVerificabile(
          `Questa build non ha una chiave pubblica utilizzabile: ${motivoChiavePubblica(CHIAVE_PUBBLICA)} Nessuna licenza può essere verificata, e l'app resta scrivibile.`,
        );
        return;
      }

      if (!chiave) {
        imposta(null, null);
        return;
      }
      const esito = await verificaChiave(chiave);
      if (!vivo) return;
      if (esito.ok) {
        imposta(chiave, esito.licenza);
        segnaNonVerificabile(null);
      } else if (!esito.verificabile) {
        // La chiave c'è ma non si può controllare: non è colpa dell'utente.
        segnaNonVerificabile(esito.motivo);
      } else {
        // Firma non valida: la chiave resta salvata perché l'utente possa
        // vederla e correggerla, ma non vale niente.
        imposta(chiave, null);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [oggi, demo]);

  const stato = useStatoLicenza(oggi);
  const bloccata = !demo && solaLettura(stato);

  // La guardia dell'archivio legge questo, a ogni scrittura.
  React.useEffect(() => {
    impostaSolaLettura(() => bloccata);
    return () => impostaSolaLettura(() => false);
  }, [bloccata]);
}

/** Lo stato della licenza qui e ora. */
export function useStatoLicenza(oggi: string): StatoLicenza {
  const licenza = useLicenza((s) => s.licenza);
  const inizioProva = useLicenza((s) => s.inizioProva);
  const verificata = useLicenza((s) => s.verificata);
  const nonVerificabile = useLicenza((s) => s.nonVerificabile);

  return React.useMemo(() => {
    if (nonVerificabile) return { esito: "nonVerificabile", motivo: nonVerificabile };
    // Prima della verifica non si sa niente: si dice «prova» con i giorni
    // pieni invece di dichiarare una scadenza che potrebbe non esserci.
    if (!verificata) return statoLicenza(null, oggi, oggi);
    return statoLicenza(licenza, inizioProva ?? oggi, oggi);
  }, [licenza, inizioProva, verificata, nonVerificabile, oggi]);
}

/** Comodo ovunque serva spegnere un pulsante. */
export function useSolaLettura(): boolean {
  const oggi = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  return solaLettura(useStatoLicenza(oggi));
}

/** I giorni che mancano, quando è il momento di dirlo. */
export function usePreavviso(): number | null {
  const oggi = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  return preavviso(useStatoLicenza(oggi));
}
