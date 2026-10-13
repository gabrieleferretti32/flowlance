/**
 * Gli archivi del servizio promemoria: tre, separati, e con nomi che non si
 * scambiano.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché tre e non uno
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Quello che succede attorno ai promemoria ha **due basi giuridiche diverse**,
 * e l'informativa le tiene separate:
 *
 * - il **marketing** (punto e) sta sul consenso, art. 6.1.a: si dà, si revoca,
 *   e di quel consenso bisogna poter dimostrare l'esistenza (art. 7.1);
 * - i **promemoria** (punto d) sono un servizio chiesto, art. 6.1.b: si
 *   richiedono, si attivano, si disattivano. Non c'è nessun consenso da
 *   dimostrare, perché non è su un consenso che si fondano.
 *
 * Tenerli in un archivio solo sarebbe comodo e falso in tutti e due i versi:
 * il marketing finirebbe conservato come un dato di servizio, e il servizio
 * verrebbe raccontato come un consenso — cioè come una cosa che si poteva non
 * dare e che si può revocare, quando invece è l'esecuzione di quello che la
 * persona ha chiesto. Un'informativa che dice «base giuridica: contratto» e un
 * registro che scrive «revoca del consenso» si contraddicono, e quello che
 * resta agli atti è il registro.
 *
 * Il terzo archivio è la **lista di esclusione**: solo gli indirizzi di chi si
 * è disiscritto, senza altro. Serve a non riscrivere a chi ha chiesto di non
 * essere scritto, ed è l'unico senza un termine — vedi sotto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Le parole, e la tagliola che le tiene
 * ─────────────────────────────────────────────────────────────────────────
 *
 * I tipi di evento del servizio **non** si chiamano «consenso» e «revoca», e
 * non è una preferenza di stile: è la differenza fra due basi giuridiche,
 * scritta nel posto in cui finisce in un documento. `verifica-registro.mjs`
 * fallisce se un tipo del servizio contiene una di quelle due parole.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché gli archivi stanno fuori da Brevo
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Finché il contatto vive in Brevo la prova è là dentro — ma il primo termine
 * di conservazione **cancella il contatto**, e con lui la prova che quella
 * persona aveva chiesto qualcosa. Si resterebbe senza il dato e senza la prova
 * di averlo trattato legittimamente: il verso peggiore dei due. Quindi la
 * pulizia scrive l'evento **prima** di cancellare, mai dopo; se la scrittura
 * non riesce, la cancellazione non parte.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Che cosa non c'è dentro
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Indirizzo, tipo di evento, data e ora, e il testo dei consensi a cui
 * l'evento si riferisce (versione e impronta). **Nessun dato del calcolo**:
 * non il regime, non l'accantonamento, non le scadenze. Un registro che
 * portasse dentro anche i numeri di una persona sarebbe un secondo archivio
 * degli stessi dati, con una finalità diversa e una durata più lunga — cioè il
 * modo di tenere per cinque anni quello che si era promesso di cancellare in
 * trenta giorni.
 */
import { piuMesi } from "./calendario";
import { VERSIONE_CORRENTE } from "./testi-consensi";

/** Gli archivi. Un altro si aggiunge qui, con la sua finalità scritta. */
export type Archivio =
  | "consensi-marketing"
  | "servizio-promemoria"
  | "esclusione"
  | "accettazioni-termini";

/**
 * Gli eventi dell'archivio probatorio dei consensi marketing (punto e).
 *
 * Questi sì che si chiamano consenso e revoca: è esattamente quello che sono.
 */
export type TipoConsenso = "consenso" | "revoca";

/**
 * Gli eventi del servizio promemoria (punto d, art. 6.1.b).
 *
 * Nessuno dei tre nomi contiene «consenso» o «revoca»: il servizio si chiede,
 * si attiva e si disattiva. Vedi la testa del file, e la tagliola.
 */
export type TipoServizio = "richiesta" | "attivazione" | "disattivazione";

type Comune = {
  /** L'indirizzo a cui l'evento si riferisce. È l'unico dato personale che c'è. */
  email: string;
  /** Data e ora, ISO con il fuso: una prova senza orario vale poco. */
  quando: string;
  /** La versione del testo mostrato, e la sua impronta: vedi `testi-consensi.ts`. */
  versioneTesto: string;
  improntaTesto: string;
  /** Una riga sul contesto, quando serve. Mai numeri del calcolo. */
  nota?: string;
};

export type EventoConsenso = Comune & {
  archivio: "consensi-marketing";
  tipo: TipoConsenso;
};

export type EventoServizio = Comune & {
  archivio: "servizio-promemoria";
  tipo: TipoServizio;
};

export type EventoProva = EventoConsenso | EventoServizio;

/** Chi si è disiscritto: l'indirizzo, e nient'altro. */
export type Esclusione = {
  archivio: "esclusione";
  email: string;
  quando: string;
};

/**
 * L'accettazione dei Termini, registrata prima del pagamento.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché è un archivio a sé, e perché non ha dentro nessuno
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Gli altri archivi riguardano il **servizio promemoria** e hanno dentro un
 * indirizzo email, perché è l'indirizzo il soggetto di quello che registrano.
 * Questo riguarda un'altra cosa — che cosa aveva davanti chi stava per pagare
 * — e di persone non ne contiene nessuna: **niente email, niente IP**.
 *
 * Al loro posto c'è un identificativo casuale, che viaggia fino a Stripe come
 * `client_reference_id`. Il collegamento fra la persona e questo evento
 * esiste quindi in un posto solo: il cruscotto di Stripe, dove il pagamento
 * c'è già con i suoi dati. Se un giorno questo archivio finisse in mano a
 * qualcuno, non direbbe chi ha comprato.
 *
 * Le due dichiarazioni si registrano **per impronta**: il testo integrale sta
 * in `dichiarazioni.ts`, archiviato una volta per versione come i consensi, e
 * l'impronta lega l'evento a quel testo. Copiarlo dentro ogni evento sarebbe
 * lo stesso documento riscritto a ogni acquisto.
 */
export type EventoAccettazione = {
  archivio: "accettazioni-termini";
  /** Casuale, e l'unica cosa che esce di qui: va a Stripe come client_reference_id. */
  id: string;
  /** Data e ora **del server**: l'orologio di chi compra non è una prova. */
  quando: string;
  /** La versione dei Termini mostrata, e l'impronta del PDF che la pagina offriva. */
  versioneTermini: number;
  improntaTermini: string;
  /** La versione del testo delle due dichiarazioni, e la sua impronta. */
  versioneDichiarazioni: string;
  improntaDichiarazioni: string;
};

export interface RegistroProve {
  /** Aggiunge un evento. Lancia se non ci riesce: chi chiama deve saperlo. */
  scrivi(evento: EventoProva): Promise<void>;
  /** Aggiunge un indirizzo alla lista di esclusione. */
  escludi(esclusione: Esclusione): Promise<void>;
  /** Aggiunge un'accettazione dei Termini. Lancia se non ci riesce: il pagamento non parte. */
  accetta(evento: EventoAccettazione): Promise<void>;
}

/**
 * La versione del testo dei consensi oggi a schermo, e la sua impronta.
 *
 * Arriva da `testi-consensi.ts`, dove c'è il testo per intero. Qui non si
 * scrive nessun numero: una versione scritta due volte è una versione che al
 * giro dopo dice due cose diverse.
 */
export function testoCorrente(): { versioneTesto: string; improntaTesto: string } {
  return { versioneTesto: VERSIONE_CORRENTE.versione, improntaTesto: VERSIONE_CORRENTE.impronta };
}

/**
 * Per quanto si conservano le prove del servizio promemoria.
 *
 * Le accettazioni dei Termini hanno un termine loro — dieci anni dalla
 * cessazione della licenza — perché provano un contratto e non un consenso:
 * vedi `CONSERVAZIONE_ACCETTAZIONI_ANNI` più sotto.
 *
 * **Per tutta la durata del trattamento, e poi cinque anni dalla sua
 * cessazione.** Non è un obbligo del GDPR — il GDPR dice «non più del
 * necessario» e lascia a chi tratta il compito di motivare il termine: il
 * perché di questi cinque anni sta in `docs/legale/per-il-legale/proporzionalita-prove.md`.
 *
 * Il termine **non** si conta dall'evento. Una prova di consenso raccolta nel
 * 2026, per un contatto ancora iscritto nel 2033, serve ancora: è la prova di
 * quello che sta accadendo adesso. Contarla dalla raccolta vorrebbe dire
 * cancellare la prova di un trattamento in corso — e ritrovarsi col dato e
 * senza la prova, che è il verso peggiore.
 */
export const CONSERVAZIONE_PROVE = {
  /** Anni dalla cessazione del trattamento. */
  anniDallaCessazione: 5,
} as const;

/**
 * Per quanto si conserva la prova dell'accettazione dei Termini.
 *
 * **Dieci anni dalla cessazione della licenza.** Non è il termine delle prove
 * di consenso, ed è giusto che non lo sia: lì si dimostra un consenso, qui si
 * dimostra la conclusione di un **contratto**, e il tempo in cui qualcuno può
 * contestarlo è un altro. Il numero sta qui, DEPLOY.md lo scrive accanto agli
 * altri, e nessuna pulizia automatica lo esegue: questo archivio non ha una
 * data di cessazione dentro di sé — non ha dentro nessuno — e il conto parte
 * da una licenza che vive da un'altra parte.
 */
export const CONSERVAZIONE_ACCETTAZIONI_ANNI = 10;

/** Il termine è un numero utilizzabile? Se no, la pulizia non deve girare. */
export function conservazioneConfermata(): boolean {
  const a = CONSERVAZIONE_PROVE.anniDallaCessazione;
  return typeof a === "number" && Number.isFinite(a) && a > 0;
}

/**
 * Il blocco: una contestazione sospende ogni cancellazione per quel contatto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Che cos'è, e perché è una riga di codice e non una procedura
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Se su un indirizzo nasce una contestazione — un reclamo al Garante, una
 * diffida, una richiesta di accesso contestata — le prove che la riguardano si
 * conservano **fino alla definizione**, anche oltre i cinque anni. Il contrario
 * sarebbe distruggere documenti rilevanti per un procedimento in corso, nel
 * modo peggiore: non per decisione di qualcuno, ma perché una funzione
 * notturna ha fatto il suo mestiere.
 *
 * Il blocco è quindi un elenco scritto a mano, e ogni voce porta **perché**
 * esiste e **da quando**: un blocco senza motivo diventa, in due anni, un
 * indirizzo che nessuno sa più perché non si cancella — e resta lì per sempre,
 * che è il modo di tenere dei dati senza una ragione.
 *
 * Finché un indirizzo è bloccato, la pulizia non lo tocca: né il contatto in
 * Brevo, né le sue prove. Si toglie dall'elenco quando la contestazione è
 * definita, e da quel momento i termini riprendono a correre.
 */
export type Blocco = {
  email: string;
  /** Da quando. Una data ISO. */
  dal: string;
  /** Perché: il procedimento, la richiesta, la diffida. In una riga. */
  motivo: string;
};

/**
 * Gli indirizzi bloccati, oggi nessuno.
 *
 * Si aggiunge una riga a mano, si spinge, e dal giorno dopo quel contatto non
 * si tocca. Non c'è un pannello: un pannello per una cosa che capita una volta
 * ogni due anni è codice che invecchia senza essere usato, e la riga qui si
 * legge in una revisione del codice — che è esattamente dove deve essere vista.
 */
export const BLOCCHI: readonly Blocco[] = [];

const normalizza = (email: string) => email.trim().toLowerCase();

export function bloccato(email: string, blocchi: readonly Blocco[] = BLOCCHI): boolean {
  const cercata = normalizza(email);
  return blocchi.some((b) => normalizza(b.email) === cercata);
}

/**
 * Gli eventi che chiudono il trattamento di un indirizzo.
 *
 * Non c'è bisogno di un elenco anche per quelli che lo **riaprono**: il
 * termine si conta solo se l'ultimo evento in ordine di tempo è una
 * cessazione, e una richiesta arrivata dopo una disattivazione è, per
 * costruzione, l'ultimo evento.
 */
const CESSAZIONI = new Set<string>(["disattivazione", "revoca"]);

/**
 * Quando scadono le prove di un indirizzo, dati tutti i suoi eventi.
 *
 * `null` quando il trattamento è ancora in corso — mai iniziato, o ripreso
 * dopo l'ultima cessazione: in quel caso non c'è nessun termine che corre, e
 * le prove restano.
 */
export function scadenzaProve(eventi: readonly EventoProva[]): string | null {
  if (eventi.length === 0) return null;
  const ordinati = [...eventi].sort((a, b) => a.quando.localeCompare(b.quando));
  const ultimo = ordinati[ordinati.length - 1];
  if (!CESSAZIONI.has(ultimo.tipo)) return null;
  // Una cessazione seguita da niente: il trattamento è finito quel giorno.
  return piuMesi(ultimo.quando.slice(0, 10), CONSERVAZIONE_PROVE.anniDallaCessazione * 12);
}

/**
 * Le prove di un indirizzo si possono cancellare oggi?
 *
 * Tutte insieme o nessuna: gli eventi di un contatto raccontano una storia, e
 * cancellarne metà lascerebbe una prova di consenso senza la revoca che la
 * chiude — cioè un documento che dice il falso per omissione.
 */
export function proveDaCancellare(
  eventi: readonly EventoProva[],
  oggi: string,
  blocchi: readonly Blocco[] = BLOCCHI,
): boolean {
  if (eventi.length === 0) return false;
  if (bloccato(eventi[0].email, blocchi)) return false;
  const scadenza = scadenzaProve(eventi);
  if (scadenza === null) return false;
  return oggi >= scadenza;
}

/**
 * Il nome del file dell'evento dentro il magazzino.
 *
 * L'archivio è la **prima cartella**: i tre archivi sono tre prefissi diversi,
 * e restano separati anche a guardarli da fuori. Poi il giorno, così il
 * registro si sfoglia in ordine cronologico senza aprire niente.
 *
 * L'indirizzo **non** entra nel nome del file: i nomi si leggono da un elenco,
 * e un elenco di nomi file sarebbe una rubrica di indirizzi leggibile senza
 * aprire un solo evento. Dentro il file sì, perché lì serve.
 */
export function nomeEvento(evento: EventoProva | Esclusione | EventoAccettazione): string {
  const giorno = evento.quando.slice(0, 10);
  const coda = "tipo" in evento ? evento.tipo : "id" in evento ? evento.id : "esclusione";
  return `${evento.archivio}/${giorno}/${coda}.json`;
}
