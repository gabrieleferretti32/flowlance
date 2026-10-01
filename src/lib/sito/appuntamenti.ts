/**
 * Quando pagherai davvero, e quanto: il calendario simulato portato su quello
 * vero.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il problema che questo file risolve
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il motore calcola le scadenze **dell'anno simulato**, e `simula` gli passa
 * come «oggi» il 31 dicembre di quell'anno: senza quella data fissa, una pagina
 * pubblica aperta a settembre direbbe «scaduto» a chi non ha ancora aperto la
 * partita IVA. Il prezzo di quella scelta è che le date non sanno che giorno è
 * oggi: a dicembre il riquadro mostrerebbe il 30 novembre, cioè una data che
 * non esiste più.
 *
 * Qui le due cose si ricongiungono. `prossimaOccorrenza` prende giorno e mese
 * di una scadenza e li porta alla prima volta che tornano **da oggi in poi**,
 * dicendo in che anno sono finiti. L'importo resta quello del motore: di questo
 * file è soltanto il calendario.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Due risposte vere, non una
 * ─────────────────────────────────────────────────────────────────────────
 *
 * «Quanto verso il 30 novembre» ha due risposte diverse, e dipendono da una
 * cosa sola: se quello simulato è il tuo primo anno di attività.
 *
 * **A regime** — partita IVA aperta prima — durante l'anno versi due volte, e
 * la somma delle due è il carico dell'anno: a novembre il secondo acconto, a
 * giugno il resto (saldo dell'anno prima più primo acconto di quello nuovo).
 * In un anno regolare, dove ogni anno somiglia al precedente, quelle due rate
 * sommano esattamente a `caricoTotale`: è l'identità che tiene questo file
 * onesto, ed è un test.
 *
 * **Il primo anno** gli acconti non esistono: si calcolano sull'anno prima, e
 * un anno prima non c'è. Durante l'anno non versi niente, e il giugno dopo
 * paghi tutto il carico più il primo acconto dell'anno nuovo. È il numero più
 * grande della pagina, ed è quello che nessuno si aspetta.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché la partizione e non una seconda corsa del motore
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Per far dire al motore il saldo a regime bisognerebbe costruirgli due F24
 * finti — gli acconti versati durante l'anno — e la prima stesura di questa
 * pagina lo faceva passandogli il prospetto stesso come anno precedente. Usciva
 * 16.231,27 € al 30 giugno su 40.000 € di ricavi: un numero plausibile e
 * sbagliato, perché sommava un saldo da cui nessun acconto era stato tolto. È
 * il doppio conteggio, nella forma in cui non si vede.
 *
 * Qui non si ricalcola niente: si **divide** un totale che il motore ha già
 * fatto, con una quota che il motore ha già deciso. Le due righe non sono una
 * seconda copia della formula delle imposte — sono una sottrazione, e
 * `giugno + novembre === caricoTotale` la verifica su dieci combinazioni di
 * ricavi e regime.
 */
import { round2 } from "@/lib/fisco/aritmetica";

/** Giorno e mese di una scadenza, riportati all'anno in cui cadono davvero. */
export type Occorrenza = {
  /** La data di calendario, ISO. */
  data: string;
  anno: number;
  /**
   * È stata portata in un anno diverso da quello della data di partenza.
   *
   * Serve a dirlo: «il 30 giugno» senza l'anno, quando l'anno non è quello che
   * il lettore ha in testa, è la metà di un'informazione.
   */
  rinviata: boolean;
};

const FEBBRAIO = 2;

function bisestile(anno: number): boolean {
  return (anno % 4 === 0 && anno % 100 !== 0) || anno % 400 === 0;
}

/**
 * La prima volta che questo giorno e questo mese tornano, da `oggi` in poi.
 *
 * Il confronto fra date ISO è un confronto fra stringhe, e funziona: `"2026-11-30"`
 * è maggiore di `"2026-10-01"` carattere per carattere. Non si costruisce
 * nessun `Date`, quindi non c'è nessun fuso che possa spostare un giorno —
 * che su un confronto «è già passato?» è la differenza fra una data giusta e
 * una sbagliata di ventiquattr'ore.
 *
 * Il 29 febbraio si schiaccia sul 28 quando l'anno di arrivo non è bisestile:
 * nessuna scadenza fiscale cade il 29, ma lo slittamento dei festivi può
 * spostarci qualcosa, e un `"2027-02-29"` sarebbe una data che non esiste
 * stampata in pagina.
 */
export function prossimaOccorrenza(dataSimulata: string, oggi: string): Occorrenza {
  const annoSimulato = Number(dataSimulata.slice(0, 4));
  const mese = Number(dataSimulata.slice(5, 7));
  const giorno = Number(dataSimulata.slice(8, 10));
  const annoDiOggi = Number(oggi.slice(0, 4));

  const scritta = (anno: number) => {
    const g = mese === FEBBRAIO && giorno === 29 && !bisestile(anno) ? 28 : giorno;
    return `${anno}-${String(mese).padStart(2, "0")}-${String(g).padStart(2, "0")}`;
  };

  const questAnno = scritta(annoDiOggi);
  const anno = questAnno >= oggi ? annoDiOggi : annoDiOggi + 1;
  return { data: scritta(anno), anno, rinviata: anno !== annoSimulato };
}

export type GenereAppuntamento = "secondo-acconto" | "saldo-e-primo-acconto";

export type Appuntamento = Occorrenza & {
  genere: GenereAppuntamento;
  importo: number;
};

/** Quello che il motore ha già calcolato, e che qui si divide. */
export type IngressoAppuntamenti = {
  /** Imposte più contributi dell'anno simulato. */
  carico: number;
  /** Gli acconti, come li ha calcolati il motore. */
  acconti: { dovuti: boolean; primo: number; secondo: number };
  /** Le date di calendario delle due scadenze, dall'elenco del motore. */
  dataGiugno: string;
  dataNovembre: string;
  /**
   * L'anno simulato è il primo di attività.
   *
   * Non è un interruttore nuovo da chiedere: discende dall'anno di apertura
   * della partita IVA, che la pagina chiede già. Quando non è dichiarato vale
   * «no», che è il caso più comune fra chi arriva qui e la risposta prudente
   * — dice una scadenza in più e un numero più piccolo, non il contrario.
   */
  primoAnno: boolean;
  /** La data di oggi, vera. Iniettata: questo file resta puro. */
  oggi: string;
};

export type Appuntamenti = {
  /** Il prossimo versamento, in ordine di calendario vero. */
  prossimo: Appuntamento;
  /** Quello dopo, quando ce n'è uno. */
  seguente: Appuntamento | null;
  /**
   * Quest'anno non si versano acconti.
   *
   * Vero nel primo anno di attività — gli acconti nascono dall'anno prima — e
   * vero sotto la soglia oltre la quale si versano. Le due cose hanno la
   * stessa conseguenza per chi guarda: nessuna rata a novembre, tutto a
   * giugno.
   */
  senzaAcconti: boolean;
};

/**
 * I due appuntamenti che contano, in ordine di calendario vero.
 *
 * Solo saldo e acconti: l'IVA e il bollo stanno nella linea del tempo più
 * sotto, con le loro date. Il riquadro in evidenza risponde a una domanda
 * sola — «quando esce il prossimo pezzo grosso, e quanto» — e tre numeri
 * accanto non la rendono più chiara.
 */
export function appuntamentiFiscali(ing: IngressoAppuntamenti): Appuntamenti {
  const { carico, acconti, oggi } = ing;
  const senzaAcconti = ing.primoAnno || !acconti.dovuti || acconti.secondo <= 0;

  if (senzaAcconti) {
    /*
      Un appuntamento solo, a giugno, e due importi diversi sotto lo stesso
      nome. Nel primo anno si versa il carico intero **più** il primo acconto
      dell'anno nuovo: è il conto che sorprende, e la pagina lo dice. Sotto
      soglia il primo acconto è zero, e la somma resta il carico.
    */
    const importo = round2(carico + (ing.primoAnno ? acconti.primo : 0));
    return {
      prossimo: {
        ...prossimaOccorrenza(ing.dataGiugno, oggi),
        genere: "saldo-e-primo-acconto",
        importo,
      },
      seguente: null,
      senzaAcconti: true,
    };
  }

  const novembre: Appuntamento = {
    ...prossimaOccorrenza(ing.dataNovembre, oggi),
    genere: "secondo-acconto",
    importo: round2(acconti.secondo),
  };
  const giugno: Appuntamento = {
    ...prossimaOccorrenza(ing.dataGiugno, oggi),
    genere: "saldo-e-primo-acconto",
    importo: round2(carico - acconti.secondo),
  };

  const [prossimo, seguente] = novembre.data <= giugno.data ? [novembre, giugno] : [giugno, novembre];
  return { prossimo, seguente, senzaAcconti: false };
}

/**
 * Il divario fra quello che hai da parte e quello che serve.
 *
 * «Fino al prossimo 30 giugno» e non «fino a fine anno»: giugno è il momento
 * in cui il conto si chiude davvero, e un orizzonte che si fermasse a dicembre
 * direbbe «sei in pari» a chi ha da parte il secondo acconto e niente del
 * saldo.
 */
export type Divario = {
  /** Quanto serve da qui a quel giugno, compreso. */
  serve: number;
  /** Quanto manca. Zero vuol dire in pari. */
  manca: number;
  /** I mesi da qui a quel giugno. Almeno uno: a giugno si versa comunque. */
  mesi: number;
  /** Quanto al mese, per arrivarci. Zero quando non manca niente. */
  alMese: number;
  /** Il giugno di riferimento, per poterlo nominare. */
  giugno: Occorrenza;
};

/**
 * I mesi che restano da `oggi` a `data`, estremo compreso, almeno uno.
 *
 * Si contano i mesi di calendario e non i giorni: chi legge «sono 743 € al
 * mese» pensa a quante volte dovrà mettere via quella cifra, e le volte sono
 * i mesi che vede sul calendario — non una divisione per 30,4.
 */
export function mesiFinoA(oggi: string, data: string): number {
  const anni = Number(data.slice(0, 4)) - Number(oggi.slice(0, 4));
  const mesi = Number(data.slice(5, 7)) - Number(oggi.slice(5, 7));
  return Math.max(1, anni * 12 + mesi);
}

export function divario(app: Appuntamenti, giaMesso: number, oggi: string): Divario | null {
  const giugno = [app.prossimo, app.seguente].find((a) => a?.genere === "saldo-e-primo-acconto");
  if (!giugno) return null;

  /*
    Tutto quello che esce da qui a giugno compreso, non solo la rata di
    giugno: chi arriva a ottobre ha davanti il secondo acconto **e** il saldo,
    e un fabbisogno che ne contasse uno solo lo manderebbe a novembre in pari
    e a giugno scoperto.
  */
  const serve = round2(
    [app.prossimo, app.seguente]
      .filter((a): a is Appuntamento => a !== null && a.data <= giugno.data)
      .reduce((t, a) => t + a.importo, 0),
  );
  const manca = round2(Math.max(0, serve - Math.max(0, giaMesso)));
  const mesi = mesiFinoA(oggi, giugno.data);
  return {
    serve,
    manca,
    mesi,
    alMese: manca > 0 ? round2(manca / mesi) : 0,
    giugno: { data: giugno.data, anno: giugno.anno, rinviata: giugno.rinviata },
  };
}
