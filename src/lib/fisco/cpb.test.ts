/**
 * Il concordato preventivo biennale, regola per regola.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché un file suo, e che cosa ci sta dentro
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il concordato tocca due cose molto diverse, e ciascuna si rompe a modo suo.
 *
 * Le **costanti** — le tre aliquote per voto ISA, il tetto degli 85.000 €, il
 * 43 % sull'eccedenza, il 10 % dell'acconto — sono numeri che nessuno
 * ricalcola: un 12 scritto 21 produce un prospetto coerente e falso. Si
 * asseriscono una per una, con la fonte accanto, come fa `parametri.test.ts`
 * con le aliquote IRPEF.
 *
 * Gli **effetti** sul prospetto invece si misurano: si costruisce un anno, lo
 * si calcola con e senza adesione, e si guarda che cosa cambia. I due casi che
 * contano sono opposti e vanno provati tutti e due — reddito effettivo sopra e
 * sotto il concordato — perché il senso del concordato è esattamente che la
 * risposta non cambia.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le fonti, e quello che non si è potuto verificare
 * ─────────────────────────────────────────────────────────────────────────
 *
 * I riferimenti sono quelli del brief normativo: D.Lgs. 13/2024 artt. 20 e
 * 20-bis, D.Lgs. 148/2026, L. 88/2026 art. 7-bis, circolare AdE 8/E/2026. **Da
 * questo ambiente nessuna delle fonti si è potuta aprire** — il proxy di rete
 * nega i siti istituzionali — quindi questi test fissano i numeri del brief,
 * non li confermano. È dichiarato in APPROSSIMAZIONI.md, ed è la ragione per
 * cui ogni asserzione porta accanto la norma a cui si riferisce: per poterla
 * rileggere, non per far credere che sia stata letta.
 */
import { describe, expect, it } from "vitest";
import {
  REGOLE_CPB,
  aliquotaIsa,
  baseContributivaCpb,
  biennioCopre,
  concordatoDi,
  concordatoPredefinito,
  impostaSostitutivaCpb,
  maggiorRedditoConcordato,
  maggiorazioneAccontoCpb,
  primoAnnoDelBiennio,
  scostamentoDaSegnalare,
  scostamentoDalConcordato,
  tettoSiApplica,
  valutaConcordato,
  votoIsaValido,
} from "./cpb";
import { calcolaProspetto } from "./motore";
import { round2 } from "./aritmetica";
import { analizzaBackup } from "@/lib/dati/backup";
import {
  COSTI_FIXTURE,
  FATTURE_FIXTURE,
  OGGI_FIXTURE,
  impostazioniForfettario,
  impostazioniOrdinario,
} from "./fixture";
import { PARAMETRI_2026 } from "./parametri/2026";
import type { Concordato, Impostazioni } from "./tipi";

const par = PARAMETRI_2026;

/** Un'adesione completa, da cui ogni prova parte togliendo o cambiando una cosa. */
function adesione(extra: Partial<Concordato> = {}): Concordato {
  return {
    ...concordatoPredefinito(2026),
    aderito: true,
    biennio: "2026-2027",
    tipoAdesione: "primoIngresso",
    dataAdesione: "2026-10-28",
    redditoConcordato: 40_000,
    redditoPrecedenteRettificato: 30_000,
    votoIsa: 9,
    sostitutiva: false,
    ...extra,
  };
}

function conCpb(c: Partial<Concordato> = {}, base: Impostazioni = impostazioniOrdinario()) {
  return { ...base, anno: 2026, concordato: adesione(c) };
}

function prospettoDi(imp: Impostazioni) {
  return calcolaProspetto({
    impostazioni: imp,
    parametri: par,
    fatture: FATTURE_FIXTURE,
    costi: COSTI_FIXTURE,
    oggi: OGGI_FIXTURE,
  });
}

// ————————————————————————————————————————————————————————————
// Le costanti
// ————————————————————————————————————————————————————————————

describe("le aliquote dell'imposta sostitutiva, per voto ISA", () => {
  /*
    Art. 20-bis D.Lgs. 13/2024: 10 % con ISA almeno 8, 12 % da 6 a 8, 15 %
    sotto il 6. I bordi sono **inclusivi verso l'alto**: un 8 esatto sta nella
    fascia migliore.
  */
  it("10 % da 8 in su, 12 % da 6 a 8, 15 % sotto", () => {
    expect(aliquotaIsa(9)).toBe(0.1);
    expect(aliquotaIsa(7)).toBe(0.12);
    expect(aliquotaIsa(5)).toBe(0.15);
  });

  /*
    I due bordi esatti, che sono il punto in cui due letture della stessa norma
    danno due numeri diversi. Un `>` al posto di un `>=` sposta il voto 8 dal
    10 % al 12 %: duecento euro su un maggior reddito di diecimila, e nessun
    test sugli effetti se ne accorgerebbe.
  */
  it("ai bordi esatti: 8 è 10 %, 6 è 12 %", () => {
    expect(aliquotaIsa(8)).toBe(0.1);
    expect(aliquotaIsa(6)).toBe(0.12);
    // E appena sotto, l'altra fascia.
    expect(aliquotaIsa(7.99)).toBe(0.12);
    expect(aliquotaIsa(5.99)).toBe(0.15);
  });

  it("fuori dalla scala 1-10 non c'è aliquota: è un dato sbagliato, non un bordo", () => {
    expect(aliquotaIsa(0)).toBeNull();
    expect(aliquotaIsa(10.5)).toBeNull();
    expect(aliquotaIsa(-3)).toBeNull();
    expect(aliquotaIsa(null)).toBeNull();
    expect(votoIsaValido(1)).toBe(true);
    expect(votoIsaValido(10)).toBe(true);
    expect(votoIsaValido(10.01)).toBe(false);
  });
});

describe("il tetto degli 85.000 €", () => {
  /*
    D.Lgs. 148/2026: l'aliquota agevolata vale fino a 85.000 € di base, oltre
    si applica il 43 %. Con un maggior reddito di 100.000 € e un ISA 9:
      85.000 × 10 %  =  8.500
      15.000 × 43 %  =  6.450
                        ——————
                        14.950
    Scritto come una moltiplicazione sola sarebbero 10.000 €, cioè 4.950 € in
    meno. In difetto, che è la direzione peggiore.
  */
  it("maggior reddito 100.000: 85.000 all'aliquota ISA e 15.000 al 43 %", () => {
    const s = impostaSostitutivaCpb(100_000, 0.1, true);
    expect(s.quotaAgevolata).toBe(85_000);
    expect(s.quotaOltreTetto).toBe(15_000);
    expect(s.imposta).toBe(14_950);
    expect(s.tettoApplicato).toBe(true);
  });

  it("sotto il tetto il 43 % non entra affatto", () => {
    const s = impostaSostitutivaCpb(20_000, 0.12, true);
    expect(s.quotaOltreTetto).toBe(0);
    expect(s.imposta).toBe(2_400);
    expect(s.tettoApplicato).toBe(false);
  });

  /*
    Il tetto non raggiunge chi ha aderito ai primi due bienni entro il 12
    giugno 2025. La data è un confine, quindi è inclusiva: aderito **il** 12
    giugno vuol dire dentro.
  */
  it("non si applica a chi ha aderito ai primi due bienni entro il 12/06/2025", () => {
    expect(tettoSiApplica(adesione({ biennio: "2024-2025", dataAdesione: "2025-06-12" }))).toBe(false);
    expect(tettoSiApplica(adesione({ biennio: "2025-2026", dataAdesione: "2025-01-10" }))).toBe(false);
    // Un giorno dopo, il tetto c'è.
    expect(tettoSiApplica(adesione({ biennio: "2025-2026", dataAdesione: "2025-06-13" }))).toBe(true);
    // E sul biennio nuovo il tetto c'è comunque.
    expect(tettoSiApplica(adesione({ biennio: "2026-2027", dataAdesione: "2025-01-10" }))).toBe(true);
  });

  it("senza data di adesione il tetto si applica: la lettura più cara è l'unica prudente", () => {
    expect(tettoSiApplica(adesione({ biennio: "2024-2025", dataAdesione: null }))).toBe(true);
  });

  it("senza tetto l'intero maggior reddito sta all'aliquota del voto ISA", () => {
    const s = impostaSostitutivaCpb(100_000, 0.1, false);
    expect(s.quotaAgevolata).toBe(100_000);
    expect(s.quotaOltreTetto).toBe(0);
    expect(s.imposta).toBe(10_000);
  });
});

describe("la maggiorazione del 10 % sull'acconto", () => {
  /*
    Art. 20 D.Lgs. 13/2024: al primo anno di adesione, con il metodo storico,
    la seconda rata porta il 10 % della differenza positiva fra reddito
    concordato e reddito dell'anno precedente rettificato.
  */
  it("primo ingresso, primo anno del biennio: il 10 % della differenza", () => {
    expect(
      maggiorazioneAccontoCpb({
        tipoAdesione: "primoIngresso",
        biennio: "2026-2027",
        anno: 2026,
        maggiorReddito: 10_000,
      }),
    ).toBe(1_000);
  });

  it("chi rinnova senza interruzione non la paga", () => {
    expect(
      maggiorazioneAccontoCpb({
        tipoAdesione: "rinnovo",
        biennio: "2026-2027",
        anno: 2026,
        maggiorReddito: 10_000,
      }),
    ).toBe(0);
  });

  it("nel secondo anno del biennio non c'è più", () => {
    expect(
      maggiorazioneAccontoCpb({
        tipoAdesione: "primoIngresso",
        biennio: "2026-2027",
        anno: 2027,
        maggiorReddito: 10_000,
      }),
    ).toBe(0);
  });

  /*
    Differenza negativa: nessuna maggiorazione, e **non** un credito. Il
    maggior reddito è zero per costruzione, e lo zero arriva da lì: è la stessa
    funzione che decide la base della sostitutiva, quindi le due cose non
    possono dire due cose diverse.
  */
  it("con il concordato sotto il reddito dell'anno prima la maggiorazione è zero", () => {
    const maggiore = maggiorRedditoConcordato({
      redditoConcordato: 25_000,
      redditoPrecedenteRettificato: 30_000,
    });
    expect(maggiore).toBe(0);
    expect(
      maggiorazioneAccontoCpb({
        tipoAdesione: "primoIngresso",
        biennio: "2026-2027",
        anno: 2026,
        maggiorReddito: maggiore,
      }),
    ).toBe(0);
  });

  it("e le altre costanti stanno dove dice la norma", () => {
    expect(REGOLE_CPB.maggiorazioneAcconto).toBe(0.1);
    expect(REGOLE_CPB.tettoMaggiorReddito).toBe(85_000);
    expect(REGOLE_CPB.aliquotaOltreTetto).toBe(0.43);
    expect(REGOLE_CPB.scostamentoDaSegnalare).toBe(0.3);
    expect(REGOLE_CPB.tettoEsente.entroIl).toBe("2025-06-12");
    // I tre bienni, con i loro anni: il primo anno è quello della maggiorazione.
    expect(REGOLE_CPB.bienni["2024-2025"]).toEqual({ primo: 2024, ultimo: 2025 });
    expect(REGOLE_CPB.bienni["2025-2026"]).toEqual({ primo: 2025, ultimo: 2026 });
    expect(REGOLE_CPB.bienni["2026-2027"]).toEqual({ primo: 2026, ultimo: 2027 });
    expect(primoAnnoDelBiennio("2025-2026", 2025)).toBe(true);
    expect(primoAnnoDelBiennio("2025-2026", 2026)).toBe(false);
    expect(biennioCopre("2025-2026", 2027)).toBe(false);
  });
});

// ————————————————————————————————————————————————————————————
// Che cosa cambia nel prospetto
// ————————————————————————————————————————————————————————————

describe("le imposte si pagano sul concordato, in tutti e due i versi", () => {
  /*
    Il fixture dell'ordinario: 7.500 € incassati meno 980 € di costi pagati
    fanno 6.520 € di reddito effettivo. Da lì in poi ogni numero qui sotto si
    ricalcola a mano, ed è il motivo per cui questi test valgono qualcosa.
  */
  const senza = prospettoDi({ ...impostazioniOrdinario(), anno: 2026 });

  it("il reddito effettivo del fixture è quello che credo", () => {
    expect(senza.redditoLordo).toBe(6_520);
    expect(senza.concordato).toBeNull();
  });

  /*
    Effettivo **sotto** il concordato: si paga sul concordato, e si paga di
    più. È il verso che fa male, ed è il patto: 40.000 € concordati su 6.520 €
    prodotti.

      contributi   40.000 × 26,07 %            = 10.428,00
      imponibile   40.000 − 10.428             = 29.572,00
      IRPEF lorda  28.000 × 23 % + 1.572 × 33 % =  6.958,76
  */
  it("effettivo sotto il concordato: imponibile e IRPEF salgono sul concordato", () => {
    const alto = prospettoDi(conCpb({ redditoConcordato: 40_000, redditoPrecedenteRettificato: 40_000 }));
    expect(alto.concordato?.esito.attivo).toBe(true);
    expect(alto.redditoLordo).toBe(6_520);
    expect(alto.imponibile).toBe(29_572);
    expect(alto.irpefLorda).toBe(6_958.76);
    expect(alto.imponibile).toBeGreaterThan(senza.imponibile);
  });

  /*
    Effettivo **sopra** il concordato: l'eccedenza non è tassata, e l'IRPEF
    scende. 3.000 € concordati su 6.520 € prodotti.

      contributi   3.000 × 26,07 %  =   782,10
      imponibile   3.000 − 782,10   = 2.217,90
  */
  it("effettivo sopra il concordato: l'eccedenza non è tassata", () => {
    const basso = prospettoDi(conCpb({ redditoConcordato: 3_000, redditoPrecedenteRettificato: 3_000 }));
    expect(basso.concordato?.esito.attivo).toBe(true);
    expect(basso.imponibile).toBe(2_217.9);
    expect(basso.imponibile).toBeLessThan(senza.imponibile);
    // Il reddito effettivo resta scritto: è il termine di paragone, e serve
    // alle detrazioni. Sparire sarebbe il modo di perderlo.
    expect(basso.concordato?.redditoEffettivo).toBe(6_520);
    expect(basso.concordato?.scostamento).toBeCloseTo((6_520 - 3_000) / 3_000, 10);
  });

  it("il carico senza concordato si calcola comunque, e la differenza è l'effetto", () => {
    const alto = prospettoDi(conCpb({ redditoConcordato: 40_000, redditoPrecedenteRettificato: 40_000 }));
    const cpb = alto.concordato;
    expect(cpb?.senzaCpb.carico).toBe(senza.caricoTotale);
    expect(cpb?.conCpb.carico).toBe(alto.caricoTotale);
    expect(cpb?.effetto).toBe(round2(alto.caricoTotale - senza.caricoTotale));
    // Qui si paga di più: il segno dell'effetto è quello del carico.
    expect(cpb?.effetto).toBeGreaterThan(0);
  });
});

describe("i contributi", () => {
  /*
    Gestione Separata **sul concordato**: 40.000 × 26,07 % = 10.428 €, non i
    1.699,76 € del reddito effettivo.
  */
  it("la Gestione Separata si calcola sul reddito concordato", () => {
    const p = prospettoDi(conCpb({ redditoConcordato: 40_000, redditoPrecedenteRettificato: 40_000 }));
    expect(p.baseContributiva).toBe(40_000);
    expect(p.contributiGestioneSeparata).toBe(10_428);
  });

  /*
    Le casse private no: il concordato è un patto con l'Agenzia, e il
    regolamento di una cassa non lo conosce. 6.520 × 15 % = 978 €.
  */
  it("la cassa professionale resta sul reddito effettivo", () => {
    const base: Impostazioni = { ...impostazioniOrdinario(), gestione: "cassa" };
    const p = prospettoDi(conCpb({ redditoConcordato: 40_000 }, base));
    expect(p.baseContributiva).toBe(6_520);
    expect(p.contributiCassa).toBe(978);
    expect(baseContributivaCpb("cassa", 40_000, 6_520)).toBe(6_520);
    expect(baseContributivaCpb("separata", 40_000, 6_520)).toBe(40_000);
  });
});

describe("l'imposta sostitutiva dentro il prospetto", () => {
  /*
    Concordato 40.000, anno prima 30.000, ISA 9, opzione accesa:

      maggior reddito  40.000 − 30.000           = 10.000
      sostitutiva      10.000 × 10 %             =  1.000
      base IRPEF       40.000 − 10.000 − 10.428  = 19.572
      IRPEF lorda      19.572 × 23 %             =  4.501,56
  */
  const p = prospettoDi(conCpb({ sostitutiva: true }));

  it("il maggior reddito esce dalla base IRPEF e paga la sua aliquota", () => {
    expect(p.concordato?.esito.maggiorReddito).toBe(10_000);
    expect(p.concordato?.esito.sostitutiva?.imposta).toBe(1_000);
    expect(p.imponibile).toBe(19_572);
    expect(p.irpefLorda).toBe(4_501.56);
  });

  it("e finisce nel totale delle imposte, non accanto", () => {
    expect(p.totaleImposte).toBe(
      round2(p.irpefNetta + p.addizionaleRegionale + p.addizionaleComunale + 1_000),
    );
  });

  it("senza un voto ISA valido l'opzione non si applica, e lo dice", () => {
    const rotto = prospettoDi(conCpb({ sostitutiva: true, votoIsa: 12 }));
    expect(rotto.concordato?.esito.sostitutivaApplicata).toBe(false);
    expect(rotto.concordato?.esito.sostitutiva).toBeNull();
    expect(rotto.concordato?.esito.avvisi.map((a) => a.codice)).toContain("isaFuoriScala");
    // Il concordato resta attivo: è l'opzione a cadere, non l'adesione.
    expect(rotto.concordato?.esito.attivo).toBe(true);
    expect(rotto.imponibile).toBe(29_572);
  });
});

describe("la maggiorazione dell'acconto nel prospetto", () => {
  /*
    Il confronto è con lo **stesso** concordato in rinnovo: identico in tutto,
    tranne la maggiorazione. Così il numero che resta è solo quello, e il test
    non ripete la formula che sta verificando.
  */
  it("al primo ingresso entra nell'accantonamento, e non nel dovuto", () => {
    const primo = prospettoDi(conCpb());
    const rinnovo = prospettoDi(conCpb({ tipoAdesione: "rinnovo" }));
    expect(primo.concordato?.maggiorazioneAcconto).toBe(1_000);
    expect(primo.concordato?.maggiorazioneDaVersare).toBe(1_000);

    // Il dovuto non cambia: è un anticipo dello stesso reddito, non una tassa
    // in più. Metterla lì l'avrebbe fatta pagare due volte.
    expect(primo.totaleDovuto).toBe(rinnovo.totaleDovuto);
    expect(primo.saldoResiduo).toBe(rinnovo.saldoResiduo);

    // Quello che cambia è quanto va messo da parte quest'anno: i mille euro
    // devono essere sul conto il 30 novembre.
    expect(primo.fabbisognoAnnuo).toBe(round2(rinnovo.fabbisognoAnnuo + 1_000));
    expect(primo.fabbisognoDaAccantonare).toBe(round2(rinnovo.fabbisognoDaAccantonare + 1_000));
    expect(primo.accantonamentoMensile).toBe(round2(primo.fabbisognoDaAccantonare / 12));
  });

  it("chi rinnova non la paga, e il prospetto non la mostra", () => {
    const p = prospettoDi(conCpb({ tipoAdesione: "rinnovo" }));
    expect(p.concordato?.maggiorazioneAcconto).toBe(0);
    expect(p.concordato?.maggiorazioneDaVersare).toBe(0);
  });

  it("gli F24 già registrati per l'anno la coprono, come coprono gli acconti", () => {
    const p = calcolaProspetto({
      impostazioni: conCpb(),
      parametri: par,
      fatture: FATTURE_FIXTURE,
      costi: COSTI_FIXTURE,
      versamenti: [
        { id: "v1", data: "2026-11-30", tipo: "imposte", importo: 600, annoImposta: 2026 },
      ],
      oggi: OGGI_FIXTURE,
    });
    expect(p.concordato?.maggiorazioneAcconto).toBe(1_000);
    expect(p.concordato?.maggiorazioneDaVersare).toBe(400);
  });
});

describe("il forfettario non ha concordato", () => {
  /*
    Dal 2025 i forfettari sono esclusi (art. 7-bis L. 88/2026 secondo il
    brief). Il blocco resta nelle impostazioni — chi cambia regime a gennaio
    non deve perdere i suoi dati — ma il motore non lo guarda, e il prospetto
    non lo nomina.
  */
  it("con i dati del concordato compilati, il prospetto è identico a quello senza", () => {
    const pulito = prospettoDi({ ...impostazioniForfettario(), anno: 2026 });
    const conDati = prospettoDi({
      ...impostazioniForfettario(),
      anno: 2026,
      concordato: adesione({ redditoConcordato: 40_000, sostitutiva: true }),
    });
    expect(conDati.concordato).toBeNull();
    expect(conDati.imponibile).toBe(pulito.imponibile);
    expect(conDati.impostaSostitutiva).toBe(pulito.impostaSostitutiva);
    expect(conDati.totaleImposte).toBe(pulito.totaleImposte);
    expect(conDati.caricoTotale).toBe(pulito.caricoTotale);
    expect(valutaConcordato({ ...impostazioniForfettario(), concordato: adesione() }, 2026)).toBeNull();
  });
});

describe("le validazioni", () => {
  it("aderito senza reddito concordato: il calcolo resta sull'effettivo, e lo dice", () => {
    const p = prospettoDi(conCpb({ redditoConcordato: null }));
    expect(p.concordato?.esito.attivo).toBe(false);
    expect(p.concordato?.esito.avvisi.map((a) => a.codice)).toContain("redditoMancante");
    const senza = prospettoDi({ ...impostazioniOrdinario(), anno: 2026 });
    expect(p.imponibile).toBe(senza.imponibile);
    expect(p.contributiGestioneSeparata).toBe(senza.contributiGestioneSeparata);
  });

  it("un biennio che non copre l'anno non si applica: per quell'anno un concordato non c'è", () => {
    const p = prospettoDi(conCpb({ biennio: "2024-2025" }));
    expect(p.concordato?.esito.attivo).toBe(false);
    expect(p.concordato?.esito.avvisi.map((a) => a.codice)).toContain("biennioIncoerente");
    const senza = prospettoDi({ ...impostazioniOrdinario(), anno: 2026 });
    expect(p.imponibile).toBe(senza.imponibile);
  });

  it("lo scostamento oltre il 30 % si segnala, e non cambia un solo numero", () => {
    // 6.520 effettivi contro 40.000 concordati: −83,7 %.
    const p = prospettoDi(conCpb({ redditoConcordato: 40_000, redditoPrecedenteRettificato: 40_000 }));
    expect(p.concordato?.oltreSogliaCessazione).toBe(true);
    expect(p.imponibile).toBe(29_572);
    /*
      «Inferiore di **oltre** il 30 %»: il 30 % esatto non si segnala. Il bordo
      è stretto di proposito — una segnalazione che parte un centesimo prima è
      una segnalazione che parte quando la norma non lo dice.
    */
    expect(scostamentoDaSegnalare(7_000, 10_000)).toBe(false);
    expect(scostamentoDaSegnalare(6_999, 10_000)).toBe(true);
    expect(scostamentoDalConcordato(13_000, 10_000)).toBeCloseTo(0.3, 10);
  });
});

describe("gli archivi che il concordato non lo conoscono", () => {
  /*
    Il difetto da cui nasce questo test è già successo una volta, con il regime
    sugli archivi importati: un campo nuovo che su un file vecchio entra con un
    valore inventato. Qui l'assenza ha un significato preciso — non ho aderito
    — e va letta così, senza errori e senza avvisi.
  */
  const vecchio = {
    // Il marcatore di un nome precedente del progetto: un file vero, vecchio.
    formato: "freelance-finance-os",
    versioneSchema: 11,
    esportatoIl: "2026-01-10T10:00:00.000Z",
    dati: {
      impostazioni: [
        {
          anno: 2026,
          nome: "Prova",
          regime: "ordinario",
          gruppoAteco: "professionali",
          coefficienteRedditivita: 0.78,
          scaglioniIrpef: [
            { limite: 28_000, aliquota: 0.23 },
            { limite: 50_000, aliquota: 0.33 },
            { limite: null, aliquota: 0.43 },
          ],
          gestione: "separata",
        },
      ],
    },
  };

  it("un backup senza il blocco entra senza errori, e il concordato resta spento", () => {
    const esito = analizzaBackup(JSON.stringify(vecchio));
    expect(esito.ok, esito.ok ? "" : esito.errori.join(" · ")).toBe(true);
    if (!esito.ok) return;
    const imp = esito.backup.dati.impostazioni[0];
    expect(imp.concordato).toBeDefined();
    expect(imp.concordato?.aderito).toBe(false);
    expect(imp.concordato?.redditoConcordato).toBeNull();
    // E nessun avviso parla di concordato: non c'era, e non doveva esserci.
    expect(esito.avvisi.join(" ")).not.toMatch(/concordato/i);
  });

  it("e il motore, su quelle impostazioni, non applica niente", () => {
    const esito = analizzaBackup(JSON.stringify(vecchio));
    if (!esito.ok) throw new Error(esito.errori.join(" · "));
    const imp = esito.backup.dati.impostazioni[0];
    expect(valutaConcordato(imp, 2026)).toBeNull();
    expect(prospettoDi(imp).concordato).toBeNull();
  });

  /*
    E le impostazioni **senza nemmeno il campo**: un oggetto costruito a mano,
    o letto da un archivio aperto prima che la migrazione passasse. `undefined`
    non deve lanciare: vale «non aderito», che è quello che era.
  */
  it("un oggetto senza il campo si legge come «non aderito», senza lanciare", () => {
    const imp: Impostazioni = { ...impostazioniOrdinario(), anno: 2026 };
    delete (imp as { concordato?: unknown }).concordato;
    expect(() => concordatoDi(imp)).not.toThrow();
    expect(concordatoDi(imp).aderito).toBe(false);
    expect(valutaConcordato(imp, 2026)).toBeNull();
    expect(prospettoDi(imp).concordato).toBeNull();
  });
});

describe("il biennio proposto per un anno", () => {
  /*
    I bienni si sovrappongono, e il 2026 sta dentro due. La proposta è quello
    che **comincia** in quell'anno — 2026-2027 — e non il primo dell'elenco che
    lo contiene.

    Il difetto che questo test fissa è stato visto nell'applicazione vera: con
    2025-2026 proposto per il 2026, il 2026 risultava il **secondo** anno del
    biennio e la maggiorazione del 10 % spariva. Nessun errore a schermo, un
    acconto più basso del dovuto.
  */
  it("propone il biennio che comincia in quell'anno", () => {
    expect(concordatoPredefinito(2024).biennio).toBe("2024-2025");
    expect(concordatoPredefinito(2025).biennio).toBe("2025-2026");
    expect(concordatoPredefinito(2026).biennio).toBe("2026-2027");
  });

  it("e se nessuno comincia lì, quello che lo contiene", () => {
    expect(concordatoPredefinito(2027).biennio).toBe("2026-2027");
  });

  it("con quel biennio, nel suo primo anno la maggiorazione c'è", () => {
    const c = concordatoPredefinito(2026);
    expect(primoAnnoDelBiennio(c.biennio, 2026)).toBe(true);
  });
});
