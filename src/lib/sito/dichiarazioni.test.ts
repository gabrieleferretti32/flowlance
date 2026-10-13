import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  VERSIONE_DICHIARAZIONI,
  VERSIONI_DICHIARAZIONI,
  dellaVersione,
  dichiarazioniMostrate,
} from "./dichiarazioni";
import { DICHIARAZIONE_PROFESSIONALE, accettazioneTermini } from "./acquisto";

/**
 * L'archivio delle dichiarazioni e la pagina dicono la stessa cosa.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il difetto che questo file esiste per rendere impossibile
 * ─────────────────────────────────────────────────────────────────────────
 *
 * L'evento dell'accettazione conserva l'**impronta** del testo delle due
 * caselle, non il testo. Perché quell'impronta valga qualcosa, il testo deve
 * essere ritrovabile — e deve essere quello che la persona ha visto.
 *
 * Due modi di rompersi, opposti:
 *
 * - **l'archivio si allontana dalla pagina.** Qualcuno riscrive la frase della
 *   dichiarazione professionale in `acquisto.ts` e non aggiunge una versione
 *   qui: da quel momento la pagina mostra una cosa e l'archivio conserva
 *   un'altra, e ogni evento registrato cita l'impronta di un testo che nessuno
 *   ha letto. Niente si rompe, e la prova non prova più niente;
 * - **una versione archiviata viene corretta.** Allora l'impronta di quella
 *   versione cambia, e non combacia più con quella scritta negli eventi già
 *   registrati. Questo verso si vede — guardando una prova — e la prima regola
 *   di questo archivio è che una versione chiusa non si tocca.
 *
 * Il primo verso lo prende il test qui sotto, confrontando carattere per
 * carattere. Il secondo non si può prendere da qui — gli eventi stanno su
 * Vercel Blob, non in questo repository — e per questo l'impronta si **calcola**
 * invece di essere scritta a mano: l'unico modo di cambiarla è cambiare il
 * testo, che è precisamente la cosa vietata.
 */
describe("l'archivio delle dichiarazioni", () => {
  it("la versione corrente è, parola per parola, quella che la pagina compone", () => {
    const dallaPagina = [accettazioneTermini(3), DICHIARAZIONE_PROFESSIONALE].join("\n\n");
    expect(
      dichiarazioniMostrate(3).testo,
      "Il testo archiviato e quello della pagina non coincidono più.\n"
        + "Se le caselle sono state riscritte, aggiungi una versione in dichiarazioni.ts:\n"
        + "le vecchie restano, perché gli eventi già registrati le nominano ancora.",
    ).toBe(dallaPagina);
  });

  it("e porta dentro la versione dei Termini che le viene chiesta", () => {
    expect(dichiarazioniMostrate(3).testo).toContain("versione 3");
    expect(dichiarazioniMostrate(4).testo).toContain("versione 4");
    expect(dichiarazioniMostrate(4).testo).not.toContain("{versione}");
  });

  it("due versioni dei Termini sono due impronte diverse", () => {
    expect(dichiarazioniMostrate(3).impronta).not.toBe(dichiarazioniMostrate(4).impronta);
  });

  it("l'impronta è lo SHA-256 del testo, non un numero scritto accanto", () => {
    const d = dichiarazioniMostrate(3);
    expect(d.impronta).toBe(createHash("sha256").update(d.testo, "utf8").digest("hex"));
  });

  it("la versione corrente è l'ultima archiviata", () => {
    expect(VERSIONE_DICHIARAZIONI).toBe(VERSIONI_DICHIARAZIONI[VERSIONI_DICHIARAZIONI.length - 1]);
  });

  /*
    E si risale da un evento al testo: è il gesto del fascicolo di una licenza.
    Una versione che non c'è si **ferma** invece di restituire il testo di oggi
    — che sarebbe la risposta sbagliata con la faccia di quella giusta.
  */
  it("da una versione si ritrova il testo, e una versione inventata si ferma", () => {
    expect(dellaVersione(VERSIONE_DICHIARAZIONI, 3).testo).toBe(dichiarazioniMostrate(3).testo);
    expect(() => dellaVersione("1999-01-01", 3)).toThrow(/non esiste la versione/);
  });
});
