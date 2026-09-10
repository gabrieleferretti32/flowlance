import { GuardiaArchivio } from "@/components/dati/guardia-archivio";

/**
 * L'applicazione resta fuori dagli indici **sempre**, non solo finché il sito
 * è chiuso.
 *
 * `robots.txt` già dice a un motore di non passare di qua, ma non passare e
 * non indicizzare sono due cose diverse: una pagina che nessuno ha visitato può
 * finire in un indice lo stesso, se qualcuno la collega da fuori. Questo meta
 * la chiude dall'altro lato.
 *
 * E non c'è niente da indicizzare: le schermate leggono un archivio che esiste
 * solo nel browser di chi le apre, e quello che un motore archivierebbe è
 * «Apertura dell'archivio locale…».
 */
export const metadata = { robots: { index: false, follow: false } };

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
