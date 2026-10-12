/**
 * Il poco di Brevo che serve alla pulizia, dietro un'interfaccia.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché un'interfaccia e non quattro `fetch` sparsi
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Questa è la parte del prodotto che **cancella i dati di qualcuno**. Un
 * errore qui non si vede: non produce una schermata sbagliata, produce
 * un'assenza — un contatto sparito, o rimasto quando doveva sparire. L'unico
 * modo di provarla è farla girare contro un Brevo finto, e perché un Brevo
 * finto sia possibile serve che la pulizia parli a un'interfaccia e non alla
 * rete.
 *
 * Qui dentro non c'è nessuna decisione: solo le quattro operazioni. Chi decide
 * è `pulizia.ts`, che di rete non sa niente.
 */

/** Un contatto, come lo restituisce Brevo, ridotto a quello che qui si guarda. */
export type ContattoBrevo = {
  id: number;
  email: string;
  /** Le liste a cui appartiene. Vuoto vuol dire «in nessuna». */
  listIds: number[];
  attributes: Record<string, string | number | null | undefined>;
  /** Quando il contatto è nato, ISO con l'ora. */
  createdAt: string;
  modifiedAt: string;
};

export interface ClientBrevo {
  /**
   * Tutti i contatti, a pagine.
   *
   * A pagine e non in blocco: la pulizia gira ogni notte su un archivio che
   * cresce, e un endpoint che restituisce tutto in una volta è quello che
   * smette di funzionare al millesimo contatto — di notte, senza che nessuno
   * guardi.
   */
  elencaContatti(offset: number, limite: number): Promise<ContattoBrevo[]>;
  /** Scrive gli attributi indicati. Una stringa vuota svuota il valore. */
  aggiornaAttributi(email: string, attributi: Record<string, string>): Promise<void>;
  /** Toglie il contatto da una lista. Resta in archivio e nelle altre liste. */
  togliDaLista(email: string, lista: number): Promise<void>;
  /** Cancella il contatto. Non si disfa. */
  cancellaContatto(email: string): Promise<void>;
}

const BASE = "https://api.brevo.com/v3";

/**
 * Il client vero.
 *
 * Non ha nessuna rete di sicurezza propria: se Brevo risponde male, lancia.
 * È voluto — chi chiama (`pulizia-server.ts`) conta gli errori e continua con
 * il contatto successivo, perché una pulizia che si ferma al primo intoppo
 * lascia indietro tutto il resto e nessuno lo sa fino al giorno dopo.
 */
export function clientBrevo(chiave: string, eseguiFetch: typeof globalThis.fetch): ClientBrevo {
  async function chiama(percorso: string, opzioni: RequestInit = {}): Promise<Response> {
    const risposta = await eseguiFetch(`${BASE}${percorso}`, {
      ...opzioni,
      headers: {
        "api-key": chiave,
        "content-type": "application/json",
        accept: "application/json",
        ...(opzioni.headers ?? {}),
      },
    });
    if (!risposta.ok) {
      const dettaglio = await risposta.text().catch(() => "");
      throw new Error(`Brevo ${risposta.status} su ${percorso}: ${dettaglio.slice(0, 300)}`);
    }
    return risposta;
  }

  const comeIndirizzo = (email: string) => encodeURIComponent(email);

  return {
    async elencaContatti(offset, limite) {
      const risposta = await chiama(`/contacts?limit=${limite}&offset=${offset}`);
      const corpo: unknown = await risposta.json();
      const righe = (corpo as { contacts?: unknown }).contacts;
      if (!Array.isArray(righe)) return [];
      return righe.map((r) => {
        const c = r as Partial<ContattoBrevo> & { listIds?: unknown };
        return {
          id: Number(c.id ?? 0),
          email: String(c.email ?? ""),
          listIds: Array.isArray(c.listIds) ? c.listIds.map(Number) : [],
          attributes: (c.attributes ?? {}) as ContattoBrevo["attributes"],
          createdAt: String(c.createdAt ?? ""),
          modifiedAt: String(c.modifiedAt ?? ""),
        };
      });
    },

    async aggiornaAttributi(email, attributi) {
      await chiama(`/contacts/${comeIndirizzo(email)}`, {
        method: "PUT",
        body: JSON.stringify({ attributes: attributi }),
      });
    },

    async togliDaLista(email, lista) {
      await chiama(`/contacts/lists/${lista}/contacts/remove`, {
        method: "POST",
        body: JSON.stringify({ emails: [email] }),
      });
    },

    async cancellaContatto(email) {
      await chiama(`/contacts/${comeIndirizzo(email)}`, { method: "DELETE" });
    },
  };
}
