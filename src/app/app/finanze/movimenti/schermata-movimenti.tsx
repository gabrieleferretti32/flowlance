"use client";

/**
 * Il registro dei movimenti personali.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Gli importi si scrivono positivi, il verso lo dice il tipo
 * ─────────────────────────────────────────────────────────────────────────
 *
 * «Spesa 40 €», non «−40 €». Il segno nel campo è un errore che si fa una
 * volta su venti e che nessuno rilegge: un «−40» su una riga di tipo spesa
 * diventerebbe un'entrata travestita, e il saldo se ne accorgerebbe solo come
 * scarto. Il verso sta nel tipo, che è un elenco chiuso, e l'elenco lo mostra
 * con il segno davanti — quello sì, calcolato.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il giroconto ha due conti e nessuna categoria
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Spostare denaro fra due conti propri non è né un'entrata né una spesa: non
 * cambia di un centesimo quello che hai. Quindi il modulo chiede il conto di
 * destinazione e smette di chiedere la categoria — `categoriaId` resta vuoto,
 * che è la sua verità — e i totali del registro lo contano fra le righe ma non
 * fra le entrate e le uscite.
 */
import * as React from "react";
import { ArrowLeftRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Campo, Input } from "@/components/ui/input";
import { InputData } from "@/components/ui/input-data";
import { BloccoScrittura } from "@/components/ui/blocco-scrittura";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Vuoto } from "@/components/ui/vuoto";
import { CellaModificabile } from "@/components/tabella/cella-modificabile";
import { Guscio } from "@/components/guscio/guscio";
import Link from "next/link";
import { ROTTE } from "@/lib/rotte";
import { useDati } from "@/lib/dati/hooks";
import { usePreferenze } from "@/lib/stato/preferenze";
import {
  creaMovimentoPf,
  eliminaMovimentoPf,
  salvaMovimentoPf,
  seminaCategorie,
} from "@/lib/dati/azioni";
import {
  FILTRO_VUOTO,
  filtraRegistro,
  mesiConMovimenti,
  totaliRegistro,
  type FiltroRegistro,
} from "@/lib/finanze/registro";
import type { MovimentoPf, TipoMovimento } from "@/lib/finanze/tipi";
import { analizzaNumero, data as fmtData, euro, nomeMese } from "@/lib/format";
import { cn } from "@/lib/utils";

const TIPI: { valore: TipoMovimento; etichetta: string }[] = [
  { valore: "entrata", etichetta: "Entrata" },
  { valore: "spesa", etichetta: "Spesa" },
  { valore: "risparmio", etichetta: "Risparmio" },
  { valore: "rata", etichetta: "Rata" },
  { valore: "giroconto", etichetta: "Giroconto" },
];

const etichettaTipo = (t: TipoMovimento) =>
  TIPI.find((x) => x.valore === t)?.etichetta ?? "Spesa";

/** Il tipo di categoria che un movimento può usare. I giroconti non ne hanno. */
const categoriaPerTipo = (t: TipoMovimento) => (t === "giroconto" ? null : t);

const TUTTI = "tutti";

export function SchermataMovimenti() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const dati = useDati();
  const [filtro, setFiltro] = React.useState<FiltroRegistro>(() => FILTRO_VUOTO(anno));

  // L'anno lo comanda la barra in alto, come in tutte le altre schermate.
  React.useEffect(() => setFiltro((f) => ({ ...f, anno })), [anno]);

  const righe = React.useMemo(
    () => (dati ? filtraRegistro(dati.pfMovimenti, filtro) : []),
    [dati, filtro],
  );
  const totali = React.useMemo(
    () => totaliRegistro(righe, filtro.contoId),
    [righe, filtro.contoId],
  );

  if (!dati) {
    return (
      <Guscio titolo="Movimenti">
        <Card>
          <CaricamentoTabella righe={8} />
        </Card>
      </Guscio>
    );
  }

  const conti = dati.pfConti;
  const categorie = dati.pfCategorie;
  const nomeConto = (id: string | null | undefined) =>
    conti.find((c) => c.id === id)?.nome ?? "—";
  const nomeCategoria = (id: string) => categorie.find((c) => c.id === id)?.nome ?? "—";
  const mesi = mesiConMovimenti(dati.pfMovimenti, filtro.anno);

  /*
    Senza conti non si registra niente, e dirlo qui è meglio che offrire un
    modulo che non può funzionare: un movimento senza conto non ha un posto da
    cui uscire.
  */
  if (conti.length === 0) {
    return (
      <Guscio titolo="Movimenti" descrizione="Il registro delle entrate e delle spese personali">
        <div className="mx-auto max-w-4xl">
          <Card>
            <Vuoto
              icona={ArrowLeftRight}
              titolo="Prima servono i conti: un movimento deve sapere da dove esce."
              azione={
                <Button asChild variante="contorno">
                  <Link href={ROTTE.finanzeConti}>Vai a Conti e patrimonio</Link>
                </Button>
              }
            />
          </Card>
        </div>
      </Guscio>
    );
  }

  return (
    <Guscio titolo="Movimenti" descrizione={`Anno ${filtro.anno} · entrate, spese e giroconti`}>
      <div className="mx-auto max-w-4xl space-y-4">
        <Card>
          <CardCorpo className="pb-3">
            <CardTitolo>Registra un movimento</CardTitolo>
            <CardSottotitolo>
              L&apos;importo si scrive positivo: il verso lo dice il tipo.
            </CardSottotitolo>
          </CardCorpo>
          <CardCorpo className="pt-0">
            {categorie.length === 0 ? (
              <Vuoto
                titolo="Ogni movimento vuole una categoria, e non ce n'è ancora nessuna."
                azione={
                  <Button scrive variante="contorno" onClick={() => void seminaCategorie()}>
                    Usa le diciannove categorie di partenza
                  </Button>
                }
              />
            ) : (
              <ModuloMovimento conti={conti} categorie={categorie} oggi={oggi} />
            )}
          </CardCorpo>
        </Card>

        <Card>
          <CardCorpo className="pb-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <CardTitolo>Registro</CardTitolo>
                <CardSottotitolo>
                  {totali.quanti === 0
                    ? "nessun movimento con questi filtri"
                    : `${totali.quanti === 1 ? "un movimento" : `${totali.quanti} movimenti`} · ${euro(totali.entrate)} in entrata · ${euro(totali.uscite)} in uscita`}
                  {totali.effettoSulConto !== null && totali.quanti > 0 && (
                    <>
                      {" · "}
                      {/*
                        «di queste righe», non «sul saldo»: il saldo del conto
                        parte da un'ancora e conta solo i movimenti datati dopo
                        di quella, quindi questa somma e il saldo possono
                        muoversi in modo diverso. Dirlo nell'etichetta costa
                        tre parole e toglie un'aspettativa sbagliata.
                      */}
                      <span className={cn(totali.effettoSulConto < 0 && "text-negativo")}>
                        {euro(totali.effettoSulConto)} di effetto sul conto scelto, in queste righe
                      </span>
                    </>
                  )}
                </CardSottotitolo>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Campo etichetta="Mese" htmlFor="f-mese" className="w-36">
                  <Select
                    value={filtro.mese === null ? TUTTI : String(filtro.mese)}
                    onValueChange={(v) =>
                      setFiltro((f) => ({ ...f, mese: v === TUTTI ? null : Number(v) }))
                    }
                  >
                    <SelectTrigger id="f-mese">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TUTTI}>Tutti i mesi</SelectItem>
                      {mesi.map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {nomeMese(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Campo>
                <Campo etichetta="Tipo" htmlFor="f-tipo" className="w-36">
                  <Select
                    value={filtro.tipo ?? TUTTI}
                    onValueChange={(v) =>
                      setFiltro((f) => ({ ...f, tipo: v === TUTTI ? null : (v as TipoMovimento) }))
                    }
                  >
                    <SelectTrigger id="f-tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TUTTI}>Tutti i tipi</SelectItem>
                      {TIPI.map((t) => (
                        <SelectItem key={t.valore} value={t.valore}>
                          {t.etichetta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Campo>
                <Campo etichetta="Conto" htmlFor="f-conto" className="w-40">
                  <Select
                    value={filtro.contoId ?? TUTTI}
                    onValueChange={(v) =>
                      setFiltro((f) => ({ ...f, contoId: v === TUTTI ? null : v }))
                    }
                  >
                    <SelectTrigger id="f-conto">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TUTTI}>Tutti i conti</SelectItem>
                      {conti.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Campo>
              </div>
            </div>
          </CardCorpo>

          {righe.length === 0 ? (
            <Vuoto
              icona={ArrowLeftRight}
              titolo={
                dati.pfMovimenti.length === 0
                  ? "Il registro è vuoto. Il primo movimento si scrive qui sopra."
                  : "Nessun movimento con questi filtri."
              }
            />
          ) : (
            <ul className="divide-y divide-bordo/70 border-y border-bordo">
              {righe.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2 px-6 py-2">
                  <span className="w-24 shrink-0 text-micro text-inchiostro-tenue">
                    {fmtData(m.data)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <CellaModificabile
                      tipo="testo"
                      etichetta={`Descrizione del movimento del ${fmtData(m.data)}`}
                      valore={m.descrizione}
                      vuoto="senza descrizione"
                      onSalva={(v) => void salvaMovimentoPf({ ...m, descrizione: String(v ?? "") })}
                    />
                    <span className="block px-2 text-micro text-inchiostro-tenue">
                      {etichettaTipo(m.tipo)}
                      {m.tipo === "giroconto"
                        ? ` · ${nomeConto(m.contoId)} → ${nomeConto(m.contoDestinazioneId)}`
                        : ` · ${nomeCategoria(m.categoriaId)} · ${nomeConto(m.contoId)}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span
                      className={cn(
                        "cifre w-32 px-2 text-right text-corpo",
                        m.tipo === "entrata" && "text-positivo",
                        m.tipo === "giroconto" && "text-inchiostro-tenue",
                      )}
                    >
                      {segnoDi(m)}
                      {euro(m.importo)}
                    </span>
                    <Button
                      scrive
                      variante="quieto"
                      taglia="icona"
                      aria-label={`Elimina il movimento del ${fmtData(m.data)}`}
                      onClick={() => void eliminaMovimentoPf(m)}
                      className="hover:bg-negativo-tenue hover:text-negativo"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Guscio>
  );
}

/**
 * Il segno davanti all'importo: calcolato, non scritto.
 *
 * Un giroconto non ha segno — esce da una parte ed entra dall'altra, e con un
 * conto filtrato il verso lo dice già la riga «sul conto scelto».
 */
function segnoDi(m: MovimentoPf): string {
  if (m.tipo === "giroconto") return "";
  return m.tipo === "entrata" ? "+" : "−";
}

function ModuloMovimento({
  conti,
  categorie,
  oggi,
}: {
  conti: { id: string; nome: string }[];
  categorie: { id: string; nome: string; tipo: string }[];
  oggi: string;
}) {
  const [data, setData] = React.useState(oggi);
  const [tipo, setTipo] = React.useState<TipoMovimento>("spesa");
  const [importo, setImporto] = React.useState("");
  const [descrizione, setDescrizione] = React.useState("");
  const [contoId, setContoId] = React.useState(conti[0]?.id ?? "");
  const [destinazioneId, setDestinazioneId] = React.useState(conti[1]?.id ?? conti[0]?.id ?? "");
  const [categoriaId, setCategoriaId] = React.useState("");

  const perQuestoTipo = React.useMemo(
    () => categorie.filter((c) => c.tipo === categoriaPerTipo(tipo)),
    [categorie, tipo],
  );

  /* Cambiando tipo, una categoria dell'altro tipo non ha più senso: si sceglie
     la prima buona invece di restare su una che non comparirebbe nell'elenco. */
  React.useEffect(() => {
    if (tipo === "giroconto") return;
    if (!perQuestoTipo.some((c) => c.id === categoriaId)) {
      setCategoriaId(perQuestoTipo[0]?.id ?? "");
    }
  }, [tipo, perQuestoTipo, categoriaId]);

  const numero = analizzaNumero(importo) ?? 0;
  const giroconto = tipo === "giroconto";
  const completo =
    numero > 0 &&
    contoId !== "" &&
    (giroconto ? destinazioneId !== "" && destinazioneId !== contoId : categoriaId !== "");

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!completo) return;
        void creaMovimentoPf({
          data,
          tipo,
          importo: Math.abs(numero),
          descrizione: descrizione.trim(),
          contoId,
          // Un giroconto non ha categoria: il campo resta vuoto, che è la sua verità.
          categoriaId: giroconto ? "" : categoriaId,
          ...(giroconto ? { contoDestinazioneId: destinazioneId } : {}),
        });
        setImporto("");
        setDescrizione("");
      }}
    >
      <BloccoScrittura className="contents">
        {/*
          La data di un movimento è quella che si scrive a mano più spesso, ed
          è dove l'inversione giorno/mese fa più danni: il 3 aprile registrato
          il 4 marzo finisce nel mese sbagliato, cambia il limite di due mesi e
          non lo nota nessuno. Il campo nativo mostra il formato della lingua
          del browser — vedi `InputData` — quindi qui non si usa.
        */}
        <Campo etichetta="Data" htmlFor="m-data" className="w-40">
          <InputData id="m-data" valore={data} onCambia={(iso) => setData(iso ?? "")} />
        </Campo>
        <Campo etichetta="Tipo" htmlFor="m-tipo" className="w-36">
          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoMovimento)}>
            <SelectTrigger id="m-tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPI.map((t) => (
                <SelectItem key={t.valore} value={t.valore}>
                  {t.etichetta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo etichetta="Importo" htmlFor="m-importo" className="w-32">
          <Input
            id="m-importo"
            numerico
            inputMode="decimal"
            value={importo}
            onChange={(e) => setImporto(e.target.value)}
            placeholder="0,00"
          />
        </Campo>
        <Campo
          etichetta={giroconto ? "Dal conto" : "Conto"}
          htmlFor="m-conto"
          className="w-40"
        >
          <Select value={contoId} onValueChange={setContoId}>
            <SelectTrigger id="m-conto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {conti.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        {giroconto ? (
          <Campo etichetta="Al conto" htmlFor="m-destinazione" className="w-40">
            <Select value={destinazioneId} onValueChange={setDestinazioneId}>
              <SelectTrigger id="m-destinazione">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {conti
                  .filter((c) => c.id !== contoId)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Campo>
        ) : (
          <Campo etichetta="Categoria" htmlFor="m-categoria" className="w-44">
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger id="m-categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {perQuestoTipo.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
        )}
        <Campo etichetta="Descrizione" htmlFor="m-descrizione" className="min-w-40 flex-1">
          <Input
            id="m-descrizione"
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            placeholder={giroconto ? "Es. Giro sul libretto" : "Es. Spesa settimanale"}
          />
        </Campo>
        <Button type="submit" variante="contorno" disabled={!completo}>
          <Plus className="size-4" aria-hidden />
          Registra
        </Button>
      </BloccoScrittura>
    </form>
  );
}
