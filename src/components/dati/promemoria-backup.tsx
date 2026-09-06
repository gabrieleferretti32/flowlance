"use client";

import * as React from "react";
import Link from "next/link";
import { Download, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardCorpo } from "@/components/ui/card";
import { esportaBackup } from "@/lib/dati/azioni";
import { useDati } from "@/lib/dati/hooks";
import { avvisoBackup, contaDocumenti } from "@/lib/dati/promemoria-backup";
import { useStatoBackup } from "@/lib/stato/backup";

/**
 * «Fai un backup», detto solo quando serve.
 *
 * Sta sul cruscotto perché è la schermata che si apre per prima, e porta
 * dentro il pulsante che risolve il problema: mandare l'utente a cercare
 * l'export in un'altra schermata vuol dire che non lo farà. Da tre tocchi a
 * uno, e solo nel momento in cui quel tocco conta.
 *
 * Sparisce da sola appena il backup è fatto. Un avviso che resta anche dopo
 * che si è fatto quello che chiedeva è un banner, e un banner si impara a
 * ignorare in tre giorni.
 */
export function PromemoriaBackup() {
  const dati = useDati();
  const promemoria = useStatoBackup((s) => s.promemoria);
  const [inCorso, setInCorso] = React.useState(false);

  // Lo stato è persistito in localStorage: l'app è generata staticamente e
  // l'idratazione va chiesta a mano dopo il montaggio, altrimenti il primo
  // render direbbe «non hai mai fatto un backup» a chi l'ha fatto ieri.
  React.useEffect(() => {
    void useStatoBackup.persist.rehydrate();
  }, []);

  const oggi = React.useMemo(() => new Date().toISOString(), []);
  if (!dati) return null;

  const avviso = avvisoBackup(promemoria, contaDocumenti(dati), oggi);
  if (!avviso) return null;

  return (
    <Card className="border border-attenzione/25 bg-attenzione-tenue">
      <CardCorpo className="flex flex-wrap items-start justify-between gap-4 py-4">
        <div className="flex min-w-64 flex-1 items-start gap-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#B8791A]" aria-hidden />
          <div className="min-w-0">
            <p className="text-etichetta font-semibold text-[#B8791A]">{avviso.titolo}</p>
            <p className="mt-1 text-etichetta text-[#B8791A]">
              {avviso.testo}{" "}
              <Link href="/dati" className="underline underline-offset-2">
                Dati e backup
              </Link>{" "}
              spiega cosa contiene il file.
            </p>
          </div>
        </div>
        <Button
          variante="contorno"
          disabled={inCorso}
          onClick={async () => {
            setInCorso(true);
            try {
              await esportaBackup();
            } finally {
              setInCorso(false);
            }
          }}
        >
          <Download className="size-4" aria-hidden />
          Fai il backup adesso
        </Button>
      </CardCorpo>
    </Card>
  );
}
