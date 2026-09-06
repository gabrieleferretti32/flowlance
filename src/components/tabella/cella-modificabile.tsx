"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSolaLettura } from "@/lib/stato/licenza";
import { analizzaNumero, analizzaPercentuale, data as fmtData, euro, perCampo, percentuale } from "@/lib/format";

type TipoCella = "testo" | "valuta" | "percentuale" | "data" | "scelta";

export type Opzione = { valore: string; etichetta: string };

/**
 * Cella con modifica in linea.
 *
 * Un clic o Invio la aprono, Invio conferma, Esc annulla, Tab conferma e passa
 * alla successiva. Il salvataggio è ottimistico: la tabella legge dall'archivio
 * ed è reattiva, quindi il valore nuovo compare subito e il toast tiene per
 * qualche secondo quello vecchio.
 */
export function CellaModificabile({
  tipo,
  valore,
  etichetta,
  opzioni,
  vuoto = "—",
  disabilitata: disabilitataProp = false,
  suggerimento: suggerimentoProp,
  onSalva,
  className,
}: {
  tipo: TipoCella;
  /** Numero per valuta e percentuale, stringa altrove. `null` per «non impostato». */
  valore: string | number | null;
  /** Nome del campo, per chi naviga con lo screen reader. */
  etichetta: string;
  opzioni?: Opzione[];
  vuoto?: string;
  disabilitata?: boolean;
  suggerimento?: string;
  onSalva: (valore: string | number | null) => void | Promise<void>;
  className?: string;
}) {
  // A licenza scaduta l'app è in sola lettura: la cella si legge e non si
  // apre. Il controllo sta qui e non nelle quattordici schermate che la usano,
  // perché una schermata nuova se lo dimenticherebbe.
  const bloccata = useSolaLettura();
  const disabilitata = disabilitataProp || bloccata;
  const suggerimento = bloccata
    ? "Licenza scaduta: l'app è in sola lettura."
    : suggerimentoProp;

  const [inModifica, setInModifica] = React.useState(false);
  const [bozza, setBozza] = React.useState("");
  const [errore, setErrore] = React.useState(false);
  /**
   * La spunta breve dopo il salvataggio.
   *
   * Una modifica in linea si conferma da sé — il valore nuovo è lì, nella
   * cella — e un toast per dirlo occuperebbe spazio sopra la tabella su cui si
   * sta ancora lavorando. La spunta dice «salvato» dove l'occhio è già; il
   * toast resta, uno solo e raggruppato, perché è l'unico posto in cui vive
   * l'Annulla, e un importo digitato male senza annulla non si recupera.
   */
  const [salvato, setSalvato] = React.useState(false);
  React.useEffect(() => {
    if (!salvato) return;
    const t = window.setTimeout(() => setSalvato(false), 1400);
    return () => window.clearTimeout(t);
  }, [salvato]);

  const conSpunta = React.useCallback(
    (valore: string | number | null) => {
      setSalvato(true);
      return onSalva(valore);
    },
    [onSalva],
  );

  const numerica = tipo === "valuta" || tipo === "percentuale";

  function apri() {
    if (disabilitata) return;
    setBozza(perModifica(tipo, valore));
    setErrore(false);
    setInModifica(true);
  }

  function chiudi() {
    setInModifica(false);
    setErrore(false);
  }

  function conferma() {
    const testo = bozza.trim();
    if (testo === "") {
      // Il vuoto è legittimo solo dove il campo è opzionale (una data di incasso
      // che si toglie); altrove annulla senza scrivere.
      if (tipo === "data") void conSpunta(null);
      chiudi();
      return;
    }
    if (tipo === "valuta") {
      const n = analizzaNumero(testo);
      if (n === null) return setErrore(true);
      void conSpunta(n);
    } else if (tipo === "percentuale") {
      const n = analizzaPercentuale(testo);
      if (n === null || n < 0 || n > 1) return setErrore(true);
      void conSpunta(n);
    } else {
      void conSpunta(testo);
    }
    chiudi();
  }

  if (tipo === "scelta" && opzioni) {
    return (
      <select
        aria-label={etichetta}
        disabled={disabilitata}
        value={String(valore ?? "")}
        onChange={(e) => void conSpunta(e.target.value)}
        className={cn(
          "w-full cursor-pointer rounded-campo border border-transparent bg-transparent px-2 py-2 sm:py-1",
          "text-campo text-inchiostro",
          "transition-colors duration-150 hover:border-bordo hover:bg-superficie",
          "focus:border-accento focus:outline-none focus:ring-2 focus:ring-accento/20",
          "disabled:cursor-not-allowed disabled:text-inchiostro-tenue",
          className,
        )}
      >
        {opzioni.map((o) => (
          <option key={o.valore} value={o.valore}>
            {o.etichetta}
          </option>
        ))}
      </select>
    );
  }

  if (inModifica) {
    return (
      <input
        autoFocus
        aria-label={etichetta}
        aria-invalid={errore || undefined}
        type={tipo === "data" ? "date" : "text"}
        inputMode={numerica ? "decimal" : undefined}
        value={bozza}
        onChange={(e) => {
          setBozza(e.target.value);
          setErrore(false);
        }}
        onBlur={conferma}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            conferma();
          } else if (e.key === "Escape") {
            e.preventDefault();
            chiudi();
          }
        }}
        className={cn(
          "w-full rounded-campo border bg-superficie px-2 py-2 text-corpo sm:py-1",
          numerica && "cifre text-right",
          errore
            ? "border-negativo ring-2 ring-negativo/20"
            : "border-accento ring-2 ring-accento/20",
          "focus:outline-none",
          className,
        )}
      />
    );
  }

  const mostrato = perLettura(tipo, valore, opzioni, vuoto);
  const assente = valore === null || valore === "";

  return (
    <button
      type="button"
      disabled={disabilitata}
      onClick={apri}
      title={suggerimento}
      aria-label={`${etichetta}: ${mostrato}. Premi Invio per modificare.`}
      className={cn(
        "w-full rounded-campo border border-transparent px-2 py-2 text-left sm:py-1",
        "transition-colors duration-150",
        numerica && "cifre text-right",
        assente && "text-inchiostro-tenue",
        disabilitata
          ? "cursor-default text-inchiostro-tenue"
          : "hover:border-bordo hover:bg-superficie",
        className,
      )}
    >
      <span className="inline-flex w-full items-center gap-1.5">
        {numerica && <span className="flex-1" />}
        <span className={numerica ? undefined : "flex-1"}>{mostrato}</span>
        <Check
          aria-hidden
          className={cn(
            "size-3.5 shrink-0 text-positivo transition-opacity duration-200",
            salvato ? "opacity-100" : "opacity-0",
          )}
        />
      </span>
    </button>
  );
}

function perModifica(tipo: TipoCella, valore: string | number | null): string {
  if (valore === null || valore === "") return "";
  if (tipo === "valuta") return perCampo(Number(valore));
  if (tipo === "percentuale") return perCampo(Number(valore) * 100, 2);
  return String(valore);
}

function perLettura(
  tipo: TipoCella,
  valore: string | number | null,
  opzioni: Opzione[] | undefined,
  vuoto: string,
): string {
  if (valore === null || valore === "") return vuoto;
  switch (tipo) {
    case "valuta":
      return euro(Number(valore));
    case "percentuale":
      return percentuale(Number(valore), 0);
    case "data":
      return fmtData(String(valore));
    case "scelta":
      return opzioni?.find((o) => o.valore === valore)?.etichetta ?? String(valore);
    default:
      return String(valore);
  }
}
