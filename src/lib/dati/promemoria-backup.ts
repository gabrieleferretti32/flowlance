/**
 * Quando ricordare all'utente di fare un backup.
 *
 * L'app è local-first e resta tale: i dati stanno in questo browser e da
 * nessun'altra parte. È una promessa, ed è anche l'unico modo in cui questo
 * prodotto può perdere un anno di lavoro — computer nuovo, cache svuotata,
 * profilo cancellato. L'unica difesa è un file esportato a mano, cioè un gesto
 * che nessuno si ricorda di fare.
 *
 * Da qui la regola: **un avviso che compare quando serve e sparisce quando il
 * backup è fatto**. Un banner fisso si impara a ignorare in tre giorni, e
 * ignorare l'avviso sul backup è esattamente il difetto che si voleva evitare.
 *
 * Modulo puro. Legge un promemoria e un conteggio, restituisce cosa dire.
 */
import { COLLEZIONI, type Dati, type NomeCollezione } from "./tipi";

/** Cosa l'app ricorda dell'ultimo backup. `null` finché non ne è stato fatto uno. */
export type PromemoriaBackup = {
  /** Quando è stato esportato, in ISO. */
  fattoIl: string;
  /** Quanti documenti c'erano allora: serve a misurare quanto lavoro è nuovo. */
  documenti: number;
} | null;

/**
 * Le collezioni che contano come lavoro fatto.
 *
 * Non tutte: percorsi di configurazione e spunte dello scadenzario si
 * rifanno in minuti, le impostazioni si ridichiarano. Quello che costa
 * reinserire sono i documenti — e sono anche l'unica cosa che l'utente
 * riconosce come «il mio lavoro».
 */
export const COLLEZIONI_LAVORO: NomeCollezione[] = [
  "fatture",
  "note",
  "costi",
  "clienti",
  "versamenti",
  "movimentiPersonali",
  "movimentiAttivita",
  "patrimonio",
];

export function contaDocumenti(dati: Dati): number {
  return COLLEZIONI_LAVORO.reduce((t, c) => t + dati[c].length, 0);
}

/**
 * Le tre soglie.
 *
 * `MINIMO_PRIMO`: sotto cinque documenti si sta ancora guardando l'app, e un
 * avviso sarebbe rumore su qualcuno che non ha ancora niente da perdere.
 *
 * `DOCUMENTI_NUOVI`: dieci. Nel dataset dimostrativo un anno pieno fa un
 * centinaio di documenti fra fatture, note e costi — dieci sono circa un mese
 * di lavoro, che è la quantità più grande che una persona accetta di
 * reinserire a mano senza arrabbiarsi.
 *
 * `GIORNI`: trenta, il ritmo del prodotto — la riga di cashflow del mese, i
 * costi del mese, la liquidazione trimestrale. Ma il tempo da solo non basta a
 * far comparire l'avviso: serve anche almeno un documento nuovo. Chi non ha
 * toccato niente non ha niente da salvare, e disturbarlo lo stesso è il modo
 * più rapido di insegnargli a ignorare gli avvisi.
 */
export const SOGLIE = {
  MINIMO_PRIMO: 5,
  DOCUMENTI_NUOVI: 10,
  GIORNI: 30,
} as const;

export type MotivoBackup = "mai" | "documenti" | "tempo";

export type AvvisoBackup = {
  motivo: MotivoBackup;
  /** Quanti documenti sono stati inseriti dall'ultimo backup. */
  nuovi: number;
  /** Da quanti giorni non se ne fa uno. `null` se non ne è mai stato fatto. */
  giorni: number | null;
  titolo: string;
  testo: string;
};

function giorniFra(da: string, a: string): number {
  const inizio = Date.parse(da);
  const fine = Date.parse(a);
  if (!Number.isFinite(inizio) || !Number.isFinite(fine)) return 0;
  return Math.max(0, Math.floor((fine - inizio) / 86_400_000));
}

function inParole(n: number, singolare: string, plurale: string): string {
  return n === 1 ? `1 ${singolare}` : `${n} ${plurale}`;
}

/**
 * L'avviso da mostrare, o `null` se non c'è niente da dire.
 *
 * Le tre condizioni sono in **or**, ma ognuna richiede che ci sia davvero
 * qualcosa da perdere: nessuna scatta su un archivio che non è cambiato.
 */
export function avvisoBackup(
  promemoria: PromemoriaBackup,
  documentiOra: number,
  oggi: string,
): AvvisoBackup | null {
  if (promemoria === null) {
    if (documentiOra < SOGLIE.MINIMO_PRIMO) return null;
    return {
      motivo: "mai",
      nuovi: documentiOra,
      giorni: null,
      titolo: "Non hai mai fatto un backup",
      testo: `Hai ${inParole(documentiOra, "documento", "documenti")} in archivio, e vivono solo in questo browser: se cambi computer o svuoti i dati del sito, non c'è nessun posto da cui tornino. Il backup è un file che scarichi tu, in un secondo.`,
    };
  }

  const nuovi = Math.max(0, documentiOra - promemoria.documenti);
  const giorni = giorniFra(promemoria.fattoIl, oggi);

  if (nuovi >= SOGLIE.DOCUMENTI_NUOVI) {
    return {
      motivo: "documenti",
      nuovi,
      giorni,
      titolo: `${inParole(nuovi, "documento nuovo", "documenti nuovi")} dall'ultimo backup`,
      testo: `L'ultimo backup è di ${inParole(giorni, "giorno fa", "giorni fa")} e non contiene questo lavoro. Rifarlo adesso costa un tocco.`,
    };
  }

  // Il tempo conta solo se nel frattempo è successo qualcosa: un archivio
  // fermo da sei mesi è già tutto dentro l'ultimo backup.
  if (giorni >= SOGLIE.GIORNI && nuovi > 0) {
    return {
      motivo: "tempo",
      nuovi,
      giorni,
      titolo: `Ultimo backup ${inParole(giorni, "giorno fa", "giorni fa")}`,
      testo: `Da allora hai aggiunto ${inParole(nuovi, "documento", "documenti")}. Un file nuovo adesso e sei di nuovo in pari.`,
    };
  }

  return null;
}

/** Il promemoria da salvare dopo un export riuscito. */
export function promemoriaDopoExport(dati: Dati, adesso = new Date()): NonNullable<PromemoriaBackup> {
  return { fattoIl: adesso.toISOString(), documenti: contaDocumenti(dati) };
}

/** Quante entità ci sono in tutto, comprese quelle che non contano come lavoro. */
export function contaTutto(dati: Dati): number {
  return COLLEZIONI.reduce((t, c) => t + dati[c].length, 0);
}
