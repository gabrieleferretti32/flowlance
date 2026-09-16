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
    clarity?: ((...argomenti: unknown[]) => void) & { q?: unknown[][] };
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
 * Perché `analytics_Storage` segue **le registrazioni**
 * ─────────────────────────────────────────────────────────────────────────
 *
 * È la categoria che carica Clarity, quindi è la categoria con cui questa
 * persona ha autorizzato i suoi cookie — `_clck` e `_clsk`. Legare il
 * segnale a una casella diversa da quella che autorizza il tag vorrebbe dire
 * mandare «denied» a uno strumento che la persona ha acceso, e da fine ottobre
 * 2025, nel SEE, nel Regno Unito e in Svizzera, un Clarity senza «granted»
 * non va in consenso pieno: va in modalità senza consenso — niente cookie, e
 * ogni pagina vista contata come un visitatore nuovo. Il segnale non è una
 * formalità: è quello che fa funzionare la misura che la persona ha accettato.
 *
 * Una nota sulla Cookie Policy, perché la regola l'ha decisa lei. `_clck` e
 * `_clsk` non vi sono nominati — il documento elenca finalità, fornitore e
 * durata, non i nomi dei cookie — e Clarity vi sta sotto «Cookie e strumenti
 * di statistica», che è il titolo della sezione, mentre nel banner sta sotto
 * «Registrazione della navigazione». Le due cose non si contraddicono, perché
 * il documento descrive **a che cosa serve** e il banner **che cosa accendi**.
 * Ma la catena del consenso è una sola, ed è quella del banner: senza quella
 * casella il tag non entra nella pagina.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché un effetto, e perché **fuori** dal ramo che carica il tag
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Uno `<Script>` con dentro il valore gira una volta sola, al montaggio: chi
 * cambia idea dal piede resterebbe con il consenso di prima, per sempre, e
 * nessuno lo vedrebbe. L'effetto riparte a ogni cambio.
 *
 * E sta fuori dal ramo perché **la revoca è il caso che conta**. Spenta la
 * casella, il tag esce dall'albero — ma `window.clarity` è ancora nella
 * pagina di chi non ha ricaricato, e i cookie sono ancora nel browser. Dentro
 * il ramo, questo componente sarebbe sparito insieme al tag, e la revoca non
 * sarebbe arrivata a nessuno: la persona avrebbe visto la casella spegnersi e
 * Clarity avrebbe continuato con il consenso di prima fino al ricarico.
 */
function ConsensoClarity({ registrazioni }: { registrazioni: boolean }) {
  React.useEffect(() => {
    /*
      `window.clarity` esiste già dopo lo snippet — è la funzione che
      accumula in coda — quindi la chiamata non si perde nemmeno se il tag
      non è ancora sceso dalla rete. Se non c'è, non si fa niente e non si
      lancia niente: un segnale di consenso non deve poter rompere la pagina.
    */
    /*
      Con il sì, la coda si crea qui se non c'è ancora.

      È la stessa riga dello snippet ufficiale, per la stessa ragione: fra
      l'effetto di React e l'esecuzione dello `<Script>` non c'è un ordine
      garantito, e un consenso mandato un attimo troppo presto sarebbe un
      consenso perso — in silenzio, perché chiamare una funzione che non c'è
      qui non succede. Quando il tag vero scende, svuota la coda e lo trova.
    */
    if (registrazioni && typeof window.clarity !== "function") {
      const coda = (...argomenti: unknown[]) => {
        coda.q = coda.q ?? [];
        coda.q.push(argomenti);
      };
      coda.q = [] as unknown[][];
      window.clarity = coda;
    }
    if (typeof window.clarity === "function") {
      window.clarity("consentv2", {
        ad_Storage: "denied",
        analytics_Storage: registrazioni ? "granted" : "denied",
      });
    }
    /*
      E i cookie vanno via davvero.

      Dire «denied» a Clarity gli dice di smettere; non gli dice di cancellare
      quello che ha già scritto. Una revoca che lascia `_clck` nel browser è
      una casella spenta con il cookie ancora acceso: dal banner sembra fatta,
      e dal pannello dei cookie del browser no. Qui si tolgono, e non si
      aspetta che lo faccia qualcun altro.
    */
    if (!registrazioni) dimenticaClarity();
  }, [registrazioni]);

  return null;
}

/** I cookie che il tag di Clarity lascia nel browser. */
export const COOKIE_CLARITY = ["_clck", "_clsk"] as const;

/**
 * Cancella i cookie di Clarity, su tutte le forme di dominio che può aver usato.
 *
 * Tre tentativi e non uno: un cookie si cancella solo indicando lo **stesso**
 * dominio e percorso con cui è stato scritto, e da fuori non si sa quale dei
 * tre sia — quello nudo, quello con il punto davanti, o nessuno dei due.
 * Sbagliarne uno lascia il cookie dov'è, in silenzio, e la revoca sembra
 * riuscita.
 */
function dimenticaClarity(): void {
  if (typeof document === "undefined") return;
  const host = window.location.hostname;
  const domini = ["", `; domain=${host}`, `; domain=.${host}`];
  for (const nome of COOKIE_CLARITY) {
    for (const d of domini) {
      document.cookie = `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d}`;
    }
  }
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
          {/*
            L'id **non** è «clarity», e non è un dettaglio.

            Ogni elemento con un `id` diventa una proprietà omonima di
            `window`: con `id="clarity"` il tag `<script>` stesso occupava
            `window.clarity`. Lo snippet ufficiale apre con
            `c[a]=c[a]||function(){…}` — «se non c'è già, crea la coda» — e
            trovava lì l'elemento, che è verissimo, quindi **la coda non
            veniva mai creata**. Misurato: `typeof window.clarity` rispondeva
            «object».

            Il tag scendeva lo stesso e Clarity funzionava, perché una volta
            scaricato si riprende il nome. Ma tutto quello che si accodava
            prima — il consenso, per esempio — finiva su un elemento del DOM
            invece che in una coda, e spariva senza un errore.
          */}
          <Script id="tag-clarity" strategy="afterInteractive">
            {`
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${CLARITY}");
            `}
          </Script>
        </>
      )}

      {/*
        Fuori dal ramo, di proposito: alla revoca il tag non c'è più
        nell'albero, ma `window.clarity` è ancora nella pagina di chi non ha
        ricaricato — ed è l'unico momento in cui gli si può dire di smettere.
        Dentro il ramo, questo componente sparirebbe insieme al tag e la revoca
        non arriverebbe a nessuno.
      */}
      <ConsensoClarity registrazioni={consenso.registrazioni} />
    </>
  );
}
