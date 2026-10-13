/**
 * La prova che qualcuno ha accettato i Termini, registrata prima del pagamento.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Che cosa dimostra, e perché il pagamento la aspetta
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Fino a oggi la prova di cosa era stato accettato era la **consegna**: il PDF
 * della versione, con la sua impronta, mandato per email dopo il pagamento. È
 * una prova di quello che il Fornitore ha trasmesso, non di quello che
 * l'acquirente ha visto e spuntato prima di pagare.
 *
 * Questa funzione registra l'altra metà, e la registra **prima**: se la
 * scrittura non riesce, il collegamento al pagamento non si apre. Un acquisto
 * senza la sua prova è esattamente la cosa che questo giro serve a evitare, e
 * l'unico modo di evitarla davvero è che non possa avvenire.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Dentro non c'è nessuno
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Niente email, niente indirizzo IP, niente identificatori del browser. Solo
 * un numero casuale, l'ora del server, e che cosa era a schermo: versione e
 * impronta dei Termini, versione e impronta delle due dichiarazioni.
 *
 * Il numero casuale viaggia fino a Stripe come `client_reference_id`, e lì si
 * ricongiunge al pagamento — che i dati della persona ce li ha già, e per una
 * ragione sua. Il collegamento fra la persona e questo evento esiste quindi in
 * un posto solo, il cruscotto di Stripe, e non in un archivio nostro.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Che cosa **non** verifica, e va detto
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Versione e impronta dei Termini arrivano dalla pagina: è la pagina che
 * dichiara che cosa aveva mostrato. Il server non può confrontarle con il PDF,
 * che in una funzione serverless non ha sotto mano, e quindi **non lo finge**:
 * controlla che abbiano la forma giusta e le registra per quello che sono.
 *
 * Le due dichiarazioni, invece, le ricompone il server dalla versione ricevuta
 * (`dichiarazioni.ts`): quelle non le può dettare il browser.
 */
import { randomUUID } from "node:crypto";
import { dichiarazioniMostrate } from "./dichiarazioni";
import { origineAmmessa } from "./origini";
import type { EventoAccettazione, RegistroProve } from "./registro-prove";

/** Il corpo più grande che si accetta: due numeri e un'impronta stanno in molto meno. */
export const CORPO_MASSIMO_BYTE = 1_024;

export type Configurazione = {
  /** Le origini ammesse, come per l'iscrizione ai promemoria. */
  origini: string[];
  /** Il magazzino è configurato? Senza, la funzione dice di no invece di fingere. */
  magazzino: string | undefined;
};

export type Dipendenze = {
  registro: RegistroProve | null;
  /** L'ora del server, iniettata: una prova con l'orologio di chi compra non è una prova. */
  adesso: () => string;
  /** L'identificativo casuale, iniettato: in un test deve poter essere prevedibile. */
  identificativo?: () => string;
};

export type Risposta = {
  stato: number;
  corpo: { ok: true; id: string } | { ok: false; errore: string };
  /** Quello che va nel registro del server, e che a nessuno si mostra. */
  registro?: string;
};

/**
 * La forma dell'identificativo che Stripe accetta come `client_reference_id`.
 *
 * Alfanumerico, trattini e underscore: un UUID ci sta dentro. Il limite
 * dichiarato è 200 caratteri — vedi CHECKOUT.md, dove sta anche la nota che
 * quella documentazione da qui **non si è potuta leggere**.
 */
export const FORMA_IDENTIFICATIVO = /^[A-Za-z0-9_-]{8,200}$/;

type Corpo = { versioneTermini: number; improntaTermini: string };

/** Il corpo è quello che ci aspettiamo? Niente di più di due campi. */
export function convalidaAccettazione(corpo: unknown): { ok: true; dati: Corpo } | { ok: false; errore: string } {
  if (typeof corpo !== "object" || corpo === null) return { ok: false, errore: "corpo non valido" };
  const c = corpo as Record<string, unknown>;
  if (typeof c.versioneTermini !== "number" || !Number.isInteger(c.versioneTermini) || c.versioneTermini < 1) {
    return { ok: false, errore: "versione dei Termini non valida" };
  }
  if (typeof c.improntaTermini !== "string" || !/^[0-9a-f]{64}$/.test(c.improntaTermini)) {
    return { ok: false, errore: "impronta dei Termini non valida" };
  }
  return { ok: true, dati: { versioneTermini: c.versioneTermini, improntaTermini: c.improntaTermini } };
}

export async function gestisciAccettazione(
  richiesta: Request,
  conf: Configurazione,
  dip: Dipendenze,
): Promise<Risposta> {
  const no = (stato: number, errore: string, registro?: string): Risposta => ({
    stato,
    corpo: { ok: false, errore },
    registro,
  });

  if (richiesta.method !== "POST") {
    return no(405, "Metodo non ammesso.", `metodo ${richiesta.method}`);
  }
  if (!origineAmmessa(richiesta.headers.get("origin") ?? undefined, conf.origini)) {
    return no(403, "Richiesta non ammessa.", `origine «${richiesta.headers.get("origin")}»`);
  }
  if (!conf.magazzino || !dip.registro) {
    /*
      Senza magazzino non si finge di aver registrato. È il caso in cui il
      pagamento **non deve** partire: meglio un acquisto che non si fa che un
      acquisto senza la prova di cosa è stato accettato.
    */
    return no(
      503,
      "Non riesco a registrare l'accettazione dei Termini, e senza quella non apro il pagamento. "
        + "Riprova fra un minuto, o scrivi a info@flowlance.it.",
      "magazzino delle prove non configurato: accettazione non registrabile",
    );
  }

  const grezzo = await richiesta.text();
  if (grezzo.length > CORPO_MASSIMO_BYTE) return no(413, "Richiesta troppo grande.", `${grezzo.length} byte`);

  let corpo: unknown;
  try {
    corpo = JSON.parse(grezzo);
  } catch {
    return no(400, "Non ho capito la richiesta. Riprova.", "JSON non valido");
  }

  const convalida = convalidaAccettazione(corpo);
  if (!convalida.ok) return no(400, "Non ho capito la richiesta. Riprova.", convalida.errore);

  const dichiarazioni = dichiarazioniMostrate(convalida.dati.versioneTermini);
  const evento: EventoAccettazione = {
    archivio: "accettazioni-termini",
    id: (dip.identificativo ?? randomUUID)().replaceAll("-", ""),
    quando: dip.adesso(),
    versioneTermini: convalida.dati.versioneTermini,
    improntaTermini: convalida.dati.improntaTermini,
    versioneDichiarazioni: dichiarazioni.versione,
    improntaDichiarazioni: dichiarazioni.impronta,
  };
  if (!FORMA_IDENTIFICATIVO.test(evento.id)) {
    return no(500, "Non riesco a registrare l'accettazione. Scrivi a info@flowlance.it.", `identificativo fuori forma: ${evento.id}`);
  }

  try {
    await dip.registro.accetta(evento);
  } catch (e) {
    /*
      La scrittura non è riuscita: il pagamento non si apre. L'errore tecnico
      resta nei log, a chi guarda la pagina si dice cosa fare — e quello che si
      dice è vero: riprovare può bastare, perché il magazzino può essere stato
      irraggiungibile per un attimo.
    */
    return no(
      502,
      "Non riesco a registrare l'accettazione dei Termini, e senza quella non apro il pagamento. "
        + "Riprova, o scrivi a info@flowlance.it.",
      `registro non raggiungibile: ${String(e)}`,
    );
  }

  return { stato: 200, corpo: { ok: true, id: evento.id } };
}
