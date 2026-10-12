/**
 * La pulizia notturna: esegue i termini di conservazione decisi dal legale.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché esiste, e che cosa la fa partire
 * ─────────────────────────────────────────────────────────────────────────
 *
 * L'informativa promette che certi dati spariscono entro un termine. Una
 * promessa del genere la può tenere solo qualcosa che gira da solo: `next dev`
 * non c'è di notte, e `api/promemoria.ts` risponde a una richiesta e muore.
 * Questa funzione la chiama Vercel Cron una volta al giorno — vedi la voce
 * `crons` in `vercel.json` e la sezione «Conservazione» di `DEPLOY.md`.
 *
 * Tutto quello che decide sta in `src/lib/sito/pulizia.ts`, che non conosce la
 * rete, e il giro sta in `pulizia-server.ts`, che gira contro un client finto
 * nella griglia. Qui restano soltanto le tre cose che dipendono da Vercel: chi
 * può chiamare, da dove arrivano le chiavi, e che giorno è.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Chi può chiamarla
 * ─────────────────────────────────────────────────────────────────────────
 *
 * È un indirizzo pubblico che **cancella dati**. Vercel manda le chiamate di
 * cron con un'intestazione `Authorization: Bearer $CRON_SECRET`, e qui senza
 * quella non si fa niente: il segreto si legge dall'ambiente, e se non è
 * configurato la funzione risponde «non attiva» invece di aprirsi a chiunque.
 * Un endpoint di cancellazione che accetta chiunque è peggio di nessuna
 * pulizia.
 *
 * Il confronto è a lunghezza costante: su un segreto, un `===` che esce al
 * primo carattere diverso dice qualcosa a chi misura i tempi. Costa tre righe.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Spenta finché non è configurata, come tutto il resto
 * ─────────────────────────────────────────────────────────────────────────
 *
 * - `CRON_SECRET` — il segreto con cui Vercel firma la chiamata.
 * - `BREVO_API_KEY` — la stessa chiave dell'iscrizione, con i permessi di
 *   scrittura sui contatti.
 * - `BREVO_LISTA_PROMEMORIA`, `BREVO_LISTA_MARKETING` — le due liste: senza
 *   saperle, «esci da questa e non da quella» non si può nemmeno dire.
 *
 * Ne manca una e la funzione risponde 503 senza contattare nessuno.
 *
 * `?prova=1` decide tutto ed esegue niente: è il modo di guardare che cosa
 * farebbe stanotte, ed è la prima cosa da lanciare dopo aver configurato
 * Brevo.
 */
import { clientBrevo } from "../src/lib/sito/brevo";
import { eseguiPulizia } from "../src/lib/sito/pulizia-server";

/** Confronto a lunghezza costante: un `===` su un segreto si fa cronometrare. */
function stessoSegreto(dato: string, atteso: string): boolean {
  if (dato.length !== atteso.length) return false;
  let differenza = 0;
  for (let i = 0; i < dato.length; i++) differenza |= dato.charCodeAt(i) ^ atteso.charCodeAt(i);
  return differenza === 0;
}

export default async function pulizia(richiesta: Request): Promise<Response> {
  const rispondi = (stato: number, corpo: unknown) =>
    new Response(JSON.stringify(corpo), {
      status: stato,
      headers: { "content-type": "application/json; charset=utf-8" },
    });

  const segreto = process.env.CRON_SECRET;
  const chiave = process.env.BREVO_API_KEY;
  const promemoria = process.env.BREVO_LISTA_PROMEMORIA;
  const marketing = process.env.BREVO_LISTA_MARKETING;

  if (!segreto || !chiave || !promemoria || !marketing) {
    console.warn("pulizia: configurazione incompleta, non eseguita");
    return rispondi(503, { ok: false, errore: "Pulizia non configurata." });
  }

  const autorizzazione = richiesta.headers.get("authorization") ?? "";
  if (!stessoSegreto(autorizzazione, `Bearer ${segreto}`)) {
    console.warn("pulizia: chiamata senza il segreto di cron");
    return rispondi(401, { ok: false, errore: "Non autorizzata." });
  }

  const provaSoltanto = new URL(richiesta.url).searchParams.get("prova") === "1";

  const resoconto = await eseguiPulizia({
    client: clientBrevo(chiave, globalThis.fetch),
    conf: { listaPromemoria: Number(promemoria), listaMarketing: Number(marketing) },
    oggi: new Date().toISOString().slice(0, 10),
    provaSoltanto,
  });

  /*
    Il registro porta i conti e gli errori, non gli indirizzi: i log di Vercel
    li legge chi ha accesso al progetto, e un elenco di email di persone
    cancellate è esattamente il dato che si stava cancellando. Gli indirizzi
    restano negli errori, dove servono a capire quale contatto non si lascia
    toccare, e solo lì.
  */
  console.log(
    `pulizia${provaSoltanto ? " (prova)" : ""}: ${resoconto.esaminati} esaminati · `
      + `${resoconto.cancellati} cancellati · ${resoconto.calcoliSvuotati} calcoli svuotati · `
      + `${resoconto.usciteDaLista} uscite da lista · ${resoconto.errori.length} errori`
      + (resoconto.troncata ? " · TRONCATA al tetto" : ""),
  );
  for (const e of resoconto.errori) console.warn(`pulizia: ${e.azione} su ${e.email}: ${e.dettaglio}`);

  return rispondi(200, {
    ok: true,
    prova: provaSoltanto,
    esaminati: resoconto.esaminati,
    cancellati: resoconto.cancellati,
    calcoliSvuotati: resoconto.calcoliSvuotati,
    usciteDaLista: resoconto.usciteDaLista,
    errori: resoconto.errori.length,
    troncata: resoconto.troncata,
  });
}
