"use client";

// Dal modulo puro e non da `components/ui`: il livello dei dati non deve
// dipendere dalla presentazione, e così i test girano senza toccare JSX.
import { toast, type Raggruppamento } from "@/lib/stato/toast";
import { dimenticaImport } from "./importazioni";
import {
  conFissiDiLegge,
  impostazioniDaPrecedente,
  impostazioniPredefinite,
  impostazioniPrecedenti,
} from "@/lib/fisco/impostazioni";
import { parametriDi } from "@/lib/fisco/parametri";
import {
  conComune,
  conEreditaConfermata,
  conEsenzione,
  conRegione,
  conScaglioni,
  conValoreProposto,
  conValoreDichiarato,
  senzaDichiarazione,
  type CampoAddizionale,
  type CampoUtente,
} from "@/lib/fisco/parametri-utente";
import type { ChiusuraAnno, DestinazioneCreditoIva } from "@/lib/fisco/chiusura";
import type { Impostazioni, Regime, ScaglioneIrpef } from "@/lib/fisco/tipi";
import {
  chiavePercorso,
  percorsoVuoto,
  NOME_CONTESTO,
  type ContestoPercorso,
  type StatoPercorso,
} from "@/lib/onboarding/percorso";
import { archivio } from "./archivio";
import { creaBackup, nomeFileBackup, serializzaBackup } from "./backup";
import { scaricaTesto } from "./file";
import { promemoriaDopoExport } from "./promemoria-backup";
import { useStatoBackup } from "@/lib/stato/backup";
import { costoGrezzo, fatturaGrezza } from "@/lib/fisco/documenti";
import type {
  BenePf,
  BudgetPf,
  CategoriaPf,
  ContoPersonale,
  ImportPf,
  ImpostazioniPf,
  MovimentoPf,
  RegolaPf,
} from "@/lib/finanze/tipi";
import { dodiciMesi, importiDi } from "@/lib/finanze/budget";
import type { MappaturaColonne } from "@/lib/finanze/rendiconto";
import {
  CATEGORIE_INIZIALI,
  movimentiDellaCategoria,
  nomeGiaUsato,
} from "@/lib/finanze/categorie";
import { notaGrezza } from "@/lib/fisco/note";
import { round2 } from "@/lib/fisco/aritmetica";
import { datasetDi, DATASET_PREDEFINITO, type IdDataset } from "./dataset";
import type {
  Cliente,
  Costo,
  Fattura,
  NotaCredito,
  MovimentoAttivita,
  MovimentoPersonale,
  VersamentoF24,
  VocePatrimonio,
} from "./tipi";
import { nuovoId } from "./tipi";

/**
 * Le scritture, con salvataggio ottimistico e annullamento.
 *
 * Ogni modifica va a buon fine subito nell'interfaccia — la tabella è reattiva
 * sull'archivio, quindi «ottimistico» qui significa che non c'è nessuna attesa
 * di rete da mostrare — e il toast tiene per qualche secondo il valore
 * precedente, così un errore di battitura si ripara senza cercare la riga.
 */

async function conAnnullamento<T extends { id: string }>(
  deposito: {
    leggi(id: string): Promise<T | undefined>;
    salva(v: T): Promise<string>;
    elimina(id: string): Promise<void>;
  },
  id: string,
  messaggio: string,
  azione: () => Promise<void>,
  gruppo?: Raggruppamento,
): Promise<void> {
  const precedente = await deposito.leggi(id);
  await azione();
  toast.conferma(
    messaggio,
    async () => {
      if (precedente) await deposito.salva(precedente);
      else await deposito.elimina(id);
    },
    gruppo,
  );
}

/**
 * I gruppi delle modifiche in linea.
 *
 * Modificare una cella dopo l'altra è il gesto più frequente in questa app, e
 * ogni modifica è una scrittura con il suo annullamento: senza raggruppamento
 * diventano dodici toast sovrapposti sopra la tabella che si sta usando.
 * L'annullamento del gruppo disfa tutte le modifiche, dall'ultima alla prima.
 */
const GRUPPO_FATTURE: Raggruppamento = {
  chiave: "fattura-aggiornata",
  molti: (n) => `${n} fatture aggiornate`,
};
const GRUPPO_COSTI: Raggruppamento = {
  chiave: "costo-aggiornato",
  molti: (n) => `${n} costi aggiornati`,
};
const GRUPPO_CLIENTI: Raggruppamento = {
  chiave: "cliente-aggiornato",
  molti: (n) => `${n} clienti aggiornati`,
};

// ————————————————————————————————————————————————————————————
// Fatture
// ————————————————————————————————————————————————————————————

export async function salvaFattura(fattura: Fattura, messaggio = "Fattura aggiornata") {
  await conAnnullamento(
    archivio().fatture,
    fattura.id,
    messaggio,
    async () => {
      // Normalizzata qui e non nei punti di chiamata: le azioni della riga
      // passano la fattura *calcolata*, e senza questo passaggio finivano in
      // archivio anche `stato`, `iva`, `totale` e gli altri dodici derivati —
      // 23 campi invece di 9, contro la regola per cui nel database non entra
      // nulla che si possa ricalcolare. Un punto solo, che nessuno può saltare.
      await archivio().fatture.salva(fatturaGrezza(fattura));
    },
    GRUPPO_FATTURE,
  );
}

export async function creaFattura(fattura: Omit<Fattura, "id">): Promise<Fattura> {
  const nuova: Fattura = { ...fattura, id: nuovoId() };
  await archivio().fatture.salva(nuova);
  toast.conferma(`Fattura ${nuova.numero || "senza numero"} creata`, async () => {
    await archivio().fatture.elimina(nuova.id);
  });
  return nuova;
}

export async function eliminaFattura(fattura: Fattura) {
  await archivio().fatture.elimina(fattura.id);
  toast.conferma(`Fattura ${fattura.numero || "senza numero"} eliminata`, async () => {
    await archivio().fatture.salva(fattura);
  });
}

/** Azione rapida della tabella: incassata oggi, salvo diversa indicazione. */
export async function segnaIncassata(fattura: Fattura, dataIncasso?: string) {
  const data = dataIncasso ?? new Date().toISOString().slice(0, 10);
  await salvaFattura({ ...fattura, dataIncasso: data }, "Segnata come incassata");
}

export async function annullaIncasso(fattura: Fattura) {
  await salvaFattura({ ...fattura, dataIncasso: null }, "Incasso rimosso");
}

/** Il numero successivo nella serie dell'anno: 2026/001, 2026/002… */
export function prossimoNumero(fatture: Fattura[], anno: number): string {
  const prefisso = `${anno}/`;
  const progressivi = fatture
    .filter((f) => f.numero.startsWith(prefisso))
    .map((f) => Number.parseInt(f.numero.slice(prefisso.length), 10))
    .filter((n) => Number.isFinite(n));
  const prossimo = progressivi.length > 0 ? Math.max(...progressivi) + 1 : 1;
  return `${prefisso}${String(prossimo).padStart(3, "0")}`;
}

// ————————————————————————————————————————————————————————————
// Costi
// ————————————————————————————————————————————————————————————

/**
 * Salva un cliente.
 *
 * Prima le celle di `/clienti` scrivevano dritte nell'archivio, senza conferma
 * e senza annullamento: una nota cancellata per sbaglio non si recuperava.
 */
// ————————————————————————————————————————————————————————————
// Note di credito
// ————————————————————————————————————————————————————————————

const GRUPPO_NOTE: Raggruppamento = {
  chiave: "nota-aggiornata",
  molti: (n) => `${n} note aggiornate`,
};

export async function salvaNota(nota: NotaCredito, messaggio = "Nota di credito aggiornata") {
  await conAnnullamento(
    archivio().note,
    nota.id,
    messaggio,
    async () => {
      await archivio().note.salva(notaGrezza(nota));
    },
    GRUPPO_NOTE,
  );
}

export async function creaNota(nota: Omit<NotaCredito, "id">): Promise<NotaCredito> {
  const nuova: NotaCredito = { ...nota, id: nuovoId() };
  await archivio().note.salva(notaGrezza(nuova));
  toast.conferma(`Nota di credito ${nuova.numero || "senza numero"} creata`, async () => {
    await archivio().note.elimina(nuova.id);
  });
  return nuova;
}

export async function eliminaNota(nota: NotaCredito) {
  await archivio().note.elimina(nota.id);
  toast.conferma(`Nota ${nota.numero || "senza numero"} eliminata`, async () => {
    await archivio().note.salva(notaGrezza(nota));
  });
}

/** Segna il rimborso: è la data che fa scendere i ricavi per cassa. */
export async function segnaRimborsata(nota: NotaCredito, dataRimborso?: string) {
  const data = dataRimborso ?? new Date().toISOString().slice(0, 10);
  await salvaNota({ ...nota, dataRimborso: data }, "Segnata come rimborsata");
}

export async function annullaRimborso(nota: NotaCredito) {
  await salvaNota({ ...nota, dataRimborso: null }, "Rimborso rimosso");
}

/**
 * Aggancia o sgancia una nota da una fattura.
 *
 * `imponibile` a zero toglie l'aggancio. Il residuo non si tocca: si ricalcola.
 */
export async function riconcilia(nota: NotaCredito, fatturaId: string, imponibile: number) {
  const altre = (nota.riconciliazioni ?? []).filter((r) => r.fatturaId !== fatturaId);
  const importo = round2(Math.abs(imponibile));
  await salvaNota(
    {
      ...nota,
      riconciliazioni: importo > 0 ? [...altre, { fatturaId, imponibile: importo }] : altre,
    },
    importo > 0 ? "Nota riconciliata" : "Riconciliazione rimossa",
  );
}

export async function salvaCliente(cliente: Cliente, messaggio = "Cliente aggiornato") {
  await conAnnullamento(
    archivio().clienti,
    cliente.id,
    messaggio,
    async () => {
      await archivio().clienti.salva(cliente);
    },
    GRUPPO_CLIENTI,
  );
}

export async function salvaCosto(costo: Costo, messaggio = "Costo aggiornato") {
  await conAnnullamento(
    archivio().costi,
    costo.id,
    messaggio,
    async () => {
      await archivio().costi.salva(costoGrezzo(costo));
    },
    GRUPPO_COSTI,
  );
}

export async function creaCosto(costo: Omit<Costo, "id">): Promise<Costo> {
  const nuovo: Costo = { ...costo, id: nuovoId() };
  await archivio().costi.salva(nuovo);
  toast.conferma("Costo registrato", async () => {
    await archivio().costi.elimina(nuovo.id);
  });
  return nuovo;
}

export async function eliminaCosto(costo: Costo) {
  await archivio().costi.elimina(costo.id);
  toast.conferma("Costo eliminato", async () => {
    await archivio().costi.salva(costo);
  });
}

export async function segnaPagato(costo: Costo, dataPagamento?: string) {
  const data = dataPagamento ?? new Date().toISOString().slice(0, 10);
  await salvaCosto({ ...costo, dataPagamento: data }, "Segnato come pagato");
}

// ————————————————————————————————————————————————————————————
// Impostazioni
// ————————————————————————————————————————————————————————————

/*
  `cambiaRegime` stava qui e non c'è più. Scriveva il regime solo se l'anno
  aveva già una riga di impostazioni in archivio, e altrimenti usciva in
  silenzio: su un telefono aperto per la prima volta il toggle in testata non
  faceva niente, senza dire niente. Il regime ora si cambia da un posto solo,
  la configurazione, che passa da `impostazioniDellAnno` e la riga la crea.
*/

// ————————————————————————————————————————————————————————————
// Clienti
// ————————————————————————————————————————————————————————————

export async function creaCliente(nome: string): Promise<string> {
  const esistente = (await archivio().clienti.tutti()).find(
    (c) => c.nome.trim().toLowerCase() === nome.trim().toLowerCase(),
  );
  if (esistente) return esistente.id;

  const id = nuovoId();
  await archivio().clienti.salva({
    id,
    nome: nome.trim(),
    canaleAcquisizione: "",
    note: "",
  });
  return id;
}

// ————————————————————————————————————————————————————————————
// Scadenzario
// ————————————————————————————————————————————————————————————

export function chiaveSpunta(anno: number, idAdempimento: string): string {
  return `${anno}:${idAdempimento}`;
}

export async function spuntaAdempimento(
  anno: number,
  idAdempimento: string,
  completato: boolean,
) {
  const id = chiaveSpunta(anno, idAdempimento);
  if (completato) {
    await archivio().spunte.salva({
      id,
      anno,
      idAdempimento,
      completatoIl: new Date().toISOString().slice(0, 10),
    });
  } else {
    await archivio().spunte.elimina(id);
  }
}

// ————————————————————————————————————————————————————————————
// Movimenti mensili, versamenti e patrimonio
// ————————————————————————————————————————————————————————————

export async function salvaMovimentoAttivita(
  anno: number,
  mese: number,
  modifiche: Partial<Pick<MovimentoAttivita, "altreEntrate" | "altreUscite">>,
) {
  const id = `ma-${anno}-${String(mese).padStart(2, "0")}`;
  const attuale = await archivio().movimentiAttivita.leggi(id);
  await archivio().movimentiAttivita.salva({
    id,
    anno,
    mese,
    altreEntrate: 0,
    altreUscite: 0,
    ...attuale,
    ...modifiche,
  });
}

export async function salvaMovimentoPersonale(
  anno: number,
  mese: number,
  modifiche: Partial<Omit<MovimentoPersonale, "id" | "anno" | "mese">>,
) {
  const id = `mp-${anno}-${String(mese).padStart(2, "0")}`;
  const attuale = await archivio().movimentiPersonali.leggi(id);
  await archivio().movimentiPersonali.salva({
    id,
    anno,
    mese,
    prelievi: 0,
    altreEntrate: 0,
    speseFisse: 0,
    speseVariabili: 0,
    risparmio: 0,
    ...attuale,
    ...modifiche,
  });
}

export async function creaVersamento(versamento: Omit<VersamentoF24, "id">) {
  const nuovo: VersamentoF24 = { ...versamento, id: nuovoId() };
  await archivio().versamenti.salva(nuovo);
  toast.conferma("Versamento F24 registrato", async () => {
    await archivio().versamenti.elimina(nuovo.id);
  });
}

/**
 * Cambia l'importo di un versamento già registrato.
 *
 * Serve al confronto con l'F24 sulla schermata IVA: chi corregge il numero
 * versato sta correggendo **quel** versamento, non aggiungendone un altro.
 */
export async function correggiVersamento(versamento: VersamentoF24, importo: number) {
  const precedente = { ...versamento };
  await archivio().versamenti.salva({ ...versamento, importo: round2(importo) });
  toast.conferma("Versamento aggiornato", async () => {
    await archivio().versamenti.salva(precedente);
  });
}

/**
 * Assegna a un versamento l'anno d'imposta a cui si riferisce.
 *
 * Esiste come azione a sé perché è la riparazione di un dato mancante, non una
 * modifica: chi ha registrato F24 prima che il campo esistesse deve poterli
 * sistemare uno per uno da dove li vede, senza cancellarli e riscriverli.
 */
export async function assegnaAnnoImposta(versamento: VersamentoF24, annoImposta: number) {
  const precedente = { ...versamento };
  await archivio().versamenti.salva({ ...versamento, annoImposta });
  toast.conferma(`Versamento assegnato al ${annoImposta}`, async () => {
    await archivio().versamenti.salva(precedente);
  });
}

export async function eliminaVersamento(versamento: VersamentoF24) {
  await archivio().versamenti.elimina(versamento.id);
  toast.conferma("Versamento eliminato", async () => {
    await archivio().versamenti.salva(versamento);
  });
}

export async function salvaVocePatrimonio(voce: VocePatrimonio) {
  await conAnnullamento(archivio().patrimonio, voce.id, "Voce aggiornata", async () => {
    await archivio().patrimonio.salva(voce);
  });
}

export async function creaVocePatrimonio(voce: Omit<VocePatrimonio, "id">) {
  const nuova: VocePatrimonio = { ...voce, id: nuovoId() };
  await archivio().patrimonio.salva(nuova);
  toast.conferma("Voce aggiunta al bilancio", async () => {
    await archivio().patrimonio.elimina(nuova.id);
  });
}

export async function eliminaVocePatrimonio(voce: VocePatrimonio) {
  await archivio().patrimonio.elimina(voce.id);
  toast.conferma("Voce eliminata", async () => {
    await archivio().patrimonio.salva(voce);
  });
}

// ————————————————————————————————————————————————————————————
// Chiusura d'anno
// ————————————————————————————————————————————————————————————

/**
 * Le impostazioni di un anno, create se non esistono.
 *
 * L'eredità dall'anno precedente sta in `impostazioniDaPrecedente`, che usano
 * in due: questa, quando si tocca qualcosa, e il calcolo, che mostra un anno
 * mai aperto. Devono essere la stessa funzione, altrimenti la schermata fa
 * vedere un profilo e il primo tasto premuto ne salva un altro.
 */
export async function impostazioniDellAnno(anno: number): Promise<Impostazioni> {
  const esistenti = await archivio().impostazioni.leggi(anno);
  if (esistenti) return esistenti;

  const tutte = await archivio().impostazioni.tutti();
  return impostazioniDaPrecedente(parametriDi(anno), anno, impostazioniPrecedenti(anno, tutte));
}

/**
 * Chiude un anno.
 *
 * Non congela niente e non scrive nessun importo derivato: registra la data,
 * le due decisioni (destinazione del credito IVA, regime dell'anno successivo)
 * e un'istantanea di sola lettura, che serve solo a far vedere in seguito che
 * qualcosa è cambiato. I riporti continuano a ricalcolarsi dai documenti.
 */
export async function chiudiAnno(
  chiusura: ChiusuraAnno,
  opzioni: { applicaRegime?: { anno: number; regime: Regime } } = {},
): Promise<void> {
  await archivio().chiusure.salva(chiusura);

  // Chiudere consuma l'annulla dell'ultimo import: da qui in avanti i riporti
  // dell'anno successivo poggiano su questi numeri, e toglierli da sotto senza
  // che la chiusura se ne accorga darebbe la cosa peggiore che questo progetto
  // possa produrre — un numero plausibile e sbagliato.
  await dimenticaImport();

  const regime = opzioni.applicaRegime;
  let impostazioniPrecedenti: Impostazioni | undefined;
  if (regime) {
    impostazioniPrecedenti = await archivio().impostazioni.leggi(regime.anno);
    const impostazioni = await impostazioniDellAnno(regime.anno);
    await archivio().impostazioni.salva({ ...impostazioni, regime: regime.regime });
  }

  toast.conferma(`Anno ${chiusura.anno} chiuso`, async () => {
    await archivio().chiusure.elimina(chiusura.anno);
    if (regime) {
      if (impostazioniPrecedenti) await archivio().impostazioni.salva(impostazioniPrecedenti);
      else await archivio().impostazioni.elimina(regime.anno);
    }
  });
}

/**
 * Riapre un anno chiuso.
 *
 * È la conferma che la chiusura non è mai stata uno stato irreversibile:
 * eliminare la riga riporta l'anno esattamente com'era, perché nessun numero
 * era stato scritto da nessuna parte.
 */
export async function riapriAnno(chiusura: ChiusuraAnno): Promise<void> {
  await archivio().chiusure.elimina(chiusura.anno);
  toast.conferma(`Anno ${chiusura.anno} riaperto`, async () => {
    await archivio().chiusure.salva(chiusura);
  });
}

/** Cambia la destinazione del credito IVA su un anno già chiuso. */
export async function cambiaDestinazioneCreditoIva(
  chiusura: ChiusuraAnno,
  destinazione: DestinazioneCreditoIva,
): Promise<void> {
  await archivio().chiusure.salva({ ...chiusura, destinazioneCreditoIva: destinazione });
  toast.conferma(
    destinazione === "compensazione"
      ? "Credito IVA in compensazione"
      : "Credito IVA chiesto a rimborso",
    async () => {
      await archivio().chiusure.salva(chiusura);
    },
  );
}

// ————————————————————————————————————————————————————————————
// Percorsi di configurazione
// ————————————————————————————————————————————————————————————

async function percorso(contesto: ContestoPercorso, anno: number): Promise<StatoPercorso> {
  const id = chiavePercorso(contesto, anno);
  const esistente = await archivio().percorsi.leggi(id);
  return esistente ?? percorsoVuoto(contesto, anno, new Date().toISOString());
}

/**
 * Segna un passo come affrontato.
 *
 * Confermato e saltato sono due stati diversi e si escludono: un passo saltato
 * a cui si risponde più tardi diventa confermato, e viceversa. L'app deve poter
 * dire «questo valore l'hai scelto tu» oppure «questo è il predefinito», e per
 * dirlo deve saperlo.
 */
export async function segnaPasso(
  contesto: ContestoPercorso,
  anno: number,
  passo: string,
  esito: "confermato" | "saltato",
): Promise<void> {
  const attuale = await percorso(contesto, anno);
  const senzaIlPasso = {
    confermati: attuale.confermati.filter((p) => p !== passo),
    saltati: attuale.saltati.filter((p) => p !== passo),
  };
  await archivio().percorsi.salva({
    ...attuale,
    confermati:
      esito === "confermato" ? [...senzaIlPasso.confermati, passo] : senzaIlPasso.confermati,
    saltati: esito === "saltato" ? [...senzaIlPasso.saltati, passo] : senzaIlPasso.saltati,
    aggiornatoIl: new Date().toISOString(),
  });
}

/** Chiude il percorso. Non blocca niente: resta ripercorribile. */
export async function completaPercorso(
  contesto: ContestoPercorso,
  anno: number,
): Promise<void> {
  const attuale = await percorso(contesto, anno);
  await archivio().percorsi.salva({
    ...attuale,
    completatoIl: new Date().toISOString(),
    aggiornatoIl: new Date().toISOString(),
  });
  toast.conferma(`${NOME_CONTESTO[contesto]} completato`, async () => {
    await archivio().percorsi.salva(attuale);
  });
}

/** Ricomincia da capo un percorso già affrontato. */
export async function ripartiPercorso(
  contesto: ContestoPercorso,
  anno: number,
): Promise<void> {
  const attuale = await percorso(contesto, anno);
  await archivio().percorsi.salva(percorsoVuoto(contesto, anno, new Date().toISOString()));
  toast.conferma(`${NOME_CONTESTO[contesto]} ricominciato`, async () => {
    await archivio().percorsi.salva(attuale);
  });
}

/**
 * Scrive le impostazioni di un anno da dentro il percorso.
 *
 * Passa da `impostazioniDellAnno` perché un anno nuovo potrebbe non averle
 * ancora: risponder a una domanda deve poterle creare, non fallire in silenzio.
 */
export async function aggiornaImpostazioni(
  anno: number,
  modifiche: Partial<Impostazioni>,
): Promise<void> {
  const attuali = await impostazioniDellAnno(anno);
  let prossime: Impostazioni = { ...attuali, ...modifiche, anno };
  /*
    Cambiare gestione cambia i contributi fissi di legge, e il campo che li
    mostra deve seguirli.

    Senza questo, un commerciante vedeva nei Parametri l'importo degli artigiani
    mentre il motore ne usava un altro: il numero calcolato era giusto e quello
    scritto no, che è la divergenza peggiore fra le due — nessuno dei due
    segnala l'altro. `conValoreProposto` lascia stare un valore dichiarato:
    chi ha una riduzione non se la vede sovrascrivere cambiando gestione.
  */
  if (modifiche.gestione !== undefined) {
    prossime = conFissiDiLegge(prossime, parametriDi(anno));
  }
  await archivio().impostazioni.salva(prossime);
}

/**
 * Dichiara un parametro che solo l'utente conosce.
 *
 * Scrive il valore e lo marca come confermato: da quel momento l'app smette di
 * chiamarlo predefinito, e il prospetto torna esportabile se era quello a
 * bloccarlo.
 */
export async function dichiaraParametro(
  anno: number,
  campo: CampoUtente,
  valore: number,
): Promise<void> {
  const attuali = await impostazioniDellAnno(anno);
  await archivio().impostazioni.salva(conValoreDichiarato(attuali, campo, valore));
}

/**
 * Scrive gli scaglioni di un'addizionale, o torna all'aliquota unica.
 *
 * `conferma` è falso quando si sta solo scegliendo la forma della risposta:
 * le righe partono dall'aliquota media, e finché nessuno le tocca il parametro
 * resta predefinito — altrimenti il PDF si sbloccherebbe su numeri dell'app.
 */
export async function dichiaraScaglioni(
  anno: number,
  campo: CampoAddizionale,
  scaglioni: ScaglioneIrpef[] | null,
  conferma = true,
): Promise<void> {
  const attuali = await impostazioniDellAnno(anno);
  await archivio().impostazioni.salva(conScaglioni(attuali, campo, scaglioni, conferma));
}

/** Scrive la soglia sotto la quale l'addizionale non è dovuta. */
export async function dichiaraEsenzione(
  anno: number,
  campo: CampoAddizionale,
  valore: number,
): Promise<void> {
  const attuali = await impostazioniDellAnno(anno);
  await archivio().impostazioni.salva(conEsenzione(attuali, campo, valore));
}

/**
 * Propone un valore senza dichiararlo: cambia il numero, non la responsabilità.
 * Il campo resta «predefinito», e il prospetto resta bloccato.
 */
export async function proponiParametro(
  anno: number,
  campo: CampoUtente,
  valore: number,
): Promise<void> {
  const attuali = await impostazioniDellAnno(anno);
  await archivio().impostazioni.salva(conValoreProposto(attuali, campo, valore));
}

/**
 * «Vale anche per quest'anno.»
 *
 * Il numero non cambia: cambia l'anno per cui qualcuno se ne prende la
 * responsabilità. Senza questo gesto, togliere l'etichetta «ereditato»
 * vorrebbe dire riscrivere a mano un valore identico a quello già a schermo.
 */
export async function confermaEredita(anno: number, campo: CampoUtente): Promise<void> {
  const attuali = await impostazioniDellAnno(anno);
  await archivio().impostazioni.salva(conEreditaConfermata(attuali, campo));
}

/**
 * La regione, e con lei l'aliquota base da cui partire.
 *
 * Una scrittura sola, e non è un dettaglio: leggere le impostazioni due volte
 * per scrivere due campi fa vincere l'ultima scrittura, e la regione appena
 * scelta spariva sovrascritta dall'aliquota proposta un istante dopo. Le due
 * cose sono un gesto solo anche per chi le usa — «vivo qui, parti da questo
 * numero» — e vanno salvate come tali.
 *
 * L'aliquota base resta **non dichiarata**: dire dove si vive non è dire
 * quanto si paga, e il prospetto resta bloccato finché l'aliquota vera non la
 * scrive l'utente. Se l'aveva già dichiarata non le si tocca niente.
 */
export async function dichiaraRegione(
  anno: number,
  codice: string | null,
  aliquotaBase?: number,
): Promise<void> {
  const attuali = await impostazioniDellAnno(anno);
  const conLaRegione = conRegione(attuali, codice);
  const prossime =
    codice !== null && aliquotaBase !== undefined
      ? conValoreProposto(conLaRegione, "addizionaleRegionale", aliquotaBase)
      : conLaRegione;
  await archivio().impostazioni.salva(prossime);
}

/** Il nome del comune a cui si riferisce l'addizionale comunale. */
export async function dichiaraComune(anno: number, nome: string | null): Promise<void> {
  const attuali = await impostazioniDellAnno(anno);
  await archivio().impostazioni.salva(conComune(attuali, nome));
}

/**
 * Rimette un parametro al predefinito dell'app.
 *
 * Serve a poter dire «non lo so» dopo aver detto un numero sbagliato: senza
 * questa strada, chi sbaglia a copiare l'aliquota resta con un valore suo e
 * falso, marcato come confermato.
 */
export async function ripristinaParametro(anno: number, campo: CampoUtente): Promise<void> {
  const attuali = await impostazioniDellAnno(anno);
  const predefinite = impostazioniPredefinite(parametriDi(anno));
  await archivio().impostazioni.salva(
    senzaDichiarazione(attuali, campo, predefinite[campo]),
  );
}

/**
 * Esporta l'archivio, e segna che è stato fatto.
 *
 * Una funzione sola perché le strade sono tre — la schermata Dati, la palette,
 * la scheda sul cruscotto — e la data va scritta da tutte. Se una sola
 * dimenticasse di scriverla, l'app continuerebbe a chiedere un backup appena
 * fatto: un avviso che compare quando non serve è un avviso che si impara a
 * ignorare, e a quel punto non serve più nemmeno quando serve.
 *
 * Non è bloccata dalla sola lettura, come `leggiTutto`: i dati dell'utente non
 * sono in ostaggio della licenza.
 */
export async function esportaBackup(): Promise<void> {
  const contenuto = await archivio().leggiTutto();
  scaricaTesto(nomeFileBackup(), serializzaBackup(creaBackup(contenuto)));
  useStatoBackup.getState().segna(promemoriaDopoExport(contenuto));
  toast.conferma("Backup esportato");
}

/**
 * Carica uno dei dataset di esempio dal percorso di primo avvio.
 *
 * Cosa sopravvive al caricamento lo dice il dataset, non questa funzione: il
 * dimostrativo conserva le risposte appena date in configurazione, la vetrina
 * no, perché regime e aliquote sono la storia che racconta.
 *
 * Il promemoria del backup viene segnato come se l'archivio fosse appena stato
 * esportato. Non è un trucco per nascondere un avviso: quei documenti non sono
 * lavoro dell'utente, e dirgli «non hai mai fatto un backup» di dati inventati
 * è il modo più rapido di insegnargli a ignorare l'avviso quando conterà.
 */
export async function caricaDataset(id: IdDataset = DATASET_PREDEFINITO): Promise<void> {
  const scelto = datasetDi(id);
  const precedente = await archivio().leggiTutto();
  const promemoriaPrecedente = useStatoBackup.getState().promemoria;
  const nuovi = scelto.dati(precedente);
  await archivio().scriviTutto(nuovi, "sostituisci");
  useStatoBackup.getState().segna(promemoriaDopoExport(nuovi));
  toast.conferma(`${scelto.nome}: dati caricati`, async () => {
    await archivio().scriviTutto(precedente, "sostituisci");
    // Torna indietro anche il promemoria: rimetterne uno nuovo direbbe che il
    // backup dell'archivio vero è appena stato fatto, e non è vero.
    const stato = useStatoBackup.getState();
    if (promemoriaPrecedente) stato.segna(promemoriaPrecedente);
    else stato.dimentica();
  });
}

// ————————————————————————————————————————————————————————————
// Finanze personali
// ————————————————————————————————————————————————————————————

/**
 * Un conto nuovo nasce con il saldo di **oggi**, e con oggi come ancora.
 *
 * La data di riferimento non è un dettaglio da chiedere: è la riga che rende
 * il saldo stabile. `saldoConto` somma solo i movimenti successivi a
 * quell'ancora, quindi caricare i rendiconti dei mesi passati non tocca il
 * saldo che hai scritto — e senza ancora, ogni import lo sposterebbe.
 */
export async function creaConto(conto: Omit<ContoPersonale, "id">): Promise<ContoPersonale> {
  const nuovo: ContoPersonale = { ...conto, id: nuovoId() };
  await archivio().pfConti.salva(nuovo);
  toast.conferma("Conto aggiunto", async () => {
    await archivio().pfConti.elimina(nuovo.id);
  });
  return nuovo;
}

export async function salvaConto(conto: ContoPersonale, messaggio = "Conto aggiornato") {
  await conAnnullamento(archivio().pfConti, conto.id, messaggio, async () => {
    await archivio().pfConti.salva(conto);
  });
}

/**
 * Elimina un conto **e i suoi movimenti**, o non elimina niente.
 *
 * Un movimento che punta a un conto che non c'è più non sparisce dal registro:
 * resta lì con un'origine che non si può nominare, e il saldo totale — che
 * somma i conti — smette di essere d'accordo con l'elenco dei movimenti, che
 * li mostra ancora. Due letture della stessa cassa che divergono in silenzio.
 * Quindi o vanno via insieme, e l'annullamento li riporta insieme, oppure la
 * schermata chiede prima di spostarli.
 */
export async function eliminaConto(conto: ContoPersonale, movimenti: MovimentoPf[]) {
  const suoi = movimenti.filter(
    (m) => m.contoId === conto.id || m.contoDestinazioneId === conto.id,
  );
  await archivio().pfConti.elimina(conto.id);
  if (suoi.length > 0) await archivio().pfMovimenti.eliminaMolti(suoi.map((m) => m.id));
  toast.conferma(
    suoi.length === 0
      ? "Conto eliminato"
      : `Conto eliminato, con ${suoi.length === 1 ? "il suo movimento" : `i suoi ${suoi.length} movimenti`}`,
    async () => {
      await archivio().pfConti.salva(conto);
      if (suoi.length > 0) await archivio().pfMovimenti.salvaMolti(suoi);
    },
  );
}

export async function creaBene(bene: Omit<BenePf, "id">): Promise<BenePf> {
  const nuovo: BenePf = { ...bene, id: nuovoId() };
  await archivio().pfBeni.salva(nuovo);
  toast.conferma(nuovo.classe === "debiti" ? "Debito aggiunto" : "Voce aggiunta", async () => {
    await archivio().pfBeni.elimina(nuovo.id);
  });
  return nuovo;
}

export async function salvaBene(bene: BenePf, messaggio = "Voce aggiornata") {
  await conAnnullamento(archivio().pfBeni, bene.id, messaggio, async () => {
    await archivio().pfBeni.salva(bene);
  });
}

export async function eliminaBene(bene: BenePf) {
  await archivio().pfBeni.elimina(bene.id);
  toast.conferma("Voce eliminata", async () => {
    await archivio().pfBeni.salva(bene);
  });
}

/**
 * Le categorie di partenza, scritte in archivio la prima volta che servono.
 *
 * Un registro senza categorie non si compila: ogni movimento ne vuole una. Il
 * modulo ne propone diciannove — `CATEGORIE_INIZIALI` — e questa è l'azione
 * che le mette in archivio. Non si semina da sola all'avvio: scrivere in un
 * archivio che nessuno ha chiesto di riempire è il modo di trovarsi dentro
 * roba che non si è messa.
 */
export async function seminaCategorie(): Promise<void> {
  const esistenti = await archivio().pfCategorie.tutti();
  if (esistenti.length > 0) return;
  await archivio().pfCategorie.salvaMolti([...CATEGORIE_INIZIALI]);
  toast.conferma("Categorie di partenza aggiunte", async () => {
    await archivio().pfCategorie.eliminaMolti(CATEGORIE_INIZIALI.map((c) => c.id));
  });
}

export async function creaMovimentoPf(movimento: Omit<MovimentoPf, "id">): Promise<MovimentoPf> {
  const nuovo: MovimentoPf = { ...movimento, id: nuovoId() };
  await archivio().pfMovimenti.salva(nuovo);
  toast.conferma("Movimento registrato", async () => {
    await archivio().pfMovimenti.elimina(nuovo.id);
  });
  return nuovo;
}

export async function salvaMovimentoPf(movimento: MovimentoPf, messaggio = "Movimento aggiornato") {
  await conAnnullamento(archivio().pfMovimenti, movimento.id, messaggio, async () => {
    await archivio().pfMovimenti.salva(movimento);
  });
}

export async function eliminaMovimentoPf(movimento: MovimentoPf) {
  await archivio().pfMovimenti.elimina(movimento.id);
  toast.conferma("Movimento eliminato", async () => {
    await archivio().pfMovimenti.salva(movimento);
  });
}

/**
 * Una categoria nuova, con il nome già controllato.
 *
 * Il controllo sul nome doppio sta nella schermata — che lo mostra mentre si
 * scrive, invece di rifiutare dopo — ma vive anche qui: un'azione che si fida
 * di chi la chiama è un'azione che il secondo chiamante romperà.
 */
export async function creaCategoria(
  categoria: Omit<CategoriaPf, "id">,
): Promise<CategoriaPf | null> {
  const esistenti = await archivio().pfCategorie.tutti();
  if (nomeGiaUsato(esistenti, categoria.tipo, categoria.nome)) {
    toast.errore(`C'è già una categoria «${categoria.nome.trim()}» fra quelle di questo tipo`);
    return null;
  }
  const nuova: CategoriaPf = { ...categoria, nome: categoria.nome.trim(), id: nuovoId() };
  await archivio().pfCategorie.salva(nuova);
  toast.conferma("Categoria aggiunta", async () => {
    await archivio().pfCategorie.elimina(nuova.id);
  });
  return nuova;
}

export async function salvaCategoria(categoria: CategoriaPf, messaggio = "Categoria aggiornata") {
  const esistenti = await archivio().pfCategorie.tutti();
  if (nomeGiaUsato(esistenti, categoria.tipo, categoria.nome, categoria.id)) {
    toast.errore(`C'è già una categoria «${categoria.nome.trim()}» fra quelle di questo tipo`);
    return;
  }
  await conAnnullamento(archivio().pfCategorie, categoria.id, messaggio, async () => {
    await archivio().pfCategorie.salva({ ...categoria, nome: categoria.nome.trim() });
  });
}

/**
 * Eliminare una categoria **collegata a dei movimenti non si fa**.
 *
 * I movimenti puntano alla categoria per id: tolta la categoria, restano lì
 * con un id che non risolve più. Nell'elenco comparirebbero con un trattino al
 * posto del nome, nel limite di spesa uscirebbero da tutti i gruppi — perché
 * nessun gruppo li riconosce — e la cifra spendibile salirebbe senza che
 * nessuno abbia speso di meno. Un dato che si rompe in silenzio, e si scopre
 * guardando un numero che sembra buono.
 *
 * Quindi si rifiuta, dicendo quanti sono: chi vuole davvero toglierla li
 * sposta su un'altra e riprova. Spostarli al posto suo vorrebbe dire scegliere
 * noi dove finiscono duecento spese.
 */
export async function eliminaCategoria(
  categoria: CategoriaPf,
  movimenti: MovimentoPf[],
): Promise<boolean> {
  const collegati = movimentiDellaCategoria(movimenti, categoria.id);
  if (collegati.length > 0) {
    toast.errore(
      `«${categoria.nome}» ha ${collegati.length === 1 ? "un movimento collegato" : `${collegati.length} movimenti collegati`}: spostali su un'altra categoria, poi eliminala.`,
    );
    return false;
  }
  await archivio().pfCategorie.elimina(categoria.id);
  toast.conferma("Categoria eliminata", async () => {
    await archivio().pfCategorie.salva(categoria);
  });
  return true;
}

// ————————————————————————————————————————————————————————————
// Import dei rendiconti
// ————————————————————————————————————————————————————————————

/**
 * La mappatura delle colonne si salva sul conto, non su un profilo di banca.
 *
 * Il tracciato è una proprietà del file che quella banca esporta per quel
 * conto: il mese dopo l'import non chiede più niente, e il giorno in cui la
 * banca cambia colonne si rifà una mappatura sola.
 */
export async function salvaMappaturaConto(conto: ContoPersonale, mappatura: MappaturaColonne) {
  await archivio().pfConti.salva({ ...conto, mappaturaImport: mappatura });
}

/**
 * Scrive i movimenti scelti, e lascia il biglietto per tornare indietro.
 *
 * Il biglietto è `ImportPf`: quando è stato fatto, da che file, quanti
 * movimenti. Ogni movimento porta il suo `importId`, quindi annullare è
 * trovare quelli con quell'id e toglierli — senza toccare quelli scritti a
 * mano nello stesso giorno, che non hanno nessun import addosso.
 */
export async function eseguiImportRendiconto(
  movimenti: MovimentoPf[],
  file: string[],
  contoId: string,
): Promise<ImportPf | null> {
  if (movimenti.length === 0) return null;
  const registrazione: ImportPf = {
    id: movimenti[0].importId ?? nuovoId(),
    data: new Date().toISOString(),
    file: file.join(" · "),
    contoId,
    numeroMovimenti: movimenti.length,
  };
  await archivio().pfMovimenti.salvaMolti(movimenti);
  await archivio().pfImport.salva(registrazione);
  toast.conferma(
    `${movimenti.length === 1 ? "Un movimento importato" : `${movimenti.length} movimenti importati`}`,
    async () => {
      await annullaImportRendiconto(registrazione);
    },
  );
  return registrazione;
}

/**
 * Annulla un import: toglie i suoi movimenti e la sua registrazione.
 *
 * Quello che è stato modificato a mano dopo l'import se ne va insieme al
 * resto, ed è la scelta giusta: «annulla questo import» vuol dire «rimetti le
 * cose com'erano prima», e una riga corretta a mano resta comunque una riga
 * che senza quell'import non ci sarebbe.
 */
export async function annullaImportRendiconto(importazione: ImportPf): Promise<number> {
  const tutti = await archivio().pfMovimenti.tutti();
  const suoi = tutti.filter((m) => m.importId === importazione.id);
  await archivio().pfMovimenti.eliminaMolti(suoi.map((m) => m.id));
  await archivio().pfImport.elimina(importazione.id);
  return suoi.length;
}

/**
 * La regola che nasce da una correzione in anteprima.
 *
 * Punta alla categoria per id, come i movimenti: rinominare la categoria non
 * stacca la regola. Il testo da cercare è quello che ha scelto la persona —
 * di norma una parola della descrizione — e non tutta la riga, che non si
 * ripeterebbe mai identica.
 */
export async function creaRegola(regola: Omit<RegolaPf, "id">): Promise<RegolaPf | null> {
  const testoPulito = regola.testoDaCercare.trim();
  if (testoPulito === "") return null;
  const esistenti = await archivio().pfRegole.tutti();
  const gia = esistenti.find(
    (r) =>
      r.testoDaCercare.trim().toLocaleLowerCase("it-IT") === testoPulito.toLocaleLowerCase("it-IT")
      && r.tipo === regola.tipo,
  );
  const nuova: RegolaPf = { ...regola, testoDaCercare: testoPulito, id: gia?.id ?? nuovoId() };
  await archivio().pfRegole.salva(nuova);
  toast.conferma(
    gia ? `Regola aggiornata: «${testoPulito}»` : `Regola creata: «${testoPulito}»`,
    async () => {
      if (gia) await archivio().pfRegole.salva(gia);
      else await archivio().pfRegole.elimina(nuova.id);
    },
  );
  return nuova;
}

/** Le impostazioni del modulo: una riga sola, creata la prima volta che serve. */
export async function salvaImpostazioniPf(impostazioni: ImpostazioniPf) {
  await conAnnullamento(archivio().pfImpostazioni, impostazioni.id, "Impostazione aggiornata", async () => {
    await archivio().pfImpostazioni.salva(impostazioni);
  });
}

// ————————————————————————————————————————————————————————————
// Budget
// ————————————————————————————————————————————————————————————

/**
 * Il budget non ha un `id`: la sua chiave è la coppia categoria-anno.
 *
 * `conAnnullamento` vuole righe con un `id`, quindi qui l'annullamento si
 * scrive a mano — e si scrive, perché una tabella di caselle è il posto dove
 * si sbaglia a digitare più spesso di ogni altro, e «annulla» è l'unica
 * risposta onesta a un 4.000 battuto al posto di 400.
 */
async function scriviBudget(
  categoriaId: string,
  anno: number,
  importi: number[],
  messaggio: string,
): Promise<void> {
  const chiave = `${categoriaId}|${anno}`;
  const precedente = await archivio().pfBudget.leggi(chiave);
  /*
    Dodici zeri non sono un budget: sono l'assenza di un budget, e le due cose
    devono stare nello stesso posto in archivio. Se restasse una riga di zeri,
    `previsto` varrebbe 0 come per una categoria mai compilata — uguale a
    vedersi, diversa da leggersi.
  */
  const vuoto = importi.every((n) => n === 0);
  if (vuoto) await archivio().pfBudget.elimina(chiave);
  else await archivio().pfBudget.salva({ categoriaId, anno, importi });

  toast.conferma(messaggio, async () => {
    if (precedente) await archivio().pfBudget.salva(precedente);
    else await archivio().pfBudget.elimina(chiave);
  });
}

/** Un mese solo, quello che si sta guardando. */
export async function salvaBudgetMese(
  categoriaId: string,
  anno: number,
  mese: number,
  importo: number,
  budget: BudgetPf[],
): Promise<void> {
  const importi = importiDi(budget, categoriaId, anno);
  importi[mese - 1] = round2(importo);
  await scriviBudget(categoriaId, anno, importi, "Budget del mese aggiornato");
}

/**
 * Lo stesso importo per dodici mesi.
 *
 * È un gesto esplicito e non l'effetto collaterale di una casella: scrivere
 * 400 a settembre e ritrovarselo su dicembre senza averlo chiesto è il modo
 * di perdere un budget compilato mese per mese.
 */
export async function applicaBudgetATuttoLAnno(
  categoriaId: string,
  anno: number,
  importo: number,
): Promise<void> {
  await scriviBudget(categoriaId, anno, dodiciMesi(importo), "Budget applicato a tutto l'anno");
}

/** Via il budget di una categoria per quell'anno, con l'annullamento. */
export async function azzeraBudget(categoriaId: string, anno: number): Promise<void> {
  await scriviBudget(categoriaId, anno, Array(12).fill(0), "Budget tolto");
}
