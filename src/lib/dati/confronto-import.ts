/**
 * Che cosa succede se importo questo file.
 *
 * Importare un backup non aggiunge: **sostituisce**. Finché l'archivio è vuoto
 * non c'è niente da dire — è il gesto che salva chi ha cambiato computer, e
 * mettergli davanti una domanda sarebbe attrito su una persona già in
 * difficoltà. Quando invece l'archivio contiene qualcosa, quel gesto cancella
 * lavoro, e va letto prima di essere confermato.
 *
 * Modulo puro: conta e confronta, non scrive niente. Serve a costruire una
 * frase vera — «hai 28 fatture, il file ne porta 2» — invece di un generico
 * «sei sicuro?», che è la domanda a cui si risponde sempre di sì.
 */
import { COLLEZIONI, type Dati, type NomeCollezione } from "./tipi";
import type { Regime } from "@/lib/fisco/tipi";

/** Le collezioni che contano come «documenti»: quello che si perde davvero. */
export const COLLEZIONI_DOCUMENTO: NomeCollezione[] = [
  "fatture",
  "note",
  "costi",
  "clienti",
  "versamenti",
  "movimentiPersonali",
  "movimentiAttivita",
  "patrimonio",
];

export type RigaConfronto = {
  collezione: NomeCollezione;
  adesso: number;
  nelFile: number;
  /** Quante righe spariscono: è il numero che va letto, non la differenza netta. */
  perse: number;
};

/**
 * Un cambio che non si vede contando le righe.
 *
 * Il regime è il caso grave: da lui discende tutto il calcolo — imposta
 * sostitutiva o IRPEF, costi deducibili o no, IVA in fattura o no — e oggi
 * cambiava senza che nessuno lo dicesse. Il nome è meno grave e più
 * eloquente: se cambia, il file è di un altro archivio.
 */
export type CambioDiIdentita = {
  campo: "nome" | "regime";
  anno: number;
  adesso: string;
  nelFile: string;
};

export type ConfrontoImport = {
  /** Non c'è niente da perdere: l'import può procedere senza domande. */
  archivioVuoto: boolean;
  righe: RigaConfronto[];
  documentiOra: number;
  documentiNelFile: number;
  /** Quante righe l'import cancella in tutto, su tutte le collezioni. */
  documentiPersi: number;
  cambi: CambioDiIdentita[];
  /** Quando è stato esportato il file, se lo dichiara. */
  esportatoIl: string | null;
};

function conta(dati: Dati): Record<NomeCollezione, number> {
  const out = {} as Record<NomeCollezione, number>;
  for (const c of COLLEZIONI) out[c] = dati[c].length;
  return out;
}

function nomeRegime(r: Regime): string {
  return r === "forfettario" ? "forfettario" : "ordinario";
}

/**
 * I cambi di identità, anno per anno.
 *
 * Si guardano solo gli anni presenti in **entrambi**: un anno che c'è solo di
 * qua o solo di là non è un cambio, è una riga in più o in meno, e la conta
 * delle collezioni lo dice già.
 */
function cambiDiIdentita(attuale: Dati, nelFile: Dati): CambioDiIdentita[] {
  const cambi: CambioDiIdentita[] = [];
  const perAnno = new Map(nelFile.impostazioni.map((i) => [i.anno, i]));
  for (const mia of [...attuale.impostazioni].sort((a, b) => b.anno - a.anno)) {
    const sua = perAnno.get(mia.anno);
    if (!sua) continue;
    const mioNome = mia.nome.trim();
    const suoNome = sua.nome.trim();
    if (mioNome !== suoNome && (mioNome !== "" || suoNome !== "")) {
      cambi.push({
        campo: "nome",
        anno: mia.anno,
        adesso: mioNome || "senza nome",
        nelFile: suoNome || "senza nome",
      });
    }
    if (mia.regime !== sua.regime) {
      cambi.push({
        campo: "regime",
        anno: mia.anno,
        adesso: nomeRegime(mia.regime),
        nelFile: nomeRegime(sua.regime),
      });
    }
  }
  return cambi;
}

export function confrontaPerImport(
  attuale: Dati,
  nelFile: Dati,
  esportatoIl: string | null = null,
): ConfrontoImport {
  const ora = conta(attuale);
  const dopo = conta(nelFile);

  const righe: RigaConfronto[] = COLLEZIONI.map((collezione) => ({
    collezione,
    adesso: ora[collezione],
    nelFile: dopo[collezione],
    // Sostituire non è sommare: quello che c'è adesso sparisce comunque, e
    // quello che si perde è ciò che il file non rimpiazza. Su collezioni con
    // chiave stabile — impostazioni per anno — il conto per riga sarebbe più
    // fine, ma qui serve il numero grande e prudente, non quello esatto.
    perse: Math.max(0, ora[collezione] - dopo[collezione]),
  })).filter((r) => r.adesso > 0 || r.nelFile > 0);

  const somma = (c: Record<NomeCollezione, number>) =>
    COLLEZIONI_DOCUMENTO.reduce((t, n) => t + c[n], 0);

  return {
    archivioVuoto: COLLEZIONI.every((c) => ora[c] === 0),
    righe,
    documentiOra: somma(ora),
    documentiNelFile: somma(dopo),
    documentiPersi: righe.reduce((t, r) => t + r.perse, 0),
    cambi: cambiDiIdentita(attuale, nelFile),
    esportatoIl,
  };
}
