/**
 * Quando un accredito non è denaro nuovo: i soldi erano già tuoi, su un altro
 * tuo conto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché non basta l'abbinamento dei giroconti
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `giroconti.ts` fonde due righe vere — l'uscita da un conto e l'entrata
 * nell'altro — in un movimento solo. Funziona quando ci sono tutte e due, ed è
 * la strada giusta: l'altra metà non si inventa mai.
 *
 * Ma la metà che manca è il caso normale. L'altro conto non è ancora stato
 * importato, o l'uscita è di tre mesi fa, o il conto di partenza in Flowlance
 * non c'è proprio. Quello che resta è un accredito solo, che il limite del
 * mese conta fra le entrate: sull'archivio di chi ha scritto questo modulo,
 * quattro righe di settembre su dieci erano spostamenti fra conti suoi, per
 * 2.549 € di limite che non esistevano.
 *
 * Qui non si inventa niente: si legge quello che **la banca ha già scritto**
 * nella descrizione, e si marca la riga. Il saldo del conto non cambia — i
 * soldi sono arrivati davvero — cambia solo il limite, che smette di
 * chiamarli reddito.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Solo sugli accrediti, e il perché
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un trasferimento **in uscita** verso un conto tuo non tracciato oggi finisce
 * fra le spese, e abbassa il limite. È a sua volta impreciso, ma sbaglia dal
 * lato prudente — fa spendere meno del dovuto — mentre un accredito contato
 * come reddito fa spendere soldi che non ci sono. Si corregge il verso che
 * costa; l'altro sta in APPUNTI.
 */
import { contieneVoce, testoConfrontabile } from "./parole";
import type { ContoPersonale } from "./tipi";

export type MotivoTrasferimento = {
  id: "giroconto" | "stessa-persona" | "risparmio";
  /** La frase che l'anteprima mostra sotto la riga: perché è marcata così. */
  testo: string;
};

/**
 * «Giroconto» scritto dalla banca.
 *
 * In italiano bancario è lo spostamento fra conti dello stesso intestatario, e
 * quando la banca lo scrive lo scrive per esteso: «Giroconto dal cc n.
 * 6098032». Parola intera, non pezzo di parola: `contieneVoce` tiene fuori i
 * casi tipo «saniTARIa» per cui esiste.
 */
const PAROLE_GIROCONTO = ["giroconto", "girofondi"];

/**
 * Il salvadanaio, che il dizionario sapeva già e buttava via.
 *
 * `DIZIONARIO` ha «salvadanaio», «accantonament*» e «giroconto risparmio», ma
 * puntano a una categoria di tipo *risparmio*: a una riga in entrata si
 * possono attaccare solo categorie di entrata, quindi su un accredito quelle
 * parole non venivano nemmeno guardate. Un prelievo dal proprio salvadanaio
 * che torna sul conto è esattamente denaro già tuo che si sposta.
 */
const PAROLE_RISPARMIO = ["salvadanaio", "accantonament*", "riserva", "fondo spese"];

/** Le etichette con cui le banche scrivono i due capi di un bonifico. */
const ORDINANTE = "ordinante";
const BENEFICIARIO = "beneficiario";

/**
 * Il nome scritto dopo un'etichetta, fino all'etichetta dopo.
 *
 * Il testo arriva già normalizzato — minuscolo, senza punteggiatura — quindi
 * «Ordinante: Gabriele Ferretti Beneficiario: Gabriele Ferretti» è
 * «ordinante gabriele ferretti beneficiario gabriele ferretti», e le due parti
 * si tagliano sulle due etichette.
 */
function nomeDopo(testo: string, etichetta: string, altra: string): string | null {
  const da = testo.indexOf(etichetta);
  if (da === -1) return null;
  const resto = testo.slice(da + etichetta.length);
  const fine = resto.indexOf(altra);
  const nome = (fine === -1 ? resto : resto.slice(0, fine)).trim();
  return nome === "" ? null : nome;
}

/**
 * Ordinante e beneficiario sono la stessa persona.
 *
 * Non serve sapere come si chiama chi usa l'app — e infatti l'app non lo sa,
 * non c'è nessun campo con l'intestatario. Il confronto si chiude dentro la
 * stessa riga: chi ha disposto il bonifico e chi l'ha ricevuto sono lo stesso
 * nome, quindi il denaro non ha cambiato proprietario.
 */
export function ordinanteUgualeBeneficiario(testo: string): boolean {
  const da = nomeDopo(testo, ORDINANTE, BENEFICIARIO);
  const a = nomeDopo(testo, BENEFICIARIO, ORDINANTE);
  if (!da || !a) return false;
  /* Due nomi di una parola sola non bastano: «mario» e «mario» possono essere
     due persone. Il nome intero, con almeno due parole, è un'identità. */
  if (da.split(" ").length < 2) return false;
  return da === a;
}

/**
 * Il conto tuo che la descrizione nomina, se ne nomina uno.
 *
 * Cerca le ultime cifre dichiarate su un conto dentro i numeri della riga.
 * Serve solo a scrivere una frase migliore: «è il tuo Fineco» invece di «la
 * descrizione dice giroconto». Chi non ha compilato le ultime cifre non perde
 * niente — il trasferimento si riconosce lo stesso.
 */
export function contoNominato(testo: string, conti: ContoPersonale[]): ContoPersonale | null {
  const numeri = testo.split(" ").filter((p) => /^\d{4,}$/.test(p));
  if (numeri.length === 0) return null;
  for (const conto of conti) {
    const cifre = (conto.ultimeCifre ?? "").replace(/\D/g, "");
    if (cifre.length < 4) continue;
    if (numeri.some((n) => n.endsWith(cifre))) return conto;
  }
  return null;
}

/**
 * La riga è denaro già tuo che si sposta, e perché lo diciamo.
 *
 * `null` quando non c'è niente di dichiarato: il silenzio è la risposta
 * normale, e una riga non marcata resta l'entrata che era.
 */
export function riconosciTrasferimento(
  descrizione: string,
  verso: "entrata" | "uscita",
  conti: ContoPersonale[] = [],
): MotivoTrasferimento | null {
  if (verso !== "entrata") return null;
  const testo = testoConfrontabile(descrizione);

  if (contieneVoce(testo, PAROLE_GIROCONTO, "parole")) {
    const conto = contoNominato(testo, conti);
    return {
      id: "giroconto",
      testo: conto
        ? `la descrizione dice «giroconto» e nomina il tuo conto ${conto.nome}`
        : "la descrizione dice «giroconto»",
    };
  }

  if (ordinanteUgualeBeneficiario(testo)) {
    return { id: "stessa-persona", testo: "ordinante e beneficiario sono la stessa persona" };
  }

  if (contieneVoce(testo, PAROLE_RISPARMIO, "tutte")) {
    return { id: "risparmio", testo: "la descrizione parla di soldi messi da parte da te" };
  }

  return null;
}

/**
 * La risposta già data per questo genere di movimento.
 *
 * Vive dentro le regole della persona — le stesse che decidono le categorie —
 * perché è la stessa cosa: una frase che compare ogni mese, e una decisione
 * presa una volta. `true` marca, `false` dice «è denaro nuovo davvero» e vale
 * quanto il `true`: senza, la domanda tornerebbe a ogni import su una riga a
 * cui si è già risposto.
 *
 * `null` quando nessuna regola parla di questo: allora decide la descrizione,
 * e se non basta si chiede.
 */
export function rispostaSalvata(
  descrizione: string,
  regole: { testoDaCercare: string; daUnAltroTuoConto?: boolean }[],
): boolean | null {
  const testo = testoConfrontabile(descrizione);
  for (const regola of regole) {
    if (regola.daUnAltroTuoConto === undefined) continue;
    const cercato = testoConfrontabile(regola.testoDaCercare);
    if (cercato !== "" && testo.includes(cercato)) return regola.daUnAltroTuoConto;
  }
  return null;
}

/**
 * Un cambio valuta: gli euro arrivano da una tasca in un'altra moneta.
 *
 * Questo **non** si decide da soli, e non è pigrizia: la riga non contiene il
 * fatto. Se i dollari erano un risparmio, gli euro non sono denaro nuovo; se
 * erano un cliente che ha pagato in dollari e che in Flowlance non è mai
 * entrato, quella conversione è **l'unica traccia** di quel reddito, e
 * marcarla lo cancellerebbe dal limite per sempre. Le due situazioni hanno la
 * stessa identica descrizione.
 *
 * E non si risolverà mai con l'abbinamento: quello chiede importi uguali, e un
 * cambio valuta per definizione non ce li ha. O lo si chiede, o resta aperto.
 */
const PAROLE_CAMBIO = ["conversione", "cambio valuta", "exchange", "currency exchange", "conversion"];

/**
 * La parola che ha fatto scattare il sospetto, che è anche **la chiave della
 * risposta**.
 *
 * La regola che ricorda la risposta si scrive su questa parola e non sulla
 * riga intera: «Conversione in EUR 991,39» non si ripete mai identica, e una
 * regola che non riaggancia niente è una domanda che torna ogni mese.
 */
export function parolaCambioValuta(descrizione: string): string | null {
  const testo = testoConfrontabile(descrizione);
  return PAROLE_CAMBIO.find((voce) => contieneVoce(testo, [voce], "tutte")) ?? null;
}

export function sembraCambioValuta(descrizione: string): boolean {
  return parolaCambioValuta(descrizione) !== null;
}
