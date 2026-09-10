import { Download } from "lucide-react";
import type { PaginaTesto } from "@/lib/contenuti/pagine";

/**
 * Il documento scaricabile, quando ce n'è uno.
 *
 * Solo i Termini ne hanno uno, e non per simmetria mancata: i Termini si
 * **trasmettono** all'acquirente, e il punto 3 dice in che forma. Una privacy
 * policy si consulta, un contratto si allega a un ordine — e per allegarlo
 * serve un file con un'impronta, non una pagina che domani dice un'altra cosa.
 */
export type Allegato = { indirizzo: string; impronta: string; versione: number };

/**
 * Un documento pubblicato: titolo, data, corpo. Niente altro.
 *
 * Le pagine non aggiungono e non riassumono. Se un documento deve dire una
 * cosa in più, la dice il documento — così aggiornarlo resta un file solo.
 *
 * La data sta **in testa**, dove la si cerca su un documento legale, e viene
 * dal file: non esiste una seconda data da tenere allineata. Quando manca, la
 * pagina lo dice invece di mostrare un'assenza silenziosa.
 */
export function PaginaDiTesto({
  pagina,
  allegato,
}: {
  pagina: PaginaTesto;
  allegato?: Allegato;
}) {
  return (
    <main className="mx-auto w-full max-w-[46rem] px-5 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-kpi font-semibold tracking-tight">{pagina.titolo}</h1>
      <p className="mt-2 text-etichetta text-inchiostro-tenue">
        {pagina.versione !== null && pagina.aggiornatoIl
          ? `Versione ${pagina.versione} — ${pagina.aggiornatoIl}`
          : pagina.aggiornatoIl
            ? `Ultimo aggiornamento: ${pagina.aggiornatoIl}`
            : "Senza data di aggiornamento."}
      </p>

      {allegato && (
        /*
          Il PDF e la sua impronta, in testa e non in fondo: chi cerca il file
          da mettere nel fascicolo lo cerca prima di leggere, non dopo. L'impronta
          per intero, in un blocco che si seleziona — troncata non verificherebbe
          niente, e sembrerebbe lo stesso una prova.
        */
        <div className="mt-6 rounded-campo border border-bordo px-4 py-3">
          <a
            href={allegato.indirizzo}
            download
            className="inline-flex min-h-11 items-center gap-2 text-corpo font-medium text-accento underline underline-offset-2 sm:min-h-0"
          >
            <Download className="size-4 shrink-0" aria-hidden />
            Scarica questo documento in PDF (versione {allegato.versione})
          </a>
          <p className="mt-2 text-etichetta text-inchiostro-tenue">Impronta SHA-256 del file:</p>
          <p className="cifre mt-1 break-all text-etichetta text-inchiostro-tenue">
            {allegato.impronta}
          </p>
        </div>
      )}
      {/*
        Il corpo arriva da `marked`, che ha convertito un file del repository:
        non è contenuto di terzi e non passa da nessun campo di input. La
        formattazione sta qui in un blocco solo, così i quattro documenti si
        vedono uguali.
      */}
      <div
        className="prosa mt-10"
        dangerouslySetInnerHTML={{ __html: pagina.html }}
      />
    </main>
  );
}
