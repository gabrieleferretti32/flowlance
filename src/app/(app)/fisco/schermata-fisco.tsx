"use client";

import * as React from "react";
import Link from "next/link";
import { Info, TriangleAlert } from "lucide-react";
import { Card, CardCorpo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Chip } from "@/components/ui/chip";
import { Kpi } from "@/components/ui/kpi";
import { Sezione } from "@/components/ui/fisarmonica";
import { Guscio } from "@/components/guscio/guscio";
import { RigaDelProspetto } from "@/components/fisco/riga-prospetto";
import { AvvisoParametri } from "@/components/fisco/avviso-parametri";
import { Button } from "@/components/ui/button";
import { Lock, Printer } from "lucide-react";
import { DocumentoProspettoStampa } from "@/components/fisco/documento-prospetto";
import { documentoProspetto, stampaConsentita } from "@/lib/fisco/stampa";
import {
  aliquoteIrpefNonDichiarate,
  campiDaDichiarare,
  elencoInTesto,
} from "@/lib/fisco/parametri-utente";
import type { Impostazioni } from "@/lib/fisco/tipi";
import { useCalcoloAnno } from "@/lib/dati/hooks";
import { parametriDi } from "@/lib/fisco/parametri";
import { dettaglioSoglia, prospettoDettagliato } from "@/lib/fisco/spiegazioni";
import { usePreferenze } from "@/lib/stato/preferenze";
import { euro, percentuale } from "@/lib/format";

export function SchermataFisco() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const calcolo = useCalcoloAnno(anno, oggi);

  const sezioni = React.useMemo(() => {
    if (!calcolo) return null;
    return prospettoDettagliato(calcolo.prospetto, calcolo.impostazioni, parametriDi(anno));
  }, [calcolo, anno]);

  if (!calcolo || !sezioni) {
    return (
      <Guscio titolo="Imposte e contributi">
        <Card>
          <CaricamentoTabella righe={5} />
        </Card>
      </Guscio>
    );
  }

  const { prospetto: p, impostazioni: imp } = calcolo;
  const soglia = dettaglioSoglia(p, imp);
  const parametri = parametriDi(anno);
  const stampa = stampaConsentita(parametri, imp);
  // Le aliquote che bloccano l'export e che l'utente può sbloccare da solo. I
  // parametri di legge provvisori bloccano allo stesso modo, ma lì non c'è
  // niente da dichiarare: mandare ai Parametri sarebbe mandare a vuoto.
  const daDichiarare = aliquoteIrpefNonDichiarate(imp);
  const documento = documentoProspetto(p, imp, parametri, oggi);

  return (
    <Guscio
      titolo="Imposte e contributi"
      descrizione={`Prospetto ${anno} · calcolo per cassa · regime ${imp.regime}`}
      azioni={
        // `window.print()` e basta: il documento è già nel DOM, nascosto a
        // schermo, e il foglio di stampa spegne l'app e accende lui. Il browser
        // fa il PDF da sé, senza librerie e senza che i dati escano dal
        // dispositivo — che è il punto dell'intero progetto.
        //
        // Quando è bloccato per colpa di un'aliquota mai dichiarata, il
        // pulsante non si spegne: diventa la porta per andare a dichiararla.
        // Spento con la ragione in un `title` era un vicolo cieco — e su un
        // telefono, dove il `title` non si vede, era un vicolo cieco muto.
        daDichiarare.length > 0 ? (
          <Button variante="contorno" asChild>
            <Link href="/parametri">
              <Lock className="size-4" aria-hidden />
              Sblocca la stampa
            </Link>
          </Button>
        ) : (
          <Button
            variante="contorno"
            disabled={!stampa.consentita}
            title={stampa.consentita ? undefined : stampa.motivo}
            onClick={() => window.print()}
          >
            <Printer className="size-4" aria-hidden />
            Stampa il prospetto
          </Button>
        )
      }
    >
      {/* Quello che si vede a schermo si spegne in stampa: al suo posto va il
          documento impaginato, che è la stessa sostanza in un'altra forma. */}
      <div className="mx-auto max-w-4xl space-y-4 print:hidden">
        <section aria-label="Sintesi" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi etichetta="Reddito imponibile" valore={euro(p.imponibile)} taglia="kpiSm" />
          <Kpi etichetta="Imposte dovute" valore={euro(p.totaleImposte)} taglia="kpiSm" />
          <Kpi etichetta="Contributi dovuti" valore={euro(p.totaleContributi)} taglia="kpiSm" />
          <Kpi
            sfondo="scuro"
            etichetta="Carico totale"
            valore={euro(p.caricoTotale)}
            nota={`pressione ${percentuale(p.pressione)}`}
            taglia="kpiSm"
          />
        </section>

        {soglia && (
          <Card>
            <CardCorpo className="flex items-start gap-3 py-4">
              <Info className="mt-0.5 size-4 shrink-0 text-accento" aria-hidden />
              <p className="text-corpo">{soglia}</p>
            </CardCorpo>
          </Card>
        )}

        <AvvisoParametri anno={anno} />
        <AvvisoParametriUtente impostazioni={imp} />

        {p.ricaviRilevanti === 0 ? (
          <Card>
            <CardCorpo className="py-10 text-center">
              <p className="mx-auto max-w-md text-corpo text-inchiostro-tenue">
                Il prospetto si compila da solo quando registri la prima fattura incassata:
                il calcolo segue il principio di cassa, quindi guarda gli incassi, non le
                fatture emesse.
              </p>
              <Link
                href="/fatture"
                className="mt-4 inline-block rounded-campo bg-accento px-4 py-2 text-corpo font-medium text-white transition-colors hover:bg-[#3D4CE8]"
              >
                Vai alle fatture
              </Link>
            </CardCorpo>
          </Card>
        ) : (
          <div className="space-y-3">
            {sezioni.map((s, indice) => {
              const totale = [...s.righe].reverse().find((r) => r.totale) ?? s.righe[s.righe.length - 1];
              return (
                <Sezione
                  key={s.id}
                  lettera={s.lettera}
                  titolo={s.titolo}
                  sottotitolo={s.sottotitolo}
                  apertaDiDefault={indice < 2}
                  sintesi={
                    totale?.formato === "euro" ? (
                      <span className="cifre text-corpo font-semibold">
                        {euro(Number(totale.valore))}
                      </span>
                    ) : undefined
                  }
                >
                  <div className="divide-y divide-bordo/60 py-1">
                    {s.righe.map((r) => (
                      <RigaDelProspetto key={r.id} riga={r} />
                    ))}
                  </div>
                </Sezione>
              );
            })}
          </div>
        )}

        <Card>
          <CardCorpo className="py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tono="neutro">Parametri {parametriDi(anno).anno}</Chip>
              {parametriDi(anno).fonti.map((f) => (
                <Chip key={f} tono="neutro" className="font-normal">
                  {f}
                </Chip>
              ))}
            </div>
            <p className="mt-3 text-etichetta text-inchiostro-tenue">
              Prospetto gestionale di stima: non sostituisce la dichiarazione dei redditi.
              Non considera altri redditi che in regime ordinario concorrono a formare il
              reddito complessivo e possono spostare lo scaglione IRPEF.
            </p>
          </CardCorpo>
        </Card>
      </div>

      {/*
        Il documento per la carta. Sta nel DOM ma è invisibile a schermo: in
        stampa il guscio si spegne e resta solo lui, già impaginato.
      */}
      <DocumentoProspettoStampa doc={documento} />
    </Guscio>
  );
}

/**
 * Le aliquote che nessuno ha confermato, dette dove si guardano le imposte.
 *
 * Non è un avviso di errore: il calcolo è quello che è, e senza una media non
 * ci sarebbe nessun numero. È l'avviso che il numero non è ancora tuo — e che
 * per questo il prospetto non esce.
 */
function AvvisoParametriUtente({ impostazioni }: { impostazioni: Impostazioni }) {
  // Solo quelli che toccano imposte e contributi: le ore fatturabili non
  // c'entrano niente con questa schermata, e un avviso che le nomina qui
  // insegna a saltare gli avvisi.
  const mancanti = campiDaDichiarare(impostazioni).filter((c) => c.incideSu === "imposte");
  if (mancanti.length === 0) return null;
  const bloccanti = mancanti.filter((c) => c.nellIrpef);

  return (
    <Card className="border border-attenzione/25 bg-attenzione-tenue">
      <CardCorpo className="flex items-start gap-3 py-4">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[#B8791A]" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-etichetta font-semibold text-[#B8791A]">
            {mancanti.length === 1
              ? "Un parametro non è ancora tuo"
              : `${mancanti.length} parametri non sono ancora tuoi`}
          </p>
          <p className="text-etichetta text-[#B8791A]">
            {elencoInTesto(mancanti)}:{" "}
            {mancanti.length === 1 ? "è un valore medio" : "sono valori medi"} che l&apos;app
            usa per poter calcolare qualcosa.
            {bloccanti.length > 0 &&
              " Finché restano così il prospetto non si esporta: è il documento che va dal commercialista."}{" "}
            <Link href="/parametri" className="font-medium underline underline-offset-2">
              Dichiarali nei Parametri
            </Link>
            .
          </p>
        </div>
      </CardCorpo>
    </Card>
  );
}
