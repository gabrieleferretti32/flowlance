"use client";

/**
 * Le categorie del modulo, con i due interruttori che contano.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché ogni flag porta con sé la sua conseguenza, scritta
 * ─────────────────────────────────────────────────────────────────────────
 *
 * «Fissa» e «pagata dall'accantonamento» non descrivono la categoria: cambiano
 * un numero in un'altra schermata. La prima sposta una spesa dal gruppo delle
 * variabili a quello delle fisse nel limite mensile; la seconda toglie la
 * categoria da **tutti e quattro** i gruppi, perché quei soldi sono già stati
 * messi da parte e contarli come spesa li conterebbe due volte.
 *
 * Un interruttore senza la sua conseguenza è una preferenza: si accende a
 * caso, e il numero che cambia altrove sembra un errore dell'app. Con la riga
 * accanto è una decisione.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Quante volte si usa, prima di toccarla
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Accanto a ogni categoria c'è il numero di movimenti dell'anno. Rinominare
 * una categoria con duecento movimenti dentro è una cosa, rinominarne una mai
 * usata è un'altra, e il conto è l'unico modo di saperlo senza aprire il
 * registro e contare a mano.
 */
import * as React from "react";
import { Plus, Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Campo, Input } from "@/components/ui/input";
import { BloccoScrittura } from "@/components/ui/blocco-scrittura";
import { Switch } from "@/components/ui/switch";
import { Vuoto } from "@/components/ui/vuoto";
import { CellaModificabile } from "@/components/tabella/cella-modificabile";
import { Guscio } from "@/components/guscio/guscio";
import { useDati } from "@/lib/dati/hooks";
import { usePreferenze } from "@/lib/stato/preferenze";
import {
  creaCategoria,
  eliminaCategoria,
  salvaCategoria,
  seminaCategorie,
} from "@/lib/dati/azioni";
import { nomeGiaUsato, usoDelleCategorie } from "@/lib/finanze/categorie";
import type { CategoriaPf, MovimentoPf, TipoCategoria } from "@/lib/finanze/tipi";
import { cn } from "@/lib/utils";

const TIPI: { valore: TipoCategoria; etichetta: string; sottotitolo: string }[] = [
  { valore: "entrata", etichetta: "Entrate", sottotitolo: "Quello che arriva sul conto" },
  { valore: "spesa", etichetta: "Spese", sottotitolo: "Quello che esce, fisso o variabile" },
  { valore: "risparmio", etichetta: "Risparmi", sottotitolo: "Quello che metti via" },
  { valore: "rata", etichetta: "Rate", sottotitolo: "Quello che devi a scadenza fissa" },
];

export function SchermataCategorie() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const dati = useDati();

  const uso = React.useMemo(
    () => (dati ? usoDelleCategorie(dati.pfMovimenti, anno) : new Map<string, number>()),
    [dati, anno],
  );

  if (!dati) {
    return (
      <Guscio titolo="Categorie">
        <Card>
          <CaricamentoTabella righe={8} />
        </Card>
      </Guscio>
    );
  }

  const categorie = dati.pfCategorie;

  if (categorie.length === 0) {
    return (
      <Guscio titolo="Categorie" descrizione="Come si chiamano le tue entrate e le tue spese">
        <div className="mx-auto max-w-4xl">
          <Card>
            <Vuoto
              icona={Tags}
              titolo="Nessuna categoria. Si parte da quelle suggerite e poi si cambia tutto."
              azione={
                <Button scrive variante="contorno" onClick={() => void seminaCategorie()}>
                  Usa le diciannove categorie di partenza
                </Button>
              }
            />
          </Card>
        </div>
      </Guscio>
    );
  }

  return (
    <Guscio
      titolo="Categorie"
      descrizione={`Anno ${anno} · i due interruttori cambiano il limite di spesa, non solo l'etichetta`}
    >
      <div className="mx-auto max-w-4xl space-y-4">
        {/*
          Le due spiegazioni stanno qui, una volta sola.

          La prima stesura le ripeteva sotto ogni categoria: diciannove volte
          le stesse quattro righe, e l'elenco diventava un documento invece di
          una lista da scorrere. Una spiegazione ripetuta venti volte non si
          legge venti volte — non si legge nemmeno una.
        */}
        <Card>
          <CardCorpo className="space-y-2">
            <CardTitolo>I due interruttori</CardTitolo>
            <p className="text-etichetta text-inchiostro-tenue">
              <strong className="text-inchiostro">Fissa</strong> — solo per le spese: nel limite
              mensile la categoria finisce fra le fisse invece che fra le variabili, e le fisse si
              sottraggono per intero all&apos;inizio del mese.
            </p>
            <p className="text-etichetta text-inchiostro-tenue">
              <strong className="text-inchiostro">Pagata dall&apos;accantonamento</strong> — la
              categoria esce da <strong className="text-inchiostro">tutti e quattro</strong> i
              gruppi del limite (entrate, fisse, risparmi, rate), perché quei soldi sono già messi
              da parte: contarli anche come spesa li conterebbe due volte. È il caso di Tasse, INPS
              e F24.
            </p>
          </CardCorpo>
        </Card>

        {TIPI.map(({ valore, etichetta, sottotitolo }) => {
          const dellaLista = categorie.filter((c) => c.tipo === valore);
          return (
            <Card key={valore}>
              <CardCorpo className="pb-3">
                <CardTitolo>{etichetta}</CardTitolo>
                <CardSottotitolo>{sottotitolo}</CardSottotitolo>
              </CardCorpo>

              {dellaLista.length === 0 ? (
                <Vuoto titolo={`Nessuna categoria di ${etichetta.toLowerCase()}.`} />
              ) : (
                <ul className="divide-y divide-bordo/70 border-y border-bordo">
                  {dellaLista.map((c) => (
                    <RigaCategoria
                      key={c.id}
                      categoria={c}
                      movimenti={dati.pfMovimenti}
                      quanti={uso.get(c.id) ?? 0}
                      anno={anno}
                    />
                  ))}
                </ul>
              )}

              <CardCorpo className="pt-3">
                <ModuloCategoria tipo={valore} categorie={categorie} />
              </CardCorpo>
            </Card>
          );
        })}
      </div>
    </Guscio>
  );
}

function RigaCategoria({
  categoria,
  movimenti,
  quanti,
  anno,
}: {
  categoria: CategoriaPf;
  movimenti: MovimentoPf[];
  quanti: number;
  anno: number;
}) {
  const idFissa = React.useId();
  const idCoperta = React.useId();
  const spesa = categoria.tipo === "spesa";

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-6 py-2">
        <span className="flex min-w-48 flex-1 items-center gap-2">
          {categoria.icona && <span aria-hidden>{categoria.icona}</span>}
          <CellaModificabile
            tipo="testo"
            etichetta={`Nome di ${categoria.nome}`}
            valore={categoria.nome}
            className="min-w-40 flex-1"
            onSalva={(v) => {
              const nome = String(v ?? "").trim();
              if (nome === "" || nome === categoria.nome) return;
              void salvaCategoria({ ...categoria, nome });
            }}
          />
        </span>
        {/*
          Quanti movimenti ha **quest'anno**: si legge prima di toccare la
          categoria, ed è il motivo per cui sta sulla riga e non dentro un
          dettaglio da aprire.
        */}
        <span
          className={cn(
            "w-40 shrink-0 text-right text-micro",
            quanti === 0 ? "text-inchiostro-tenue/70" : "text-inchiostro-tenue",
          )}
        >
          {quanti === 0
            ? `mai usata nel ${anno}`
            : `${quanti} ${quanti === 1 ? "movimento" : "movimenti"} nel ${anno}`}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {spesa && (
            <Interruttore
              id={idFissa}
              etichetta="Fissa"
              attivo={categoria.fissa}
              onCambia={(v) =>
                void salvaCategoria(
                  { ...categoria, fissa: v },
                  v ? "Adesso è una spesa fissa" : "Adesso è una spesa variabile",
                )
              }
            />
          )}
          <Interruttore
            id={idCoperta}
            etichetta="Accantonamento"
            attivo={categoria.pagataDallAccantonamento}
            onCambia={(v) =>
              void salvaCategoria(
                { ...categoria, pagataDallAccantonamento: v },
                v ? "Esclusa dal limite di spesa" : "Torna dentro il limite di spesa",
              )
            }
          />
          <Button
            scrive
            variante="quieto"
            taglia="icona"
            aria-label={`Elimina ${categoria.nome}`}
            onClick={() => void eliminaCategoria(categoria, movimenti)}
            className="hover:bg-negativo-tenue hover:text-negativo"
          >
            <Trash2 className="size-4" />
          </Button>
        </span>
    </li>
  );
}

/**
 * L'interruttore sulla riga: etichetta corta, spiegazione in testa alla
 * schermata. Il nome per chi legge con lo screen reader resta intero, perché
 * lì la brevità non serve a niente e il contesto della pagina non si vede.
 */
function Interruttore({
  id,
  etichetta,
  attivo,
  onCambia,
}: {
  id: string;
  etichetta: string;
  attivo: boolean;
  onCambia: (v: boolean) => void;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <Switch id={id} checked={attivo} onCheckedChange={onCambia} className="h-5 w-9" />
      <label htmlFor={id} className="cursor-pointer whitespace-nowrap text-micro">
        {etichetta}
      </label>
    </span>
  );
}

function ModuloCategoria({
  tipo,
  categorie,
}: {
  tipo: TipoCategoria;
  categorie: CategoriaPf[];
}) {
  const [nome, setNome] = React.useState("");
  const idCampo = React.useId();

  /*
    Il doppione si dice **mentre si scrive**, non dopo aver premuto. Rifiutare
    a cose fatte è lo stesso controllo con il costo scaricato su chi compila.
  */
  const occupato = nomeGiaUsato(categorie, tipo, nome);
  const vuoto = nome.trim() === "";

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (vuoto || occupato) return;
        void creaCategoria({ tipo, nome, fissa: false, pagataDallAccantonamento: false });
        setNome("");
      }}
    >
      <BloccoScrittura className="contents">
        <Campo
          etichetta="Nuova categoria"
          htmlFor={idCampo}
          className="min-w-40 flex-1"
        >
          <Input
            id={idCampo}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            aria-invalid={occupato || undefined}
            placeholder="Es. Palestra"
            className={cn(occupato && "border-negativo")}
          />
        </Campo>
        <Button type="submit" variante="contorno" disabled={vuoto || occupato}>
          <Plus className="size-4" aria-hidden />
          Aggiungi
        </Button>
      </BloccoScrittura>
      {occupato && (
        <p className="w-full text-micro text-negativo">
          C&apos;è già una categoria con questo nome fra quelle di questo tipo.
        </p>
      )}
    </form>
  );
}
