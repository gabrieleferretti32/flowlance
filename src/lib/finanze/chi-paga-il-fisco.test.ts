import { describe, expect, it } from "vitest";
import { CATEGORIE_INIZIALI } from "./categorie";
import {
  chiPagaIlFisco,
  dichiarazioneContraddetta,
  rispostaChiPaga,
  type IngressoChiPaga,
} from "./chi-paga-il-fisco";
import type { CategoriaPf, MovimentoPf } from "./tipi";
import type { Adempimento } from "@/lib/fisco/scadenze";
import type { VersamentoF24 } from "@/lib/fisco/tipi";

const CATEGORIE = CATEGORIE_INIZIALI as CategoriaPf[];
const OGGI = "2026-09-05";

/** Il 30 giugno: la scadenza che quasi tutti gli archivi si trovano dentro. */
const GIUGNO: Adempimento = {
  id: "saldo-acconto",
  data: "2026-06-30",
  titolo: "Saldo e primo acconto",
  importo: 3_400,
  categoria: "imposte",
};

const mov = (
  data: string,
  categoriaId: string,
  importo: number,
  tipo: MovimentoPf["tipo"] = "spesa",
): MovimentoPf => ({
  id: `${categoriaId}-${data}`,
  data,
  tipo,
  categoriaId,
  contoId: "c1",
  importo,
  descrizione: categoriaId,
});

/** Un prelievo al mese, da gennaio al mese indicato. */
const prelievi = (fino: number, importo: number): MovimentoPf[] =>
  Array.from({ length: fino }, (_, i) =>
    mov(`2026-${String(i + 1).padStart(2, "0")}-05`, "fatture", importo, "entrata"),
  );

const ingresso = (extra: Partial<IngressoChiPaga> = {}): IngressoChiPaga => ({
  anno: 2026,
  oggi: OGGI,
  movimenti: [],
  categorie: CATEGORIE,
  versamenti: [],
  scadenze: [GIUGNO],
  nettoDisponibile: 13_000,
  caricoTotale: 15_000,
  ...extra,
});

describe("il primo segnale: gli F24 nel registro personale", () => {
  it("se ce n'è uno, le tasse escono da questo conto", () => {
    const lettura = chiPagaIlFisco(
      ingresso({ movimenti: [...prelievi(8, 2_400), mov("2026-06-30", "f24", 3_400)] }),
    );
    expect(lettura.indizi[0].verso).toBe("personale");
  });

  /*
    L'assenza vale solo dentro una finestra in cui qualcosa doveva esserci.
    Senza questa condizione chiunque importi gennaio-aprile — mesi in cui non
    scade niente — si vedrebbe misurare «le tasse le paga l'attività».
  */
  it("se manca ma nel periodo importato è passata una scadenza, le paga l'attività", () => {
    const lettura = chiPagaIlFisco(ingresso({ movimenti: prelievi(8, 1_080) }));
    expect(lettura.indizi[0].verso).toBe("attivita");
    expect(lettura.indizi[0].testo).toContain("saldo e primo acconto");
  });

  it("ma se nel periodo importato non scadeva niente, tace", () => {
    const lettura = chiPagaIlFisco(
      ingresso({ movimenti: prelievi(4, 1_080) }), // gennaio–aprile
    );
    expect(lettura.indizi[0].verso).toBeNull();
    expect(lettura.indizi[0].testo).toContain("non è ancora scaduto");
  });

  it("e un mese solo non basta a dire un'assenza", () => {
    const lettura = chiPagaIlFisco(
      ingresso({ movimenti: [mov("2026-06-05", "fatture", 1_080, "entrata")] }),
    );
    expect(lettura.indizi[0].verso).toBeNull();
    expect(lettura.indizi[0].testo).toContain("un mese solo");
  });

  it("e un registro vuoto non dice niente", () => {
    expect(chiPagaIlFisco(ingresso()).indizi[0].verso).toBeNull();
  });
});

describe("il secondo segnale: il conto da cui gli F24 sono usciti", () => {
  const f24 = (id: string, pagatoDa?: VersamentoF24["pagatoDa"]): VersamentoF24 => ({
    id,
    data: "2026-06-30",
    tipo: "imposte",
    importo: 1_000,
    ...(pagatoDa ? { pagatoDa } : {}),
  });

  it("conta solo gli F24 su cui qualcuno l'ha detto", () => {
    /*
      Il campo assente non è «attività»: è «nessuno ci ha messo mano», e su
      ogni archivio nato prima del campo sono tutti così. Leggerlo come una
      risposta sarebbe lo stesso difetto che questo modulo esiste per evitare.
    */
    const lettura = chiPagaIlFisco(ingresso({ versamenti: [f24("a"), f24("b")] }));
    expect(lettura.indizi[1].verso).toBeNull();
    expect(lettura.indizi[1].testo).toContain("nessun F24");
  });

  it("tutti dall'attività: le tasse le paga l'attività", () => {
    const lettura = chiPagaIlFisco(ingresso({ versamenti: [f24("a", "attivita")] }));
    expect(lettura.indizi[1].verso).toBe("attivita");
  });

  it("tutti dal personale: le paga questo conto", () => {
    const lettura = chiPagaIlFisco(ingresso({ versamenti: [f24("a", "personale")] }));
    expect(lettura.indizi[1].verso).toBe("personale");
  });

  it("mescolati: non sceglie, e lo dice", () => {
    const lettura = chiPagaIlFisco(
      ingresso({ versamenti: [f24("a", "personale"), f24("b", "attivita")] }),
    );
    expect(lettura.indizi[1].verso).toBeNull();
    expect(lettura.indizi[1].testo).toContain("mescolati");
  });
});

describe("il terzo segnale: quanto entra, confrontato col netto", () => {
  /* netto 13.000 → 1.083 al mese; netto più carico 28.000 → 2.333 al mese. */
  it("entrate vicine al netto: il fisco è uscito prima", () => {
    const lettura = chiPagaIlFisco(ingresso({ movimenti: prelievi(8, 1_080) }));
    expect(lettura.indizi[2].verso).toBe("attivita");
  });

  it("entrate vicine al lordo: è un prelievo lordo", () => {
    const lettura = chiPagaIlFisco(ingresso({ movimenti: prelievi(8, 2_340) }));
    expect(lettura.indizi[2].verso).toBe("personale");
  });

  it("in mezzo alle due non sceglie", () => {
    const lettura = chiPagaIlFisco(ingresso({ movimenti: prelievi(8, 1_700) }));
    expect(lettura.indizi[2].verso).toBeNull();
  });

  it("e sotto i tre mesi nemmeno ci prova", () => {
    const lettura = chiPagaIlFisco(ingresso({ movimenti: prelievi(2, 1_080) }));
    expect(lettura.indizi[2].verso).toBeNull();
    expect(lettura.indizi[2].testo).toContain("tre mesi");
  });
});

describe("i tre segnali letti insieme", () => {
  it("concordi: si propone la risposta", () => {
    const lettura = chiPagaIlFisco(
      ingresso({
        movimenti: prelievi(8, 1_080),
        versamenti: [{ id: "a", data: "2026-06-30", tipo: "imposte", importo: 1_000, pagatoDa: "attivita" }],
      }),
    );
    expect(lettura.misurato).toBe("attivita");
  });

  /*
    Discordi vuol dire «non si sa», e non «vince chi ha due voti». Una
    maggioranza di due contro uno su una cifra che decide quanto puoi spendere
    è un modo elegante di sbagliare in silenzio.
  */
  it("discordi: nessuna risposta, e i motivi restano leggibili", () => {
    const lettura = chiPagaIlFisco(
      ingresso({
        movimenti: [...prelievi(8, 1_080), mov("2026-06-30", "f24", 3_400)],
        versamenti: [{ id: "a", data: "2026-06-30", tipo: "imposte", importo: 1_000, pagatoDa: "attivita" }],
      }),
    );
    expect(lettura.misurato).toBeNull();
    expect(lettura.indizi.filter((i) => i.verso !== null)).toHaveLength(3);
  });
});

describe("la risposta che vale", () => {
  const muta = chiPagaIlFisco(ingresso());
  const dice = (verso: "attivita" | "personale") =>
    chiPagaIlFisco(
      ingresso({
        movimenti: verso === "attivita" ? prelievi(8, 1_080) : [...prelievi(8, 2_340), mov("2026-06-30", "f24", 3_400)],
      }),
    );

  it("prima quello che hai dichiarato", () => {
    expect(rispostaChiPaga("attivita", dice("personale"))).toEqual({
      chiPaga: "attivita",
      fonte: "dichiarato",
    });
  });

  it("poi quello che i segnali misurano", () => {
    expect(rispostaChiPaga(null, dice("attivita"))).toEqual({
      chiPaga: "attivita",
      fonte: "misurato",
    });
  });

  /*
    Il ripiego non è una moneta lanciata. Sbagliare verso «personale» fa
    spendere meno del dovuto; sbagliare verso «attività» fa spendere i soldi
    del fisco, che è l'unico dei due errori che si paga a giugno.
  */
  it("e in ultimo il verso prudente, che è «questo conto»", () => {
    expect(rispostaChiPaga(null, muta)).toEqual({
      chiPaga: "personale",
      fonte: "predefinito",
    });
  });
});

describe("una dichiarazione vecchia non resta vera per sempre", () => {
  const oraDiceAttivita = chiPagaIlFisco(ingresso({ movimenti: prelievi(8, 1_080) }));

  it("se l'archivio dice il contrario, si vede", () => {
    expect(dichiarazioneContraddetta("personale", oraDiceAttivita)).toBe(true);
  });

  it("se è d'accordo, no", () => {
    expect(dichiarazioneContraddetta("attivita", oraDiceAttivita)).toBe(false);
  });

  it("e senza dichiarazione non c'è niente da contraddire", () => {
    expect(dichiarazioneContraddetta(null, oraDiceAttivita)).toBe(false);
  });

  it("nemmeno quando i segnali non sanno dire", () => {
    expect(dichiarazioneContraddetta("attivita", chiPagaIlFisco(ingresso()))).toBe(false);
  });

  /*
    Una riga di impostazioni salvata prima che il campo esistesse non porta
    `null`: non porta niente. Trattare `undefined` come una dichiarazione
    faceva comparire l'avviso in ambra «hai risposto X, ma adesso l'archivio
    dice il contrario» a chi non aveva mai risposto — e su un archivio vecchio
    sarebbe comparso al primo aggiornamento, a tutti.
  */
  it("e un archivio nato prima del campo non ha dichiarato niente", () => {
    expect(dichiarazioneContraddetta(undefined, oraDiceAttivita)).toBe(false);
    expect(rispostaChiPaga(undefined, oraDiceAttivita)).toEqual({
      chiPaga: "attivita",
      fonte: "misurato",
    });
  });
});
