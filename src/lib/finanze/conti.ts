/**
 * L'elenco dei conti: in che ordine si legge, e come si distinguono due nomi
 * che cominciano uguale.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * L'ordine di prima non era un ordine
 * ─────────────────────────────────────────────────────────────────────────
 *
 * I conti arrivavano nell'ordine in cui li restituisce l'archivio, che è
 * l'ordine dei loro identificatori: numeri casuali. Cambiava a ogni conto
 * aggiunto, era diverso da quello che chi guarda ricorda, e metteva i conti in
 * posti che non vogliono dire niente. In un archivio vero: Trade Republic,
 * Fineco, Revolut, Mediolanum, Fineco (Tasse), Intesa Sanpaolo — con i due
 * «Fineco» lontani e «Fineco (Tasse)» appiccicato sopra «Intesa Sanpaolo».
 *
 * Un import di trentasette movimenti è finito sul conto sbagliato proprio
 * così: il menu è stato aperto e la riga presa è stata quella sopra. L'ordine
 * alfabetico non toglie il rischio — due nomi che cominciano uguale restano
 * vicini, ed è giusto che lo siano — ma toglie la sorpresa: l'elenco è sempre
 * lo stesso, in ogni schermata, e dove uno si aspetta di trovarlo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Due righe che a colpo d'occhio sono la stessa riga
 * ─────────────────────────────────────────────────────────────────────────
 *
 * «Fineco» e «Fineco (Tasse)» in un menu stretto si leggono uguali: la parte
 * che li distingue è in fondo, dove l'occhio non arriva scegliendo in fretta.
 * Quando due conti cominciano allo stesso modo, accanto al nome va qualcosa
 * che li separi — e non il tipo, che su due conti della stessa banca è lo
 * stesso: il **saldo**, che è diverso per definizione ed è il numero che chi
 * sceglie sta già pensando.
 *
 * Il distintivo compare **solo dove serve**. Metterlo su ogni riga sarebbe
 * rumore su cinque conti per un problema che ne riguarda due.
 */
import { euro } from "@/lib/format";
import { saldoConto } from "./saldo";
import type { ContoPersonale, MovimentoPf } from "./tipi";

/** Il nome come si confronta: minuscolo, senza spazi doppi né bordi. */
function nomeConfrontabile(nome: string): string {
  return nome.trim().replace(/\s+/g, " ").toLocaleLowerCase("it-IT");
}

/**
 * In ordine alfabetico italiano, con i numeri letti come numeri: «Conto 2»
 * prima di «Conto 10», che è l'ordine in cui li scriverebbe una persona.
 */
export function contiInOrdine(conti: ContoPersonale[]): ContoPersonale[] {
  return [...conti].sort((a, b) =>
    a.nome.localeCompare(b.nome, "it", { numeric: true, sensitivity: "base" }),
  );
}

/**
 * I conti che a colpo d'occhio si possono scambiare per un altro.
 *
 * Due nomi si somigliano se uno comincia con l'altro — «Fineco» e «Fineco
 * (Tasse)» — oppure se la loro prima parola è la stessa: «Conto Mario» e
 * «Conto Anna» hanno lo stesso problema, spostato di una parola.
 */
export function contiConfondibili(conti: ContoPersonale[]): Set<string> {
  const confondibili = new Set<string>();
  const nomi = conti.map((c) => ({ id: c.id, nome: nomeConfrontabile(c.nome) }));
  for (const a of nomi) {
    for (const b of nomi) {
      if (a.id === b.id || a.nome === "" || b.nome === "") continue;
      const primaDi = (n: string) => n.split(" ")[0];
      const stessaPrimaParola = primaDi(a.nome) === primaDi(b.nome) && primaDi(a.nome).length >= 3;
      if (a.nome.startsWith(b.nome) || b.nome.startsWith(a.nome) || stessaPrimaParola) {
        confondibili.add(a.id);
        confondibili.add(b.id);
      }
    }
  }
  return confondibili;
}

/**
 * Che cosa scrivere accanto al nome di ogni conto, o `null` se basta il nome.
 *
 * Una mappa e non una funzione da chiamare riga per riga: il confronto fra i
 * nomi riguarda l'elenco intero, e farlo una volta sola per elenco è anche
 * l'unico modo perché due schermate non arrivino a due risposte diverse.
 */
export function distintiviDeiConti(
  conti: ContoPersonale[],
  movimenti: MovimentoPf[],
  al?: string,
): Map<string, string | null> {
  const confondibili = contiConfondibili(conti);
  return new Map(
    conti.map((c) => [c.id, confondibili.has(c.id) ? euro(saldoConto(c, movimenti, al)) : null]),
  );
}

/**
 * Il conto da proporre per un file, dagli import già fatti.
 *
 * Il primo conto dell'elenco non è una proposta: è il primo della fila, e su
 * sei conti ne indovina uno su sei. Un file che si chiama come uno già
 * importato, invece, quasi sempre è lo stesso estratto conto del mese dopo —
 * e quello lo si sa, non lo si tira a indovinare.
 *
 * Si guarda **l'import più recente**, non il primo: se il conto era sbagliato
 * ed è stato rifatto, vale la correzione. E si guarda solo un import finito su
 * un conto solo, perché un import di più file su più conti non dice a quale di
 * quei conti apparteneva questo nome. Senza corrispondenza torna stringa
 * vuota: **nessuna preselezione**, e il pulsante che legge resta spento finché
 * qualcuno sceglie.
 */
export function contoPropostoPerFile(
  nomeFile: string,
  importazioni: { data: string; file: string; contoId: string }[],
  conti: ContoPersonale[],
): string {
  const esiste = new Set(conti.map((c) => c.id));
  const suoi = importazioni
    .filter((i) => i.contoId !== "" && esiste.has(i.contoId))
    /* `file` tiene i nomi di più file uniti da « · »: si cerca fra quelli. */
    .filter((i) => i.file.split(" · ").includes(nomeFile))
    .sort((a, b) => b.data.localeCompare(a.data));
  return suoi[0]?.contoId ?? "";
}

/**
 * I movimenti di un import da spostare su un altro conto, e quelli che non si
 * possono spostare.
 *
 * L'unico caso che si rifiuta è il giroconto che ha **già** quel conto
 * dall'altro capo: spostarlo lo farebbe uscire ed entrare nello stesso conto,
 * cioè un movimento che non vuol dire niente e che il saldo conterebbe due
 * volte con segni opposti. Si lascia dov'è e lo si dice, invece di
 * trasformarlo in silenzio.
 */
export function movimentiDaSpostare(
  movimenti: MovimentoPf[],
  importId: string,
  daContoId: string,
  aContoId: string,
): { spostati: MovimentoPf[]; bloccati: MovimentoPf[] } {
  const suoi = movimenti.filter((m) => m.importId === importId && m.contoId === daContoId);
  const bloccati = suoi.filter((m) => m.tipo === "giroconto" && m.contoDestinazioneId === aContoId);
  const bloccatiId = new Set(bloccati.map((m) => m.id));
  return {
    spostati: suoi.filter((m) => !bloccatiId.has(m.id)).map((m) => ({ ...m, contoId: aContoId })),
    bloccati,
  };
}
