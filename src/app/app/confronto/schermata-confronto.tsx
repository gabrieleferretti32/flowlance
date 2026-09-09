"use client";

import * as React from "react";
import { Scale } from "lucide-react";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import { Campo, Input } from "@/components/ui/input";
import {
  ContenitoreTabella,
  Tabella,
  TabellaCella,
  TabellaCorpo,
  TabellaIntestazione,
  TabellaRiga,
  TabellaTesta,
} from "@/components/ui/tabella";
import { Guscio } from "@/components/guscio/guscio";
import {
  COLORE_FORFETTARIO,
  COLORE_ORDINARIO,
  CurvaRegimi,
} from "@/components/grafici/curva-regimi";
import { useCalcoloAnno } from "@/lib/dati/hooks";
import {
  confrontaRegimi,
  curvaConfronto,
  ingressoDaProspetto,
  puntoDiIncrocio,
} from "@/lib/fisco/confronto";
import { parametriDi } from "@/lib/fisco/parametri";
import { usePreferenze } from "@/lib/stato/preferenze";
import { analizzaNumero, euro, euroTondo, perCampo, percentuale } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SchermataConfronto() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const calcolo = useCalcoloAnno(anno, oggi);
  const par = parametriDi(anno);

  const [ricavi, setRicavi] = React.useState<number | null>(null);
  const [costiDeducibili, setCostiDeducibili] = React.useState<number | null>(null);
  const [costiTotali, setCostiTotali] = React.useState<number | null>(null);
  const [ivaAcquisti, setIvaAcquisti] = React.useState<number | null>(null);

  // I campi partono dai numeri reali: la simulazione è già la tua situazione,
  // e da lì si muove.
  React.useEffect(() => {
    if (!calcolo || ricavi !== null) return;
    const ing = ingressoDaProspetto(calcolo.prospetto);
    setRicavi(Math.round(ing.ricavi) || 40_000);
    setCostiDeducibili(Math.round(ing.costiDeducibili));
    setCostiTotali(Math.round(ing.costiTotali));
    setIvaAcquisti(Math.round(ing.ivaAcquisti));
  }, [calcolo, ricavi]);

  if (!calcolo || ricavi === null) {
    return (
      <Guscio titolo="Confronto fra regimi">
        <Card>
          <CaricamentoTabella righe={5} />
        </Card>
      </Guscio>
    );
  }

  const imp = calcolo.impostazioni;
  const ingresso = {
    ricavi,
    costiDeducibili: costiDeducibili ?? 0,
    costiTotali: costiTotali ?? 0,
    ivaAcquisti: ivaAcquisti ?? 0,
  };
  const confronto = confrontaRegimi(ingresso, imp, par);
  const senzaRicavi = { ...ingresso };
  const punti = curvaConfronto(senzaRicavi, imp, par, { da: 10_000, a: 100_000, passo: 2_500 });
  const incrocio = puntoDiIncrocio(senzaRicavi, imp, par);

  // Sopra il limite il forfettario non è una scelta: il titolone non può
  // annunciarlo vincitore mentre il testo sotto spiega che non è applicabile.
  const vince = confronto.forfettarioApplicabile ? confronto.convenienza : "ordinario";
  const differenza = Math.abs(confronto.differenzaNetto);
  const mostraDifferenza = confronto.forfettarioApplicabile && vince !== "pari";

  return (
    <Guscio
      titolo="Forfettario o ordinario?"
      descrizione={`Anno ${anno} · stessi ricavi, stessi costi, i due regimi messi a confronto`}
    >
      <div className="mx-auto max-w-5xl space-y-4">
        {/* La card scura della schermata: il verdetto. */}
        <Card scura className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 flex-1 sm:min-w-64">
              <span className="flex items-center gap-2 text-etichetta text-white/60">
                <Scale className="size-4" aria-hidden />
                Verdetto su {euroTondo(ricavi)} di ricavi
              </span>
              <p className="mt-2 font-display text-semaforo font-semibold tracking-tight">
                {!confronto.forfettarioApplicabile
                  ? "Solo ordinario"
                  : vince === "pari"
                    ? "Pari"
                    : vince === "forfettario"
                      ? "Forfettario"
                      : "Ordinario"}
              </p>
              <p className="mt-2 max-w-lg text-corpo text-white/70">{confronto.verdetto}</p>
            </div>
            {mostraDifferenza && (
              <div className="text-right">
                <span className="block text-etichetta text-white/60">Differenza in tasca</span>
                <span className="cifre block text-kpi font-semibold">{euro(differenza)}</span>
                <span className="block text-micro text-white/60">
                  {euro(differenza / 12)} al mese
                </span>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardCorpo className="pb-4">
            <CardTitolo>Dati della simulazione</CardTitolo>
            <CardSottotitolo>
              Precompilati con i tuoi numeri reali del {anno}: sovrascrivili per provare
              altri scenari.
            </CardSottotitolo>

            <div className="mt-4">
              <label
                htmlFor="slider-ricavi"
                className="flex items-baseline justify-between gap-3 text-etichetta font-medium"
              >
                Ricavi annui da simulare
                <span className="cifre text-kpi-sm font-semibold">{euro(ricavi)}</span>
              </label>
              <input
                id="slider-ricavi"
                type="range"
                min={5_000}
                max={120_000}
                step={500}
                value={ricavi}
                onChange={(e) => setRicavi(Number(e.target.value))}
                /* Traccia sottile, cursore alto quanto un dito: un bersaglio da
                   8 px si prende solo per fortuna. */
                className="mt-2 h-8 w-full cursor-pointer appearance-none bg-transparent accent-[#4C5BF5] [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-superficie-alt [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-superficie-alt [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#4C5BF5]"
              />
              <div className="mt-1 flex justify-between text-micro text-inchiostro-tenue">
                <span className="cifre">{euroTondo(5_000)}</span>
                <span className="cifre">{euroTondo(imp.limiteForfettario)} · limite forfettario</span>
                <span className="cifre">{euroTondo(120_000)}</span>
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <CampoNumerico
                id="costi-deducibili"
                etichetta="Costi deducibili"
                aiuto="Imponibile dei costi documentati"
                valore={costiDeducibili}
                onChange={setCostiDeducibili}
              />
              <CampoNumerico
                id="costi-totali"
                etichetta="Uscita di cassa"
                aiuto="Costi totali, IVA compresa"
                valore={costiTotali}
                onChange={setCostiTotali}
              />
              <CampoNumerico
                id="iva-acquisti"
                etichetta="IVA sugli acquisti"
                aiuto="Recuperabile solo in ordinario"
                valore={ivaAcquisti}
                onChange={setIvaAcquisti}
              />
            </div>
          </CardCorpo>
        </Card>

        <Card className="overflow-hidden">
          <CardCorpo className="pb-3">
            <CardTitolo>Come cambia al crescere del fatturato</CardTitolo>
            <CardSottotitolo>
              {incrocio === null
                ? "Con questi costi le due curve non si incrociano: un regime conviene su tutto l'intervallo."
                : `Le due curve si incrociano a ${euro(incrocio)} di ricavi: sotto conviene l'ordinario, sopra il forfettario.`}
            </CardSottotitolo>
          </CardCorpo>
          <CurvaRegimi
            punti={punti}
            incrocio={incrocio}
            ricaviAttuali={ricavi}
            limiteForfettario={imp.limiteForfettario}
            aRiposo={{
              forfettario: confronto.forfettario.nettoInTasca,
              ordinario: confronto.ordinario.nettoInTasca,
            }}
          />
        </Card>

        <Card className="overflow-hidden">
          <CardCorpo className="pb-2">
            <CardTitolo>Confronto a parità di ricavi</CardTitolo>
          </CardCorpo>
          <ContenitoreTabella data-scroll-ok className="px-2 pb-2">
            <Tabella>
              <TabellaTesta>
                <tr>
                  <TabellaIntestazione>Voce</TabellaIntestazione>
                  <TabellaIntestazione numerica>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: COLORE_FORFETTARIO }}
                        aria-hidden
                      />
                      Forfettario
                    </span>
                  </TabellaIntestazione>
                  <TabellaIntestazione numerica>
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: COLORE_ORDINARIO }}
                        aria-hidden
                      />
                      Ordinario
                    </span>
                  </TabellaIntestazione>
                  <TabellaIntestazione numerica>Differenza</TabellaIntestazione>
                </tr>
              </TabellaTesta>
              <TabellaCorpo>
                <RigaConfronto voce="Ricavi" a={confronto.forfettario.ricavi} b={confronto.ordinario.ricavi} />
                <RigaConfronto voce="Costi riconosciuti fiscalmente" a={confronto.forfettario.costiRiconosciuti} b={confronto.ordinario.costiRiconosciuti} />
                <RigaConfronto voce="Reddito lordo ante contributi" a={confronto.forfettario.redditoLordo} b={confronto.ordinario.redditoLordo} />
                <RigaConfronto voce="Contributi previdenziali" a={confronto.forfettario.contributi} b={confronto.ordinario.contributi} />
                <RigaConfronto voce="Reddito imponibile" a={confronto.forfettario.imponibile} b={confronto.ordinario.imponibile} />
                <RigaConfronto voce="Imposte" a={confronto.forfettario.imposte} b={confronto.ordinario.imposte} />
                <RigaConfronto voce="Carico totale" a={confronto.forfettario.caricoTotale} b={confronto.ordinario.caricoTotale} />
                <RigaConfronto
                  voce="Pressione sui ricavi"
                  a={confronto.forfettario.pressione}
                  b={confronto.ordinario.pressione}
                  percentuali
                />
                <RigaConfronto
                  voce="Reddito netto in tasca"
                  a={confronto.forfettario.nettoInTasca}
                  b={confronto.ordinario.nettoInTasca}
                  enfasi
                />
              </TabellaCorpo>
            </Tabella>
          </ContenitoreTabella>
        </Card>

        <Card>
          <CardCorpo className="space-y-2 py-4">
            <p className="text-etichetta text-inchiostro-tenue">
              Il confronto non è solo fiscale. Nel forfettario non addebiti IVA — un
              vantaggio verso i privati, irrilevante verso le imprese che la detraggono —
              ma non detrai l&apos;IVA sugli acquisti, non usi le detrazioni personali e non
              deduci il fondo pensione.
            </p>
            <p className="text-etichetta text-inchiostro-tenue">
              La contabilità ordinaria costa anche in parcelle e tempo: quello non entra in
              questi numeri. Sopra {euroTondo(imp.limiteForfettario)} di ricavi il
              forfettario non è comunque applicabile.
            </p>
          </CardCorpo>
        </Card>
      </div>
    </Guscio>
  );
}

function CampoNumerico({
  id,
  etichetta,
  aiuto,
  valore,
  onChange,
}: {
  id: string;
  etichetta: string;
  aiuto: string;
  valore: number | null;
  onChange: (v: number) => void;
}) {
  const [bozza, setBozza] = React.useState<string | null>(null);
  const mostrato = bozza ?? (valore === null ? "" : perCampo(valore, 0));
  return (
    <Campo etichetta={etichetta} aiuto={aiuto} htmlFor={id}>
      <Input
        id={id}
        numerico
        inputMode="decimal"
        value={mostrato}
        onChange={(e) => {
          setBozza(e.target.value);
          const n = analizzaNumero(e.target.value);
          if (n !== null) onChange(n);
        }}
        onBlur={() => setBozza(null)}
      />
    </Campo>
  );
}

function RigaConfronto({
  voce,
  a,
  b,
  percentuali = false,
  enfasi = false,
}: {
  voce: string;
  a: number;
  b: number;
  percentuali?: boolean;
  enfasi?: boolean;
}) {
  const fmt = (v: number) => (percentuali ? percentuale(v) : euro(v));
  const differenza = b - a;
  const migliore = enfasi ? (a > b ? "a" : b > a ? "b" : null) : null;

  return (
    <TabellaRiga className={enfasi ? "bg-superficie-alt/70" : undefined}>
      <TabellaCella className={enfasi ? "font-medium" : undefined}>{voce}</TabellaCella>
      <TabellaCella
        numerica
        className={cn(enfasi && "text-kpi-sm font-semibold", migliore === "a" && "text-accento")}
      >
        {fmt(a)}
      </TabellaCella>
      <TabellaCella
        numerica
        className={cn(enfasi && "text-kpi-sm font-semibold", migliore === "b" && "text-[#B45309]")}
      >
        {fmt(b)}
      </TabellaCella>
      <TabellaCella numerica className="text-inchiostro-tenue">
        {differenza === 0 ? "—" : `${differenza > 0 ? "+" : "−"}${fmt(Math.abs(differenza))}`}
      </TabellaCella>
    </TabellaRiga>
  );
}
