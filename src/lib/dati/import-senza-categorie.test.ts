import { beforeEach, describe, expect, it } from "vitest";
import { archivio, impostaArchivio } from "./archivio";
import { MemoriaAdapter } from "./memoria-adapter";
import { eseguiImportRendiconto, seminaCategorie } from "./azioni";
import { CATEGORIE_INIZIALI } from "@/lib/finanze/categorie";
import type { MovimentoPf } from "@/lib/finanze/tipi";

/**
 * Un movimento senza categoria non entra in archivio.
 *
 * È successo per davvero: un rendiconto di trentasette righe importato in un
 * archivio che le categorie non le aveva mai avute — nessuna schermata le
 * semina all'avvio, e chi arrivava da un backup fatto prima che il modulo
 * esistesse non ne aveva. La colonna «Categoria» era vuota su tutte le righe,
 * e il pulsante «Importa 37 movimenti» era acceso.
 *
 * Quei movimenti non entrano in **nessun** gruppo del limite di spesa — né
 * fisse, né variabili, né risparmi, né rate — quindi spariscono dai conti pur
 * restando in archivio: il saldo del conto scende e il limite non se ne
 * accorge. Numeri sbagliati che nessuno può vedere.
 */

const movimento = (categoriaId: string, tipo: MovimentoPf["tipo"] = "spesa"): MovimentoPf => ({
  id: `m-${categoriaId || "vuota"}-${tipo}`,
  data: "2026-01-12",
  tipo,
  categoriaId,
  contoId: "c1",
  importo: 42.9,
  descrizione: "ENEL ENERGIA SPA",
});

describe("l'import di un rendiconto", () => {
  beforeEach(() => {
    impostaArchivio(new MemoriaAdapter());
  });

  it("**rifiuta le righe senza categoria, e non ne scrive nessuna**", async () => {
    const esito = await eseguiImportRendiconto(
      [movimento("spesa-alimentare"), movimento(""), movimento("")],
      ["banca.csv"],
      "c1",
    );
    expect(esito).toBeNull();
    expect(await archivio().pfMovimenti.tutti()).toHaveLength(0);
    expect(await archivio().pfImport.tutti()).toHaveLength(0);
  });

  it("e la misura vede la differenza: con le categorie a posto scrive tutto", async () => {
    const esito = await eseguiImportRendiconto(
      [movimento("spesa-alimentare"), movimento("bollette")],
      ["banca.csv"],
      "c1",
    );
    expect(esito).not.toBeNull();
    expect(await archivio().pfMovimenti.tutti()).toHaveLength(2);
  });

  it("**un giroconto senza categoria invece è normale**: non ne ha per definizione", async () => {
    const esito = await eseguiImportRendiconto(
      [movimento("", "giroconto"), movimento("bollette")],
      ["banca.csv"],
      "c1",
    );
    expect(esito).not.toBeNull();
    expect(await archivio().pfMovimenti.tutti()).toHaveLength(2);
  });
});

describe("la semina delle categorie", () => {
  beforeEach(() => {
    impostaArchivio(new MemoriaAdapter());
  });

  it("mette tutte quelle di partenza quando non ce n'è nessuna", async () => {
    await seminaCategorie({ silenziosa: true });
    const categorie = await archivio().pfCategorie.tutti();
    /*
      Il numero si legge dall'elenco e non si scrive qui: il pulsante diceva
      «Usa le diciannove categorie di partenza» mentre erano venti, perché una
      era stata aggiunta e la frase no. Adesso anche la frase lo conta.
    */
    expect(categorie).toHaveLength(CATEGORIE_INIZIALI.length);
    expect(categorie.find((c) => c.id === "fatture")?.arrivaDallAttivita).toBe(true);
  });

  it("**e non tocca niente se qualcosa c'è già**: non è un ripristino", async () => {
    await archivio().pfCategorie.salva({
      id: "mia",
      tipo: "spesa",
      nome: "La mia",
      fissa: false,
      pagataDallAccantonamento: false,
      arrivaDallAttivita: false,
    });
    await seminaCategorie({ silenziosa: true });
    const categorie = await archivio().pfCategorie.tutti();
    expect(categorie).toHaveLength(1);
    expect(categorie[0].id).toBe("mia");
  });
});
