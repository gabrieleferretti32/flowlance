"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { catenaAnni, type AnnoCalcolato, type ArchivioPerAnni } from "@/lib/analisi/anno";
import { impostazioniPredefinite } from "@/lib/fisco/impostazioni";
import { parametriDi } from "@/lib/fisco/parametri";
import type { Impostazioni } from "@/lib/fisco/tipi";
import { archivio } from "./archivio";
import {
  chiavePercorso,
  type ContestoPercorso,
  type SituazioneApp,
  type StatoPercorso,
} from "@/lib/onboarding/percorso";
import type { Dati } from "./tipi";
import { situazioneDelMese, type SituazioneMese } from "@/lib/finanze/mese";

/**
 * Lo strato reattivo.
 *
 * `useLiveQuery` osserva le tabelle toccate dalla funzione che gli si passa:
 * poiché l'adapter delega direttamente a Dexie, la reattività funziona anche
 * leggendo attraverso l'interfaccia. Un futuro adapter remoto richiederebbe di
 * riscrivere questi hook, non il resto dell'applicazione.
 */
export function useDati(): Dati | undefined {
  return useLiveQuery(() => archivio().leggiTutto(), []);
}

export function useArchivioVuoto(): boolean | undefined {
  return useLiveQuery(() => archivio().vuoto(), []);
}

export function useImpostazioni(anno: number): Impostazioni | undefined {
  const salvate = useLiveQuery(() => archivio().impostazioni.leggi(anno), [anno]);
  return useMemo(() => {
    if (salvate) return salvate;
    if (salvate === undefined) return undefined;
    return { ...impostazioniPredefinite(parametriDi(anno)), anno };
  }, [salvate, anno]);
}

/**
 * Il calcolo completo di un anno, ricavato dai dati grezzi.
 *
 * Non è un anno isolato: `catenaAnni` percorre tutti gli anni presenti in
 * archivio in ordine, così l'anno richiesto apre con quello che gli ha lasciato
 * il precedente — saldo, accantonato, credito IVA, crediti d'imposta. Cambiare
 * regime nelle impostazioni riconfigura ogni schermata perché tutto scende da
 * qui: nessun valore calcolato è salvato da nessuna parte.
 */
export type CalcoloAnno = AnnoCalcolato;

function archivioDa(dati: Dati): ArchivioPerAnni {
  return {
    impostazioni: dati.impostazioni,
    fatture: dati.fatture,
    note: dati.note,
    costi: dati.costi,
    versamenti: dati.versamenti,
    movimentiAttivita: dati.movimentiAttivita,
    movimentiPersonali: dati.movimentiPersonali,
    chiusure: dati.chiusure,
  };
}

export function useCatenaAnni(
  anno: number,
  oggi: string,
): Map<number, AnnoCalcolato> | undefined {
  const dati = useDati();
  return useMemo(
    () => (dati ? catenaAnni(archivioDa(dati), anno, oggi) : undefined),
    [dati, anno, oggi],
  );
}

export function useCalcoloAnno(anno: number, oggi: string): CalcoloAnno | undefined {
  const catena = useCatenaAnni(anno, oggi);
  return catena?.get(anno);
}

/** Gli anni che hanno qualcosa dentro, per il selettore: sempre in ordine. */
export function useAnniDisponibili(anno: number, oggi: string): number[] {
  const catena = useCatenaAnni(anno, oggi);
  return useMemo(() => (catena ? [...catena.keys()].sort((a, b) => a - b) : [anno]), [catena, anno]);
}

// ————————————————————————————————————————————————————————————
// Percorsi di configurazione
// ————————————————————————————————————————————————————————————

/** L'avanzamento in un percorso, o `null` se non è mai stato iniziato. */
export function usePercorso(
  contesto: ContestoPercorso,
  anno: number,
): StatoPercorso | null | undefined {
  const dati = useDati();
  return useMemo(() => {
    if (!dati) return undefined;
    return dati.percorsi.find((p) => p.id === chiavePercorso(contesto, anno)) ?? null;
  }, [dati, contesto, anno]);
}

/**
 * Lo stato dell'app dal punto di vista del percorso: serve a capire quale dei
 * tre momenti si sta vivendo senza doverlo chiedere all'utente.
 */
export function useSituazione(anno: number, oggi: string): SituazioneApp | undefined {
  const dati = useDati();
  const catena = useCatenaAnni(anno, oggi);
  return useMemo(() => {
    if (!dati || !catena) return undefined;
    const precedente = catena.get(anno - 1);
    return {
      anno,
      // «Vuoto» qui significa senza documenti: le impostazioni predefinite non
      // contano, perché non le ha scelte nessuno.
      archivioVuoto: dati.fatture.length === 0 && dati.costi.length === 0,
      precedenteChiuso: precedente?.chiuso ?? false,
      cambioRegimeProposto: precedente?.regime.daProporre ?? false,
      completati: dati.percorsi.filter((p) => p.completatoIl).map((p) => p.id),
    };
  }, [dati, catena, anno]);
}

// ————————————————————————————————————————————————————————————
// Finanze personali
// ————————————————————————————————————————————————————————————

/**
 * Il mese in corso, con tutte e due le risposte: quanto permette il mese e
 * quanto permette il conto.
 *
 * Il calcolo sta in `lib/finanze/mese.ts`, che è puro e provato. Qui ci sono
 * solo le letture dall'archivio — ed è un hook e non due righe copiate in ogni
 * schermata perché due copie della stessa catena diventano due cifre diverse
 * il giorno in cui una delle due cambia.
 */
export function useSituazioneMese(anno: number, oggi: string): SituazioneMese | undefined {
  const dati = useDati();
  const catena = useCatenaAnni(anno, oggi);
  return useMemo(() => {
    const calcolo = catena?.get(anno);
    if (!dati || !calcolo) return undefined;
    return situazioneDelMese({
      anno,
      oggi,
      calcolo,
      precedente: catena?.get(anno - 1) ?? null,
      versamenti: dati.versamenti,
      conti: dati.pfConti,
      movimenti: dati.pfMovimenti,
      categorie: dati.pfCategorie,
      budget: dati.pfBudget,
      impostazioniPf: dati.pfImpostazioni[0] ?? null,
    });
  }, [dati, catena, anno, oggi]);
}
