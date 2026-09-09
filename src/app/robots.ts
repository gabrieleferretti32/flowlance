import type { MetadataRoute } from "next";
import { BASE_APP } from "@/lib/rotte";
import { CHIUSO_AI_MOTORI, DOMINIO } from "@/lib/sito/impostazioni";

// Con `output: "export"` una route di metadata va dichiarata statica in modo
// esplicito, altrimenti Next la tratta come dinamica e il build fallisce.
export const dynamic = "force-static";

/**
 * Il `robots.txt`, che discende da `CHIUSO_AI_MOTORI` e non da una decisione
 * presa qui: aprire il sito è cambiare quella riga, non questa.
 *
 * L'applicazione resta esclusa in ogni caso. Non c'è niente da indicizzare —
 * le schermate sono un segnaposto finché non montano — e un motore che ci
 * frugasse dentro archivierebbe la pagina «Apertura dell'archivio locale…».
 */
export default function robots(): MetadataRoute.Robots {
  if (CHIUSO_AI_MOTORI) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: `${BASE_APP}/` }],
    sitemap: `${DOMINIO}/sitemap.xml`,
  };
}
