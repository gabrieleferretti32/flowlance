import { SoloClient } from "@/components/ui/solo-client";

/**
 * Tutte le schermate di lavoro leggono dall'archivio locale, che esiste solo
 * nel browser: nulla di utile si potrebbe generare staticamente, e il tentativo
 * di aprire IndexedDB durante la generazione fallirebbe.
 */
export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <SoloClient
      segnaposto={
        <div className="flex min-h-dvh items-center justify-center">
          <p className="text-corpo text-inchiostro-tenue">Apertura dell&apos;archivio locale…</p>
        </div>
      }
    >
      {children}
    </SoloClient>
  );
}
