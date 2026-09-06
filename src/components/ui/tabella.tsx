"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tabella disciplinata: righe alternate sulla superficie alternativa,
 * intestazione ferma in alto, riga dei totali fissa in basso.
 * I contenitori scrollano da soli: il body della pagina non scorre mai in orizzontale.
 */
/**
 * Il riquadro che scorre. Contiene la tabella su entrambi gli assi, così
 * l'intestazione e la riga dei totali possono agganciarsi ai suoi bordi e il
 * corpo della pagina non scorre mai in orizzontale.
 *
 * Lo scorrimento orizzontale è dichiarato, non nascosto. Su un tablet la
 * tabella delle fatture chiede 1328 px e ne ha 728: senza un segno, che ci sia
 * dell'altro a destra si scopre per caso. Due segni, perché nessuno dei due
 * basta da solo — la barra di scorrimento sempre visibile, che su iOS non
 * esiste, e un velo sul bordo destro che sparisce quando si arriva in fondo.
 *
 * `classeGuscio` porta le classi che valgono per il riquadro intero, non per
 * la zona che scorre: sono le tabelle che sotto i 768 lasciano il posto alle
 * schede (`hidden md:block`). Senza, il velo resterebbe acceso sul telefono
 * sopra una tabella che lì non c'è.
 */
export function ContenitoreTabella({
  className,
  classeGuscio,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { classeGuscio?: string }) {
  const rif = React.useRef<HTMLDivElement>(null);
  const [restaADestra, setRestaADestra] = React.useState(false);

  React.useEffect(() => {
    const el = rif.current;
    if (!el) return;
    const misura = () => {
      // Un pixel di tolleranza: gli arrotondamenti dello zoom del browser
      // lasciano scarti sotto l'unità, e un velo che non si spegne mai è
      // peggio di nessun velo.
      setRestaADestra(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
    };
    misura();
    el.addEventListener("scroll", misura, { passive: true });
    const osservatore = new ResizeObserver(misura);
    osservatore.observe(el);
    for (const figlio of el.children) osservatore.observe(figlio);
    return () => {
      el.removeEventListener("scroll", misura);
      osservatore.disconnect();
    };
  }, []);

  return (
    <div className={cn("relative", classeGuscio)}>
      <div ref={rif} className={cn("scorrevole w-full overflow-auto", className)} {...props}>
        {children}
      </div>
      {restaADestra && (
        <div
          aria-hidden
          /* `z-[5]`: sopra le celle normali, sotto la colonna delle azioni e
             l'intestazione, che sono agganciate ai bordi con `z-10`. Un velo
             sopra i pulsanti li farebbe sembrare spenti. */
          className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-8 bg-gradient-to-l from-inchiostro/10 to-transparent"
        />
      )}
    </div>
  );
}

export function Tabella({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full border-collapse text-corpo", className)} {...props} />;
}

/**
 * L'aggancio in alto va messo sulle celle, non sulla sezione: su `thead` e
 * `tfoot` i browser ignorano `position: sticky`, e la riga se ne va scorrendo.
 */
export function TabellaTesta({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-superficie", className)}
      {...props}
    />
  );
}

/**
 * Le righe hanno uno sfondo dichiarato, non trasparente.
 *
 * Serve alla colonna ancorata: una cella `sticky` senza sfondo lascia passare
 * il contenuto che le scorre sotto. Con lo sfondo sulla riga, la cella lo
 * eredita e resta leggibile su entrambe le righe della zebra.
 */
export function TabellaCorpo({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn(
        "[&_tr]:bg-superficie [&_tr:nth-child(even)]:bg-superficie-alt",
        className,
      )}
      {...props}
    />
  );
}

export function TabellaPiede({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn(
        "font-medium",
        "[&_td]:sticky [&_td]:bottom-0 [&_td]:z-10 [&_td]:border-t [&_td]:border-bordo [&_td]:bg-superficie",
        className,
      )}
      {...props}
    />
  );
}

export function TabellaRiga({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-b border-bordo/70 transition-colors last:border-0", className)}
      {...props}
    />
  );
}

/**
 * La colonna che resta agganciata al bordo destro mentre la tabella scorre.
 *
 * In regime ordinario le colonne sono di più — IVA, deducibilità — e la tabella
 * scorre di lato: le azioni di riga, che stanno in fondo, finivano fuori campo.
 * Si vedevano solo scorrendo fino in fondo, e nel frattempo non si capiva
 * nemmeno che ci fossero. Ancorate restano dove uno le cerca.
 */
const ANCORATA =
  "sticky right-0 bg-inherit before:pointer-events-none before:absolute before:inset-y-0 before:-left-3 before:w-3 before:bg-gradient-to-l before:from-inchiostro/10 before:to-transparent";

export function TabellaIntestazione({
  className,
  numerica = false,
  ancorata = false,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  numerica?: boolean;
  ancorata?: boolean;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-bordo px-2.5 py-2.5 text-etichetta font-medium text-inchiostro-tenue",
        numerica ? "text-right" : "text-left",
        // Nell'angolo in alto a destra si incrociano due agganci: sopra tutto,
        // altrimenti le celle del corpo le passano davanti scorrendo.
        ancorata && `${ANCORATA} z-20`,
        className,
      )}
      {...props}
    />
  );
}

export function TabellaCella({
  className,
  numerica = false,
  ancorata = false,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  numerica?: boolean;
  ancorata?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-2.5 py-2.5 align-middle",
        numerica && "cifre text-right",
        ancorata && `${ANCORATA} z-10`,
        className,
      )}
      {...props}
    />
  );
}
