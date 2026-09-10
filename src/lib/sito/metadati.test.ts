import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  IMMAGINE_ANTEPRIMA,
  LIMITI,
  METADATI,
  indirizziSitemap,
  indirizzoAssoluto,
  noindexPer,
  regoleRobots,
  rotteIndicizzabili,
} from "./metadati";
import { CHIUSO_AI_MOTORI, DOMINIO } from "./impostazioni";
import { BASE_APP, SITO } from "@/lib/rotte";

/**
 * I metadati sono la prima cosa che si legge del prodotto, e quasi sempre
 * l'unica prima del clic. Sbagliati, non se ne accorge nessuno da dentro: la
 * pagina si apre bene, il sito funziona, e intanto in un risultato di ricerca
 * c'è scritto qualcos'altro.
 */

describe("i testi delle pagine pubbliche", () => {
  const rotte = Object.keys(METADATI);

  it("ogni rotta pubblica ne ha uno, e nessuno avanza", () => {
    const pubbliche = Object.values(SITO);
    expect([...rotte].sort()).toEqual([...pubbliche].sort());
  });

  it.each(rotte)("%s: il titolo non viene tagliato", (rotta) => {
    const { titolo } = METADATI[rotta];
    expect(titolo.length, `«${titolo}» è di ${titolo.length} caratteri`).toBeLessThanOrEqual(
      LIMITI.titolo,
    );
    expect(titolo.trim()).toBe(titolo);
  });

  it.each(rotte)("%s: la descrizione non viene tagliata", (rotta) => {
    const { descrizione } = METADATI[rotta];
    expect(
      descrizione.length,
      `«${descrizione}» è di ${descrizione.length} caratteri`,
    ).toBeLessThanOrEqual(LIMITI.descrizione);
    // Una descrizione di due parole non è un riassunto, è un campo riempito.
    expect(descrizione.length).toBeGreaterThan(60);
  });

  it.each(rotte)("%s: la descrizione è una frase, non un elenco di parole", (rotta) => {
    const { descrizione } = METADATI[rotta];
    expect(descrizione.trim().endsWith("."), descrizione).toBe(true);
    expect(descrizione).not.toMatch(/\s{2,}/);
  });

  /**
   * La pagina di vendita dice **cosa fa e per chi**, fra titolo e descrizione.
   *
   * «Flowlance» da solo non lo cerca nessuno: chi non conosce il nome non lo
   * digita, e chi lo trova non sa ancora se lo riguarda. È l'unica coppia del
   * sito che deve reggere davanti a una persona che non ha mai sentito il nome.
   *
   * L'asserzione è sui **due insieme** e non sul solo titolo, ed è una lezione:
   * la versione di prima pretendeva «partita IVA» nel titolo, e quando la
   * qualifica si è spostata nella descrizione — dove sta meglio, perché il
   * titolo ha sessanta caratteri e la descrizione centocinquanta — il test
   * chiedeva ancora di trovarla dove non doveva più stare. Quello che conta è
   * che ci sia, non in quale dei due.
   */
  it("titolo e descrizione della landing dicono cosa fa e per chi", () => {
    const { titolo, descrizione } = METADATI[SITO.vendita];
    expect(titolo.length).toBeGreaterThan("Flowlance".length + 20);
    const insieme = `${titolo} ${descrizione}`.toLowerCase();
    expect(insieme, "non si capisce a chi si rivolge").toMatch(/partita iva|freelance/);
    expect(insieme, "non si capisce di che si occupa").toMatch(/tass|incass|imposte/);
    // E la qualifica fiscale c'è, in uno dei due: è la parola che cerca chi
    // cerca, e non comparire da nessuna parte è il modo di non essere trovati.
    expect(insieme, "«partita IVA» non compare né nel titolo né nella descrizione").toContain(
      "partita iva",
    );
  });

  it("nessun titolo ripete il nome due volte", () => {
    for (const rotta of rotte) {
      const quante = METADATI[rotta].titolo.split("Flowlance").length - 1;
      expect(quante, `«${METADATI[rotta].titolo}»`).toBeLessThanOrEqual(1);
    }
  });

  it("i titoli sono tutti diversi, e così le descrizioni", () => {
    const titoli = rotte.map((r) => METADATI[r].titolo);
    const descrizioni = rotte.map((r) => METADATI[r].descrizione);
    expect(new Set(titoli).size).toBe(titoli.length);
    expect(new Set(descrizioni).size).toBe(descrizioni.length);
  });
});

describe("gli indirizzi assoluti", () => {
  it("finiscono con la barra, come le pagine costruite", () => {
    // `trailingSlash: true`: il sito serve /termini/ e non /termini. Un
    // canonical senza barra indicherebbe un indirizzo che risponde con un
    // reindirizzamento, cioè il contrario di quello che un canonical serve.
    expect(indirizzoAssoluto(SITO.termini)).toBe(`${DOMINIO}/termini/`);
    expect(indirizzoAssoluto(SITO.vendita)).toBe(`${DOMINIO}/`);
  });

  it("non hanno mai due barre di fila", () => {
    for (const rotta of Object.keys(METADATI)) {
      expect(indirizzoAssoluto(rotta)).not.toMatch(/([^:])\/\//);
    }
  });
});

/**
 * Le tre facce della stessa decisione non possono divergere.
 *
 * `robots.txt`, il `<meta name="robots">` di ogni pagina e `sitemap.xml` sono
 * tre file letti da tre meccanismi diversi. I tre stati incoerenti — sito
 * aperto con robots che blocca, robots permissivo con noindex ovunque, sitemap
 * che elenca pagine noindex — sono tutti invisibili da dentro: il sito si apre
 * bene in tutti e tre.
 *
 * Qui si prendono le tre funzioni e si controlla che dicano la stessa cosa, in
 * tutti e due gli stati. Non quello di oggi: **tutti e due**, perché quello di
 * domani è l'unico che non è ancora stato provato da nessuno.
 */
describe("robots, noindex e sitemap dicono la stessa cosa", () => {
  describe("a sito chiuso", () => {
    const regole = regoleRobots(true);

    it("robots.txt blocca tutto", () => {
      expect(regole.rules[0].disallow).toBe("/");
      expect(regole.rules[0].allow).toBeUndefined();
    });

    it("ogni pagina porta noindex", () => {
      for (const rotta of Object.keys(METADATI)) {
        expect(noindexPer(rotta, true), rotta).toBe(true);
      }
    });

    it("la sitemap è vuota: non si invita nessuno a prendere niente", () => {
      expect(indirizziSitemap(true)).toEqual([]);
    });

    it("robots.txt non annuncia una sitemap che non elenca niente", () => {
      expect("sitemap" in regole).toBe(false);
    });
  });

  describe("a sito aperto", () => {
    const regole = regoleRobots(false);

    it("robots.txt lascia passare, e annuncia la sitemap", () => {
      expect(regole.rules[0].allow).toBe("/");
      expect(regole.sitemap).toBe(`${DOMINIO}/sitemap.xml`);
    });

    it("l'applicazione resta esclusa", () => {
      expect(regole.rules[0].disallow).toBe(`${BASE_APP}/`);
    });

    it("le pagine indicizzabili non portano noindex, le altre sì", () => {
      for (const [rotta, m] of Object.entries(METADATI)) {
        expect(noindexPer(rotta, false), rotta).toBe(!m.indicizzabile);
      }
    });

    /**
     * La coerenza che conta di più: **la sitemap elenca tutte e sole le pagine
     * che non portano noindex.**
     *
     * Una pagina noindex dentro la sitemap è un invito a prendere una cosa che
     * si è appena detto di non tenere; una pagina indicizzabile fuori dalla
     * sitemap è una pagina che nessuno troverà. Nessuna delle due si vede
     * aprendo il sito.
     */
    it("la sitemap elenca tutte e sole le pagine senza noindex", () => {
      const inSitemap = indirizziSitemap(false);
      const attese = Object.keys(METADATI)
        .filter((rotta) => !noindexPer(rotta, false))
        .map(indirizzoAssoluto)
        .sort();
      expect([...inSitemap].sort()).toEqual(attese);
    });

    it("l'applicazione non è nella sitemap, in nessuna forma", () => {
      for (const url of indirizziSitemap(false)) {
        expect(url, `${url} punta dentro l'applicazione`).not.toContain(`${BASE_APP}/`);
      }
    });

    it("/grazie non è nella sitemap: non dice niente a chi non ha appena pagato", () => {
      expect(indirizziSitemap(false)).not.toContain(indirizzoAssoluto(SITO.grazie));
      expect(noindexPer(SITO.grazie, false)).toBe(true);
    });
  });

  /**
   * E lo stato di oggi, qualunque sia, è coerente con sé stesso.
   *
   * Non «oggi il sito è chiuso»: quella sarebbe un'asserzione da riscrivere il
   * giorno in cui si apre, cioè un test rosso per una ragione che non è un
   * difetto, proprio nel giorno in cui non si vuole essere avvisati di niente.
   * Qui si afferma la coerenza, che deve valere prima e dopo.
   */
  it("lo stato di oggi è coerente con sé stesso", () => {
    const regole = regoleRobots(CHIUSO_AI_MOTORI);
    const blocca = regole.rules[0].disallow === "/";
    expect(blocca).toBe(CHIUSO_AI_MOTORI);
    expect(indirizziSitemap(CHIUSO_AI_MOTORI).length === 0).toBe(CHIUSO_AI_MOTORI);
    expect(noindexPer(SITO.vendita, CHIUSO_AI_MOTORI)).toBe(CHIUSO_AI_MOTORI);
    // L'applicazione e /grazie restano fuori in tutti e due gli stati.
    expect(noindexPer(SITO.grazie, CHIUSO_AI_MOTORI)).toBe(true);
    expect(indirizziSitemap(CHIUSO_AI_MOTORI)).not.toContain(indirizzoAssoluto(SITO.grazie));
  });
});

describe("l'immagine di anteprima", () => {
  /**
   * O non c'è, o c'è davvero.
   *
   * Un `og:image` che punta a un file mancante fa comparire un rettangolo
   * rotto al posto dell'anteprima — peggio di nessuna anteprima, perché senza
   * immagine i social mostrano titolo e descrizione e stanno bene. E il file
   * mancante non lo vedrebbe nessuno da qui: si vede solo incollando un
   * indirizzo in una chat.
   */
  it("se è dichiarata, il file esiste e ha le misure giuste", () => {
    if (IMMAGINE_ANTEPRIMA === null) {
      expect(rotteIndicizzabili().length).toBeGreaterThan(0);
      return;
    }
    expect(existsSync(`public${IMMAGINE_ANTEPRIMA.percorso}`)).toBe(true);
    // 1200 × 630 è la misura che Facebook, LinkedIn e X ritagliano senza
    // tagliare: qualunque altra proporzione viene tagliata da qualcuno.
    expect(IMMAGINE_ANTEPRIMA.larghezza).toBe(1200);
    expect(IMMAGINE_ANTEPRIMA.altezza).toBe(630);
  });
});
