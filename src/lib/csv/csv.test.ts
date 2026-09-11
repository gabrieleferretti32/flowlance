import { describe, expect, it } from "vitest";
import { campoDi, leggiCsv, separatoreProbabile } from "./parser";
import { mappaturaAutomatica, campiDi } from "./campi";
import {
  eNotaDiCredito,
  interpreta,
  sembraPersonale,
  valoriDistinti,
  type Piano,
} from "./importa";
import { cella, componiCsv, costiCsv, fattureCsv, noteCsv, numeroCsv } from "./esporta";
import { analizzaData } from "@/lib/format";
import type { Cliente, Costo, Fattura, NotaCredito } from "@/lib/dati/tipi";

// ————————————————————————————————————————————————————————————
// Il parser
// ————————————————————————————————————————————————————————————

describe("leggere un CSV come esce davvero da Excel", () => {
  it("riconosce il punto e virgola, che è quello che usa Excel italiano", () => {
    expect(separatoreProbabile("Data;Cliente;Importo\n01/02/2026;Alfa;1.500,00")).toBe(";");
    expect(separatoreProbabile("Data,Cliente,Importo\n01/02/2026,Alfa,1500.00")).toBe(",");
    expect(separatoreProbabile("Data\tCliente\tImporto\n01/02/2026\tAlfa\t1500")).toBe("\t");
  });

  it("**non si fa ingannare da una virgola dentro un campo fra virgolette**", () => {
    // Il caso italiano per eccellenza: separatore `;` e «Rossi, Mario» nel nome.
    // Contando le virgole a occhio vincerebbe la virgola, e il file andrebbe a pezzi.
    const testo = 'Data;Cliente;Importo\n01/02/2026;"Rossi, Mario";"1.500,00"';
    expect(separatoreProbabile(testo)).toBe(";");
    const t = leggiCsv(testo);
    expect(t.righe[0]).toEqual(["01/02/2026", "Rossi, Mario", "1.500,00"]);
  });

  it("toglie il BOM che Excel mette in testa ai file UTF-8", () => {
    const t = leggiCsv("﻿Data;Importo\n01/02/2026;10");
    expect(t.intestazioni[0]).toBe("Data");
  });

  it("regge le virgolette raddoppiate e gli a capo dentro un campo", () => {
    const t = leggiCsv('A;B\n1;"riga uno\nriga due"\n2;"il ""grande"" cliente"');
    expect(t.righe[0][1]).toBe("riga uno\nriga due");
    expect(t.righe[1][1]).toBe('il "grande" cliente');
  });

  it("le virgolette a metà campo restano testo: «12\" di schermo» non apre niente", () => {
    const t = leggiCsv('Descrizione;Importo\n12" di schermo;300');
    expect(t.righe[0]).toEqual(['12" di schermo', "300"]);
  });

  it("regge sia \\r\\n sia \\n, e ignora le righe vuote in coda", () => {
    const t = leggiCsv("A;B\r\n1;2\r\n3;4\r\n\r\n;\r\n");
    expect(t.righe).toEqual([["1", "2"], ["3", "4"]]);
  });

  it("una colonna senza intestazione prende un nome invece di restare vuota", () => {
    expect(leggiCsv("Data;;Importo\n1;2;3").intestazioni).toEqual(["Data", "Colonna 2", "Importo"]);
  });

  it("campoDi non esplode sulle righe più corte delle altre", () => {
    expect(campoDi(["a", "b"], 5)).toBe("");
    expect(campoDi(["a", " b "], 1)).toBe("b");
    expect(campoDi(["a"], null)).toBe("");
  });
});

// ————————————————————————————————————————————————————————————
// Le date italiane
// ————————————————————————————————————————————————————————————

describe("le date come le scrivono in Italia", () => {
  it("gg/mm/aaaa, con i separatori che capitano", () => {
    expect(analizzaData("31/12/2026")).toBe("2026-12-31");
    expect(analizzaData("31-12-2026")).toBe("2026-12-31");
    expect(analizzaData("31.12.2026")).toBe("2026-12-31");
    expect(analizzaData("1/2/2026")).toBe("2026-02-01");
  });

  it("il primo numero è il giorno, anche quando sarebbe un mese valido", () => {
    expect(analizzaData("03/04/2026")).toBe("2026-04-03");
  });

  it("accetta l'ISO che esce dai gestionali", () => {
    expect(analizzaData("2026-12-31")).toBe("2026-12-31");
  });

  it("l'anno a due cifre segue la finestra dei gestionali", () => {
    expect(analizzaData("31/12/26")).toBe("2026-12-31");
    expect(analizzaData("31/12/98")).toBe("1998-12-31");
  });

  it("**una data impossibile si scarta, non rimbalza al mese dopo**", () => {
    // `new Date(2026, 1, 31)` darebbe il 3 marzo: un giorno inventato dentro un
    // registro fiscale non lo nota più nessuno.
    expect(analizzaData("31/02/2026")).toBeNull();
    expect(analizzaData("29/02/2026")).toBeNull();
    expect(analizzaData("29/02/2024")).toBe("2024-02-29");
  });

  it("quel che non è una data resta null", () => {
    for (const v of ["", "  ", "ciao", "13/13/2026", "2026", "31/12"]) {
      expect(analizzaData(v)).toBeNull();
    }
  });
});

// ————————————————————————————————————————————————————————————
// La mappatura automatica
// ————————————————————————————————————————————————————————————

describe("indovinare le colonne dalle intestazioni", () => {
  it("associa un tracciato ordinario senza che l'utente tocchi niente", () => {
    const m = mappaturaAutomatica(
      ["Data", "Numero", "Cliente", "Descrizione", "Imponibile", "IVA", "Data incasso"],
      "fattura",
    );
    expect(m.data).toBe(0);
    expect(m.numero).toBe(1);
    expect(m.controparte).toBe(2);
    expect(m.imponibile).toBe(4);
    expect(m.aliquotaIva).toBe(5);
    expect(m.dataCassa).toBe(6);
  });

  it("**«Data incasso» non viene rubata da «Data»**: vince l'indizio più lungo", () => {
    const m = mappaturaAutomatica(["Data emissione", "Data incasso", "Importo", "Cliente"], "fattura");
    expect(m.data).toBe(0);
    expect(m.dataCassa).toBe(1);
  });

  it("una colonna sola non finisce in due campi", () => {
    const m = mappaturaAutomatica(["Data", "Cliente", "Importo"], "fattura");
    const usate = Object.values(m).filter((v) => v !== null);
    expect(new Set(usate).size).toBe(usate.length);
  });

  it("**«Attività o personale» può condividere la colonna della categoria**", () => {
    // In un estratto conto una colonna sola fa due mestieri: classifica il
    // costo e dice se è una spesa privata. Se la regola «una colonna, un campo»
    // valesse anche qui, l'utente resterebbe senza il modo di separarle.
    const m = mappaturaAutomatica(
      ["Data contabile", "Descrizione operazione", "Categoria", "Importo"],
      "costo",
    );
    expect(m.categoria).toBe(2);
    expect(m.natura).toBe(2);
  });

  /**
   * La colonna del saldato.
   *
   * Senza mapparla, una fattura pagata a metà entra come «tutta da incassare»:
   * è il primo inciampo di chiunque importi da un gestionale, e il motivo per
   * cui questo campo esiste.
   *
   * L'insidia sta negli indizi che si somigliano: «saldo» è un indizio della
   * data di incasso, e «pagato il» pure. Il confronto è a parole intere,
   * quindi «Saldato» non finisce nella data e «Importo pagato» nemmeno — ma è
   * il genere di cosa che si rompe al primo indizio aggiunto distrattamente.
   */
  it.each([
    ["Saldato", "Data incasso"],
    ["Importo pagato", "Pagata il"],
    ["Incassato", "Data incasso"],
    ["Importo saldato", "Saldo"],
  ])("«%s» va all'incassato, e «%s» resta la data", (colonnaImporto, colonnaData) => {
    const m = mappaturaAutomatica(
      ["Data", "Numero", "Cliente", "Imponibile", colonnaData, colonnaImporto],
      "fattura",
    );
    expect(m.importoIncassato, `«${colonnaImporto}» non è finita nell'incassato`).toBe(5);
    expect(m.dataCassa, `«${colonnaData}» non è rimasta la data`).toBe(4);
  });

  it("l'incassato non esiste sui costi né sulle note: è una colonna della fattura", () => {
    expect(campiDi("costo").some((c) => c.chiave === "importoIncassato")).toBe(false);
    expect(campiDi("nota").some((c) => c.chiave === "importoIncassato")).toBe(false);
    expect(campiDi("fattura").some((c) => c.chiave === "importoIncassato")).toBe(true);
  });

  it("quel che non riconosce resta da associare a mano, non inventato", () => {
    const m = mappaturaAutomatica(["Colonna A", "Colonna B"], "fattura");
    expect(Object.values(m).every((v) => v === null)).toBe(true);
  });

  it("ogni campo obbligatorio è dichiarato tale, e gli altri hanno un predefinito scritto", () => {
    for (const campo of [...campiDi("fattura"), ...campiDi("costo")]) {
      if (!campo.obbligatorio) expect(campo.predefinito, campo.etichetta).toBeTruthy();
    }
  });
});

// ————————————————————————————————————————————————————————————
// L'interpretazione delle righe
// ————————————————————————————————————————————————————————————

let contatore = 0;
const idFinto = () => `id-${++contatore}`;

function pianoFatture(extra: Partial<Piano> = {}): Piano {
  return {
    destinazione: "fattura",
    mappatura: mappaturaAutomatica(
      ["Data", "Numero", "Cliente", "Descrizione", "Imponibile", "IVA", "Data incasso"],
      "fattura",
    ),
    valoriPersonali: [],
    suiDuplicati: "importa",
    aliquotaPredefinita: 0.22,
    spesePersonaliFisse: false,
    ...extra,
  };
}

const VUOTO = {
  fatture: [] as Fattura[],
  note: [] as NotaCredito[],
  costi: [] as Costo[],
  clienti: [] as Cliente[],
};

const RIGHE_FATTURE = [
  ["01/02/2026", "2026/001", "Alfa Srl", "Consulenza", "1.500,00", "22", "05/03/2026"],
  ["15/03/2026", "2026/002", "Beta Spa", "Progetto", "4.200,50", "22", ""],
];

describe("dalle righe alle fatture", () => {
  it("legge importi e date italiani senza perdere centesimi", () => {
    contatore = 0;
    const l = interpreta(RIGHE_FATTURE, pianoFatture(), VUOTO, { id: idFinto });
    expect(l.fatture).toHaveLength(2);
    expect(l.fatture[0].fattura.imponibile).toBe(1_500);
    expect(l.fatture[1].fattura.imponibile).toBe(4_200.5);
    expect(l.fatture[0].fattura.dataEmissione).toBe("2026-02-01");
    expect(l.fatture[0].fattura.dataIncasso).toBe("2026-03-05");
    expect(l.fatture[1].fattura.dataIncasso).toBeNull();
  });

  it("i clienti nuovi si creano una volta sola, anche scritti in modo diverso", () => {
    contatore = 0;
    const righe = [
      ["01/02/2026", "1", "Alfa Srl", "", "100", "", ""],
      ["02/02/2026", "2", "ALFA  S.R.L.", "", "200", "", ""],
      ["03/02/2026", "3", "Beta Spa", "", "300", "", ""],
    ];
    const l = interpreta(righe, pianoFatture(), VUOTO, { id: idFinto });
    expect(l.clientiDaCreare).toEqual(["Alfa Srl", "Beta Spa"]);
    expect(l.fatture[0].fattura.clienteId).toBe(l.fatture[1].fattura.clienteId);
  });

  it("un cliente già in archivio si riusa, non si duplica", () => {
    contatore = 0;
    const clienti: Cliente[] = [
      { id: "c1", nome: "Alfa S.r.l.", canaleAcquisizione: "Passaparola", note: "" },
    ];
    const l = interpreta([["01/02/2026", "1", "ALFA SRL", "", "100", "", ""]], pianoFatture(), {
      ...VUOTO,
      clienti,
    }, { id: idFinto });
    expect(l.clientiDaCreare).toEqual([]);
    expect(l.fatture[0].fattura.clienteId).toBe("c1");
  });

  it("senza colonna IVA si applica l'aliquota dichiarata, non uno zero silenzioso", () => {
    contatore = 0;
    const piano = pianoFatture({ mappatura: { ...pianoFatture().mappatura, aliquotaIva: null } });
    const l = interpreta(RIGHE_FATTURE, piano, VUOTO, { id: idFinto });
    expect(l.fatture[0].fattura.aliquotaIva).toBe(0.22);
  });

  it("senza numero assegna un progressivo invece di scartare la riga", () => {
    contatore = 0;
    const piano = pianoFatture({ mappatura: { ...pianoFatture().mappatura, numero: null } });
    const l = interpreta(RIGHE_FATTURE, piano, VUOTO, { id: idFinto });
    expect(l.fatture.map((f) => f.fattura.numero)).toEqual(["IMP-1", "IMP-2"]);
  });
});

// ————————————————————————————————————————————————————————————
// Le righe che non si leggono
// ————————————————————————————————————————————————————————————

/**
 * Quanto è stato incassato, letto dal file.
 *
 * Il campo si scrive solo insieme alla data: la cassa dell'app parte da lì, e
 * un importo senza data sarebbe un numero che nessun conto guarda. Le righe che
 * portano l'uno e non l'altra si contano, perché un'assenza non si nota.
 */
describe("la colonna del saldato", () => {
  const INTESTAZIONI = ["Data", "Numero", "Cliente", "Imponibile", "Data incasso", "Saldato"];
  const piano = pianoFatture({ mappatura: mappaturaAutomatica(INTESTAZIONI, "fattura") });
  const riga = (dataIncasso: string, saldato: string) => [
    ["01/02/2026", "2026/001", "Alfa Srl", "1.000,00", dataIncasso, saldato],
  ];

  it("**con la data, l'importo entra**", () => {
    const l = interpreta(riga("05/03/2026", "610,00"), piano, VUOTO, { id: idFinto });
    expect(l.fatture[0].fattura.importoIncassato).toBe(610);
    expect(l.incassiSenzaData).toEqual([]);
  });

  it("senza la data l'importo resta fuori, e la riga si conta", () => {
    const l = interpreta(riga("", "610,00"), piano, VUOTO, { id: idFinto });
    expect(l.fatture).toHaveLength(1);
    expect(l.fatture[0].fattura.importoIncassato).toBeUndefined();
    expect(l.incassiSenzaData).toHaveLength(1);
    expect(l.incassiSenzaData[0].descrizione).toContain("610,00");
  });

  it("colonna vuota: il campo non c'è, e vuol dire «tutto»", () => {
    const l = interpreta(riga("05/03/2026", ""), piano, VUOTO, { id: idFinto });
    expect(l.fatture[0].fattura.importoIncassato).toBeUndefined();
    expect(l.incassiSenzaData).toEqual([]);
  });

  it("zero non è un incasso: il campo non si scrive", () => {
    const l = interpreta(riga("05/03/2026", "0,00"), piano, VUOTO, { id: idFinto });
    expect(l.fatture[0].fattura.importoIncassato).toBeUndefined();
  });

  it("senza la colonna mappata, niente cambia rispetto a prima", () => {
    const l = interpreta(RIGHE_FATTURE, pianoFatture(), VUOTO, { id: idFinto });
    expect(l.fatture.every((f) => f.fattura.importoIncassato === undefined)).toBe(true);
    expect(l.incassiSenzaData).toEqual([]);
  });

  it("un importo negativo entra in positivo, come l'imponibile", () => {
    const l = interpreta(riga("05/03/2026", "-610,00"), piano, VUOTO, { id: idFinto });
    expect(l.fatture[0].fattura.importoIncassato).toBe(610);
  });
});

describe("una riga illeggibile non ferma le altre", () => {
  it("scarta e continua, dicendo riga e motivo", () => {
    contatore = 0;
    const righe = [
      ["01/02/2026", "1", "Alfa", "", "100", "", ""],
      ["", "2", "Beta", "", "200", "", ""],
      ["31/02/2026", "3", "Gamma", "", "300", "", ""],
      ["05/02/2026", "4", "Delta", "", "non un numero", "", ""],
      ["06/02/2026", "5", "", "", "500", "", ""],
      ["07/02/2026", "6", "Epsilon", "", "600", "", ""],
    ];
    const l = interpreta(righe, pianoFatture(), VUOTO, { id: idFinto });
    expect(l.fatture).toHaveLength(2);
    expect(l.scartate.map((s) => s.riga)).toEqual([3, 4, 5, 6]);
    expect(l.scartate[0].motivo).toContain("manca la data");
    expect(l.scartate[1].motivo).toContain("31/02/2026");
    expect(l.scartate[2].motivo).toContain("non un numero");
    expect(l.scartate[3].motivo).toContain("manca il cliente");
  });

  it("il numero di riga è quello che si legge in Excel, intestazione compresa", () => {
    const l = interpreta([["", "", "", "", "", "", ""]], pianoFatture(), VUOTO, { id: idFinto });
    expect(l.scartate[0].riga).toBe(2);
  });

  it("lo scarto porta con sé le prime celle, per riconoscere la riga", () => {
    const l = interpreta([["", "7", "Zeta Srl", "canone"]], pianoFatture(), VUOTO, { id: idFinto });
    expect(l.scartate[0].anteprima).toContain("Zeta Srl");
  });

  it("un importo a zero si scarta: non è una fattura", () => {
    const l = interpreta([["01/02/2026", "1", "Alfa", "", "0,00", "", ""]], pianoFatture(), VUOTO, {
      id: idFinto,
    });
    expect(l.scartate[0].motivo).toContain("zero");
  });
});

// ————————————————————————————————————————————————————————————
// I duplicati
// ————————————————————————————————————————————————————————————

describe("i duplicati si segnalano, e la scelta è una per tutto l'import", () => {
  const esistenti = {
    ...VUOTO,
    fatture: [
      {
        id: "f1",
        dataEmissione: "2026-02-01",
        numero: "2026/001",
        clienteId: "c1",
        descrizione: "",
        tipoRicavo: "progetto" as const,
        imponibile: 1_500,
      },
    ],
  };

  it("li riconosce da numero e data, e li elenca", () => {
    contatore = 0;
    const l = interpreta(RIGHE_FATTURE, pianoFatture(), esistenti, { id: idFinto });
    expect(l.duplicati).toHaveLength(1);
    expect(l.duplicati[0].descrizione).toContain("2026/001");
    expect(l.duplicati[0].idEsistente).toBe("f1");
  });

  it("«importa comunque» è la predefinita: la riga entra lo stesso", () => {
    contatore = 0;
    const l = interpreta(RIGHE_FATTURE, pianoFatture({ suiDuplicati: "importa" }), esistenti, {
      id: idFinto,
    });
    expect(l.fatture).toHaveLength(2);
    expect(l.fatture[0].fattura.id).not.toBe("f1");
  });

  it("«salta» la lascia fuori ma la elenca comunque", () => {
    contatore = 0;
    const l = interpreta(RIGHE_FATTURE, pianoFatture({ suiDuplicati: "salta" }), esistenti, {
      id: idFinto,
    });
    expect(l.fatture).toHaveLength(1);
    expect(l.duplicati).toHaveLength(1);
  });

  it("«sostituisci» riusa l'id esistente, così l'esistente viene riscritto", () => {
    contatore = 0;
    const l = interpreta(RIGHE_FATTURE, pianoFatture({ suiDuplicati: "sostituisci" }), esistenti, {
      id: idFinto,
    });
    expect(l.fatture[0].fattura.id).toBe("f1");
  });

  it("un costo è duplicato per fornitore, data e importo, che un numero non ce l'ha", () => {
    const costo: Costo = {
      id: "k1",
      dataDocumento: "2026-02-01",
      fornitore: "Enel",
      categoria: "Affitto e utenze ufficio",
      descrizione: "",
      natura: "variabile",
      imponibile: 120,
      aliquotaIva: 0.22,
      percentualeDeducibilita: 1,
    };
    const piano: Piano = {
      ...pianoFatture(),
      destinazione: "costo",
      mappatura: mappaturaAutomatica(["Data", "Fornitore", "Importo"], "costo"),
    };
    const l = interpreta([["01/02/2026", "ENEL", "120,00"]], piano, { ...VUOTO, costi: [costo] }, {
      id: idFinto,
    });
    expect(l.duplicati[0].idEsistente).toBe("k1");
  });
});

// ————————————————————————————————————————————————————————————
// Attività o personale
// ————————————————————————————————————————————————————————————

describe("separare i costi dell'attività dalle spese personali", () => {
  const intestazioni = ["Data", "Descrizione", "Categoria", "Importo"];
  const piano = (valoriPersonali: string[]): Piano => ({
    destinazione: "costo",
    mappatura: {
      ...mappaturaAutomatica(intestazioni, "costo"),
      controparte: 1,
      natura: 2,
      categoria: 2,
      imponibile: 3,
    },
    valoriPersonali,
    suiDuplicati: "importa",
    aliquotaPredefinita: 0.22,
    spesePersonaliFisse: false,
  });

  const righe = [
    ["03/02/2026", "Amazon AWS", "Software", "89,00"],
    ["05/02/2026", "Esselunga", "Spesa e alimentari", "142,30"],
    ["07/02/2026", "Studio Bianchi", "Consulenze", "500,00"],
    ["09/02/2026", "Farmacia", "Salute", "31,50"],
  ];

  it("**lo stesso file si divide in due destinazioni**", () => {
    contatore = 0;
    const l = interpreta(righe, piano(["Spesa e alimentari", "Salute"]), VUOTO, { id: idFinto });
    expect(l.costi.map((c) => c.costo.fornitore)).toEqual(["Amazon AWS", "Studio Bianchi"]);
    expect(l.personali.map((p) => p.descrizione)).toEqual(["Esselunga", "Farmacia"]);
  });

  it("le spese personali portano anno e mese: confluiscono nel mese, non sono righe", () => {
    contatore = 0;
    const l = interpreta(righe, piano(["Salute"]), VUOTO, { id: idFinto });
    expect(l.personali[0]).toMatchObject({ anno: 2026, mese: 2, importo: 31.5 });
  });

  it("senza colonna della natura tutto resta costo dell'attività", () => {
    contatore = 0;
    const senzaNatura = { ...piano([]), mappatura: { ...piano([]).mappatura, natura: null } };
    const l = interpreta(righe, senzaNatura, VUOTO, { id: idFinto });
    expect(l.costi).toHaveLength(4);
    expect(l.personali).toHaveLength(0);
  });

  it("i valori distinti si elencano per farli spuntare", () => {
    expect(valoriDistinti(righe, 2)).toEqual([
      "Consulenze",
      "Salute",
      "Software",
      "Spesa e alimentari",
    ]);
    expect(valoriDistinti(righe, null)).toEqual([]);
  });

  it("le voci che sembrano private partono già spuntate", () => {
    expect(sembraPersonale("Spesa e alimentari")).toBe(true);
    expect(sembraPersonale("Salute")).toBe(true);
    // Un indizio di due parole: il confronto avviene fra valori normalizzati,
    // e con l'indizio scritto com'è non troverebbe mai niente.
    expect(sembraPersonale("Tempo libero")).toBe(true);
    expect(sembraPersonale("Software e abbonamenti")).toBe(false);
    expect(sembraPersonale("Consulenze")).toBe(false);
  });
});

// ————————————————————————————————————————————————————————————
// L'export
// ————————————————————————————————————————————————————————————

describe("un CSV che Excel italiano apre senza chiedere niente", () => {
  const clienti: Cliente[] = [
    { id: "c1", nome: 'Alfa "Group"; Srl', canaleAcquisizione: "", note: "" },
  ];
  const fatture: Fattura[] = [
    {
      id: "f1",
      dataEmissione: "2026-02-01",
      numero: "2026/001",
      clienteId: "c1",
      descrizione: "Consulenza",
      tipoRicavo: "progetto",
      imponibile: 1_500.5,
      aliquotaIva: 0.22,
      dataIncasso: "2026-03-05",
    },
  ];

  it("BOM, punto e virgola e virgola decimale", () => {
    const csv = fattureCsv(fatture, clienti);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Data emissione;Numero;Cliente");
    expect(csv).toContain("1500,50");
    expect(csv).toContain("01/02/2026");
  });

  it("le virgolette e i separatori nei nomi non spezzano il file", () => {
    const csv = fattureCsv(fatture, clienti);
    expect(csv).toContain('"Alfa ""Group""; Srl"');
    // E rileggendolo si torna al punto di partenza.
    const t = leggiCsv(csv);
    expect(t.righe[0][2]).toBe('Alfa "Group"; Srl');
  });

  it("**l'andata e ritorno conserva i numeri**", () => {
    const t = leggiCsv(fattureCsv(fatture, clienti));
    const piano = pianoFatture({
      mappatura: mappaturaAutomatica(t.intestazioni, "fattura"),
    });
    contatore = 0;
    const l = interpreta(t.righe, piano, VUOTO, { id: idFinto });
    expect(l.fatture[0].fattura.imponibile).toBe(1_500.5);
    expect(l.fatture[0].fattura.dataEmissione).toBe("2026-02-01");
    expect(l.fatture[0].fattura.dataIncasso).toBe("2026-03-05");
    expect(l.fatture[0].fattura.aliquotaIva).toBe(0.22);
    expect(l.fatture[0].nomeCliente).toBe('Alfa "Group"; Srl');
  });

  it("i costi escono con deducibilità e natura", () => {
    const csv = costiCsv([
      {
        id: "k1",
        dataDocumento: "2026-02-01",
        fornitore: "Enel",
        categoria: "Utenze",
        descrizione: "",
        natura: "fisso",
        imponibile: 120,
        aliquotaIva: 0.22,
        percentualeDeducibilita: 0.5,
      },
    ]);
    expect(csv).toContain("Enel;Utenze;;fisso;120,00;22,00;50,00");
  });

  it("le celle senza caratteri speciali non vengono inutilmente virgolettate", () => {
    expect(cella("Alfa")).toBe("Alfa");
    expect(cella(null)).toBe("");
    expect(numeroCsv(1234.5)).toBe("1234,50");
    expect(componiCsv(["A"], [["x"]])).toBe("﻿A\r\nx\r\n");
  });
});

// ————————————————————————————————————————————————————————————
// La colonna «Documento»
// ————————————————————————————————————————————————————————————

describe("le note di credito arrivano riconosciute dal CSV", () => {
  const intestazioni = ["Data", "Documento", "Numero", "Cliente", "Imponibile", "IVA", "Incasso"];
  const piano = (): Piano => ({
    destinazione: "fattura",
    mappatura: mappaturaAutomatica(intestazioni, "fattura"),
    valoriPersonali: [],
    suiDuplicati: "importa",
    aliquotaPredefinita: 0.22,
    spesePersonaliFisse: false,
  });

  const righe = [
    ["01/02/2026", "Fattura", "2026/001", "Alfa Srl", "1.000,00", "22", "20/02/2026"],
    ["10/03/2026", "Nota di credito", "NC/1", "Alfa Srl", "500,00", "22", "05/04/2026"],
    ["12/03/2026", "NOTA CREDITO", "NC/2", "Beta Spa", "300,00", "22", ""],
  ];

  it("la colonna «Documento» viene mappata da sola", () => {
    expect(mappaturaAutomatica(intestazioni, "fattura").documento).toBe(1);
  });

  it("**le note escono separate dalle fatture, non col meno davanti**", () => {
    contatore = 0;
    const l = interpreta(righe, piano(), VUOTO, { id: idFinto });
    expect(l.fatture).toHaveLength(1);
    expect(l.note).toHaveLength(2);
    expect(l.note.map((n) => n.nota.numero)).toEqual(["NC/1", "NC/2"]);
    expect(l.note[0].nota.imponibile).toBe(500);
  });

  it("sulla nota la colonna dell'incasso è la data del rimborso", () => {
    contatore = 0;
    const l = interpreta(righe, piano(), VUOTO, { id: idFinto });
    expect(l.note[0].nota.dataRimborso).toBe("2026-04-05");
    expect(l.note[1].nota.dataRimborso).toBeNull();
  });

  it("riconosce le diciture che usano i gestionali, e non altro", () => {
    expect(eNotaDiCredito("Nota di credito")).toBe(true);
    expect(eNotaDiCredito("NOTA CREDITO")).toBe(true);
    expect(eNotaDiCredito("nota_di_credito")).toBe(true);
    expect(eNotaDiCredito("NC")).toBe(true);
    expect(eNotaDiCredito("Fattura")).toBe(false);
    expect(eNotaDiCredito("")).toBe(false);
    // «Notula» è un documento diverso: non deve cadere fra le note.
    expect(eNotaDiCredito("Notula")).toBe(false);
  });

  it("partendo dalle note, un file misto resta misto", () => {
    /*
      Chi arriva dal registro delle note trova «Note di credito» già scelto, ma
      il file che ha in mano è l'esportazione mista del gestionale. Quello che
      il file dichiara vale più della scelta fatta in cima alla schermata: la
      riga marcata «Fattura» resta una fattura, e il fatturato non si sposta.
    */
    contatore = 0;
    const l = interpreta(
      righe,
      { ...piano(), destinazione: "nota", mappatura: mappaturaAutomatica(intestazioni, "nota") },
      VUOTO,
      { id: idFinto },
    );
    expect(l.fatture).toHaveLength(1);
    expect(l.fatture[0].fattura.numero).toBe("2026/001");
    expect(l.note).toHaveLength(2);
  });

  it("partendo dalle note, un file senza la colonna diventa tutto note", () => {
    /*
      È il caso che la sola colonna «Documento» non copre: un gestionale che
      esporta le note in un file loro, senza niente che dica cosa sono. Prima
      entravano tutte come fatture, e il fatturato saliva invece di scendere.
    */
    contatore = 0;
    const senzaColonna = ["Data", "Numero", "Cliente", "Imponibile", "IVA", "Rimborso"];
    const l = interpreta(
      [
        ["10/03/2026", "NC/1", "Alfa Srl", "500,00", "22", "05/04/2026"],
        ["12/03/2026", "NC/2", "Beta Spa", "300,00", "22", ""],
      ],
      {
        ...piano(),
        destinazione: "nota",
        mappatura: mappaturaAutomatica(senzaColonna, "nota"),
      },
      VUOTO,
      { id: idFinto },
    );
    expect(l.fatture).toHaveLength(0);
    expect(l.note).toHaveLength(2);
    // La colonna del rimborso è quella che fa scendere i ricavi per cassa.
    expect(l.note[0].nota.dataRimborso).toBe("2026-04-05");
    expect(l.note[1].nota.dataRimborso).toBeNull();
  });

  it("reimportare lo stesso file misto non raddoppia le note", () => {
    /*
      Le fatture erano già protette, le note no: uno storno contato due volte
      abbassa il fatturato del doppio, e in silenzio.
    */
    contatore = 0;
    const primo = interpreta(righe, piano(), VUOTO, { id: idFinto });
    const inArchivio = {
      ...VUOTO,
      fatture: primo.fatture.map((f) => f.fattura),
      note: primo.note.map((n) => n.nota),
    };
    const secondo = interpreta(righe, { ...piano(), suiDuplicati: "salta" }, inArchivio, {
      id: idFinto,
    });
    expect(secondo.duplicati).toHaveLength(3);
    expect(secondo.note).toHaveLength(0);
    expect(secondo.fatture).toHaveLength(0);
  });

  it("i campi delle note sono quelli delle note", () => {
    const chiavi = campiDi("nota").map((c) => c.chiave);
    expect(chiavi).toContain("controparte");
    expect(chiavi).toContain("documento");
    // Il tipo di ricavo su una nota non vuol dire niente, la deducibilità nemmeno.
    expect(chiavi).not.toContain("tipoRicavo");
    expect(chiavi).not.toContain("deducibilita");
    // E la colonna di cassa si chiama col nome giusto.
    const cassa = campiDi("nota").find((c) => c.chiave === "dataCassa");
    expect(cassa?.etichetta).toBe("Data del rimborso");
  });

  it("l'export delle note rientra da solo dove deve", () => {
    /*
      Il giro completo: si esporta, si riapre il file e le note tornano note.
      Regge perché l'export scrive la colonna «Documento» — senza, rientrerebbero
      come fatture e ogni giro d'andata e ritorno gonfierebbe il fatturato.
    */
    contatore = 0;
    const clienti: Cliente[] = [
      { id: "c1", nome: "Alfa Srl", canaleAcquisizione: "Passaparola", note: "" },
    ];
    const note: NotaCredito[] = [
      {
        id: "n1",
        dataDocumento: "2026-03-10",
        numero: "NC/1",
        clienteId: "c1",
        descrizione: "Storno di marzo",
        imponibile: 500,
        aliquotaIva: 0.22,
        dataRimborso: "2026-04-05",
      },
    ];
    const tabella = leggiCsv(noteCsv(note, clienti));
    const l = interpreta(
      tabella.righe,
      {
        ...piano(),
        mappatura: mappaturaAutomatica(tabella.intestazioni, "fattura"),
      },
      VUOTO,
      { id: idFinto },
    );
    expect(l.fatture).toHaveLength(0);
    expect(l.note).toHaveLength(1);
    expect(l.note[0].nota.numero).toBe("NC/1");
    expect(l.note[0].nota.imponibile).toBe(500);
    expect(l.note[0].nota.dataRimborso).toBe("2026-04-05");
  });

  it("senza la colonna tutte le righe restano fatture", () => {
    contatore = 0;
    const senza = { ...piano(), mappatura: { ...piano().mappatura, documento: null } };
    const l = interpreta(righe, senza, VUOTO, { id: idFinto });
    expect(l.fatture).toHaveLength(3);
    expect(l.note).toHaveLength(0);
  });

  it("i clienti delle note si creano come quelli delle fatture, senza doppioni", () => {
    contatore = 0;
    const l = interpreta(righe, piano(), VUOTO, { id: idFinto });
    expect(l.clientiDaCreare).toEqual(["Alfa Srl", "Beta Spa"]);
    expect(l.note[0].nota.clienteId).toBe(l.fatture[0].fattura.clienteId);
  });
});
