import { FORNITORE } from "@/lib/contenuti/pdf-termini";
import { PREZZO } from "@/lib/sito/acquisto";
import { DOMINIO } from "@/lib/sito/impostazioni";
import { METADATI, indirizzoAssoluto } from "@/lib/sito/metadati";
import { SITO } from "@/lib/rotte";

/**
 * I dati strutturati della pagina di vendita, in JSON-LD.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * A chi servono
 * ─────────────────────────────────────────────────────────────────────────
 *
 * A un motore di ricerca, per mostrare il prezzo accanto al risultato invece
 * di farlo indovinare. E ai modelli che leggono la pagina per rispondere a
 * qualcuno che chiede «quanto costa un gestionale fiscale per partita IVA»:
 * senza, devono estrarre un numero da una frase, e un numero estratto male
 * finisce in una risposta che nessuno verifica.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché ogni valore viene da dove viene
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Nome e descrizione escono da `METADATI`, il prezzo da `PREZZO`, i dati della
 * ditta da `FORNITORE` — che è lo stesso da cui li prende la carta intestata
 * del PDF dei Termini. **Niente è scritto qui.**
 *
 * Non è pignoleria: questo blocco è invisibile a chi apre la pagina, e un
 * prezzo sbagliato qui dentro non lo vedrebbe nessuno per mesi, mentre Google
 * mostrerebbe «97 €» accanto a un prodotto che ne costa altri. È la peggiore
 * versione del difetto che questo progetto insegue — un numero mostrato e uno
 * vero che non si parlano — perché il posto in cui viene mostrato non lo guarda
 * nessuno di noi.
 */
export function DatiStrutturati() {
  const vendita = METADATI[SITO.vendita];

  const organizzazione = {
    "@type": "Organization",
    name: "Flowlance",
    url: DOMINIO,
    logo: `${DOMINIO}/icon.svg`,
    email: FORNITORE.email,
    founder: { "@type": "Person", name: FORNITORE.nome },
    vatID: `IT${FORNITORE.partitaIva}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Via Trinità 3/2",
      postalCode: "15068",
      addressLocality: "Pozzolo Formigaro",
      addressRegion: "AL",
      addressCountry: "IT",
    },
  };

  const dati = {
    "@context": "https://schema.org",
    "@graph": [
      organizzazione,
      {
        "@type": "SoftwareApplication",
        name: "Flowlance",
        url: DOMINIO,
        description: vendita.descrizione,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        inLanguage: "it-IT",
        publisher: { "@type": "Organization", name: "Flowlance" },
        offers: {
          "@type": "Offer",
          /*
            Il prezzo dichiarato è l'imponibile, e `priceCurrency` è la valuta:
            schema.org vuole il numero senza simbolo e senza separatore di
            migliaia, quindi non passa dai formatter — è l'unico punto del
            progetto in cui un importo si scrive «nudo», e si scrive comunque
            da `PREZZO`, non a mano.
          */
          price: String(PREZZO.imponibile),
          priceCurrency: "EUR",
          url: indirizzoAssoluto(SITO.acquisto),
          availability: "https://schema.org/InStock",
          /*
            `valueAddedTaxIncluded: false` dice che i 97 € sono al netto
            dell'IVA. È la stessa cosa che la pagina d'acquisto dice a parole
            sopra il pulsante di Stripe, ed è per la stessa ragione: il totale
            che si paga è più alto, e scoprirlo dopo sembra un rincaro.
          */
          priceSpecification: {
            "@type": "PriceSpecification",
            price: String(PREZZO.imponibile),
            priceCurrency: "EUR",
            valueAddedTaxIncluded: false,
          },
        },
      },
    ],
  };

  /*
    `dangerouslySetInnerHTML` su un oggetto costruito qui dentro, non su testo
    che arriva da fuori: non c'è niente da sanificare perché non c'è nessun
    ingresso. `JSON.stringify` basta a produrre JSON valido.
  */
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(dati) }}
    />
  );
}
