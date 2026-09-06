import { describe, expect, it, beforeEach } from "vitest";
import { archivio, impostaArchivio } from "./archivio";
import { MemoriaAdapter } from "./memoria-adapter";
import {
  documentiDi,
  istantaneaDisponibile,
  ripristinaIstantanea,
  salvaIstantanea,
  scartaIstantanea,
} from "./istantanee";
import { datiVuoti, type Dati } from "./tipi";

const fattura = (id: string) => ({
  id,
  dataEmissione: "2026-03-01",
  numero: id,
  clienteId: "",
  descrizione: "",
  tipoRicavo: "progetto" as const,
  imponibile: 1000,
  dataIncasso: null,
});

const conFatture = (n: number): Dati => ({
  ...datiVuoti(),
  fatture: Array.from({ length: n }, (_, i) => fattura(`f${i}`)),
});

/**
 * La rete sotto l'import di un backup.
 *
 * Prima durava tre secondi e mezzo e viveva in una variabile: di un archivio
 * sostituito per sbaglio ci si accorge riaprendo l'app, non nei tre secondi in
 * cui il toast è a schermo.
 */
describe("l'istantanea prima di sostituire l'archivio", () => {
  beforeEach(() => {
    impostaArchivio(new MemoriaAdapter());
  });

  it("non c'è finché non serve", async () => {
    expect(await istantaneaDisponibile()).toBeUndefined();
    expect(await ripristinaIstantanea()).toBe(false);
  });

  it("riporta l'archivio esattamente a com'era", async () => {
    await archivio().scriviTutto(conFatture(10), "sostituisci");
    await salvaIstantanea(await archivio().leggiTutto(), "import", "backup-di-marta.json");
    await archivio().scriviTutto(conFatture(2), "sostituisci");
    expect(await archivio().fatture.conta()).toBe(2);

    expect(await ripristinaIstantanea()).toBe(true);
    expect(await archivio().fatture.conta()).toBe(10);
  });

  it("dopo il ripristino non c'è più niente da ripristinare", async () => {
    // Ripristinare due volte riporterebbe indietro l'errore: la seconda
    // istantanea sarebbe la copia dell'archivio appena importato.
    await archivio().scriviTutto(conFatture(10), "sostituisci");
    await salvaIstantanea(await archivio().leggiTutto(), "import", "x.json");
    await archivio().scriviTutto(conFatture(2), "sostituisci");
    await ripristinaIstantanea();
    expect(await istantaneaDisponibile()).toBeUndefined();
    expect(await archivio().fatture.conta()).toBe(10);
  });

  it("ce n'è una sola: la nuova prende il posto della vecchia", async () => {
    await salvaIstantanea(conFatture(10), "import", "primo.json");
    await salvaIstantanea(conFatture(3), "demo");
    const sola = await archivio().istantanee.tutti();
    expect(sola).toHaveLength(1);
    expect(sola[0].causa).toBe("demo");
    expect(documentiDi(sola[0])).toBe(3);
  });

  it("ricorda perché è stata presa, e da quale file", async () => {
    const i = await salvaIstantanea(conFatture(4), "import", "flowlance-2026-03-02.json");
    expect(i.causa).toBe("import");
    expect(i.dettaglio).toBe("flowlance-2026-03-02.json");
    expect(i.conteggi.fatture).toBe(4);
  });

  it("si scarta solo quando lo dice l'utente", async () => {
    await salvaIstantanea(conFatture(4), "svuota");
    expect(await istantaneaDisponibile()).toBeDefined();
    await scartaIstantanea();
    expect(await istantaneaDisponibile()).toBeUndefined();
  });

  it("sopravvive a svuotare l'archivio", async () => {
    // `svuota()` pulisce le collezioni, non le tabelle di servizio. Se un
    // giorno le pulisse tutte, la rete sparirebbe proprio sotto il gesto più
    // distruttivo dell'app, e nessun test se ne accorgerebbe.
    await archivio().scriviTutto(conFatture(10), "sostituisci");
    await salvaIstantanea(await archivio().leggiTutto(), "svuota");
    await archivio().svuota();
    expect(await archivio().fatture.conta()).toBe(0);
    expect(await istantaneaDisponibile()).toBeDefined();
    await ripristinaIstantanea();
    expect(await archivio().fatture.conta()).toBe(10);
  });

  it("sopravvive a una sostituzione completa", async () => {
    await archivio().scriviTutto(conFatture(10), "sostituisci");
    await salvaIstantanea(await archivio().leggiTutto(), "import", "x.json");
    await archivio().scriviTutto(conFatture(1), "sostituisci");
    expect(await istantaneaDisponibile()).toBeDefined();
  });

  it("non finisce nel backup", async () => {
    // `leggiTutto` alimenta l'export: una rete di sicurezza che viaggia dentro
    // un file e atterra su un altro archivio non è una rete.
    await archivio().scriviTutto(conFatture(3), "sostituisci");
    await salvaIstantanea(conFatture(99), "import", "x.json");
    const esportato = await archivio().leggiTutto();
    expect(esportato.fatture).toHaveLength(3);
    expect(Object.keys(esportato)).not.toContain("istantanee");
  });
});
