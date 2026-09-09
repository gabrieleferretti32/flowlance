import Link from "next/link";
import { SITO } from "@/lib/rotte";
import { PreferenzeCookie } from "./preferenze-cookie";

/**
 * Il piede, su **ogni** pagina: sito e applicazione.
 *
 * I cinque collegamenti sono cinque per una ragione ciascuno. Privacy, Termini
 * e Cookie perché si vende; «Preferenze cookie» perché un consenso che non si
 * può revocare non è un consenso; e «Cosa Flowlance non calcola» perché è la
 * cosa che distingue questo prodotto da chi promette il conto esatto — non è
 * un allegato tecnico da nascondere, è l'argomento.
 *
 * Sta in un componente solo e non in due: dentro l'app e fuori le voci sono le
 * stesse, e due elenchi si sarebbero disallineati al primo documento nuovo.
 *
 * In stampa sparisce: il prospetto per il commercialista non parla di cookie.
 */
export function Piede() {
  return (
    <footer className="border-t border-bordo bg-superficie-alt px-4 py-8 sm:px-5 lg:px-8 print:hidden">
      <div className="mx-auto flex max-w-[1140px] flex-col gap-5">
        <nav aria-label="Documenti e preferenze">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <VocePiede href={SITO.privacy}>Privacy</VocePiede>
            <VocePiede href={SITO.termini}>Termini</VocePiede>
            <VocePiede href={SITO.cookie}>Cookie</VocePiede>
            {/*
              Non è un link a una pagina: riapre il banner. Un pulsante,
              quindi, perché è un'azione — e perché un lettore di schermo
              annunci quello che fa davvero.
            */}
            <li>
              <PreferenzeCookie />
            </li>
            <VocePiede href={SITO.approssimazioni}>Cosa Flowlance non calcola</VocePiede>
          </ul>
        </nav>
        <p className="text-micro leading-relaxed text-inchiostro-tenue">
          Flowlance è un prodotto di Gabriele Ferretti · P. IVA 02649540065 · REA AL-300809
          <br />
          Via Trinità 3/2 — 15068 Pozzolo Formigaro (AL) ·{" "}
          <a
            href="mailto:info@flowlance.it"
            className="underline underline-offset-2 hover:text-inchiostro"
          >
            info@flowlance.it
          </a>
        </p>
      </div>
    </footer>
  );
}

function VocePiede({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-etichetta text-inchiostro-tenue underline underline-offset-2 hover:text-inchiostro"
      >
        {children}
      </Link>
    </li>
  );
}
