import { GuardiaArchivio } from "@/components/dati/guardia-archivio";

/**
 * Tutte le schermate di lavoro leggono dall'archivio locale, che esiste solo
 * nel browser: nulla di utile si potrebbe generare staticamente, e il tentativo
 * di aprire IndexedDB durante la generazione fallirebbe.
 *
 * La guardia fa anche la scelta fra l'archivio vero e quello della demo, e la
 * fa **prima** che una qualunque schermata legga: `archivio()` è un singolo, e
 * chi legge per primo decide per tutti.
 */
export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <GuardiaArchivio
      segnaposto={
        <div className="flex min-h-dvh items-center justify-center">
          <p className="text-corpo text-inchiostro-tenue">Apertura dell&apos;archivio locale…</p>
        </div>
      }
    >
      {children}
    </GuardiaArchivio>
  );
}
