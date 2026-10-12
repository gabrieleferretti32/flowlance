/**
 * I termini di conservazione, tradotti in decisioni.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Che cosa decide questo file, e che cosa non tocca
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Prende un contatto e la data di oggi, e dice che cosa va fatto. Non fa
 * niente: non conosce la rete, non chiama Brevo, non ha un orologio. Tutto
 * quello che potrebbe cancellare i dati di una persona passa di qui come
 * **dato restituito**, e si può quindi guardare in un test prima che succeda.
 *
 * I termini li ha decisi il legale il 12 ottobre 2026, e sono questi:
 *
 * | | Che cosa | Termine | Da quando |
 * | --- | --- | --- | --- |
 * | 1 | Iscrizioni mai confermate | 30 giorni | dalla richiesta |
 * | 2 | Dati del calcolo | 30 giorni | dall'ultima scadenza del calcolo |
 * | 3 | Lista promemoria | 30 giorni dalla fine del servizio, **e comunque** 12 mesi senza attività se non restano scadenze future |
 * | 4 | Lista marketing | 24 mesi | dal consenso o dall'ultima interazione attiva |
 *
 * ─────────────────────────────────────────────────────────────────────────
 * «I nostri invii non rinnovano», e la trappola che ci stava sotto
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il termine del marketing riparte da un'**interazione attiva**: un clic, un
 * nuovo calcolo. Non da un invio nostro, e nemmeno da una nostra scrittura.
 *
 * Sembra ovvio e non lo è: il campo che Brevo aggiorna da solo a ogni
 * modifica è `modifiedAt`, e la pulizia **scrive** — svuota le date del
 * calcolo. Appoggiare il termine a `modifiedAt` vorrebbe dire che la pulizia
 * del caso 2 rimette a zero l'orologio del caso 4: il contatto resterebbe in
 * lista marketing per sempre, rinnovato ogni volta da chi aveva il compito di
 * toglierlo. Un difetto che non produce nessun errore e nessuna riga storta —
 * produce solo contatti che non se ne vanno mai.
 *
 * Perciò l'attività sta in un attributo suo, `ULTIMA_ATTIVITA`, che scrive
 * **solo** chi fa qualcosa che conta: l'iscrizione, un nuovo calcolo, e (se si
 * configura sul pannello) un clic. La pulizia non lo tocca mai. Un test lo
 * verifica, perché è la cosa che si romperebbe per prima.
 */
import { formaIso, piuGiorni, piuMesi, scaduto, scadutoAMesi } from "./calendario";
import type { ContattoBrevo } from "./brevo";

/** Gli attributi che la pulizia guarda e, quando serve, svuota. */
export const ATTRIBUTI_CALCOLO = [
  "SCAD_1_DATA",
  "SCAD_1_IMPORTO",
  "SCAD_2_DATA",
  "SCAD_2_IMPORTO",
] as const;

/**
 * Quando il contatto ha fatto l'ultima cosa che conta.
 *
 * Non è `modifiedAt` — vedi la testa del file. Lo scrive chi si iscrive e chi
 * rifà il calcolo; lo scriverebbe un'automazione sul clic.
 */
export const ATTRIBUTO_ATTIVITA = "ULTIMA_ATTIVITA";

export const TERMINI = {
  /** Giorni dalla richiesta, per chi non ha mai confermato. */
  nonConfermate: 30,
  /** Giorni dall'ultima scadenza del calcolo. */
  datiDelCalcolo: 30,
  /** Mesi senza attività, per restare in lista promemoria senza scadenze future. */
  promemoriaInattivo: 12,
  /** Mesi dal consenso o dall'ultima interazione attiva. */
  marketing: 24,
} as const;

export type Configurazione = {
  listaPromemoria: number;
  listaMarketing: number;
};

export type Azione =
  | { tipo: "cancella"; email: string; perche: string }
  | { tipo: "svuotaCalcolo"; email: string; perche: string }
  | { tipo: "esciDaLista"; email: string; lista: number; perche: string };

const soloData = (valore: unknown): string | null => {
  if (typeof valore !== "string" || valore.trim() === "") return null;
  // Brevo restituisce le date con l'ora: qui conta il giorno.
  const giorno = valore.slice(0, 10);
  return formaIso(giorno) ? giorno : null;
};

/**
 * L'ultima scadenza del calcolo: `SCAD_2_DATA`, oppure `SCAD_1_DATA`.
 *
 * Non è sempre la seconda, ed è la trappola che il legale ha nominato per
 * prima. Quando di appuntamenti ce n'è uno solo — primo anno di attività, o
 * sotto la soglia degli acconti — `SCAD_2_*` è vuoto fin dall'inizio, e
 * l'ultima scadenza è la prima. Una pulizia ancorata soltanto a `SCAD_2_DATA`
 * non scatterebbe **mai** per quei contatti: sarebbero proprio loro, quelli
 * con una data sola, a restare scritti per sempre.
 */
export function ultimaScadenza(c: ContattoBrevo): string | null {
  return soloData(c.attributes.SCAD_2_DATA) ?? soloData(c.attributes.SCAD_1_DATA);
}

/** La data da cui contare l'inattività. Mai `modifiedAt`: vedi la testa del file. */
export function ultimaAttivita(c: ContattoBrevo): string | null {
  return soloData(c.attributes[ATTRIBUTO_ATTIVITA]) ?? soloData(c.createdAt);
}

/**
 * Che cosa va fatto a questo contatto, oggi.
 *
 * Un elenco, eventualmente vuoto. Le regole non si escludono a vicenda: un
 * contatto può uscire dai promemoria **e** restare nel marketing, o viceversa,
 * e i due casi non si parlano — è il presidio su cui il legale ha insistito, e
 * un test lo verifica nei due versi.
 */
export function decidi(c: ContattoBrevo, conf: Configurazione, oggi: string): Azione[] {
  const azioni: Azione[] = [];
  const nelleNostreListe = c.listIds.includes(conf.listaPromemoria)
    || c.listIds.includes(conf.listaMarketing);

  /*
    1 · Mai confermata.

    Il segnale non è un campo di Brevo — che il doppio opt-in via API lasci o
    no un contatto «in attesa» visibile non è verificato, vedi
    `docs/invio-promemoria.md`. Il segnale è **nostro**: le liste si popolano
    solo dopo la conferma, quindi un contatto che non è in nessuna delle due
    non ha mai confermato. Vale in tutti e due i mondi, e non dipende da come
    Brevo chiama le cose.
  */
  if (!nelleNostreListe) {
    const richiesta = ultimaAttivita(c);
    if (richiesta && scaduto(richiesta, TERMINI.nonConfermate, oggi)) {
      azioni.push({
        tipo: "cancella",
        email: c.email,
        perche: `mai confermata: richiesta il ${richiesta}, oltre i ${TERMINI.nonConfermate} giorni`,
      });
      // Cancellato il contatto, non c'è altro da fargli.
      return azioni;
    }
    return azioni;
  }

  const scadenza = ultimaScadenza(c);
  const servizioFinito = scadenza !== null
    && scaduto(scadenza, TERMINI.datiDelCalcolo, oggi);

  /*
    2 e 3 insieme, e devono esserlo.

    I due termini cadono lo stesso giorno, e il secondo ha bisogno del dato
    che il primo cancella: svuotate le date, «trenta giorni dopo l'ultima
    scadenza» non si può più calcolare. Separarli in due passaggi vorrebbe
    dire che il primo giro svuota e il secondo non sa più perché avrebbe
    dovuto togliere dalla lista.
  */
  if (servizioFinito) {
    azioni.push({
      tipo: "svuotaCalcolo",
      email: c.email,
      perche: `ultima scadenza il ${scadenza}, oltre i ${TERMINI.datiDelCalcolo} giorni`,
    });
    if (c.listIds.includes(conf.listaPromemoria)) {
      azioni.push({
        tipo: "esciDaLista",
        email: c.email,
        lista: conf.listaPromemoria,
        perche: `servizio finito: ultima scadenza il ${scadenza}`,
      });
    }
  } else if (c.listIds.includes(conf.listaPromemoria) && scadenza === null) {
    /*
      3 · La rete di sicurezza.

      «E comunque dopo 12 mesi senza attività se non restano scadenze
      future.» Prende i contatti che il caso 2 non ha preso: quelli senza
      date — già ripuliti in un giro precedente, o arrivati senza. Senza
      questa regola resterebbero in lista per sempre, perché la regola
      principale ha bisogno di una data che loro non hanno.
    */
    const attivita = ultimaAttivita(c);
    if (attivita && scadutoAMesi(attivita, TERMINI.promemoriaInattivo, oggi)) {
      azioni.push({
        tipo: "esciDaLista",
        email: c.email,
        lista: conf.listaPromemoria,
        perche: `nessuna scadenza futura e nessuna attività dal ${attivita}`,
      });
    }
  }

  /*
    4 · Il marketing, che ha un orologio suo.

    Ventiquattro mesi dal consenso o dall'ultima interazione attiva. Non
    guarda le scadenze, non guarda l'altra lista, e non viene toccato da
    nessuna delle regole di sopra: chi esce dai promemoria resta nel
    marketing finché il suo termine non scade, e viceversa.
  */
  if (c.listIds.includes(conf.listaMarketing)) {
    const attivita = ultimaAttivita(c);
    if (attivita && scadutoAMesi(attivita, TERMINI.marketing, oggi)) {
      azioni.push({
        tipo: "esciDaLista",
        email: c.email,
        lista: conf.listaMarketing,
        perche: `${TERMINI.marketing} mesi senza interazioni attive dal ${attivita}`,
      });
    }
  }

  return azioni;
}

/** Quando scadrebbe ciascun termine, per poterlo raccontare senza rifare il conto. */
export function scadenzeDi(c: ContattoBrevo): Record<string, string | null> {
  const scadenza = ultimaScadenza(c);
  const attivita = ultimaAttivita(c);
  return {
    datiDelCalcolo: scadenza ? piuGiorni(scadenza, TERMINI.datiDelCalcolo) : null,
    promemoriaInattivo: attivita ? piuMesi(attivita, TERMINI.promemoriaInattivo) : null,
    marketing: attivita ? piuMesi(attivita, TERMINI.marketing) : null,
  };
}
