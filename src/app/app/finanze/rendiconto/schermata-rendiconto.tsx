"use client";

/**
 * Carica rendiconto: dai file CSV della banca al registro, passando da
 * un'anteprima che si può correggere.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il conto si sceglie prima di leggere
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Ogni file appartiene a un conto, e va detto **prima**: senza, le righe
 * entrerebbero tutte sul primo conto disponibile e i giroconti — che sono
 * coppie fra due conti — non si troverebbero mai. Chiederlo dopo vorrebbe dire
 * chiederlo quando l'errore è già stato fatto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Niente profili di banca, niente rete, niente modelli
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le colonne le mappa chi carica, una volta per conto, e la mappatura resta
 * attaccata al conto. Le categorie le propongono prima le sue regole, poi un
 * dizionario di parole italiane, e quello che non si riconosce va in «Non
 * definito» invece di essere indovinato. Tutto nel browser, come il resto
 * dell'app: i movimenti bancari non escono di qui per essere catalogati.
 */
import * as React from "react";
import Link from "next/link";
import { FileUp, RotateCcw, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { Campo, Input } from "@/components/ui/input";
import { BloccoScrittura } from "@/components/ui/blocco-scrittura";
import { Chip } from "@/components/ui/chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Vuoto } from "@/components/ui/vuoto";
import { Guscio } from "@/components/guscio/guscio";
import { ROTTE } from "@/lib/rotte";
import { useDati } from "@/lib/dati/hooks";
import { leggiCsv, type Tabella } from "@/lib/csv/parser";
import { scegliFile } from "@/lib/dati/file";
import { nuovoId } from "@/lib/dati/tipi";
import {
  annullaImportRendiconto,
  creaRegola,
  eseguiImportRendiconto,
  salvaMappaturaConto,
  seminaCategorie,
} from "@/lib/dati/azioni";
import {
  anteprimaImport,
  movimentiDaScrivere,
  type RigaAnteprima,
} from "@/lib/finanze/anteprima-import";
import { tipoDiCategoria } from "@/lib/finanze/categorizza";
import {
  applicaMappatura,
  proponiMappatura,
  type MappaturaColonne,
  type ScartoRendiconto,
} from "@/lib/finanze/rendiconto";
import type { ContoPersonale, ImportPf, TipoMovimento } from "@/lib/finanze/tipi";
import { data as fmtData } from "@/lib/format";
import { cn } from "@/lib/utils";

const TIPI: { valore: TipoMovimento; etichetta: string }[] = [
  { valore: "entrata", etichetta: "Entrata" },
  { valore: "spesa", etichetta: "Spesa" },
  { valore: "risparmio", etichetta: "Risparmio" },
  { valore: "rata", etichetta: "Rata" },
  { valore: "giroconto", etichetta: "Giroconto" },
];

type FileCaricato = {
  nome: string;
  testo: string;
  contoId: string;
  tabella: Tabella;
  mappatura: MappaturaColonne | null;
};

export function SchermataRendiconto() {
  const dati = useDati();
  const [file, setFile] = React.useState<FileCaricato[]>([]);
  const [righe, setRighe] = React.useState<RigaAnteprima[] | null>(null);
  const [scarti, setScarti] = React.useState<ScartoRendiconto[]>([]);

  const conti = dati?.pfConti ?? [];
  const categorie = dati?.pfCategorie ?? [];

  async function aggiungiFile() {
    const scelto = await scegliFile("text/csv,.csv,text/plain");
    if (scelto === null) return;
    const tabella = leggiCsv(scelto.testo);
    const contoId = conti[0]?.id ?? "";
    const salvata = conti.find((c) => c.id === contoId)?.mappaturaImport ?? null;
    setFile((f) => [
      ...f,
      {
        nome: scelto.nome,
        testo: scelto.testo,
        contoId,
        tabella,
        mappatura: salvata ?? proponiMappatura(tabella.intestazioni),
      },
    ]);
    setRighe(null);
  }

  function cambiaConto(indice: number, contoId: string) {
    setFile((f) =>
      f.map((x, i) =>
        i === indice
          ? {
              ...x,
              contoId,
              /* Cambiando conto, torna buona la mappatura salvata di quel
                 conto: è la sua banca, non quella di prima. */
              mappatura:
                conti.find((c) => c.id === contoId)?.mappaturaImport
                ?? proponiMappatura(x.tabella.intestazioni),
            }
          : x,
      ),
    );
    setRighe(null);
  }

  function leggi() {
    if (!dati) return;
    const scartate: ScartoRendiconto[] = [];
    const letti = file
      .filter((f) => f.mappatura !== null && f.contoId !== "")
      .map((f) => {
        const esito = applicaMappatura(f.tabella, f.mappatura as MappaturaColonne);
        scartate.push(...esito.scartate.map((s) => ({ ...s, grezzo: `${f.nome}: ${s.grezzo}` })));
        return { nome: f.nome, contoId: f.contoId, righe: esito.righe };
      });

    setRighe(
      anteprimaImport({
        file: letti,
        categorie,
        regole: dati.pfRegole,
        esistenti: dati.pfMovimenti,
        contiTracciati: conti.map((c) => c.id),
      }),
    );
    setScarti(scartate);

    // La mappatura confermata resta attaccata al conto, per il mese prossimo.
    for (const f of file) {
      const conto = conti.find((c) => c.id === f.contoId);
      if (conto && f.mappatura) void salvaMappaturaConto(conto, f.mappatura);
    }
  }

  async function conferma() {
    if (!righe) return;
    const importId = nuovoId();
    const movimenti = movimentiDaScrivere(
      righe.map((r) => ({ ...r, importId })),
      importId,
      nuovoId,
    );
    await eseguiImportRendiconto(
      movimenti,
      file.map((f) => f.nome),
      file[0]?.contoId ?? "",
    );
    setFile([]);
    setRighe(null);
    setScarti([]);
  }

  if (!dati) {
    return (
      <Guscio titolo="Carica rendiconto">
        <Card>
          <CardCorpo>Un momento…</CardCorpo>
        </Card>
      </Guscio>
    );
  }

  if (conti.length === 0) {
    return (
      <Guscio titolo="Carica rendiconto" descrizione="I movimenti della banca, dentro il registro">
        <div className="mx-auto max-w-4xl">
          <Card>
            <Vuoto
              icona={FileUp}
              titolo="Prima servono i conti: ogni file appartiene a uno di loro."
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

  const scelte = righe?.filter((r) => r.scelta).length ?? 0;

  return (
    <Guscio
      titolo="Carica rendiconto"
      descrizione="CSV della banca · più file insieme, uno per conto"
    >
      <div className="mx-auto max-w-5xl space-y-4">
        <Card>
          <CardCorpo className="pb-3">
            <CardTitolo>I file</CardTitolo>
            <CardSottotitolo>
              Un file per conto. Il conto si sceglie prima di leggere: le due metà di un giroconto
              stanno in due rendiconti diversi, e senza sapere di chi sono non si trovano.
            </CardSottotitolo>
          </CardCorpo>

          {file.length > 0 && (
            <ul className="divide-y divide-bordo/70 border-y border-bordo">
              {file.map((f, i) => (
                <li key={`${f.nome}-${i}`} className="space-y-2 px-6 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-40 flex-1 font-medium">{f.nome}</span>
                    <span className="text-micro text-inchiostro-tenue">
                      {f.tabella.righe.length} righe · separatore «{f.tabella.separatore}»
                    </span>
                    <Select value={f.contoId} onValueChange={(v) => cambiaConto(i, v)}>
                      <SelectTrigger className="w-44" aria-label={`Conto di ${f.nome}`}>
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
                    <Button
                      variante="quieto"
                      taglia="icona"
                      aria-label={`Togli ${f.nome}`}
                      onClick={() => {
                        setFile((x) => x.filter((_, j) => j !== i));
                        setRighe(null);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <Mappatura
                    intestazioni={f.tabella.intestazioni}
                    mappatura={f.mappatura}
                    onCambia={(m) => {
                      setFile((x) => x.map((y, j) => (j === i ? { ...y, mappatura: m } : y)));
                      setRighe(null);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}

          <CardCorpo className="flex flex-wrap items-center gap-2 pt-3">
            <BloccoScrittura>
              <Button variante="contorno" onClick={() => void aggiungiFile()}>
                <FileUp className="size-4" aria-hidden />
                Aggiungi un file CSV
              </Button>
            </BloccoScrittura>
            {file.length > 0 && (
              <Button
                onClick={leggi}
                disabled={file.some((f) => f.mappatura === null || f.contoId === "")}
              >
                Leggi {file.length === 1 ? "il file" : `i ${file.length} file`}
              </Button>
            )}
            {categorie.length === 0 && (
              <Button scrive variante="contorno" onClick={() => void seminaCategorie()}>
                Prima semina le categorie
              </Button>
            )}
          </CardCorpo>
        </Card>

        {righe !== null && (
          <Card>
            <CardCorpo className="pb-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <CardTitolo>Anteprima</CardTitolo>
                  <CardSottotitolo>
                    {scelte === righe.length
                      ? `${righe.length} righe, tutte scelte`
                      : `${scelte} righe scelte su ${righe.length}`}
                    {righe.some((r) => r.duplicato) &&
                      " · i doppioni arrivano senza spunta, ma restano visibili"}
                  </CardSottotitolo>
                </div>
                <Button onClick={() => void conferma()} disabled={scelte === 0}>
                  Importa {scelte} {scelte === 1 ? "movimento" : "movimenti"}
                </Button>
              </div>
            </CardCorpo>

            <ul className="divide-y divide-bordo/70 border-y border-bordo">
              {righe.map((r) => (
                <RigaAnteprimaVista
                  key={r.id}
                  riga={r}
                  conti={conti}
                  categorie={categorie}
                  onCambia={(nuova) =>
                    setRighe((x) => (x ?? []).map((y) => (y.id === r.id ? nuova : y)))
                  }
                />
              ))}
            </ul>

            {scarti.length > 0 && (
              <CardCorpo className="pt-3">
                <p className="text-micro text-attenzione">
                  {scarti.length === 1
                    ? "Una riga non si è potuta leggere"
                    : `${scarti.length} righe non si sono potute leggere`}
                  : {scarti.slice(0, 4).map((s) => `riga ${s.indice} (${s.motivo})`).join(", ")}
                  {scarti.length > 4 && "…"}. Se sono intestazioni o totali va bene così; se sono
                  movimenti, controlla la mappatura delle colonne.
                </p>
              </CardCorpo>
            )}
          </Card>
        )}

        <StoricoImport importazioni={dati.pfImport} />

        {/*
          Il raccordo con l'altro import, come fra i due patrimoni: ognuno dice
          che cosa accetta e dove sta l'altro.
        */}
        <p className="text-micro text-inchiostro-tenue">
          Qui entrano i <strong>rendiconti bancari</strong>, e diventano movimenti personali. Le
          fatture, i costi e i clienti si caricano da{" "}
          <Link href={ROTTE.importa} className="underline underline-offset-2">
            Importa da CSV
          </Link>
          , che scrive nei registri fiscali.
        </p>
      </div>
    </Guscio>
  );
}

function Mappatura({
  intestazioni,
  mappatura,
  onCambia,
}: {
  intestazioni: string[];
  mappatura: MappaturaColonne | null;
  onCambia: (m: MappaturaColonne) => void;
}) {
  const vuoto: MappaturaColonne = {
    data: 0,
    descrizione: 1,
    forma: { tipo: "unica", importo: 2 },
  };
  const m = mappatura ?? vuoto;
  const separate = m.forma.tipo === "separate";

  const Tendina = ({
    etichetta,
    valore,
    onScegli,
  }: {
    etichetta: string;
    valore: number;
    onScegli: (i: number) => void;
  }) => (
    <Campo etichetta={etichetta} className="w-40">
      <Select value={String(valore)} onValueChange={(v) => onScegli(Number(v))}>
        <SelectTrigger aria-label={etichetta}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {intestazioni.map((h, i) => (
            <SelectItem key={`${h}-${i}`} value={String(i)}>
              {h || `Colonna ${i + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Campo>
  );

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-interna bg-superficie-alt/60 p-3">
      {mappatura === null && (
        <p className="w-full text-micro text-attenzione">
          Le intestazioni non bastano per proporre una mappatura: scegli le colonne a mano.
        </p>
      )}
      <Tendina etichetta="Data" valore={m.data} onScegli={(i) => onCambia({ ...m, data: i })} />
      <Tendina
        etichetta="Descrizione"
        valore={m.descrizione}
        onScegli={(i) => onCambia({ ...m, descrizione: i })}
      />
      {m.forma.tipo === "unica" ? (
        <Tendina
          etichetta="Importo"
          valore={m.forma.importo}
          onScegli={(i) => onCambia({ ...m, forma: { tipo: "unica", importo: i } })}
        />
      ) : (
        <>
          <Tendina
            etichetta="Entrate"
            valore={m.forma.entrate}
            onScegli={(i) =>
              onCambia({
                ...m,
                forma: { tipo: "separate", entrate: i, uscite: (m.forma as { uscite: number }).uscite },
              })
            }
          />
          <Tendina
            etichetta="Uscite"
            valore={m.forma.uscite}
            onScegli={(i) =>
              onCambia({
                ...m,
                forma: { tipo: "separate", entrate: (m.forma as { entrate: number }).entrate, uscite: i },
              })
            }
          />
        </>
      )}
      <Button
        variante="quieto"
        taglia="sm"
        onClick={() =>
          onCambia({
            ...m,
            forma: separate
              ? { tipo: "unica", importo: 2 }
              : { tipo: "separate", entrate: 2, uscite: 3 },
          })
        }
      >
        {separate ? "Una colonna sola" : "Entrate e uscite separate"}
      </Button>
      {m.forma.tipo === "unica" && (
        <Button
          variante="quieto"
          taglia="sm"
          onClick={() => onCambia({ ...m, invertiSegno: !m.invertiSegno })}
        >
          {m.invertiSegno ? "Segno rovesciato ✓" : "Rovescia il segno"}
        </Button>
      )}
    </div>
  );
}

function RigaAnteprimaVista({
  riga,
  conti,
  categorie,
  onCambia,
}: {
  riga: RigaAnteprima;
  conti: ContoPersonale[];
  categorie: { id: string; nome: string; tipo: string }[];
  onCambia: (r: RigaAnteprima) => void;
}) {
  const perQuestoTipo = categorie.filter((c) => c.tipo === tipoDiCategoria(riga.tipo));
  const [parola, setParola] = React.useState("");
  const [chiedeRegola, setChiedeRegola] = React.useState(false);

  return (
    <li className={cn("px-6 py-2", !riga.scelta && "bg-superficie-alt/40")}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          checked={riga.scelta}
          onChange={(e) => onCambia({ ...riga, scelta: e.target.checked })}
          aria-label={`Importa la riga del ${fmtData(riga.data)}`}
          className="size-4 accent-[var(--accento)]"
        />
        <span className="w-24 shrink-0 text-micro text-inchiostro-tenue">{fmtData(riga.data)}</span>
        <span className="min-w-40 flex-1 truncate" title={riga.descrizione}>
          {riga.descrizione}
          {riga.duplicato && (
            <Chip tono="attenzione" className="ml-2">
              già presente
            </Chip>
          )}
          {riga.daGiroconto && <Chip className="ml-2">giroconto</Chip>}
        </span>

        <Select
          value={riga.tipo}
          onValueChange={(v) => onCambia({ ...riga, tipo: v as TipoMovimento })}
        >
          <SelectTrigger className="w-32" aria-label={`Tipo della riga del ${fmtData(riga.data)}`}>
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

        {riga.tipo !== "giroconto" && (
          <Select
            value={riga.categoriaId}
            onValueChange={(v) => {
              onCambia({ ...riga, categoriaId: v });
              setChiedeRegola(true);
              setParola(primaParolaUtile(riga.descrizione));
            }}
          >
            <SelectTrigger className="w-40" aria-label={`Categoria della riga del ${fmtData(riga.data)}`}>
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
        )}

        <Select value={riga.contoId} onValueChange={(v) => onCambia({ ...riga, contoId: v })}>
          <SelectTrigger className="w-36" aria-label={`Conto della riga del ${fmtData(riga.data)}`}>
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

        <Input
          numerico
          inputMode="decimal"
          value={String(riga.importo).replace(".", ",")}
          onChange={(e) => {
            const n = Number(e.target.value.replace(",", "."));
            if (Number.isFinite(n)) onCambia({ ...riga, importo: Math.abs(n) });
          }}
          aria-label={`Importo della riga del ${fmtData(riga.data)}`}
          className="w-28 text-right"
        />
        <span className="w-4 shrink-0 text-micro text-inchiostro-tenue">
          {riga.tipo === "entrata" ? "+" : riga.tipo === "giroconto" ? "→" : "−"}
        </span>
      </div>

      {/*
        La proposta di regola nasce dalla correzione, non da un menu: è il
        momento in cui la persona ha appena detto qual è la categoria giusta,
        e l'unico in cui sa perché.
      */}
      {chiedeRegola && riga.tipo !== "giroconto" && (
        <div className="mt-2 flex flex-wrap items-end gap-2 rounded-interna bg-superficie-alt/60 p-2.5">
          <Wand2 className="mb-2 size-4 text-accento" aria-hidden />
          <Campo etichetta="D'ora in poi, quando la descrizione contiene" className="min-w-40 flex-1">
            <Input value={parola} onChange={(e) => setParola(e.target.value)} />
          </Campo>
          <BloccoScrittura>
            <Button
              variante="contorno"
              taglia="sm"
              onClick={() => {
                void creaRegola({
                  testoDaCercare: parola,
                  categoriaId: riga.categoriaId,
                  tipo: riga.tipo,
                });
                setChiedeRegola(false);
              }}
            >
              Crea la regola
            </Button>
          </BloccoScrittura>
          <Button variante="quieto" taglia="sm" onClick={() => setChiedeRegola(false)}>
            No, solo questa volta
          </Button>
        </div>
      )}
    </li>
  );
}

/** La parola più lunga della descrizione: di norma è il nome del negozio. */
function primaParolaUtile(descrizione: string): string {
  const parole = descrizione
    .split(/[^\p{L}\p{N}]+/u)
    .filter((p) => p.length > 3 && !/^\d+$/.test(p));
  return parole.sort((a, b) => b.length - a.length)[0] ?? descrizione.trim();
}

function StoricoImport({ importazioni }: { importazioni: ImportPf[] }) {
  if (importazioni.length === 0) return null;
  const ordinate = [...importazioni].sort((a, b) => b.data.localeCompare(a.data));
  return (
    <Card>
      <CardCorpo className="pb-3">
        <CardTitolo>Import fatti</CardTitolo>
        <CardSottotitolo>
          Ognuno si annulla: i suoi movimenti se ne vanno, quelli scritti a mano restano.
        </CardSottotitolo>
      </CardCorpo>
      <ul className="divide-y divide-bordo/70 border-y border-bordo">
        {ordinate.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2 px-6 py-2">
            <span className="w-28 shrink-0 text-micro text-inchiostro-tenue">
              {fmtData(i.data.slice(0, 10))}
            </span>
            <span className="min-w-40 flex-1 truncate" title={i.file}>
              {i.file}
            </span>
            <span className="text-micro text-inchiostro-tenue">
              {i.numeroMovimenti} {i.numeroMovimenti === 1 ? "movimento" : "movimenti"}
            </span>
            <BloccoScrittura>
              <Button
                variante="quieto"
                taglia="sm"
                onClick={() => void annullaImportRendiconto(i)}
              >
                <RotateCcw className="size-4" aria-hidden />
                Annulla
              </Button>
            </BloccoScrittura>
          </li>
        ))}
      </ul>
    </Card>
  );
}
