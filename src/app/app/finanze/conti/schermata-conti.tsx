"use client";

/**
 * Conti e patrimonio: la prima schermata delle finanze personali.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Due cifre grandi, e non una sola
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il **saldo totale** è quanto c'è sui conti adesso; il **patrimonio netto** è
 * quello più tutto il resto, meno i debiti. Sono due domande diverse — «posso
 * pagare?» e «come sto?» — e una sola cifra risponderebbe male a tutte e due.
 * Chi ha 3.000 € sul conto e 84.000 € di mutuo non è ricco di 3.000 € né
 * povero di 81.000: è tutte e due le cose, in due momenti diversi.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il saldo si scrive, non si somma
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il saldo di un conto parte da quello che scrivi tu — «oggi ho 2.340 €» — e
 * si muove con i movimenti **successivi a quella data**. Non si costruisce
 * sommando la storia dall'inizio dei tempi, perché la storia arriva a pezzi:
 * caricherai i rendiconti mese per mese, e ogni pezzo nuovo cambierebbe il
 * saldo di oggi. Con l'ancora no: il passato che arriva riempie il registro e
 * lascia stare il presente. È la regola che `saldoConto` tiene, e questa
 * schermata è il posto dove la si dichiara a chi la usa.
 */
import * as React from "react";
import Link from "next/link";
import { Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Cifra, Etichetta } from "@/components/ui/etichetta";
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
import { useDati } from "@/lib/dati/hooks";
import {
  creaBene,
  creaConto,
  eliminaBene,
  eliminaConto,
  salvaBene,
  salvaConto,
} from "@/lib/dati/azioni";
import { CLASSI, patrimonio } from "@/lib/finanze/patrimonio";
import { saldoConto } from "@/lib/finanze/saldo";
import type { BenePf, ClasseBene, ContoPersonale, TipoConto } from "@/lib/finanze/tipi";
import { analizzaNumero, data as fmtData, euro } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Come si chiamano i tipi di conto, in un posto solo. */
const TIPI_CONTO: { valore: TipoConto; etichetta: string }[] = [
  { valore: "corrente", etichetta: "Conto corrente" },
  { valore: "deposito", etichetta: "Conto deposito" },
  { valore: "carta", etichetta: "Carta" },
  { valore: "contanti", etichetta: "Contanti" },
  { valore: "wallet", etichetta: "Wallet" },
];

export function SchermataConti() {
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const dati = useDati();

  const conto = React.useMemo(
    () => (dati ? patrimonio(dati.pfConti, dati.pfMovimenti, dati.pfBeni, oggi) : null),
    [dati, oggi],
  );

  if (!dati || !conto) {
    return (
      <Guscio titolo="Conti e patrimonio">
        <Card>
          <CaricamentoTabella righe={6} />
        </Card>
      </Guscio>
    );
  }

  const conMovimenti = (c: ContoPersonale) =>
    dati.pfMovimenti.filter((m) => m.contoId === c.id || m.contoDestinazioneId === c.id).length;

  return (
    <Guscio
      titolo="Conti e patrimonio"
      descrizione="I tuoi conti con il saldo, e tutto quello che possiedi o devi"
    >
      <div className="mx-auto max-w-4xl space-y-4">
        <section
          aria-label="Quanto hai, e quanto ne è tuo"
          className="grid items-start gap-4 lg:grid-cols-2"
        >
          <Card className="p-5">
            <Etichetta>Saldo totale</Etichetta>
            <Cifra className="mt-3">{euro(conto.liquidita)}</Cifra>
            <p className="mt-1.5 text-micro text-inchiostro-tenue">
              {dati.pfConti.length === 0
                ? "nessun conto ancora"
                : `somma di ${dati.pfConti.length === 1 ? "un conto" : `${dati.pfConti.length} conti`}, al ${fmtData(oggi)}`}
            </p>
          </Card>

          <Card className="p-5">
            <Etichetta>Patrimonio netto</Etichetta>
            <Cifra className={cn("mt-3", conto.netto < 0 && "text-negativo")}>
              {euro(conto.netto)}
            </Cifra>
            <p className="mt-1.5 text-micro text-inchiostro-tenue">
              il saldo più quello che possiedi, meno quello che devi
            </p>
            {/*
              Le righe che compongono il netto. Ci sono solo quelle che hanno
              qualcosa dentro: sei classi a zero sono un modulo da riempire, non
              un'informazione, e la prima cosa che una persona vede aprendo la
              schermata non dev'essere il suo elenco di cose che non ha.
            */}
            {(dati.pfConti.length > 0 || dati.pfBeni.length > 0) && (
            <dl className="mt-4 divide-y divide-bordo/70 border-t border-bordo text-micro">
              <RigaNetto
                etichetta="Contanti e risparmi"
                nota="somma dei conti"
                valore={conto.liquidita}
              />
              {conto.righe
                .filter((r) => r.voci.length > 0)
                .map((r) => (
                  <RigaNetto
                    key={r.classe}
                    etichetta={r.etichetta}
                    nota={r.voci.length === 1 ? "una voce" : `${r.voci.length} voci`}
                    valore={r.valore}
                  />
                ))}
            </dl>
            )}
            {/*
              Il mutuo senza la casa: il debito c'è, il bene no, e il netto
              scende di tutto il valore dell'immobile. Non è un errore da
              correggere al posto di chi scrive — magari la casa non è sua — ed
              è per questo una riga che spiega, non un avviso che allarma.
            */}
            {conto.mancaImmobile && (
              <p className="mt-3 text-micro text-attenzione">
                Fra i debiti c&apos;è un mutuo e fra i beni fisici non c&apos;è niente: manca il
                valore dell&apos;immobile, quindi il netto è più basso del reale.
              </p>
            )}
          </Card>
        </section>

        <Card>
          <CardCorpo className="pb-3">
            <CardTitolo>Conti</CardTitolo>
            <CardSottotitolo>
              Scrivi il saldo di oggi. I rendiconti dei mesi passati non lo cambiano, i movimenti
              registrati dopo sì.
            </CardSottotitolo>
          </CardCorpo>

          {dati.pfConti.length === 0 ? (
            <Vuoto icona={Wallet} titolo="Nessun conto. Aggiungi il primo qui sotto." />
          ) : (
            <ul className="divide-y divide-bordo/70 border-y border-bordo">
              {dati.pfConti.map((c) => {
                const movimenti = conMovimenti(c);
                return (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-6 py-2"
                  >
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <CellaModificabile
                        tipo="testo"
                        etichetta={`Nome di ${c.nome}`}
                        valore={c.nome}
                        className="min-w-40 flex-1"
                        onSalva={(v) => void salvaConto({ ...c, nome: String(v ?? "").trim() || c.nome })}
                      />
                      <CellaModificabile
                        tipo="scelta"
                        etichetta={`Tipo di ${c.nome}`}
                        valore={c.tipo}
                        opzioni={TIPI_CONTO}
                        className="w-40"
                        onSalva={(v) => void salvaConto({ ...c, tipo: v as TipoConto })}
                      />
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {/*
                        Si modifica il saldo **di riferimento**, e insieme si
                        riporta l'ancora a oggi: chi scrive «adesso ho 2.100 €»
                        sta dicendo una cosa vera adesso, non il 1° gennaio. Senza
                        spostare la data, i movimenti già registrati verrebbero
                        applicati sopra una cifra che li contiene già.
                      */}
                      {/*
                        Il saldo mostrato è quello scritto **più i movimenti
                        registrati dopo**, quindi non è sempre la cifra che si è
                        digitata. La data dell'ancora sta accanto a ogni conto e
                        non solo nel totale: senza, la differenza fra quello che
                        hai scritto e quello che leggi non ha nessuna
                        spiegazione a portata d'occhio.
                      */}
                      <span className="flex flex-col items-end">
                        <CellaModificabile
                          tipo="valuta"
                          etichetta={`Saldo di ${c.nome}`}
                          valore={saldoConto(c, dati.pfMovimenti, oggi)}
                          className="w-36"
                          onSalva={(v) =>
                            void salvaConto(
                              { ...c, saldoRiferimento: Number(v ?? 0), dataRiferimento: oggi },
                              "Saldo aggiornato a oggi",
                            )
                          }
                        />
                        <span className="px-2 text-micro text-inchiostro-tenue">
                          scritto il {fmtData(c.dataRiferimento)}
                          {movimenti > 0 &&
                            ` · ${movimenti === 1 ? "un movimento" : `${movimenti} movimenti`} dopo`}
                        </span>
                      </span>
                      <Button
                        scrive
                        variante="quieto"
                        taglia="icona"
                        aria-label={`Elimina ${c.nome}`}
                        title={
                          movimenti === 0
                            ? `Elimina ${c.nome}`
                            : `Elimina ${c.nome} e i suoi ${movimenti} movimenti`
                        }
                        onClick={() => void eliminaConto(c, dati.pfMovimenti)}
                        className="hover:bg-negativo-tenue hover:text-negativo"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <CardCorpo className="pt-3">
            <ModuloConto oggi={oggi} />
          </CardCorpo>
        </Card>

        <Card>
          <CardCorpo className="pb-3">
            <CardTitolo>Beni e debiti</CardTitolo>
            <CardSottotitolo>
              Valori che aggiorni tu quando cambiano. I debiti si scrivono positivi: il meno lo
              mette il patrimonio netto.
            </CardSottotitolo>
          </CardCorpo>

          {dati.pfBeni.length === 0 ? (
            <Vuoto
              titolo="Investimenti, casa o auto, crediti, fondo pensione, mutuo residuo…"
            />
          ) : (
            <ul className="divide-y divide-bordo/70 border-y border-bordo">
              {conto.righe
                .filter((r) => r.voci.length > 0)
                .map((r) => (
                  <li key={r.classe}>
                    <p className="bg-superficie-alt/70 px-6 py-1.5 text-micro text-inchiostro-tenue">
                      {r.etichetta}
                      <span className="cifre float-right font-medium text-inchiostro">
                        {euro(r.valore)}
                      </span>
                    </p>
                    <ul className="divide-y divide-bordo/70">
                      {r.voci.map((b) => (
                        <li
                          key={b.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-6 py-2"
                        >
                          <CellaModificabile
                            tipo="testo"
                            etichetta={`Nome di ${b.nome}`}
                            valore={b.nome}
                            className="min-w-40 flex-1"
                            onSalva={(v) =>
                              void salvaBene({ ...b, nome: String(v ?? "").trim() || b.nome })
                            }
                          />
                          <div className="flex shrink-0 items-center gap-1">
                            <CellaModificabile
                              tipo="valuta"
                              etichetta={`Valore di ${b.nome}`}
                              valore={b.valore}
                              className="w-36"
                              onSalva={(v) =>
                                void salvaBene({
                                  ...b,
                                  valore: Math.abs(Number(v ?? 0)),
                                  aggiornatoIl: oggi,
                                })
                              }
                            />
                            <Button
                              scrive
                              variante="quieto"
                              taglia="icona"
                              aria-label={`Elimina ${b.nome}`}
                              onClick={() => void eliminaBene(b)}
                              className="hover:bg-negativo-tenue hover:text-negativo"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
            </ul>
          )}

          <CardCorpo className="pt-3">
            <ModuloBene oggi={oggi} />
          </CardCorpo>
        </Card>

        {/*
          Il raccordo, dall'altra parte. Questa schermata è la persona: i
          crediti verso i clienti, l'IVA da versare e le imposte maturate sono
          dell'attività e stanno nel suo bilancio. Le due cifre grandi non
          rispondono alla stessa domanda, e dirlo costa una riga.
        */}
        <p className="text-micro text-inchiostro-tenue">
          Questo è il patrimonio personale: non comprende crediti verso clienti, IVA da versare e
          imposte maturate. Quelli stanno nel{" "}
          <Link href={ROTTE.patrimonio} className="underline underline-offset-2">
            Bilancio dell&apos;attività
          </Link>
          .
        </p>
      </div>
    </Guscio>
  );
}

function RigaNetto({
  etichetta,
  nota,
  valore,
}: {
  etichetta: string;
  nota: string;
  valore: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt>
        {etichetta} <span className="text-inchiostro-tenue">· {nota}</span>
      </dt>
      <dd className={cn("cifre font-medium", valore < 0 && "text-negativo")}>{euro(valore)}</dd>
    </div>
  );
}

function ModuloConto({ oggi }: { oggi: string }) {
  const [nome, setNome] = React.useState("");
  const [tipo, setTipo] = React.useState<TipoConto>("corrente");
  const [saldo, setSaldo] = React.useState("");

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!nome.trim()) return;
        void creaConto({
          nome: nome.trim(),
          tipo,
          saldoRiferimento: analizzaNumero(saldo) ?? 0,
          dataRiferimento: oggi,
          professionale: false,
        });
        setNome("");
        setTipo("corrente");
        setSaldo("");
      }}
    >
      <BloccoScrittura className="contents">
        <Campo etichetta="Nome" htmlFor="conto-nome" className="min-w-40 flex-1">
          <Input
            id="conto-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Es. Conto principale"
          />
        </Campo>
        <Campo etichetta="Tipo" htmlFor="conto-tipo" className="w-44">
          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoConto)}>
            <SelectTrigger id="conto-tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPI_CONTO.map((t) => (
                <SelectItem key={t.valore} value={t.valore}>
                  {t.etichetta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo etichetta="Saldo di oggi" htmlFor="conto-saldo" className="w-36">
          <Input
            id="conto-saldo"
            numerico
            inputMode="decimal"
            value={saldo}
            onChange={(e) => setSaldo(e.target.value)}
            placeholder="0,00"
          />
        </Campo>
        <Button type="submit" variante="contorno" disabled={!nome.trim()}>
          <Plus className="size-4" aria-hidden />
          Aggiungi conto
        </Button>
      </BloccoScrittura>
    </form>
  );
}

function ModuloBene({ oggi }: { oggi: string }) {
  const [classe, setClasse] = React.useState<ClasseBene>("investimenti");
  const [nome, setNome] = React.useState("");
  const [valore, setValore] = React.useState("");
  const numero = analizzaNumero(valore) ?? 0;

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!nome.trim() || numero === 0) return;
        const nuovo: Omit<BenePf, "id"> = {
          classe,
          nome: nome.trim(),
          // Il segno lo mette il patrimonio netto: qui si registra un valore,
          // e un debito di meno ottantaquattromila non vuol dire niente.
          valore: Math.abs(numero),
          aggiornatoIl: oggi,
        };
        void creaBene(nuovo);
        setNome("");
        setValore("");
      }}
    >
      <BloccoScrittura className="contents">
        <Campo etichetta="Categoria" htmlFor="bene-classe" className="w-44">
          <Select value={classe} onValueChange={(v) => setClasse(v as ClasseBene)}>
            <SelectTrigger id="bene-classe">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLASSI.map((c) => (
                <SelectItem key={c.classe} value={c.classe}>
                  {c.etichetta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Campo>
        <Campo etichetta="Nome" htmlFor="bene-nome" className="min-w-40 flex-1">
          <Input
            id="bene-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Es. Portafoglio ETF, Casa, Mutuo residuo"
          />
        </Campo>
        <Campo etichetta="Valore" htmlFor="bene-valore" className="w-36">
          <Input
            id="bene-valore"
            numerico
            inputMode="decimal"
            value={valore}
            onChange={(e) => setValore(e.target.value)}
            placeholder="0,00"
          />
        </Campo>
        <Button type="submit" variante="contorno" disabled={!nome.trim() || numero === 0}>
          <Plus className="size-4" aria-hidden />
          Aggiungi
        </Button>
      </BloccoScrittura>
    </form>
  );
}
