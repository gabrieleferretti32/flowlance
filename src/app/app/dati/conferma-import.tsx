"use client";

import * as React from "react";
import { Download, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardInterna } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { dataEstesa, interoIt } from "@/lib/format";
import type { ConfrontoImport } from "@/lib/dati/confronto-import";
import type { NomeCollezione } from "@/lib/dati/tipi";

const ETICHETTE: Record<NomeCollezione, string> = {
  impostazioni: "Impostazioni per anno",
  clienti: "Clienti",
  fatture: "Fatture",
  note: "Note di credito",
  costi: "Costi",
  movimentiPersonali: "Movimenti personali",
  movimentiAttivita: "Movimenti dell'attività",
  versamenti: "Versamenti F24",
  patrimonio: "Voci di patrimonio",
  spunte: "Adempimenti spuntati",
  chiusure: "Chiusure d'anno",
  percorsi: "Percorsi di configurazione",
};

/**
 * La domanda prima di sostituire l'archivio.
 *
 * Non «sei sicuro?», a cui si risponde sempre di sì. Qui c'è scritto che cosa
 * si perde, riga per riga e con i numeri: un tocco su «Importa» invece che su
 * «Esporta» — sono due pulsanti accanto — cancellava un anno di lavoro senza
 * che comparisse niente.
 *
 * Compare solo quando c'è qualcosa da perdere. Su un archivio vuoto l'import è
 * il gesto che salva chi ha cambiato computer, e chi è già in difficoltà non
 * deve trovarsi davanti una domanda in più.
 */
export function DialogoConfermaImport({
  confronto,
  nomeFile,
  inCorso,
  onEsporta,
  onConferma,
  onAnnulla,
}: {
  confronto: ConfrontoImport | null;
  nomeFile: string;
  inCorso: boolean;
  onEsporta: () => void | Promise<void>;
  onConferma: () => void | Promise<void>;
  onAnnulla: () => void;
}) {
  const [esportato, setEsportato] = React.useState(false);
  React.useEffect(() => {
    if (confronto) setEsportato(false);
  }, [confronto]);

  if (!confronto) return null;
  const righe = confronto.righe.filter((r) => r.adesso > 0 || r.nelFile > 0);

  return (
    <Dialog open onOpenChange={(aperto) => !aperto && onAnnulla()}>
      <DialogContent
        titolo="Sostituire l'archivio?"
        descrizione={`Importare «${nomeFile}» non aggiunge al tuo archivio: lo rimpiazza per intero.`}
      >
        <div className="space-y-4">
          {/*
            I cambi di identità prima dei numeri, e in rosso. Il regime è il
            parametro da cui discende tutto il calcolo — imposta sostitutiva o
            IRPEF, costi deducibili o no, IVA in fattura o no — e cambiava
            senza che niente lo dicesse. Il nome che cambia dice una cosa più
            semplice e più grave: questo file è di un altro archivio.
          */}
          {confronto.cambi.length > 0 && (
            <CardInterna className="border border-negativo/25 bg-negativo-tenue p-4">
              <p className="flex items-start gap-2 text-etichetta font-semibold text-[#C13237]">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {confronto.cambi.some((c) => c.campo === "nome")
                  ? "Questo file sembra di un altro archivio"
                  : "Questo file cambia come vengono calcolate le imposte"}
              </p>
              <ul className="mt-2 space-y-1">
                {confronto.cambi.map((c) => (
                  <li key={`${c.campo}-${c.anno}`} className="text-etichetta text-[#C13237]">
                    {c.campo === "nome" ? "Intestatario" : "Regime"} del {c.anno}:{" "}
                    <span className="font-medium">{c.adesso}</span> diventa{" "}
                    <span className="font-medium">{c.nelFile}</span>
                    {c.campo === "regime" && " — cambiano imposta, costi deducibili e IVA"}
                  </li>
                ))}
              </ul>
            </CardInterna>
          )}

          <div>
            <div className="flex items-baseline justify-between gap-3 pb-1.5">
              <p className="text-etichetta font-medium">Cosa cambia</p>
              <p className="text-micro text-inchiostro-tenue">
                {confronto.esportatoIl
                  ? `il file è del ${dataEstesa(confronto.esportatoIl.slice(0, 10))}`
                  : "il file non dice quando è stato esportato"}
              </p>
            </div>
            <ul className="divide-y divide-bordo border-y border-bordo">
              {righe.map((r) => (
                <li
                  key={r.collezione}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5"
                >
                  <span className="text-etichetta">{ETICHETTE[r.collezione]}</span>
                  <span className="cifre text-etichetta">
                    <span className={r.perse > 0 ? "font-medium" : "text-inchiostro-tenue"}>
                      {interoIt.format(r.adesso)}
                    </span>
                    <span className="px-1.5 text-inchiostro-tenue" aria-label="diventa">
                      →
                    </span>
                    <span className={r.perse > 0 ? "font-medium text-[#C13237]" : ""}>
                      {interoIt.format(r.nelFile)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-etichetta text-inchiostro-tenue">
              {confronto.documentiPersi > 0
                ? `In tutto spariscono ${interoIt.format(confronto.documentiPersi)} righe che il file non rimpiazza.`
                : "Il file contiene almeno tutto quello che hai adesso, ma i valori riga per riga possono essere diversi."}
            </p>
          </div>

          {/*
            L'export sta qui dentro, non altrove: è il momento in cui serve, e
            mandare l'utente a cercarlo in un'altra schermata vuol dire che non
            lo farà. Dopo, il pulsante lo dice — non si esporta due volte per
            sicurezza.
          */}
          <CardInterna className="flex flex-wrap items-center justify-between gap-3 p-3">
            <p className="min-w-52 flex-1 text-etichetta text-inchiostro-tenue">
              {esportato
                ? "Backup scaricato. L'archivio di adesso è al sicuro su disco."
                : "Puoi salvare com'è adesso prima di sostituirlo."}
            </p>
            <Button
              variante="contorno"
              taglia="sm"
              disabled={inCorso}
              onClick={async () => {
                await onEsporta();
                setEsportato(true);
              }}
            >
              <Download className="size-3.5" aria-hidden />
              {esportato ? "Esporta di nuovo" : "Esporta prima"}
            </Button>
          </CardInterna>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variante="quieto" onClick={onAnnulla} disabled={inCorso}>
              Annulla
            </Button>
            <Button scrive variante="pericolo" onClick={onConferma} disabled={inCorso}>
              Sostituisci l&apos;archivio
            </Button>
          </div>

          <p className="text-micro text-inchiostro-tenue">
            L&apos;archivio di adesso resta comunque recuperabile da questa schermata finché non
            lo scarti: l&apos;app ne tiene una copia, che sopravvive alla chiusura del browser.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
