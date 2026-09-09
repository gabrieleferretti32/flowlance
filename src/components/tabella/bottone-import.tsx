"use client";

import { useRouter } from "next/navigation";
import { FileSpreadsheet } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useComandi } from "@/lib/stato/comandi";
import { ROTTE } from "@/lib/rotte";

/**
 * «Importa da CSV», da mettere accanto a «Nuova fattura» e nello stato vuoto.
 *
 * Chi apre Fatture e la trova vuota deve avere lì la strada per caricare lo
 * storico: cercarla nel menu è un passaggio in più proprio nel momento in cui
 * si sta decidendo se lo strumento serve o no.
 *
 * Il tipo di documenti viaggia con la richiesta invece che nell'URL — l'app è
 * esportata statica — così l'import si apre già impostato su fatture o su costi
 * a seconda della schermata da cui si arriva.
 */
export function BottoneImport({
  destinazione,
  variante = "contorno",
  taglia,
  etichetta = "Importa da CSV",
}: {
  destinazione: "fattura" | "nota" | "costo";
  variante?: ButtonProps["variante"];
  taglia?: ButtonProps["taglia"];
  etichetta?: string;
}) {
  const router = useRouter();
  const chiedi = useComandi((s) => s.chiedi);

  return (
    <Button
      scrive
      variante={variante}
      taglia={taglia}
      onClick={() => {
        router.push(ROTTE.importa);
        chiedi({ tipo: "importaCsv", destinazione });
      }}
    >
      <FileSpreadsheet className="size-4" aria-hidden />
      {etichetta}
    </Button>
  );
}
