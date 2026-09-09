"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Calculator, Check, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardInterna } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Etichetta } from "@/components/ui/etichetta";
import { Input } from "@/components/ui/input";
import { Segmenti } from "@/components/ui/segmenti";
import { SceltaDataset } from "@/components/dati/scelta-dataset";
import type { IdDataset } from "@/lib/dati/dataset";
import { BloccoScrittura } from "@/components/ui/blocco-scrittura";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { confrontaRegimi, ingressoDaProspetto } from "@/lib/fisco/confronto";
import { costiRegistrati } from "@/lib/analisi/pianificazione";
import { cercaGruppi } from "@/lib/fisco/ateco";
import { cambiamentiDiRegime } from "@/lib/fisco/regime";
import type { Riporto } from "@/lib/fisco/chiusura";
import { nomeGestione } from "@/lib/fisco/tipi";
import type { GruppoAteco, Impostazioni, ParametriAnno, Regime } from "@/lib/fisco/tipi";
import type { ContestoCalcolo } from "@/lib/onboarding/percorso";
import { aliquota, euro, interoIt, percentuale } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Modifica = (modifiche: Partial<Impostazioni>) => void;

/**
 * I controlli di ogni passo.
 *
 * Uno `switch` su un elenco chiuso invece di un campo `render` dentro la
 * definizione del passo: il modulo `percorso.ts` resta puro e testabile, e i
 * componenti restano qui dove possono usare React.
 */
export function ControlloPasso(props: {
  passo: string;
  calcolo: ContestoCalcolo;
  onModifica: Modifica;
}) {
  // Le risposte della configurazione scrivono tutte nelle impostazioni: a
  // licenza scaduta il percorso si legge — le domande e le spiegazioni restano
  // lì — e non si risponde. Un `fieldset` invece di dieci `disabilitato`:
  // spegne anche i controlli che verranno aggiunti dopo.
  return (
    <BloccoScrittura>
      <ControlloDelPasso {...props} />
    </BloccoScrittura>
  );
}

function ControlloDelPasso({
  passo,
  calcolo,
  onModifica,
}: {
  passo: string;
  calcolo: ContestoCalcolo;
  onModifica: Modifica;
}) {
  const imp = calcolo.impostazioni;
  const par = calcolo.parametri;

  switch (passo) {
    case "regime":
      return (
        <Segmenti
          etichettaGruppo="Regime fiscale"
          valore={imp.regime}
          onChange={(regime) => onModifica({ regime })}
          opzioni={[
            { valore: "forfettario", etichetta: "Forfettario" },
            { valore: "ordinario", etichetta: "Ordinario" },
          ]}
        />
      );

    case "ateco":
      return (
        <SceltaAteco
          gruppi={par.gruppiAteco}
          scelto={imp.gruppoAteco}
          coefficiente={imp.coefficienteRedditivita}
          onScegli={(gruppo) =>
            onModifica({ gruppoAteco: gruppo.codice, coefficienteRedditivita: gruppo.coefficiente })
          }
        />
      );

    case "sostitutiva":
      return (
        <div className="space-y-3">
          <Interruttore
            etichetta="Attività nuova, aperta da meno di cinque anni"
            attivo={imp.nuovaAttivita}
            onCambia={(nuovaAttivita) =>
              onModifica({
                nuovaAttivita,
                aliquotaSostitutiva: nuovaAttivita
                  ? par.aliquotaSostitutivaNuovaAttivita
                  : par.aliquotaSostitutiva,
              })
            }
          />
          <p className="text-etichetta text-inchiostro-tenue">
            Aliquota applicata: {aliquota(imp.aliquotaSostitutiva)}. Nel dubbio lascia il{" "}
            {aliquota(par.aliquotaSostitutiva)}: pagare di meno e scoprire dopo di non
            averne diritto è il modo peggiore di sbagliare.
          </p>
        </div>
      );

    case "gestione":
      return (
        <Select
          value={imp.gestione}
          onValueChange={(gestione) =>
            onModifica({ gestione: gestione as Impostazioni["gestione"] })
          }
        >
          <SelectTrigger className="w-full" aria-label="Gestione previdenziale">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="separata">
              Gestione Separata INPS — {percentuale(par.aliquotaGestioneSeparata)} del reddito
            </SelectItem>
            <SelectItem value="artigiani">
              Artigiani — {percentuale(par.artigianiCommercianti.artigiani.aliquota)} oltre il minimale
            </SelectItem>
            <SelectItem value="commercianti">
              Commercianti — {percentuale(par.artigianiCommercianti.commercianti.aliquota)} oltre il minimale
            </SelectItem>
            <SelectItem value="cassa">Cassa professionale</SelectItem>
          </SelectContent>
        </Select>
      );

    case "iva":
      return (
        <Segmenti
          etichettaGruppo="Periodicità della liquidazione IVA"
          valore={imp.periodicitaIva}
          onChange={(periodicitaIva) => onModifica({ periodicitaIva })}
          opzioni={[
            { valore: "trimestrale", etichetta: "Trimestrale" },
            { valore: "mensile", etichetta: "Mensile" },
          ]}
        />
      );

    case "ritenutaRivalsa":
      return (
        <div className="space-y-3">
          <Interruttore
            etichetta={`Addebito la rivalsa previdenziale del ${aliquota(imp.aliquotaRivalsa)}`}
            attivo={imp.rivalsaAttiva}
            onCambia={(rivalsaAttiva) => onModifica({ rivalsaAttiva })}
          />
          <Interruttore
            etichetta={`Subisco la ritenuta d'acconto del ${aliquota(imp.aliquotaRitenuta)}`}
            attivo={imp.ritenutaAttiva}
            onCambia={(ritenutaAttiva) => onModifica({ ritenutaAttiva })}
            disabilitato={imp.regime === "forfettario"}
            nota={
              imp.regime === "forfettario"
                ? "Nel forfettario la ritenuta non si applica mai: l'interruttore resta spento."
                : undefined
            }
          />
          <Interruttore
            etichetta={`Addebito il bollo da ${euro(imp.importoBollo)} al cliente`}
            attivo={imp.bolloAddebitato}
            onCambia={(bolloAddebitato) => onModifica({ bolloAddebitato })}
            nota="Se non lo addebiti resta un tuo costo, e l'app lo conta come tale."
          />
        </div>
      );

    case "pagamenti":
      return (
        <CampoNumerico
          etichetta="Giorni dall'emissione"
          valore={imp.terminiPagamento}
          onCambia={(terminiPagamento) => onModifica({ terminiPagamento })}
          suffisso="giorni"
        />
      );

    case "obiettivi":
      return <Obiettivi calcolo={calcolo} onModifica={onModifica} />;

    default:
      return null;
  }
}

/**
 * Netto voluto, costi fissi, accantonamento.
 *
 * I primi due partono vuoti. Un «12.000 €» precompilato in un campo che
 * l'utente non sa stimare viene lasciato lì, e da quel momento il punto di
 * pareggio è costruito su un numero che non ha scelto nessuno: un valore
 * inventato è peggio di un campo vuoto, perché il campo vuoto si vede.
 * L'accantonamento invece un valore predefinito ce l'ha davvero — il 30 % è la
 * regola prudenziale che l'app dichiara — e resta compilato.
 */
function Obiettivi({
  calcolo,
  onModifica,
}: {
  calcolo: ContestoCalcolo;
  onModifica: Modifica;
}) {
  const imp = calcolo.impostazioni;
  const registrati = costiRegistrati(
    calcolo.prospetto.costiCalcolati,
    calcolo.prospetto.anno,
    "fisso",
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <CampoNumericoOpzionale
          etichetta="Netto desiderato all'anno"
          valore={imp.nettoDesiderato}
          onCambia={(nettoDesiderato) => onModifica({ nettoDesiderato })}
          suffisso="€"
        />
        <CampoNumericoOpzionale
          etichetta="Costi fissi annui"
          valore={imp.costiFissiAnnui}
          onCambia={(costiFissiAnnui) => onModifica({ costiFissiAnnui })}
          suffisso="€"
        />
        <CampoNumerico
          etichetta="Accantonamento"
          valore={Math.round(imp.percentualeAccantonamento * 100)}
          onCambia={(v) =>
            onModifica({ percentualeAccantonamento: Math.min(90, Math.max(0, v)) / 100 })
          }
          suffisso="%"
        />
      </div>

      {registrati.quanti > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            scrive
            variante="contorno"
            taglia="sm"
            onClick={() => onModifica({ costiFissiAnnui: registrati.totale })}
          >
            <Calculator className="size-3.5" aria-hidden />
            Usa {euro(registrati.totale)}
          </Button>
          <p className="text-etichetta text-inchiostro-tenue">
            è la somma dei {interoIt.format(registrati.quanti)} costi che hai marcato «fisso»
            nel {calcolo.prospetto.anno}. Se ne paghi altri che non hai ancora registrato,
            aggiungili a mano.
          </p>
        </div>
      ) : (
        <p className="text-etichetta text-inchiostro-tenue">
          Nei costi fissi va quello che paghi comunque, anche in un mese senza incassi:
          canoni e abbonamenti, commercialista, assicurazione, affitto, telefono. Puoi
          lasciarlo vuoto adesso — le schermate che lo usano diranno che manca, invece di
          fingere un numero — e compilarlo dopo da qui, o dalla pianificazione. Quando
          avrai qualche costo marcato «fisso» in archivio, l&apos;app te lo propone da sé.
        </p>
      )}
    </div>
  );
}

/**
 * Un campo numerico che può essere vuoto, e resta vuoto.
 *
 * `null` non è zero: «non l'ho ancora deciso» e «è zero» sono due risposte
 * diverse, e confonderle è il modo in cui un costo fisso non dichiarato
 * diventa un pareggio a zero euro.
 */
function CampoNumericoOpzionale({
  etichetta,
  valore,
  onCambia,
  suffisso,
}: {
  etichetta: string;
  valore: number | null;
  onCambia: (v: number | null) => void;
  suffisso: string;
}) {
  return (
    <div>
      <Etichetta>{etichetta}</Etichetta>
      <div className="mt-1.5 flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          className="cifre w-full"
          placeholder="non dichiarato"
          value={valore === null ? "" : String(valore)}
          onChange={(e) => onCambia(e.target.value === "" ? null : Number(e.target.value) || 0)}
        />
        <span className="shrink-0 text-etichetta text-inchiostro-tenue">{suffisso}</span>
      </div>
    </div>
  );
}

/**
 * La scelta del gruppo ATECO, cercabile per mestiere.
 *
 * La tendina di prima elencava le nove voci come le chiama la legge, e un
 * consulente marketing non ha modo di sapere di stare nelle «attività
 * professionali, scientifiche, tecniche». Qui si scrive quello che si fa e la
 * voce viene a galla; l'elenco intero resta sotto, perché la ricerca è una
 * scorciatoia, non un filtro obbligatorio.
 */
function SceltaAteco({
  gruppi,
  scelto,
  coefficiente,
  onScegli,
}: {
  gruppi: GruppoAteco[];
  scelto: string;
  coefficiente: number;
  onScegli: (gruppo: GruppoAteco) => void;
}) {
  const [ricerca, setRicerca] = React.useState("");
  const esiti = React.useMemo(() => cercaGruppi(ricerca, gruppi), [ricerca, gruppi]);
  const id = React.useId();

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={id} className="block text-etichetta text-inchiostro-tenue">
          Cerca il tuo mestiere
        </label>
        <div className="relative mt-1.5">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-inchiostro-tenue"
            aria-hidden
          />
          <Input
            id={id}
            type="search"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="consulente, grafico, idraulico, e-commerce…"
            className="pl-9"
          />
        </div>
      </div>

      {esiti.length === 0 ? (
        // Il vicolo cieco è il momento in cui serve dire dove guardare: senza
        // questa frase resta solo un elenco vuoto e nessuna via d'uscita.
        <CardInterna className="p-4">
          <p className="text-etichetta">
            Nessun mestiere corrisponde a «{ricerca}».
          </p>
          <p className="mt-1 text-etichetta text-inchiostro-tenue">
            Il gruppo dipende dal tuo codice ATECO, che trovi nella visura camerale o nella
            comunicazione di inizio attività che hai ricevuto aprendo la partita IVA — è il
            numero tipo 70.22.09. Cerca le prime due cifre nell&apos;elenco qui sotto, oppure
            svuota la ricerca per vederlo tutto.
          </p>
          <button
            type="button"
            onClick={() => setRicerca("")}
            className="mt-2 text-etichetta font-medium text-accento underline underline-offset-2"
          >
            Mostra tutti i gruppi
          </button>
        </CardInterna>
      ) : (
        <div role="radiogroup" aria-label="Gruppo di attività" className="space-y-1.5">
          {esiti.map(({ gruppo, perche, esempi }) => {
            const attivo = gruppo.codice === scelto;
            return (
              <button
                key={gruppo.codice}
                type="button"
                role="radio"
                aria-checked={attivo}
                onClick={() => onScegli(gruppo)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-interna border px-3 py-2.5 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accento focus-visible:ring-offset-2",
                  attivo
                    ? "border-accento bg-accento-tenue"
                    : "border-bordo hover:bg-superficie-alt",
                )}
              >
                <span
                  className={cn(
                    "cifre mt-0.5 w-14 shrink-0 text-right text-corpo font-semibold tabular-nums",
                    attivo ? "text-accento" : "text-inchiostro",
                  )}
                >
                  {aliquota(gruppo.coefficiente)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-etichetta">{gruppo.descrizione}</span>
                  {/*
                    La descrizione di legge non nomina nessun mestiere, e chi
                    scorre l'elenco resta con la domanda «ci sono dentro
                    anch'io?». Gli esempi rispondono senza dover cercare.
                  */}
                  {esempi && (
                    <span className="mt-0.5 block text-micro text-inchiostro-tenue">
                      {esempi}
                    </span>
                  )}
                  {perche && (
                    <span className="mt-0.5 block text-micro text-accento">
                      trovato cercando «{perche}»
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/*
        La ricerca nasconde le voci che non c'entrano, ed è il suo mestiere. Ma
        chi non si riconosce in quello che ha trovato deve poter tornare
        all'elenco intero senza dover indovinare che basta svuotare il campo.
      */}
      {ricerca.trim() !== "" && esiti.length > 0 && esiti.length < gruppi.length && (
        <button
          type="button"
          onClick={() => setRicerca("")}
          className="text-etichetta font-medium text-accento underline underline-offset-2"
        >
          Non è nessuno di questi: mostrami tutti i {gruppi.length} gruppi
        </button>
      )}

      <p className="text-etichetta text-inchiostro-tenue">
        Coefficiente applicato: {aliquota(coefficiente)}. Il resto è considerato costo
        forfettario e non si tassa: è la percentuale dei tuoi incassi su cui pagherai.
      </p>
    </div>
  );
}

function Interruttore({
  etichetta,
  attivo,
  onCambia,
  nota,
  disabilitato = false,
}: {
  etichetta: string;
  attivo: boolean;
  onCambia: (v: boolean) => void;
  nota?: string;
  disabilitato?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="flex items-start gap-3">
      <Switch
        id={id}
        checked={attivo}
        onCheckedChange={onCambia}
        disabled={disabilitato}
        className="mt-0.5"
      />
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-corpo">
          {etichetta}
        </label>
        {nota && <p className="text-etichetta text-inchiostro-tenue">{nota}</p>}
      </div>
    </div>
  );
}

function CampoNumerico({
  etichetta,
  valore,
  onCambia,
  suffisso,
}: {
  etichetta: string;
  valore: number;
  onCambia: (v: number) => void;
  suffisso: string;
}) {
  return (
    <div>
      <Etichetta>{etichetta}</Etichetta>
      <div className="mt-1.5 flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          className="cifre w-full"
          value={String(valore)}
          onChange={(e) => onCambia(Number(e.target.value) || 0)}
        />
        <span className="shrink-0 text-etichetta text-inchiostro-tenue">{suffisso}</span>
      </div>
    </div>
  );
}

/**
 * Le due strade con cui si esce dalla configurazione.
 *
 * Non è una domanda di cortesia: chi apre l'app a gennaio non ha niente da
 * importare e senza dati non capisce a cosa servano le schermate; chi la apre
 * a settembre ha già nove mesi di fatture e un dataset finto gli sarebbe solo
 * di intralcio. Mostrarle affiancate, con scritto per chi è ciascuna, evita di
 * far indovinare.
 */
export function PartenzaConDati({
  archivioVuoto,
  onDemo,
}: {
  archivioVuoto: boolean;
  onDemo: (id: IdDataset) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <CardInterna className="flex flex-col gap-3 p-4">
          <p className="text-corpo font-medium">Voglio vedere com&apos;è fatta</p>
          <p className="text-etichetta text-inchiostro-tenue">
            Un anno intero di fatture, costi e movimenti inventati: le schermate si
            riempiono e si capisce cosa aspettarsi da ognuna. Si svuota in un clic da{" "}
            <Link href="/dati" className="underline underline-offset-2">
              Dati e backup
            </Link>
            .
          </p>
          {/* Due dataset, e la differenza non è di colore: il primo lascia in
              piedi le risposte appena date, il secondo racconta un ordinario
              suo — regime, regione e aliquote comprese. */}
          <SceltaDataset onScegli={onDemo} />
          {!archivioVuoto && (
            <p className="text-micro text-[#B8791A]">
              Attenzione: l&apos;archivio non è vuoto. I dati di esempio prendono il posto
              di quelli che ci sono adesso — si torna indietro con Annulla, subito dopo.
            </p>
          )}
        </CardInterna>

        <CardInterna className="flex flex-col gap-2 p-4">
          <p className="text-corpo font-medium">Ho già il mio storico</p>
          <p className="flex-1 text-etichetta text-inchiostro-tenue">
            Se sei arrivato a metà anno hai già fatture e costi da qualche altra parte. Un
            CSV basta: si sceglie quale colonna è quale, si vede l&apos;anteprima con gli
            importi già formattati, e l&apos;import si annulla per intero se qualcosa non
            torna.
          </p>
          <Button variante="contorno" className="self-start" asChild>
            <Link href="/importa">
              <Upload className="size-4" aria-hidden />
              Importa da CSV
            </Link>
          </Button>
        </CardInterna>
      </div>
      <p className="text-etichetta text-inchiostro-tenue">
        Nessuna delle due va bene? Salta: l&apos;archivio resta vuoto e si parte dalla prima
        fattura vera. Sono strade sempre aperte, non una scelta da fare adesso.
      </p>
    </div>
  );
}

// ————————————————————————————————————————————————————————————
// I due passi di sola lettura
// ————————————————————————————————————————————————————————————

/**
 * I riporti in arrivo dalla chiusura, da confermare uno per uno.
 *
 * La conferma non cambia gli importi — quelli si ricalcolano sempre dai
 * documenti — e non deve fingere di farlo. Serve a costringere lo sguardo su
 * ogni riga: è l'unico momento dell'anno in cui qualcuno guarda davvero il
 * saldo di apertura, e un riporto sbagliato non produce nessun errore.
 */
/**
 * Le voci di riporto, una per riga. Esportata perché la schermata deve sapere
 * quante sono per dire «4 su 6»: contarle in due posti significherebbe che un
 * giorno una riga nuova ne sposta solo uno.
 */
export function vociRiporto(
  riporto: Riporto,
): { id: string; etichetta: string; valore: string; nota: string }[] {
  const voci = [
    {
      id: "saldoCassa",
      etichetta: "Saldo di cassa",
      valore: euro(riporto.saldoCassa),
      nota: `Quello che c'era in cassa il 31 dicembre ${riporto.daAnno}: diventa il saldo di apertura.`,
    },
    {
      id: "accantonato",
      etichetta: "Tasse accantonate",
      valore: euro(riporto.accantonato),
      nota: "Sono già sul conto ma servono a pagare il saldo di giugno: restano fuori dalla liquidità disponibile.",
    },
    {
      id: "creditoIva",
      etichetta: "Credito IVA",
      valore: euro(riporto.creditoIva),
      nota:
        riporto.destinazioneCreditoIva === "compensazione"
          ? "Destinato alla compensazione: entra come credito iniziale nella liquidazione."
          : "Chiesto a rimborso: non riduce i versamenti dell'anno nuovo.",
    },
    {
      id: "creditoImposte",
      etichetta: "Crediti d'imposta",
      valore: euro(riporto.creditoImposte),
      nota: "Ritenute eccedenti e versamenti in eccesso: si scomputano dal saldo di quest'anno.",
    },
    {
      id: "fattureDaIncassare",
      etichetta: "Fatture da incassare",
      valore: euro(riporto.fattureDaIncassare.importo),
      nota:
        riporto.fattureDaIncassare.numero === 1
          ? `1 fattura emessa nel ${riporto.daAnno}: diventa ricavo nell'anno in cui rientra, l'IVA è già stata liquidata.`
          : `${interoIt.format(riporto.fattureDaIncassare.numero)} fatture emesse nel ${riporto.daAnno}: diventano ricavo nell'anno in cui rientrano, l'IVA è già stata liquidata.`,
    },
    {
      id: "costiDaPagare",
      etichetta: "Costi da pagare",
      valore: euro(riporto.costiDaPagare.importo),
      nota: `${interoIt.format(riporto.costiDaPagare.numero)} ${riporto.costiDaPagare.numero === 1 ? "documento" : "documenti"} del ${riporto.daAnno}: si ${riporto.costiDaPagare.numero === 1 ? "deduce" : "deducono"} nell'anno del pagamento, l'IVA era detraibile subito.`,
    },
  ];
  // La nota di credito compare solo se ce n'è una: una riga a zero su ogni
  // apertura d'anno, per chi non ne emette, è rumore che si impara a saltare.
  if (riporto.noteDaRimborsare.numero > 0) {
    voci.push({
      id: "noteDaRimborsare",
      etichetta: "Note di credito da rimborsare",
      valore: `− ${euro(riporto.noteDaRimborsare.importo)}`,
      nota: `${interoIt.format(riporto.noteDaRimborsare.numero)} ${riporto.noteDaRimborsare.numero === 1 ? "nota emessa" : "note emesse"} nel ${riporto.daAnno}: l'IVA è già stata stornata, i ricavi caleranno nell'anno del rimborso.`,
    });
  }
  return voci;
}

export function RiportiDaConfermare({
  riporto,
  confermati,
  onConferma,
}: {
  riporto: Riporto;
  confermati: string[];
  onConferma: (voce: string) => void;
}) {
  const voci = vociRiporto(riporto);

  return (
    <div className="space-y-2">
      {voci.map((v) => {
        const fatto = confermati.includes(v.id);
        return (
          <CardInterna
            key={v.id}
            className={cn(
              "flex flex-wrap items-start justify-between gap-3 p-4 transition-colors",
              fatto && "bg-positivo-tenue",
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-corpo font-medium">{v.etichetta}</p>
              <p className="mt-0.5 text-etichetta text-inchiostro-tenue">{v.nota}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="cifre text-corpo font-semibold tabular-nums">{v.valore}</span>
              <button
                type="button"
                onClick={() => onConferma(v.id)}
                aria-pressed={fatto}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-etichetta font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accento focus-visible:ring-offset-2",
                  fatto
                    ? "bg-[#0B8A63] text-white"
                    : "bg-superficie-alt text-inchiostro-tenue hover:bg-bordo/60",
                )}
              >
                <Check className="size-3.5" aria-hidden />
                {fatto ? "Visto" : "Conferma"}
              </button>
            </div>
          </CardInterna>
        );
      })}
    </div>
  );
}

/**
 * Il confronto fra i due regimi sui numeri reali di chi sta leggendo.
 *
 * Non un esempio: i ricavi incassati e i costi pagati che ha davvero
 * registrato. È la differenza fra «l'ordinario di solito conviene sopra i
 * tot mila euro» e «a te, quest'anno, sarebbero rimasti in tasca X in più».
 */
export function ConfrontoDeiRegimi({
  calcolo,
  precedente,
}: {
  calcolo: ContestoCalcolo;
  /** L'anno precedente, da usare quando quello corrente è ancora vuoto. */
  precedente?: ContestoCalcolo | null;
}) {
  // Il cambio di regime si affronta a gennaio, quando l'anno nuovo non ha
  // ancora un incasso: i numeri veri sono quelli dell'anno appena chiuso, e
  // sono quelli che vanno mostrati — dicendo di che anno sono.
  const conNumeri =
    calcolo.prospetto.ricaviRilevanti > 0
      ? calcolo
      : precedente && precedente.prospetto.ricaviRilevanti > 0
        ? precedente
        : calcolo;
  const annoDelConfronto = conNumeri.prospetto.anno;
  const suAnnoPrecedente = annoDelConfronto !== calcolo.prospetto.anno;

  const ingresso = ingressoDaProspetto(conNumeri.prospetto);
  const confronto = confrontaRegimi(ingresso, conNumeri.impostazioni, conNumeri.parametri);

  // La direzione è quella in cui si sta andando, non quella più comune: chi
  // rientra nel forfettario leggerebbe altrimenti l'elenco di chi ne esce.
  const verso: Regime = calcolo.impostazioni.regime === "forfettario" ? "ordinario" : "forfettario";
  const cambiamenti = cambiamentiDiRegime(
    calcolo.impostazioni.regime,
    verso,
    calcolo.impostazioni,
    calcolo.parametri,
  );

  if (ingresso.ricavi <= 0) {
    return (
      <Card className="border border-bordo">
        <div className="p-5 text-corpo text-inchiostro-tenue">
          Non ci sono ancora incassi registrati: senza numeri veri il confronto sarebbe un
          esempio, e un esempio non aiuta a decidere. Registra qualche fattura e torna qui.
        </div>
      </Card>
    );
  }

  const righe: { voce: string; forfettario: string; ordinario: string; nota?: string }[] = [
    {
      voce: "Ricavi incassati",
      forfettario: euro(confronto.forfettario.ricavi),
      ordinario: euro(confronto.ordinario.ricavi),
    },
    {
      voce: "Costi riconosciuti",
      forfettario: euro(confronto.forfettario.costiRiconosciuti),
      ordinario: euro(confronto.ordinario.costiRiconosciuti),
      nota: "Nel forfettario i costi non si deducono: lo Stato li presume nel coefficiente.",
    },
    {
      voce: "Reddito lordo",
      forfettario: euro(confronto.forfettario.redditoLordo),
      ordinario: euro(confronto.ordinario.redditoLordo),
    },
    {
      voce: "Contributi",
      forfettario: euro(confronto.forfettario.contributi),
      ordinario: euro(confronto.ordinario.contributi),
    },
    {
      voce: "Imposte",
      forfettario: euro(confronto.forfettario.imposte),
      ordinario: euro(confronto.ordinario.imposte),
      nota: "Sostitutiva unica da una parte, IRPEF a scaglioni più addizionali dall'altra.",
    },
    {
      voce: "Pressione",
      forfettario: percentuale(confronto.forfettario.pressione),
      ordinario: percentuale(confronto.ordinario.pressione),
    },
  ];

  return (
    <div className="space-y-4">
      {suAnnoPrecedente && (
        <p className="text-etichetta text-inchiostro-tenue">
          Il {calcolo.prospetto.anno} non ha ancora incassi: il confronto è calcolato sui
          numeri del {annoDelConfronto}, l&apos;ultimo anno con dati veri.
        </p>
      )}

      <Card scura className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-etichetta text-white/60">
              {confronto.forfettarioApplicabile
                ? "Netto in tasca a confronto"
                : "Quanto costa l'uscita dal forfettario"}
            </p>
            {/*
              Il segno non aggiunge niente a «a favore del»: dire due volte la
              stessa direzione, una col meno e una a parole, confonde. Resta
              l'importo, e la direzione la dice la frase.
            */}
            <p className="cifre mt-2 text-kpi-sm font-semibold text-white">
              {euro(
                Math.abs(confronto.ordinario.nettoInTasca - confronto.forfettario.nettoInTasca),
              )}
            </p>
            {/*
              «A favore del forfettario» sopra un regime che non è più
              applicabile è il tipo di frase che fa prendere una decisione
              sbagliata: sembra una scelta, ed è invece un obbligo di legge.
              Quando il forfettario è fuori portata la stessa cifra si dice per
              quello che è, il prezzo del passaggio.
            */}
            <p className="mt-1 text-etichetta text-white/60">
              {confronto.forfettarioApplicabile
                ? `differenza a favore ${
                    confronto.ordinario.nettoInTasca >= confronto.forfettario.nettoInTasca
                      ? "dell'ordinario"
                      : "del forfettario"
                  }, sui tuoi ${euro(confronto.ricavi)} di ricavi del ${annoDelConfronto}`
                : `quello che ti resta in meno sui tuoi ${euro(confronto.ricavi)} di ricavi del ${annoDelConfronto}: non è una scelta, il forfettario a questi ricavi non è più accessibile`}
            </p>
          </div>
          <Chip tono="chiaro" className="shrink-0">
            {confronto.forfettarioApplicabile ? "Entrambi applicabili" : "Solo ordinario"}
          </Chip>
        </div>
        <p className="mt-4 text-corpo text-white/70">{confronto.verdetto}</p>
      </Card>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-corpo">
          <thead>
            <tr className="border-b border-bordo">
              <th className="py-2 text-left text-etichetta font-medium text-inchiostro-tenue">
                Voce
              </th>
              <th className="py-2 text-right text-etichetta font-medium text-inchiostro-tenue">
                Forfettario
              </th>
              <th className="py-2 text-right text-etichetta font-medium text-inchiostro-tenue">
                Ordinario
              </th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <tr key={r.voce} className="border-b border-bordo last:border-0">
                <td className="py-2.5 pr-3">
                  {r.voce}
                  {r.nota && (
                    <span className="block text-micro text-inchiostro-tenue">{r.nota}</span>
                  )}
                </td>
                <td className="cifre py-2.5 text-right tabular-nums">{r.forfettario}</td>
                <td className="cifre py-2.5 text-right tabular-nums">{r.ordinario}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-inchiostro/10">
              <td className="py-2.5 pr-3 font-semibold">Netto in tasca</td>
              <td className="cifre py-2.5 text-right font-semibold tabular-nums">
                {euro(confronto.forfettario.nettoInTasca)}
              </td>
              <td className="cifre py-2.5 text-right font-semibold tabular-nums">
                {euro(confronto.ordinario.nettoInTasca)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <CardInterna className="p-4">
        <p className="text-etichetta font-semibold">
          Cosa cambia passando {verso === "ordinario" ? "all'ordinario" : "al forfettario"},
          concretamente
        </p>
        <ul className="mt-2 space-y-2">
          {cambiamenti.map((c) => (
            <li key={c.id} className="flex items-start gap-2">
              <ArrowRight className="mt-1 size-3.5 shrink-0 text-accento" aria-hidden />
              <span className="min-w-0">
                <span className="block text-etichetta">{c.titolo}</span>
                {c.dettaglio && (
                  <span className="block text-micro text-inchiostro-tenue">{c.dettaglio}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </CardInterna>
    </div>
  );
}

export function riepilogoImpostazioni(
  imp: Impostazioni,
  par: ParametriAnno,
): { passo: string; voce: string; valore: string; nonDichiarato?: boolean }[] {
  return [
    { passo: "regime", voce: "Regime", valore: imp.regime === "forfettario" ? "Forfettario" : "Ordinario" },
    {
      passo: "ateco",
      voce: "Coefficiente di redditività",
      valore: imp.regime === "forfettario" ? percentuale(imp.coefficienteRedditivita) : "—",
    },
    {
      passo: "sostitutiva",
      voce: "Imposta sostitutiva",
      valore: imp.regime === "forfettario" ? percentuale(imp.aliquotaSostitutiva) : "—",
    },
    {
      passo: "gestione",
      voce: "Cassa previdenziale",
      valore:
        imp.gestione === "separata"
          ? `Gestione Separata (${percentuale(par.aliquotaGestioneSeparata)})`
          : nomeGestione(imp.gestione),
    },
    {
      passo: "iva",
      voce: "Liquidazione IVA",
      valore: imp.regime === "ordinario" ? (imp.periodicitaIva === "mensile" ? "Mensile" : "Trimestrale") : "—",
    },
    {
      passo: "ritenutaRivalsa",
      voce: "Rivalsa e ritenuta",
      valore: `${imp.rivalsaAttiva ? "rivalsa sì" : "rivalsa no"} · ${imp.ritenutaAttiva ? "ritenuta sì" : "ritenuta no"}`,
    },
    {
      passo: "pagamenti",
      voce: "Termini di pagamento",
      valore: `${interoIt.format(imp.terminiPagamento)} giorni`,
    },
    {
      passo: "obiettivi",
      voce: "Accantonamento",
      valore: `${percentuale(imp.percentualeAccantonamento)} su ogni incasso`,
    },
    // Netto e costi fissi possono legittimamente non esserci. Scriverlo è il
    // punto: un campo vuoto dichiarato si nota, un 12.000 € inventato no.
    {
      passo: "obiettivi",
      voce: "Netto desiderato",
      valore: imp.nettoDesiderato === null ? "—" : euro(imp.nettoDesiderato),
      nonDichiarato: imp.nettoDesiderato === null,
    },
    {
      passo: "obiettivi",
      voce: "Costi fissi annui",
      valore: imp.costiFissiAnnui === null ? "—" : euro(imp.costiFissiAnnui),
      nonDichiarato: imp.costiFissiAnnui === null,
    },
  ];
}
