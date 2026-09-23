"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { ROTTE } from "@/lib/rotte";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Chip } from "@/components/ui/chip";
import { Kpi } from "@/components/ui/kpi";
import { Stato } from "@/components/ui/stato";
import { Guscio } from "@/components/guscio/guscio";
import { chiaveSpunta, spuntaAdempimento } from "@/lib/dati/azioni";
import { useCalcoloAnno, useDati } from "@/lib/dati/hooks";
import { giorniAllaData } from "@/lib/fisco/calendario";
import { parametriDi } from "@/lib/fisco/parametri";
import { scadenzeAnno, type Adempimento } from "@/lib/fisco/scadenze";
import { spunteSenzaF24 } from "@/lib/fisco/accantonamento";
import { gestioneNelTesto } from "@/lib/fisco/tipi";
import { usePreferenze } from "@/lib/stato/preferenze";
import { data as fmtData, euro } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSolaLettura } from "@/lib/stato/licenza";

const CATEGORIE: Record<Adempimento["categoria"], string> = {
  iva: "IVA",
  imposte: "Imposte",
  contributi: "Contributi",
  dichiarazione: "Dichiarazione",
  bollo: "Bollo",
};

const NOMI_MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

export function SchermataScadenzario() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const dati = useDati();
  const calcolo = useCalcoloAnno(anno, oggi);
  // Saldo e acconti di quest'anno di calendario si calcolano sui numeri
  // dell'anno d'imposta precedente: se non c'è, è il primo anno di attività.
  const precedente = useCalcoloAnno(anno - 1, oggi);

  const scadenze = React.useMemo(() => {
    if (!calcolo) return null;
    return scadenzeAnno(
      calcolo.impostazioni,
      parametriDi(anno),
      calcolo.prospetto,
      calcolo.iva,
      precedente?.prospetto ?? null,
    );
  }, [calcolo, precedente, anno]);

  const spuntate = React.useMemo(() => {
    const insieme = new Set<string>();
    for (const s of dati?.spunte ?? []) insieme.add(s.id);
    return insieme;
  }, [dati]);

  /*
    **Dove la spunta e i versamenti si contraddicono.**

    La spunta dice «l'ho fatto» e non è denaro: non ha importo, non ha data di
    pagamento, e nessun altro calcolo la legge. La quota d'accantonamento
    guarda gli F24, che sono denaro. Le due cose restano separate — e va bene
    così, una è un promemoria — ma una scadenza verde qui e contata fra gli
    arretrati nel cruscotto è l'app che sembra contraddirsi. Quindi lo dice.
  */
  const scoperte = React.useMemo(() => {
    if (!scadenze || !dati) return new Map<string, number>();
    const esito = spunteSenzaF24({
      scadenze,
      versamenti: dati.versamenti,
      anno,
      spuntati: new Set(
        dati.spunte.filter((sp) => sp.anno === anno).map((sp) => sp.idAdempimento),
      ),
    });
    return new Map(esito.voci.map((v) => [v.id, v.scoperto]));
  }, [scadenze, dati, anno]);

  if (!calcolo || !scadenze || !dati) {
    return (
      <Guscio titolo="Scadenzario">
        <Card>
          <CaricamentoTabella righe={6} />
        </Card>
      </Guscio>
    );
  }

  const eFatto = (s: Adempimento) => spuntate.has(chiaveSpunta(anno, s.id));
  const scopertoDi = (s: Adempimento) => scoperte.get(s.id) ?? null;
  const daFare = scadenze.filter((s) => !eFatto(s));
  const scadute = daFare.filter((s) => giorniAllaData(s.data, oggi) < 0);
  const imminenti = daFare.filter((s) => {
    const g = giorniAllaData(s.data, oggi);
    return g >= 0 && g <= 15;
  });
  const daVersare = daFare.reduce((a, s) => a + (s.importo ?? 0), 0);

  // Raggruppo per mese: la timeline dell'anno si legge scorrendo, non saltando.
  const perMese = new Map<number, Adempimento[]>();
  for (const s of scadenze) {
    const mese = Number(s.data.slice(5, 7));
    const anno_ = Number(s.data.slice(0, 4));
    const chiave = anno_ > anno ? 13 : mese;
    if (!perMese.has(chiave)) perMese.set(chiave, []);
    perMese.get(chiave)?.push(s);
  }
  const mesi = [...perMese.entries()].sort((a, b) => a[0] - b[0]);

  return (
    <Guscio
      titolo="Scadenzario"
      descrizione={`Adempimenti ${anno} · filtrati per regime ${calcolo.impostazioni.regime} e ${gestioneNelTesto(calcolo.impostazioni.gestione)}`}
    >
      <div className="mx-auto max-w-4xl space-y-4">
        <section aria-label="Sintesi" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi etichetta="Adempimenti dell'anno" valore={String(scadenze.length)} taglia="kpiSm" nota={`${scadenze.length - daFare.length} già spuntati`} />
          <Kpi etichetta="Ancora da versare" valore={euro(daVersare)} taglia="kpiSm" nota="importi stimati sui tuoi numeri" />
          <Kpi etichetta="Nei prossimi 15 giorni" valore={String(imminenti.length)} taglia="kpiSm" nota={imminenti.length === 0 ? "niente in arrivo" : "controlla il calendario"} />
          <Kpi
            sfondo={scadute.length > 0 ? "scuro" : "chiaro"}
            etichetta="Passate e non spuntate"
            valore={String(scadute.length)}
            taglia="kpiSm"
            nota={scadute.length === 0 ? "sei in pari" : "verifica se le hai versate"}
          />
        </section>

        {/*
          La contraddizione, riassunta una volta sola e con la strada per
          chiuderla. Sulle righe c'è la nota corta; qui c'è il totale, che è
          il numero che compare nel cruscotto fra gli arretrati.
        */}
        {scoperte.size > 0 && (
          <Card>
            <CardCorpo className="space-y-1.5">
              <CardTitolo>
                {scoperte.size === 1
                  ? "Una scadenza spuntata risulta ancora da versare"
                  : `${scoperte.size} scadenze spuntate risultano ancora da versare`}
              </CardTitolo>
              <CardSottotitolo>
                In totale {euro([...scoperte.values()].reduce((a, b) => a + b, 0))}. La spunta qui
                è tua e serve a te: dice «questo l&apos;ho fatto», non quanto è uscito né quando.
                Il calcolo dell&apos;accantonamento guarda i <strong>versamenti F24</strong>, che
                sono denaro con una data — quindi continua a considerare da versare queste
                scadenze, e le conta fra gli arretrati nel cruscotto.{" "}
                <Link href={ROTTE.cashflow} className="underline underline-offset-2">
                  Registra gli F24
                </Link>{" "}
                e le due schermate tornano d&apos;accordo.
              </CardSottotitolo>
            </CardCorpo>
          </Card>
        )}

        {mesi.map(([mese, voci]) => (
          <section key={mese} aria-label={mese === 13 ? `Inizio ${anno + 1}` : NOMI_MESI[mese - 1]}>
            <h2 className="mb-2 px-1 text-etichetta font-medium text-inchiostro-tenue">
              {mese === 13 ? `Inizio ${anno + 1}` : `${maiuscola(NOMI_MESI[mese - 1])} ${anno}`}
            </h2>
            <Card className="overflow-hidden">
              <ul className="divide-y divide-bordo/70">
                {voci.map((s) => (
                  <RigaAdempimento
                    key={s.id}
                    scadenza={s}
                    anno={anno}
                    oggi={oggi}
                    fatto={eFatto(s)}
                    scoperto={scopertoDi(s)}
                  />
                ))}
              </ul>
            </Card>
          </section>
        ))}

        <Card>
          <CardCorpo className="space-y-2 py-4">
            <CardTitolo>Come leggere questo calendario</CardTitolo>
            <CardSottotitolo>
              Le voci che non ti riguardano non compaiono affatto.
            </CardSottotitolo>
            <p className="mt-2 text-etichetta text-inchiostro-tenue">
              L&apos;elenco è già filtrato per il tuo regime e la tua gestione previdenziale:
              in forfettario non vedi LIPE e liquidazioni IVA, in Gestione Separata non vedi
              le quattro rate dei contributi fissi di artigiani e commercianti — comprese quelle che si versano nell&apos;anno dopo.
            </p>
            <p className="text-etichetta text-inchiostro-tenue">
              Le date che cadono di sabato, di domenica o in un giorno festivo sono già
              spostate al primo giorno lavorativo successivo, festività mobili comprese. Le
              feste patronali no: variano per comune.
            </p>
            <p className="text-etichetta text-inchiostro-tenue">
              La spunta è tua: segna quello che hai versato davvero. Gli importi sono stime
              costruite sui tuoi numeri, non cartelle di pagamento.
            </p>
          </CardCorpo>
        </Card>
      </div>
    </Guscio>
  );
}

function RigaAdempimento({
  scadenza,
  anno,
  oggi,
  fatto,
  scoperto,
}: {
  scadenza: Adempimento;
  anno: number;
  oggi: string;
  fatto: boolean;
  /**
   * Spuntata, ma i versamenti F24 non ci arrivano: quanto resta scoperto.
   * `null` quando non c'è niente da dire — non spuntata, oppure coperta.
   */
  scoperto: number | null;
}) {
  const giorni = giorniAllaData(scadenza.data, oggi);
  const passata = giorni < 0;
  const imminente = !passata && giorni <= 15;
  // La spunta è una scrittura: a licenza scaduta lo scadenzario si legge —
  // date, importi, cosa è già stato versato — e non si spunta più niente.
  const bloccato = useSolaLettura();

  return (
    <li className={cn("flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5", fatto && "bg-superficie-alt/50")}>
      {/*
        `min-w-52`: con `min-w-0` il testo poteva restringersi all'infinito, e su
        320 px l'etichetta finiva larga 38 px e alta 255, una parola per riga,
        invece di mandare a capo il gruppo dell'importo. Con un minimo dichiarato
        il flex-wrap scatta e le due parti si impilano.
      */}
      <label
        className={cn(
          "flex min-w-52 flex-1 items-start gap-3",
          bloccato ? "cursor-default" : "cursor-pointer",
        )}
      >
        <input
          type="checkbox"
          checked={fatto}
          disabled={bloccato}
          title={bloccato ? "Licenza scaduta: l'app è in sola lettura." : undefined}
          onChange={(e) => void spuntaAdempimento(anno, scadenza.id, e.target.checked)}
          className="mt-0.5 size-5 shrink-0 rounded-[4px] accent-[#4C5BF5] sm:size-4"
          aria-label={`Segna «${scadenza.titolo}» come versato`}
        />
        <span className="min-w-0">
          <span className={cn("block text-corpo", fatto && "text-inchiostro-tenue line-through")}>
            {scadenza.titolo}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-micro text-inchiostro-tenue">
            <span className="cifre">{fmtData(scadenza.data)}</span>
            <span aria-hidden>·</span>
            <span>{CATEGORIE[scadenza.categoria]}</span>
            {scadenza.dataDiCalendario && (
              <>
                <span aria-hidden>·</span>
                <span>spostata dal {fmtData(scadenza.dataDiCalendario)}, festivo</span>
              </>
            )}
          </span>
          {/*
            Una scadenza senza importo per un motivo che si può dire lo dice.
            Al primo anno di attività saldo e acconti non hanno un anno prima
            da cui calcolarsi: la voce resta, con scritto perché è vuota.
          */}
          {scadenza.nota && (
            <span className="mt-1 block text-micro text-inchiostro-tenue">{scadenza.nota}</span>
          )}
        </span>
      </label>

      {/*
        `ml-auto`: sul telefono questo gruppo va a capo, e senza il margine
        automatico l'importo si incolonnerebbe a sinistra sotto il titolo,
        perdendo l'allineamento con le altre righe.
      */}
      <span className="ml-auto flex shrink-0 items-center gap-3">
        {scadenza.importo !== null && scadenza.importo > 0 ? (
          <span className={cn("cifre text-corpo font-medium", fatto && "text-inchiostro-tenue")}>
            {euro(scadenza.importo)}
          </span>
        ) : scadenza.nota ? (
          <Chip tono="attenzione">importo non calcolabile</Chip>
        ) : scadenza.importo === 0 ? (
          // Zero è un importo, non un adempimento dichiarativo: la differenza
          // fra «non devi versare niente» e «qui non si versa mai» conta.
          <Chip tono="neutro">niente da versare</Chip>
        ) : (
          <Chip tono="neutro">solo dichiarativo</Chip>
        )}
        {fatto ? (
          <span className="flex flex-col items-end gap-0.5">
            <Stato tono="positivo">Versato</Stato>
            {/*
              **La spunta dice una cosa, il calcolo ne vede un'altra.**

              «Versato» in verde mentre la quota d'accantonamento conta quella
              stessa scadenza fra gli arretrati: due schermate della stessa app
              che si contraddicono, e da fuori sembra un errore dell'app. Qui
              si dice da dove viene la differenza — la spunta è tua, l'F24 è
              denaro — invece di lasciarla scoprire nel cruscotto.
            */}
            {scoperto !== null && (
              <span className="max-w-56 text-right text-micro text-attenzione">
                {scadenza.importo !== null && scoperto < scadenza.importo
                  ? `F24 registrati solo in parte: per il calcolo restano ${euro(scoperto)} da versare`
                  : "nessun F24 registrato: per il calcolo è ancora da versare"}
              </span>
            )}
          </span>
        ) : passata ? (
          <Stato tono="negativo">Passata</Stato>
        ) : imminente ? (
          <Stato tono="attenzione">Fra {giorni} gg</Stato>
        ) : (
          <Stato tono="neutro">Futura</Stato>
        )}
      </span>
    </li>
  );
}

function maiuscola(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

