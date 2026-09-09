import type { PaginaTesto } from "@/lib/contenuti/pagine";

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
export function PaginaDiTesto({ pagina }: { pagina: PaginaTesto }) {
  return (
    <main className="mx-auto w-full max-w-[46rem] px-5 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-kpi font-semibold tracking-tight">{pagina.titolo}</h1>
      <p className="mt-2 text-etichetta text-inchiostro-tenue">
        {pagina.aggiornatoIl
          ? `Ultimo aggiornamento: ${pagina.aggiornatoIl}`
          : "Senza data di aggiornamento."}
      </p>
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
