"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, Target } from "lucide-react";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Campo, Input } from "@/components/ui/input";
import { Kpi } from "@/components/ui/kpi";
import { Guscio } from "@/components/guscio/guscio";
import { calcolaPareggio, calcolaPianificazione, costiRegistrati } from "@/lib/analisi/pianificazione";
import { round2 } from "@/lib/fisco/aritmetica";
import { campiDaDichiarare } from "@/lib/fisco/parametri-utente";
import { useCalcoloAnno } from "@/lib/dati/hooks";
import { oreFatturabiliAnno } from "@/lib/fisco/impostazioni";
import { usePreferenze } from "@/lib/stato/preferenze";
import { analizzaNumero, analizzaPercentuale, euro, num, perCampo, percentuale } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SchermataPianificazione() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const calcolo = useCalcoloAnno(anno, oggi);

  const [campi, setCampi] = React.useState<{
    netto: number | null; costi: number | null; pressione: number; ticket: number;
    chiusura: number; conversione: number; tariffa: number | null; costiFissi: number | null;
    /** Quali valori vengono dallo storico e quali sono stime di partenza. */
    daStorico: { pressione: boolean; ticket: boolean };
  } | null>(null);

  React.useEffect(() => {
    if (!calcolo || campi) return;
    const imp = calcolo.impostazioni;
    const p = calcolo.prospetto;
    const fatture = p.fattureCalcolate.filter((f) => f.dataEmissione.startsWith(String(anno)));
    const clientiServiti = new Set(fatture.map((f) => f.clienteId)).size;
    const ticket = clientiServiti > 0
      ? Math.round(fatture.reduce((a, f) => a + f.imponibile, 0) / clientiServiti)
      : 3000;
    setCampi({
      // Netto, costi e tariffa restano vuoti finché non li dichiara qualcuno:
      // sono i tre numeri che l'app non può indovinare, e indovinarli
      // significherebbe costruirci sopra un piano che sembra il tuo e non lo è.
      netto: imp.nettoDesiderato,
      costi: imp.costiFissiAnnui,
      // Se c'è già uno storico si parte dalla pressione vera, non da una stima.
      pressione: p.pressione > 0 ? Math.round(p.pressione * 1000) / 1000 : 0.35,
      ticket,
      chiusura: 0.25,
      conversione: 0.3,
      tariffa: imp.tariffaOraria,
      costiFissi: imp.costiFissiAnnui,
      daStorico: { pressione: p.pressione > 0, ticket: clientiServiti > 0 },
    });
  }, [calcolo, campi, anno]);

  if (!calcolo || !campi) {
    return (
      <Guscio titolo="Pianificazione">
        <Card>
          <CaricamentoTabella righe={5} />
        </Card>
      </Guscio>
    );
  }

  const imp = calcolo.impostazioni;
  const ore = oreFatturabiliAnno(imp);
  const { netto, costi, tariffa, costiFissi } = campi;
  // Senza il netto voluto e i costi previsti non c'è nessun piano da fare: le
  // schermate che ne dipendono dicono cosa manca invece di riempire il buco.
  const piano =
    netto !== null && costi !== null
      ? calcolaPianificazione({
          nettoDesiderato: netto,
          costiPrevisti: costi,
          pressione: campi.pressione,
          ticketMedio: campi.ticket,
          tassoChiusura: campi.chiusura,
          tassoConversione: campi.conversione,
          oreFatturabiliAnno: ore,
          oreFatturabiliGiorno: imp.oreFatturabiliGiorno,
          tariffaOraria: tariffa ?? 0,
          costiFissiAnnui: costiFissi ?? 0,
        })
      : null;
  // Il pareggio non ha bisogno di un obiettivo: bastano i costi fissi.
  const pareggio =
    costiFissi !== null
      ? calcolaPareggio({
          costiFissiAnnui: costiFissi,
          pressione: campi.pressione,
          tariffaOraria: tariffa,
          oreFatturabiliGiorno: imp.oreFatturabiliGiorno,
        })
      : null;
  const capacitaDaDichiarare = campiDaDichiarare(imp).some((c) => c.incideSu === "capacita");
  const registratiTutti = costiRegistrati(calcolo.prospetto.costiCalcolati, anno);
  const registratiFissi = costiRegistrati(calcolo.prospetto.costiCalcolati, anno, "fisso");

  const aggiorna = (chiave: keyof typeof campi) => (v: number | null) =>
    setCampi((c) => (c ? { ...c, [chiave]: v } : c));

  return (
    <Guscio
      titolo="Pianificazione"
      descrizione={`Anno ${anno} · dal netto che vuoi in tasca ai contatti da coltivare ogni mese`}
    >
      <div className="mx-auto max-w-4xl space-y-4">
        {piano ? (
          <Card scura className="p-6">
            <span className="flex items-center gap-2 text-etichetta text-white/60">
              <Target className="size-4" aria-hidden />
              Per portare a casa {euro(netto)} netti
            </span>
            <p className="mt-2 font-display text-semaforo font-semibold tracking-tight">
              {euro(piano.fatturatoNecessario)}
            </p>
            <p className="mt-1 text-corpo text-white/70">
              di fatturato all&apos;anno, cioè {euro(piano.fatturatoMensile)} al mese, con una
              pressione fiscale del {percentuale(campi.pressione, 1)} e {euro(costi)} di
              costi.
            </p>
          </Card>
        ) : (
          /*
            Il piano non si inventa. Prima si diceva «per portare a casa
            40.000 € netti» a chi non aveva mai nominato una cifra: un obiettivo
            plausibile, di nessuno, su cui poi si costruivano contatti al mese e
            tariffa minima. Finché i due numeri non ci sono, qui c'è scritto
            quali sono e dove si mettono.
          */
          <Card className="border border-accento/25 bg-accento-tenue">
            <CardCorpo className="py-5">
              <span className="flex items-center gap-2 text-etichetta text-accento">
                <Target className="size-4" aria-hidden />
                Manca il punto di partenza
              </span>
              <p className="mt-2 text-corpo">
                {netto === null && costi === null
                  ? "Dimmi quanto vuoi in tasca in un anno e quanto prevedi di spendere per l'attività"
                  : netto === null
                    ? "Dimmi quanto vuoi in tasca in un anno"
                    : "Dimmi quanto prevedi di spendere per l'attività in un anno"}
                : da lì si ricava il fatturato necessario, e poi i clienti, le proposte e i
                contatti da coltivare ogni mese. Sono i campi qui sotto.
              </p>
            </CardCorpo>
          </Card>
        )}

        <Card>
          <CardCorpo>
            <CardTitolo>Da cosa parte il calcolo</CardTitolo>
            {/*
              Anche qui vale la regola: un numero che l'app si è inventata va
              detto. Con uno storico alle spalle pressione e ticket sono
              misurati; senza, sono due stime di partenza da correggere.
            */}
            <CardSottotitolo>
              {campi.daStorico.pressione && campi.daStorico.ticket
                ? `Pressione e ticket medio sono misurati sul ${anno}, non stimati.`
                : campi.daStorico.pressione
                  ? `La pressione è misurata sul ${anno}. Il ticket medio è una stima di partenza: non ci sono ancora clienti fatturati.`
                  : `Pressione e ticket medio sono stime di partenza: nel ${anno} non ci sono ancora incassi da cui misurarli. Correggili con i tuoi.`}{" "}
              {netto === null || costi === null
                ? "Netto e costi restano vuoti finché non li dichiari: sono decisioni tue, e un valore predefinito qui cambierebbe tutti i numeri di questa schermata senza che tu l'abbia scelto."
                : "Netto e costi sono quelli che hai dichiarato nella configurazione: cambiarli qui li cambia solo per questa simulazione."}
            </CardSottotitolo>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <CampoValore id="p-netto" etichetta="Netto desiderato" aiuto="all'anno, in tasca"
                valore={campi.netto} onChange={aggiorna("netto")} />
              <CampoValore id="p-costi" etichetta="Costi previsti" aiuto="dell'attività, all'anno"
                valore={campi.costi} onChange={aggiorna("costi")} />
              <CampoPercentuale id="p-pressione" etichetta="Pressione attesa"
                aiuto="imposte e contributi sui ricavi" valore={campi.pressione}
                onChange={aggiorna("pressione")} />
              <CampoValore id="p-ticket" etichetta="Ticket medio" aiuto="per cliente o progetto"
                valore={campi.ticket} onChange={aggiorna("ticket")} />
            </div>
            {registratiTutti.quanti > 0 && costi !== registratiTutti.totale && (
              <button
                type="button"
                onClick={() => aggiorna("costi")(registratiTutti.totale)}
                /* Alto 18 px era il bersaglio più piccolo dell'app: sul telefono
                   diventa una riga da premere, con un mouse resta il link di prima. */
                className="mt-3 flex min-h-11 items-center text-left text-etichetta font-medium text-accento underline underline-offset-2 sm:min-h-0"
              >
                Usa i {euro(registratiTutti.totale)} di costi che hai già registrato nel {anno}
              </button>
            )}
          </CardCorpo>
        </Card>

        {piano && (
          <Card>
            <CardCorpo className="pb-2">
              <CardTitolo>Dal fatturato ai contatti</CardTitolo>
              <CardSottotitolo>
                L&apos;ultimo numero è quello che deve guidare la tua attività commerciale.
              </CardSottotitolo>
            </CardCorpo>
            <ol className="px-4 pb-5 sm:px-6 sm:pb-6">
              <Gradino
                etichetta="Fatturato necessario"
                valore={euro(piano.fatturatoNecessario)}
                spiegazione={`(${euro(campi.netto)} + ${euro(campi.costi)}) ÷ ${percentuale(1 - campi.pressione, 1)}`}
              />
              <Gradino
                etichetta="Clienti o progetti nell'anno"
                valore={num(piano.clientiNecessari)}
                spiegazione={`${euro(piano.fatturatoNecessario)} ÷ ${euro(campi.ticket)} di ticket medio`}
                controllo={
                  <CampoPercentuale id="p-chiusura" etichetta="Tasso di chiusura"
                    aiuto="quante proposte diventano incarichi" valore={campi.chiusura}
                    onChange={aggiorna("chiusura")} compatto />
                }
              />
              <Gradino
                etichetta="Proposte da presentare"
                valore={num(piano.proposteNecessarie)}
                spiegazione={`${num(piano.clientiNecessari)} clienti ÷ ${percentuale(campi.chiusura, 0)} di chiusura`}
                controllo={
                  <CampoPercentuale id="p-conversione" etichetta="Da contatto a proposta"
                    aiuto="quanti contatti arrivano a preventivo" valore={campi.conversione}
                    onChange={aggiorna("conversione")} compatto />
                }
              />
              <Gradino
                etichetta="Contatti necessari nell'anno"
                valore={num(piano.contattiNecessari)}
                spiegazione={`${num(piano.proposteNecessarie)} proposte ÷ ${percentuale(campi.conversione, 0)} di conversione`}
              />
              <Gradino
                etichetta="Contatti al mese"
                valore={num(piano.contattiAlMese)}
                spiegazione="È il numero che deve guidare tutta la tua attività commerciale."
                finale
              />
            </ol>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardCorpo>
              <CardTitolo>Tariffa e capacità</CardTitolo>
              {/*
                I due numeri da cui esce la capacità non stavano scritti da
                nessuna parte come modificabili: 220 giorni per 5 ore erano una
                convenzione dell'app che nessuno poteva smentire.
              */}
              <CardSottotitolo>
                {num(ore)} ore fatturabili all&apos;anno: {imp.giorniLavorativi} giorni per{" "}
                {imp.oreFatturabiliGiorno} ore
                {capacitaDaDichiarare ? (
                  <>
                    , valori predefiniti.{" "}
                    <Link href="/parametri" className="underline underline-offset-2">
                      Dichiara i tuoi
                    </Link>
                    .
                  </>
                ) : (
                  ", come li hai dichiarati."
                )}
              </CardSottotitolo>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <CampoValore id="p-tariffa" etichetta="Tariffa oraria attuale" aiuto="quella che applichi oggi"
                  valore={tariffa} onChange={aggiorna("tariffa")} />
                <div className="rounded-interna bg-superficie-alt p-3">
                  <p className="text-micro text-inchiostro-tenue">Tariffa oraria minima</p>
                  <p className="cifre mt-1 text-kpi-sm font-semibold">
                    {piano ? euro(piano.tariffaMinima) : "—"}
                  </p>
                  <p className="mt-1 text-micro text-inchiostro-tenue">
                    {piano ? `${euro(piano.tariffaGiornalieraMinima)} al giorno` : "serve l'obiettivo"}
                  </p>
                </div>
              </div>
              {piano && tariffa !== null ? (
                <p
                  className={cn(
                    "mt-4 rounded-interna px-3 py-2 text-etichetta",
                    piano.tariffaSufficiente
                      ? "bg-positivo-tenue text-[#0B8A63]"
                      : "bg-attenzione-tenue text-[#B8791A]",
                  )}
                >
                  {piano.tariffaSufficiente
                    ? `Obiettivo raggiungibile riempiendo il ${percentuale(piano.saturazioneNecessaria, 0)} delle ore fatturabili.`
                    : `A ${euro(tariffa)} l'ora dovresti vendere più ore di quelle che hai. Alza la tariffa ad almeno ${euro(piano.tariffaMinima)} oppure rivedi l'obiettivo.`}
                </p>
              ) : (
                <p className="mt-4 text-etichetta text-inchiostro-tenue">
                  {tariffa === null
                    ? "La tariffa che applichi oggi non è dichiarata: senza, non si può dire se l'obiettivo sta dentro le ore che hai."
                    : "Con un obiettivo dichiarato qui compare la tariffa minima per raggiungerlo."}
                </p>
              )}
            </CardCorpo>
          </Card>

          <Card>
            <CardCorpo>
              <CardTitolo>Punto di pareggio</CardTitolo>
              <CardSottotitolo>
                Sotto questa cifra lavori in perdita, tasse e contributi compresi.
              </CardSottotitolo>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <CampoValore id="p-fissi" etichetta="Costi fissi annui" aiuto="quelli che paghi comunque"
                  valore={costiFissi} onChange={aggiorna("costiFissi")} />
                <div className="rounded-interna bg-superficie-alt p-3">
                  <p className="text-micro text-inchiostro-tenue">Fatturato di pareggio</p>
                  <p className="cifre mt-1 text-kpi-sm font-semibold">
                    {pareggio ? euro(pareggio.fatturato) : "—"}
                  </p>
                  <p className="mt-1 text-micro text-inchiostro-tenue">
                    {pareggio ? `${euro(pareggio.mensile)} al mese` : "servono i costi fissi"}
                  </p>
                </div>
              </div>
              {pareggio && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-interna bg-superficie-alt p-3">
                    <p className="text-micro text-inchiostro-tenue">Ore da vendere</p>
                    <p className="cifre mt-1 text-kpi-sm font-semibold">
                      {pareggio.ore === null ? "—" : num(Math.ceil(pareggio.ore))}
                    </p>
                  </div>
                  <div className="rounded-interna bg-superficie-alt p-3">
                    <p className="text-micro text-inchiostro-tenue">Giorni di lavoro</p>
                    <p className="cifre mt-1 text-kpi-sm font-semibold">
                      {pareggio.giorni === null ? "—" : num(Math.ceil(pareggio.giorni))}
                    </p>
                  </div>
                </div>
              )}
              {/*
                La proposta invece dell'invenzione: se in archivio ci sono costi
                marcati «fisso», la somma è già lì e ricopiarla a mano è solo un
                modo di sbagliarla.
              */}
              {registratiFissi.quanti > 0 && costiFissi !== registratiFissi.totale && (
                <button
                  type="button"
                  onClick={() => aggiorna("costiFissi")(registratiFissi.totale)}
                  /* Alto 18 px era il bersaglio più piccolo dell'app: sul telefono
                   diventa una riga da premere, con un mouse resta il link di prima. */
                className="mt-3 flex min-h-11 items-center text-left text-etichetta font-medium text-accento underline underline-offset-2 sm:min-h-0"
                >
                  Usa i {euro(registratiFissi.totale)} di costi fissi registrati nel {anno}
                </button>
              )}
              <p className="mt-3 text-etichetta text-inchiostro-tenue">
                {pareggio
                  ? "Da quel giorno in poi, quello che fatturi inizia a diventare tuo."
                  : "Nei costi fissi va quello che paghi comunque anche in un mese senza incassi: canoni e abbonamenti, commercialista, assicurazione, affitto."}
              </p>
            </CardCorpo>
          </Card>
        </div>

        {tariffa !== null && (
          <Kpi
            etichetta="Fatturato potenziale alla tariffa attuale"
            valore={euro(round2(tariffa * ore))}
            nota={`${euro(tariffa)} l'ora per ${num(ore)} ore fatturabili`}
            taglia="kpiSm"
          />
        )}
      </div>
    </Guscio>
  );
}

function Gradino({
  etichetta,
  valore,
  spiegazione,
  controllo,
  finale = false,
}: {
  etichetta: string;
  valore: string;
  spiegazione: string;
  controllo?: React.ReactNode;
  finale?: boolean;
}) {
  return (
    <li className="relative">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-interna px-4 py-3",
          finale ? "bg-accento-tenue" : "bg-superficie-alt",
        )}
      >
        <span className="min-w-0">
          <span className={cn("block text-corpo", finale && "font-medium text-accento")}>
            {etichetta}
          </span>
          <span className="block text-micro text-inchiostro-tenue">{spiegazione}</span>
        </span>
        <span className={cn("cifre shrink-0 text-kpi font-semibold", finale && "text-accento")}>
          {valore}
        </span>
      </div>
      {controllo ? (
        <div className="flex items-center gap-3 py-2 pl-4">
          <ArrowDown className="size-4 shrink-0 text-inchiostro-tenue" aria-hidden />
          <div className="w-56">{controllo}</div>
        </div>
      ) : (
        !finale && (
          <div className="py-2 pl-4">
            <ArrowDown className="size-4 text-inchiostro-tenue" aria-hidden />
          </div>
        )
      )}
    </li>
  );
}

/**
 * Un campo importo che può essere vuoto e resta vuoto.
 *
 * Vuoto significa «non dichiarato», non «zero»: svuotarlo non deve diventare
 * un obiettivo di zero euro né un costo fisso di zero euro, che sono numeri
 * veri e produrrebbero un piano vero e sbagliato.
 */
function CampoValore({
  id, etichetta, aiuto, valore, onChange,
}: {
  id: string; etichetta: string; aiuto: string;
  valore: number | null; onChange: (v: number | null) => void;
}) {
  const [bozza, setBozza] = React.useState<string | null>(null);
  return (
    <Campo etichetta={etichetta} aiuto={aiuto} htmlFor={id}>
      <Input
        id={id}
        numerico
        inputMode="decimal"
        placeholder="non dichiarato"
        value={bozza ?? (valore === null ? "" : perCampo(valore, 0))}
        onChange={(e) => {
          setBozza(e.target.value);
          if (e.target.value.trim() === "") return onChange(null);
          const n = analizzaNumero(e.target.value);
          if (n !== null) onChange(n);
        }}
        onBlur={() => setBozza(null)}
      />
    </Campo>
  );
}

function CampoPercentuale({
  id, etichetta, aiuto, valore, onChange, compatto = false,
}: {
  id: string; etichetta: string; aiuto: string; valore: number;
  onChange: (v: number) => void; compatto?: boolean;
}) {
  const [bozza, setBozza] = React.useState<string | null>(null);
  return (
    <Campo etichetta={etichetta} aiuto={compatto ? undefined : aiuto} htmlFor={id}>
      <Input
        id={id}
        numerico
        inputMode="decimal"
        value={bozza ?? perCampo(valore * 100, 1)}
        onChange={(e) => {
          setBozza(e.target.value);
          const n = analizzaPercentuale(e.target.value);
          if (n !== null && n > 0 && n < 1) onChange(n);
        }}
        onBlur={() => setBozza(null)}
      />
    </Campo>
  );
}
