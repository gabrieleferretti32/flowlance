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
const { ga4: GA4, clarity: CLARITY } = MISURAZIONE;

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

      {consenso.registrazioni && (
        <Script id="clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${CLARITY}");
          `}
        </Script>
      )}
    </>
  );
}
