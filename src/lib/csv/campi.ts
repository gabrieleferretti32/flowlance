/**
 * I campi in cui si può versare una colonna del CSV, e come indovinarli.
 *
 * L'utente non adatta il suo file a un tracciato: associa le sue colonne ai
 * campi dell'app. Questo modulo dichiara quali sono quei campi — cosa serve,
 * cosa è facoltativo, e con che valore si riempie quando la colonna non c'è —
 * e prova a fare l'associazione da solo leggendo le intestazioni, perché nel
 * caso normale non ci sia niente da fare.
 *
 * I valori predefiniti sono dichiarati qui e mostrati in anteprima. È la stessa
 * regola dell'onboarding: un valore non impostato ha un default che si legge,
 * non uno che si scopre dopo.
 */

/**
 * Che cosa contiene il file, quando il file non lo dice.
 *
 * È un valore predefinito per riga, non un vincolo: la colonna «Tipo di
 * documento», che Fatture in Cloud e altri gestionali esportano, decide riga
 * per riga. Il caso vero non è un file di sole note di credito, è un file misto
 * — fatture e note nella stessa esportazione — e ogni riga deve finire dove
 * dice il file. La destinazione serve alle righe che non lo dicono: un
 * gestionale che esporta solo le note in un file senza quella colonna esiste, e
 * senza questa scelta le sue righe entrerebbero tutte come fatture, gonfiando
 * il fatturato invece di ridurlo.
 *
 * Le spese personali invece non sono una destinazione: hanno la stessa forma di
 * un costo — data, importo, descrizione, categoria — e cambia solo dove
 * finiscono. Chi esporta il conto dalla banca ha le due nature mescolate nello
 * stesso file, e le separa indicando la colonna che le distingue: vedi
 * `valoriPersonali` in `Piano`.
 */
export type Destinazione = "fattura" | "nota" | "costo";

export type Campo = {
  chiave: string;
  etichetta: string;
  /** Senza questo la riga non si può interpretare. */
  obbligatorio: boolean;
  /** Cosa succede se la colonna non è associata. Mostrato in anteprima. */
  predefinito?: string;
  /** Parole cercate nell'intestazione, già in minuscolo e senza accenti. */
  indizi: string[];
  destinazioni: Destinazione[];
};

export const CAMPI: Campo[] = [
  {
    chiave: "data",
    etichetta: "Data del documento",
    obbligatorio: true,
    indizi: ["data", "data documento", "data fattura", "data emissione", "emissione", "data operazione", "data contabile", "data valuta"],
    destinazioni: ["fattura", "nota", "costo"],
  },
  {
    chiave: "numero",
    etichetta: "Numero",
    obbligatorio: false,
    predefinito: "progressivo assegnato dall'app",
    indizi: ["numero", "n.", "num", "nr", "numero fattura", "numero nota", "protocollo", "riferimento"],
    destinazioni: ["fattura", "nota"],
  },
  {
    chiave: "controparte",
    etichetta: "Cliente",
    obbligatorio: true,
    indizi: ["cliente", "ragione sociale", "denominazione", "intestatario", "committente", "nominativo"],
    destinazioni: ["fattura", "nota"],
  },
  {
    chiave: "controparte",
    etichetta: "Fornitore",
    obbligatorio: true,
    indizi: ["fornitore", "ragione sociale", "denominazione", "beneficiario", "descrizione operazione", "controparte"],
    destinazioni: ["costo"],
  },
  {
    chiave: "descrizione",
    etichetta: "Descrizione",
    obbligatorio: false,
    predefinito: "vuota",
    indizi: ["descrizione", "causale", "oggetto", "note", "dettaglio"],
    destinazioni: ["fattura", "nota", "costo"],
  },
  {
    chiave: "imponibile",
    etichetta: "Imponibile",
    obbligatorio: true,
    indizi: ["imponibile", "importo", "totale", "ammontare", "valore", "netto", "uscite", "entrate", "dare", "avere"],
    destinazioni: ["fattura", "nota", "costo"],
  },
  {
    chiave: "aliquotaIva",
    etichetta: "Aliquota IVA",
    obbligatorio: false,
    predefinito: "l'aliquota ordinaria dell'anno, o 0 in forfettario",
    indizi: ["iva", "aliquota", "aliquota iva", "% iva", "imposta"],
    destinazioni: ["fattura", "nota", "costo"],
  },
  {
    chiave: "dataCassa",
    etichetta: "Data di incasso",
    obbligatorio: false,
    predefinito: "vuota: la fattura risulta da incassare",
    // «rimborso» sta qui perché in un'esportazione mista la colonna del denaro
    // è una sola: sulla fattura è l'incasso, sulla nota il rimborso. Senza,
    // riaprendo un file esportato da qui le date di rimborso si perdevano.
    indizi: ["incasso", "data incasso", "pagata il", "data pagamento", "saldo", "incassata", "rimborso", "data rimborso"],
    destinazioni: ["fattura"],
  },
  {
    chiave: "dataCassa",
    etichetta: "Data del rimborso",
    obbligatorio: false,
    // Sulla nota la colonna dell'incasso è il rimborso: è quella che fa
    // scendere i ricavi per cassa, come l'incasso li fa salire.
    predefinito: "vuota: la nota risulta da rimborsare",
    indizi: ["rimborso", "data rimborso", "incasso", "data incasso", "pagata il", "data pagamento", "saldo", "rimborsata"],
    destinazioni: ["nota"],
  },
  {
    chiave: "dataCassa",
    etichetta: "Data di pagamento",
    obbligatorio: false,
    predefinito: "vuota: il costo risulta da pagare",
    indizi: ["pagamento", "data pagamento", "pagato il", "saldo"],
    destinazioni: ["costo"],
  },
  {
    chiave: "importoIncassato",
    etichetta: "Quanto è stato incassato",
    obbligatorio: false,
    predefinito: "vuota: la fattura risulta incassata per intero",
    /*
      La colonna del saldato, che i gestionali esportano quasi sempre. Senza
      mapparla una fattura pagata a metà entra come «tutta da incassare», ed è
      il primo inciampo di chiunque importi da un gestionale.

      Gli indizi sono a parole intere, quindi non rubano la colonna della data:
      «saldo» — che è un indizio di `dataCassa` — non sta dentro «saldato», e
      «pagato il» non sta dentro «importo pagato».
    */
    indizi: [
      "saldato", "importo saldato", "pagato", "importo pagato", "incassato",
      "importo incassato", "riscosso", "importo riscosso", "totale pagato",
    ],
    destinazioni: ["fattura"],
  },
  {
    chiave: "categoria",
    etichetta: "Categoria",
    obbligatorio: false,
    predefinito: "«Altro»",
    indizi: ["categoria", "conto", "voce", "tipologia", "classificazione"],
    destinazioni: ["costo"],
  },
  {
    chiave: "documento",
    etichetta: "Tipo di documento",
    obbligatorio: false,
    predefinito: "vale la scelta qui sopra per tutte le righe",
    // Fatture in Cloud e diversi gestionali esportano già questa colonna: senza
    // mapparla le note di credito entrerebbero come fatture, e il fatturato
    // salirebbe invece di scendere.
    indizi: ["documento", "tipo documento", "tipo", "tipologia documento"],
    destinazioni: ["fattura", "nota"],
  },
  {
    chiave: "tipoRicavo",
    etichetta: "Tipo di ricavo",
    obbligatorio: false,
    predefinito: "«progetto»",
    indizi: ["tipo", "tipo ricavo", "natura"],
    destinazioni: ["fattura"],
  },
  {
    chiave: "deducibilita",
    etichetta: "Deducibilità",
    obbligatorio: false,
    predefinito: "100 %",
    indizi: ["deducibilita", "deducibile", "% deducibilita"],
    destinazioni: ["costo"],
  },
  {
    chiave: "natura",
    etichetta: "Attività o personale",
    obbligatorio: false,
    predefinito: "tutte le righe sono costi dell'attività",
    // La colonna che distingue le due nature nell'estratto conto: di solito è
    // la categoria assegnata dalla banca, o un conto.
    indizi: ["natura", "tipo movimento", "attivita", "personale", "conto", "categoria", "tipologia"],
    destinazioni: ["costo"],
  },
];

export function campiDi(destinazione: Destinazione): Campo[] {
  return CAMPI.filter((c) => c.destinazioni.includes(destinazione));
}

/** `{ data: 0, imponibile: 3, … }`. `null` = colonna non associata. */
export type Mappatura = Record<string, number | null>;

const ACCENTI: Record<string, string> = {
  à: "a", á: "a", è: "e", é: "e", ì: "i", í: "i", ò: "o", ó: "o", ù: "u", ú: "u",
};

function normalizza(testo: string): string {
  let out = "";
  for (const c of testo.toLowerCase().trim()) out += ACCENTI[c] ?? c;
  return out.replace(/[^a-z0-9% ]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Associa le colonne ai campi leggendo le intestazioni.
 *
 * Punteggio semplice: intestazione uguale a un indizio batte «contiene»,
 * e un indizio lungo batte uno corto — «data incasso» deve vincere su «data»
 * per la colonna dell'incasso, altrimenti la prima colonna che contiene «data»
 * si prende tutto.
 *
 * Ogni colonna va a un campo solo: assegnata, esce dalla gara. Il risultato è
 * un punto di partenza da correggere a mano, non un oracolo.
 */
/** Il campo che può condividere una colonna con un altro. Vedi sotto. */
const CONDIVISIBILE = "natura";

export function mappaturaAutomatica(intestazioni: string[], destinazione: Destinazione): Mappatura {
  const campi = campiDi(destinazione);
  const normalizzate = intestazioni.map(normalizza);
  const usate = new Set<number>();
  const mappatura: Mappatura = {};

  const candidati: { campo: string; colonna: number; punteggio: number }[] = [];
  for (const campo of campi) {
    for (let i = 0; i < normalizzate.length; i++) {
      const testa = normalizzate[i];
      if (testa === "") continue;
      let migliore = 0;
      // Gli spazi attorno rendono il confronto per parole intere: senza,
      // l'indizio «n.» — che serve a riconoscere «N. Fattura» — si troverebbe
      // dentro qualunque intestazione che contenga una enne, «Colonna A»
      // compresa, e mapperebbe mezzo file a caso.
      const conBordi = ` ${testa} `;
      for (const indizio of campo.indizi) {
        const n = normalizza(indizio);
        if (testa === n) migliore = Math.max(migliore, 1000 + n.length);
        else if (conBordi.includes(` ${n} `)) migliore = Math.max(migliore, 100 + n.length);
      }
      if (migliore > 0) candidati.push({ campo: campo.chiave, colonna: i, punteggio: migliore });
    }
  }

  candidati.sort((a, b) => b.punteggio - a.punteggio);
  for (const c of candidati) {
    if (c.campo === CONDIVISIBILE) continue;
    if (mappatura[c.campo] !== undefined || usate.has(c.colonna)) continue;
    mappatura[c.campo] = c.colonna;
    usate.add(c.colonna);
  }

  // «Attività o personale» è l'eccezione alla regola «una colonna, un campo»,
  // e lo è per come sono fatti i file veri: in un estratto conto la stessa
  // colonna «Categoria» classifica il costo *e* dice se è una spesa privata.
  // Escluderla perché la colonna è già presa lascerebbe l'utente senza il modo
  // di separare le due nature proprio nel caso in cui gli serve.
  if (campi.some((c) => c.chiave === CONDIVISIBILE)) {
    const suo = candidati.find((c) => c.campo === CONDIVISIBILE);
    mappatura[CONDIVISIBILE] = suo?.colonna ?? mappatura.categoria ?? null;
  }

  for (const campo of campi) {
    if (mappatura[campo.chiave] === undefined) mappatura[campo.chiave] = null;
  }
  return mappatura;
}
