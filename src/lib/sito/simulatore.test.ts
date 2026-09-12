import { describe, expect, it } from "vitest";
import { PARAMETRI_PER_ANNO } from "@/lib/fisco/parametri";
import { round2, somma } from "@/lib/fisco/aritmetica";
import { derivato } from "@/lib/fisco/derivati/registro";
import { GESTIONI, type Gestione, type Regime } from "@/lib/fisco/tipi";
import { prospettoDettagliato } from "@/lib/fisco/spiegazioni";
import {
  ANNO,
  INGRESSO_INIZIALE,
  righeMostrate,
  dodicesimi,
  impostazioniSimulate,
  simula,
  type IngressoSimulatore,
} from "./simulatore";

/**
 * La tagliola dell'adattatore: **quello che entra è quello che il motore ha
 * visto.**
 *
 * Non verifica le imposte. Quelle le verificano i test del motore, ed è giusto
 * che stiano lì: qui sarebbero una seconda copia della stessa aspettativa, e
 * cambierebbero insieme al bersaglio senza dire niente.
 *
 * Verifica l'unica cosa che il motore non può verificare da solo, perché il
 * motore non sa cosa gli è stato chiesto: che le fatture e i costi finti
 * costruiti da tre risposte producano esattamente i ricavi e i costi digitati.
 * Un adattatore che perde quattro centesimi nella divisione per dodici, o che
 * data un incasso al 5 gennaio dell'anno dopo, restituisce un prospetto
 * ineccepibile **su un fatturato che nessuno ha scritto**. È il difetto di
 * questo progetto: il numero giusto sotto la domanda sbagliata.
 */
const RICAVI = [12_000, 30_000, 40_000, 85_000, 120_000];
const COSTI = [0, 3_000, 18_000];
const REGIMI: Regime[] = ["forfettario", "ordinario"];
const APERTURE: (number | null)[] = [null, ANNO, ANNO - 6];

const gruppi = PARAMETRI_PER_ANNO[ANNO].gruppiAteco.map((g) => g.codice);

function* griglia(): Generator<IngressoSimulatore> {
  for (const ricavi of RICAVI)
    for (const gruppoAteco of gruppi)
      for (const gestione of GESTIONI as Gestione[])
        for (const regime of REGIMI)
          for (const costiAnnui of COSTI)
            for (const annoAperturaPiva of APERTURE)
              yield {
                ricavi,
                gruppoAteco,
                gestione,
                regime,
                costiAnnui,
                annoAperturaPiva,
                requisitiNuovaAttivita: annoAperturaPiva !== null,
              };
}

describe("i dodicesimi non perdono niente", () => {
  it("sommano al totale, sempre", () => {
    for (const totale of [0, 1, 1_000, 12_345.67, 40_000, 99_999.99]) {
      expect(somma(...dodicesimi(totale)), `${totale}`).toBe(round2(totale));
    }
  });
});

describe("**l'adattatore non cambia la domanda**", () => {
  it("su tutta la griglia, il motore vede i numeri digitati", () => {
    let verificati = 0;

    for (const ing of griglia()) {
      const dove = `${ing.ricavi} · ${ing.gruppoAteco} · ${ing.gestione} · ${ing.regime} · costi ${ing.costiAnnui} · apertura ${ing.annoAperturaPiva}`;
      const { prospetto, confronto, impostazioni } = simula(ing);

      // 1 · I ricavi. La cifra su cui si calcola è quella scritta nel campo.
      expect(prospetto.compensiIncassati, dove).toBe(round2(ing.ricavi));
      expect(prospetto.ricaviRilevanti, dove).toBe(round2(ing.ricavi));
      expect(prospetto.fatturatoEmesso, dove).toBe(round2(ing.ricavi));

      // 2 · Niente resta fuori dall'anno né in sospeso: tutto emesso e incassato.
      expect(prospetto.aCavallo.ricaviSospesi, dove).toBe(0);
      expect(prospetto.aCavallo.ricaviVersoAnniSuccessivi, dove).toBe(0);
      expect(prospetto.aCavallo.costiSospesi, dove).toBe(0);

      /*
        3 · I costi arrivano interi al motore, e risultano pagati.

        Si guarda l'imponibile dei costi **che il motore ha in mano**, non
        quello dedotto: in forfettario `costiDeducibiliPagati` è zero per
        costruzione — i costi non si deducono — e affermarlo qui avrebbe
        confuso «il motore non li ha ricevuti» con «il motore li ha ricevuti e
        la legge non li deduce». Sono due cose diverse, e solo la prima
        sarebbe un difetto dell'adattatore. La griglia l'ha scoperto alla prima
        corsa, che è il motivo per cui una tagliola si scrive prima.
      */
      expect(somma(...prospetto.costiCalcolati.map((c) => c.imponibile)), dove)
        .toBe(round2(ing.costiAnnui));
      expect(prospetto.costiCalcolati.every((c) => c.dataPagamento), dove).toBe(true);
      if (ing.regime === "ordinario") {
        expect(prospetto.costiDeducibiliPagati, dove).toBe(round2(ing.costiAnnui));
      } else {
        expect(prospetto.costiDeducibiliPagati, dove).toBe(0);
      }

      // 4 · Il coefficiente è quello del gruppo scelto, non del primo dell'elenco.
      const gruppo = PARAMETRI_PER_ANNO[ANNO].gruppiAteco.find((g) => g.codice === ing.gruppoAteco);
      expect(impostazioni.coefficienteRedditivita, dove).toBe(gruppo?.coefficiente);
      expect(impostazioni.gestione, dove).toBe(ing.gestione);
      expect(impostazioni.regime, dove).toBe(ing.regime);

      // 5 · Il confronto parte dagli stessi ricavi del prospetto.
      expect(confronto.ricavi, dove).toBe(round2(ing.ricavi));

      verificati += 1;
    }

    /*
      Perché nessuno restringa la griglia per farla correre prima. Il numero è
      la difesa: togliere una gestione o un gruppo ATECO si vede qui e non in
      un `it` che continua a passare su meno casi.
    */
    expect(verificati).toBeGreaterThanOrEqual(RICAVI.length * COSTI.length * 4 * 2 * 3 * 8);
  });
});

/**
 * L'aliquota agevolata non si accende con un interruttore.
 *
 * È il difetto peggiore che il progetto abbia avuto — chi aveva acceso «nuova
 * attività» restava al 5 % al sesto anno — e il simulatore è il posto più
 * facile per rifarlo, perché lì la domanda sembra un sì/no. Qui si verifica
 * che la data comandi: aperta sei anni fa, aliquota piena, anche con i
 * requisiti spuntati.
 */
describe("i cinque anni si contano, non si dichiarano", () => {
  const par = PARAMETRI_PER_ANNO[ANNO];
  const base: IngressoSimulatore = {
    ricavi: 30_000,
    gruppoAteco: "professionali",
    gestione: "separata",
    regime: "forfettario",
    costiAnnui: 0,
    annoAperturaPiva: null,
    requisitiNuovaAttivita: true,
  };

  const aliquotaCon = (annoAperturaPiva: number | null) =>
    derivato("aliquotaSostitutiva", impostazioniSimulate({ ...base, annoAperturaPiva }), par).valore;

  it("aperta quest'anno, con i requisiti: agevolata", () => {
    expect(aliquotaCon(ANNO)).toBe(par.aliquotaSostitutivaNuovaAttivita);
  });

  it("**aperta sei anni fa: piena, anche con i requisiti spuntati**", () => {
    expect(aliquotaCon(ANNO - 6)).toBe(par.aliquotaSostitutiva);
  });

  it("anno di apertura non detto: piena, che è la risposta prudente", () => {
    expect(aliquotaCon(null)).toBe(par.aliquotaSostitutiva);
  });

  it("senza requisiti la data non basta", () => {
    const imp = impostazioniSimulate({ ...base, annoAperturaPiva: ANNO, requisitiNuovaAttivita: false });
    expect(derivato("aliquotaSostitutiva", imp, par).valore).toBe(par.aliquotaSostitutiva);
  });
});

/**
 * Le righe che la pagina mostra esistono davvero nel prospetto.
 *
 * La pagina cerca certi `id` dentro `prospettoDettagliato` e scarta quelli che
 * non trova. È la scelta giusta a schermo — una riga in meno è meglio di una
 * pagina che esplode — ed è anche il modo perfetto per non accorgersi di
 * niente: il giorno in cui un id cambia nome, il simulatore continua a
 * funzionare, continua a essere bello, e ha una voce in meno. Nessun test sui
 * totali lo vedrebbe, perché i totali stanno altrove e restano giusti.
 *
 * Qui si verifica che ogni id chiesto ci sia, **in tutte le combinazioni**:
 * alcune righe del prospetto compaiono solo in un regime o solo per una
 * gestione, e una riga che c'è in forfettario e sparisce in ordinario sarebbe
 * un buco che si apre solo a chi cambia una tendina.
 */
describe("**le righe che la pagina mostra ci sono in ogni combinazione**", () => {
  const par = PARAMETRI_PER_ANNO[ANNO];

  it("nessun id cercato dalla pagina manca dal prospetto", () => {
    let combinazioni = 0;
    const mancanti: string[] = [];

    for (const ricavi of [8_000, 40_000, 120_000])
      for (const regime of REGIMI)
        for (const gestione of GESTIONI as Gestione[])
          for (const costiAnnui of [0, 9_000]) {
            const ing = { ...INGRESSO_INIZIALE, ricavi, regime, gestione, costiAnnui };
            const { prospetto, impostazioni } = simula(ing);
            const tutte = prospettoDettagliato(prospetto, impostazioni, par).flatMap((s) => s.righe);
            for (const id of righeMostrate(gestione, regime)) {
              const riga = tutte.find((r) => r.id === id);
              const dove = `${ricavi} · ${regime} · ${gestione} · costi ${costiAnnui}`;
              if (!riga) {
                mancanti.push(`${id} manca — ${dove}`);
              } else if (!(riga.formula ?? riga.nota)) {
                /*
                  Esserci non basta. Una riga di totale c'è sempre e non porta
                  formula: mostrarla qui vorrebbe dire una cifra muta in una
                  pagina che si chiama «da dove viene».
                */
                mancanti.push(`${id} è muta — ${dove}`);
              }
            }
            combinazioni += 1;
          }

    expect(mancanti).toEqual([]);
    expect(combinazioni).toBeGreaterThanOrEqual(48);
  });

  /**
   * E la misura vede la mancanza quando c'è: un id inventato deve risultare
   * mancante. Senza questo, «nessun id manca» potrebbe voler dire soltanto che
   * il controllo sta guardando un insieme vuoto.
   */
  it("un id che non esiste risulta mancante, e i quattro veri no", () => {
    const { prospetto, impostazioni } = simula(INGRESSO_INIZIALE);
    const presenti = new Set(
      prospettoDettagliato(prospetto, impostazioni, par).flatMap((s) => s.righe.map((r) => r.id)),
    );
    expect(presenti.has("riga-che-non-esiste")).toBe(false);
    for (const id of righeMostrate(INGRESSO_INIZIALE.gestione, INGRESSO_INIZIALE.regime)) {
      expect(presenti.has(id), id).toBe(true);
    }
  });

  it("ogni riga mostrata porta con sé da dove viene il numero", () => {
    const { prospetto, impostazioni } = simula(INGRESSO_INIZIALE);
    const righe = prospettoDettagliato(prospetto, impostazioni, par).flatMap((s) => s.righe);
    for (const id of righeMostrate(INGRESSO_INIZIALE.gestione, INGRESSO_INIZIALE.regime)) {
      const r = righe.find((x) => x.id === id);
      expect(r?.formula ?? r?.nota, id).toBeTruthy();
    }
  });
});
