/**
 * L'iscrizione ai promemoria, lato server: l'unica cosa di Flowlance che gira
 * fuori da un browser.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché esiste, detto per intero
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il sito è un export statico e l'applicazione non ha un server: è la scelta
 * su cui il prodotto si vende. Questa funzione non la scalfisce — non legge
 * niente, non scrive niente, non ha un archivio — ma va detta per quello che
 * è: un relè con un compito solo, che prende un indirizzo email e sette
 * numeri e li passa a Brevo. `/app` non la conosce e non la chiama.
 *
 * Non è una route di Next. Con `output: "export"` Next non ha un runtime, e
 * l'esportatore gestisce solo i route handler statici in GET: un POST su
 * `app/api/.../route.ts` dopo il build non esisterebbe da nessuna parte. È
 * invece una funzione Vercel fuori da Next, in `api/promemoria.ts`, di cui
 * questo modulo è la logica — perché una funzione che si prova solo
 * distribuendola non si prova.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Spenta finché la Privacy non la descrive
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Senza le tre configurazioni — chiave, lista, modello di conferma — la
 * funzione risponde «non attiva» e non contatta nessuno. Non è un ripiego:
 * è l'interruttore. Questi sei attributi sono dati economici di una persona
 * identificata, e finché l'informativa non li descrive non si raccolgono. La
 * pagina ha il suo interruttore separato, che decide che cosa si vede; questo
 * decide che cosa può succedere, e nessuno dei due dipende dall'altro.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il doppio opt-in, e perché è un endpoint e non un'opzione
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `POST /v3/contacts` crea il contatto e **non manda niente**: chiamarlo e
 * dire «doppio opt-in attivo» sarebbe un single opt-in con un altro nome.
 * L'email di conferma la manda soltanto
 * `POST /v3/contacts/doubleOptinConfirmation`, che accetta anche gli
 * attributi: una chiamata sola, e l'iscrizione non vale finché la persona non
 * clicca nella propria posta.
 */
import { convalidaPromemoria, origineAmmessa } from "./promemoria";
import { ATTRIBUTO_ATTIVITA } from "./pulizia";
import { testoCorrente, type RegistroProve } from "./registro-prove";

/** L'indirizzo di Brevo. Costante: non è una configurazione da sbagliare. */
const BREVO_DOI = "https://api.brevo.com/v3/contacts/doubleOptinConfirmation";

/** Il corpo più grande che si accetta. Un'email e sette numeri stanno in molto meno. */
export const CORPO_MASSIMO_BYTE = 2_048;

/** Quante iscrizioni per indirizzo di rete, e in quanto tempo. */
export const FRENO = { tentativi: 5, finestraMs: 10 * 60 * 1_000 } as const;

export type Configurazione = {
  chiave: string | undefined;
  /** La lista dei promemoria: ci entra chiunque confermi. */
  lista: string | undefined;
  /**
   * La lista delle comunicazioni sul prodotto: ci entra solo chi ha spuntato
   * la seconda casella.
   *
   * Due liste e non un attributo «marketing: sì/no», perché la disiscrizione
   * deve poter essere separata: dal centro preferenze di Brevo si esce da una
   * e si resta nell'altra. Con un attributo solo, il collegamento di
   * disiscrizione in fondo a un'email commerciale avrebbe tolto anche i
   * promemoria — cioè avrebbe spento un servizio chiesto per rifiutare una
   * pubblicità.
   *
   * È configurazione obbligatoria come le altre: se manca, la funzione
   * risponde «non attivi» invece di iscrivere ai soli promemoria qualcuno che
   * aveva spuntato tutte e due. Accettare un consenso e non registrarlo è
   * peggio che non raccoglierlo.
   */
  listaMarketing: string | undefined;
  modello: string | undefined;
  /** Dove Brevo rimanda dopo il clic nella mail di conferma. */
  ritorno: string;
  origini: string[];
};

export type Risposta = {
  stato: number;
  corpo: { ok: true } | { ok: false; errore: string };
  /** Quello che va nel registro del server, e che a nessuno si mostra. */
  registro?: string;
};

export type Dipendenze = {
  /** `fetch`, iniettato: così la griglia non chiama Brevo. */
  fetch: typeof globalThis.fetch;
  /** La data di oggi, per la finestra di plausibilità delle scadenze. */
  oggi: string;
  /** L'orologio del freno. */
  adesso: number;
  /**
   * Il registro degli eventi, fuori da Brevo.
   *
   * Facoltativo per una ragione sola: la funzione deve poter rispondere anche
   * quando il magazzino non è configurato. Ma se c'è, si scrive **dopo** che
   * Brevo ha accettato — non prima: una richiesta registrata e mai arrivata a
   * Brevo sarebbe la prova di un trattamento che non è mai cominciato.
   *
   * E se la scrittura fallisce, l'iscrizione **resta**: qui l'ordine è il
   * contrario di quello della pulizia, e non per distrazione. Là si stava per
   * cancellare, e una cancellazione senza prova è irreversibile; qui si è già
   * iscritto qualcuno, e rispondergli «non è andata» dopo che Brevo gli ha
   * mandato l'email di conferma sarebbe dirgli una cosa falsa. L'errore va nel
   * registro del server, e il resoconto lo dice.
   */
  registro?: RegistroProve;
};

/*
  Il freno, e quanto vale davvero.

  Vive nella memoria dell'istanza, e le istanze serverless sono più di una e
  muoiono: chi volesse insistere ottiene cinque tentativi per istanza, non
  cinque in assoluto. Lo dico qui perché un freno descritto per più di quello
  che fa è peggio di nessun freno — chi legge si fida e non guarda altrove.

  Quello che tiene davvero l'abuso lontano è un'altra cosa: questa funzione
  non ha nessun modo di far mandare a Brevo un'email diversa da quella di
  conferma, e il doppio opt-in non iscrive nessuno che non abbia cliccato
  nella propria posta. Il peggio che ottiene chi insiste è far arrivare una
  richiesta di conferma a un indirizzo che non è suo, una volta.
*/
const visite = new Map<string, number[]>();

export function frenaSeInsiste(chiave: string, adesso: number): boolean {
  const recenti = (visite.get(chiave) ?? []).filter((t) => adesso - t < FRENO.finestraMs);
  if (recenti.length >= FRENO.tentativi) {
    visite.set(chiave, recenti);
    return true;
  }
  visite.set(chiave, [...recenti, adesso]);
  // La mappa non cresce per sempre: le chiavi senza tentativi recenti se ne vanno.
  if (visite.size > 5_000) {
    for (const [k, t] of visite) {
      if (t.every((x) => adesso - x >= FRENO.finestraMs)) visite.delete(k);
    }
  }
  return false;
}

/** Svuota il freno. Solo per la griglia: un test che eredita lo stato di un altro non prova niente. */
export function azzeraFreno(): void {
  visite.clear();
}

export async function gestisciPromemoria(
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

  if (!conf.chiave || !conf.lista || !conf.listaMarketing || !conf.modello) {
    /*
      503 e non 500: non è un guasto, è una funzione non ancora accesa. La
      frase è quella che la pagina può mostrare senza mentire — e la pagina,
      col suo interruttore spento, non arriva nemmeno qui.
    */
    return no(
      503,
      "I promemoria non sono ancora attivi. Riprova fra qualche giorno.",
      "configurazione Brevo incompleta: iscrizione spenta",
    );
  }

  if (!origineAmmessa(richiesta.headers.get("origin") ?? undefined, conf.origini)) {
    return no(403, "Richiesta non ammessa.", `origine «${richiesta.headers.get("origin")}»`);
  }

  const grezzo = await richiesta.text();
  if (grezzo.length > CORPO_MASSIMO_BYTE) {
    return no(413, "Richiesta troppo grande.", `${grezzo.length} byte`);
  }

  let corpo: unknown;
  try {
    corpo = JSON.parse(grezzo);
  } catch {
    return no(400, "Non ho capito la richiesta. Riprova.", "JSON non valido");
  }

  const convalida = convalidaPromemoria(corpo, dip.oggi);
  if (!convalida.ok) return no(400, convalida.errore, convalida.motivo);

  /*
    Il freno **dopo** la convalida e prima di Brevo: frenare su un corpo
    malformato vorrebbe dire che chi manda spazzatura consuma i tentativi di
    chi sta dietro al suo stesso indirizzo di rete — un ufficio, una rete
    mobile — e li chiude fuori.
  */
  const rete = (richiesta.headers.get("x-forwarded-for") ?? "ignoto").split(",")[0].trim();
  if (frenaSeInsiste(rete, dip.adesso)) {
    return no(429, "Hai provato troppe volte. Riprova fra qualche minuto.", `freno su ${rete}`);
  }

  let esito: Response;
  try {
    esito = await dip.fetch(BREVO_DOI, {
      method: "POST",
      headers: {
        "api-key": conf.chiave,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        email: convalida.email,
        attributes: {
          ...convalida.attributi,
          /*
            L'orologio della conservazione, messo **qui** e non dal browser.

            I termini decisi dal legale ripartono da un'interazione attiva:
            l'iscrizione, un nuovo calcolo, un clic. Serve una data, e
            `modifiedAt` di Brevo non va bene — lo muove anche la pulizia
            quando svuota, e un contatto che la pulizia tocca si vedrebbe
            rinnovare il termine proprio da chi doveva toglierlo (vedi
            `pulizia.ts`).

            Lo scrive il server e non la pagina per due ragioni. La prima è
            che questa non è una data che l'utente dichiara: è il momento in
            cui la richiesta è arrivata, e l'orologio di chi conserva deve
            essere di chi conserva. La seconda è che così l'elenco di quello
            che **esce dal browser** resta di sei attributi, come l'ha visto
            il legale: questo è un settimo che il browser non manda e non
            potrebbe mandare.

            Un nuovo calcolo ripassa di qui e lo riscrive: è il «salvo nuovo
            calcolo» dei termini, senza nessuna regola in più.
          */
          [ATTRIBUTO_ATTIVITA]: dip.oggi,
        },
        /*
          I promemoria sempre, le comunicazioni sul prodotto solo se
          spuntate. Una conferma sola vale per tutte e due le liste: chi
          clicca nella posta conferma l'indirizzo, non la singola lista — ed
          è giusto così, perché l'indirizzo è uno.
        */
        includeListIds: convalida.marketing
          ? [Number(conf.lista), Number(conf.listaMarketing)]
          : [Number(conf.lista)],
        templateId: Number(conf.modello),
        redirectionUrl: conf.ritorno,
      }),
    });
  } catch (e) {
    return no(
      502,
      "Non riesco a contattare il servizio di posta. Riprova fra un attimo.",
      `fetch verso Brevo fallito: ${String(e)}`,
    );
  }

  if (!esito.ok) {
    /*
      Il corpo di Brevo va nel registro e non a schermo: contiene i suoi
      codici e, in qualche caso, l'indirizzo. A chi guarda la pagina serve
      sapere che non è partita, non perché.
    */
    const dettaglio = await esito.text().catch(() => "");
    return no(
      502,
      "L'iscrizione non è andata a buon fine. Riprova fra un attimo.",
      `Brevo ${esito.status}: ${dettaglio.slice(0, 500)}`,
    );
  }

  /*
    La richiesta è partita: si registra.

    Due archivi diversi, perché sono due cose diverse. La **richiesta** del
    servizio sta nell'archivio del punto d (art. 6.1.b): la persona ha chiesto
    i promemoria, e questo è l'atto che lo dimostra. Il **consenso** al
    marketing, se c'è, sta nell'archivio probatorio del punto e: è un consenso,
    ed è l'unico dei due di cui l'art. 7.1 chiede di poter dimostrare
    l'esistenza.

    Quello che qui **non** si può registrare è la conferma del doppio opt-in:
    avviene sui server di Brevo, quando la persona clicca nella sua posta, e da
    qui non si vede. Vedi `docs/invio-promemoria.md`: l'unico segnale che la
    dimostra è un webhook di Brevo, e registrarla dal rimando del clic
    significherebbe scrivere una prova che chiunque conosca l'indirizzo di
    ritorno può fabbricare — cioè non una prova.
  */
  if (dip.registro) {
    const quando = new Date(dip.adesso).toISOString();
    const testo = testoCorrente();
    try {
      await dip.registro.scrivi({
        archivio: "servizio-promemoria",
        email: convalida.email,
        tipo: "richiesta",
        quando,
        ...testo,
      });
      if (convalida.marketing) {
        await dip.registro.scrivi({
          archivio: "consensi-marketing",
          email: convalida.email,
          tipo: "consenso",
          quando,
          ...testo,
        });
      }
    } catch (e) {
      return {
        stato: 200,
        corpo: { ok: true },
        registro: `iscrizione riuscita ma evento non registrato: ${String(e)}`,
      };
    }
  }

  return { stato: 200, corpo: { ok: true } };
}

/**
 * Le origini ammesse: il sito, e la distribuzione di anteprima quando c'è.
 *
 * L'anteprima serve a provare la funzione prima di mandarla in produzione, ed
 * è l'unico modo di farlo davvero — `next dev` non esegue questa funzione.
 * Senza il suo indirizzo fra le ammesse, la prova finirebbe con un 403 che
 * sembra un difetto del codice.
 */
export function originiAmmesse(dominio: string, urlVercel: string | undefined): string[] {
  const host = dominio.replace(/^https?:\/\//, "");
  const ammesse = [`https://${host}`, `https://www.${host}`];
  if (urlVercel) ammesse.push(`https://${urlVercel.replace(/^https?:\/\//, "")}`);
  return ammesse;
}
