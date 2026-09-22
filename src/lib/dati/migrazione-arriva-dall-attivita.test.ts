import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { DatabaseFinanze } from "./db";
import type { CategoriaPf } from "@/lib/finanze/tipi";

/**
 * La migrazione alla versione 10: «Fatture incassate» nasce con il flag
 * acceso anche in un archivio che esisteva prima del flag.
 *
 * Il punto delicato è **come si costruisce l'archivio vecchio.** Un database
 * fabbricato a mano con IndexedDB grezzo non è un archivio: è un oggetto che
 * gli somiglia, e Dexie con lui si comporta in un modo che non dice niente su
 * come si comporterà con quello di una persona vera. Qui il database di prima
 * lo crea Dexie, con lo schema di allora e senza la versione 10 nella catena —
 * cioè esattamente com'è nato sul computer di chi ha installato l'app a
 * settembre. Poi lo apre la classe vera, quella che l'app usa, e la migrazione
 * gira per conto suo.
 *
 * E prima di misurare la comparsa del campo si misura la sua assenza: se la
 * lettura non vedesse il campo nemmeno quando c'è, questo test passerebbe con
 * una migrazione che non fa niente.
 */

const NOME = "prova-migrazione-10";

/** Lo schema com'era alla versione 9: le stesse tabelle, nessuna versione 10. */
function archivioDiSettembre(nome: string) {
  const vecchio = new Dexie(nome);
  vecchio.version(9).stores({
    impostazioni: "anno",
    clienti: "id, nome",
    fatture: "id, dataEmissione, dataIncasso, clienteId, numero",
    note: "id, dataDocumento, dataRimborso, clienteId, numero",
    costi: "id, dataDocumento, dataPagamento, categoria",
    movimentiPersonali: "id, [anno+mese]",
    movimentiAttivita: "id, [anno+mese]",
    versamenti: "id, data, tipo",
    patrimonio: "id, tipo",
    spunte: "id, anno",
    chiusure: "anno",
    percorsi: "id, [contesto+anno]",
    importazioni: "id, eseguitaIl",
    istantanee: "id, creataIl",
    pfConti: "id, nome",
    pfMovimenti: "id, data, contoId, categoriaId, importId",
    pfCategorie: "id, tipo",
    pfBudget: "[categoriaId+anno], anno",
    pfBeni: "id, classe",
    pfRegole: "id",
    pfImport: "id, data",
    pfImpostazioni: "id",
  });
  return vecchio;
}

/** Le categorie di allora: nessuna di loro ha il campo. */
const categorieDiSettembre = [
  { id: "fatture", tipo: "entrata", nome: "Fatture incassate", fissa: false, pagataDallAccantonamento: false },
  { id: "affitto", tipo: "spesa", nome: "Affitto e casa", fissa: true, pagataDallAccantonamento: false },
  { id: "f24", tipo: "spesa", nome: "F24 e contributi", fissa: true, pagataDallAccantonamento: true },
  // Una categoria inventata da chi usa l'app, che porta denaro dell'attività
  // senza dirlo: la migrazione non deve indovinare.
  { id: "studio", tipo: "entrata", nome: "Bonifici dallo studio", fissa: false, pagataDallAccantonamento: false },
];

async function apriArchivioDiSettembre() {
  const vecchio = archivioDiSettembre(NOME);
  await vecchio.open();
  await vecchio.table("pfCategorie").bulkPut(categorieDiSettembre);
  return vecchio;
}

async function categorieDopoLApertura(): Promise<CategoriaPf[]> {
  const nuovo = new DatabaseFinanze(NOME);
  await nuovo.open();
  const righe = await nuovo.pfCategorie.toArray();
  nuovo.close();
  return righe;
}

afterEach(async () => {
  await Dexie.delete(NOME);
});

describe("l'archivio nato prima del flag", () => {
  it("**la misura vede il campo quando c'è**: prima della migrazione non c'è", async () => {
    const vecchio = await apriArchivioDiSettembre();
    const prima = await vecchio.table("pfCategorie").toArray();
    expect(prima).toHaveLength(4);
    for (const riga of prima) {
      expect(riga, riga.nome).not.toHaveProperty("arrivaDallAttivita");
    }
    // E la stessa lettura, su una riga che il campo ce l'ha, lo vede.
    await vecchio.table("pfCategorie").put({ ...categorieDiSettembre[1], arrivaDallAttivita: true });
    const controllo = await vecchio.table("pfCategorie").get("affitto");
    expect(controllo).toHaveProperty("arrivaDallAttivita", true);
    vecchio.close();
  });

  it("aperto dall'app di oggi, trova «Fatture incassate» già acceso", async () => {
    const vecchio = await apriArchivioDiSettembre();
    vecchio.close();

    const righe = await categorieDopoLApertura();
    const acceso = (id: string) => righe.find((c) => c.id === id)?.arrivaDallAttivita;

    expect(acceso("fatture")).toBe(true);
    expect(acceso("affitto")).toBe(false);
    expect(acceso("f24")).toBe(false);
    // Nessun indovinello: l'entrata inventata resta spenta finché non la si accende.
    expect(acceso("studio")).toBe(false);
  });

  it("nessuna riga resta senza il campo: `false` è un valore, `undefined` no", async () => {
    const vecchio = await apriArchivioDiSettembre();
    vecchio.close();

    for (const riga of await categorieDopoLApertura()) {
      expect(typeof riga.arrivaDallAttivita, riga.nome).toBe("boolean");
    }
  });

  it("e non tocca il resto della riga", async () => {
    const vecchio = await apriArchivioDiSettembre();
    vecchio.close();

    const righe = await categorieDopoLApertura();
    const f24 = righe.find((c) => c.id === "f24");
    expect(f24?.nome).toBe("F24 e contributi");
    expect(f24?.fissa).toBe(true);
    expect(f24?.pagataDallAccantonamento).toBe(true);
  });
});
