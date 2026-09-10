import Link from "next/link";
import Image from "next/image";
import { SegnoFlowlance } from "@/components/guscio/marchio";
import { DatiStrutturati } from "@/components/sito/dati-strutturati";
import { PREZZO_SCRITTO } from "@/lib/sito/acquisto";
import { SITO, rottaDemo } from "@/lib/rotte";
import { metadatiDi } from "@/lib/sito/metadati";

export const metadata = metadatiDi(SITO.vendita);

/**
 * La pagina di vendita.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché gli stili stanno qui dentro invece che nei token dell'app
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Questa pagina ha una sua lingua visiva — sezioni scure, tipografia che
 * cresce con la finestra, ombre lunghe — che l'applicazione non ha e non deve
 * avere. È stata disegnata così e si trascrive così: le misure, i `clamp()` e
 * le tinte sono quelle approvate, non una loro reinterpretazione con le classi
 * dell'app. Riscriverla «a occhio» con i token del prodotto avrebbe prodotto
 * una pagina simile e diversa, che è il modo in cui un disegno approvato si
 * perde per strada.
 *
 * Le tinte stanno tutte in `COLORI`, qui sotto, e non sparse nel documento: se
 * un giorno la landing e l'app si uniformano, il posto da cui partire è uno.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Cosa è cambiato rispetto al disegno consegnato
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Tre cose, tutte perché il disegno non poteva saperle:
 *
 * — **I pulsanti portano dove si compra e dove si prova.** «Acquista» va a
 *   `/acquista`, la pagina ponte con i Termini e la dichiarazione, **non** a
 *   Stripe: il punto 1 dei Termini vuole quella dichiarazione prima del
 *   pagamento. «Apri la demo» va all'app con la vetrina già caricata.
 * — **Il piede non è qui.** Lo mette il guscio di `(sito)`, ed è lo stesso di
 *   ogni altra pagina: cinque voci, e le «Preferenze cookie» che sono un
 *   pulsante e non un link. Ricopiarlo qui avrebbe fatto due elenchi che al
 *   primo documento nuovo dicono cose diverse.
 * — **Nessun carattere da Google.** Plus Jakarta Sans è già nel bundle
 *   (`@fontsource-variable`): un `<link>` a `fonts.googleapis.com` sarebbe una
 *   richiesta a terzi su una pagina che dichiara di non farne prima del
 *   consenso.
 */

/** Le tinte della pagina di vendita, in un posto solo. */
const COLORI = {
  fondo: "#f4f6fb",
  fondoAlt: "#eaeefa",
  scuro: "#0d1428",
  scuroAlt: "#18213c",
  bianco: "#ffffff",
  bordo: "#e4e8f2",
  bordoForte: "#d7ddec",
  accento: "#4b5bf0",
  accentoChiaro: "#8f9dff",
  ambra: "#f0a02c",
  testo: "#0d1428",
  testoTenue: "#4d566e",
  testoDebole: "#78819a",
  suScuro: "#c3cade",
} as const;

const OMBRA_GRANDE = "0 24px 60px -30px rgba(13,20,40,0.35)";
const OMBRA_MEDIA = "0 20px 44px -28px rgba(13,20,40,0.3)";

/** Le quattro schermate, rifatte da `strumenti/schermate-vendita.mjs`. */
const SCHERMATE = {
  cruscotto: "/schermate/cruscotto.png",
  fisco: "/schermate/fisco.png",
  scadenziario: "/schermate/scadenziario.png",
  costi: "/schermate/costi.png",
} as const;

const DEMO = rottaDemo("vetrina");
/*
  Il prezzo arriva già scritto da `PREZZO_SCRITTO`: qui non si sceglie il
  formato. Era proprio la scelta a divergere — la testata stampava «97,00 €» e
  la sezione del prezzo «97 €», stesso numero e due formattazioni.
*/
const PREZZO_INTERO = `Acquista — ${PREZZO_SCRITTO.imponibile} + IVA`;

export default function Vendita() {
  return (
    <div style={{ background: COLORI.fondo, color: COLORI.testo }}>
      <DatiStrutturati />
      <Testata />
      <Apertura />
      <IlProblema />
      <CosaFa />
      <PercheEDiverso />
      <IDati />
      <Prezzo />
      <Demo />
      <Domande />
    </div>
  );
}

// ————————————————————————————————————————————————————————————
// Pezzi ricorrenti
// ————————————————————————————————————————————————————————————

/**
 * I due pulsanti che portano fuori dalla pagina.
 *
 * Uno solo per ciascuna destinazione, e non due varianti scritte a mano ogni
 * volta che servono: sono comparsi cinque volte nel disegno, e cinque copie di
 * un indirizzo sono cinque occasioni perché una punti altrove.
 */
function BottoneAcquista({
  scuro = false,
  grande = false,
}: {
  scuro?: boolean;
  grande?: boolean;
}) {
  return (
    <Link
      href={SITO.acquisto}
      className="inline-block rounded-[12px] font-bold transition-colors"
      style={{
        fontSize: grande ? "clamp(17px,2vw,19px)" : "17px",
        padding: grande ? "17px 32px" : "15px 26px",
        background: scuro ? COLORI.accento : COLORI.bianco,
        color: scuro ? COLORI.bianco : COLORI.testo,
        border: scuro ? "none" : `1px solid ${COLORI.bordoForte}`,
      }}
    >
      {PREZZO_INTERO}
    </Link>
  );
}

function BottoneDemo({ compatto = false }: { compatto?: boolean }) {
  return (
    <Link
      href={DEMO}
      className="inline-block rounded-[12px] font-bold text-white transition-colors"
      style={{
        fontSize: "17px",
        padding: compatto ? "16px 30px" : "15px 26px",
        background: COLORI.scuro,
      }}
    >
      Apri la demo
    </Link>
  );
}

function Occhiello({ testo, colore }: { testo: string; colore: string }) {
  return (
    <span
      style={{
        fontSize: "13px",
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: colore,
      }}
    >
      {testo}
    </span>
  );
}

/**
 * Una schermata del prodotto, nel suo riquadro.
 *
 * `min-width` e `overflow-x` sulle tre schermate larghe: sono immagini di
 * tabelle, e rimpicciolite fino alla larghezza di un telefono non si
 * leggerebbero più. Meglio farle scorrere che mostrarne una illeggibile.
 */
function Schermata({
  src,
  alt,
  larga = false,
}: {
  src: string;
  alt: string;
  larga?: boolean;
}) {
  return (
    <div
      style={{
        background: COLORI.bianco,
        border: `1px solid ${COLORI.bordo}`,
        borderRadius: larga ? 20 : 22,
        padding: larga ? "clamp(8px,1.2vw,14px)" : "clamp(10px,1.6vw,16px)",
        boxShadow: larga ? OMBRA_MEDIA : OMBRA_GRANDE,
        ...(larga ? { overflowX: "auto" as const, WebkitOverflowScrolling: "touch" } : {}),
      }}
    >
      <Image
        src={src}
        alt={alt}
        width={2880}
        height={1800}
        priority={!larga}
        style={{
          display: "block",
          width: "100%",
          height: "auto",
          borderRadius: larga ? 12 : 14,
          ...(larga ? { minWidth: 820 } : {}),
        }}
      />
    </div>
  );
}

// ————————————————————————————————————————————————————————————
// Le sezioni
// ————————————————————————————————————————————————————————————

function Testata() {
  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-[10px]"
      style={{ background: "rgba(244,246,251,0.88)", borderBottom: `1px solid ${COLORI.bordo}` }}
    >
      <div
        style={{
          maxWidth: 1140,
          margin: "0 auto",
          padding: "14px clamp(16px,4vw,32px)",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: "auto" }}>
          <SegnoFlowlance className="size-8" />
          <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>Flowlance</span>
        </div>
        <Link
          href={DEMO}
          className="rounded-[10px] font-semibold transition-colors"
          style={{
            fontSize: 15,
            color: COLORI.testo,
            padding: "9px 14px",
            border: `1px solid ${COLORI.bordoForte}`,
            background: COLORI.bianco,
          }}
        >
          Apri la demo
        </Link>
        <Link
          href={SITO.acquisto}
          className="rounded-[10px] font-semibold text-white transition-colors"
          style={{ fontSize: 15, background: COLORI.accento, padding: "10px 16px" }}
        >
          {PREZZO_INTERO}
        </Link>
      </div>
    </header>
  );
}

function Apertura() {
  return (
    <section
      style={{
        maxWidth: 1140,
        margin: "0 auto",
        /*
          Il fondo dei `clamp()` verticali è più basso di quello del disegno:
          48 → 28 in testa, e altrettanto sulle spaziature interne qui sotto.
          Non è un ritocco d'estetica — misurato a 390 × 844, con il banner dei
          cookie aperto, il secondo pulsante dell'eroe cadeva **dietro il
          banner**. Il disegno è quello, e sopra i 640 px non cambia di un
          pixel: quello che cambia è quanto si comprime dove lo schermo è
          corto. Una verifica lo misura a ogni giro, in un browser.
        */
        padding: "clamp(28px,8vw,96px) clamp(16px,4vw,32px) clamp(40px,6vw,72px)",
      }}
    >
      <p
        style={{
          margin: "0 0 clamp(14px,2.4vw,26px)",
          fontSize: "clamp(13px,1.4vw,15px)",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: COLORI.accento,
        }}
      >
        Flowlance · per freelance italiani con partita IVA
      </p>
      <h1
        style={{
          margin: 0,
          fontSize: "clamp(34px,6.2vw,68px)",
          lineHeight: 1.04,
          letterSpacing: "-0.035em",
          fontWeight: 800,
          maxWidth: "16ch",
        }}
      >
        Sul conto hai 30.000 €.
        <br />
        <span style={{ color: COLORI.accento }}>Tuoi ne sono 17.000.</span>
      </h1>
      <p
        style={{
          margin: "clamp(16px,3vw,30px) 0 0",
          fontSize: "clamp(17px,2vw,22px)",
          lineHeight: 1.5,
          color: COLORI.testoTenue,
          maxWidth: "56ch",
        }}
      >
        Flowlance è il conto delle tasse per chi lavora in proprio: ti dice ogni giorno quanto di
        quello che hai incassato è davvero tuo, quanto mettere da parte e quando esce. Perché dentro
        ci sono l&apos;IVA dei tuoi clienti, i contributi e le tasse di giugno.
      </p>
      <p style={{ margin: "16px 0 0", fontSize: 15, color: COLORI.testoDebole, fontStyle: "italic" }}>
        Forfettario e ordinario.
      </p>
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginTop: "clamp(20px,4vw,40px)",
        }}
      >
        <BottoneDemo />
        <BottoneAcquista />
      </div>
      <div style={{ marginTop: "clamp(36px,6vw,64px)" }}>
        <Schermata src={SCHERMATE.cruscotto} alt="Il cruscotto di Flowlance" />
      </div>
    </section>
  );
}

function IlProblema() {
  return (
    <section
      style={{
        background: COLORI.scuro,
        color: COLORI.bianco,
        padding: "clamp(56px,8vw,104px) clamp(16px,4vw,32px)",
      }}
    >
      <div
        style={{
          maxWidth: 1140,
          margin: "0 auto",
          display: "flex",
          gap: "clamp(28px,5vw,72px)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 340px", minWidth: "min(100%,300px)" }}>
          <Occhiello testo="Il momento di giugno" colore={COLORI.ambra} />
          <h2
            style={{
              margin: "18px 0 0",
              fontSize: "clamp(28px,4.4vw,48px)",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              fontWeight: 800,
            }}
          >
            Il problema non è pagare le tasse. È scoprirle.
          </h2>
        </div>
        <div
          style={{
            flex: "1 1 380px",
            minWidth: "min(100%,300px)",
            display: "flex",
            flexDirection: "column",
            gap: 22,
            fontSize: "clamp(16px,1.7vw,19px)",
            lineHeight: 1.6,
            color: COLORI.suScuro,
          }}
        >
          <p style={{ margin: 0 }}>
            A giugno arriva il numero. Se non l&apos;avevi messo da parte, lo paghi comunque — con i
            clienti che cerchi di corsa per coprire il buco, con la rateizzazione che ti porti fino a
            novembre, con le ferie che salti.
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "clamp(20px,2.6vw,28px)",
              lineHeight: 1.35,
              fontWeight: 700,
              color: COLORI.bianco,
              letterSpacing: "-0.02em",
            }}
          >
            Non è che paghi di più. È che paghi con l&apos;estate.
          </p>
          <p style={{ margin: 0 }}>
            Il foglio di calcolo che ti sei fatto aiuta finché non sbagli una formula, e non te ne
            accorgi fino a giugno.
          </p>
        </div>
      </div>
    </section>
  );
}

function CosaFa() {
  const voci = [
    {
      titolo: "Il cruscotto: quanto è tuo.",
      testo:
        "Di quello che hai incassato, quanto se ne va in imposte, quanto in contributi, quanto in IVA che stai solo tenendo per conto dello Stato. E quanto resta a te. Ogni volta che registri una fattura il numero si aggiorna.",
      src: SCHERMATE.cruscotto,
      alt: "Cruscotto: quanto di quello che hai incassato è davvero tuo",
    },
    {
      titolo: "Il prospetto: da dove viene ogni numero.",
      testo:
        "Non un totale da prendere per buono. Ogni riga dice il suo calcolo — il coefficiente ATECO, l'aliquota della tua regione, la detrazione che ti spetta — e si stampa su due fogli che puoi mettere in mano al commercialista.",
      src: SCHERMATE.fisco,
      alt: "Prospetto di imposte e contributi, riga per riga",
    },
    {
      titolo: "Lo scadenzario: quando esce.",
      testo:
        "Il saldo, gli acconti, l'IVA di ogni trimestre, i contributi. Con le date, gli importi e cosa resta da versare dopo ognuno.",
      src: SCHERMATE.scadenziario,
      alt: "Scadenzario: date, importi e cosa resta da versare",
    },
  ];

  return (
    <section
      style={{ maxWidth: 1140, margin: "0 auto", padding: "clamp(56px,8vw,104px) clamp(16px,4vw,32px)" }}
    >
      <Occhiello testo="Cosa fa" colore={COLORI.accento} />
      <h2
        style={{
          margin: "16px 0 clamp(36px,5vw,64px)",
          fontSize: "clamp(28px,4.4vw,48px)",
          lineHeight: 1.1,
          letterSpacing: "-0.03em",
          fontWeight: 800,
          maxWidth: "24ch",
        }}
      >
        Tre schermate, e sai dove sei.
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "clamp(48px,7vw,96px)" }}>
        {voci.map((v) => (
          <div key={v.titolo}>
            <div
              style={{
                display: "flex",
                gap: "clamp(16px,3vw,48px)",
                flexWrap: "wrap",
                alignItems: "baseline",
                marginBottom: "clamp(20px,2.6vw,30px)",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  flex: "1 1 280px",
                  fontSize: "clamp(22px,2.8vw,32px)",
                  lineHeight: 1.2,
                  letterSpacing: "-0.02em",
                  fontWeight: 700,
                }}
              >
                {v.titolo}
              </h3>
              <p
                style={{
                  margin: 0,
                  flex: "1 1 380px",
                  fontSize: "clamp(16px,1.7vw,18px)",
                  lineHeight: 1.6,
                  color: COLORI.testoTenue,
                }}
              >
                {v.testo}
              </p>
            </div>
            <Schermata src={v.src} alt={v.alt} larga />
          </div>
        ))}
      </div>
    </section>
  );
}

function PercheEDiverso() {
  const carte = [
    ["Il gestionale ti dice cosa hai fatturato.", "Non quanto di quei soldi è tuo."],
    [
      "Il commercialista te lo dice a giugno.",
      "Ed è il suo mestiere, non il suo difetto: lui chiude l'anno, non ti accompagna durante.",
    ],
    ["Il foglio di calcolo lo hai fatto tu.", "E le formule le hai scritte tu."],
  ];

  return (
    <section
      style={{ background: COLORI.fondoAlt, padding: "clamp(56px,8vw,104px) clamp(16px,4vw,32px)" }}
    >
      <div style={{ maxWidth: 1140, margin: "0 auto" }}>
        <Occhiello testo="Perché è diverso" colore={COLORI.accento} />
        <h2
          style={{
            margin: "16px 0 20px",
            fontSize: "clamp(28px,4.4vw,48px)",
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            fontWeight: 800,
            maxWidth: "24ch",
          }}
        >
          Continui a fatturare dove fatturi.
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "clamp(16px,1.8vw,19px)",
            lineHeight: 1.6,
            color: COLORI.testoTenue,
            maxWidth: "62ch",
          }}
        >
          Flowlance non è un programma di fatturazione e non ti chiede di cambiarne uno. Esporti il
          CSV da Fatture in Cloud o da dove emetti le fatture, lo importi qui, e hai i numeri che lì
          non ci sono.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            gap: 16,
            marginTop: "clamp(32px,4vw,48px)",
          }}
        >
          {carte.map(([titolo, sotto]) => (
            <div
              key={titolo}
              style={{ background: COLORI.bianco, borderRadius: 18, padding: "clamp(22px,2.4vw,30px)" }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 19,
                  lineHeight: 1.35,
                  fontWeight: 700,
                  letterSpacing: "-0.015em",
                }}
              >
                {titolo}
              </p>
              <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.6, color: "#5b6480" }}>
                {sotto}
              </p>
            </div>
          ))}
        </div>

        <p
          style={{
            margin: "clamp(32px,4vw,48px) 0 0",
            fontSize: "clamp(20px,2.8vw,30px)",
            lineHeight: 1.3,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            maxWidth: "30ch",
          }}
        >
          Fai il tuo lavoro. Al pianificatore fiscale ci pensa Flowlance.
        </p>
      </div>
    </section>
  );
}

function IDati() {
  return (
    <section
      style={{ maxWidth: 1140, margin: "0 auto", padding: "clamp(56px,8vw,104px) clamp(16px,4vw,32px)" }}
    >
      <div
        style={{
          background: COLORI.bianco,
          border: `1px solid ${COLORI.bordo}`,
          borderRadius: 24,
          padding: "clamp(26px,4vw,64px)",
          display: "flex",
          gap: "clamp(28px,5vw,64px)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "1 1 340px", minWidth: "min(100%,280px)" }}>
          <Occhiello testo="I dati" colore={COLORI.ambra} />
          <h2
            style={{
              margin: "16px 0 0",
              fontSize: "clamp(26px,4vw,44px)",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              fontWeight: 800,
            }}
          >
            Le tue fatture non passano da nessuna parte.
          </h2>
          <p
            style={{
              margin: "24px 0 0",
              fontSize: "clamp(17px,2vw,20px)",
              lineHeight: 1.55,
              color: COLORI.testo,
              fontWeight: 600,
            }}
          >
            Flowlance funziona dentro il tuo browser. Non c&apos;è un server dove finiscono i tuoi
            dati, non c&apos;è un account da creare, e non li vediamo nemmeno noi.
          </p>
        </div>
        <div
          style={{
            flex: "1 1 340px",
            minWidth: "min(100%,280px)",
            display: "flex",
            flexDirection: "column",
            gap: 20,
            justifyContent: "center",
          }}
        >
          <div style={{ background: COLORI.fondo, borderRadius: 16, padding: "clamp(20px,2.2vw,26px)" }}>
            <p
              style={{
                margin: 0,
                fontSize: "clamp(17px,1.9vw,20px)",
                lineHeight: 1.35,
                fontWeight: 700,
                letterSpacing: "-0.015em",
              }}
            >
              In cambio, il backup lo fai tu.
            </p>
            <p
              style={{
                margin: "12px 0 0",
                fontSize: "clamp(16px,1.7vw,18px)",
                lineHeight: 1.6,
                color: COLORI.testoTenue,
              }}
            >
              I dati stanno sul computer che usi. Per portarli altrove — o per ritrovarli se cambi
              macchina — scarichi un file, quando vuoi. L&apos;app ti ricorda di farlo.
            </p>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "clamp(19px,2.4vw,26px)",
              lineHeight: 1.3,
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            È tuo, come le fatture da cui è nato.
          </p>
        </div>
      </div>
    </section>
  );
}

function Prezzo() {
  return (
    <section
      id="prezzo"
      style={{
        background: COLORI.scuro,
        color: COLORI.bianco,
        padding: "clamp(56px,8vw,104px) clamp(16px,4vw,32px)",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
        <Occhiello testo="Prezzo" colore={COLORI.accentoChiaro} />
        <h2
          style={{
            margin: "18px 0 0",
            fontSize: "clamp(44px,9vw,92px)",
            lineHeight: 1,
            letterSpacing: "-0.04em",
            fontWeight: 800,
          }}
        >
          {PREZZO_SCRITTO.imponibile} all&apos;anno
        </h2>
        {/*
          Il prezzo arriva da `PREZZO_SCRITTO`, lo stesso da cui lo prende la
          pagina d'acquisto, e una tagliola verifica che i tre numeri stiano
          anche nel punto 6 dei Termini. Una landing che dice una cifra e un
          contratto che ne dice un'altra è il difetto peggiore che questa
          pagina possa avere.
        */}
        <p
          style={{
            margin: "14px 0 0",
            fontSize: "clamp(16px,1.8vw,19px)",
            fontWeight: 600,
            color: COLORI.accentoChiaro,
          }}
        >
          + IVA {PREZZO_SCRITTO.aliquota} · {PREZZO_SCRITTO.totale} totali
        </p>
        <p
          style={{
            margin: "24px auto 0",
            fontSize: "clamp(16px,1.8vw,19px)",
            lineHeight: 1.6,
            color: COLORI.suScuro,
            maxWidth: "56ch",
          }}
        >
          Non c&apos;è un piano base e uno avanzato: c&apos;è Flowlance, tutto. Forfettario e
          ordinario, IVA, scadenzario, prospetto stampabile, import dai gestionali.
        </p>
        <div
          style={{
            margin: "clamp(28px,4vw,40px) auto 0",
            maxWidth: 600,
            background: COLORI.scuroAlt,
            borderRadius: 18,
            padding: 24,
          }}
        >
          <p style={{ margin: 0, fontSize: "clamp(17px,2vw,20px)", lineHeight: 1.45, fontWeight: 700 }}>
            Se entro 30 giorni non fa per te, ti restituiamo i soldi.
          </p>
          <p style={{ margin: "10px 0 0", fontSize: 16, lineHeight: 1.55, color: COLORI.suScuro }}>
            Scrivi una mail, senza spiegare perché.
          </p>
        </div>
        <div style={{ marginTop: "clamp(28px,4vw,40px)" }}>
          <Link
            href={SITO.acquisto}
            className="inline-block rounded-[12px] font-bold text-white transition-colors"
            style={{
              fontSize: "clamp(17px,2vw,19px)",
              background: COLORI.accento,
              padding: "17px 32px",
            }}
          >
            Acquista Flowlance — {PREZZO_SCRITTO.imponibile} + IVA
          </Link>
        </div>
        <p style={{ margin: "20px 0 0", fontSize: 15, color: "#8b95b0", fontStyle: "italic" }}>
          Rinnovo alla data di acquisto, non a dicembre. Disdici quando vuoi. Fattura emessa a ogni
          acquisto.
        </p>
      </div>
    </section>
  );
}

function Demo() {
  return (
    <section
      id="demo"
      style={{ maxWidth: 1140, margin: "0 auto", padding: "clamp(56px,8vw,104px) clamp(16px,4vw,32px)" }}
    >
      <div
        style={{
          display: "flex",
          gap: "clamp(24px,4vw,56px)",
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div style={{ flex: "1 1 340px", minWidth: "min(100%,280px)" }}>
          <Occhiello testo="La demo" colore={COLORI.accento} />
          <h2
            style={{
              margin: "16px 0 0",
              fontSize: "clamp(28px,4.4vw,48px)",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              fontWeight: 800,
            }}
          >
            Aprilo prima di comprarlo.
          </h2>
          <p
            style={{
              margin: "20px 0 0",
              fontSize: "clamp(16px,1.8vw,19px)",
              lineHeight: 1.6,
              color: COLORI.testoTenue,
              maxWidth: "52ch",
            }}
          >
            Qui sotto c&apos;è Flowlance vero, con i dati di una consulente inventata: un anno e
            mezzo di fatture, costi, F24 e scadenze già dentro. Guarda il cruscotto, apri il
            prospetto, stampa il PDF.
          </p>
          <p style={{ margin: "16px 0 0", fontSize: "clamp(17px,2vw,20px)", lineHeight: 1.45, fontWeight: 700 }}>
            Non ti chiediamo niente per entrare.
          </p>
        </div>
        <div>
          <BottoneDemo compatto />
        </div>
      </div>
      <div style={{ marginTop: "clamp(28px,4vw,44px)" }}>
        <Schermata src={SCHERMATE.costi} alt="Registro dei costi nella demo di Flowlance" />
      </div>
    </section>
  );
}

function Domande() {
  const domande: [string, string][] = [
    [
      "Sostituisce il commercialista?",
      "No, e non ci prova. Il commercialista fa la dichiarazione e risponde dei numeri; Flowlance ti fa sapere durante l'anno dove sei. Il prospetto stampato è fatto apposta per essere letto da lui.",
    ],
    [
      "Devo cambiare programma di fatturazione?",
      "No. Continui a emettere dove emetti. Esporti il CSV e lo importi qui.",
    ],
    [
      "Se cambio computer?",
      "Esporti l'archivio e lo importi sul computer nuovo. È un file, ci mette pochi secondi.",
    ],
    [
      "E se svuoto la cronologia del browser senza aver fatto un backup?",
      "I dati non ci sono più. Per questo l'app ti avvisa quando l'ultimo backup è vecchio: è il gesto che ti conviene prendere l'abitudine di fare.",
    ],
    [
      "Forfettario o ordinario?",
      "Entrambi, e puoi confrontarli: Flowlance calcola quanto pagheresti nell'altro regime con i tuoi numeri.",
    ],
    [
      "Che previdenza gestisce?",
      "Gestione Separata INPS, artigiani e commercianti, e le casse professionali con l'aliquota che dichiari tu. Ogni cassa ha regole proprie: quelle non le conosce.",
    ],
    [
      "I numeri sono quelli veri?",
      "Sono una stima gestionale fatta bene: ogni riga dice il suo calcolo e le fonti sono citate in fondo al prospetto. Non è una dichiarazione dei redditi, e c'è un elenco pubblico di quello che l'app non calcola.",
    ],
    [
      "E se ho anche redditi diversi dalla partita IVA?",
      "Flowlance è solo per la fiscalità italiana, e vede solo i redditi dell'attività. Se hai anche un lavoro dipendente o altri redditi, lo scaglione IRPEF vero può essere più alto di quello che calcola.",
    ],
  ];

  return (
    <section
      style={{ background: COLORI.fondoAlt, padding: "clamp(56px,8vw,104px) clamp(16px,4vw,32px)" }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <Occhiello testo="Domande" colore={COLORI.accento} />
        <h2
          style={{
            margin: "16px 0 clamp(28px,4vw,44px)",
            fontSize: "clamp(28px,4.4vw,44px)",
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            fontWeight: 800,
          }}
        >
          Quello che ci chiedono prima di comprare.
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {domande.map(([domanda, risposta]) => (
            /*
              `<details>` e non un accordion scritto a mano: si apre senza
              JavaScript, il testo è nel documento anche da chiuso — quindi
              cercabile con ⌘F e leggibile da un lettore di schermo — e la
              tastiera lo comanda da sola. Il «+» che diventa «×» ruota con
              `group-open`, che è una regola CSS, non uno stato da tenere.
            */
            <details
              key={domanda}
              className="group"
              style={{ background: COLORI.bianco, borderRadius: 16, padding: "clamp(18px,2vw,24px)" }}
            >
              <summary
                className="flex cursor-pointer list-none items-start gap-4 [&::-webkit-details-marker]:hidden"
                style={{
                  fontSize: "clamp(17px,1.9vw,20px)",
                  fontWeight: 700,
                  lineHeight: 1.35,
                  letterSpacing: "-0.015em",
                }}
              >
                <span style={{ flex: 1 }}>{domanda}</span>
                <span
                  className="shrink-0 text-center transition-transform group-open:rotate-45"
                  style={{ width: 22, height: 22, color: COLORI.accento, fontSize: 20, lineHeight: "22px" }}
                  aria-hidden
                >
                  +
                </span>
              </summary>
              <p style={{ margin: "14px 0 0", fontSize: 16, lineHeight: 1.6, color: COLORI.testoTenue }}>
                {risposta}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
