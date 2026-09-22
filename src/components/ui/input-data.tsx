"use client";

/**
 * Un campo data che si scrive e si legge in italiano, comunque sia messo il
 * browser.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché non `<input type="date">`
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il campo data nativo si disegna da sé, e il formato che mostra lo decide la
 * **lingua dell'interfaccia del browser**: non la lingua della pagina, non
 * l'attributo `lang`, non la `locale` del contesto. Un italiano con Chrome in
 * inglese — che è normalissimo — vede `mm/dd/yyyy` dentro un'app tutta in
 * italiano, e il 3 aprile lo può scrivere il 4 marzo senza accorgersene.
 *
 * Misurato: lo stesso `<input type="date">` in una pagina `lang="it"`, aperto
 * con Chromium avviato anche con `--lang=it-IT`, continua a mostrare
 * `mm/dd/yyyy`. Non è una cosa che si sistema dal lato della pagina.
 *
 * Qui invece il formato è nostro: si scrive `gg/mm/aaaa`, lo legge
 * `analizzaData` — che accetta anche i punti, i trattini, l'anno a due cifre e
 * la forma ISO, e **rifiuta il 31 febbraio** invece di trasformarlo nel 3
 * marzo — e quello che esce è sempre `aaaa-mm-gg`, la forma in cui l'archivio
 * tiene le date.
 */
import * as React from "react";
import { Input } from "./input";
import { analizzaData, data as fmtData } from "@/lib/format";
import { cn } from "@/lib/utils";

export function InputData({
  id,
  valore,
  onCambia,
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  /** La data in archivio, `aaaa-mm-gg`, oppure `null` per «nessuna». */
  valore: string | null;
  /** Chiamato solo quando quello che c'è scritto è una data vera, o niente. */
  onCambia: (iso: string | null) => void;
}) {
  /*
    Il testo scritto è di chi scrive, e resta com'è finché non si tocca il
    campo da fuori. Riformattarlo a ogni tasto — «0» che diventa «0/», «31/2»
    che si raddrizza da sé — è il modo di far litigare il cursore con chi sta
    digitando.
  */
  const [bozza, setBozza] = React.useState(() => (valore ? fmtData(valore) : ""));
  const [ultimo, setUltimo] = React.useState(valore);

  if (valore !== ultimo) {
    setUltimo(valore);
    setBozza(valore ? fmtData(valore) : "");
  }

  const vuoto = bozza.trim() === "";
  const storta = !vuoto && analizzaData(bozza) === null;

  return (
    <>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        placeholder="gg/mm/aaaa"
        value={bozza}
        aria-invalid={storta || undefined}
        onChange={(e) => {
          const testo = e.target.value;
          setBozza(testo);
          const iso = analizzaData(testo);
          /*
            Si avvisa solo quando c'è qualcosa da dire: una data vera, o il
            campo svuotato. Mentre si scrive «3» la data non è ancora storta,
            è ancora a metà, e mandare fuori un `null` a metà digitazione
            cancellerebbe quello che c'era.
          */
          if (iso !== null || testo.trim() === "") {
            setUltimo(iso);
            onCambia(iso);
          }
        }}
        className={cn(storta && "border-negativo", className)}
        {...props}
      />
      {storta && (
        <p className="text-micro text-negativo">
          Non è una data: si scrive 31/12/2027.
        </p>
      )}
    </>
  );
}
