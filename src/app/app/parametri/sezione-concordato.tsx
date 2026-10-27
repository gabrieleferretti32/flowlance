"use client";

import * as React from "react";
import { TriangleAlert } from "lucide-react";
import { BloccoScrittura } from "@/components/ui/blocco-scrittura";
import { Card, CardCorpo, CardInterna, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputData } from "@/components/ui/input-data";
import { Segmenti } from "@/components/ui/segmenti";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { aggiornaImpostazioni } from "@/lib/dati/azioni";
import {
  REGOLE_CPB,
  TESTO_FORFETTARI,
  concordatoDi,
  elencoBienni,
  valutaConcordato,
  votoIsaValido,
} from "@/lib/fisco/cpb";
import { analizzaNumero, euro, percentuale, perCampo } from "@/lib/format";
import type { BiennioCpb, Concordato, Impostazioni } from "@/lib/fisco/tipi";

/**
 * Il blocco «Concordato preventivo biennale» nei Parametri.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché sta qui e non nella Configurazione
 * ─────────────────────────────────────────────────────────────────────────
 *
 * I Parametri sono la schermata dei numeri che **solo l'utente conosce**, e il
 * concordato è fatto esattamente di quelli: il reddito della proposta, il
 * reddito dell'anno prima rettificato, il voto ISA. Nessuno dei tre l'app può
 * calcolarlo, e nessuno dei tre ha un valore predefinito ragionevole — un
 * reddito concordato «medio» non esiste.
 *
 * A differenza delle aliquote non c'è un ripiego da marcare «predefinito»:
 * finché i numeri non ci sono, il concordato **non si applica** e il calcolo
 * resta sul reddito effettivo. È la stessa regola della tariffa oraria, dove
 * un numero inventato sarebbe peggio di nessun numero.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * In forfettario non c'è
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Non è un campo spento: è una riga che dice perché non c'è. Dal 2025 i
 * forfettari sono esclusi dal concordato, e un blocco vuoto lascerebbe a
 * chiedersi se l'app se lo sia dimenticato — la stessa ragione per cui le
 * addizionali, in forfettario, non spariscono senza dire niente.
 */
export function SezioneConcordato({
  impostazioni: imp,
  anno,
}: {
  impostazioni: Impostazioni;
  anno: number;
}) {
  if (imp.regime !== "ordinario") {
    return (
      <Card>
        <CardCorpo className="py-4">
          <p className="text-etichetta font-medium">Il concordato preventivo non ti riguarda</p>
          <p className="mt-1 text-etichetta text-inchiostro-tenue">{TESTO_FORFETTARI}.</p>
        </CardCorpo>
      </Card>
    );
  }
  return <ModuloConcordato impostazioni={imp} anno={anno} />;
}

function ModuloConcordato({
  impostazioni: imp,
  anno,
}: {
  impostazioni: Impostazioni;
  anno: number;
}) {
  const c = concordatoDi(imp);
  const esito = valutaConcordato(imp, anno);

  /*
    Le bozze dei tre campi numerici.

    Si scrive in un campo e si salva a ogni battuta valida, come fanno gli
    altri Parametri: la bozza serve perché «1.5» a metà digitazione non deve
    tornare indietro riscritto. `null` significa «non sto scrivendo»: il valore
    a schermo è quello in archivio.
  */
  const [bozze, setBozze] = React.useState<Record<string, string | null>>({});
  const bozza = (campo: string) => bozze[campo] ?? null;
  const scriviBozza = (campo: string, testo: string | null) =>
    setBozze((b) => ({ ...b, [campo]: testo }));

  function salva(modifiche: Partial<Concordato>) {
    void aggiornaImpostazioni(anno, { concordato: { ...c, ...modifiche } });
  }

  const idAderito = React.useId();
  const idSostitutiva = React.useId();

  return (
    <Card>
      <CardCorpo>
        <CardTitolo>Concordato preventivo biennale</CardTitolo>
        <CardSottotitolo>
          È la proposta dell&apos;Agenzia: per due anni paghi IRPEF e addizionali su un
          reddito <strong className="font-medium">concordato</strong> invece che su quello che
          hai guadagnato davvero. Se guadagni di più, la differenza non è tassata; se guadagni
          di meno, paghi lo stesso su quello concordato. L&apos;IVA non cambia.
        </CardSottotitolo>

        <BloccoScrittura className="contents">
          <div className="mt-4 flex items-start gap-3">
            <Switch
              id={idAderito}
              checked={c.aderito}
              onCheckedChange={(aderito) => salva({ aderito })}
              className="mt-0.5"
            />
            <div className="min-w-0">
              <label htmlFor={idAderito} className="cursor-pointer text-corpo">
                Ho aderito al concordato per questo anno
              </label>
              <p className="mt-0.5 text-etichetta text-inchiostro-tenue">
                Si aderisce solo se si è soggetti agli ISA. Nel dubbio lascialo spento: il
                calcolo resta sul reddito che hai prodotto davvero.
              </p>
            </div>
          </div>

          {c.aderito && (
            <div className="mt-5 space-y-5">
              <Campo
                etichetta="Biennio della proposta"
                aiuto="I due anni coperti dall'adesione. Fuori da questi anni il reddito concordato non esiste, e l'app torna al reddito effettivo."
              >
                <Select
                  value={c.biennio}
                  onValueChange={(biennio) => salva({ biennio: biennio as BiennioCpb })}
                >
                  <SelectTrigger className="w-full sm:w-72" aria-label="Biennio del concordato">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {elencoBienni().map(([nome, estremi]) => (
                      <SelectItem key={nome} value={nome}>
                        {nome} — anni d&apos;imposta {estremi.primo} e {estremi.ultimo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>

              <Campo
                etichetta="Tipo di adesione"
                aiuto="Chi rinnova senza interruzione non paga la maggiorazione del 10 % sulla seconda rata di acconto: l'acconto dell'anno prima era già su un reddito concordato."
              >
                <Segmenti
                  etichettaGruppo="Tipo di adesione al concordato"
                  valore={c.tipoAdesione}
                  onChange={(tipoAdesione) => salva({ tipoAdesione })}
                  opzioni={[
                    { valore: "primoIngresso", etichetta: "Primo ingresso" },
                    { valore: "rinnovo", etichetta: "Rinnovo senza interruzione" },
                  ]}
                />
              </Campo>

              <Campo
                etichetta="Data di adesione"
                aiuto={`Serve a una cosa sola: chi ha aderito ai bienni 2024-2025 o 2025-2026 entro il 12 giugno 2025 non ha il tetto di ${perCampo(REGOLE_CPB.tettoMaggiorReddito, 0)} € sull'imposta sostitutiva.`}
              >
                <InputData
                  valore={c.dataAdesione}
                  onCambia={(dataAdesione) => salva({ dataAdesione })}
                  className="w-full sm:w-48"
                  aria-label="Data di adesione al concordato"
                />
              </Campo>

              <CampoNumero
                etichetta={`Reddito concordato ${anno}`}
                aiuto="Copialo dalla proposta dell'Agenzia, per quest'anno. È il reddito su cui si calcolano IRPEF e addizionali."
                valore={c.redditoConcordato}
                bozza={bozza("redditoConcordato")}
                onBozza={(t) => scriviBozza("redditoConcordato", t)}
                onValore={(redditoConcordato) => salva({ redditoConcordato })}
                suffisso="€"
              />

              <CampoNumero
                etichetta="Reddito dell'anno precedente, rettificato"
                aiuto="Il reddito del periodo d'imposta prima del biennio, rettificato come previsto dalla norma. Non lo calcola l'app: te lo dice il commercialista, o lo trovi nella proposta. Serve a due cose: la base dell'imposta sostitutiva e la maggiorazione dell'acconto."
                valore={c.redditoPrecedenteRettificato}
                bozza={bozza("redditoPrecedenteRettificato")}
                onBozza={(t) => scriviBozza("redditoPrecedenteRettificato", t)}
                onValore={(redditoPrecedenteRettificato) => salva({ redditoPrecedenteRettificato })}
                suffisso="€"
              />

              <CampoNumero
                etichetta="Voto ISA dell'anno precedente al biennio"
                aiuto={`Da ${REGOLE_CPB.isaMinimo} a ${REGOLE_CPB.isaMassimo}, decimali ammessi. Decide l'aliquota dell'imposta sostitutiva: ${percentuale(0.1, 0)} da 8 in su, ${percentuale(0.12, 0)} da 6 a 8, ${percentuale(0.15, 0)} sotto il 6.`}
                valore={c.votoIsa}
                bozza={bozza("votoIsa")}
                onBozza={(t) => scriviBozza("votoIsa", t)}
                onValore={(votoIsa) => salva({ votoIsa })}
                decimali={2}
                errore={
                  c.votoIsa !== null && !votoIsaValido(c.votoIsa)
                    ? `Il voto ISA sta fra ${REGOLE_CPB.isaMinimo} e ${REGOLE_CPB.isaMassimo}: ${perCampo(c.votoIsa, 2)} è fuori scala, e senza un voto valido l'imposta sostitutiva non si applica.`
                    : undefined
                }
              />

              <div className="flex items-start gap-3">
                <Switch
                  id={idSostitutiva}
                  checked={c.sostitutiva}
                  onCheckedChange={(sostitutiva) => salva({ sostitutiva })}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <label htmlFor={idSostitutiva} className="cursor-pointer text-corpo">
                    Scelgo l&apos;imposta sostitutiva sul maggior reddito
                  </label>
                  <p className="mt-0.5 text-etichetta text-inchiostro-tenue">
                    È facoltativa. Sul <em>maggior reddito</em> — quanto il concordato supera il
                    reddito dell&apos;anno prima — invece di IRPEF e addizionali paghi
                    un&apos;aliquota sola, scelta dal voto ISA. Sopra{" "}
                    {perCampo(REGOLE_CPB.tettoMaggiorReddito, 0)} € di maggior reddito
                    l&apos;eccedenza va comunque al {percentuale(REGOLE_CPB.aliquotaOltreTetto, 0)}.
                  </p>
                </div>
              </div>
            </div>
          )}
        </BloccoScrittura>

        {esito && <RiepilogoConcordato esito={esito} />}
      </CardCorpo>
    </Card>
  );
}

/** Quello che il concordato sta facendo, detto dopo averlo compilato. */
function RiepilogoConcordato({
  esito,
}: {
  esito: NonNullable<ReturnType<typeof valutaConcordato>>;
}) {
  return (
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

      {esito.attivo && (
        <p className="text-etichetta text-inchiostro-tenue">
          Le imposte di quest&apos;anno si calcolano su {euro(esito.redditoConcordato)}.
          {esito.sostitutivaApplicata && esito.sostitutiva
            ? ` Di questi, ${euro(esito.sostitutiva.base)} sono maggior reddito e pagano ${euro(esito.sostitutiva.imposta)} di imposta sostitutiva.`
            : ""}
          {esito.maggiorazioneAcconto > 0
            ? ` Al 30 novembre si aggiunge la maggiorazione dell'acconto: ${euro(esito.maggiorazioneAcconto)}.`
            : ""}
        </p>
      )}
    </div>
  );
}

function Campo({
  etichetta,
  aiuto,
  children,
}: {
  etichetta: string;
  aiuto: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-corpo font-medium">{etichetta}</p>
      <p className="mt-0.5 mb-2 text-etichetta text-inchiostro-tenue">{aiuto}</p>
      {children}
    </div>
  );
}

/**
 * Un numero che può non esserci.
 *
 * `null` non è zero, e il campo vuoto resta vuoto: un reddito concordato a
 * zero azzererebbe l'IRPEF, un voto ISA a zero sceglierebbe il 15 %. Svuotare
 * il campo riporta a `null`, che è «non lo so ancora» — l'unico stato che
 * ferma il calcolo invece di falsarlo.
 */
function CampoNumero({
  etichetta,
  aiuto,
  valore,
  bozza,
  onBozza,
  onValore,
  suffisso,
  decimali = 0,
  errore,
}: {
  etichetta: string;
  aiuto: string;
  valore: number | null;
  bozza: string | null;
  onBozza: (t: string | null) => void;
  onValore: (v: number | null) => void;
  suffisso?: string;
  decimali?: number;
  errore?: string;
}) {
  const id = React.useId();
  const mostrato = bozza ?? (valore === null ? "" : perCampo(valore, decimali));
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
            if (letto !== null) onValore(letto);
          }}
          onBlur={() => onBozza(null)}
          className="w-full sm:w-48"
        />
        {suffisso && <span className="text-etichetta text-inchiostro-tenue">{suffisso}</span>}
      </div>
      {errore && <p className="mt-2 text-etichetta text-[#B8791A]">{errore}</p>}
    </div>
  );
}
