import { PARAMETRI_2026 } from "./2026";
import type { ParametriAnno } from "../tipi";

/**
 * Parametri fiscali e previdenziali 2025 — fatti storici, non stime.
 *
 * Un anno passato si censisce come uno presente: `provvisorio: false`, perché i
 * numeri del 2025 non cambieranno più. Senza questo file l'app ricadeva sui
 * parametri dell'anno censito più vicino — il 2026 — e marcava il 2025 come
 * provvisorio, con il banner e l'export del prospetto bloccato: corretto come
 * comportamento, sbagliato come stato delle cose.
 *
 * Eredita dal 2026 solo quello che nei due anni è identico, e riscrive tutto
 * quello che cambia. La differenza che conta è lo scaglione centrale dell'IRPEF:
 * nel 2025 è il 35 %, e scende al 33 % dal 2026. Chi ha lavorato in ordinario
 * nel 2025 paga con quello.
 */
export const PARAMETRI_2025: ParametriAnno = {
  ...PARAMETRI_2026,
  anno: 2025,
  provvisorio: false,
  fonti: [
    "Legge di Bilancio 2025 (L. 207/2024) — tre aliquote IRPEF rese strutturali",
    "Allegato n. 2 alla Legge 190/2014 — coefficienti di redditività",
    "Circolare INPS n. 27 del 30 gennaio 2025 — Gestione Separata: aliquote, minimale e massimale",
    "Circolare INPS n. 38 del 7 febbraio 2025 — artigiani e commercianti",
    "Art. 13 TUIR — detrazione per redditi di lavoro autonomo",
    "Art. 1 comma 4 D.Lgs. 360/1998 — acconto dell'addizionale comunale",
  ],

  // Lo scaglione centrale del 2025 è il 35 %: il taglio al 33 % arriva col 2026.
  scaglioniIrpef: [
    { limite: 28_000, aliquota: 0.23 },
    { limite: 50_000, aliquota: 0.35 },
    { limite: null, aliquota: 0.43 },
  ],

  // Gestione Separata 2025: aliquota invariata rispetto al 2026, minimale e
  // massimale no — si rivalutano ogni anno con l'indice ISTAT.
  aliquotaGestioneSeparata: 0.2607,
  massimaleGestioneSeparata: 120_607,
  minimaleAccreditoGestioneSeparata: 18_555,

  // Artigiani e commercianti 2025: stesso minimale di reddito della Gestione
  // Separata, per coincidenza dell'anno e non per regola.
  minimaleArtigiani: 18_555,
  aliquotaEccedenzaArtigiani: 0.2448,
};
