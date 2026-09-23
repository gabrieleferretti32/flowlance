/**
 * Dal file all'anteprima: quello che si scriverebbe, prima di scriverlo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'anteprima non è una cortesia
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un import scrive centinaia di righe in un colpo solo. Se una colonna è
 * mappata male, se le uscite entrano con il segno sbagliato, se un mese era
 * già stato caricato, l'errore non si vede riga per riga: si vede come un
 * saldo che non torna, settimane dopo, quando nessuno ricorda più quale file
 * è entrato. Quindi si mostra prima tutto quello che succederà — categoria
 * compresa, e da dove viene — e ogni riga si può cambiare o togliere.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * I doppioni si segnalano, non si buttano
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Stessa data, stesso importo, stessa descrizione normalizzata: quasi sempre è
 * lo stesso movimento già caricato, e la riga arriva **deselezionata**. Ma
 * quasi sempre non è sempre — due caffè uguali nello stesso giorno esistono —
 * quindi la riga resta lì, visibile, con la spunta che si può rimettere. Un
 * duplicato scartato in silenzio è una spesa che non c'è mai stata.
 */
import { round2 } from "@/lib/fisco/aritmetica";
import { abbinaGiroconti, GIORNI_DI_TOLLERANZA } from "./giroconti";
import { categorizza, testoConfrontabile, type Proposta } from "./categorizza";
import { descrizioneUtile } from "./descrizione";
import type { RigaRendiconto } from "./rendiconto";
import type { CategoriaPf, MovimentoPf, RegolaPf, TipoMovimento } from "./tipi";

export { GIORNI_DI_TOLLERANZA };

/** La firma di un movimento, per riconoscere lo stesso due volte. */
export function firmaMovimento(data: string, importo: number, descrizione: string): string {
  return `${data}|${round2(Math.abs(importo)).toFixed(2)}|${testoConfrontabile(descrizione)}`;
}

export type RigaAnteprima = {
  id: string;
  /** Da quale file e da quale riga: per ritrovarla nel file, se serve. */
  file: string;
  indice: number;
  data: string;
  /** Quella che si vede e che finisce in archivio: ripulita dalla formula. */
  descrizione: string;
  /**
   * Quella che ha scritto la banca, parola per parola.
   *
   * Serve a due cose, e non si mostra: **la firma dei doppioni** e la
   * categoria. Se la firma si calcolasse sulla descrizione ripulita — o
   * peggio, su quella corretta a mano in anteprima — ricaricando lo stesso
   * file le righe non si riconoscerebbero più, e entrerebbero due volte.
   */
  descrizioneOriginale: string;
  /** Sempre positivo: il verso lo dice `tipo`, come nel registro. */
  importo: number;
  tipo: TipoMovimento;
  categoriaId: string;
  origineCategoria: Proposta["origine"];
  contoId: string;
  contoDestinazioneId?: string;
  /** Già presente in archivio, o due volte nei file di questo import. */
  duplicato: boolean;
  /** Le due righe che sono diventate un giroconto, quando è successo. */
  daGiroconto?: boolean;
  /**
   * Qualcuno ha cambiato qualcosa su questa riga, a mano.
   *
   * Serve a una cosa sola: quando si crea una regola dall'anteprima, le altre
   * righe si ricategorizzano — ma non queste. Una decisione presa a mano non
   * si sovrascrive con una regola dedotta due secondi dopo, nemmeno se la
   * regola è giusta per tutte le altre.
   */
  toccata?: boolean;
  scelta: boolean;
};

export type FileRendiconto = {
  nome: string;
  contoId: string;
  righe: RigaRendiconto[];
};

export type IngressoAnteprima = {
  file: FileRendiconto[];
  categorie: CategoriaPf[];
  regole: RegolaPf[];
  /** Quello che c'è già in archivio: serve ai doppioni e ai giroconti. */
  esistenti: MovimentoPf[];
  /** I conti che il modulo segue: solo fra questi si cercano i giroconti. */
  contiTracciati: string[];
};

/**
 * Le righe dell'anteprima, nell'ordine in cui si leggono: per data.
 *
 * I giroconti si abbinano **dopo** aver costruito tutte le righe di tutti i
 * file, e non file per file: le due metà di un giroconto stanno quasi sempre
 * in due rendiconti diversi — uno per conto — ed è esattamente il caso che
 * cercando dentro un file solo non si troverebbe mai.
 */
export function anteprimaImport(ing: IngressoAnteprima): RigaAnteprima[] {
  /*
    Le firme di quello che c'è già, **giroconti compresi**.

    La prima stesura li escludeva, e caricando due volte lo stesso rendiconto
    ogni giroconto rientrava: la riga d'uscita non somigliava a niente, perché
    l'unico movimento che la conteneva era di tipo «giroconto» e quel tipo era
    stato tolto dal confronto. Si è visto provando l'import due volte di
    seguito — otto righe, sette senza spunta e una con — ed è il difetto che
    fa crescere il saldo a ogni caricamento.
  */
  const gia = new Set(
    ing.esistenti.map((m) => firmaMovimento(m.data, m.importo, m.descrizione)),
  );
  for (const m of ing.esistenti) {
    if (m.hashDuplicato) gia.add(m.hashDuplicato);
  }
  const visteInQuestoImport = new Set<string>();

  /*
    L'altra metà di un giroconto già in archivio.

    Quando la coppia si è unita, in archivio resta **una** riga con la
    descrizione dell'uscita: la riga d'entrata — «GIROCONTO DA CONTO
    CORRENTE», nel rendiconto dell'altro conto — non somiglia a niente di
    scritto. Si riconosce per struttura, com'era stata riconosciuta la prima
    volta: stesso importo, uno dei due conti, entro la stessa tolleranza.

    Un giroconto vero e nuovo di pari importo fra gli stessi conti entro tre
    giorni viene segnalato anche lui. È il prezzo giusto: la riga resta lì,
    visibile, e la spunta si rimette.
  */
  const giroconti = ing.esistenti.filter((m) => m.tipo === "giroconto");
  const somigliaAUnGiroconto = (data: string, importo: number, contoId: string) =>
    giroconti.some(
      (g) =>
        round2(g.importo) === round2(Math.abs(importo))
        && (g.contoId === contoId || g.contoDestinazioneId === contoId)
        && Math.abs(Date.parse(`${g.data}T00:00:00Z`) - Date.parse(`${data}T00:00:00Z`))
          / 86_400_000
          <= GIORNI_DI_TOLLERANZA,
    );

  const righe: RigaAnteprima[] = [];
  for (const [posizione, f] of ing.file.entries()) {
    for (const r of f.righe) {
      /*
        Il segno dice il verso; il tipo lo decide la categoria riconosciuta.
        Una riga che dice «RATA PRESTITO» è un'uscita, ma non una spesa
        qualunque: vedi `categorizza`.
      */
      const proposta = categorizza(
        r.descrizione,
        r.importo >= 0 ? "entrata" : "uscita",
        ing.categorie,
        ing.regole,
      );
      const tipo = proposta.tipo;
      /* La firma sul testo della banca: vedi `descrizioneOriginale`. */
      const firma = firmaMovimento(r.data, r.importo, r.descrizione);
      const duplicato =
        gia.has(firma)
        || visteInQuestoImport.has(firma)
        || somigliaAUnGiroconto(r.data, r.importo, f.contoId);
      visteInQuestoImport.add(firma);
      righe.push({
        /*
          **La posizione del file, non solo il suo nome.**

          Le banche esportano nomi generici — «movimenti.csv», «Lista
          Operazione.xlsx» — e due conti della stessa banca scaricano due file
          che si chiamano uguale. Con l'identificatore fatto di nome e riga, le
          righe dei due file erano le stesse: `conGiroconti` le rilegge da una
          mappa per id, di due righe con lo stesso id ne resta una, e tutte le
          righe prendevano il conto dell'ultimo file caricato. Cioè l'import
          scriveva i movimenti sul conto sbagliato, senza dirlo.
        */
        id: `${posizione}:${f.nome}#${r.indice}`,
        file: f.nome,
        indice: r.indice,
        data: r.data,
        /*
          Ripulita dalla formula della banca: «Addebito Diretto Disposto A
          Favore Di ENEL ENERGIA SPA» diventa «ENEL ENERGIA SPA», che è la
          parte che identifica chi ha preso i soldi — l'unica che serve a chi
          guarda il registro, e l'unica che finiva oltre il troncamento.
          La categoria, invece, si legge sul testo grezzo: vedi
          `descrizione.ts`.
        */
        descrizione: descrizioneUtile(r.descrizione),
        descrizioneOriginale: r.descrizione,
        importo: round2(Math.abs(r.importo)),
        tipo,
        categoriaId: proposta.categoriaId,
        origineCategoria: proposta.origine,
        contoId: f.contoId,
        duplicato,
        scelta: !duplicato,
      });
    }
  }

  return conGiroconti(righe, ing.contiTracciati).sort(
    (a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id),
  );
}

/**
 * Le coppie uscita/entrata fra due conti diventano un giroconto solo.
 *
 * L'abbinamento lo fa `abbinaGiroconti`, che è già scritto e provato: qui si
 * traduce l'anteprima nella forma che quella funzione conosce e si rilegge il
 * risultato. Tradurre costa poche righe; avere due regole di abbinamento —
 * una per l'import e una per il resto — costerebbe il giorno in cui una delle
 * due cambia.
 */
function conGiroconti(righe: RigaAnteprima[], contiTracciati: string[]): RigaAnteprima[] {
  const perId = new Map(righe.map((r) => [r.id, r]));
  const comeMovimenti: MovimentoPf[] = righe.map((r) => ({
    id: r.id,
    data: r.data,
    tipo: r.tipo,
    categoriaId: r.categoriaId,
    contoId: r.contoId,
    importo: r.importo,
    descrizione: r.descrizione,
  }));

  const esito = abbinaGiroconti(comeMovimenti, contiTracciati);
  return esito.movimenti.map((m) => {
    const originale = perId.get(m.id);
    const base: RigaAnteprima = originale ?? {
      id: m.id,
      file: "",
      indice: 0,
      data: m.data,
      descrizione: m.descrizione,
      descrizioneOriginale: m.descrizione,
      importo: m.importo,
      tipo: m.tipo,
      categoriaId: m.categoriaId,
      origineCategoria: "nessuna",
      contoId: m.contoId,
      duplicato: false,
      scelta: true,
    };
    if (m.tipo !== "giroconto") return { ...base, tipo: m.tipo };
    return {
      ...base,
      data: m.data,
      tipo: "giroconto",
      /* Un giroconto non ha categoria: è la stessa regola del registro. */
      categoriaId: "",
      origineCategoria: "nessuna",
      contoId: m.contoId,
      contoDestinazioneId: m.contoDestinazioneId ?? undefined,
      importo: m.importo,
      daGiroconto: true,
    };
  });
}

/**
 * Le righe dell'anteprima aperta, dopo che è nata una regola nuova.
 *
 * Creare una regola da una riga e vedere le altre sei righe uguali restare
 * «Non definito» è la cosa che fa pensare che la regola non abbia funzionato:
 * vale dal prossimo import, e chi guarda non ha modo di saperlo. Qui la
 * regola si applica subito a quello che si sta guardando.
 *
 * Due esclusioni, e sono la parte importante. Le righe **toccate a mano** non
 * si toccano: una decisione presa da chi guarda non si sovrascrive con una
 * regola dedotta due secondi dopo. E i **giroconti** restano giroconti: una
 * categoria non ce l'hanno per definizione.
 *
 * Si ricategorizza dal **testo grezzo**, come al primo giro: la descrizione
 * mostrata è ripulita, e le regole si sono sempre confrontate con quello che
 * ha scritto la banca.
 */
export function riapplicaRegole(
  righe: RigaAnteprima[],
  categorie: CategoriaPf[],
  regole: RegolaPf[],
): RigaAnteprima[] {
  return righe.map((r) => {
    if (r.toccata || r.tipo === "giroconto") return r;
    const proposta = categorizza(
      r.descrizioneOriginale,
      r.tipo === "entrata" ? "entrata" : "uscita",
      categorie,
      regole,
    );
    if (proposta.categoriaId === r.categoriaId && proposta.tipo === r.tipo) return r;
    return {
      ...r,
      categoriaId: proposta.categoriaId,
      tipo: proposta.tipo,
      origineCategoria: proposta.origine,
    };
  });
}

/** Quello che si scriverà: le righe scelte, nella forma dell'archivio. */
export function movimentiDaScrivere(
  righe: RigaAnteprima[],
  importId: string,
  nuovoId: () => string,
): MovimentoPf[] {
  return righe
    .filter((r) => r.scelta)
    .map((r) => ({
      id: nuovoId(),
      data: r.data,
      tipo: r.tipo,
      categoriaId: r.tipo === "giroconto" ? "" : r.categoriaId,
      contoId: r.contoId,
      ...(r.contoDestinazioneId ? { contoDestinazioneId: r.contoDestinazioneId } : {}),
      importo: round2(Math.abs(r.importo)),
      descrizione: r.descrizione,
      importId,
      /*
        L'impronta si calcola su quello che ha scritto la banca, non su quello
        che si legge: la descrizione si ripulisce, e in anteprima si può anche
        correggere a mano. Con l'impronta presa dal testo mostrato, lo stesso
        file ricaricato il mese dopo produrrebbe impronte diverse e le righe
        entrerebbero due volte — proprio quello che l'impronta esiste per
        impedire.
      */
      hashDuplicato: firmaMovimento(r.data, r.importo, r.descrizioneOriginale),
    }));
}
