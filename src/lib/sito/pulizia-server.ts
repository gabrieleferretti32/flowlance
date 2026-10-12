/**
 * La pulizia che gira davvero: legge i contatti, decide, esegue.
 *
 * Le decisioni stanno in `pulizia.ts` e non sanno niente della rete; qui c'è
 * il giro e quello che va storto. Diviso così perché la parte che **cancella
 * i dati di qualcuno** si possa guardare in un test prima che succeda — e
 * perché il giro, contro un client finto, si possa far girare mille volte
 * senza toccare nessuno.
 */
import type { ClientBrevo, ContattoBrevo } from "./brevo";
import { ATTRIBUTI_CALCOLO, decidi, ultimaAttivita, type Azione, type Configurazione } from "./pulizia";
import { bloccato, testoCorrente, type Blocco, type RegistroProve } from "./registro-prove";

/** Quanti contatti per pagina. Il massimo che Brevo accetta è 1000; qui si sta larghi. */
export const PAGINA = 500;

/**
 * Il tetto di contatti per esecuzione.
 *
 * Una funzione serverless ha un tempo massimo, e una pulizia che lo supera
 * viene troncata **a metà**: alcune cancellazioni fatte, altre no, e nessuno
 * sa quali. Meglio fermarsi da soli dichiarandolo: il giro dopo riprende, e
 * il resoconto dice che si è fermato.
 */
export const TETTO_CONTATTI = 5_000;

export type Resoconto = {
  /** Contatti esaminati. */
  esaminati: number;
  /** Azioni decise, per tipo. */
  cancellati: number;
  calcoliSvuotati: number;
  usciteDaLista: number;
  /** Azioni fallite: l'errore è nel registro, il giro è andato avanti. */
  errori: { email: string; azione: string; dettaglio: string }[];
  /** Contatti saltati perché bloccati da una contestazione. */
  bloccati: number;
  /** La pulizia si è fermata al tetto senza finire l'archivio. */
  troncata: boolean;
  /**
   * La pulizia si è rifiutata di partire.
   *
   * Succede quando il termine di conservazione delle prove non è ancora un
   * numero. Vedi `CONSERVAZIONE_PROVE_MESI`: cancellare senza sapere per
   * quanto si conserva la prova della cancellazione è il danno che il
   * registro esiste per evitare.
   */
  rifiutata: string | null;
  /** Ogni azione eseguita, per il registro. */
  fatte: Azione[];
};

export type Dipendenze = {
  client: ClientBrevo;
  /**
   * Il registro delle prove, fuori da Brevo.
   *
   * Non è facoltativo: una pulizia senza registro cancella il contatto **e**
   * la prova che quella persona aveva chiesto qualcosa. Vedi
   * `registro-prove.ts`.
   */
  registro: RegistroProve;
  /**
   * Per quanti mesi si conservano le prove.
   *
   * Arriva da `CONSERVAZIONE_PROVE_MESI`, che oggi vale la stringa «DA
   * CONFERMARE DAL LEGALE». Qui si accetta anche la stringa, e si rifiuta di
   * partire: così il rifiuto è una cosa che si prova in un test, non una
   * condizione scritta in un guscio che gira solo in produzione.
   */
  conservazioneProveMesi: number | string;
  /**
   * Gli indirizzi su cui pende una contestazione: non si toccano.
   *
   * Arriva da `BLOCCHI`. Passato come dipendenza e non letto dal modulo, come
   * tutto il resto qui dentro: un elenco che si può sostituire in un test è un
   * elenco su cui si può provare che la pulizia **non** fa niente, che è il
   * comportamento da verificare.
   */
  blocchi?: readonly Blocco[];
  conf: Configurazione;
  /** La data di oggi, iniettata: questo modulo non ha un orologio. */
  oggi: string;
  /**
   * Prova e basta: decide tutto, esegue niente.
   *
   * È il modo di guardare che cosa farebbe la pulizia stanotte senza che
   * cancelli niente, e la prima cosa da lanciare dopo aver configurato Brevo.
   */
  provaSoltanto?: boolean;
};

async function esegui(client: ClientBrevo, a: Azione): Promise<void> {
  switch (a.tipo) {
    case "cancella":
      return client.cancellaContatto(a.email);
    /* La prova la scrive `eseguiPulizia` prima di arrivare qui: vedi sotto. */
    case "svuotaCalcolo":
      /*
        Svuota **solo** le quattro voci del calcolo. `REGIME` e
        `ACCANTONAMENTO_MESE` restano: il termine 2 parla dei dati del
        calcolo, e l'elenco di quali siano sta in `ATTRIBUTI_CALCOLO`, in un
        posto solo. E soprattutto non si tocca `ULTIMA_ATTIVITA`, che è
        l'orologio del marketing: scriverlo qui vorrebbe dire rinnovarlo
        proprio mentre si fa pulizia.
      */
      return client.aggiornaAttributi(
        a.email,
        Object.fromEntries(ATTRIBUTI_CALCOLO.map((k) => [k, ""])),
      );
    case "esciDaLista":
      return client.togliDaLista(a.email, a.lista);
  }
}

export async function eseguiPulizia(dip: Dipendenze): Promise<Resoconto> {
  const r: Resoconto = {
    esaminati: 0,
    cancellati: 0,
    calcoliSvuotati: 0,
    usciteDaLista: 0,
    bloccati: 0,
    errori: [],
    troncata: false,
    rifiutata: null,
    fatte: [],
  };

  /*
    Il rifiuto, prima di qualunque cosa.

    Finché il legale non dice per quanto si conservano le prove, la pulizia
    non parte: cancellare scrivendo una prova che non si sa per quanto tenere
    è peggio che non cancellare, perché crea un archivio nuovo senza una
    regola. E non parte **del tutto** — non «salta il registro e cancella lo
    stesso», che sarebbe il modo silenzioso di fare il danno.
  */
  const mesi = dip.conservazioneProveMesi;
  if (typeof mesi !== "number" || !Number.isFinite(mesi) || mesi <= 0) {
    r.rifiutata =
      `termine di conservazione delle prove non confermato (${JSON.stringify(mesi)}): `
      + "la pulizia non parte. Vedi CONSERVAZIONE_PROVE_MESI in src/lib/sito/registro-prove.ts.";
    return r;
  }

  let offset = 0;
  for (;;) {
    let pagina: ContattoBrevo[];
    try {
      pagina = await dip.client.elencaContatti(offset, PAGINA);
    } catch (e) {
      /*
        L'elenco che non arriva ferma il giro, e deve: andare avanti con
        `offset + PAGINA` salterebbe in silenzio cinquecento contatti, e il
        resoconto direbbe che è andato tutto bene.
      */
      r.errori.push({ email: "—", azione: "elenca", dettaglio: String(e) });
      return r;
    }
    if (pagina.length === 0) return r;

    for (const contatto of pagina) {
      r.esaminati += 1;
      /*
        Il blocco, prima di decidere qualunque cosa.

        Un indirizzo su cui pende una contestazione non si tocca: né il
        contatto, né i suoi dati del calcolo, né le liste. Saltarlo **qui** e
        non più in basso vuol dire che non esiste nessun ramo in cui una parte
        delle azioni viene eseguita lo stesso — e le prove che riguardano quel
        procedimento restano dove sono.
      */
      if (bloccato(contatto.email, dip.blocchi ?? [])) {
        r.bloccati += 1;
        continue;
      }
      for (const azione of decidi(contatto, dip.conf, dip.oggi)) {
        r.fatte.push(azione);
        if (azione.tipo === "cancella") r.cancellati += 1;
        if (azione.tipo === "svuotaCalcolo") r.calcoliSvuotati += 1;
        if (azione.tipo === "esciDaLista") r.usciteDaLista += 1;
        if (dip.provaSoltanto) continue;

        /*
          La prova **prima** della cancellazione, e mai dopo.

          Se il registro non accetta la scrittura, il contatto non si tocca:
          meglio un contatto che resta un giorno di più che una cancellazione
          di cui non resta prova. L'ordine qui è la differenza fra le due
          cose, e invertirlo non produrrebbe nessun errore — solo, ogni tanto,
          una cancellazione muta.

          Si scrive solo per le cancellazioni. Uscire da una lista perché un
          termine è scaduto non è un atto della persona: non è una
          disattivazione chiesta da lei, e registrarla come tale direbbe il
          falso.

          L'evento è una **disattivazione del servizio** e sta nell'archivio
          del punto d: il contatto cancellato qui è quello che aveva chiesto i
          promemoria e non aveva mai confermato. Chiamarlo «revoca» lo
          sposterebbe nell'archivio probatorio dei consensi marketing, dove non
          c'entra niente — e racconterebbe come ritiro di un consenso quella
          che è la fine di un servizio mai cominciato.
        */
        if (azione.tipo === "cancella") {
          try {
            await dip.registro.scrivi({
              archivio: "servizio-promemoria",
              email: azione.email,
              tipo: "disattivazione",
              quando: ultimaAttivita(contatto) ?? dip.oggi,
              ...testoCorrente(),
              nota: `richiesta mai confermata; contatto cancellato il ${dip.oggi}`,
            });
          } catch (e) {
            r.errori.push({ email: azione.email, azione: "registro", dettaglio: String(e) });
            r.cancellati -= 1;
            continue;
          }
        }

        try {
          await esegui(dip.client, azione);
        } catch (e) {
          /*
            Un contatto che non si lascia toccare non ferma gli altri: il
            giro continua e l'errore finisce nel resoconto. Una pulizia che
            si arresta al primo intoppo lascia indietro tutto il resto, e
            nessuno se ne accorge fino al giorno dopo.
          */
          r.errori.push({ email: azione.email, azione: azione.tipo, dettaglio: String(e) });
        }
      }
    }

    offset += pagina.length;
    if (pagina.length < PAGINA) return r;
    if (offset >= TETTO_CONTATTI) {
      r.troncata = true;
      return r;
    }
  }
}
