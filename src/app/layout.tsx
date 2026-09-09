import type { Metadata, Viewport } from "next";
import { ContenitoreToast } from "@/components/ui/toast";
import { CHIUSO_AI_MOTORI, DOMINIO } from "@/lib/sito/impostazioni";
import "./globals.css";

const DESCRIZIONE =
  "Il cruscotto economico, fiscale e finanziario del libero professionista italiano. I dati restano nel tuo browser.";

export const metadata: Metadata = {
  metadataBase: new URL(DOMINIO),
  title: "Flowlance",
  description: DESCRIZIONE,
  applicationName: "Flowlance",
  /*
    Il `noindex` su ogni pagina, sito e applicazione, discende da una costante
    sola: si apre il sito cambiando `CHIUSO_AI_MOTORI` in `src/lib/sito.ts`.
    Serve insieme al `robots.txt` e non al suo posto — quello dice al crawler
    di non passare, questo dice a chi passa lo stesso di non indicizzare.
  */
  robots: CHIUSO_AI_MOTORI ? { index: false, follow: false } : undefined,
  openGraph: {
    title: "Flowlance",
    description: DESCRIZIONE,
    siteName: "Flowlance",
    locale: "it_IT",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F2F4F9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        {children}
        <ContenitoreToast />
      </body>
    </html>
  );
}
