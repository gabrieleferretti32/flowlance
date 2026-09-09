"use client";

import * as React from "react";
import { CheckCircle2, CircleAlert, Clock, ExternalLink, ShieldQuestion } from "lucide-react";
import { Guscio } from "@/components/guscio/guscio";
import { Button } from "@/components/ui/button";
import { Card, CardCorpo, CardIntestazione, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { Campo } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { archivio } from "@/lib/dati/archivio";
import { creaBackup, nomeFileBackup, serializzaBackup } from "@/lib/dati/backup";
import { scaricaTesto } from "@/lib/dati/file";
import { verificaChiave } from "@/lib/licenza/verifica";
import {
  GIORNI_DI_PROVA,
  GIORNI_PREAVVISO,
  descrizione,
  etichettaAcquisto,
  giorniInParole,
  preavviso,
  solaLettura,
  valutaSostituzione,
  INDIRIZZO_ACQUISTO,
  type StatoLicenza,
} from "@/lib/licenza/stato";
import { useLicenza, useStatoLicenza } from "@/lib/stato/licenza";
import { dataEstesa } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * La licenza: com'è messa, e dove si incolla la chiave.
 *
 * Tutto quello che c'è da sapere sta scritto qui in chiaro, compreso il fatto
 * che la verifica è locale e che i dati restano esportabili in ogni caso. Non
 * c'è niente da nascondere: l'app non parla con nessun server, e il controllo
 * della licenza non fa eccezione.
 */
export function SchermataLicenza() {
  const oggi = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const stato = useStatoLicenza(oggi);
  const chiaveSalvata = useLicenza((s) => s.chiave);
  const licenzaSalvata = useLicenza((s) => s.licenza);
  const imposta = useLicenza((s) => s.imposta);
  const segnaNonVerificabile = useLicenza((s) => s.segnaNonVerificabile);

  const [bozza, setBozza] = React.useState("");
  const [errore, setErrore] = React.useState<string | null>(null);
  const [inCorso, setInCorso] = React.useState(false);

  async function attiva() {
    setInCorso(true);
    setErrore(null);
    const esito = await verificaChiave(bozza);
    setInCorso(false);
    if (!esito.ok) {
      setErrore(esito.motivo);
      if (!esito.verificabile) segnaNonVerificabile(esito.motivo);
      return;
    }

    // La firma è buona, ma non basta: una licenza scaduta o più corta di quella
    // già attiva non deve poter sostituire niente. Chi incolla la stringa
    // sbagliata non deve ritrovarsi in sola lettura per un copia-incolla.
    const sostituzione = valutaSostituzione(esito.licenza, licenzaSalvata, oggi);
    if (!sostituzione.sostituisci) {
      setErrore(sostituzione.motivo);
      return;
    }

    imposta(bozza.trim(), esito.licenza);
    segnaNonVerificabile(null);
    setBozza("");
    toast.conferma(`Licenza attivata per ${esito.licenza.email}`);
  }

  function rimuovi() {
    imposta(null, null);
    toast.conferma("Chiave rimossa");
  }

  async function esporta() {
    const contenuto = await archivio().leggiTutto();
    scaricaTesto(nomeFileBackup(), serializzaBackup(creaBackup(contenuto)));
    toast.conferma("Backup esportato");
  }

  return (
    <Guscio titolo="Licenza" descrizione="Verificata sul tuo dispositivo, senza contattare nessuno">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <RiquadroStato stato={stato} />

        <Card>
          <CardIntestazione>
            <CardTitolo>Attiva una chiave</CardTitolo>
            <CardSottotitolo>Quella ricevuta per email dopo l&apos;acquisto</CardSottotitolo>
          </CardIntestazione>
          <CardCorpo className="space-y-3 pt-0">
            <Campo
              etichetta="Chiave di licenza"
              htmlFor="chiave"
              aiuto="Incollala per intero, a capo compresi: comincia con FLW1."
            >
              <textarea
                id="chiave"
                value={bozza}
                onChange={(e) => {
                  setBozza(e.target.value);
                  setErrore(null);
                }}
                rows={4}
                spellCheck={false}
                placeholder="FLW1.…"
                aria-invalid={errore ? true : undefined}
                className={cn(
                  "cifre w-full resize-y break-all rounded-campo border bg-superficie px-3 py-2 text-campo",
                  "transition-[border-color,box-shadow] duration-150",
                  "focus:outline-none focus:ring-2",
                  errore
                    ? "border-negativo ring-negativo/20 focus:border-negativo focus:ring-negativo/20"
                    : "border-bordo focus:border-accento focus:ring-accento/20",
                )}
              />
            </Campo>

            {errore && (
              <p role="alert" className="text-etichetta text-negativo">
                {errore}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => void attiva()} disabled={bozza.trim() === "" || inCorso}>
                {inCorso ? "Verifico…" : "Attiva"}
              </Button>
              {chiaveSalvata && (
                <Button variante="quieto" onClick={rimuovi}>
                  Rimuovi la chiave salvata
                </Button>
              )}
            </div>
          </CardCorpo>
        </Card>

        <Card className="lg:col-span-2">
          <CardIntestazione>
            <CardTitolo>Come funziona</CardTitolo>
          </CardIntestazione>
          <CardCorpo className="grid gap-4 pt-0 sm:grid-cols-3">
            <Spiegazione titolo="Verifica locale">
              La chiave contiene la tua email e la data di scadenza, firmate. Flowlance ha solo la
              chiave pubblica e controlla la firma qui, nel browser. Non esiste un server da
              interrogare: l&apos;app è un sito statico e i tuoi dati non la lasciano mai.
            </Spiegazione>
            <Spiegazione titolo="Alla scadenza">
              L&apos;app diventa in sola lettura: si vede tutto — prospetti, scadenzario, storico —
              e non si inserisce più niente. Il preavviso comincia {GIORNI_PREAVVISO} giorni prima.
              Senza chiave si parte da {GIORNI_DI_PROVA} giorni di prova.
            </Spiegazione>
            <Spiegazione titolo="I dati restano tuoi">
              L&apos;esportazione del backup funziona sempre, anche a licenza scaduta. Non è una
              cortesia: i tuoi dati non sono il modo di tenerti legato.
              <span className="mt-2 block">
                <Button variante="contorno" taglia="sm" onClick={() => void esporta()}>
                  Esporta il backup
                </Button>
              </span>
            </Spiegazione>
          </CardCorpo>
        </Card>
      </div>
    </Guscio>
  );
}

function Spiegazione({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-etichetta font-medium">{titolo}</p>
      <p className="mt-1 text-etichetta leading-relaxed text-inchiostro-tenue">{children}</p>
    </div>
  );
}

function RiquadroStato({ stato }: { stato: StatoLicenza }) {
  const bloccata = solaLettura(stato);
  const Icona =
    stato.esito === "nonVerificabile"
      ? ShieldQuestion
      : bloccata
        ? CircleAlert
        : stato.esito === "prova"
          ? Clock
          : CheckCircle2;

  return (
    <Card>
      <CardIntestazione>
        <CardTitolo>Stato</CardTitolo>
      </CardIntestazione>
      <CardCorpo className="pt-0">
        <div className="flex items-start gap-3">
          <Icona
            aria-hidden
            className={cn(
              "mt-0.5 size-5 shrink-0",
              bloccata ? "text-negativo" : stato.esito === "attiva" ? "text-positivo" : "text-attenzione",
            )}
          />
          <div className="min-w-0">
            <p className="text-corpo font-medium">{descrizione(stato)}</p>
            <dl className="mt-2 space-y-1">
              {(stato.esito === "attiva" || stato.esito === "scaduta") && (
                <>
                  <Voce etichetta="Intestatario" valore={stato.licenza.email} />
                  <Voce etichetta="Scadenza" valore={dataEstesa(stato.licenza.scadenza)} />
                  <Voce etichetta="Emessa il" valore={dataEstesa(stato.licenza.emessaIl)} />
                </>
              )}
              {stato.esito === "attiva" && stato.giorniResidui <= GIORNI_PREAVVISO && (
                <Voce etichetta="Preavviso" valore={giorniInParole(stato.giorniResidui)} />
              )}
              {stato.esito === "prova" && (
                <Voce etichetta="Prova" valore={giorniInParole(stato.giorniResidui)} />
              )}
              {stato.esito === "nonVerificabile" && (
                <p className="text-etichetta text-inchiostro-tenue">{stato.motivo}</p>
              )}
            </dl>
            {bloccata && (
              <p className="mt-3 text-etichetta text-inchiostro-tenue">
                L&apos;app è in sola lettura: si consulta tutto, non si inserisce niente.
                L&apos;esportazione dei dati resta attiva.
              </p>
            )}
            {/*
              Il collegamento all'acquisto, dove serve: a chi è scaduto e a chi
              ha i giorni contati. La schermata sapeva dire benissimo com'è
              messa la licenza e non diceva da nessuna parte dove si compra.
            */}
            {(bloccata || preavviso(stato) !== null) && (
              <a
                href={INDIRIZZO_ACQUISTO}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-etichetta font-medium text-accento underline underline-offset-2 sm:min-h-0"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                {etichettaAcquisto(stato)} su flowlance.it
              </a>
            )}
          </div>
        </div>
      </CardCorpo>
    </Card>
  );
}

function Voce({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <dt className="text-etichetta text-inchiostro-tenue">{etichetta}</dt>
      <dd className="text-etichetta font-medium">{valore}</dd>
    </div>
  );
}
