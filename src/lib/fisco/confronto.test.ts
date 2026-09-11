import { describe, expect, it } from "vitest";
import { confrontaRegimi } from "./confronto";
import { impostazioniPredefinite } from "./impostazioni";
import { calcolaProspetto } from "./motore";
import { PARAMETRI_2026 } from "./parametri/2026";
import { round2 } from "./aritmetica";
import type { Costo, Fattura, Gestione, Impostazioni } from "./tipi";

/**
 * Le due strade che calcolano lo stesso carico.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il debito che questo file tiene
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `confrontaRegimi` **ripercorre la catena** — reddito lordo, contributi,
 * imponibile, IRPEF, addizionali — invece di chiamare `calcolaProspetto`. È una
 * seconda strada verso lo stesso numero, cioè la forma di difetto che questo
 * repository insegue da settimane: due valori che oggi coincidono e che nessuno
 * obbliga a coincidere domani.
 *
 * Finora `confrontaRegimi` era verificato solo contro attese scritte a mano.
 * Attese scritte a mano dicono «questo numero è quello che mi aspettavo», non
 * «questo numero è lo stesso che l'app mostra alla stessa persona» — e sono due
 * domande diverse.
 *
 * La ragione per cui il debito si paga adesso: il simulatore pubblico mostrerà
 * il carico dell'anno preso dal prospetto **e**, uno scroll più sotto, il
 * confronto fra regimi preso da qui. Due carichi diversi per lo stesso regime a
 * distanza di uno scroll, su una pagina che esiste per essere creduta, è il
 * difetto peggiore che quella pagina possa avere.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Cosa fa questa griglia, e cosa non copre
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Per ogni combinazione di ricavi, gruppo ATECO, gestione previdenziale, costi
 * e impostazioni personali, costruisce **l'archivio che l'app avrebbe** — una
 * fattura emessa e incassata nell'anno, un costo pagato — e confronta cinque
 * voci con quelle del confronto. Non solo il totale: anche reddito, imponibile,
 * imposte e contributi, perché due errori che si annullano dentro un totale
 * sono ancora due errori.
 *
 * Non copre: ritenute e rivalsa attive, documenti a cavallo d'anno, note di
 * credito, più di un anno di parametri. Sono i casi in cui il prospetto fa cose
 * che il confronto non sa fare — e non le sa fare per costruzione, perché
 * riceve quattro numeri e non un archivio.
 */

const RICAVI = [12_000, 25_000, 39_550, 60_000, 84_000];
const GESTIONI: Gestione[] = ["separata", "artigiani", "commercianti", "cassa"];
const GRUPPI = PARAMETRI_2026.gruppiAteco.map((g) => g.codice);
const COSTI = [0, 6_000];
/*
  Le due impostazioni che `confrontaRegimi` legge per conto suo — il fondo
  pensione e le detrazioni dichiarate a mano — sono cuciture quanto il resto:
  sono i due punti in cui potrebbe leggere qualcosa di diverso dal prospetto.
*/
const PERSONALI = [
  { fondoPensione: 0, detrazioniPersonali: 0 },
  { fondoPensione: 3_000, detrazioniPersonali: 1_200 },
];

function impostazioni(
  gruppo: string,
  gestione: Gestione,
  regime: Impostazioni["regime"],
  personali: (typeof PERSONALI)[number],
): Impostazioni {
  const g = PARAMETRI_2026.gruppiAteco.find((x) => x.codice === gruppo);
  if (!g) throw new Error(`gruppo ATECO «${gruppo}» non censito nei parametri 2026`);
  return {
    ...impostazioniPredefinite(PARAMETRI_2026),
    anno: 2026,
    regime,
    gruppoAteco: g.codice,
    coefficienteRedditivita: g.coefficiente,
    gestione,
    ...personali,
  };
}

/** L'archivio che l'app avrebbe, per quei ricavi e quei costi. */
function prospettoEquivalente(ricavi: number, costi: number, imp: Impostazioni) {
  const fattura: Fattura = {
    id: "f", numero: "1", dataEmissione: "2026-01-10", dataIncasso: "2026-01-10",
    clienteId: "c", descrizione: "", tipoRicavo: "progetto", imponibile: ricavi, aliquotaIva: 0.22,
  };
  const costo: Costo[] = costi === 0 ? [] : [{
    id: "c", dataDocumento: "2026-01-10", dataPagamento: "2026-01-10", fornitore: "Fornitore",
    categoria: "Altro", descrizione: "", natura: "variabile", imponibile: costi,
    aliquotaIva: 0.22, percentualeDeducibilita: 1,
  }];
  return calcolaProspetto({
    impostazioni: imp, parametri: PARAMETRI_2026, fatture: [fattura], costi: costo,
    note: [], versamenti: [], oggi: "2026-01-10",
  });
}

describe("il confronto fra regimi dice gli stessi numeri del prospetto", () => {
  const scarti: string[] = [];
  let confronti = 0;

  for (const ricavi of RICAVI) {
    for (const gruppo of GRUPPI) {
      for (const gestione of GESTIONI) {
        for (const costi of COSTI) {
          for (const personali of PERSONALI) {
            for (const regime of ["forfettario", "ordinario"] as const) {
              const imp = impostazioni(gruppo, gestione, regime, personali);
              const p = prospettoEquivalente(ricavi, costi, imp);
              const c = confrontaRegimi(
                {
                  ricavi,
                  costiDeducibili: costi,
                  costiTotali: round2(costi * 1.22),
                  ivaAcquisti: round2(costi * 0.22),
                },
                imp,
                PARAMETRI_2026,
              )[regime];

              const voci: [string, number, number][] = [
                ["carico totale", c.caricoTotale, p.caricoTotale],
                ["imposte", c.imposte, p.totaleImposte],
                ["contributi", c.contributi, p.totaleContributi],
                ["reddito lordo", c.redditoLordo, p.redditoLordo],
                ["imponibile", c.imponibile, p.imponibile],
              ];
              for (const [voce, dalConfronto, dalProspetto] of voci) {
                confronti += 1;
                if (Math.abs(dalConfronto - dalProspetto) > 0.005) {
                  scarti.push(
                    `${voce} · ${regime} ${gruppo}/${gestione} · ricavi ${ricavi} costi ${costi}`
                    + ` · confronto ${dalConfronto} contro prospetto ${dalProspetto}`,
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  it("la griglia è larga abbastanza da valere qualcosa", () => {
    // Un «nessuno scarto» su tre combinazioni non dice niente. Questo numero
    // scende soltanto se qualcuno restringe la griglia, e allora va notato.
    expect(confronti).toBeGreaterThanOrEqual(7_000);
  });

  it("**su nessuna combinazione i due numeri si discostano di un centesimo**", () => {
    expect(scarti.slice(0, 12)).toEqual([]);
    expect(scarti).toHaveLength(0);
  });
});
