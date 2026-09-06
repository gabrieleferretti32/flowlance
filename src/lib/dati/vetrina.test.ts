/**
 * Il dataset da vetrina deve reggere lo sguardo.
 *
 * Non è un test di regressione qualunque: questo dataset finisce negli
 * screenshot della pagina di vendita, ed è l'unica parte del prodotto che
 * qualcuno guarda prima di comprarlo. Un numero che non torna qui non fa
 * fallire un calcolo — fa perdere un cliente, e non se ne accorge nessuno.
 *
 * Le tre cose che questo file tiene ferme sono quelle che si rompono da sole:
 * gli F24 scritti a mano contro quello che il motore calcola, la chiusura del
 * 2025 contro i suoi stessi riporti, e l'assenza di avvisi da sistemare.
 */
import { describe, expect, it } from "vitest";
import { catenaAnni } from "@/lib/analisi/anno";
import { generaAvvisi } from "@/lib/analisi/avvisi";
import { scadenzeAnno } from "@/lib/fisco/scadenze";
import { scostamentiDaChiusura } from "@/lib/fisco/chiusura";
import { aliquoteIrpefNonDichiarate, campiDaDichiarare } from "@/lib/fisco/parametri-utente";
import { esportazioneProspettoConsentita } from "@/lib/fisco/chiusura";
import { parametriDi } from "@/lib/fisco/parametri";
import { ANNO_VETRINA, datiVetrina, ULTIMO_GIORNO_VETRINA } from "./vetrina";
import { COLLEZIONI } from "./tipi";
import { CANALI_ACQUISIZIONE, CATEGORIE_COSTO } from "./categorie";
import { avvisoBackup, promemoriaDopoExport, contaDocumenti } from "./promemoria-backup";
import { contestoSuggerito } from "@/lib/onboarding/percorso";

/**
 * Il giorno da cui si guarda.
 *
 * Il dataset è datato al 5 settembre; qui si legge il 6, cioè il primo giorno
 * in cui tutto è già successo. Nessuna delle affermazioni qui sotto dipende da
 * questa data più di così: le due fatture aperte scadono a ottobre e novembre.
 */
const OGGI = "2026-09-06";
const ANNO_PRIMA = ANNO_VETRINA - 1;

const d = datiVetrina();

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
  ANNO_VETRINA,
  OGGI,
);
const prima = catena.get(ANNO_PRIMA)!;
const anno = catena.get(ANNO_VETRINA)!;

const perAnno = (a: number, tipo?: "iva") =>
  d.versamenti
    .filter((v) => v.annoImposta === a && (tipo ? v.tipo === tipo : v.tipo !== "iva"))
    .reduce((s, v) => s + v.importo, 0);

describe("vetrina · niente è datato nel futuro", () => {
  it("nessun documento supera il 5 settembre", () => {
    for (const f of d.fatture) {
      expect(f.dataEmissione <= ULTIMO_GIORNO_VETRINA).toBe(true);
      if (f.dataIncasso) expect(f.dataIncasso <= ULTIMO_GIORNO_VETRINA).toBe(true);
    }
    for (const c of d.costi) {
      expect(c.dataDocumento <= ULTIMO_GIORNO_VETRINA).toBe(true);
      if (c.dataPagamento) expect(c.dataPagamento <= ULTIMO_GIORNO_VETRINA).toBe(true);
    }
    for (const n of d.note) {
      expect(n.dataDocumento <= ULTIMO_GIORNO_VETRINA).toBe(true);
      if (n.dataRimborso) expect(n.dataRimborso <= ULTIMO_GIORNO_VETRINA).toBe(true);
    }
  });

  it("nessun F24 è già uscito da un conto che non l'ha ancora pagato", () => {
    for (const v of d.versamenti) expect(v.data <= ULTIMO_GIORNO_VETRINA).toBe(true);
  });

  it("le spunte dello scadenzario stanno tutte nel passato", () => {
    const scadenze = scadenzeAnno(
      anno.impostazioni, anno.parametri, anno.prospetto, anno.iva, prima.prospetto,
    );
    for (const s of d.spunte) {
      const adempimento = scadenze.find((x) => x.id === s.idAdempimento);
      expect(adempimento, `adempimento sconosciuto: ${s.idAdempimento}`).toBeDefined();
      expect(adempimento!.data <= OGGI).toBe(true);
    }
  });
});

describe("vetrina · gli F24 sono quelli che il motore calcola", () => {
  it("il 2025 ha versato esattamente quello che doveva", () => {
    expect(perAnno(ANNO_PRIMA)).toBeCloseTo(prima.prospetto.totaleDovuto, 2);
    expect(prima.prospetto.saldoResiduo).toBe(0);
  });

  it("l'acconto versato a giugno è quello che il 2025 dice, al centesimo", () => {
    expect(perAnno(ANNO_VETRINA)).toBeCloseTo(prima.prospetto.acconti.primo, 2);
    expect(anno.prospetto.giaVersato).toBeCloseTo(prima.prospetto.acconti.primo, 2);
  });

  it("una parte del saldo 2025 è uscita nel 2026, ed è dichiarata come tale", () => {
    expect(anno.prospetto.versamentiAltriAnni).toBeGreaterThan(0);
    expect(anno.prospetto.versamentiSenzaAnno).toBe(0);
  });

  it("l'IVA versata è quella liquidata, trimestre per trimestre", () => {
    // I due trimestri già liquidati del 2026.
    const versatiOra = d.versamenti
      .filter((v) => v.tipo === "iva" && v.annoImposta === ANNO_VETRINA)
      .map((v) => v.importo);
    expect(versatiOra).toEqual([
      anno.iva.trimestri[0].totaleDaVersare,
      anno.iva.trimestri[1].totaleDaVersare,
    ]);
    // I quattro del 2025, compreso quello versato a marzo dell'anno dopo.
    const versatiPrima = d.versamenti
      .filter((v) => v.tipo === "iva" && v.annoImposta === ANNO_PRIMA)
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((v) => v.importo);
    expect(versatiPrima).toEqual(prima.iva.trimestri.map((t) => t.totaleDaVersare));
  });

  it("il saldo di apertura scritto in archivio è quello che il 2025 riporta", () => {
    const imp = d.impostazioni.find((i) => i.anno === ANNO_VETRINA)!;
    expect(imp.saldoInizialeAttivita).toBeCloseTo(prima.riportoInUscita.saldoCassa, 2);
  });
});

describe("vetrina · la chiusura del 2025 non contraddice i documenti", () => {
  it("l'anno risulta chiuso", () => {
    expect(prima.chiuso).toBe(true);
  });

  it("l'istantanea coincide con i riporti ricalcolati", () => {
    const chiusura = d.chiusure.find((c) => c.anno === ANNO_PRIMA)!;
    expect(scostamentiDaChiusura(chiusura, prima.riportoInUscita, prima.prospetto)).toEqual([]);
  });
});

describe("vetrina · non c'è niente da sistemare", () => {
  const avvisiDi = (a: typeof anno, precedente: typeof prima | null) =>
    generaAvvisi({
      prospetto: a.prospetto,
      impostazioni: a.impostazioni,
      fatture: a.prospetto.fattureCalcolate,
      costi: a.prospetto.costiCalcolati,
      scadenze: scadenzeAnno(
        a.impostazioni, a.parametri, a.prospetto, a.iva, precedente?.prospetto ?? null,
      ),
      oggi: OGGI,
    });

  it("nessun avviso di attenzione, in nessuno dei due anni", () => {
    for (const avvisi of [avvisiDi(anno, prima), avvisiDi(prima, null)]) {
      const daSistemare = avvisi.filter((a) => a.tono === "attenzione" || a.tono === "negativo");
      expect(daSistemare.map((a) => a.id)).toEqual([]);
    }
  });

  /*
    Il credito d'imposta invece si vede, ed è il punto.

    In ordinario con la ritenuta d'acconto le trattenute superano quasi sempre
    l'IRPEF dovuta, e l'app lo dice con un avviso verde. Toglierlo vorrebbe dire
    costruire un dataset in cui la ritenuta non serve a niente.
  */
  it("il credito d'imposta c'è, e l'avviso che lo racconta è positivo", () => {
    expect(anno.prospetto.ritenuteSubite).toBeGreaterThan(0);
    expect(anno.prospetto.creditoImposta).toBeGreaterThan(0);
    const credito = avvisiDi(anno, prima).find((a) => a.id === "credito-imposta");
    expect(credito?.tono).toBe("positivo");
  });

  it("nessuna fattura risulta scaduta, ma due sono ancora aperte", () => {
    const stati = anno.prospetto.fattureCalcolate
      .filter((f) => f.dataEmissione.startsWith(String(ANNO_VETRINA)))
      .map((f) => f.stato);
    expect(stati).not.toContain("scaduto");
    expect(stati.filter((s) => s === "daIncassare")).toHaveLength(2);
  });

  it("l'accantonamento basta in tutti e due gli anni", () => {
    expect(anno.prospetto.accantonamentoSufficiente).toBe(true);
    expect(prima.prospetto.accantonamentoSufficiente).toBe(true);
  });

  /*
    L'invito in cima al cruscotto è la card più visibile dell'app.

    Con l'anno prima chiuso l'app propone di aprire il nuovo: giusto, e in uno
    screenshot del cruscotto sarebbe la prima cosa che si vede. Nel dataset il
    gesto risulta già fatto, e questo test lo verifica dalla stessa funzione da
    cui lo legge la schermata.
  */
  it("nessun percorso da cominciare: il cruscotto non apre con un invito", () => {
    expect(
      contestoSuggerito({
        anno: ANNO_VETRINA,
        archivioVuoto: false,
        precedenteChiuso: prima.chiuso,
        cambioRegimeProposto: prima.regime.daProporre,
        completati: d.percorsi.filter((p) => p.completatoIl).map((p) => p.id),
      }).contesto,
    ).toBeNull();
  });

  it("l'archivio appena caricato non chiede un backup", () => {
    expect(avvisoBackup(promemoriaDopoExport(d), contaDocumenti(d), OGGI)).toBeNull();
  });
});

describe("vetrina · niente parametri predefiniti, niente export bloccato", () => {
  it("tutti i campi pertinenti sono dichiarati, in tutti e due gli anni", () => {
    for (const a of [prima, anno]) {
      expect(campiDaDichiarare(a.impostazioni).map((c) => c.campo)).toEqual([]);
      expect(aliquoteIrpefNonDichiarate(a.impostazioni)).toEqual([]);
      // Dichiarati qui, non ereditati: il dataset non deve mostrare l'etichetta
      // «viene dall'anno prima» su una schermata che dev'essere pulita.
      expect(a.impostazioni.ereditati ?? []).toEqual([]);
    }
  });

  it("regione e comune sono dichiarati: sul prospetto non compare «non dichiarata»", () => {
    for (const a of [prima, anno]) {
      expect(a.impostazioni.regione).toBeTruthy();
      expect(a.impostazioni.comune).toBeTruthy();
    }
  });

  it("il prospetto si esporta, in tutti e due gli anni", () => {
    for (const a of [prima, anno]) {
      expect(esportazioneProspettoConsentita(parametriDi(a.anno), a.impostazioni)).toEqual({
        consentita: true,
      });
    }
  });
});

describe("vetrina · le sezioni hanno tutte qualcosa dentro", () => {
  it("nessuna collezione è vuota", () => {
    for (const c of COLLEZIONI) expect(d[c].length, `collezione vuota: ${c}`).toBeGreaterThan(0);
  });

  it("l'IVA ha debito e detraibile su tre trimestri", () => {
    const pieni = anno.iva.trimestri.filter((t) => t.debito > 0 && t.credito > 0);
    expect(pieni).toHaveLength(3);
    // Il quarto è vuoto perché l'anno non è finito, non perché manca un dato.
    expect(anno.iva.trimestri[3].debito).toBe(0);
  });

  it("la quota deducibile si stacca da quella pagata", () => {
    // È la ragione per cui questo dataset esiste: auto al 20 %, ristoranti al
    // 75 %, telefonia all'80 %. Con tutto al 100 % le due righe coincidono e la
    // colonna «quota deducibile» sembra un doppione.
    const imponibilePagato = anno.prospetto.costiCalcolati
      .filter((c) => c.dataPagamento?.startsWith(String(ANNO_VETRINA)))
      .reduce((s, c) => s + c.imponibile, 0);
    expect(anno.prospetto.costiDeducibiliPagati).toBeLessThan(imponibilePagato - 2_000);
  });

  it("la nota di credito è agganciata alla sua fattura", () => {
    for (const n of d.note) {
      const totale = (n.riconciliazioni ?? []).reduce((s, r) => s + r.imponibile, 0);
      expect(totale).toBeCloseTo(n.imponibile, 2);
      for (const r of n.riconciliazioni ?? []) {
        expect(d.fatture.some((f) => f.id === r.fatturaId)).toBe(true);
      }
    }
    expect(anno.riportoInUscita.noteNonRiconciliate).toBe(0);
  });

  /*
    Categorie e canali sono quelli dell'elenco dell'app.

    Una categoria scritta a mano non è un errore — l'app le accetta, ed è una
    funzione — ma nel dataset da vetrina significa un menu a tendina con dentro
    due voci quasi uguali («Auto e carburante» e «Auto e trasporti») e un
    filtro che sembra rotto proprio nello screenshot.
  */
  it("categorie e canali sono quelli dell'elenco", () => {
    for (const c of d.costi) expect(CATEGORIE_COSTO).toContain(c.categoria);
    for (const c of d.clienti) expect(CANALI_ACQUISIZIONE).toContain(c.canaleAcquisizione);
  });

  it("ogni fattura punta a un cliente che esiste", () => {
    for (const f of d.fatture) expect(d.clienti.some((c) => c.id === f.clienteId)).toBe(true);
  });
});

describe("vetrina · il ritratto è quello dichiarato", () => {
  it("è un ordinario che fattura fra i 40 e i 60 mila", () => {
    expect(anno.impostazioni.regime).toBe("ordinario");
    expect(anno.prospetto.fatturatoEmesso).toBeGreaterThan(40_000);
    expect(anno.prospetto.fatturatoEmesso).toBeLessThan(60_000);
  });

  it("la ritenuta è attiva e l'IVA si liquida per trimestri", () => {
    expect(anno.impostazioni.ritenutaAttiva).toBe(true);
    expect(anno.impostazioni.periodicitaIva).toBe("trimestrale");
  });

  it("la liquidità resta positiva tutto l'anno", () => {
    for (const m of anno.cashflow.mesi) expect(m.liquiditaNetta).toBeGreaterThan(0);
  });

  it("il dataset è deterministico", () => {
    expect(JSON.stringify(datiVetrina())).toBe(JSON.stringify(datiVetrina()));
  });
});
