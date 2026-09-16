"use client";

import * as React from "react";
import Script from "next/script";
import { BannerCookie } from "./banner-cookie";
import { NIENTE, type Consenso } from "@/lib/sito/consenso";
import { MISURAZIONE } from "@/lib/sito/impostazioni";

/**
 * Le statistiche: caricate **solo** dopo un sì, e **solo** qui.
 *
 * Due vincoli, e ciascuno è tenuto da una cosa diversa.
 *
 * **Solo dopo un sì.** Gli `<Script>` stanno dentro un ramo condizionale:
 * finché il consenso è spento non esistono nell'albero, quindi non c'è nessun
 * tag da inserire e nessuna richiesta da fare. Non è «caricare e rispettare la
 * scelta», che è la cosa che fanno quasi tutti e che consenso non è. Si
 * verifica aprendo la rete del browser: prima di rispondere, niente verso
 * google-analytics.com né verso clarity.ms.
 *
 * **Solo qui.** Questo componente è montato dal layout di `(sito)`, che non
 * avvolge `/app`. Un tag di statistica messo nel layout di radice sarebbe
 * finito anche sull'applicazione — e l'applicazione è il posto in cui non deve
 * stare per nessuna ragione, perché lì passano fatture, clienti e importi. È
 * la promessa su cui il prodotto si vende, e non poggia sulla buona volontà di
 * chi scrive il codice: poggia su dove sta questo file nell'albero delle
 * rotte.
 *
 * Le due categorie sono separate davvero: chi accende le statistiche e non le
 * registrazioni ottiene GA4 e non Clarity.
 */
/*
  I codici stanno in `src/lib/sito/impostazioni.ts`, insieme a `CHIUSO_AI_MOTORI`
  e al dominio: sono decisioni sul sito pubblico, non dettagli di questo
  componente. Qui si legge quello che c'è scritto là.
*/
const { ga4: GA4, clarity: CLARITY, metaPixel: META } = MISURAZIONE;

declare global {
  interface Window {
    clarity?: (...argomenti: unknown[]) => void;
  }
}

/**
 * Dice a Clarity che cosa ha acconsentito questa persona.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Non è un doppione del fatto che lo script non parta
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il presidio vero resta quello di sopra: senza un sì il tag non entra
 * nell'albero e non c'è niente da caricare. Ma da quando Clarity è caricato,
 * senza un segnale esplicito si comporta come se avesse **tutto** il consenso
 * — pubblicità compresa. Qui gli si dice quali sono le due caselle, e l'unica
 * che gli si concede è la misurazione.
 *
 * `ad_Storage` è «denied» e basta: non c'è nessun ramo che possa accenderla,
 * perché non esiste un consenso su questo sito che voglia dire «usa Clarity
 * per la pubblicità». Scriverlo come costante e non come variabile è la
 * differenza fra una promessa e un valore che un giorno qualcuno collega alla
 * categoria sbagliata.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché `analytics_Storage` guarda **le statistiche** e non le registrazioni
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Sembra un errore e non lo è. Le due categorie di questo banner sono separate
 * davvero: si può accettare la registrazione della navigazione e rifiutare le
 * statistiche. In quel caso Clarity è caricato — la persona l'ha accettato —
 * ma `analytics_Storage` resta «denied», e Clarity lo rispetta. Legare il
 * segnale alla categoria che lo carica avrebbe fatto dire «granted» sempre,
 * che è lo stesso che non mandarlo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché un effetto e non una riga dentro lo snippet
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Uno `<Script>` con dentro il valore gira **una volta sola**, al montaggio.
 * Chi riapre le preferenze dal piede e spegne le statistiche tenendo le
 * registrazioni lascerebbe Clarity con il consenso di prima, per sempre, e
 * nessuno lo vedrebbe. L'effetto invece riparte a ogni cambio.
 */
function ConsensoClarity({ statistiche }: { statistiche: boolean }) {
  React.useEffect(() => {
    /*
      `window.clarity` esiste già dopo lo snippet — è la funzione che
      accumula in coda — quindi la chiamata non si perde nemmeno se il tag
      non è ancora sceso dalla rete. Se non c'è, non si fa niente e non si
      lancia niente: un segnale di consenso non deve poter rompere la pagina.
    */
    if (typeof window.clarity !== "function") return;
    window.clarity("consentv2", {
      ad_Storage: "denied",
      analytics_Storage: statistiche ? "granted" : "denied",
    });
  }, [statistiche]);

  return null;
}

export function Statistiche() {
  const [consenso, setConsenso] = React.useState<Consenso>(NIENTE);

  return (
    <>
      <BannerCookie onCambia={setConsenso} />

      {consenso.statistiche && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4}`}
            strategy="afterInteractive"
          />
          <Script id="ga4" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA4}', { anonymize_ip: true });
            `}
          </Script>
        </>
      )}

      {/*
        Il pixel di Meta sta qui e non in un componente suo, per la ragione
        scritta in `pixel.ts`: la garanzia che non entri in `/app` è che questo
        file è montato dal guscio di `(sito)`. Un componente a parte con dentro
        un controllo sul percorso sarebbe una seconda definizione di «cosa è
        marketing», accanto a quella che l'albero delle rotte già dà.

        `PageView` lo manda lo script base al caricamento. Non ce n'è un secondo
        sui cambi di rotta: da una pagina del sito all'altra il documento si
        ricarica — misurato, non supposto — quindi lo script riparte da solo.
      */}
      {consenso.pubblicita && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}

      {consenso.registrazioni && (
        <>
          <Script id="clarity" strategy="afterInteractive">
            {`
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${CLARITY}");
            `}
          </Script>
          <ConsensoClarity statistiche={consenso.statistiche} />
        </>
      )}
    </>
  );
}
