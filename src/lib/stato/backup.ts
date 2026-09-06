"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PromemoriaBackup } from "@/lib/dati/promemoria-backup";

/**
 * Quando è stato fatto l'ultimo backup.
 *
 * Sta qui e non nell'archivio per due ragioni. La prima è che non è un dato
 * dell'attività: è una cosa che l'app sa su sé stessa. La seconda conta di
 * più — dentro l'archivio finirebbe **dentro il file di backup**, e chi
 * importa il backup di un altro si vedrebbe dire «hai fatto un backup il 3
 * marzo», che è la data di un'altra persona.
 *
 * In `localStorage`, quindi, insieme al resto dello stato di interfaccia. Se
 * qualcuno svuota i dati del sito, questo sparisce e l'app torna a dire «non
 * hai mai fatto un backup»: sbagliato in un senso innocuo, perché in quel caso
 * è sparito anche l'archivio, ed è la direzione giusta in cui sbagliare — un
 * avviso di troppo, mai uno di meno.
 */
type StatoBackup = {
  promemoria: PromemoriaBackup;
  segna: (promemoria: NonNullable<PromemoriaBackup>) => void;
  dimentica: () => void;
};

export const useStatoBackup = create<StatoBackup>()(
  persist(
    (set) => ({
      promemoria: null,
      segna: (promemoria) => set({ promemoria }),
      dimentica: () => set({ promemoria: null }),
    }),
    {
      name: "flowlance-backup",
      // Come le preferenze: l'app è generata staticamente, e l'idratazione va
      // fatta a mano dopo il montaggio.
      skipHydration: true,
    },
  ),
);
