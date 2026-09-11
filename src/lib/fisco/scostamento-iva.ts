/**
 * Perché il tuo numero può non coincidere con l'F24 del commercialista.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ora persa
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Flowlance diceva 454,87 e l'F24 821,19. Non era un errore dell'app: il
 * commercialista non aveva ancora scaricato una nota di credito, e aveva datato
 * alcune fatture d'acquisto per **ricezione** invece che per documento. Ci è
 * voluta un'ora per stabilirlo.
 *
 * Nessun cliente farà quel lavoro. Vedrà un numero diverso dal suo F24 e
 * concluderà che l'app sbaglia — e avrà un motivo per non rinnovare. La
 * differenza fra un sospetto e una risposta non è dire «può capitare»: è dire
 * **quali righe** possono spiegarla, e quanto farebbero dire al periodo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Come si calcolano gli scenari: rifacendo la liquidazione, non stimandola
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Uno scostamento **non** è la somma dell'IVA delle righe sospette. Il
 * `totaleDaVersare` di un periodo passa dal credito riportato dal periodo
 * prima, si ferma a zero invece di andare sotto, e sui trimestrali porta una
 * maggiorazione dell'1 % che cambia con lui. Sommare le righe darebbe un numero
 * plausibile e diverso da quello che l'F24 direbbe davvero.
 *
 * Quindi qui si rifà **la liquidazione intera** con `calcolaIva`, la stessa
 * funzione, sui documenti spostati. Il numero che esce è un numero vero: quello
 * che Flowlance direbbe se quell'ipotesi fosse la realtà. Non c'è una seconda
 * copia della regola da tenere allineata alla prima.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Cosa resta fuori
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un documento che l'archivio non ha. Non è calcolabile da qui — mancare è
 * l'unica cosa che non lascia traccia — e la schermata lo dice a parole invece
 * di far finta che le due cause elencate siano tutte.
 */
import { annoDi, giorniTra, meseDi } from "./documenti";
import { calcolaIva, type LiquidazioneIva, type PeriodoIva } from "./iva";
import { round2, somma } from "./aritmetica";
import type { NotaCalcolata } from "./note";
import type { CostoCalcolato, FatturaCalcolata, Impostazioni, ParametriAnno } from "./tipi";

/**
 * Quanti giorni prima della fine del periodo un acquisto è «al confine».
 *
 * Una fattura elettronica passa dallo SdI in pochi giorni: quella datata il 5
 * settembre è arrivata il 7, e nessuno la sposta di trimestre. Quella datata il
 * 28 arriva a ottobre, ed è lì che i due modi di datare si separano.
 *
 * Sette giorni è il margine di consegna più qualche giorno di respiro. Non è
 * una soglia di legge — la legge guarda la ricezione, che in archivio non c'è —
 * ed è per questo che il risultato è un'ipotesi dichiarata e non una correzione.
 */
export const GIORNI_DI_CONFINE = 7;

export type RigaSospetta = {
  etichetta: string;
  data: string;
  iva: number;
};

export type CausaScostamento = {
  chiave: "ricezione" | "ricezioneDalPrecedente" | "note";
  /** Cosa direbbe questo periodo se l'ipotesi fosse vera. */
  seFosse: number;
  /** `seFosse` meno il calcolato. Positivo: l'F24 vero è più alto del nostro. */
  effetto: number;
  righe: RigaSospetta[];
};

export type ScostamentoPeriodo = {
  indice: number;
  etichetta: string;
  scadenza: string | null;
  calcolato: number;
  cause: CausaScostamento[];
  /** La somma degli effetti, cioè il caso in cui valgono tutte e due. */
  effettoMassimo: number;
};

/** L'ultimo giorno del periodo che contiene quel mese, nella periodicità data. */
function fineDelPeriodo(anno: number, mese: number, mensile: boolean): string {
  const ultimoMese = mensile ? mese : Math.ceil(mese / 3) * 3;
  // Il giorno zero del mese dopo è l'ultimo del mese: niente tabella dei giorni.
  const fine = new Date(Date.UTC(anno, ultimoMese, 0));
  return fine.toISOString().slice(0, 10);
}

/** Il giorno dopo la fine del periodo: dove finirebbe un documento ricevuto tardi. */
function inizioDelSuccessivo(anno: number, mese: number, mensile: boolean): string {
  const ultimoMese = mensile ? mese : Math.ceil(mese / 3) * 3;
  return new Date(Date.UTC(anno, ultimoMese, 1)).toISOString().slice(0, 10);
}

/**
 * Gli acquisti datati negli ultimi giorni del loro periodo.
 *
 * Sono quelli che il commercialista può aver registrato nel periodo dopo, se
 * data per ricezione: è la causa più frequente di uno scarto, e l'unica che si
 * riconosce senza avere la data di ricezione in archivio.
 */
export function acquistiAlConfine(
  costi: readonly CostoCalcolato[],
  anno: number,
  mensile: boolean,
): CostoCalcolato[] {
  return costi.filter((c) => {
    if (annoDi(c.dataDocumento) !== anno) return false;
    if (c.ivaDetraibile <= 0) return false;
    const fine = fineDelPeriodo(anno, meseDi(c.dataDocumento), mensile);
    const mancano = giorniTra(c.dataDocumento, fine);
    return mancano >= 0 && mancano < GIORNI_DI_CONFINE;
  });
}

type Ingresso = {
  fatture: FatturaCalcolata[];
  costi: CostoCalcolato[];
  note: NotaCalcolata[];
  impostazioni: Impostazioni;
  parametri: ParametriAnno;
  creditoIniziale?: number;
};

/**
 * Gli scostamenti possibili, periodo per periodo.
 *
 * Vuoto in forfettario e quando non c'è niente di sospetto: una riga che dice
 * «nessuno scostamento possibile» su ogni trimestre di ogni archivio sarebbe
 * rumore, e il rumore si impara a saltare proprio quando comincia a dire
 * qualcosa.
 */
export function scostamentiIva(ing: Ingresso): ScostamentoPeriodo[] {
  const { impostazioni: imp, parametri: par, fatture, costi, note } = ing;
  if (imp.regime === "forfettario") return [];

  const anno = imp.anno;
  const mensile = imp.periodicitaIva === "mensile";
  const credito = ing.creditoIniziale ?? 0;
  const quali = (l: LiquidazioneIva): PeriodoIva[] => (mensile ? l.mesi : l.trimestri);

  const base = quali(calcolaIva(fatture, costi, imp, par, credito, note));

  /*
    Uno scenario **per periodo**, non uno solo per tutti.

    La prima stesura spostava in un colpo tutti gli acquisti al confine
    dell'anno e leggeva la differenza periodo per periodo. Il numero era giusto
    e la frase no: sul terzo trimestre compariva «0 acquisti datati negli ultimi
    giorni del periodo, 0,00 € di IVA» accanto a uno scostamento di 52,70 € —
    perché quell'effetto non era suo, era degli acquisti del *secondo* trimestre
    che gli arrivavano dentro. Due cose diverse sotto la stessa etichetta, che è
    il modo di far dire a un numero giusto una cosa falsa.

    Ora ogni periodo ha il suo scenario, e da quello si leggono due effetti
    distinti con le loro righe: quelli che **escono** da lui, e quelli che gli
    **arrivano** da quello prima.
  */
  const alConfine = acquistiAlConfine(costi, anno, mensile);
  const perPeriodo = new Map<number, CostoCalcolato[]>();
  for (const c of alConfine) {
    const i = indiceDelPeriodo(meseDi(c.dataDocumento), mensile);
    perPeriodo.set(i, [...(perPeriodo.get(i) ?? []), c]);
  }

  const scenariRicezione = new Map<number, PeriodoIva[]>();
  for (const [indice, suoi] of perPeriodo) {
    const spostati = new Set(suoi.map((c) => c.id));
    scenariRicezione.set(
      indice,
      quali(
        calcolaIva(
          fatture,
          costi.map((c) =>
            spostati.has(c.id)
              ? { ...c, dataDocumento: inizioDelSuccessivo(anno, meseDi(c.dataDocumento), mensile) }
              : c,
          ),
          imp,
          par,
          credito,
          note,
        ),
      ),
    );
  }

  // Scenario delle note — le note di credito emesse e non ancora scaricate da
  // chi compila l'F24: il suo debito è più alto del nostro, del loro IVA.
  const scenarioNote =
    note.length === 0 ? base : quali(calcolaIva(fatture, costi, imp, par, credito, []));

  const righeDi = (costi: readonly CostoCalcolato[]): RigaSospetta[] =>
    costi
      .map((c) => ({
        etichetta: `${c.fornitore}${c.descrizione ? ` · ${c.descrizione}` : ""}`,
        data: c.dataDocumento,
        iva: c.ivaDetraibile,
      }))
      .sort((a, b) => b.iva - a.iva);

  return base.map((p, i) => {
    const cause: CausaScostamento[] = [];

    // Quelli che escono da questo periodo, se registrati alla ricezione.
    const suoi = perPeriodo.get(p.indice);
    const scenarioSuo = scenariRicezione.get(p.indice);
    if (suoi && scenarioSuo) {
      const effetto = round2(scenarioSuo[i].totaleDaVersare - p.totaleDaVersare);
      if (effetto !== 0) {
        cause.push({
          chiave: "ricezione",
          seFosse: scenarioSuo[i].totaleDaVersare,
          effetto,
          righe: righeDi(suoi),
        });
      }
    }

    // Quelli che gli arrivano dal periodo prima, per la stessa ragione.
    const prima = perPeriodo.get(p.indice - 1);
    const scenarioPrima = scenariRicezione.get(p.indice - 1);
    if (prima && scenarioPrima) {
      const effetto = round2(scenarioPrima[i].totaleDaVersare - p.totaleDaVersare);
      if (effetto !== 0) {
        cause.push({
          chiave: "ricezioneDalPrecedente",
          seFosse: scenarioPrima[i].totaleDaVersare,
          effetto,
          righe: righeDi(prima),
        });
      }
    }

    const sueNote = note.filter(
      (n) =>
        annoDi(n.dataDocumento) === anno
        && indiceDelPeriodo(meseDi(n.dataDocumento), mensile) === p.indice
        && n.iva > 0,
    );
    const effettoNote = round2(scenarioNote[i].totaleDaVersare - p.totaleDaVersare);
    if (sueNote.length > 0 && effettoNote !== 0) {
      cause.push({
        chiave: "note",
        seFosse: scenarioNote[i].totaleDaVersare,
        effetto: effettoNote,
        righe: sueNote
          .map((n) => ({
            etichetta: `Nota ${n.numero}${n.descrizione ? ` · ${n.descrizione}` : ""}`,
            data: n.dataDocumento,
            iva: n.iva,
          }))
          .sort((a, b) => b.iva - a.iva),
      });
    }

    return {
      indice: p.indice,
      etichetta: p.etichetta,
      scadenza: p.scadenza,
      calcolato: p.totaleDaVersare,
      cause: cause.sort((a, b) => Math.abs(b.effetto) - Math.abs(a.effetto)),
      effettoMassimo: round2(somma(...cause.map((c) => c.effetto))),
    };
  });
}

function indiceDelPeriodo(mese: number, mensile: boolean): number {
  return mensile ? mese : Math.ceil(mese / 3);
}

// ————————————————————————————————————————————————————————————
// Il confronto con l'F24 vero
// ————————————————————————————————————————————————————————————

export type VersamentoAttribuito = { id: string; data: string; importo: number };

/**
 * A quale periodo appartiene un versamento IVA.
 *
 * Non «la data cade nel trimestre»: un versamento del terzo trimestre esce il
 * 16 novembre, che nel trimestre non c'è. Appartiene al periodo la cui scadenza
 * è l'ultima **prima o nel giorno** del pagamento — così un F24 pagato in
 * ritardo resta del suo periodo invece di scivolare in quello dopo.
 */
export function versamentiPerPeriodo(
  periodi: readonly PeriodoIva[],
  versamenti: readonly {
    id: string;
    data: string;
    importo: number;
    tipo: string;
    annoImposta?: number;
  }[],
  anno: number,
): Map<number, VersamentoAttribuito[]> {
  const per = new Map<number, VersamentoAttribuito[]>();
  const conScadenza = periodi
    .filter((p): p is PeriodoIva & { scadenza: string } => p.scadenza !== null)
    .sort((a, b) => (a.scadenza < b.scadenza ? -1 : 1));
  if (conScadenza.length === 0) return per;

  for (const v of versamenti) {
    if (v.tipo !== "iva") continue;
    // L'anno d'imposta quando c'è: è il campo che esiste apposta perché un
    // versamento di marzo può appartenere all'anno prima.
    if (v.annoImposta !== undefined && v.annoImposta !== anno) continue;

    let scelto: (PeriodoIva & { scadenza: string }) | null = null;
    for (const p of conScadenza) {
      if (p.scadenza <= v.data) scelto = p;
    }
    /*
      Prima della prima scadenza dell'anno non è di quest'anno, ed è il caso in
      cui la prima stesura sbagliava di più: attribuiva al primo trimestre
      *tutti* i versamenti anteriori, compresi quelli dell'anno prima, e sulla
      vetrina il confronto si apriva con «5 versamenti IVA in questo periodo,
      10.681,63 € in tutto» contro 3.616,96 € calcolati. Un numero assurdo, che
      però nessuno avrebbe potuto smentire senza contare le righe a mano.
    */
    if (scelto === null) continue;
    per.set(scelto.indice, [
      ...(per.get(scelto.indice) ?? []),
      { id: v.id, data: v.data, importo: v.importo },
    ]);
  }
  return per;
}
