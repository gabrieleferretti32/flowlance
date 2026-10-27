"use client";

import { TriangleAlert } from "lucide-react";
import { Card, CardCorpo, CardInterna, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { TESTO_SCOSTAMENTO } from "@/lib/fisco/cpb";
import type { ConcordatoProspetto } from "@/lib/fisco/motore";
import { euro, percentuale } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Il concordato nel cruscotto: che cosa hai concordato, che cosa stai
 * producendo davvero, e che differenza fa.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le tre cose che questa card dice, e perché proprio quelle
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 1. **Concordato contro effettivo.** Sono i due numeri che chi ha aderito
 *    confronta tutto l'anno: sopra il concordato si lavora in esenzione, sotto
 *    si paga su un reddito che non si è prodotto.
 * 2. **Lo scostamento in percentuale**, perché la differenza in euro da sola
 *    non dice se è tanto: 4.000 € su 20.000 e su 200.000 sono due situazioni
 *    diverse, e una delle due ha una soglia di legge vicina.
 * 3. **L'effetto**, cioè imposte più contributi con il concordato meno gli
 *    stessi senza. È l'unica risposta alla domanda «mi è convenuto», e arriva
 *    dal motore già calcolata — qui non si fa nessuna sottrazione.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Due somme omogenee, e non lordo contro netto
 * ─────────────────────────────────────────────────────────────────────────
 *
 * I due lati del confronto sono **imposte più contributi** tutti e due. È una
 * regola che questo progetto ha già pagato una volta, in un'altra card: da una
 * parte un importo lordo, dall'altra uno netto, e un margine che non esisteva.
 * Qui i due numeri vengono dalla stessa funzione del motore, chiamata con due
 * redditi diversi, e non c'è nessun modo di comporli in due modi diversi.
 */
export function CardConcordato({ cpb }: { cpb: ConcordatoProspetto }) {
  if (!cpb.esito.attivo) {
    return (
      <Card>
        <CardCorpo>
          <CardTitolo>Concordato preventivo biennale</CardTitolo>
          <CardSottotitolo>
            Hai dichiarato di aver aderito, ma manca qualcosa: finché non c&apos;è, il calcolo
            resta sul reddito che hai prodotto davvero.
          </CardSottotitolo>
          <div className="mt-4 space-y-3">
            {cpb.esito.avvisi.map((a, i) => (
              <Avvertenza key={`${a.codice}-${i}`} testo={a.testo} />
            ))}
          </div>
        </CardCorpo>
      </Card>
    );
  }

  /*
    Il segno dell'effetto è quello del **carico**: negativo vuol dire che con
    il concordato paghi meno. Il colore lo segue — verde quando il numero è
    negativo — ed è l'unico punto in cui questa card interpreta qualcosa.
  */
  const risparmio = cpb.effetto < 0;
  const paghiDiPiu = cpb.effetto > 0;

  return (
    <Card>
      <CardCorpo>
        <CardTitolo>Concordato preventivo biennale</CardTitolo>
        <CardSottotitolo>
          Biennio {cpb.esito.biennio}. Le imposte si calcolano sul reddito concordato, non su
          quello effettivo.
        </CardSottotitolo>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Voce
            etichetta="Reddito concordato"
            valore={euro(cpb.redditoConcordato)}
            nota="dalla proposta dell'Agenzia"
          />
          <Voce
            etichetta="Reddito effettivo"
            valore={euro(cpb.redditoEffettivo)}
            nota="ricavi incassati meno costi pagati, a oggi"
          />
          <Voce
            etichetta="Scostamento"
            valore={`${cpb.scostamento >= 0 ? "+" : "−"}${percentuale(Math.abs(cpb.scostamento), 1)}`}
            nota={
              cpb.scostamento >= 0
                ? "sopra il concordato: l'eccedenza non è tassata"
                : "sotto il concordato: le imposte non scendono"
            }
            tono={cpb.oltreSogliaCessazione ? "attenzione" : "neutro"}
          />
        </div>

        <CardInterna className="mt-4 p-4">
          <p className="text-etichetta text-inchiostro-tenue">Effetto del concordato</p>
          <p
            className={cn(
              "cifre mt-1 font-display text-titolo font-semibold",
              risparmio ? "text-positivo" : paghiDiPiu ? "text-[#B8791A]" : "text-inchiostro",
            )}
          >
            {risparmio ? "−" : paghiDiPiu ? "+" : ""}
            {euro(Math.abs(cpb.effetto))}
          </p>
          <p className="mt-1 text-etichetta text-inchiostro-tenue">
            {risparmio
              ? "in meno fra imposte e contributi, rispetto a quanto pagheresti senza aver aderito"
              : paghiDiPiu
                ? "in più fra imposte e contributi, rispetto a quanto pagheresti senza aver aderito"
                : "nessuna differenza, a oggi, rispetto a quanto pagheresti senza aver aderito"}
          </p>
          {/*
            I due totali in chiaro sotto la differenza: una differenza che non
            mostra gli addendi è un numero che bisogna credere sulla parola, e
            questa card esiste per il contrario.
          */}
          <p className="mt-2 text-etichetta text-inchiostro-tenue">
            {euro(cpb.conCpb.carico)} con il concordato · {euro(cpb.senzaCpb.carico)} senza.
            Imposte e contributi, da tutte e due le parti.
          </p>
        </CardInterna>

        {cpb.maggiorazioneAcconto > 0 && (
          <p className="mt-3 text-etichetta text-inchiostro-tenue">
            Al primo anno di adesione la seconda rata di acconto porta una maggiorazione del
            10 %: {euro(cpb.maggiorazioneAcconto)}, al 30 novembre.
          </p>
        )}

        {cpb.oltreSogliaCessazione && (
          <div className="mt-4">
            <Avvertenza testo={TESTO_SCOSTAMENTO} />
          </div>
        )}

        {cpb.esito.avvisi.length > 0 && (
          <div className="mt-3 space-y-3">
            {cpb.esito.avvisi.map((a, i) => (
              <Avvertenza key={`${a.codice}-${i}`} testo={a.testo} />
            ))}
          </div>
        )}
      </CardCorpo>
    </Card>
  );
}

function Voce({
  etichetta,
  valore,
  nota,
  tono = "neutro",
}: {
  etichetta: string;
  valore: string;
  nota: string;
  tono?: "neutro" | "attenzione";
}) {
  return (
    <div>
      <p className="text-etichetta text-inchiostro-tenue">{etichetta}</p>
      <p
        className={cn(
          "cifre mt-0.5 font-display text-kpi-sm font-semibold",
          tono === "attenzione" ? "text-[#B8791A]" : "text-inchiostro",
        )}
      >
        {valore}
      </p>
      <p className="mt-0.5 text-etichetta text-inchiostro-tenue">{nota}</p>
    </div>
  );
}

/** Un avviso neutro: dice una cosa, non suona un allarme. */
function Avvertenza({ testo }: { testo: string }) {
  return (
    <CardInterna className="border border-attenzione/25 bg-attenzione-tenue p-3">
      <p className="flex items-start gap-2 text-etichetta text-[#B8791A]">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{testo}</span>
      </p>
    </CardInterna>
  );
}
