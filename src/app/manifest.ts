import type { MetadataRoute } from "next";
import { BASE_APP } from "@/lib/rotte";

/**
 * Il manifest serve a una cosa sola: se qualcuno installa l'app sul telefono o
 * la aggiunge alla home, deve chiamarsi Flowlance e aprirsi a schermo
 * pieno. I colori sono i token di `globals.css` — sfondo e inchiostro.
 */
// Con `output: "export"` una route di metadata va dichiarata statica in modo
// esplicito, altrimenti Next la tratta come dinamica e il build fallisce.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flowlance",
    short_name: "Flowlance",
    description:
      "Il cruscotto economico, fiscale e finanziario del libero professionista italiano. I dati restano nel tuo browser.",
    lang: "it",
    /*
      Chi installa Flowlance sulla home installa l'**applicazione**, non la
      pagina di vendita: `start_url` segue l'app sotto /app. Uno scorciatoia
      che apre la pagina di vendita sarebbe la peggiore delle due sviste —
      silenziosa, e visibile solo a chi ha già comprato.
    */
    start_url: `${BASE_APP}/`,
    scope: `${BASE_APP}/`,
    display: "standalone",
    background_color: "#F2F4F9",
    theme_color: "#F2F4F9",
    /*
      Le tre PNG le genera `strumenti/icone.mjs` dal marchio, e un test
      fallisce se il marchio cambia senza che siano state rifatte.

      La `maskable` non è un doppione della 512: Android ritaglia l'icona
      nella forma del suo tema e butta via quello che resta fuori. Senza una
      versione fatta apposta — sfondo a tutto campo, marchio dentro il cerchio
      centrale dell'80 % — il sistema incolla l'icona con i suoi angoli
      arrotondati dentro un cerchio bianco.

      Il favicon da 32×32 stava qui e non ci sta più: non serve a installare
      niente, e certi avvii la sceglievano per la sua dichiarazione di
      dimensione, mettendo sulla scrivania un'icona da trentadue pixel.
    */
    icons: [
      { src: "/icona-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icona-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icona-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
