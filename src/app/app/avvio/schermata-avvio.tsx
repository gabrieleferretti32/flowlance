"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronDown, Flag, Info, RotateCcw, SkipForward, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardCorpo, CardInterna, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Chip } from "@/components/ui/chip";
import { Segmenti } from "@/components/ui/segmenti";
import { Guscio } from "@/components/guscio/guscio";
import { AvvisoParametri } from "@/components/fisco/avviso-parametri";
import {
  aggiornaImpostazioni,
  caricaDataset,
  completaPercorso,
  ripartiPercorso,
  segnaPasso,
} from "@/lib/dati/azioni";
import { useCalcoloAnno, usePercorso, useSituazione } from "@/lib/dati/hooks";
import {
  avanzamento,
  contestoSuggerito,
  passiDi,
  statoDelPasso,
  durataStimata,
  CONTESTI,
  DESCRIZIONE_CONTESTO,
  PASSI,
  META_CONTESTO,
  NOME_CONTESTO,
  type ContestoCalcolo,
  type ContestoPercorso,
  type Passo,
  type StatoPercorso,
} from "@/lib/onboarding/percorso";
import { usePreferenze } from "@/lib/stato/preferenze";
import { cn } from "@/lib/utils";
import {
  ConfrontoDeiRegimi,
  ControlloPasso,
  PartenzaConDati,
  RiportiDaConfermare,
  riepilogoImpostazioni,
  vociRiporto,
} from "./passi";

/** Le conferme delle singole voci di riporto stanno nello stesso record del percorso. */
const PREFISSO_RIPORTO = "riporti:";

export function SchermataAvvio() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const calcolo = useCalcoloAnno(anno, oggi);
  const precedente = useCalcoloAnno(anno - 1, oggi);
  const situazione = useSituazione(anno, oggi);

  const [scelto, setScelto] = React.useState<ContestoPercorso | null>(null);
  const suggerimento = situazione
    ? contestoSuggerito(situazione)
    : { contesto: null, motivo: "" };
  const contesto: ContestoPercorso = scelto ?? suggerimento.contesto ?? "primoAvvio";

  const percorso = usePercorso(contesto, anno);
  const [apertoManualmente, setApertoManualmente] = React.useState<string | null>(null);

  /*
    Chi arriva da «?passo=regime» ha toccato il regime in testata: la domanda
    che cercava dev'essere già aperta, non da trovare in mezzo alle altre. La
    query si legge a mano invece che con `useSearchParams`: è un riempimento
    iniziale, non una navigazione, e così la pagina resta generabile
    staticamente senza confini di Suspense.
  */
  React.useEffect(() => {
    const richiesto = new URLSearchParams(window.location.search).get("passo");
    if (!richiesto || !PASSI.some((p) => p.id === richiesto)) return;
    setApertoManualmente(richiesto);
    // Il passo può stare sotto il bordo dello schermo, specie sul telefono.
    const t = window.setTimeout(() => {
      document
        .getElementById(`passo-${richiesto}`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
    return () => window.clearTimeout(t);
  }, []);

  if (!calcolo || !situazione || percorso === undefined) {
    return (
      <Guscio titolo="Configurazione">
        <Card>
          <CaricamentoTabella righe={5} />
        </Card>
      </Guscio>
    );
  }

  const contestoCalcolo: ContestoCalcolo = {
    impostazioni: calcolo.impostazioni,
    parametri: calcolo.parametri,
    prospetto: calcolo.prospetto,
  };
  const contestoPrecedente: ContestoCalcolo | null = precedente
    ? {
        impostazioni: precedente.impostazioni,
        parametri: precedente.parametri,
        prospetto: precedente.prospetto,
      }
    : null;
  const passi = passiDi(contesto, contestoCalcolo);
  const stato = avanzamento(passi, percorso);
  const aperto = apertoManualmente ?? stato.prossimo?.id ?? null;

  const vociDaConfermare = vociRiporto(calcolo.riportoInIngresso);
  const riportiConfermati = (percorso?.confermati ?? []).filter((c) =>
    c.startsWith(PREFISSO_RIPORTO),
  ).length;

  /**
   * «Confermali uno per uno» significa che il pulsante non passa finché non
   * sono passati tutti. Saltare resta possibile — è un percorso, non un modulo
   * obbligatorio — ma dire «ho letto» dopo aver guardato due righe su sei non
   * è quello che il passo chiede.
   */
  function attesaDelPasso(passo: Passo): string | null {
    if (passo.id !== "riporti") return null;
    const mancanti = vociDaConfermare.length - riportiConfermati;
    if (mancanti <= 0) return null;
    return `${riportiConfermati} di ${vociDaConfermare.length} voci confermate: guardale tutte, o salta il passo.`;
  }

  async function rispondi(passo: string, esito: "confermato" | "saltato") {
    await segnaPasso(contesto, anno, passo, esito);
    // Il prossimo passo si apre da solo: chi risponde non deve anche cliccare.
    setApertoManualmente(null);
  }

  return (
    <Guscio
      titolo="Configurazione"
      descrizione={`${NOME_CONTESTO[contesto]} · anno ${anno} · ${stato.confermati} su ${stato.totale} confermati`}
    >
      <div className="mx-auto max-w-3xl space-y-4">
        <AvvisoParametri anno={anno} />

        <Card>
          <CardCorpo>
            <CardTitolo>{NOME_CONTESTO[contesto]}</CardTitolo>
            <CardSottotitolo>{DESCRIZIONE_CONTESTO[contesto]}</CardSottotitolo>

            {/*
              Dove si va a parare, prima delle domande. Senza questa frase le
              otto caselle arrivano tutte insieme e si compilano a vuoto: è la
              differenza fra un percorso e un modulo da ufficio.
            */}
            <CardInterna className="mt-3 flex items-start gap-3 p-3">
              <Flag className="mt-0.5 size-4 shrink-0 text-accento" aria-hidden />
              <p className="min-w-0 text-etichetta">
                {META_CONTESTO[contesto]}{" "}
                <span className="text-inchiostro-tenue">
                  {stato.totale} passi, {durataStimata(passi)}. Si può saltare tutto e tornarci
                  dopo.
                </span>
              </p>
            </CardInterna>

            {/*
              Il motivo spiega perché l'app propone questo percorso: mostrarlo
              su un percorso scelto a mano parlerebbe di una schermata diversa
              da quella che si ha davanti. Quando invece non c'è niente in
              sospeso, la frase vale su qualsiasi scheda e va detta comunque.
            */}
            {(suggerimento.contesto === contesto || suggerimento.contesto === null) &&
              suggerimento.motivo && (
              <p className="mt-3 flex items-start gap-2 text-etichetta text-inchiostro-tenue">
                <Info className="mt-0.5 size-3.5 shrink-0 text-accento" aria-hidden />
                {suggerimento.motivo}
              </p>
              )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Segmenti
                etichettaGruppo="Percorso"
                valore={contesto}
                onChange={(v) => {
                  setScelto(v);
                  setApertoManualmente(null);
                }}
                opzioni={CONTESTI.map((c) => ({ valore: c, etichetta: NOME_CONTESTO[c] }))}
              />
              {percorso?.completatoIl && (
                <Button scrive variante="quieto" onClick={() => void ripartiPercorso(contesto, anno)}>
                  <RotateCcw className="size-4" aria-hidden />
                  Ricomincia
                </Button>
              )}
            </div>

            <Avanzamento
              totale={stato.totale}
              confermati={stato.confermati}
              saltati={stato.saltati}
            />
          </CardCorpo>
        </Card>

        {passi.map((passo, indice) => (
          <SchedaPasso
            key={passo.id}
            passo={passo}
            indice={indice + 1}
            totale={passi.length}
            stato={statoDelPasso(percorso, passo.id)}
            aperto={aperto === passo.id}
            onApri={() => setApertoManualmente(aperto === passo.id ? null : passo.id)}
            calcolo={contestoCalcolo}
            attesa={attesaDelPasso(passo)}
            onRispondi={rispondi}
          >
            <CorpoPasso
              passo={passo}
              calcolo={contestoCalcolo}
              precedente={contestoPrecedente}
              anno={anno}
              archivioVuoto={situazione.archivioVuoto}
              confermeRiporti={(percorso?.confermati ?? [])
                .filter((c) => c.startsWith(PREFISSO_RIPORTO))
                .map((c) => c.slice(PREFISSO_RIPORTO.length))}
              onConfermaRiporto={(voce) => {
                const chiave = `${PREFISSO_RIPORTO}${voce}`;
                const gia = percorso?.confermati.includes(chiave) ?? false;
                void segnaPasso(contesto, anno, chiave, gia ? "saltato" : "confermato");
              }}
              riporto={calcolo.riportoInIngresso}
            />
          </SchedaPasso>
        ))}

        <Riepilogo
          calcolo={contestoCalcolo}
          percorso={percorso}
          contesto={contesto}
          anno={anno}
          completo={stato.completo}
          applicabili={passi.map((p) => p.id)}
        />
      </div>
    </Guscio>
  );
}

function Avanzamento({
  totale,
  confermati,
  saltati,
}: {
  totale: number;
  confermati: number;
  saltati: number;
}) {
  const fatti = confermati + saltati;
  return (
    <div className="mt-4">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-superficie-alt">
        {Array.from({ length: totale }, (_, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 transition-colors",
              i < confermati
                ? "bg-accento"
                : i < fatti
                  ? "bg-bordo"
                  : "bg-transparent",
            )}
          />
        ))}
      </div>
      <p className="mt-2 text-etichetta text-inchiostro-tenue">
        {confermati} confermati · {saltati} saltati · {totale - fatti} da vedere. Puoi
        chiudere e riprendere quando vuoi: l&apos;avanzamento resta salvato.
      </p>
    </div>
  );
}

function SchedaPasso({
  passo,
  indice,
  totale,
  stato,
  aperto,
  onApri,
  calcolo,
  attesa,
  onRispondi,
  children,
}: {
  passo: Passo;
  indice: number;
  totale: number;
  stato: "daFare" | "confermato" | "saltato";
  aperto: boolean;
  onApri: () => void;
  calcolo: ContestoCalcolo;
  /** Perché non si può ancora confermare. `null` quando si può. */
  attesa: string | null;
  onRispondi: (passo: string, esito: "confermato" | "saltato") => void;
  children: React.ReactNode;
}) {
  const effetto = passo.effetto?.(calcolo) ?? null;

  return (
    <Card id={`passo-${passo.id}`}>
      <button
        type="button"
        onClick={onApri}
        aria-expanded={aperto}
        className="flex w-full items-start gap-3 px-4 py-4 text-left sm:px-5"
      >
        <span
          className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-micro font-semibold",
            stato === "confermato"
              ? "bg-[#0B8A63] text-white"
              : stato === "saltato"
                ? "bg-superficie-alt text-inchiostro-tenue"
                : "bg-accento-tenue text-accento",
          )}
        >
          {stato === "confermato" ? <Check className="size-3.5" aria-hidden /> : indice}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-corpo font-semibold">{passo.titolo}</span>
            {stato === "saltato" && <Chip tono="neutro">saltato · resta il predefinito</Chip>}
          </span>
          <span className="mt-0.5 block text-etichetta text-inchiostro-tenue">
            {passo.domanda}
          </span>
          {/*
            Quello che si è appena sbloccato, e resta lì: scorrendo il percorso
            si vede cosa l'app ha imparato, invece di una fila di spunte.
          */}
          {stato === "confermato" && (
            <span className="mt-1 flex items-start gap-1.5 text-etichetta text-[#0B8A63]">
              <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {passo.sblocca}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "mt-1 size-4 shrink-0 text-inchiostro-tenue transition-transform",
            aperto && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {aperto && (
        <div className="border-t border-bordo px-4 py-4 sm:px-5">
          <p className="text-corpo text-inchiostro-tenue">{passo.perche}</p>

          {effetto && (
            <CardInterna className="mt-3 p-3">
              <p className="text-etichetta">
                <span className="font-semibold">Sui tuoi numeri: </span>
                {effetto}
              </p>
            </CardInterna>
          )}

          <div className="mt-4">{children}</div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-bordo pt-4">
            <Button
              scrive
              disabled={attesa !== null}
              onClick={() => onRispondi(passo.id, "confermato")}
            >
              {passo.soloLettura ? "Ho letto, vai avanti" : "Conferma e continua"}
            </Button>
            <Button scrive variante="quieto" onClick={() => onRispondi(passo.id, "saltato")}>
              <SkipForward className="size-4" aria-hidden />
              Salta
            </Button>
            <span className="text-etichetta text-inchiostro-tenue">
              {attesa ?? `Se salti: ${passo.seSalti(calcolo)}`}
            </span>
            <span className="ml-auto text-micro text-inchiostro-tenue">
              {indice} di {totale}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

function CorpoPasso({
  passo,
  calcolo,
  precedente,
  anno,
  archivioVuoto,
  riporto,
  confermeRiporti,
  onConfermaRiporto,
}: {
  passo: Passo;
  calcolo: ContestoCalcolo;
  precedente: ContestoCalcolo | null;
  anno: number;
  archivioVuoto: boolean;
  riporto: React.ComponentProps<typeof RiportiDaConfermare>["riporto"];
  confermeRiporti: string[];
  onConfermaRiporto: (voce: string) => void;
}) {
  if (passo.id === "riporti") {
    return (
      <RiportiDaConfermare
        riporto={riporto}
        confermati={confermeRiporti}
        onConferma={onConfermaRiporto}
      />
    );
  }
  if (passo.id === "confronto") {
    return <ConfrontoDeiRegimi calcolo={calcolo} precedente={precedente} />;
  }
  if (passo.id === "partenza") {
    return <PartenzaConDati archivioVuoto={archivioVuoto} onDemo={(id) => void caricaDataset(id)} />;
  }

  return (
    <ControlloPasso
      passo={passo.id}
      calcolo={calcolo}
      onModifica={(modifiche) => void aggiornaImpostazioni(anno, modifiche)}
    />
  );
}

/**
 * Il riepilogo finale.
 *
 * La colonna «da dove viene» è il punto: un valore mai toccato e uno scelto
 * sono lo stesso numero a schermo, ma il primo è una decisione dell'app e va
 * dichiarata come tale. Un default nascosto è il modo più educato di far
 * sbagliare qualcuno.
 */
function Riepilogo({
  calcolo,
  percorso,
  contesto,
  anno,
  completo,
  applicabili,
}: {
  calcolo: ContestoCalcolo;
  percorso: StatoPercorso | null;
  contesto: ContestoPercorso;
  anno: number;
  completo: boolean;
  /** I passi che il regime attuale rende pertinenti: gli altri non si applicano. */
  applicabili: string[];
}) {
  const righe = riepilogoImpostazioni(calcolo.impostazioni, calcolo.parametri);

  return (
    <Card>
      <CardCorpo>
        <CardTitolo>Come sei configurato adesso</CardTitolo>
        <CardSottotitolo>
          Quello che hai scelto e quello che è rimasto al valore predefinito. Nessun valore è
          nascosto: se non l&apos;hai deciso tu, qui c&apos;è scritto.
        </CardSottotitolo>

        <div className="mt-4 space-y-1">
          {righe.map((r) => {
            // «Predefinito» su una voce che nel regime attuale non esiste
            // sarebbe una bugia: la liquidazione IVA non ha un default in
            // forfettario, semplicemente non si applica.
            const pertinente = applicabili.includes(r.passo);
            // Un campo lasciato vuoto non è «scelto da te» nemmeno se il passo
            // è stato confermato: è rimasto vuoto, e va detto così.
            const stato = r.nonDichiarato
              ? "nonDichiarato"
              : pertinente
                ? statoDelPasso(percorso, r.passo)
                : "nonApplicabile";
            return (
              <div
                key={r.voce}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-bordo py-2.5 last:border-0"
              >
                <span className="min-w-0 flex-1 text-corpo">{r.voce}</span>
                <span className="cifre text-corpo font-medium tabular-nums">{r.valore}</span>
                <span
                  className={cn(
                    "w-32 shrink-0 text-right text-micro",
                    stato === "confermato"
                      ? "text-[#0B8A63]"
                      : stato === "nonDichiarato"
                        ? "text-[#B8791A]"
                        : "text-inchiostro-tenue",
                  )}
                >
                  {stato === "confermato"
                    ? "scelto da te"
                    : stato === "nonApplicabile"
                      ? "non si applica"
                      : stato === "nonDichiarato"
                        ? "da compilare"
                        : "predefinito"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-bordo pt-4">
          <Button scrive
            onClick={() => void completaPercorso(contesto, anno)}
            disabled={percorso?.completatoIl != null}
          >
            {percorso?.completatoIl ? "Percorso completato" : "Ho finito"}
          </Button>
          <Button variante="quieto" asChild>
            <Link href="/">Vai al cruscotto</Link>
          </Button>
          {!completo && (
            <p className="text-etichetta text-inchiostro-tenue">
              Puoi chiudere qui: i passi che restano ti aspettano dove li hai lasciati.
            </p>
          )}
        </div>
      </CardCorpo>
    </Card>
  );
}
