import type { ParametriAnno } from "../tipi";
import { PARAMETRI_2025 } from "./2025";
import { PARAMETRI_2026 } from "./2026";
import { PARAMETRI_2027 } from "./2027";

/**
 * Registro dei parametri per anno. Aggiungere il 2027 significa creare
 * `parametri/2027.ts` e aggiungere una riga qui.
 */
export const PARAMETRI_PER_ANNO: Record<number, ParametriAnno> = {
  2025: PARAMETRI_2025,
  2026: PARAMETRI_2026,
  2027: PARAMETRI_2027,
};

export const ANNO_PIU_RECENTE = Math.max(...Object.keys(PARAMETRI_PER_ANNO).map(Number));

/**
 * Parametri dell'anno richiesto. Per un anno non ancora censito restituisce
 * quelli dell'anno più recente disponibile: meglio una stima dichiarata che un errore.
 */
export function parametriDi(anno: number): ParametriAnno {
  return PARAMETRI_PER_ANNO[anno] ?? PARAMETRI_PER_ANNO[ANNO_PIU_RECENTE];
}

/** L'anno richiesto ha parametri propri, o stiamo estrapolando? */
export function parametriSonoDellAnno(anno: number): boolean {
  return anno in PARAMETRI_PER_ANNO;
}

/**
 * L'anno più recente con parametri **definitivi**: è quello su cui ha senso
 * posizionarsi all'avvio, perché un anno provvisorio mostra numeri stimati.
 */
export const ANNO_DEFINITIVO_PIU_RECENTE = Math.max(
  ...Object.values(PARAMETRI_PER_ANNO)
    .filter((p) => !p.provvisorio)
    .map((p) => p.anno),
);

/** I parametri dell'anno sono provvisori: ereditati da un anno precedente. */
export function parametriProvvisori(anno: number): boolean {
  return parametriDi(anno).provvisorio;
}

export { PARAMETRI_2025, PARAMETRI_2026, PARAMETRI_2027 };
