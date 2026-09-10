import Link from "next/link";
import { SITO } from "@/lib/rotte";
import { metadatiDi } from "@/lib/sito/metadati";

export const metadata = metadatiDi(SITO.grazie);

/**
 * Dove Stripe rimanda dopo il pagamento.
 *
 * Questa pagina **non sa chi sia arrivato**, e non finge di saperlo. È un sito
 * statico: il ritorno da un Payment Link non porta con sé niente di
 * verificabile, e senza un server che interroghi Stripe qualunque «grazie,
 * Elena» sarebbe una cosa scritta a caso — che chiunque può vedere aprendo
 * l'indirizzo a mano, senza aver pagato niente.
 *
 * Dice quindi soltanto le due cose che sono vere per chiunque abbia pagato
 * davvero: **la chiave arriva per email**, e **entro 24 ore lavorative**, che è
 * il termine scritto nei Termini al punto 3. Il ritardo non è un difetto da
 * nascondere: le licenze si firmano a mano con una chiave privata che non sta
 * in nessun server, ed è la ragione per cui i dati di chi compra non possono
 * essere rubati da qui.
 */
export default function Grazie() {
  return (
    <main className="mx-auto w-full max-w-[42rem] px-5 py-16 sm:px-6 sm:py-24">
      <h1 className="font-display text-kpi font-semibold tracking-tight">
        Pagamento ricevuto.
      </h1>
      <p className="mt-4 text-corpo leading-relaxed">
        La chiave di licenza arriva <strong className="font-semibold">per email</strong>,
        all&apos;indirizzo che hai indicato durante l&apos;acquisto, di norma{" "}
        <strong className="font-semibold">entro 24 ore lavorative</strong>.
      </p>
      <p className="mt-4 text-corpo leading-relaxed text-inchiostro-tenue">
        Non è un invio automatico ed è voluto: ogni licenza è firmata a mano con una chiave
        che non sta su nessun server. È lo stesso motivo per cui i tuoi dati fiscali non
        possono essere presi da qui — non ci sono.
      </p>
      <p className="mt-8 text-etichetta text-inchiostro-tenue">
        Se dopo 24 ore lavorative non hai ricevuto niente, scrivi a{" "}
        <a
          href="mailto:info@flowlance.it"
          className="text-accento underline underline-offset-2"
        >
          info@flowlance.it
        </a>{" "}
        e controlla la cartella dello spam.
      </p>
      <p className="mt-10 text-etichetta">
        <Link href={SITO.vendita} className="text-accento underline underline-offset-2">
          Torna alla pagina di Flowlance
        </Link>
      </p>
    </main>
  );
}
