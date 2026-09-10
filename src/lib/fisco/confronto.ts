/**
 * Simulatore di convenienza: stessi ricavi, stessi costi, i due regimi
 * messi a confronto. È la schermata più condivisibile del prodotto.
 *
 * Il confronto non è solo fiscale, e l'interfaccia deve dirlo: nel forfettario
 * non addebiti IVA (vantaggio verso i privati, irrilevante verso le imprese),
 * non detrai l'IVA sugli acquisti, non usi le detrazioni personali e non deduci
 * il fondo pensione.
 */
import { nonNegativo, rapporto, round2, somma } from "./aritmetica";
import { interoIt } from "../format";
import { contributiPrevidenziali, irpefScaglioni } from "./motore";
import { derivato } from "./derivati/registro";
import {
  addizionaleComunaleDi,
  addizionaleDovuta,
  addizionaleRegionaleDi,
} from "./addizionali";
import { detrazioneLavoroAutonomo } from "./detrazioni";
import type { Impostazioni, ParametriAnno } from "./tipi";

export type ScenarioRegime = {
  ricavi: number;
  costiRiconosciuti: number;
  redditoLordo: number;
  contributi: number;
  oneriDeducibili: number;
  imponibile: number;
  imposte: number;
  caricoTotale: number;
  pressione: number;
  nettoInTasca: number;
};

export type Confronto = {
  ricavi: number;
  forfettario: ScenarioRegime;
  ordinario: ScenarioRegime;
  differenzaNetto: number;
  convenienza: "forfettario" | "ordinario" | "pari";
  /** Il forfettario non è applicabile sopra il limite di ricavi. */
  forfettarioApplicabile: boolean;
  verdetto: string;
};

export type IngressoConfronto = {
  ricavi: number;
  /** Imponibile dei costi documentati: deducibile solo in ordinario. */
  costiDeducibili: number;
  /** Uscita di cassa effettiva, IVA compresa. */
  costiTotali: number;
  /** IVA sugli acquisti, recuperabile solo in ordinario. */
  ivaAcquisti: number;
};

/**
 * Gli ingressi del confronto ricavati dai numeri reali di un anno.
 *
 * Sta qui e non nella schermata perché lo usano sia il simulatore sia il
 * percorso di cambio di regime: se divergessero, i due mostrerebbero due
 * confronti diversi sugli stessi dati.
 */
export function ingressoDaProspetto(p: {
  ricaviRilevanti: number;
  costiPagatiTotale: number;
  costiCalcolati: { dataPagamento?: string | null; imponibile: number; iva: number }[];
}): IngressoConfronto {
  const pagati = p.costiCalcolati.filter((c) => c.dataPagamento);
  return {
    ricavi: round2(p.ricaviRilevanti),
    costiDeducibili: somma(...pagati.map((c) => c.imponibile)),
    costiTotali: round2(p.costiPagatiTotale),
    ivaAcquisti: somma(...pagati.map((c) => c.iva)),
  };
}

function scenario(
  regime: "forfettario" | "ordinario",
  ing: IngressoConfronto,
  imp: Impostazioni,
  par: ParametriAnno,
): ScenarioRegime {
  const forfettario = regime === "forfettario";
  const costiRiconosciuti = forfettario ? 0 : ing.costiDeducibili;
  /*
    Il coefficiente arriva dal registro anche qui, dove il regime simulato non è
    quello dell'utente: è il coefficiente del suo gruppo ATECO, che non cambia
    con lo scenario. È la ragione per cui la voce non si annulla nell'ordinario.
  */
  const redditoLordo = forfettario
    ? round2(ing.ricavi * derivato("coefficienteRedditivita", imp, par).valore)
    : round2(ing.ricavi - costiRiconosciuti);

  const contributi = contributiPrevidenziali(redditoLordo, imp, par).totale;
  const oneriDeducibili = forfettario
    ? 0
    : round2(Math.min(imp.fondoPensione, par.tettoFondoPensione));
  const imponibile = round2(nonNegativo(redditoLordo - contributi - oneriDeducibili));

  // La stessa catena del prospetto, detrazione dell'art. 13 compresa: se il
  // confronto non la contasse, l'ordinario sembrerebbe più caro di quello che
  // è, e la proposta di cambio regime nascerebbe da un numero sbagliato.
  const irpefNetta = nonNegativo(
    irpefScaglioni(imponibile, imp.scaglioniIrpef) -
      imp.detrazioniPersonali -
      detrazioneLavoroAutonomo(redditoLordo, par.detrazioneLavoroAutonomo).importo,
  );
  const imposte = forfettario
    ? round2(imponibile * derivato("aliquotaSostitutiva", imp, par).valore)
    : somma(
        irpefNetta,
        // Senza IRPEF dovuta non sono dovute nemmeno le addizionali.
        ...(irpefNetta > 0
          ? [
              addizionaleDovuta(imponibile, addizionaleRegionaleDi(imp, par)),
              addizionaleDovuta(imponibile, addizionaleComunaleDi(imp, par)),
            ]
          : []),
      );

  const caricoTotale = somma(imposte, contributi);
  // In forfettario l'IVA sugli acquisti resta un costo; in ordinario la detrai.
  const costiACarico = forfettario ? ing.costiTotali : round2(ing.costiTotali - ing.ivaAcquisti);

  return {
    ricavi: ing.ricavi,
    costiRiconosciuti,
    redditoLordo,
    contributi,
    oneriDeducibili,
    imponibile,
    imposte,
    caricoTotale,
    pressione: rapporto(caricoTotale, ing.ricavi),
    nettoInTasca: round2(ing.ricavi - costiACarico - caricoTotale),
  };
}

export function confrontaRegimi(
  ing: IngressoConfronto,
  imp: Impostazioni,
  par: ParametriAnno,
): Confronto {
  const forfettario = scenario("forfettario", ing, imp, par);
  const ordinario = scenario("ordinario", ing, imp, par);
  const differenzaNetto = round2(forfettario.nettoInTasca - ordinario.nettoInTasca);
  const applicabile = ing.ricavi <= imp.limiteForfettario;

  let convenienza: Confronto["convenienza"] = "pari";
  if (differenzaNetto > 0) convenienza = "forfettario";
  else if (differenzaNetto < 0) convenienza = "ordinario";

  let verdetto: string;
  if (ing.ricavi === 0) {
    verdetto = "Inserisci un valore di ricavi per confrontare i due regimi.";
  } else if (!applicabile) {
    verdetto = `Sopra ${interoIt.format(imp.limiteForfettario)} € di ricavi il forfettario non è applicabile: resta il regime ordinario.`;
  } else if (convenienza === "pari") {
    verdetto = "I due regimi si equivalgono su questi numeri.";
  } else {
    const vincitore = convenienza === "forfettario" ? "forfettario" : "ordinario";
    const margine = Math.abs(differenzaNetto);
    verdetto = `Con questi numeri conviene il regime ${vincitore}: ti restano ${interoIt.format(Math.round(margine))} € in più all'anno.`;
  }

  return {
    ricavi: ing.ricavi,
    forfettario,
    ordinario,
    differenzaNetto,
    convenienza,
    forfettarioApplicabile: applicabile,
    verdetto,
  };
}

/**
 * La curva dei due regimi al crescere del fatturato, per trovare a occhio
 * il punto in cui le due linee si incrociano.
 */
export function curvaConfronto(
  ing: Omit<IngressoConfronto, "ricavi">,
  imp: Impostazioni,
  par: ParametriAnno,
  opzioni: { da?: number; a?: number; passo?: number } = {},
): { ricavi: number; forfettario: number; ordinario: number }[] {
  const { da = 10_000, a = 100_000, passo = 2_500 } = opzioni;
  const punti: { ricavi: number; forfettario: number; ordinario: number }[] = [];
  for (let ricavi = da; ricavi <= a; ricavi += passo) {
    const c = confrontaRegimi({ ...ing, ricavi }, imp, par);
    punti.push({
      ricavi,
      forfettario: c.forfettario.nettoInTasca,
      ordinario: c.ordinario.nettoInTasca,
    });
  }
  return punti;
}

/**
 * Il fatturato a cui le due curve si incrociano, cercato per bisezione.
 * `null` se non si incrociano nell'intervallo utile del forfettario.
 */
export function puntoDiIncrocio(
  ing: Omit<IngressoConfronto, "ricavi">,
  imp: Impostazioni,
  par: ParametriAnno,
  opzioni: { da?: number; a?: number } = {},
): number | null {
  const { da = 1_000, a = imp.limiteForfettario } = opzioni;
  const delta = (r: number) => {
    const c = confrontaRegimi({ ...ing, ricavi: r }, imp, par);
    return c.forfettario.nettoInTasca - c.ordinario.nettoInTasca;
  };
  let basso = da;
  let alto = a;
  const dBasso = delta(basso);
  if (dBasso * delta(alto) > 0) return null;
  for (let i = 0; i < 60; i++) {
    const medio = (basso + alto) / 2;
    if (delta(medio) * dBasso <= 0) alto = medio;
    else basso = medio;
  }
  return round2((basso + alto) / 2);
}
