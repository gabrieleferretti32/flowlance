"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { archivio } from "@/lib/dati/archivio";
import { useAnniDisponibili, useDati } from "@/lib/dati/hooks";
import { creaBackup, nomeFileBackup, serializzaBackup } from "@/lib/dati/backup";
import { scaricaTesto } from "@/lib/dati/file";
import { tratti } from "@/lib/comandi/fuzzy";
import {
  cerca,
  comandi,
  perSezione,
  type Azione,
  type Esito,
} from "@/lib/comandi/vocabolario";
import { useComandi } from "@/lib/stato/comandi";
import { useSolaLettura } from "@/lib/stato/licenza";
import { usePreferenze } from "@/lib/stato/preferenze";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * La palette dei comandi.
 *
 * L'elenco è costruito dal vocabolario puro; qui restano l'esecuzione delle
 * azioni e la tastiera. Tutto quello che si fa da qui si fa anche col mouse —
 * le voci sono bottoni veri, cliccabili — perché la palette è una scorciatoia
 * per chi la conosce, non l'unica strada per chi non la conosce.
 */
export function Paletta() {
  const aperta = useComandi((s) => s.paletta);
  const chiudi = useComandi((s) => s.chiudiPaletta);
  const chiedi = useComandi((s) => s.chiedi);
  const router = useRouter();
  const dati = useDati();
  const anno = usePreferenze((s) => s.periodo.anno);
  const impostaAnno = usePreferenze((s) => s.impostaAnno);
  const oggi = React.useMemo(() => new Date().toISOString().slice(0, 10), []);
  const anni = useAnniDisponibili(anno, oggi);
  const solaLettura = useSolaLettura();

  const [query, setQuery] = React.useState("");
  const [selezionato, setSelezionato] = React.useState(0);
  const elencoRef = React.useRef<HTMLDivElement>(null);

  // Ogni apertura riparte da capo: una palette che ricorda la ricerca di ieri
  // costringe a cancellare prima di scrivere.
  React.useEffect(() => {
    if (aperta) {
      setQuery("");
      setSelezionato(0);
    }
  }, [aperta]);

  const vocabolario = React.useMemo(() => {
    const clienti = dati?.clienti ?? [];
    const nome = (id: string) => clienti.find((c) => c.id === id)?.nome ?? "Senza cliente";
    return comandi({
      solaLettura,
      annoCorrente: anno,
      anni: [...anni].sort((a, b) => b - a),
      fatture: (dati?.fatture ?? [])
        .slice()
        .sort((a, b) => b.dataEmissione.localeCompare(a.dataEmissione))
        .map((f) => ({
          id: f.id,
          numero: f.numero,
          cliente: nome(f.clienteId),
          imponibile: f.imponibile,
          incassata: Boolean(f.dataIncasso),
        })),
      clienti: clienti.map((c) => ({ id: c.id, nome: c.nome })),
    });
  }, [dati, anno, anni, solaLettura]);

  const esiti = React.useMemo(() => cerca(vocabolario, query), [vocabolario, query]);
  const gruppi = React.useMemo(() => perSezione(esiti), [esiti]);
  const attivo = esiti[Math.min(selezionato, esiti.length - 1)];

  async function esegui(azione: Azione) {
    chiudi();
    switch (azione.tipo) {
      case "vai":
        router.push(azione.href);
        return;
      case "nuovaFattura":
        router.push("/fatture");
        chiedi({ tipo: "nuovaFattura" });
        return;
      case "nuovaNota":
        router.push("/note");
        chiedi({ tipo: "nuovaNota" });
        return;
      case "nuovoCosto":
        router.push("/costi");
        chiedi({ tipo: "nuovoCosto" });
        return;
      case "apriFattura":
        router.push("/fatture");
        chiedi({ tipo: "cercaFatture", testo: azione.numero });
        return;
      case "apriCliente":
        router.push("/clienti");
        chiedi({ tipo: "cercaClienti", testo: azione.nome });
        return;
      case "cambiaAnno":
        impostaAnno(azione.anno);
        toast.conferma(`Anno ${azione.anno}`);
        return;
      case "segnaIncassata": {
        const fattura = (dati?.fatture ?? []).find((f) => f.id === azione.fatturaId);
        if (!fattura) return;
        // La data di incasso è oggi: è il caso normale, e resta modificabile
        // nella tabella. Un incasso di ieri si corregge lì in due secondi.
        await archivio().fatture.salva({ ...fattura, dataIncasso: oggi });
        toast.conferma(`Fattura ${fattura.numero} segnata incassata`);
        return;
      }
      case "esportaBackup": {
        const contenuto = await archivio().leggiTutto();
        scaricaTesto(nomeFileBackup(), serializzaBackup(creaBackup(contenuto)));
        toast.conferma("Backup esportato");
        return;
      }
    }
  }

  function tasti(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || (e.key === "n" && e.ctrlKey)) {
      e.preventDefault();
      setSelezionato((s) => (esiti.length === 0 ? 0 : (s + 1) % esiti.length));
    } else if (e.key === "ArrowUp" || (e.key === "p" && e.ctrlKey)) {
      e.preventDefault();
      setSelezionato((s) => (esiti.length === 0 ? 0 : (s - 1 + esiti.length) % esiti.length));
    } else if (e.key === "Enter" && attivo) {
      e.preventDefault();
      void esegui(attivo.comando.azione);
    }
  }

  // La voce selezionata resta in vista anche quando si scorre con le frecce.
  React.useEffect(() => {
    const nodo = elencoRef.current?.querySelector<HTMLElement>('[data-attivo="true"]');
    nodo?.scrollIntoView({ block: "nearest" });
  }, [selezionato, esiti]);

  return (
    <DialogPrimitive.Root open={aperta} onOpenChange={(v) => !v && chiudi()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-inchiostro/25 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          onKeyDown={tasti}
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-4 z-50 w-[min(38rem,calc(100vw-1.5rem))] -translate-x-1/2 sm:top-[12vh]",
            "overflow-hidden rounded-card border border-bordo bg-superficie shadow-sollevato focus:outline-none",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Comandi</DialogPrimitive.Title>

          <div className="flex items-center gap-2 border-b border-bordo px-4">
            <Search className="size-4 shrink-0 text-inchiostro-tenue" aria-hidden />
            {/* Combobox nella forma canonica: il fuoco non lascia mai il campo,
                e la voce corrente si annuncia con `aria-activedescendant`.
                Senza, chi usa uno screen reader vede una riga evidenziarsi e
                non sente nulla. */}
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-autocomplete="list"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelezionato(0);
              }}
              // Corto: a 390 px un segnaposto lungo si taglia a metà parola.
              placeholder="Cerca comandi, clienti, fatture…"
              aria-label="Cerca un comando"
              aria-controls="risultati-comandi"
              aria-activedescendant={attivo ? idVoce(attivo.comando.id) : undefined}
              className="w-full bg-transparent py-3.5 text-campo outline-none placeholder:text-inchiostro-tenue"
            />
          </div>

          <div
            id="risultati-comandi"
            ref={elencoRef}
            role="listbox"
            aria-label="Risultati"
            className="max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain p-2"
          >
            {esiti.length === 0 ? (
              <p className="px-2 py-6 text-center text-etichetta text-inchiostro-tenue">
                Nessun comando per «{query.trim()}».
              </p>
            ) : (
              gruppi.map((gruppo) => (
                <div
                  key={gruppo.sezione}
                  role="group"
                  aria-label={gruppo.sezione}
                  className="mb-1 last:mb-0"
                >
                  <p aria-hidden className="px-2 pb-1 pt-2 text-micro text-inchiostro-tenue">
                    {gruppo.sezione}
                  </p>
                  {gruppo.esiti.map((esito) => (
                    <Voce
                      key={esito.comando.id}
                      esito={esito}
                      attivo={esito.comando.id === attivo?.comando.id}
                      onSelezione={() => setSelezionato(esiti.indexOf(esito))}
                      onEsegui={() => void esegui(esito.comando.azione)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Tutta la riga parla di tasti — ↑ ↓, Invio, Esc — e rimanda alla
              schermata delle scorciatoie. Sotto i 768 non c'è una tastiera a cui
              riferirsi: la riga sparisce invece di spiegare gesti inesistenti. */}
          <div className="hidden flex-wrap items-center gap-x-4 gap-y-1 border-t border-bordo bg-superficie-alt px-4 py-2 text-micro text-inchiostro-tenue md:flex">
            <span>
              <Tasto>↑</Tasto> <Tasto>↓</Tasto> scorri
            </span>
            <span>
              <Tasto>Invio</Tasto> esegui
            </span>
            <span>
              <Tasto>Esc</Tasto> chiudi
            </span>
            <a href="/scorciatoie" className="ml-auto underline underline-offset-2 hover:text-inchiostro">
              Tutte le scorciatoie
            </a>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Voce({
  esito,
  attivo,
  onSelezione,
  onEsegui,
}: {
  esito: Esito;
  attivo: boolean;
  onSelezione: () => void;
  onEsegui: () => void;
}) {
  const { comando, indici } = esito;
  return (
    <button
      type="button"
      role="option"
      id={idVoce(comando.id)}
      aria-selected={attivo}
      data-attivo={attivo}
      onMouseMove={onSelezione}
      onFocus={onSelezione}
      onClick={onEsegui}
      className={cn(
        "flex w-full items-center gap-3 rounded-campo px-2 py-2 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accento",
        attivo ? "bg-superficie-alt" : "hover:bg-superficie-alt/60",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-corpo">
        {tratti(comando.etichetta, indici).map((t, i) => (
          <span key={i} className={t.evidenziato ? "font-semibold text-accento" : undefined}>
            {t.testo}
          </span>
        ))}
      </span>
      {comando.dettaglio && (
        <span className="hidden shrink-0 text-etichetta text-inchiostro-tenue sm:block">
          {comando.dettaglio}
        </span>
      )}
      {comando.scorciatoia && (
        <span className="hidden shrink-0 gap-1 sm:flex">
          {comando.scorciatoia.split(" ").map((t) => (
            <Tasto key={t}>{t}</Tasto>
          ))}
        </span>
      )}
    </button>
  );
}

/** Gli id delle voci: servono ad `aria-activedescendant`, non allo stile. */
function idVoce(id: string): string {
  return `comando-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function Tasto({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="cifre inline-flex min-w-5 items-center justify-center rounded-[5px] border border-bordo bg-superficie px-1.5 py-0.5 text-micro font-medium text-inchiostro-tenue">
      {children}
    </kbd>
  );
}
