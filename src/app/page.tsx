import Link from "next/link";
import { BASE_APP } from "@/lib/rotte";

/**
 * Segnaposto della pagina di vendita.
 *
 * La radice del dominio è dove andrà la landing; qui c'è quel tanto che serve
 * perché `/` esista e porti all'app finché la pagina vera non è pronta. Va
 * sostituita per intero, non arricchita.
 */
export default function Vendita() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-titolo">Flowlance</h1>
      <p className="text-corpo text-inchiostro-tenue">
        La pagina di vendita arriva qui. L&apos;applicazione, intanto, è al suo posto.
      </p>
      <Link href={`${BASE_APP}/`} className="text-accento underline underline-offset-2">
        Apri Flowlance
      </Link>
    </main>
  );
}
