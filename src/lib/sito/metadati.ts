/**
 * Titolo e descrizione di ogni pagina pubblica, in un posto solo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché una tabella e non un `metadata` per pagina
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Sono i testi che finiscono nei risultati di ricerca e nelle anteprime che
 * qualcuno incolla in una chat: la prima cosa che si legge del prodotto, e
 * quasi sempre l'unica prima del clic. Scritti pagina per pagina diventano sei
 * decisioni prese in sei momenti diversi, con sei tagli e sei modi di dire la
 * stessa cosa — e il giorno in cui il prezzo o la promessa cambiano bisogna
 * ricordarsi di tutti e sei.
 *
 * Qui si leggono insieme, e chi li rivede li rivede tutti.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le misure, che non sono un vezzo
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Google taglia il titolo intorno ai 600 px e la descrizione intorno ai 920:
 * in caratteri sono più o meno 60 e 155. Un titolo tagliato a metà è una frase
 * che finisce con «…» al posto della parte che convinceva. Un test tiene le
 * misure, e fallisce sul lungo — mai sul corto, perché una descrizione breve e
 * vera è meglio di una lunga e riempita.
 */
import type { Metadata } from "next";
import { BASE_APP, SITO } from "@/lib/rotte";
import { CHIUSO_AI_MOTORI, DOMINIO } from "./impostazioni";
import { MISURA, PERCORSO_ANTEPRIMA } from "./anteprima";

export type MetadatiPagina = {
  /** Quello che si legge nella scheda del browser e in cima al risultato. */
  titolo: string;
  /** Le due righe sotto il titolo. Deve reggere da sola, senza la pagina. */
  descrizione: string;
  /**
   * La pagina va negli indici, il giorno in cui il sito si apre?
   *
   * Quasi tutte sì. `/grazie` no: è la pagina dove Stripe rimanda dopo il
   * pagamento, non dice niente a chi non ha appena pagato, e trovarla in una
   * ricerca farebbe credere di aver comprato qualcosa.
   */
  indicizzabile: boolean;
};

/**
 * I testi.
 *
 * Il titolo della pagina di vendita non è il nome del prodotto: **dice cosa fa
 * e per chi**. «Flowlance» da solo non lo cerca nessuno, e chi lo trova non sa
 * ancora se riguarda lui. Le altre portano il nome in coda, dopo il punto
 * mediano, come le schermate dell'applicazione.
 */
export const METADATI: Record<string, MetadatiPagina> = {
  [SITO.vendita]: {
    titolo: "Flowlance — il conto delle tasse per freelance italiani",
    /*
      «Partita IVA» è passata dal titolo alla descrizione, e la descrizione se
      l'è dovuta prendere: prima non la conteneva. Nel titolo «italiani» dice di
      più — chi cerca lo fa in italiano, e la qualifica fiscale la porta la riga
      sotto, che ha lo spazio per dirla senza spendere il taglio dei 60
      caratteri.
    */
    descrizione:
      "Quanto dei tuoi incassi con partita IVA è davvero tuo, quanto mettere da parte e quando esce. "
      + "Forfettario e ordinario. I dati restano nel tuo browser.",
    indicizzabile: true,
  },
  [SITO.simulatore]: {
    /*
      «freelance» nel titolo e nella descrizione, perché è la parola con cui
      chi cerca si nomina da solo. «Partita IVA» dice la stessa cosa in
      burocratese e la porta comunque la riga sotto.
    */
    /*
      L'unico titolo del sito **senza** «· Flowlance» in coda, e non per
      distrazione: chi cerca «quanto si paga di tasse partita IVA» non sta
      cercando un marchio, e undici caratteri spesi sul nome sono undici
      caratteri tolti alla domanda — dentro un taglio che arriva a sessanta.
      Il nome lo trova nella pagina, dopo il clic.
    */
    titolo: "Quanto pagherai di tasse con la partita IVA — simulatore",
    /*
      Quello che è caduto, e perché.

      La prima stesura teneva l'elenco dei tre campi — fatturato, gruppo ATECO,
      gestione — e lasciava fuori l'accantonamento mensile. Era il taglio
      sbagliato: il gruppo ATECO è un dettaglio del **come**, mentre «quanto
      mettere da parte ogni mese» è il numero che il simulatore produce, ed è
      il motivo per cui uno clicca. Una descrizione che elenca i campi da
      riempire promette un modulo; questa promette una risposta.

      Anche così sforava, di cinque caratteri, e allora è caduto «quando
      esce»: la data si scopre entrando, il numero no.
    */
    descrizione:
      "Per freelance e partite IVA: scrivi quanto pensi di fatturare e vedi quanto esce fra "
      + "imposte, contributi e IVA, e quanto mettere da parte ogni mese.",
    indicizzabile: true,
  },
  [SITO.acquisto]: {
    titolo: "Acquista Flowlance — 97 € + IVA all'anno",
    descrizione:
      "Licenza di 12 mesi per un titolare di partita IVA. Termini, PDF e dichiarazione di acquisto "
      + "professionale prima del pagamento. Rimborso entro 30 giorni.",
    indicizzabile: true,
  },
  [SITO.termini]: {
    titolo: "Termini di servizio · Flowlance",
    descrizione:
      "Le condizioni di vendita e d'uso di Flowlance. Offerta ai soli professionisti, licenza di "
      + "12 mesi, garanzia contrattuale di rimborso entro 30 giorni.",
    indicizzabile: true,
  },
  [SITO.privacy]: {
    titolo: "Privacy · Flowlance",
    descrizione:
      "Flowlance funziona nel tuo browser: le tue fatture non arrivano a nessun server. Cosa si "
      + "raccoglie davvero, chi lo tratta e per quanto tempo.",
    indicizzabile: true,
  },
  [SITO.cookie]: {
    titolo: "Cookie · Flowlance",
    descrizione:
      "Quali cookie usa questo sito, chi li imposta e per quanto. Dentro l'applicazione non c'è "
      + "nessuna misurazione, in nessun caso.",
    indicizzabile: true,
  },
  [SITO.approssimazioni]: {
    titolo: "Cosa Flowlance non calcola",
    descrizione:
      "L'elenco pubblico delle semplificazioni: cosa l'app stima, cosa non tiene in conto e dove "
      + "serve il commercialista. Detto prima di comprare, non dopo.",
    indicizzabile: true,
  },
  [SITO.grazie]: {
    titolo: "Grazie · Flowlance",
    descrizione:
      "Il pagamento è arrivato. La chiave di licenza parte per email, di norma entro 24 ore lavorative.",
    indicizzabile: false,
  },
};

/** Le misure oltre le quali un motore taglia. Le tiene un test. */
export const LIMITI = { titolo: 65, descrizione: 158 } as const;

/**
 * L'immagine di anteprima, quella che compare quando qualcuno incolla un
 * indirizzo in una chat.
 *
 * `null` quando non c'è: un `og:image` che punta a un file mancante fa comparire
 * un rettangolo rotto al posto dell'anteprima, che è peggio di nessuna
 * anteprima — senza immagine i social mostrano titolo e descrizione, e stanno
 * bene. Un test verifica che quando qui c'è un percorso, il file esista davvero
 * e **abbia nei suoi byte** le misure dichiarate qui accanto.
 *
 * Percorso e misure non si riscrivono: arrivano da `anteprima.ts`, che è il
 * file che le dice anche al generatore e al presidio del build. Sarebbero
 * altrimenti tre posti dove è scritto «1200 × 630», e il giorno in cui uno
 * cambia gli altri due mentono.
 */
export const IMMAGINE_ANTEPRIMA: { percorso: string; larghezza: number; altezza: number } | null = {
  percorso: PERCORSO_ANTEPRIMA,
  larghezza: MISURA.larghezza,
  altezza: MISURA.altezza,
};

/** L'indirizzo assoluto di una pagina pubblica: serve al canonical e alla sitemap. */
export function indirizzoAssoluto(rotta: string): string {
  const conBarra = rotta === "/" ? "/" : `${rotta}/`;
  return `${DOMINIO}${conBarra}`;
}

/** Le rotte che vanno in sitemap: le pubbliche indicizzabili, e basta. */
export function rotteIndicizzabili(): string[] {
  return Object.entries(METADATI)
    .filter(([, m]) => m.indicizzabile)
    .map(([rotta]) => rotta)
    .sort();
}

// ————————————————————————————————————————————————————————————
// Le tre facce della stessa decisione
// ————————————————————————————————————————————————————————————

/**
 * `robots.txt`, `<meta name="robots">` e `sitemap.xml` dicono tutti e tre la
 * stessa cosa, e la dicono a partire dalla **stessa riga**.
 *
 * Sono tre file diversi, letti da tre meccanismi diversi, e i tre stati
 * incoerenti sono tutti possibili se ognuno decide per conto suo:
 *
 * - sito indicizzabile con `robots.txt` che blocca — nessuno entra, e chi
 *   scrive il sito crede di aver aperto;
 * - `robots.txt` permissivo con `noindex` su ogni pagina — i motori entrano,
 *   leggono, e non pubblicano niente;
 * - sitemap che elenca pagine marcate `noindex` — si chiede a un motore di
 *   venire a prendere quello che gli si è appena detto di non tenere.
 *
 * Nessuno dei tre si vede aprendo il sito. Perciò le tre funzioni qui sotto
 * prendono lo stesso `chiuso` e non leggono niente per conto loro, e un test le
 * confronta in tutti e due gli stati.
 */
export type RegoleRobots = {
  rules: { userAgent: string; allow?: string; disallow: string }[];
  sitemap?: string;
};

export function regoleRobots(chiuso: boolean): RegoleRobots {
  if (chiuso) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    /*
      L'applicazione resta esclusa anche a sito aperto. Non è una pagina: è
      un archivio che vive nel browser di chi lo apre, e quello che un motore
      archivierebbe è la schermata di attesa.
    */
    rules: [{ userAgent: "*", allow: "/", disallow: `${BASE_APP}/` }],
    sitemap: `${DOMINIO}/sitemap.xml`,
  };
}

/** La pagina porta `noindex`? A sito chiuso tutte; a sito aperto quelle che lo dicono. */
export function noindexPer(rotta: string, chiuso: boolean): boolean {
  const m = METADATI[rotta];
  return chiuso || m === undefined || !m.indicizzabile;
}

/** Gli indirizzi che la sitemap elenca. Vuota a sito chiuso. */
export function indirizziSitemap(chiuso: boolean): string[] {
  return chiuso ? [] : rotteIndicizzabili().map(indirizzoAssoluto);
}

/**
 * I metadati di una pagina pubblica, pronti per Next.
 *
 * Titolo, descrizione, canonical, Open Graph e Twitter card escono **tutti**
 * dalle stesse due stringhe: non esiste un titolo per il browser e un altro
 * per Facebook che possano dire cose diverse. È la stessa regola del prezzo,
 * applicata ai testi che si leggono prima di aprire la pagina.
 */
export function metadatiDi(rotta: string): Metadata {
  const m = METADATI[rotta];
  if (!m) {
    throw new Error(
      `Nessun titolo e nessuna descrizione per «${rotta}».\n`
        + "Ogni pagina pubblica ne ha bisogno: senza, un motore mostra la prima riga che trova.\n"
        + "Si aggiungono a METADATI in src/lib/sito/metadati.ts.",
    );
  }

  const url = indirizzoAssoluto(rotta);
  const immagini = IMMAGINE_ANTEPRIMA
    ? [
        {
          url: `${DOMINIO}${IMMAGINE_ANTEPRIMA.percorso}`,
          width: IMMAGINE_ANTEPRIMA.larghezza,
          height: IMMAGINE_ANTEPRIMA.altezza,
          alt: m.titolo,
        },
      ]
    : undefined;

  return {
    title: m.titolo,
    description: m.descrizione,
    /*
      Il canonical su ogni pagina, sempre lo stesso indirizzo con la barra
      finale: `trailingSlash: true` fa sì che il sito risponda a `/termini` e a
      `/termini/`, e senza canonical sono due indirizzi per un documento solo.
    */
    alternates: { canonical: url },
    /*
      Il `noindex` di riga discende da `CHIUSO_AI_MOTORI` come quello globale,
      **più** la pagina che non va indicizzata neanche a sito aperto. Le due
      condizioni si sommano: nessuna delle due può riaprire quello che l'altra
      chiude.
    */
    robots: noindexPer(rotta, CHIUSO_AI_MOTORI) ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      locale: "it_IT",
      siteName: "Flowlance",
      url,
      title: m.titolo,
      description: m.descrizione,
      ...(immagini ? { images: immagini } : {}),
    },
    twitter: {
      // Senza immagine la scheda grande mostrerebbe un riquadro vuoto.
      card: IMMAGINE_ANTEPRIMA ? "summary_large_image" : "summary",
      title: m.titolo,
      description: m.descrizione,
      ...(immagini ? { images: immagini.map((i) => i.url) } : {}),
    },
  };
}
