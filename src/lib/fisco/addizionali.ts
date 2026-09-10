/**
 * Addizionale regionale e comunale all'IRPEF.
 *
 * Un'aliquota sola non basta a rappresentarle. Il Piemonte, per dire, nel 2026
 * ha quattro scaglioni — 1,62 % fino a 15.000 €, poi 2,68 %, 3,31 % e 3,33 % —
 * che si applicano progressivamente come l'IRPEF. Chi ci mette l'aliquota del
 * proprio scaglione paga più del dovuto su tutta la parte bassa del reddito, e
 * il conto sembra giusto: è il tipo di errore che questo progetto considera
 * peggiore di un errore visibile.
 *
 * E c'è la soglia di esenzione, che quasi tutti i comuni hanno e diverse
 * regioni pure. Non è una franchigia: sotto la soglia non si paga niente,
 * sopra si paga sull'intero imponibile, non sull'eccedenza. Confonderla con una
 * franchigia sottostima l'imposta di chi sta appena sopra.
 */
import { round2 } from "./aritmetica";
import { impostaProgressiva } from "./scaglioni";
import { aliquota as formattaAliquota, euro } from "@/lib/format";
import type { Impostazioni, ParametriAnno, ScaglioneIrpef } from "./tipi";
import { derivato } from "./derivati/registro";

export type Addizionale = {
  /** Usata quando `scaglioni` è `null`: l'aliquota unica sull'intero imponibile. */
  aliquota: number;
  /** Gli scaglioni della regione o del comune, `null` per l'aliquota unica. */
  scaglioni: ScaglioneIrpef[] | null;
  /** Sotto o pari a questa cifra non si paga niente. `0` significa nessuna esenzione. */
  esenzione: number;
};

export function addizionaleRegionaleDi(imp: Impostazioni, par: ParametriAnno): Addizionale {
  return {
    aliquota: derivato("addizionaleRegionale", imp, par).valore,
    scaglioni: imp.scaglioniAddizionaleRegionale ?? null,
    esenzione: imp.esenzioneAddizionaleRegionale ?? 0,
  };
}

export function addizionaleComunaleDi(imp: Impostazioni, par: ParametriAnno): Addizionale {
  return {
    aliquota: derivato("addizionaleComunale", imp, par).valore,
    scaglioni: imp.scaglioniAddizionaleComunale ?? null,
    esenzione: imp.esenzioneAddizionaleComunale ?? 0,
  };
}

/**
 * Quanto si deve, dato l'imponibile.
 *
 * La soglia si guarda per prima: è una condizione sull'intero reddito, non una
 * parte da sottrarre.
 */
export function addizionaleDovuta(imponibile: number, a: Addizionale): number {
  if (imponibile <= 0) return 0;
  if (a.esenzione > 0 && imponibile <= a.esenzione) return 0;
  if (a.scaglioni && a.scaglioni.length > 0) return impostaProgressiva(imponibile, a.scaglioni);
  return round2(imponibile * a.aliquota);
}

/** L'aliquota che risulta davvero applicata: serve a mostrarla, non a calcolare. */
export function aliquotaEffettiva(imponibile: number, a: Addizionale): number {
  if (imponibile <= 0) return 0;
  return addizionaleDovuta(imponibile, a) / imponibile;
}

/**
 * Gli scaglioni sono scritti bene?
 *
 * Un limite fuori ordine o due scaglioni con lo stesso tetto producono un
 * numero, e il numero è sbagliato: qui si dice cosa non va, in italiano, prima
 * che entri nel calcolo.
 */
export function controllaScaglioni(scaglioni: readonly ScaglioneIrpef[]): string | null {
  if (scaglioni.length === 0) return "Serve almeno uno scaglione.";
  const ultimo = scaglioni[scaglioni.length - 1];
  if (ultimo.limite !== null) {
    return "L'ultimo scaglione non ha un tetto: lasciane vuoto il limite, vale «oltre».";
  }
  let precedente = 0;
  for (const s of scaglioni.slice(0, -1)) {
    if (s.limite === null) return "Solo l'ultimo scaglione può essere senza tetto.";
    if (s.limite <= precedente) {
      return `I limiti devono crescere: ${euro(s.limite)} viene dopo ${euro(precedente)}.`;
    }
    precedente = s.limite;
  }
  for (const s of scaglioni) {
    if (s.aliquota < 0 || s.aliquota > 0.1) {
      return `Un'aliquota del ${formattaAliquota(s.aliquota)} non è un'addizionale: controlla se hai scritto punti percentuali.`;
    }
  }
  return null;
}

/**
 * Come si racconta in una formula del prospetto.
 *
 * Con gli scaglioni l'aliquota unica non esiste, e scriverne una sarebbe la
 * stessa bugia di prima: si dice che è progressiva e quanto è costata davvero.
 */
export function descriviAddizionale(imponibile: number, a: Addizionale): string {
  if (a.esenzione > 0 && imponibile <= a.esenzione) {
    return `sotto la soglia di esenzione di ${euro(a.esenzione)}: non è dovuta`;
  }
  if (a.scaglioni && a.scaglioni.length > 0) {
    const parti = a.scaglioni
      .map((s) =>
        s.limite === null
          ? `${formattaAliquota(s.aliquota)} oltre`
          : `${formattaAliquota(s.aliquota)} fino a ${euro(s.limite)}`,
      )
      .join(", ");
    return `a scaglioni (${parti}), cioè il ${formattaAliquota(aliquotaEffettiva(imponibile, a))} effettivo su ${euro(imponibile)}`;
  }
  return `${euro(imponibile)} × ${formattaAliquota(a.aliquota)}${
    a.esenzione > 0 ? `, sopra la soglia di esenzione di ${euro(a.esenzione)}` : ""
  }`;
}

/** Somma gli importi come li scriverebbe la dichiarazione: già arrotondati. */
export function totaleAddizionali(
  imp: Impostazioni,
  imponibile: number,
  par: ParametriAnno,
): number {
  return round2(
    addizionaleDovuta(imponibile, addizionaleRegionaleDi(imp, par)) +
      addizionaleDovuta(imponibile, addizionaleComunaleDi(imp, par)),
  );
}
