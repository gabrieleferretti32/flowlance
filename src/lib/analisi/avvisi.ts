/**
 * Gli avvisi del cruscotto.
 *
 * Ognuno dice che cosa succede e che cosa farne: un avviso senza un'azione è
 * solo un modo elegante di preoccupare qualcuno. Quando l'azione non esiste
 * ancora, la frase la descrive a parole invece di fingere un pulsante.
 */
import { giorniAllaData } from "@/lib/fisco/calendario";
import type { Adempimento } from "@/lib/fisco/scadenze";
import type { Prospetto } from "@/lib/fisco/motore";
import type { CostoCalcolato, FatturaCalcolata, Impostazioni } from "@/lib/fisco/tipi";
import { euro, euroTondo, percentuale } from "@/lib/format";

export type TonoAvviso = "positivo" | "attenzione" | "negativo" | "accento";

export type Avviso = {
  id: string;
  tono: TonoAvviso;
  testo: string;
  azione?: { etichetta: string; href: string };
};

export type IngressoAvvisi = {
  prospetto: Prospetto;
  impostazioni: Impostazioni;
  fatture: FatturaCalcolata[];
  costi: CostoCalcolato[];
  scadenze: Adempimento[];
  oggi: string;
};

const GIORNI_IMMINENTE = 15;

export function generaAvvisi(ing: IngressoAvvisi): Avviso[] {
  const { prospetto: p, fatture, costi, scadenze, oggi } = ing;
  const avvisi: Avviso[] = [];

  // — Soglie del regime ————————————————————————————————
  if (p.soglia.stato === "uscitaImmediata" || p.soglia.stato === "limiteSuperato") {
    avvisi.push({ id: "soglia", tono: "negativo", testo: p.soglia.messaggio });
  } else if (p.soglia.stato === "avviso") {
    avvisi.push({ id: "soglia", tono: "attenzione", testo: p.soglia.messaggio });
  } else if (p.soglia.stato === "neiLimiti" && p.soglia.inSospeso > 0) {
    const proiezione = p.soglia.baseCassa + p.soglia.inSospeso;
    if (proiezione > ing.impostazioni.limiteForfettario) {
      avvisi.push({
        id: "soglia-proiezione",
        tono: "attenzione",
        testo: `Sei nei limiti sugli incassi, ma hai ${euroTondo(p.soglia.inSospeso)} emessi e non ancora incassati: se rientrano entro dicembre superi il limite di ${euroTondo(ing.impostazioni.limiteForfettario)}.`,
      });
    }
  }

  // — Credito commerciale ————————————————————————————
  const scadute = fatture.filter((f) => f.stato === "scaduto");
  if (scadute.length > 0) {
    const totale = scadute.reduce((a, f) => a + f.nettoIncasso, 0);
    const piuVecchia = scadute.reduce((a, f) => (f.giorniRitardo > a.giorniRitardo ? f : a));
    avvisi.push({
      id: "scadute",
      tono: piuVecchia.giorniRitardo > 90 ? "negativo" : "attenzione",
      testo:
        scadute.length === 1
          ? `${euro(totale)} scaduti da ${piuVecchia.giorniRitardo} giorni: una fattura da sollecitare.`
          : `${euro(totale)} scaduti su ${scadute.length} fatture, la più vecchia da ${piuVecchia.giorniRitardo} giorni.`,
      azione: { etichetta: "Vedi le fatture scadute", href: "/fatture?stato=scadute" },
    });
  }

  // — Fornitori da pagare ————————————————————————————
  const daPagare = costi.filter((c) => c.stato === "daPagare");
  if (daPagare.length > 0) {
    const totale = daPagare.reduce((a, c) => a + c.totale, 0);
    avvisi.push({
      id: "costi-da-pagare",
      tono: "attenzione",
      testo: `${euro(totale)} di costi registrati e non ancora pagati.`,
      azione: { etichetta: "Vedi i costi da pagare", href: "/costi?stato=daPagare" },
    });
  }

  // — Accantonamento ————————————————————————————————
  // Sotto la tolleranza non si avvisa: un avviso che chiede di alzare la
  // percentuale per coprire trenta euro costa più del buco che segnala.
  if (p.ricaviRilevanti > 0 && p.scostamentoAccantonamento < 0 && !p.accantonamentoSufficiente) {
    const minima = Math.ceil(p.percentualeTeoricaAccantonamento * 100);
    avvisi.push({
      id: "accantonamento",
      tono: "attenzione",
      // Sul fabbisogno di cassa, non sul carico: con le ritenute in mezzo i due
      // numeri divergono, e consigliare la percentuale sbagliata qui vorrebbe
      // dire far accantonare due volte la stessa imposta.
      testo: `Stai accantonando il ${percentuale(p.percentualeImpostata, 0)} ma da mettere da parte ce n'è il ${percentuale(p.percentualeTeoricaAccantonamento, 0)}: mancano ${euro(-p.scostamentoAccantonamento)}. Porta la percentuale almeno al ${minima}%.`,
    });
  }

  /*
    Non sparisce finché non lo si assegna, ed è voluto: la ricaduta sull'anno
    della data tiene i numeri come erano prima, ma resta una supposizione, e
    una supposizione silenziosa qui varrebbe quanto un errore.
  */
  if (p.versamentiSenzaAnno > 0) {
    avvisi.push({
      id: "versamenti-senza-anno",
      tono: "attenzione",
      testo: `${euro(p.versamentiSenzaAnno)} di versamenti F24 non hanno un anno d'imposta: sono contati sul ${p.anno} per la data di pagamento. Se erano il saldo del ${p.anno - 1} stanno abbassando il dovuto dell'anno sbagliato.`,
      azione: { etichetta: "Assegna l'anno ai versamenti", href: "/cashflow" },
    });
  }

  // — Accredito contributivo ————————————————————————
  if (p.accreditoIntero === false && p.redditoLordo > 0) {
    avvisi.push({
      id: "accredito",
      tono: "accento",
      testo: `Con ${euro(p.redditoLordo)} di reddito resti sotto il minimale della Gestione Separata: l'anno non ti viene accreditato per intero ai fini pensionistici.`,
    });
  }

  // — Credito d'imposta ————————————————————————————
  if (p.creditoImposta > 0) {
    avvisi.push({
      id: "credito-imposta",
      tono: "positivo",
      testo: `Le ritenute subite superano le imposte dovute: hai ${euro(p.creditoImposta)} di credito d'imposta da recuperare.`,
    });
  }

  // — Scadenze imminenti ————————————————————————————
  const imminenti = scadenze.filter((s) => {
    const giorni = giorniAllaData(s.data, oggi);
    return giorni >= 0 && giorni <= GIORNI_IMMINENTE;
  });
  if (imminenti.length > 0) {
    const prima = imminenti[0];
    const giorni = giorniAllaData(prima.data, oggi);
    const quando = giorni === 0 ? "oggi" : giorni === 1 ? "domani" : `fra ${giorni} giorni`;
    avvisi.push({
      id: "scadenza-imminente",
      tono: "attenzione",
      testo:
        imminenti.length === 1
          ? `${prima.titolo}: si versa ${quando}${prima.importo ? ` — ${euro(prima.importo)}` : ""}.`
          : `${imminenti.length} scadenze nei prossimi ${GIORNI_IMMINENTE} giorni, la prima ${quando}: ${prima.titolo.toLowerCase()}.`,
    });
  }

  if (avvisi.length === 0) {
    avvisi.push({
      id: "tutto-in-ordine",
      tono: "positivo",
      testo:
        p.ricaviRilevanti > 0
          ? "Niente da segnalare: incassi in ordine, accantonamento adeguato, nessuna scadenza imminente."
          : "Registra la prima fattura incassata: da lì in poi il cruscotto ti dice quanto di quei soldi è davvero tuo.",
      ...(p.ricaviRilevanti > 0 ? {} : { azione: { etichetta: "Vai alle fatture", href: "/fatture" } }),
    });
  }

  return avvisi;
}
