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
  descrizione: string;
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
  for (const f of ing.file) {
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
      const firma = firmaMovimento(r.data, r.importo, r.descrizione);
      const duplicato =
        gia.has(firma)
        || visteInQuestoImport.has(firma)
        || somigliaAUnGiroconto(r.data, r.importo, f.contoId);
      visteInQuestoImport.add(firma);
      righe.push({
        id: `${f.nome}#${r.indice}`,
        file: f.nome,
        indice: r.indice,
        data: r.data,
        descrizione: r.descrizione,
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
      hashDuplicato: firmaMovimento(r.data, r.importo, r.descrizione),
    }));
}
