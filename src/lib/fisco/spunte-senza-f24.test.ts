import { describe, expect, it } from "vitest";
import { catenaAnni } from "@/lib/analisi/anno";
import { datiVetrina } from "@/lib/dati/vetrina";
import { parametriDi } from "@/lib/fisco/parametri";
import { scadenzeAnno } from "./scadenze";
import { spunteSenzaF24 } from "./accantonamento";
import type { VersamentoF24 } from "./tipi";

/**
 * Dove lo Scadenzario e la quota d'accantonamento si contraddicono.
 *
 * La segnalazione era questa: IVA del primo e del secondo trimestre e rate
 * INPS spuntate come «Versato», e nella stessa app «1.329,67 € già scaduti»
 * che comprendevano proprio quelle. Le due schermate leggono due cose diverse
 * — una la spunta, l'altra i versamenti F24 — e va bene che sia così; quello
 * che non va bene è che nessuna delle due lo dica.
 *
 * Si passa da `catenaAnni` e da `scadenzeAnno`, cioè dalla porta da cui passa
 * lo Scadenzario vero: un calendario costruito a mano proverebbe un'altra app.
 */
const d = datiVetrina();

const con = (versamenti: VersamentoF24[], spuntati: string[]) => {
  const catena = catenaAnni(
    {
      impostazioni: d.impostazioni,
      fatture: d.fatture,
      note: d.note,
      costi: d.costi,
      versamenti,
      movimentiAttivita: d.movimentiAttivita,
      movimentiPersonali: d.movimentiPersonali,
      chiusure: d.chiusure,
    },
    2026,
    "2026-09-20",
  );
  const a = catena.get(2026)!;
  return spunteSenzaF24({
    scadenze: scadenzeAnno(
      a.impostazioni,
      parametriDi(2026),
      a.prospetto,
      a.iva,
      catena.get(2025)!.prospetto,
    ),
    versamenti,
    anno: 2026,
    spuntati: new Set(spuntati),
  });
};

/** Le spunte che il dataset di vetrina ha davvero. */
const SPUNTATI = d.spunte.map((s) => s.idAdempimento);

describe("le scadenze spuntate senza un F24 che le copra", () => {
  it("**sui numeri di vetrina non ce n'è nessuna**: quelle spuntate sono versate", () => {
    /*
      È la metà che conta di più: un avviso che compare quando non c'è niente
      da segnalare insegna a ignorarlo. Qui le spunte sono sette e i
      versamenti coprono tutto quello che ha un importo.
    */
    expect(con(d.versamenti, SPUNTATI)).toEqual({ voci: [], totale: 0 });
  });

  it("**e la misura vede la differenza**: spuntando una scadenza che nessun F24 copre", () => {
    /*
      I 6.412,99 € di IVA versati coprono il primo trimestre (3.616,96) e il
      secondo (2.796,03), esattamente la loro somma: il terzo — 2.063,49 € a
      novembre — non è coperto da niente. Spuntarlo è la contraddizione, e
      l'importo è quello, non un totale rifatto a mano.
    */
    const esito = con(d.versamenti, [...SPUNTATI, "iva-3t"]);
    expect(esito.voci.map((v) => [v.id, v.scoperto])).toEqual([["iva-3t", 2_063.49]]);
    expect(esito.totale).toBe(2_063.49);
  });

  it("vale anche per le imposte: il secondo acconto spuntato e non versato", () => {
    const esito = con(d.versamenti, [...SPUNTATI, "secondo-acconto"]);
    expect(esito.voci.map((v) => [v.id, v.scoperto])).toEqual([["secondo-acconto", 3_267.58]]);
    expect(esito.voci[0].componente).toBe("imposte");
  });

  it("**e un versamento che copre solo in parte scopre solo il resto**", () => {
    /*
      Mille euro versati sul terzo trimestre da 2.063,49: quello che manca è
      1.063,49, non l'intera scadenza. Un avviso che chiedesse tutto sarebbe
      una cifra sbagliata scritta in grassetto.
    */
    const conMille: VersamentoF24[] = [
      ...d.versamenti,
      { id: "v-parziale", data: "2026-11-16", tipo: "iva", importo: 1_000, annoImposta: 2026 },
    ];
    const esito = con(conMille, [...SPUNTATI, "iva-3t"]);
    expect(esito.voci.map((v) => [v.id, v.scoperto])).toEqual([["iva-3t", 1_063.49]]);
  });

  it("**un F24 solo copre due scadenze**, e nessuna delle due si segnala", () => {
    /*
      A giugno si versano insieme saldo e primo acconto, e i due trimestri IVA
      possono essere pagati con un bonifico solo. Una regola che guardasse una
      riga alla volta — «questa scadenza ha il suo versamento?» — direbbe che
      la seconda non è coperta. Qui i 6.412,99 € di IVA coprono 3.616,96 del
      primo trimestre e 2.796,03 del secondo, che è esattamente la loro somma.
    */
    const soloIva = d.versamenti.filter((v) => v.tipo === "iva");
    const esito = con(soloIva, ["iva-1t", "iva-2t"]);
    expect(esito.voci).toEqual([]);
  });

  it("le dichiarazioni non si segnalano mai: non si versano", () => {
    /*
      «Invio della dichiarazione IVA» spuntato non ha niente a che fare con il
      denaro. Segnalarlo sarebbe un avviso che non si può risolvere.
    */
    const esito = con([], ["dichiarazione-iva", "lipe-1t", "redditi-pf"]);
    expect(esito.voci).toEqual([]);
  });

  it("e una scadenza scoperta ma **non** spuntata non è una contraddizione", () => {
    /*
      È solo una scadenza da pagare: lo Scadenzario la mostra «Passata» e la
      quota la conta fra gli arretrati. Le due schermate sono d'accordo.
    */
    expect(con([], []).voci).toEqual([]);
  });

  it("il conto è per componente: l'IVA non copre le imposte, né viceversa", () => {
    const soloImposte = d.versamenti.filter((v) => v.tipo !== "iva");
    const esito = con(soloImposte, ["iva-1t", "saldo-e-primo-acconto"]);
    expect(esito.voci.map((v) => v.id)).toEqual(["iva-1t"]);
    expect(esito.voci[0].componente).toBe("iva");
  });
});
