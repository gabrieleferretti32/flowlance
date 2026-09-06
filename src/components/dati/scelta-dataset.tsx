"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { DATASET, type IdDataset } from "@/lib/dati/dataset";
import { Button } from "@/components/ui/button";

/**
 * I dataset di esempio, offerti allo stesso modo dovunque.
 *
 * Le due strade che li offrono sono la schermata di primo avvio e Dati e
 * backup, e devono elencarli con le stesse parole: due elenchi scritti a mano
 * in due file divergono al primo dataset aggiunto, e chi legge il secondo
 * pensa che siano cose diverse.
 *
 * Un pulsante per dataset, non un menu a tendina: sono due, e una scelta fra
 * due voci nascosta dietro un menu costa un tocco in più per non risparmiare
 * niente. La riga sotto dice cosa ci si trova dentro, perché «dimostrativo» e
 * «vetrina» da soli non lo dicono.
 */
export function SceltaDataset({
  onScegli,
  disabilitato,
  taglia,
  variante = "contorno",
}: {
  onScegli: (id: IdDataset) => void;
  disabilitato?: boolean;
  taglia?: React.ComponentProps<typeof Button>["taglia"];
  variante?: React.ComponentProps<typeof Button>["variante"];
}) {
  return (
    <div className="space-y-3">
      {DATASET.map((d) => (
        <div key={d.id} className="space-y-1">
          <Button
            scrive
            variante={variante}
            taglia={taglia}
            disabled={disabilitato}
            onClick={() => onScegli(d.id)}
          >
            <Sparkles className="size-4" aria-hidden />
            {d.nome}
          </Button>
          <p className="text-micro text-inchiostro-tenue">{d.sommario}</p>
        </div>
      ))}
    </div>
  );
}
