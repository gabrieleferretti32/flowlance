/**
 * Cosa cambia, concretamente, quando cambia il regime.
 *
 * L'elenco esisteva in due copie: una corta dentro la proposta di chiusura,
 * una lunga dentro la schermata di configurazione, entrambe con le aliquote
 * scritte a mano. Due copie di una spiegazione fiscale sono due copie che
 * divergono all'aliquota successiva, e i numeri scritti a mano diventano falsi
 * senza che nessun test se ne accorga.
 *
 * Qui l'elenco è uno, parametrizzato sulle aliquote dell'anno, e dice le cose
 * nell'ordine in cui pesano su chi le subisce: prima la fattura che si emette
 * domani, poi l'imposta, poi gli obblighi.
 */
import { aliquota, euro } from "@/lib/format";
import { derivato } from "./derivati/registro";
import type { Impostazioni, ParametriAnno, Regime } from "./tipi";

export type Cambiamento = {
  id: string;
  /** La frase corta: sta in un elenco puntato dentro la chiusura. */
  titolo: string;
  /** Il perché, per chi non l'ha mai fatto. Solo dove aggiunge qualcosa. */
  dettaglio?: string;
};

/**
 * Il passaggio da un regime all'altro, nella direzione richiesta.
 *
 * `da` e `a` uguali danno un elenco vuoto: chi non cambia regime non ha niente
 * da leggere, e mostrargli l'elenco dell'ordinario mentre resta forfettario
 * sarebbe informazione falsa.
 */
export function cambiamentiDiRegime(
  da: Regime,
  a: Regime,
  imp: Impostazioni,
  par: ParametriAnno,
): Cambiamento[] {
  if (da === a) return [];
  return da === "forfettario" ? versoOrdinario(imp, par) : versoForfettario(imp, par);
}

function versoOrdinario(imp: Impostazioni, par: ParametriAnno): Cambiamento[] {
  return [
    {
      id: "iva-in-fattura",
      titolo: `Ogni fattura riporta l'IVA al ${aliquota(par.aliquotaIvaOrdinaria)} e va versata alle scadenze della liquidazione.`,
      dettaglio:
        "Il cliente paga di più, ma quella parte non è tua: transita dal tuo conto e va allo Stato. È il motivo per cui il saldo di cassa non è il tuo guadagno.",
    },
    {
      id: "bollo",
      titolo: `Sparisce il bollo da ${euro(par.importoBollo)}.`,
      dettaglio: `Si applica solo alle fatture senza IVA sopra ${euro(par.sogliaBollo)}: con l'IVA in fattura non serve più.`,
    },
    {
      id: "ritenuta",
      titolo: `Le fatture verso imprese e professionisti subiscono la ritenuta d'acconto del ${aliquota(par.aliquotaRitenuta)}.`,
      dettaglio:
        "Incassi meno subito, ma non è un costo: è un anticipo delle tue imposte e a fine anno si scomputa da quello che devi.",
    },
    {
      id: "costi",
      titolo: "I costi tornano deducibili e l'IVA sugli acquisti torna detraibile.",
      dettaglio:
        "Conservare le fatture passive smette di essere facoltativo: ogni documento che manca è imposta pagata in più.",
    },
    {
      id: "imposta",
      titolo: `Al posto della sostitutiva al ${aliquota(derivato("aliquotaSostitutiva", imp, par).valore)} si applicano IRPEF a scaglioni e addizionali.`,
      dettaglio:
        "Tornano utilizzabili detrazioni, deduzioni e fondo pensione, che nel forfettario non abbattevano niente.",
    },
    {
      id: "obblighi",
      titolo: "Servono i registri IVA e la dichiarazione ordinaria.",
      dettaglio:
        "È il punto in cui il commercialista smette di essere facoltativo, e il suo costo entra fra i costi deducibili.",
    },
  ];
}

function versoForfettario(imp: Impostazioni, par: ParametriAnno): Cambiamento[] {
  return [
    {
      id: "iva-in-fattura",
      titolo: "Le fatture escono senza IVA, con la dicitura del regime forfettario.",
      dettaglio:
        "Il cliente paga meno a parità di compenso, e non c'è più nessuna liquidazione da versare.",
    },
    {
      id: "bollo",
      titolo: `Torna il bollo da ${euro(par.importoBollo)} sulle fatture sopra ${euro(par.sogliaBollo)}.`,
      dettaglio: imp.bolloAddebitato
        ? "Lo addebiti al cliente, come sei impostato adesso."
        : "Se non lo addebiti resta un tuo costo, una fattura alla volta.",
    },
    {
      id: "costi",
      titolo: `I costi smettono di dedursi: conta solo il coefficiente del ${aliquota(imp.coefficienteRedditivita)}.`,
      dettaglio:
        "Lo Stato presume quanto costa la tua attività. Se spendi più di così ci perdi, se spendi meno ci guadagni: è la scommessa del regime.",
    },
    {
      id: "ritenuta",
      titolo: "Sparisce la ritenuta d'acconto: incassi l'intero importo.",
      dettaglio:
        "Nessun anticipo trattenuto dai clienti significa anche nessuno scomputo a giugno: le imposte si pagano tutte da sé.",
    },
    {
      id: "imposta",
      titolo: `Al posto dell'IRPEF a scaglioni si paga un'imposta unica al ${aliquota(par.aliquotaSostitutiva)}.`,
      dettaglio: `Sotto il limite di ${euro(par.limiteForfettario)} di ricavi. Detrazioni e fondo pensione non abbattono più niente.`,
    },
    {
      id: "requisiti",
      titolo: "L'accesso dipende da requisiti che l'app non conosce.",
      dettaglio:
        "Partecipazioni societarie, spese per dipendenti, redditi da lavoro dipendente: vanno verificati con il commercialista prima di cambiare.",
    },
  ];
}
