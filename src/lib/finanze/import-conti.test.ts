import { beforeEach, describe, expect, it } from "vitest";
import { archivio, impostaArchivio } from "@/lib/dati/archivio";
import { MemoriaAdapter } from "@/lib/dati/memoria-adapter";
import { eseguiImportRendiconto } from "@/lib/dati/azioni";
import { anteprimaImport, movimentiDaScrivere, type FileRendiconto } from "./anteprima-import";
import { CATEGORIE_INIZIALI } from "./categorie";
import { movimentiPerConto } from "./registro";
import { saldoConto } from "./saldo";
import type { ContoPersonale } from "./tipi";

/**
 * Ogni movimento sul conto del suo file.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché questo test parte dall'anteprima e non dai movimenti già fatti
 * ─────────────────────────────────────────────────────────────────────────
 *
 * «I movimenti sono finiti sul conto sbagliato» è arrivato da un import vero:
 * un rendiconto Intesa assegnato a Intesa, e trentasette righe che in
 * Movimenti dicevano Fineco. Il conto attraversa tre passaggi — la scelta sul
 * file, la riga d'anteprima, la scrittura — e un test che costruisse i
 * movimenti a mano ne salterebbe due: proverebbe che `salvaMolti` salva quello
 * che gli si dà, che non è mai stato in dubbio.
 *
 * Quindi si parte da dove parte l'import vero, cioè dalle righe lette dai
 * file, e si arriva a leggere l'archivio.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * E i saldi, non solo l'etichetta
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il conto su un movimento non è un'etichetta: è il conto da cui quei soldi
 * sono usciti. Un import che li mette tutti sullo stesso conto lascia un saldo
 * che non torna con la banca da nessuna delle due parti, ed è il danno vero —
 * l'etichetta sbagliata si vede, il saldo sbagliato si crede.
 */

const conto = (id: string, nome: string, saldo: number): ContoPersonale => ({
  id,
  nome,
  tipo: "corrente",
  saldoRiferimento: saldo,
  dataRiferimento: "2026-08-31",
  professionale: false,
});

const FINECO = conto("c-fineco", "Fineco (Tasse)", 5_000);
const INTESA = conto("c-intesa", "Intesa Sanpaolo", 3_000);

/** Due rendiconti diversi, uno per conto: nessun importo in comune. */
const rendicontoIntesa = (nome = "intesa.csv"): FileRendiconto => ({
  nome,
  contoId: INTESA.id,
  righe: [
    { indice: 2, data: "2026-09-03", descrizione: "ESSELUNGA MILANO VIA DANTE", importo: -83.4 },
    { indice: 3, data: "2026-09-05", descrizione: "ENEL ENERGIA SPA", importo: -64.9 },
    { indice: 4, data: "2026-09-12", descrizione: "Bonifico da STUDIO ROSSI SRL", importo: 2_400 },
  ],
});

const rendicontoFineco = (nome = "fineco.csv"): FileRendiconto => ({
  nome,
  contoId: FINECO.id,
  righe: [
    { indice: 2, data: "2026-09-16", descrizione: "PAGAMENTO F24", importo: -1_200 },
    { indice: 3, data: "2026-09-20", descrizione: "AMAZON EU SARL", importo: -34.5 },
  ],
});

async function importa(file: FileRendiconto[]) {
  const righe = anteprimaImport({
    file,
    categorie: CATEGORIE_INIZIALI,
    regole: [],
    esistenti: await archivio().pfMovimenti.tutti(),
    contiTracciati: [FINECO.id, INTESA.id],
  });
  let n = 0;
  const movimenti = movimentiDaScrivere(righe, "imp-1", () => `m-${++n}`);
  await eseguiImportRendiconto(
    movimenti,
    file.map((f) => f.nome),
  );
  return righe;
}

/** Quanti movimenti per conto, letti dall'archivio e chiamati per nome. */
async function perConto(): Promise<Record<string, number>> {
  const nomi = new Map([FINECO, INTESA].map((c) => [c.id, c.nome]));
  const conteggio: Record<string, number> = {};
  for (const m of await archivio().pfMovimenti.tutti()) {
    const nome = nomi.get(m.contoId) ?? `«${m.contoId}»`;
    conteggio[nome] = (conteggio[nome] ?? 0) + 1;
  }
  return conteggio;
}

describe("un import con due file su due conti diversi", () => {
  beforeEach(async () => {
    impostaArchivio(new MemoriaAdapter());
    await archivio().pfConti.salvaMolti([FINECO, INTESA]);
    await archivio().pfCategorie.salvaMolti(CATEGORIE_INIZIALI);
  });

  it("**mette ogni movimento sul conto del suo file**", async () => {
    await importa([rendicontoIntesa(), rendicontoFineco()]);

    expect(await perConto()).toEqual({ "Intesa Sanpaolo": 3, "Fineco (Tasse)": 2 });

    const scritti = await archivio().pfMovimenti.tutti();
    const diIntesa = scritti.filter((m) => m.contoId === INTESA.id).map((m) => m.descrizione);
    expect(diIntesa).toEqual(
      expect.arrayContaining(["ESSELUNGA MILANO VIA DANTE", "ENEL ENERGIA SPA"]),
    );
    expect(diIntesa).not.toContain("PAGAMENTO F24");
  });

  it("**la registrazione dell'import non nomina un conto solo quando i conti sono due**", async () => {
    /*
      Teneva il conto del primo file e lo chiamava «il conto dell'import»:
      su due rendiconti su due conti diversi era falso, e lo storico lo
      ripeteva. Adesso il conto si ricava dai movimenti, e con più conti resta
      vuoto — che è la risposta onesta a una domanda mal posta.
    */
    await importa([rendicontoIntesa(), rendicontoFineco()]);
    const [registrazione] = await archivio().pfImport.tutti();
    expect(registrazione.contoId).toBe("");
    expect(registrazione.numeroMovimenti).toBe(5);
  });

  it("con un file solo, invece, la registrazione dice il suo conto", async () => {
    await importa([rendicontoIntesa()]);
    const [registrazione] = await archivio().pfImport.tutti();
    expect(registrazione.contoId).toBe(INTESA.id);
  });

  it("e il conto si conta sui movimenti: `movimentiPerConto` legge l'archivio", async () => {
    await importa([rendicontoIntesa(), rendicontoFineco()]);
    const scritti = await archivio().pfMovimenti.tutti();
    expect(movimentiPerConto(scritti, [FINECO, INTESA])).toEqual([
      { nome: "Intesa Sanpaolo", quanti: 3 },
      { nome: "Fineco (Tasse)", quanti: 2 },
    ]);
  });

  it("e l'ordine dei file non decide niente: invertiti, finiscono dove stavano", async () => {
    await importa([rendicontoFineco(), rendicontoIntesa()]);
    expect(await perConto()).toEqual({ "Intesa Sanpaolo": 3, "Fineco (Tasse)": 2 });
  });

  it("**i saldi dei due conti dopo l'import**, ognuno con i suoi movimenti", async () => {
    await importa([rendicontoIntesa(), rendicontoFineco()]);
    const movimenti = await archivio().pfMovimenti.tutti();

    // Intesa: 3.000 − 83,40 − 64,90 + 2.400.
    expect(saldoConto(INTESA, movimenti)).toBe(5_251.7);
    // Fineco: 5.000 − 1.200 − 34,50.
    expect(saldoConto(FINECO, movimenti)).toBe(3_765.5);
  });

  it("e la misura vede la differenza: tutto su un conto solo darebbe altri due saldi", async () => {
    /*
      La prova che i due numeri sopra non passerebbero comunque. È il difetto
      segnalato — tutte le righe sul primo conto dell'elenco — costruito a
      mano: se i saldi fossero uguali anche così, il test non misurerebbe
      niente.
    */
    await importa([
      { ...rendicontoIntesa(), contoId: FINECO.id },
      rendicontoFineco(),
    ]);
    const movimenti = await archivio().pfMovimenti.tutti();
    expect(saldoConto(INTESA, movimenti)).toBe(3_000);
    expect(saldoConto(FINECO, movimenti)).not.toBe(3_765.5);
  });

  it("**due file che si chiamano uguale restano due file**", async () => {
    /*
      Le banche esportano nomi generici — «movimenti.csv», «Lista
      Operazione.xlsx» — e due conti della stessa banca scaricano due file con
      lo stesso nome. Finché la riga d'anteprima si chiamava «nome#riga», le
      righe dei due file avevano gli stessi identificatori: l'abbinamento dei
      giroconti le rileggeva da una mappa per id, ne restava una sola per
      identificatore, e tutte finivano sul conto dell'ultimo file caricato.
      Misurato: due file da tre e due righe, cinque righe in anteprima, tutte
      e cinque con lo stesso conto.
    */
    await importa([
      rendicontoIntesa("movimenti.csv"),
      rendicontoFineco("movimenti.csv"),
    ]);
    expect(await perConto()).toEqual({ "Intesa Sanpaolo": 3, "Fineco (Tasse)": 2 });
  });
});
