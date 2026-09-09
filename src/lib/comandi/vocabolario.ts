/**
 * Il vocabolario della palette comandi.
 *
 * Modulo puro: qui si decide *cosa* si può fare e come si trova, non *come*
 * viene eseguito. Ogni comando porta un'azione descritta come dato — la
 * schermata la esegue con un `switch` — così l'elenco si può verificare senza
 * montare React e senza un database sotto.
 *
 * Le voci di navigazione stanno qui e non nella barra laterale: la barra ne è
 * un consumatore, come la palette. Una sola tabella di rotte, altrimenti fra
 * sei mesi la palette conosce una schermata che il menu ha perso.
 */
import { euro } from "@/lib/format";
import { ROTTE } from "@/lib/rotte";
import { riscontro, riscontroMigliore } from "./fuzzy";

export type Azione =
  | { tipo: "vai"; href: string }
  | { tipo: "nuovaFattura" }
  | { tipo: "nuovaNota" }
  | { tipo: "nuovoCosto" }
  | { tipo: "segnaIncassata"; fatturaId: string }
  | { tipo: "cambiaAnno"; anno: number }
  | { tipo: "esportaBackup" }
  | { tipo: "apriFattura"; numero: string }
  | { tipo: "apriCliente"; nome: string };

export type Destinazione = {
  href: string;
  etichetta: string;
  gruppo: string;
  /** La lettera che segue `g`. Assente dove una scorciatoia dedicata non serve. */
  tasto?: string;
  /** Come la si chiama a voce, quando non è come si chiama nel menu. */
  sinonimi?: string[];
  /** Le schermate non ancora pronte restano visibili ma inattive. */
  pronta: boolean;
};

/**
 * Le schermate dell'app, in ordine di menu.
 *
 * Le lettere di `g` seguono l'iniziale dove è libera e la seconda lettera dove
 * l'iniziale è già presa (cOsti, cLienti): sono comunque elencate per intero
 * nella schermata delle scorciatoie, che è dove si imparano.
 */
export const DESTINAZIONI: Destinazione[] = [
  { href: ROTTE.cruscotto, etichetta: "Cruscotto", gruppo: "Ogni giorno", tasto: "c", sinonimi: ["home", "dashboard", "riepilogo"], pronta: true },
  { href: ROTTE.fatture, etichetta: "Fatture", gruppo: "Ogni giorno", tasto: "f", sinonimi: ["ricavi", "incassi", "emesse"], pronta: true },
  { href: ROTTE.note, etichetta: "Note di credito", gruppo: "Ogni giorno", tasto: "e", sinonimi: ["storno", "storni", "nota credito", "reso", "rimborso"], pronta: true },
  { href: ROTTE.costi, etichetta: "Costi", gruppo: "Ogni giorno", tasto: "o", sinonimi: ["spese", "uscite", "fornitori"], pronta: true },
  { href: ROTTE.clienti, etichetta: "Clienti", gruppo: "Ogni giorno", tasto: "l", sinonimi: ["portafoglio", "anagrafica"], pronta: true },
  { href: ROTTE.fisco, etichetta: "Imposte e contributi", gruppo: "Fisco", tasto: "i", sinonimi: ["tasse", "prospetto", "irpef", "inps"], pronta: true },
  { href: ROTTE.iva, etichetta: "IVA", gruppo: "Fisco", tasto: "v", sinonimi: ["liquidazione"], pronta: true },
  { href: ROTTE.confronto, etichetta: "Confronto regimi", gruppo: "Fisco", tasto: "r", sinonimi: ["forfettario", "ordinario", "convenienza"], pronta: true },
  { href: ROTTE.scadenzario, etichetta: "Scadenzario", gruppo: "Fisco", tasto: "s", sinonimi: ["scadenze", "adempimenti", "f24"], pronta: true },
  { href: ROTTE.chiusura, etichetta: "Chiusura d'anno", gruppo: "Fisco", tasto: "a", sinonimi: ["passaggio d'anno", "riporti"], pronta: true },
  { href: ROTTE.cashflow, etichetta: "Cashflow", gruppo: "Finanza", tasto: "w", sinonimi: ["flusso di cassa", "liquidita"], pronta: true },
  { href: ROTTE.patrimonio, etichetta: "Patrimonio", gruppo: "Finanza", tasto: "p", sinonimi: ["attivi", "passivi", "netto"], pronta: true },
  { href: ROTTE.pianificazione, etichetta: "Pianificazione", gruppo: "Finanza", tasto: "n", sinonimi: ["obiettivi", "scenari"], pronta: true },
  { href: ROTTE.avvio, etichetta: "Configurazione", gruppo: "Impostazioni", sinonimi: ["onboarding", "percorso", "regime"], pronta: true },
  { href: ROTTE.parametri, etichetta: "Parametri", gruppo: "Impostazioni", sinonimi: ["addizionale", "aliquote", "regione", "comune", "cassa", "contributi fissi", "ore fatturabili"], pronta: true },
  { href: ROTTE.dati, etichetta: "Dati e backup", gruppo: "Impostazioni", tasto: "d", sinonimi: ["esporta", "importa", "demo", "backup"], pronta: true },
  { href: ROTTE.importa, etichetta: "Importa da CSV", gruppo: "Impostazioni", tasto: "m", sinonimi: ["csv", "excel", "carica storico", "esporta csv", "tracciato"], pronta: true },
  { href: ROTTE.licenza, etichetta: "Licenza", gruppo: "Impostazioni", sinonimi: ["chiave", "scadenza", "abbonamento", "attiva"], pronta: true },
  { href: ROTTE.scorciatoie, etichetta: "Scorciatoie da tastiera", gruppo: "Impostazioni", sinonimi: ["tasti", "aiuto", "comandi"], pronta: true },
];

export type SezioneComandi = "Azioni" | "Vai a" | "Fatture" | "Clienti" | "Anno";

export type Comando = {
  id: string;
  etichetta: string;
  sezione: SezioneComandi;
  azione: Azione;
  /** Il contesto a destra: cliente, importo, stato. Non entra nella ricerca. */
  dettaglio?: string;
  /** Parole che devono trovare il comando pur non comparendo nell'etichetta. */
  sinonimi?: string[];
  /** La scorciatoia equivalente, mostrata accanto alla voce. */
  scorciatoia?: string;
};

/** Quel poco che serve per costruire l'elenco. Niente `Prospetto`, niente Dexie. */
export type ContestoComandi = {
  /**
   * L'app è in sola lettura (licenza scaduta): restano solo i comandi che
   * leggono. Sparire è meglio che comparire e non funzionare — e «esporta
   * backup» resta, perché l'esportazione funziona sempre.
   */
  solaLettura?: boolean;
  annoCorrente: number;
  /** Gli anni fra cui si può passare, di norma quelli con documenti più il corrente. */
  anni: number[];
  fatture: {
    id: string;
    numero: string;
    cliente: string;
    imponibile: number;
    incassata: boolean;
  }[];
  clienti: { id: string; nome: string }[];
};

const LIMITE_PER_SEZIONE = 6;

export function comandi(ctx: ContestoComandi): Comando[] {
  const scrive = !ctx.solaLettura;

  const out: Comando[] = [];
  if (scrive) {
    out.push(
    {
      id: "azione:nuova-fattura",
      etichetta: "Nuova fattura",
      sezione: "Azioni",
      azione: { tipo: "nuovaFattura" },
      sinonimi: ["emetti", "crea fattura", "aggiungi ricavo"],
      scorciatoia: "N",
    },
    {
      id: "azione:nuova-nota",
      etichetta: "Nuova nota di credito",
      sezione: "Azioni",
      azione: { tipo: "nuovaNota" },
      sinonimi: ["storno", "nota credito", "reso", "rimborso", "accredito"],
    },
    {
      id: "azione:nuovo-costo",
      etichetta: "Nuovo costo",
      sezione: "Azioni",
      azione: { tipo: "nuovoCosto" },
      sinonimi: ["spesa", "aggiungi costo", "fornitore"],
    },
    );
  }
  out.push({
    id: "azione:esporta-backup",
    etichetta: "Esporta backup",
    sezione: "Azioni",
    azione: { tipo: "esportaBackup" },
    sinonimi: ["salva archivio", "scarica dati", "json"],
    dettaglio: "scarica un file con tutto l'archivio",
  });

  for (const d of DESTINAZIONI) {
    if (!d.pronta) continue;
    out.push({
      id: `vai:${d.href}`,
      etichetta: d.etichetta,
      sezione: "Vai a",
      azione: { tipo: "vai", href: d.href },
      sinonimi: d.sinonimi,
      dettaglio: d.gruppo,
      scorciatoia: d.tasto ? `G ${d.tasto.toUpperCase()}` : undefined,
    });
  }

  // «Cambia anno» non è una voce sola: sono gli anni, così si arriva al 2025
  // in due tasti invece che aprendo un menu dentro un menu.
  for (const anno of ctx.anni) {
    out.push({
      id: `anno:${anno}`,
      etichetta: `Cambia anno · ${anno}`,
      sezione: "Anno",
      azione: { tipo: "cambiaAnno", anno },
      sinonimi: [`anno ${anno}`, "periodo", "esercizio"],
      dettaglio: anno === ctx.annoCorrente ? "anno corrente" : undefined,
    });
  }

  // Le fatture da incassare vengono prima: «segna incassata» è l'azione che si
  // ripete ogni settimana, e la si cerca per numero o per cliente.
  for (const f of scrive ? ctx.fatture : []) {
    if (f.incassata) continue;
    out.push({
      id: `incassa:${f.id}`,
      etichetta: `Segna incassata ${f.numero}`,
      sezione: "Fatture",
      azione: { tipo: "segnaIncassata", fatturaId: f.id },
      sinonimi: [f.numero, f.cliente, `incassata ${f.cliente}`, "pagata", "saldata"],
      dettaglio: `${f.cliente} · ${euro(f.imponibile)}`,
    });
  }

  for (const f of ctx.fatture) {
    out.push({
      id: `fattura:${f.id}`,
      etichetta: `Apri fattura ${f.numero}`,
      sezione: "Fatture",
      azione: { tipo: "apriFattura", numero: f.numero },
      sinonimi: [f.numero, f.cliente],
      dettaglio: `${f.cliente} · ${f.incassata ? "incassata" : "da incassare"}`,
    });
  }

  for (const c of ctx.clienti) {
    out.push({
      id: `cliente:${c.id}`,
      etichetta: `Apri cliente ${c.nome}`,
      sezione: "Clienti",
      azione: { tipo: "apriCliente", nome: c.nome },
      sinonimi: [c.nome],
    });
  }

  return out;
}

export type Esito = {
  comando: Comando;
  /** Ordina soltanto: tiene conto anche dei sinonimi. */
  punteggio: number;
  /**
   * Le lettere da evidenziare, e solo quelle dell'etichetta.
   *
   * Il punteggio può venire da un sinonimo — «studio» trova la fattura di
   * Delta Studio passando per il nome del cliente — ma le posizioni di un
   * sinonimo non hanno senso sull'etichetta: applicarle lì significa
   * illuminare lettere a caso, come se «studio» avesse trovato «inCASSata».
   */
  indici: number[];
};

/**
 * Filtra e ordina.
 *
 * A query vuota l'elenco resta nell'ordine in cui è costruito — azioni, poi
 * navigazione — e le sezioni lunghe (fatture, clienti) si troncano: aprire la
 * palette su duecento fatture non aiuta nessuno. Con una query si ordina per
 * punteggio e il troncamento sparisce, perché a quel punto l'elenco è la
 * risposta a una domanda precisa.
 */
export function cerca(elenco: Comando[], query: string, limite = 40): Esito[] {
  const q = query.trim();

  if (q === "") {
    const contatore = new Map<SezioneComandi, number>();
    const esiti: Esito[] = [];
    for (const comando of elenco) {
      const n = (contatore.get(comando.sezione) ?? 0) + 1;
      contatore.set(comando.sezione, n);
      if (comando.sezione !== "Vai a" && comando.sezione !== "Azioni" && n > LIMITE_PER_SEZIONE) {
        continue;
      }
      esiti.push({ comando, punteggio: 0, indici: [] });
    }
    return esiti.slice(0, limite);
  }

  const esiti: Esito[] = [];
  for (const comando of elenco) {
    const campi = [comando.etichetta, ...(comando.sinonimi ?? [])];
    const migliore = riscontroMigliore(campi, q);
    if (!migliore) continue;
    esiti.push({
      comando,
      punteggio: migliore.punteggio,
      indici: riscontro(comando.etichetta, q)?.indici ?? [],
    });
  }

  // A parità di punteggio vince l'ordine di costruzione: `sort` in JS è stabile,
  // quindi «Nuova fattura» resta davanti a una fattura omonima.
  esiti.sort((a, b) => b.punteggio - a.punteggio);
  return esiti.slice(0, limite);
}

/** Raggruppa mantenendo l'ordine con cui le sezioni compaiono nei risultati. */
export function perSezione(esiti: Esito[]): { sezione: SezioneComandi; esiti: Esito[] }[] {
  const gruppi: { sezione: SezioneComandi; esiti: Esito[] }[] = [];
  for (const e of esiti) {
    const ultimo = gruppi.find((g) => g.sezione === e.comando.sezione);
    if (ultimo) ultimo.esiti.push(e);
    else gruppi.push({ sezione: e.comando.sezione, esiti: [e] });
  }
  return gruppi;
}
