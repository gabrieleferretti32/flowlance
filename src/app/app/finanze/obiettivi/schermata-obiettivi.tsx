"use client";

/**
 * Le mete di risparmio.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La barra che non si riempie da sola
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Ogni meta dichiara **da dove si misura**: il saldo di un conto, oppure i
 * movimenti di una categoria da una certa data. Chi non dichiara niente non ha
 * una barra: ha una riga che dice che l'avanzamento non si sa. È la scelta
 * scomoda — un'app di risparmio senza barre colorate sembra povera — ed è
 * l'unica che non racconta bugie il secondo mese.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * E quello che le mete chiedono, confrontato con quello che metti via
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Tre mete belle da 300 € al mese fanno 900 € al mese, che è il numero che
 * nessuna app mostra. Qui sta in cima, accanto a quanto è davvero uscito verso
 * il risparmio in questo mese: le due cifre insieme sono la domanda vera, e
 * arrivano dallo stesso calcolo del limite di spesa.
 */
import * as React from "react";
import Link from "next/link";
import { Plus, Target, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Chip } from "@/components/ui/chip";
import { Campo, Input } from "@/components/ui/input";
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
import { ROTTE } from "@/lib/rotte";
import { useDati, useSituazioneMese } from "@/lib/dati/hooks";
import { usePreferenze } from "@/lib/stato/preferenze";
import { creaObiettivo, eliminaObiettivo, salvaObiettivo } from "@/lib/dati/azioni";
import {
  fabbisognoMensile,
  inOrdine,
  statoObiettivi,
  type StatoObiettivo,
} from "@/lib/finanze/obiettivi";
import type { CategoriaPf, ContoPersonale, FonteObiettivo, ObiettivoPf } from "@/lib/finanze/tipi";
import { analizzaNumero, data as fmtData, euro, nomeMese, percentuale } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Il valore che il menu usa per «nessuna fonte»: una stringa, non un `null`. */
const SENZA_FONTE = "nessuna";

/** Le categorie fra cui si sceglie una fonte: quelle in cui il denaro si mette via. */
const tipiDaRisparmio: CategoriaPf["tipo"][] = ["risparmio"];

export function SchermataObiettivi() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const dati = useDati();
  const situazione = useSituazioneMese(anno, oggi);

  const stati = React.useMemo(
    () =>
      dati
        ? inOrdine(
            statoObiettivi({
              obiettivi: dati.pfObiettivi,
              conti: dati.pfConti,
              movimenti: dati.pfMovimenti,
              oggi,
            }),
          )
        : [],
    [dati, oggi],
  );

  if (!dati) {
    return (
      <Guscio titolo="Mete di risparmio">
        <Card>
          <CaricamentoTabella righe={5} />
        </Card>
      </Guscio>
    );
  }

  const fabbisogno = fabbisognoMensile(stati);
  const categorieDiRisparmio = dati.pfCategorie.filter((c) => tipiDaRisparmio.includes(c.tipo));

  return (
    <Guscio
      titolo="Mete di risparmio"
      descrizione="Quanto manca, in quanto tempo, e da dove si misura"
    >
      <div className="mx-auto max-w-4xl space-y-4">
        {stati.length > 0 && (
          <Card>
            <CardCorpo className="space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
                <span className="flex flex-col">
                  <span className="text-micro text-inchiostro-tenue">
                    Quello che le mete chiedono, al mese
                  </span>
                  <strong className="text-kpi-sm">{euro(fabbisogno.totale)}</strong>
                </span>
                {situazione && (
                  <span className="flex flex-col">
                    <span className="text-micro text-inchiostro-tenue">
                      Quello che metti via in {nomeMese(situazione.meseCorrente).toLowerCase()}
                    </span>
                    <strong
                      className={cn(
                        "text-kpi-sm",
                        situazione.riga.risparmi < fabbisogno.totale && "text-attenzione",
                      )}
                    >
                      {euro(situazione.riga.risparmi)}
                    </strong>
                  </span>
                )}
              </div>

              {/*
                Il totale dice anche quello che **non** contiene: una somma che
                lascia fuori due mete su cinque, senza dirlo, è più bassa del
                vero e sembra una buona notizia.
              */}
              {fabbisogno.escluse > 0 && (
                <p className="text-etichetta text-inchiostro-tenue">
                  Nel totale non{" "}
                  {fabbisogno.escluse === 1 ? "c'è una meta" : `ci sono ${fabbisogno.escluse} mete`}
                  : senza una data non si può dire quanto al mese, e senza una fonte non si sa
                  quanto manchi.
                </p>
              )}
              {situazione && situazione.riga.risparmi < fabbisogno.totale && (
                <p className="text-etichetta text-attenzione">
                  Questo mese stai mettendo via{" "}
                  {euro(fabbisogno.totale - situazione.riga.risparmi)} in meno di quello che le
                  mete chiedono. Non è un errore dell&apos;app: è la differenza fra quello che hai
                  deciso e quello che sta succedendo.{" "}
                  <Link href={ROTTE.finanzeSpesa} className="underline underline-offset-2">
                    Vedi quanto puoi spendere
                  </Link>
                  .
                </p>
              )}
            </CardCorpo>
          </Card>
        )}

        <Card>
          <CardCorpo className="pb-3">
            <CardTitolo>Le tue mete</CardTitolo>
            <CardSottotitolo>
              L&apos;avanzamento si legge da un conto o da una categoria: nessuna cifra si
              aggiorna a mano.
            </CardSottotitolo>
          </CardCorpo>

          {stati.length === 0 ? (
            <Vuoto
              icona={Target}
              titolo="Nessuna meta. Una meta è un importo, una data, e il posto dove si misura."
            />
          ) : (
            <ul className="divide-y divide-bordo/70 border-y border-bordo">
              {stati.map((stato) => (
                <RigaMeta
                  key={stato.obiettivo.id}
                  stato={stato}
                  conti={dati.pfConti}
                  categorie={categorieDiRisparmio}
                />
              ))}
            </ul>
          )}

          <CardCorpo className="pt-3">
            <ModuloMeta conti={dati.pfConti} categorie={categorieDiRisparmio} oggi={oggi} />
          </CardCorpo>
        </Card>
      </div>
    </Guscio>
  );
}

function RigaMeta({
  stato,
  conti,
  categorie,
}: {
  stato: StatoObiettivo;
  conti: ContoPersonale[];
  categorie: CategoriaPf[];
}) {
  const { obiettivo, accumulato, quota } = stato;

  return (
    <li className="space-y-2 px-6 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="flex min-w-44 flex-1 items-center gap-2">
          {obiettivo.icona && <span aria-hidden>{obiettivo.icona}</span>}
          <CellaModificabile
            tipo="testo"
            etichetta={`Nome di ${obiettivo.nome}`}
            valore={obiettivo.nome}
            className="min-w-36 flex-1"
            onSalva={(v) => {
              const nome = String(v ?? "").trim();
              if (nome === "" || nome === obiettivo.nome) return;
              void salvaObiettivo({ ...obiettivo, nome });
            }}
          />
        </span>

        <CellaModificabile
          tipo="valuta"
          etichetta={`Importo di ${obiettivo.nome}`}
          valore={obiettivo.obiettivo}
          className="w-28 text-right"
          onSalva={(v) => {
            const importo = Number(v ?? 0);
            if (!(importo > 0)) return;
            void salvaObiettivo({ ...obiettivo, obiettivo: importo });
          }}
        />

        <CellaModificabile
          tipo="data"
          etichetta={`Data di ${obiettivo.nome}`}
          valore={obiettivo.entro}
          vuoto="senza data"
          className="w-32 text-right"
          onSalva={(v) => void salvaObiettivo({ ...obiettivo, entro: v ? String(v) : null })}
        />

        <span className="w-32 shrink-0 text-right text-micro text-inchiostro-tenue">
          {stato.alMese === null ? "—" : `${euro(stato.alMese)} al mese`}
        </span>

        <Button
          scrive
          variante="quieto"
          taglia="icona"
          aria-label={`Elimina ${obiettivo.nome}`}
          onClick={() => void eliminaObiettivo(obiettivo)}
          className="hover:bg-negativo-tenue hover:text-negativo"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {/*
        La barra c'è solo quando c'è qualcosa da misurare. Senza fonte resta la
        frase, che dice la verità: non si sa.
      */}
      {accumulato === null ? (
        <p className="text-micro text-inchiostro-tenue">
          {stato.fonteMancante ? (
            <>
              <strong className="text-attenzione">La fonte non c&apos;è più.</strong> Questa meta
              misurava {obiettivo.fonte === "conto" ? "un conto" : "una categoria"} che è stato
              eliminato: scegline un&apos;altra qui sotto, l&apos;avanzamento intanto non si sa.
            </>
          ) : (
            <>
              <strong>L&apos;avanzamento non si sa.</strong> Scegli da dove misurarlo — un conto o
              una categoria di risparmio — e la cifra arriva da sola.
            </>
          )}
        </p>
      ) : (
        <>
          <Barra quota={quota ?? 0} raggiunto={stato.raggiunto} scaduto={stato.scaduto} />
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-inchiostro-tenue">
            <span>
              {euro(accumulato)} di {euro(obiettivo.obiettivo)} · {percentuale(quota, 0)}
            </span>
            {stato.raggiunto ? (
              <Chip tono="positivo">raggiunta</Chip>
            ) : (
              <span>mancano {euro(stato.mancano ?? 0)}</span>
            )}
            {stato.scaduto && <Chip tono="negativo">la data è passata</Chip>}
            {/*
              Il doppio conteggio, detto dove succede: due mete sullo stesso
              conto mostrano lo stesso saldo, e sommare le due barre
              racconterebbe un patrimonio che non c'è.
            */}
            {stato.condivisa && (
              <Chip tono="attenzione" title="Un'altra meta misura la stessa fonte: è lo stesso denaro, mostrato due volte.">
                stessa fonte di un&apos;altra meta
              </Chip>
            )}
          </p>
        </>
      )}

      <SceltaFonte obiettivo={obiettivo} conti={conti} categorie={categorie} />
    </li>
  );
}

/** La barra: piena quanto la quota, mai oltre il bordo. */
function Barra({
  quota,
  raggiunto,
  scaduto,
}: {
  quota: number;
  raggiunto: boolean;
  scaduto: boolean;
}) {
  const percento = Math.min(100, Math.max(0, quota * 100));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-superficie-alt"
      role="progressbar"
      aria-valuenow={Math.round(percento)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300 ease-quieto",
          raggiunto ? "bg-positivo" : scaduto ? "bg-negativo" : "bg-accento",
        )}
        style={{ width: `${percento}%` }}
      />
    </div>
  );
}

/** Da dove si misura: il menu con i conti, le categorie di risparmio, e «nessuna». */
function SceltaFonte({
  obiettivo,
  conti,
  categorie,
}: {
  obiettivo: ObiettivoPf;
  conti: ContoPersonale[];
  categorie: CategoriaPf[];
}) {
  const id = React.useId();
  const valore =
    obiettivo.fonte === "nessuna" || !obiettivo.fonteId
      ? SENZA_FONTE
      : `${obiettivo.fonte}:${obiettivo.fonteId}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={id} className="text-micro text-inchiostro-tenue">
        Si misura da
      </label>
      <BloccoScrittura>
        <Select
          value={valore}
          onValueChange={(v) => {
            const [fonte, fonteId] = v === SENZA_FONTE ? [SENZA_FONTE, null] : v.split(":");
            void salvaObiettivo(
              {
                ...obiettivo,
                fonte: fonte as FonteObiettivo,
                fonteId: fonteId ?? null,
              },
              "Fonte della meta aggiornata",
            );
          }}
        >
          <SelectTrigger id={id} className="h-8 w-60 text-micro">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SENZA_FONTE}>Niente: l&apos;avanzamento non si sa</SelectItem>
            {conti.map((c) => (
              <SelectItem key={c.id} value={`conto:${c.id}`}>
                Saldo del conto «{c.nome}»
              </SelectItem>
            ))}
            {categorie.map((c) => (
              <SelectItem key={c.id} value={`categoria:${c.id}`}>
                Movimenti di «{c.nome}» dal {fmtData(obiettivo.dal)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </BloccoScrittura>
      {obiettivo.fonte === "categoria" && (
        <span className="text-micro text-inchiostro-tenue">
          contati dal {fmtData(obiettivo.dal)}: quello di prima era già stato messo via per altro
        </span>
      )}
    </div>
  );
}

function ModuloMeta({
  conti,
  categorie,
  oggi,
}: {
  conti: ContoPersonale[];
  categorie: CategoriaPf[];
  oggi: string;
}) {
  const [nome, setNome] = React.useState("");
  const [importo, setImporto] = React.useState("");
  const [entro, setEntro] = React.useState("");
  const [fonte, setFonte] = React.useState(SENZA_FONTE);

  const numero = analizzaNumero(importo);
  const completo = nome.trim() !== "" && numero !== null && numero > 0;

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!completo) return;
        const [tipo, id] = fonte === SENZA_FONTE ? [SENZA_FONTE, null] : fonte.split(":");
        void creaObiettivo({
          nome,
          obiettivo: Math.abs(numero),
          entro: entro === "" ? null : entro,
          fonte: tipo as FonteObiettivo,
          fonteId: id ?? null,
          /*
            Si conta da oggi, non dall'inizio dell'anno: una meta nata adesso
            non ha già dentro i risparmi di gennaio, che sono stati messi via
            per altro. La data si può cambiare dopo, ed è una decisione di chi
            la cambia.
          */
          dal: oggi,
        });
        setNome("");
        setImporto("");
        setEntro("");
      }}
    >
      <BloccoScrittura className="contents">
        <Campo etichetta="Nuova meta" htmlFor="o-nome" className="min-w-40 flex-1">
          <Input
            id="o-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Es. Fondo emergenza"
          />
        </Campo>
        <Campo etichetta="Importo" htmlFor="o-importo" className="w-32">
          <Input
            id="o-importo"
            numerico
            inputMode="decimal"
            value={importo}
            onChange={(e) => setImporto(e.target.value)}
            placeholder="0,00"
          />
        </Campo>
        <Campo etichetta="Entro (facoltativo)" htmlFor="o-entro" className="w-44">
          <Input id="o-entro" type="date" value={entro} onChange={(e) => setEntro(e.target.value)} />
        </Campo>
        <Campo etichetta="Si misura da" htmlFor="o-fonte" className="w-56">
          <Select value={fonte} onValueChange={setFonte}>
            <SelectTrigger id="o-fonte">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SENZA_FONTE}>Niente, per adesso</SelectItem>
              {conti.map((c) => (
                <SelectItem key={c.id} value={`conto:${c.id}`}>
                  Saldo del conto «{c.nome}»
                </SelectItem>
              ))}
              {categorie.map((c) => (
                <SelectItem key={c.id} value={`categoria:${c.id}`}>
                  Movimenti di «{c.nome}»
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Button type="submit" variante="contorno" disabled={!completo}>
          <Plus className="size-4" aria-hidden />
          Aggiungi
        </Button>
      </BloccoScrittura>
    </form>
  );
}
