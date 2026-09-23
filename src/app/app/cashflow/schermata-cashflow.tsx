"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardCorpo, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { CaricamentoTabella } from "@/components/ui/caricamento";
import {
  ElencoSchede,
  Scheda,
  SchedaTesta,
  SchedaTotale,
  SchedaVoci,
} from "@/components/tabella/schede";
import { Campo, Input } from "@/components/ui/input";
import { BloccoScrittura } from "@/components/ui/blocco-scrittura";
import { Kpi } from "@/components/ui/kpi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ContenitoreTabella,
  Tabella,
  TabellaCella,
  TabellaCorpo,
  TabellaIntestazione,
  TabellaPiede,
  TabellaRiga,
  TabellaTesta,
} from "@/components/ui/tabella";
import { CellaModificabile } from "@/components/tabella/cella-modificabile";
import { AndamentoCassa } from "@/components/grafici/andamento-cassa";
import { Guscio } from "@/components/guscio/guscio";
import {
  assegnaAnnoImposta,
  assegnaPagatoDa,
  creaVersamento,
  eliminaVersamento,
  salvaMovimentoAttivita,
  salvaMovimentoPersonale,
} from "@/lib/dati/azioni";
import { useCalcoloAnno, useDati } from "@/lib/dati/hooks";
import { ROTTE } from "@/lib/rotte";
import { sovrapposizionePersonale } from "@/lib/finanze/sovrapposizione";
import { riepilogoDellAnno, seRiaprissi } from "@/lib/finanze/derivazione";
import { InputData } from "@/components/ui/input-data";
import { usePreferenze } from "@/lib/stato/preferenze";
import { analizzaNumero, data as fmtData, euro, nomeMese } from "@/lib/format";
import type { VersamentoF24 } from "@/lib/dati/tipi";

const TIPI_F24: { valore: VersamentoF24["tipo"]; etichetta: string }[] = [
  { valore: "imposte", etichetta: "Imposte" },
  { valore: "contributi", etichetta: "Contributi" },
  { valore: "iva", etichetta: "IVA" },
];

export function SchermataCashflow() {
  const anno = usePreferenze((s) => s.periodo.anno);
  const [oggi] = React.useState(() => new Date().toISOString().slice(0, 10));
  const dati = useDati();
  const calcolo = useCalcoloAnno(anno, oggi);

  // Il cashflow arriva dalla catena degli anni, non ricalcolato qui: è l'unico
  // modo perché apra con il saldo e l'accantonato lasciati dall'anno prima.
  const cashflow = calcolo?.cashflow ?? null;

  if (!dati || !calcolo || !cashflow) {
    return (
      <Guscio titolo="Cashflow">
        <Card>
          <CaricamentoTabella righe={6} />
        </Card>
      </Guscio>
    );
  }

  /*
    Il registro delle finanze personali, se c'è.

    Qui si scrivono a mano i prelievi e le altre uscite del mese; di là si
    registra movimento per movimento. Sono lo stesso denaro, e finché il
    riepilogo non si deriva dal registro — prima che il modulo esca, sta in
    APPROSSIMAZIONI.md — chi compila tutti e due i posti conta due volte gli
    stessi soldi senza che niente glielo dica. Questa è una lettura in più in
    questa schermata: non tocca il motore e non cambia nessun numero.
  */
  const registro = sovrapposizionePersonale(dati.pfMovimenti, anno);

  /*
    Da dove arriva il riepilogo di ogni mese: il registro, o quello che si
    scrive qui. La regola 2 della derivazione dice che va detto mese per mese,
    e non basta una frase in testa alla tabella: chi guarda una riga deve
    sapere se quella cifra la può ancora cambiare.

    In un anno chiuso il registro non deriva niente — la chiusura è una
    dichiarazione — ma i movimenti ci sono, e tacerli farebbe credere che
    l'import non abbia funzionato.
  */
  const righeRiepilogo = riepilogoDellAnno(
    dati.movimentiPersonali,
    dati.pfMovimenti,
    dati.pfCategorie,
    anno,
    calcolo.chiuso,
  );
  const fonteDi = (mese: number) => righeRiepilogo[mese - 1];
  const derivati = righeRiepilogo.filter((r) => r.fonte === "registro");
  const trattenuti = righeRiepilogo.filter((r) => r.fonte === "chiuso");
  /** «giugno», «giugno e agosto», «giugno, luglio e agosto». */
  const nomiMesi = (righe: typeof righeRiepilogo) => {
    const nomi = righe.map((r) => nomeMese(r.mese).toLowerCase());
    if (nomi.length <= 1) return nomi.join("");
    return `${nomi.slice(0, -1).join(", ")} e ${nomi[nomi.length - 1]}`;
  };
  /* Che cosa cambierebbe riaprendo: si può dire solo finché la chiusura c'è. */
  const cambierebbe = seRiaprissi(dati.movimentiPersonali, dati.pfMovimenti, dati.pfCategorie, anno);

  const versamentiAnno = dati.versamenti
    .filter((v) => v.data.startsWith(String(anno)))
    .sort((a, b) => a.data.localeCompare(b.data));
  /* Vero solo se in quest'anno qualche F24 è uscito dal conto personale. */
  const conF24Personali = cashflow.mesi.some((m) => m.f24DalContoPersonale > 0);

  return (
    <Guscio
      titolo="Cashflow"
      descrizione={`Anno ${anno} · conta quando il denaro si muove davvero`}
    >
      <div className="space-y-4">
        <section aria-label="Sintesi di cassa" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            sfondo="indaco"
            etichetta="Entrate totali"
            valore={euro(cashflow.totaleEntrate)}
            nota={`saldo iniziale ${euro(cashflow.saldoIniziale)}`}
          />
          <Kpi sfondo="ambra" etichetta="Uscite totali" valore={euro(cashflow.totaleUscite)} nota="costi, F24 e prelievi" />
          <Kpi etichetta="Saldo di cassa" valore={euro(cashflow.saldoFinale)} nota="a fine anno" />
          <Kpi
            sfondo="scuro"
            etichetta="Liquidità netta"
            valore={euro(cashflow.liquiditaNettaFinale)}
            nota={`al netto di ${euro(cashflow.accantonatoTotale)} accantonati`}
          />
        </section>

        {cashflow.meseNegativo && (
          <Card className="border border-negativo/25 bg-negativo-tenue">
            <CardCorpo className="flex items-start gap-3 py-4">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-negativo" aria-hidden />
              <p className="text-corpo text-[#C13237]">
                La cassa va sotto zero a {nomeMese(cashflow.meseNegativo.mese)}, fino a{" "}
                {euro(cashflow.meseNegativo.saldoCassa)}. Rivedi i prelievi o sposta un
                versamento: è il mese da cui ci si accorge dei problemi.
              </p>
            </CardCorpo>
          </Card>
        )}

        <Card className="overflow-hidden">
          <CardCorpo className="pb-3">
            <CardTitolo>Saldo e liquidità netta</CardTitolo>
            <CardSottotitolo>
              La distanza fra le due linee è il denaro che sta sul conto ma non è tuo.
            </CardSottotitolo>
          </CardCorpo>
          <AndamentoCassa mesi={cashflow.mesi} />
        </Card>

        <Card className="overflow-hidden">
          <CardCorpo className="pb-2">
            <CardTitolo>Flusso mensile</CardTitolo>
            <CardSottotitolo>
              Le colonne chiare arrivano dai registri. Le altre entrate, le altre uscite e i
              prelievi li scrivi tu: bastano un clic e Invio.
            </CardSottotitolo>
            {/*
              Prima qui c'era l'avviso del doppio conteggio: «quello che
              compare in tutti e due i posti è contato due volte». Adesso il
              riepilogo si deriva, quindi il doppione non c'è più e l'avviso
              non serve — resta da dire **da dove arrivano** le cifre, che è la
              regola 2, e da dire quando un anno chiuso sta tenendo ferme cifre
              che il registro contraddice, che è la regola 5.
            */}
            {trattenuti.length > 0 ? (
              <p className="mt-2 text-micro text-attenzione">
                Il {anno} è chiuso, quindi <strong>il riepilogo resta quello dichiarato alla
                chiusura</strong>: nel registro personale ci sono{" "}
                {registro.quanti === 1 ? "un movimento" : `${registro.quanti} movimenti`} in{" "}
                {nomiMesi(trattenuti)} — {euro(registro.entrate)} in entrata e{" "}
                {euro(registro.uscite)} in uscita — e non entrano in queste colonne.{" "}
                {/*
                  Che cosa cambierebbe, detto **prima**: riaprire cancella la
                  chiusura, e con lei il termine di paragone, quindi lo
                  scostamento «alla chiusura era X» dopo non si può più
                  mostrare. Il momento per vedere la differenza è questo.
                */}
                Riaprendo l&apos;anno i prelievi di {nomiMesi(trattenuti)} passerebbero da{" "}
                {euro(cambierebbe.dichiarati)} a {euro(cambierebbe.derivati)} (
                {cambierebbe.differenza > 0 ? "+" : ""}
                {euro(cambierebbe.differenza)}), e da lì in poi arriverebbero dal registro.{" "}
                <Link href={ROTTE.chiusura} className="underline underline-offset-2">
                  Vai alla chiusura d&apos;anno
                </Link>
                .
              </p>
            ) : derivati.length > 0 ? (
              <p className="mt-2 text-micro text-inchiostro-tenue">
                I prelievi di {nomiMesi(derivati)} <strong>arrivano dal registro personale</strong>{" "}
                ({registro.quanti === 1 ? "un movimento" : `${registro.quanti} movimenti`}): si
                aggiornano da soli e non si scrivono più a mano. Gli altri mesi restano tuoi.{" "}
                <Link href={ROTTE.finanzeMovimenti} className="underline underline-offset-2">
                  Vedi il registro
                </Link>
                .
              </p>
            ) : null}
          </CardCorpo>
          {/*
            Alta abbastanza da contenere l'apertura, i dodici mesi e il totale
            senza scorrere: un anno di cassa in cui l'ultimo trimestre resta
            sotto il bordo è un anno che non si legge.
          */}
          <ContenitoreTabella
            data-scroll-ok
            classeGuscio="hidden md:block"
            className="max-h-[48rem] px-2 pb-2"
          >
            <Tabella>
              <TabellaTesta>
                <tr>
                  <TabellaIntestazione>Mese</TabellaIntestazione>
                  <TabellaIntestazione numerica>Incassi</TabellaIntestazione>
                  <TabellaIntestazione numerica>Altre entrate</TabellaIntestazione>
                  <TabellaIntestazione numerica>Costi</TabellaIntestazione>
                  <TabellaIntestazione numerica>IVA versata</TabellaIntestazione>
                  <TabellaIntestazione numerica className="whitespace-nowrap">
                    Imposte e contributi
                  </TabellaIntestazione>
                  {/*
                    La colonna compare solo se qualche F24 dell'anno è uscito
                    dal conto personale. Tenerla sempre vorrebbe dire una
                    colonna di zeri per quasi tutti, e undici colonne sono già
                    tante; ometterla quando serve vorrebbe dire una tabella che
                    non quadra con l'elenco dei versamenti qui sotto.
                  */}
                  {conF24Personali && (
                    <TabellaIntestazione numerica className="whitespace-nowrap">
                      F24 dal personale
                    </TabellaIntestazione>
                  )}
                  <TabellaIntestazione numerica>Prelievi</TabellaIntestazione>
                  <TabellaIntestazione numerica>Altre uscite</TabellaIntestazione>
                  <TabellaIntestazione numerica>Flusso</TabellaIntestazione>
                  <TabellaIntestazione numerica>Saldo</TabellaIntestazione>
                  <TabellaIntestazione numerica className="whitespace-nowrap">
                    Liquidità netta
                  </TabellaIntestazione>
                </tr>
              </TabellaTesta>
              <TabellaCorpo>
                {/*
                  La riga di apertura non è decorativa: è il punto in cui si vede
                  che il 1° gennaio la liquidità netta non risale. Senza il
                  riporto dell'accantonato, questa riga mostrerebbe l'intero
                  saldo come disponibile.
                */}
                <TabellaRiga className="bg-superficie-alt/60">
                  <TabellaCella className="whitespace-nowrap font-medium">
                    1° gennaio
                  </TabellaCella>
                  <TabellaCella
                    numerica
                    colSpan={conF24Personali ? 8 : 7}
                    className="text-inchiostro-tenue"
                  >
                    {cashflow.accantonatoIniziale > 0
                      ? `riporto dal ${anno - 1}, di cui ${euro(cashflow.accantonatoIniziale)} già accantonati`
                      : `saldo di apertura del ${anno}`}
                  </TabellaCella>
                  <TabellaCella numerica className="text-inchiostro-tenue">
                    —
                  </TabellaCella>
                  <TabellaCella numerica>{euro(cashflow.saldoIniziale)}</TabellaCella>
                  <TabellaCella numerica>{euro(cashflow.liquiditaNettaIniziale)}</TabellaCella>
                </TabellaRiga>
                {cashflow.mesi.map((m) => (
                  <TabellaRiga key={m.mese}>
                    <TabellaCella className="whitespace-nowrap capitalize">
                      {nomeMese(m.mese)}
                    </TabellaCella>
                    <TabellaCella numerica>{euro(m.incassiClienti)}</TabellaCella>
                    <TabellaCella className="p-1">
                      <CellaModificabile
                        tipo="valuta"
                        etichetta={`Altre entrate di ${nomeMese(m.mese)}`}
                        valore={m.altreEntrate}
                        onSalva={(v) => void salvaMovimentoAttivita(anno, m.mese, { altreEntrate: Number(v) })}
                      />
                    </TabellaCella>
                    <TabellaCella numerica>{euro(m.costiPagati)}</TabellaCella>
                    <TabellaCella numerica>{euro(m.ivaVersata)}</TabellaCella>
                    <TabellaCella numerica>{euro(m.imposteEContributi)}</TabellaCella>
                    {conF24Personali && (
                      <TabellaCella numerica className="text-inchiostro-tenue">
                        {euro(m.f24DalContoPersonale)}
                      </TabellaCella>
                    )}
                    {fonteDi(m.mese).fonte === "registro" ? (
                      /*
                        Derivato: non si scrive a mano, e si vede che non si
                        può. Lasciare la cella modificabile sarebbe peggio di
                        un campo grigio — si scriverebbe un numero che al
                        prossimo render torna quello di prima, senza un errore.
                      */
                      <TabellaCella
                        numerica
                        className="italic text-inchiostro-tenue"
                        title={`Dal registro personale: ${fonteDi(m.mese).quanti} movimenti in ${nomeMese(m.mese).toLowerCase()}.`}
                      >
                        {euro(m.prelieviPersonali)}
                      </TabellaCella>
                    ) : (
                      <TabellaCella className="p-1">
                        <CellaModificabile
                          tipo="valuta"
                          etichetta={`Prelievi di ${nomeMese(m.mese)}`}
                          valore={m.prelieviPersonali}
                          onSalva={(v) => void salvaMovimentoPersonale(anno, m.mese, { prelievi: Number(v) })}
                        />
                      </TabellaCella>
                    )}
                    <TabellaCella className="p-1">
                      <CellaModificabile
                        tipo="valuta"
                        etichetta={`Altre uscite di ${nomeMese(m.mese)}`}
                        valore={m.altreUscite}
                        onSalva={(v) => void salvaMovimentoAttivita(anno, m.mese, { altreUscite: Number(v) })}
                      />
                    </TabellaCella>
                    <TabellaCella
                      numerica
                      className={m.flussoNetto < 0 ? "text-negativo" : undefined}
                    >
                      {euro(m.flussoNetto)}
                    </TabellaCella>
                    <TabellaCella
                      numerica
                      className={m.saldoCassa < 0 ? "font-medium text-negativo" : "font-medium"}
                    >
                      {euro(m.saldoCassa)}
                    </TabellaCella>
                    <TabellaCella
                      numerica
                      className={m.liquiditaNetta < 0 ? "text-negativo" : "text-inchiostro-tenue"}
                    >
                      {euro(m.liquiditaNetta)}
                    </TabellaCella>
                  </TabellaRiga>
                ))}
              </TabellaCorpo>
              <TabellaPiede>
                <tr>
                  <TabellaCella>Totale</TabellaCella>
                  <TabellaCella numerica>
                    {euro(cashflow.mesi.reduce((a, m) => a + m.incassiClienti, 0))}
                  </TabellaCella>
                  <TabellaCella numerica>
                    {euro(cashflow.mesi.reduce((a, m) => a + m.altreEntrate, 0))}
                  </TabellaCella>
                  <TabellaCella numerica>
                    {euro(cashflow.mesi.reduce((a, m) => a + m.costiPagati, 0))}
                  </TabellaCella>
                  <TabellaCella numerica>
                    {euro(cashflow.mesi.reduce((a, m) => a + m.ivaVersata, 0))}
                  </TabellaCella>
                  <TabellaCella numerica>
                    {euro(cashflow.mesi.reduce((a, m) => a + m.imposteEContributi, 0))}
                  </TabellaCella>
                  {conF24Personali && (
                    <TabellaCella numerica className="text-inchiostro-tenue">
                      {euro(cashflow.mesi.reduce((a, m) => a + m.f24DalContoPersonale, 0))}
                    </TabellaCella>
                  )}
                  <TabellaCella numerica>
                    {euro(cashflow.mesi.reduce((a, m) => a + m.prelieviPersonali, 0))}
                  </TabellaCella>
                  <TabellaCella numerica>
                    {euro(cashflow.mesi.reduce((a, m) => a + m.altreUscite, 0))}
                  </TabellaCella>
                  <TabellaCella numerica>
                    {euro(cashflow.totaleEntrate - cashflow.totaleUscite)}
                  </TabellaCella>
                  <TabellaCella numerica>{euro(cashflow.saldoFinale)}</TabellaCella>
                  <TabellaCella numerica>{euro(cashflow.liquiditaNettaFinale)}</TabellaCella>
                </tr>
              </TabellaPiede>
            </Tabella>
          </ContenitoreTabella>

          {/* Sul telefono ogni mese è una scheda. In testa il saldo, che è la
              domanda («a fine mese quanto c'era?»), e sotto le voci; i tre
              campi che si compilano a mano restano modificabili. */}
          <ElencoSchede>
            <Scheda className="bg-superficie-alt/60">
              <SchedaTesta
                titolo="1° gennaio"
                sotto={
                  cashflow.accantonatoIniziale > 0
                    ? `riporto dal ${anno - 1}, di cui ${euro(cashflow.accantonatoIniziale)} già accantonati`
                    : `saldo di apertura del ${anno}`
                }
                valore={euro(cashflow.saldoIniziale)}
                notaValore={`${euro(cashflow.liquiditaNettaIniziale)} disponibili`}
              />
            </Scheda>
            {cashflow.mesi.map((m) => (
              <Scheda key={m.mese}>
                <SchedaTesta
                  titolo={<span className="capitalize">{nomeMese(m.mese)}</span>}
                  sotto={`${euro(m.liquiditaNetta)} di liquidità netta`}
                  valore={
                    <span className={m.saldoCassa < 0 ? "text-negativo" : undefined}>
                      {euro(m.saldoCassa)}
                    </span>
                  }
                  notaValore="saldo di cassa"
                />
                <SchedaVoci
                  voci={[
                    { etichetta: "Incassi", valore: euro(m.incassiClienti), mostra: m.incassiClienti > 0 },
                    { etichetta: "Costi pagati", valore: euro(m.costiPagati), mostra: m.costiPagati > 0 },
                    { etichetta: "IVA versata", valore: euro(m.ivaVersata), mostra: m.ivaVersata > 0 },
                    {
                      etichetta: "Imposte e contributi",
                      valore: euro(m.imposteEContributi),
                      mostra: m.imposteEContributi > 0,
                    },
                    {
                      etichetta: "F24 dal personale",
                      valore: euro(m.f24DalContoPersonale),
                      mostra: m.f24DalContoPersonale > 0,
                    },
                    {
                      etichetta: "Flusso",
                      valore: (
                        <span className={m.flussoNetto < 0 ? "text-negativo" : undefined}>
                          {euro(m.flussoNetto)}
                        </span>
                      ),
                    },
                  ]}
                />
                <div className="mt-3 grid gap-1.5 min-[360px]:grid-cols-3">
                  <CampoMese
                    etichetta="Altre entrate"
                    valore={m.altreEntrate}
                    nome={`Altre entrate di ${nomeMese(m.mese)}`}
                    onSalva={(v) => void salvaMovimentoAttivita(anno, m.mese, { altreEntrate: v })}
                  />
                  <CampoMese
                    etichetta="Altre uscite"
                    valore={m.altreUscite}
                    nome={`Altre uscite di ${nomeMese(m.mese)}`}
                    onSalva={(v) => void salvaMovimentoAttivita(anno, m.mese, { altreUscite: v })}
                  />
                  <CampoMese
                    etichetta="Prelievi"
                    valore={m.prelieviPersonali}
                    nome={`Prelievi di ${nomeMese(m.mese)}`}
                    derivato={fonteDi(m.mese).fonte === "registro"}
                    onSalva={(v) => void salvaMovimentoPersonale(anno, m.mese, { prelievi: v })}
                  />
                </div>
              </Scheda>
            ))}
            <SchedaTotale
              etichetta="A fine anno"
              valore={euro(cashflow.saldoFinale)}
              nota={`${euro(cashflow.liquiditaNettaFinale)} disponibili`}
            />
          </ElencoSchede>
        </Card>

        <ElencoVersamenti anno={anno} versamenti={versamentiAnno} />
      </div>
    </Guscio>
  );
}

/**
 * L'anno d'imposta di un versamento, e il modo di assegnarlo se manca.
 *
 * Chi ha registrato F24 prima che il campo esistesse li vede contrassegnati:
 * il numero non è cambiato, ma è una supposizione basata sulla data, e finché
 * resta tale va detto qui — dove il versamento si vede — e non solo nel
 * prospetto.
 */
function AnnoImposta({ versamento }: { versamento: VersamentoF24 }) {
  const annoDellaData = Number(versamento.data.slice(0, 4));
  if (versamento.annoImposta !== undefined) {
    return (
      <span className="text-micro text-inchiostro-tenue">
        anno d&apos;imposta {versamento.annoImposta}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <span className="rounded-full bg-attenzione-tenue px-2 py-0.5 text-micro text-inchiostro">
        anno d&apos;imposta da assegnare
      </span>
      {[annoDellaData - 1, annoDellaData].map((a) => (
        <Button
          scrive
          key={a}
          variante="contorno"
          taglia="sm"
          onClick={() => void assegnaAnnoImposta(versamento, a)}
        >
          {a}
        </Button>
      ))}
    </span>
  );
}

/**
 * Da quale conto è uscito l'F24, e come cambiarlo da dove si vede.
 *
 * L'etichetta c'è anche quando la risposta è quella di sempre — «dal conto
 * dell'attività» — perché altrimenti il caso normale non sarebbe cambiabile:
 * si potrebbe solo marcare un F24 come personale e mai tornare indietro. Il
 * caso normale resta però in tono quieto, e quello personale si vede: è
 * l'unico che spiega perché nella tabella dei mesi quel bonifico non c'è.
 */
function PagatoDa({ versamento }: { versamento: VersamentoF24 }) {
  const personale = versamento.pagatoDa === "personale";
  return (
    <Button
      scrive
      variante={personale ? "contorno" : "quieto"}
      taglia="sm"
      className="text-micro"
      aria-label={
        personale
          ? `Segna l'F24 del ${fmtData(versamento.data)} come pagato dal conto dell'attività`
          : `Segna l'F24 del ${fmtData(versamento.data)} come pagato dal conto personale`
      }
      onClick={() => void assegnaPagatoDa(versamento, personale ? "attivita" : "personale")}
    >
      {personale ? "dal conto personale" : "dal conto dell'attività"}
    </Button>
  );
}

function ElencoVersamenti({ anno, versamenti }: { anno: number; versamenti: VersamentoF24[] }) {
  const [data, setData] = React.useState(`${anno}-06-30`);
  const [tipo, setTipo] = React.useState<VersamentoF24["tipo"]>("imposte");
  const [importo, setImporto] = React.useState("");
  /*
    L'anno d'imposta non si deduce dalla data: il 30 giugno escono insieme il
    saldo dell'anno prima e il primo acconto di quello in corso. Si propone
    l'anno della data — scritto, non nascosto — e l'altro è una scelta sola.
  */
  const [annoScelto, setAnnoScelto] = React.useState<number | null>(null);
  /*
    Da quale conto esce l'F24. Si propone l'attività perché è quello che fanno
    quasi tutti, e la scelta è scritta: chi si preleva lo stipendio lordo e
    paga il fisco dal conto personale deve poterlo dire qui, altrimenti la
    tabella dei mesi gli toglie due volte lo stesso euro.
  */
  const [pagatoDa, setPagatoDa] = React.useState<"attivita" | "personale">("attivita");
  const annoDellaData = Number(data.slice(0, 4)) || anno;
  const annoImposta = annoScelto ?? annoDellaData;

  const valore = analizzaNumero(importo) ?? 0;
  const totale = versamenti.reduce((a, v) => a + v.importo, 0);

  return (
    <Card>
      <CardCorpo className="pb-3">
        <CardTitolo>Versamenti F24 dell&apos;anno</CardTitolo>
        <CardSottotitolo>
          Quello che hai davvero pagato. I contributi registrati qui vengono dedotti per
          cassa nel prospetto fiscale, al posto di quelli di competenza. L&apos;anno
          d&apos;imposta è un&apos;altra cosa dalla data: il 30 giugno si versa insieme il
          saldo dell&apos;anno prima e il primo acconto di quello in corso, e solo il
          secondo abbassa il dovuto dell&apos;anno in corso. Il conto da cui l&apos;F24 è
          uscito cambia solo la tabella dei mesi qui sopra: quelli pagati dal conto
          personale non sono un&apos;uscita di questa cassa, e per il fisco valgono
          come tutti gli altri.
        </CardSottotitolo>
      </CardCorpo>

      <ul className="divide-y divide-bordo/70 border-y border-bordo">
        {versamenti.length === 0 ? (
          <li className="px-4 py-4 text-corpo text-inchiostro-tenue sm:px-6">
            Nessun F24 registrato per il {anno}.
          </li>
        ) : (
          versamenti.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="cifre text-etichetta text-inchiostro-tenue">{fmtData(v.data)}</span>
                <span className="text-corpo">
                  {TIPI_F24.find((t) => t.valore === v.tipo)?.etichetta}
                </span>
                <AnnoImposta versamento={v} />
                <PagatoDa versamento={v} />
              </span>
              <span className="flex items-center gap-3">
                <span className="cifre text-corpo font-medium">{euro(v.importo)}</span>
                <Button scrive
                  variante="quieto"
                  taglia="icona"
                  aria-label={`Elimina il versamento del ${fmtData(v.data)}`}
                  onClick={() => void eliminaVersamento(v)}
                  className="hover:bg-negativo-tenue hover:text-negativo"
                >
                  <Trash2 className="size-4" />
                </Button>
              </span>
            </li>
          ))
        )}
        {versamenti.length > 0 && (
          <li className="flex items-center justify-between bg-superficie-alt/70 px-4 py-2.5 sm:px-6">
            <span className="text-etichetta font-medium">Totale versato</span>
            <span className="cifre pr-11 text-corpo font-semibold">{euro(totale)}</span>
          </li>
        )}
      </ul>

      <CardCorpo className="pt-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (valore <= 0) return;
            void creaVersamento({
              data,
              tipo,
              importo: valore,
              annoImposta,
              ...(pagatoDa === "personale" ? { pagatoDa } : {}),
            });
            setImporto("");
          }}
        >
          <BloccoScrittura className="contents">
          {/*
            La data di un F24 si scrive a mano, e il campo nativo mostra il
            formato della lingua del browser: un italiano con Chrome in
            inglese scriverebbe il 30 giugno nella casella del 6 luglio. Vedi
            `InputData`.
          */}
          <Campo etichetta="Data" htmlFor="f24-data" className="w-44">
            <InputData id="f24-data" valore={data} onCambia={(iso) => setData(iso ?? "")} />
          </Campo>
          <Campo etichetta="Tipo" htmlFor="f24-tipo" className="w-44">
            <Select value={tipo} onValueChange={(v) => setTipo(v as VersamentoF24["tipo"])}>
              <SelectTrigger id="f24-tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPI_F24.map((t) => (
                  <SelectItem key={t.valore} value={t.valore}>{t.etichetta}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo etichetta="Anno d'imposta" htmlFor="f24-anno" className="w-44">
            <Select
              value={String(annoImposta)}
              onValueChange={(v) => setAnnoScelto(Number(v))}
            >
              <SelectTrigger id="f24-anno">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[annoDellaData - 1, annoDellaData].map((a) => (
                  <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo etichetta="Pagato da" htmlFor="f24-conto" className="w-52">
            <Select
              value={pagatoDa}
              onValueChange={(v) => setPagatoDa(v as "attivita" | "personale")}
            >
              <SelectTrigger id="f24-conto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attivita">Conto dell&apos;attività</SelectItem>
                <SelectItem value="personale">Conto personale</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
          <Campo etichetta="Importo" htmlFor="f24-importo" className="w-44">
            <Input
              id="f24-importo"
              numerico
              inputMode="decimal"
              value={importo}
              onChange={(e) => setImporto(e.target.value)}
              placeholder="0,00"
            />
          </Campo>
          <Button type="submit" disabled={valore <= 0}>
            <Plus className="size-4" aria-hidden />
            Registra
          </Button>
          </BloccoScrittura>
        </form>
      </CardCorpo>
    </Card>
  );
}

/**
 * Un campo mensile nella scheda del telefono.
 * L'etichetta va scritta: nella tabella la dava la colonna, qui no.
 */
function CampoMese({
  etichetta,
  nome,
  valore,
  derivato = false,
  onSalva,
}: {
  etichetta: string;
  nome: string;
  valore: number;
  /** Arriva dal registro: si legge e non si scrive. */
  derivato?: boolean;
  onSalva: (valore: number) => void;
}) {
  return (
    <div>
      <p className="text-micro text-inchiostro-tenue">
        {etichetta}
        {derivato && " · dal registro"}
      </p>
      {derivato ? (
        <p className="px-2 py-2 text-corpo italic text-inchiostro-tenue">{euro(valore)}</p>
      ) : (
        <CellaModificabile
          tipo="valuta"
          etichetta={nome}
          valore={valore}
          className="border-bordo"
          onSalva={(v) => onSalva(Number(v))}
        />
      )}
    </div>
  );
}
