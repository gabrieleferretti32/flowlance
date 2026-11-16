"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";
import { BloccoScrittura } from "@/components/ui/blocco-scrittura";
import { Card, CardCorpo, CardInterna, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { aggiornaImpostazioni } from "@/lib/dati/azioni";
import { cassaDi, erroriCassa, nomeCassa, valutaCassa } from "@/lib/fisco/cassa";
import { analizzaNumero, euro, perCampo, percentuale } from "@/lib/format";
import { frazioneDaPercentuale } from "@/lib/fisco/aritmetica";
import { nomeGestione } from "@/lib/fisco/tipi";
import type { Cassa, Impostazioni } from "@/lib/fisco/tipi";

/**
 * Il blocco «Cassa professionale» nei Parametri.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché sta qui, e perché i campi sono vuoti
 * ─────────────────────────────────────────────────────────────────────────
 *
 * I Parametri sono la schermata dei numeri che **solo l'utente conosce**, e i
 * dati di una cassa sono il caso più puro: Forense, Inarcassa, ENPAM, CIPAG e
 * le altre hanno regolamenti diversi, e non esiste un'aliquota «media» che
 * voglia dire qualcosa. L'app ne teneva una, il 15 %, e la usava: un contributo
 * calcolato al centesimo su un'aliquota che non era di nessuno.
 *
 * Quindi niente ripiego da marcare «predefinito», come per il concordato e la
 * tariffa oraria: finché l'aliquota del soggettivo non c'è, i contributi
 * **restano zero** e tre posti lo dicono — qui, il semaforo del cruscotto e il
 * prospetto. Uno zero che si spiega non è una bugia; un numero plausibile che
 * nessuno ha dichiarato lo è.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Con l'INPS non c'è
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Non è una scheda spenta: è una riga che dice perché non c'è, e come
 * accenderla. Un blocco vuoto lascerebbe a chiedersi se l'app se lo sia
 * dimenticato.
 */
export function SezioneCassa({
  impostazioni: imp,
  anno,
}: {
  impostazioni: Impostazioni;
  anno: number;
}) {
  if (imp.gestione !== "cassa") {
    return (
      <Card>
        <CardCorpo className="py-4">
          <p className="text-etichetta font-medium">
            Nessuna cassa professionale: versi a {nomeGestione(imp.gestione)}
          </p>
          <p className="mt-1 text-etichetta text-inchiostro-tenue">
            Se sei iscritto a una cassa privata — avvocati, ingegneri, architetti, psicologi,
            geometri — cambia la gestione previdenziale dalla Configurazione, e qui compariranno i
            campi per le aliquote e i minimi della tua cassa.
          </p>
        </CardCorpo>
      </Card>
    );
  }
  return <ModuloCassa impostazioni={imp} anno={anno} />;
}

/** La nota che chiude la scheda. Il testo è quello concordato, parola per parola. */
const NOTA_FINALE =
  "Trovi questi valori sul sito della tua cassa o chiedili al commercialista. "
  + "Scaglioni, riduzioni per i primi anni e agevolazioni non sono calcolati automaticamente.";

function ModuloCassa({
  impostazioni: imp,
  anno,
}: {
  impostazioni: Impostazioni;
  anno: number;
}) {
  const c = cassaDi(imp);
  const errori = erroriCassa(c);
  const erroreDi = (campo: keyof Cassa) => errori.find((e) => e.campo === campo)?.testo;
  const esito = valutaCassa(imp, { redditoImponibile: 0 });

  /*
    Le bozze dei campi, come nella scheda del concordato: si salva a ogni
    battuta valida, e la bozza esiste perché «1.» o «16,» a metà digitazione
    non devono tornare indietro riscritti.
  */
  const [bozze, setBozze] = React.useState<Record<string, string | null>>({});
  const bozza = (campo: string) => bozze[campo] ?? null;
  const scriviBozza = (campo: string, testo: string | null) =>
    setBozze((b) => ({ ...b, [campo]: testo }));

  function salva(modifiche: Partial<Cassa>) {
    void aggiornaImpostazioni(anno, { cassa: { ...c, ...modifiche } });
  }

  const idNome = React.useId();

  return (
    <Card>
      <CardCorpo>
        <CardTitolo>La tua cassa professionale</CardTitolo>
        <CardSottotitolo>
          Chi è iscritto a una cassa privata non versa all&apos;INPS. Versa due contributi
          diversi: il <strong className="font-medium">soggettivo</strong>, una percentuale del
          tuo reddito che paghi tu, e l&apos;<strong className="font-medium">integrativo</strong>,
          una percentuale dei compensi che addebiti al cliente in fattura e giri alla cassa.
          Flowlance calcola quanto devi; i numeri della tua cassa li scrivi tu.
        </CardSottotitolo>

        <BloccoScrittura className="contents">
          <div className="mt-4 space-y-5">
            <div>
              <label htmlFor={idNome} className="text-corpo font-medium">
                Nome della cassa
              </label>
              <p className="mt-0.5 mb-2 text-etichetta text-inchiostro-tenue">
                Come si chiama, per ritrovarla nelle schermate e nel prospetto: «Cassa Forense»,
                «Inarcassa», «ENPAP».
              </p>
              <Input
                id={idNome}
                value={bozza("nome") ?? c.nome}
                onChange={(e) => {
                  scriviBozza("nome", e.target.value);
                  salva({ nome: e.target.value });
                }}
                onBlur={() => scriviBozza("nome", null)}
                placeholder="Cassa Forense"
                className="w-full sm:w-72"
              />
            </div>

            <CampoNumero
              etichetta="Aliquota del contributo soggettivo"
              aiuto="La percentuale del tuo reddito che versi alla cassa. È il contributo che paghi tu, e si deduce dal reddito."
              valore={c.aliquotaSoggettivo}
              formato="percentuale"
              bozza={bozza("aliquotaSoggettivo")}
              onBozza={(t) => scriviBozza("aliquotaSoggettivo", t)}
              onValore={(aliquotaSoggettivo) => salva({ aliquotaSoggettivo })}
              errore={erroreDi("aliquotaSoggettivo")}
            />

            <CampoNumero
              etichetta="Minimo annuo del soggettivo"
              aiuto="Sotto questa cifra si versa comunque il minimo, non la percentuale. Lascia zero se la tua cassa non ne prevede uno."
              valore={c.minimoSoggettivo}
              formato="euro"
              bozza={bozza("minimoSoggettivo")}
              onBozza={(t) => scriviBozza("minimoSoggettivo", t)}
              onValore={(v) => salva({ minimoSoggettivo: v ?? 0 })}
              errore={erroreDi("minimoSoggettivo")}
            />

            <CampoNumero
              etichetta="Aliquota del contributo integrativo"
              aiuto="La percentuale che addebiti al cliente in fattura e giri alla cassa. Non è tuo reddito, e prende il posto della rivalsa INPS del 4 %."
              valore={c.aliquotaIntegrativo}
              formato="percentuale"
              bozza={bozza("aliquotaIntegrativo")}
              onBozza={(t) => scriviBozza("aliquotaIntegrativo", t)}
              onValore={(aliquotaIntegrativo) => salva({ aliquotaIntegrativo })}
              errore={erroreDi("aliquotaIntegrativo")}
            />

            <CampoNumero
              etichetta="Minimo annuo dell'integrativo"
              aiuto="Se le fatture dell'anno non ci arrivano, la differenza la metti tu: l'app te la mostra come costo. Lascia zero se non c'è un minimo."
              valore={c.minimoIntegrativo}
              formato="euro"
              bozza={bozza("minimoIntegrativo")}
              onBozza={(t) => scriviBozza("minimoIntegrativo", t)}
              onValore={(v) => salva({ minimoIntegrativo: v ?? 0 })}
              errore={erroreDi("minimoIntegrativo")}
            />

            <CampoNumero
              etichetta="Contributi fissi annui"
              aiuto="Le quote dovute comunque, qualunque sia il reddito: la maternità, per esempio. Si deducono come il soggettivo."
              valore={c.contributiFissi}
              formato="euro"
              bozza={bozza("contributiFissi")}
              onBozza={(t) => scriviBozza("contributiFissi", t)}
              onValore={(v) => salva({ contributiFissi: v ?? 0 })}
              errore={erroreDi("contributiFissi")}
            />
          </div>
        </BloccoScrittura>

        <p className="mt-5 text-etichetta text-inchiostro-tenue">{NOTA_FINALE}</p>

        {esito && esito.avvisi.length > 0 && (
          <div className="mt-5 space-y-3">
            {esito.avvisi.map((a, i) => (
              <CardInterna
                key={`${a.codice}-${i}`}
                className="border border-attenzione/25 bg-attenzione-tenue p-3"
              >
                <p className="flex items-start gap-2 text-etichetta text-[#B8791A]">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{a.testo}</span>
                </p>
              </CardInterna>
            ))}
          </div>
        )}

        {esito?.configurata && (
          <p className="mt-4 text-etichetta text-inchiostro-tenue">
            {nomeCassa(c)}: il soggettivo è il {percentuale(c.aliquotaSoggettivo ?? 0, 2)} del
            reddito
            {c.minimoSoggettivo > 0 ? `, con un minimo di ${euro(c.minimoSoggettivo)}` : ""}
            {c.contributiFissi > 0 ? `, più ${euro(c.contributiFissi)} di quote fisse` : ""}.
            {c.aliquotaIntegrativo !== null
              ? ` In fattura si addebita l'integrativo del ${percentuale(c.aliquotaIntegrativo, 2)}.`
              : ""}
          </p>
        )}
      </CardCorpo>
    </Card>
  );
}

/**
 * Un numero che può non esserci, in punti percentuali o in euro.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché un&apos;aliquota si scrive «16» e non «0,16»
 * ─────────────────────────────────────────────────────────────────────────
 *
 * In un campo con la « % » accanto si scrivono punti percentuali, sempre: è la
 * regola che il resto dei Parametri applica già, e `frazioneDaPercentuale` è la
 * stessa funzione che la applica là. Chi scrive 16 intende il 16 %, e un campo
 * che lo leggesse come 1.600 % calcolerebbe un contributo dieci volte il
 * reddito senza che nulla stoni a schermo.
 *
 * `null` non è zero. Un campo svuotato torna a `null` — «non lo so» — e il
 * calcolo si ferma dicendolo, invece di proseguire su uno zero che sembra una
 * risposta. Per i minimi e le quote fisse invece zero **è** una risposta
 * legittima — «la mia cassa non ne prevede» — e il campo vuoto vale zero.
 */
function CampoNumero({
  etichetta,
  aiuto,
  valore,
  formato,
  bozza,
  onBozza,
  onValore,
  errore,
}: {
  etichetta: string;
  aiuto: string;
  valore: number | null;
  formato: "percentuale" | "euro";
  bozza: string | null;
  onBozza: (t: string | null) => void;
  onValore: (v: number | null) => void;
  errore?: string;
}) {
  const id = React.useId();
  const decimali = formato === "percentuale" ? 2 : 0;
  const inArchivio =
    valore === null
      ? ""
      : formato === "percentuale"
        ? perCampo(valore * 100, decimali)
        : perCampo(valore, decimali);
  const mostrato = bozza ?? inArchivio;
  return (
    <div>
      <label htmlFor={id} className="text-corpo font-medium">
        {etichetta}
      </label>
      <p className="mt-0.5 mb-2 text-etichetta text-inchiostro-tenue">{aiuto}</p>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          inputMode="decimal"
          value={mostrato}
          onChange={(e) => {
            const testo = e.target.value;
            onBozza(testo);
            if (testo.trim() === "") return onValore(null);
            const letto = analizzaNumero(testo);
            // Campo a metà («1.», «-»): non è un errore, si aspetta.
            if (letto === null) return;
            onValore(formato === "percentuale" ? frazioneDaPercentuale(letto) : letto);
          }}
          onBlur={() => onBozza(null)}
          className="w-full sm:w-48"
        />
        <span className="text-etichetta text-inchiostro-tenue">
          {formato === "percentuale" ? "%" : "€"}
        </span>
      </div>
      {errore && <p className="mt-2 text-etichetta text-[#B8791A]">{errore}</p>}
    </div>
  );
}
