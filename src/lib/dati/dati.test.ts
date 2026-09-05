import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { calcolaProspetto } from "@/lib/fisco/motore";
import { PARAMETRI_2026 } from "@/lib/fisco/parametri/2026";
import type { StorageAdapter } from "./adapter";
import {
  analizzaBackup,
  creaBackup,
  nomeFileBackup,
  serializzaBackup,
  FORMATI_STORICI,
} from "./backup";
import { catenaAnni } from "@/lib/analisi/anno";
import { scadenzeAnno } from "@/lib/fisco/scadenze";
import { ANNO_DEMO, datiDemo } from "./demo";

/** La data in cui il dataset dimostrativo è ambientato. */
const OGGI_DEMO = "2026-09-05";

/** Le impostazioni dell'anno raccontato: il dataset ne ha anche per l'anno prima. */
function impostazioniDemo() {
  return datiDemo().impostazioni.find((i) => i.anno === ANNO_DEMO)!;
}
import { DatabaseFinanze, VERSIONE_SCHEMA } from "./db";
import { DexieAdapter } from "./dexie-adapter";
import { MemoriaAdapter } from "./memoria-adapter";
import { COLLEZIONI, datiVuoti, nuovoId, type Dati } from "./tipi";

// ————————————————————————————————————————————————————————————
// Il contratto dell'adapter, verificato su entrambe le implementazioni.
// ————————————————————————————————————————————————————————————

const implementazioni: [string, () => StorageAdapter][] = [
  ["memoria", () => new MemoriaAdapter()],
  ["indexeddb", () => new DexieAdapter(new DatabaseFinanze(`prova-${nuovoId()}`))],
];

describe.each(implementazioni)("StorageAdapter · %s", (_nome, crea) => {
  let adapter: StorageAdapter;

  beforeEach(() => {
    adapter = crea();
  });

  it("parte vuoto", async () => {
    expect(await adapter.vuoto()).toBe(true);
    expect(await adapter.fatture.conta()).toBe(0);
  });

  it("salva, rilegge e cancella una singola entità", async () => {
    const fattura = datiDemo().fatture[0];
    await adapter.fatture.salva(fattura);
    expect(await adapter.fatture.leggi(fattura.id)).toEqual(fattura);
    expect(await adapter.vuoto()).toBe(false);

    await adapter.fatture.elimina(fattura.id);
    expect(await adapter.fatture.leggi(fattura.id)).toBeUndefined();
    expect(await adapter.vuoto()).toBe(true);
  });

  it("sovrascrive per chiave invece di duplicare", async () => {
    const fattura = datiDemo().fatture[0];
    await adapter.fatture.salva(fattura);
    await adapter.fatture.salva({ ...fattura, imponibile: 9999 });
    expect(await adapter.fatture.conta()).toBe(1);
    expect((await adapter.fatture.leggi(fattura.id))?.imponibile).toBe(9999);
  });

  it("indicizza le impostazioni per anno, non per identificatore", async () => {
    const impostazioni = impostazioniDemo();
    await adapter.impostazioni.salva(impostazioni);
    await adapter.impostazioni.salva({ ...impostazioni, anno: 2027 });
    expect(await adapter.impostazioni.conta()).toBe(2);
    expect((await adapter.impostazioni.leggi(ANNO_DEMO))?.anno).toBe(ANNO_DEMO);
  });

  it("scrive e rilegge il dataset dimostrativo per intero", async () => {
    const dati = datiDemo();
    const esito = await adapter.scriviTutto(dati, "sostituisci");
    expect(esito.totale).toBeGreaterThan(100);

    const riletti = await adapter.leggiTutto();
    for (const collezione of COLLEZIONI) {
      expect(ordina(riletti[collezione])).toEqual(ordina(dati[collezione]));
    }
  });

  it("«sostituisci» rimpiazza, «unisci» fonde", async () => {
    const dati = datiDemo();
    await adapter.scriviTutto(dati, "sostituisci");

    const soloUnCliente: Dati = {
      ...datiVuoti(),
      clienti: [{ id: "cli-nuovo", nome: "Omega Srl", canaleAcquisizione: "Fiera", note: "" }],
    };

    await adapter.scriviTutto(soloUnCliente, "unisci");
    expect(await adapter.clienti.conta()).toBe(dati.clienti.length + 1);
    expect(await adapter.fatture.conta()).toBe(dati.fatture.length);

    await adapter.scriviTutto(soloUnCliente, "sostituisci");
    expect(await adapter.clienti.conta()).toBe(1);
    expect(await adapter.fatture.conta()).toBe(0);
  });

  it("svuota tutto", async () => {
    await adapter.scriviTutto(datiDemo(), "sostituisci");
    await adapter.svuota();
    expect(await adapter.vuoto()).toBe(true);
  });

  it("il giro completo export → svuota → import restituisce lo stesso stato", async () => {
    await adapter.scriviTutto(datiDemo(), "sostituisci");
    const prima = await adapter.leggiTutto();

    const file = serializzaBackup(creaBackup(prima));
    await adapter.svuota();
    expect(await adapter.vuoto()).toBe(true);

    const letto = analizzaBackup(file);
    expect(letto.ok).toBe(true);
    if (!letto.ok) return;
    await adapter.scriviTutto(letto.backup.dati, "sostituisci");

    const dopo = await adapter.leggiTutto();
    for (const collezione of COLLEZIONI) {
      expect(ordina(dopo[collezione])).toEqual(ordina(prima[collezione]));
    }
  });
});

// ————————————————————————————————————————————————————————————
// Backup
// ————————————————————————————————————————————————————————————

describe("file di backup", () => {
  it("ha un nome parlante e un marcatore di formato", () => {
    expect(nomeFileBackup(new Date("2026-09-01T10:00:00Z"))).toBe(
      "flowlance-2026-09-01.json",
    );
    const backup = creaBackup(datiDemo());
    expect(backup.formato).toBe("flowlance");
    expect(backup.versioneSchema).toBe(VERSIONE_SCHEMA);
  });

  it("rifiuta un file che non è JSON", () => {
    const esito = analizzaBackup("non sono json");
    expect(esito.ok).toBe(false);
    if (esito.ok) return;
    expect(esito.errori[0]).toContain("JSON");
  });

  it("rifiuta un JSON valido che non è un nostro backup", () => {
    const esito = analizzaBackup(JSON.stringify({ utenti: [], versione: 3 }));
    expect(esito.ok).toBe(false);
    if (esito.ok) return;
    expect(esito.errori[0]).toContain("Flowlance");
  });

  it.each(FORMATI_STORICI)(
    "importa ancora i backup col marcatore «%s»",
    (formato) => {
      // Ogni rename del progetto lascia in giro backup col marcatore di allora:
      // rifiutarli significherebbe buttare un archivio. L'elenco dei formati
      // storici cresce a ogni cambio di nome, e questo test cresce con lui.
      const esito = analizzaBackup(
        JSON.stringify({
          formato,
          versioneSchema: VERSIONE_SCHEMA,
          esportatoIl: "2026-09-01T00:00:00.000Z",
          dati: datiVuoti(),
        }),
      );
      expect(esito.ok).toBe(true);
    },
  );

  it("rifiuta un backup creato da una versione più recente", () => {
    const esito = analizzaBackup(
      JSON.stringify({ formato: "flowlance", versioneSchema: 99, dati: datiVuoti() }),
    );
    expect(esito.ok).toBe(false);
    if (esito.ok) return;
    expect(esito.errori[0]).toContain("Aggiorna l'app");
  });

  it("segnala le righe rotte invece di importarle a metà", () => {
    const dati = datiDemo();
    const rotto = {
      formato: "flowlance",
      versioneSchema: 1,
      esportatoIl: "2026-09-01T00:00:00.000Z",
      dati: {
        ...dati,
        fatture: [
          dati.fatture[0],
          { ...dati.fatture[1], dataEmissione: "01/02/2026" },
          { ...dati.fatture[2], imponibile: "tremila" },
        ],
      },
    };
    const esito = analizzaBackup(JSON.stringify(rotto));
    expect(esito.ok).toBe(false);
    if (esito.ok) return;
    expect(esito.errori).toHaveLength(2);
    expect(esito.errori[0]).toContain("aaaa-mm-gg");
    expect(esito.errori[1]).toContain("non numerico");
  });

  it("scarta i campi derivati che non devono stare nell'archivio", () => {
    const dati = datiDemo();
    const conDerivati = {
      formato: "flowlance",
      versioneSchema: 1,
      esportatoIl: "2026-09-01T00:00:00.000Z",
      dati: {
        ...datiVuoti(),
        fatture: [{ ...dati.fatture[0], totale: 99_999, stato: "incassato", giorniRitardo: 4 }],
      },
    };
    const esito = analizzaBackup(JSON.stringify(conDerivati));
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    const fattura = esito.backup.dati.fatture[0] as Record<string, unknown>;
    expect(fattura.totale).toBeUndefined();
    expect(fattura.stato).toBeUndefined();
    expect(fattura.giorniRitardo).toBeUndefined();
    expect(fattura.imponibile).toBe(dati.fatture[0].imponibile);
  });

  it("avvisa delle fatture orfane senza rifiutare il file", () => {
    const dati = datiDemo();
    const esito = analizzaBackup(
      serializzaBackup(creaBackup({ ...dati, clienti: [] })),
    );
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.avvisi.some((a) => a.includes("non presenti nel backup"))).toBe(true);
  });

  it("accetta un backup più vecchio avvisando", () => {
    const esito = analizzaBackup(
      JSON.stringify({ formato: "flowlance", versioneSchema: 0, dati: datiVuoti() }),
    );
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.avvisi[0]).toContain("più vecchio");
  });
});

// ————————————————————————————————————————————————————————————
// Dataset dimostrativo
// ————————————————————————————————————————————————————————————

describe("dataset dimostrativo", () => {
  const dati = datiDemo();

  it("è deterministico", () => {
    expect(serializzaBackup(creaBackup(datiDemo(), new Date(0)))).toBe(
      serializzaBackup(creaBackup(datiDemo(), new Date(0))),
    );
  });

  it("descrive un anno plausibile", () => {
    // Il dataset copre due anni: l'anno raccontato e il suo antefatto.
    const fattureAnno = dati.fatture.filter((f) => f.dataEmissione.startsWith(String(ANNO_DEMO)));
    const emesso = fattureAnno.reduce((a, f) => a + f.imponibile, 0);
    expect(emesso).toBe(46_050);
    expect(fattureAnno).toHaveLength(24);
    expect(dati.clienti).toHaveLength(7);
    expect(dati.movimentiPersonali.filter((m) => m.anno === ANNO_DEMO)).toHaveLength(12);
    expect(dati.movimentiPersonali.filter((m) => m.anno === ANNO_DEMO - 1)).toHaveLength(12);
  });

  it("ha identificatori univoci e riferimenti validi", () => {
    const idFatture = new Set(dati.fatture.map((f) => f.id));
    expect(idFatture.size).toBe(dati.fatture.length);
    const numeri = new Set(dati.fatture.map((f) => f.numero));
    expect(numeri.size).toBe(dati.fatture.length);

    const idClienti = new Set(dati.clienti.map((c) => c.id));
    for (const f of dati.fatture) expect(idClienti.has(f.clienteId)).toBe(true);
  });

  it("non contiene campi derivati", () => {
    const vietati = ["iva", "totale", "stato", "scadenza", "giorniRitardo", "nettoIncasso"];
    for (const f of dati.fatture) {
      for (const campo of vietati) expect(f).not.toHaveProperty(campo);
    }
    for (const c of dati.costi) {
      for (const campo of ["totale", "costoDeducibile", "ivaDetraibile", "stato"]) {
        expect(c).not.toHaveProperty(campo);
      }
    }
  });

  it("lascia aperto un credito commerciale plausibile", () => {
    const aperte = dati.fatture.filter((f) => !f.dataIncasso);
    expect(aperte).toHaveLength(4);
    const credito = aperte.reduce((a, f) => a + f.imponibile, 0);
    expect(credito).toBe(6100);
    // Il credito aperto sta sotto un sesto del fatturato: un tenore realistico.
    expect(credito / 46_050).toBeLessThan(0.17);
  });

  it("attraversa il motore fiscale producendo numeri sensati", () => {
    const p = calcolaProspetto({
      impostazioni: impostazioniDemo(),
      parametri: PARAMETRI_2026,
      fatture: dati.fatture,
      costi: dati.costi,
      versamenti: dati.versamenti,
      oggi: "2026-09-01",
    });

    expect(p.fatturatoEmesso).toBe(46_050);
    expect(p.ricaviRilevanti).toBe(39_950);
    expect(p.soglia.inSospeso).toBe(6100);
    expect(p.ricaviRilevanti).toBeLessThan(p.fatturatoEmesso);
    expect(p.soglia.stato).toBe("neiLimiti");
    expect(p.pressione).toBeGreaterThan(0.2);
    expect(p.pressione).toBeLessThan(0.4);
    expect(p.nettoDisponibile).toBeGreaterThan(0);
    // Ci sono F24 registrati: il motore deduce i contributi per cassa.
    expect(p.fonteContributiDedotti).toBe("versamenti");
    // Contributi usciti dal conto nel 2026: la quota contributiva del saldo
    // 2025 più quella del primo acconto 2026. Si deducono per cassa, quindi
    // conta la data di pagamento e non l'anno d'imposta.
    expect(p.contributiDedotti).toBe(5779.27);
  });
});

function ordina(righe: readonly unknown[]): unknown[] {
  return [...righe].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

// ————————————————————————————————————————————————————————————
// Evoluzione dello schema
// ————————————————————————————————————————————————————————————

describe("versioni dello schema", () => {
  it("un backup della versione 1 si importa ancora, con le collezioni nuove vuote", () => {
    const dati = datiDemo();
    const vecchio = {
      formato: "flowlance",
      versioneSchema: 1,
      esportatoIl: "2026-06-01T00:00:00.000Z",
      dati: {
        impostazioni: dati.impostazioni,
        clienti: dati.clienti,
        fatture: dati.fatture,
        costi: dati.costi,
        movimentiPersonali: dati.movimentiPersonali,
        movimentiAttivita: dati.movimentiAttivita,
        versamenti: dati.versamenti,
        patrimonio: dati.patrimonio,
        // «spunte» non esisteva ancora.
      },
    };
    const esito = analizzaBackup(JSON.stringify(vecchio));
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.avvisi.some((a) => a.includes("più vecchio"))).toBe(true);
    expect(esito.backup.dati.spunte).toEqual([]);
    expect(esito.backup.dati.fatture).toHaveLength(dati.fatture.length);
  });

  it("le spunte sopravvivono al giro completo di export e import", async () => {
    const adapter = new MemoriaAdapter();
    await adapter.scriviTutto(datiDemo(), "sostituisci");
    await adapter.spunte.salva({
      id: "2026:secondo-acconto",
      anno: 2026,
      idAdempimento: "secondo-acconto",
      completatoIl: "2026-11-30",
    });

    const file = serializzaBackup(creaBackup(await adapter.leggiTutto()));
    await adapter.svuota();
    const letto = analizzaBackup(file);
    expect(letto.ok).toBe(true);
    if (!letto.ok) return;
    await adapter.scriviTutto(letto.backup.dati, "sostituisci");

    const spunte = await adapter.spunte.tutti();
    expect(spunte).toHaveLength(2);
    expect(spunte.map((s) => s.idAdempimento).sort()).toEqual([
      "saldo-e-primo-acconto",
      "secondo-acconto",
    ]);
  });
});

/*
  Il dataset dimostrativo racconta due anni, e devono raccontare la stessa
  storia: quello che è uscito dal conto a giugno 2026 dev'essere il saldo che
  il 2025 doveva davvero, e gli acconti del 2026 devono essere quelli che il
  motore calcola sul 2025 con il metodo storico.

  Non è pignoleria: la demo è il primo prospetto che qualcuno vede, e un
  documento in cui i numeri non si inseguono fa dubitare di tutto il resto.
*/
describe("dataset dimostrativo · i due anni si raccontano allo stesso modo", () => {
  const d = datiDemo();
  const catena = catenaAnni(
    {
      impostazioni: d.impostazioni,
      fatture: d.fatture,
      note: d.note,
      costi: d.costi,
      versamenti: d.versamenti,
      movimentiAttivita: d.movimentiAttivita,
      movimentiPersonali: d.movimentiPersonali,
      chiusure: d.chiusure,
    },
    ANNO_DEMO,
    OGGI_DEMO,
  );
  const prima = catena.get(ANNO_DEMO - 1)!;
  const anno = catena.get(ANNO_DEMO)!;
  const perAnno = (a: number) =>
    d.versamenti.filter((v) => v.annoImposta === a).reduce((s, v) => s + v.importo, 0);

  it("l'anno prima ha ricavi e un carico suo", () => {
    expect(prima.prospetto.ricaviRilevanti).toBeGreaterThan(0);
    expect(prima.prospetto.totaleDovuto).toBeGreaterThan(0);
  });

  it("il saldo dell'anno prima è dovuto davvero, e non torna indietro come credito", () => {
    // Versato per il 2025 = dovuto dal 2025: niente eccedenza, niente riporto.
    expect(perAnno(ANNO_DEMO - 1)).toBeCloseTo(prima.prospetto.totaleDovuto, 2);
    expect(prima.prospetto.saldoResiduo).toBe(0);
    expect(prima.riportoInUscita.creditoImposte).toBe(0);
    expect(anno.prospetto.creditoAnnoPrecedente).toBe(0);
    // E una parte di quel saldo è uscita nel 2026: è il caso che il campo
    // `annoImposta` esiste per gestire.
    expect(anno.prospetto.versamentiAltriAnni).toBeGreaterThan(0);
  });

  it("gli acconti versati nel 2026 sono quelli che il 2025 dice, al centesimo", () => {
    expect(perAnno(ANNO_DEMO)).toBeCloseTo(prima.prospetto.acconti.primo, 2);
    expect(anno.prospetto.giaVersato).toBeCloseTo(prima.prospetto.acconti.primo, 2);
  });

  it("nessun versamento è datato nel futuro del dataset", () => {
    // Un F24 di novembre in un dataset datato settembre sarebbe già pagato nel
    // prospetto e ancora da pagare nello scadenzario, sulla stessa schermata.
    for (const v of d.versamenti) expect(v.data <= OGGI_DEMO).toBe(true);
  });

  it("lo scadenzario di giugno mostra un importo, non uno zero", () => {
    const scadenze = scadenzeAnno(
      anno.impostazioni,
      anno.parametri,
      anno.prospetto,
      anno.iva,
      prima.prospetto,
    );
    const giugno = scadenze.find((s) => s.id === "saldo-e-primo-acconto")!;
    expect(giugno.importo).toBeGreaterThan(0);
    expect(giugno.nota).toBeUndefined();
  });

  it("il saldo iniziale dichiarato per il 2026 è quello che il 2025 lascia", () => {
    // Nella catena comanda il riporto, ma un saldo iniziale scritto in archivio
    // che dice un'altra cosa è un dato che contraddice la schermata.
    expect(impostazioniDemo().saldoInizialeAttivita).toBeCloseTo(prima.cashflow.saldoFinale, 2);
    expect(anno.cashflow.saldoIniziale).toBeCloseTo(prima.cashflow.saldoFinale, 2);
  });

  it("la cassa non va mai sotto zero, in nessuno dei due anni", () => {
    // Un dataset dimostrativo che chiude in rosso somiglia a un errore di
    // calcolo, e il primo sospetto cade sul motore.
    for (const a of [prima, anno]) {
      for (const m of a.cashflow.mesi) expect(m.saldoCassa).toBeGreaterThan(0);
    }
  });
});
