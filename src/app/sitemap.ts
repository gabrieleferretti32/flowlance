import type { MetadataRoute } from "next";
import { CHIUSO_AI_MOTORI } from "@/lib/sito/impostazioni";
import { indirizziSitemap } from "@/lib/sito/metadati";

// Con `output: "export"` una route di metadata va dichiarata statica in modo
// esplicito, altrimenti Next la tratta come dinamica e il build fallisce.
export const dynamic = "force-static";

/**
 * La sitemap, generata dalle rotte vere.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché non è un file scritto a mano
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Una sitemap scritta a mano è un elenco che invecchia: la pagina nuova non ci
 * finisce perché nessuno se n'è ricordato, e la pagina tolta ci resta a
 * mandare i motori su un 404. Nessuna delle due cose si vede — sono entrambe
 * silenziose, ed è la forma di difetto che questo progetto insegue da
 * settimane, spostata in un file XML.
 *
 * Qui l'elenco esce da `METADATI`, che è la stessa tabella da cui ogni pagina
 * prende il proprio titolo. Una pagina pubblica senza una riga lì dentro non si
 * costruisce nemmeno — `metadatiDi` lancia — quindi non può esistere una pagina
 * che la sitemap non conosce.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Cosa non ci finisce
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `/app` e tutto quello che ci sta sotto: non sono pagine da indicizzare, sono
 * l'applicazione. E `/grazie`, che è dove Stripe rimanda dopo il pagamento:
 * dice qualcosa solo a chi ha appena pagato, e trovarla in una ricerca farebbe
 * credere di aver comprato qualcosa. Lo decide `indicizzabile` nella tabella,
 * che è la stessa riga da cui discende il `noindex` di quella pagina: non
 * possono divergere.
 *
 * A sito chiuso la sitemap è **vuota**, non assente: un file che elenca zero
 * indirizzi dice «non c'è niente da prendere» meglio di un 404, che si legge
 * come un errore di configurazione.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return indirizziSitemap(CHIUSO_AI_MOTORI).map((url) => ({
    url,
    /*
      Nessuna `lastModified` inventata. Metterci la data del build direbbe a un
      motore che ogni pagina è cambiata a ogni distribuzione, anche quando non
      è vero: si guadagna una visita e si perde la credibilità del segnale.
      La priorità sì, ed è l'unica cosa che qui si può dire con onestà: la
      pagina di vendita conta più delle condizioni contrattuali.
    */
    priority: url.replace(/\/$/, "").endsWith(".it") ? 1 : 0.6,
    changeFrequency: "monthly" as const,
  }));
}
