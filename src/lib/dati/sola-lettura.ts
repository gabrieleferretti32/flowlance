/**
 * La sola lettura, applicata dove non si può dimenticare.
 *
 * A licenza scaduta l'app si vede tutta e non si scrive niente. L'interfaccia
 * lo dichiara — pulsanti spenti, celle non modificabili — ma l'interfaccia si
 * dimentica: basta una schermata nuova che chiami `archivio().fatture.salva()`
 * e il vincolo è saltato senza che nessuno se ne accorga. Qui invece passa
 * ogni scrittura, perché passa dall'adapter.
 *
 * Cosa **non** blocca, e non deve bloccare mai: `leggiTutto()`. È da lì che
 * esce il backup, e l'esportazione dei dati resta possibile in ogni stato
 * della licenza. I dati dell'utente non sono in ostaggio.
 */
import { depositiDi, type Deposito, type StorageAdapter } from "./adapter";
import type { NomeCollezione } from "./tipi";

export class ErroreSolaLettura extends Error {
  constructor(operazione: string) {
    super(
      `Licenza scaduta: l'app è in sola lettura e «${operazione}» non è consentita. ` +
        "L'esportazione dei dati resta attiva.",
    );
    this.name = "ErroreSolaLettura";
  }
}

/**
 * Avvolge un adapter: le letture passano, le scritture no.
 *
 * @param bloccato interrogato a ogni chiamata, non una volta sola: la licenza
 * può scadere mentre l'app è aperta, e un adapter deciso al primo avvio
 * resterebbe scrivibile fino al ricaricamento della pagina.
 */
export function conSolaLettura(
  base: StorageAdapter,
  bloccato: () => boolean,
): StorageAdapter {
  const depositi = depositiDi(base);
  const protetti = {} as Record<NomeCollezione, Deposito<never, never>>;
  for (const nome of Object.keys(depositi) as NomeCollezione[]) {
    protetti[nome] = depositoProtetto(depositi[nome], nome, bloccato);
  }

  return {
    ...protetti,
    importazioni: depositoProtetto(base.importazioni, "importazioni", bloccato),
    /*
      NON protetta, ed è una scelta rivista.
      L'istantanea è l'archivio dell'utente com'era un istante prima di essere
      sostituito. Bloccarla a licenza scaduta significa: vedi scritto «i tuoi
      dati di prima sono ancora qui», il pulsante è spento, e l'unica cosa che
      puoi esportare è l'archivio sbagliato. Rimettere i propri dati dove
      stavano non è inserirne di nuovi, e nemmeno cancellarli è una scrittura
      che valga la pena impedire: è l'utente che rinuncia a una sua copia.
    */
    istantanee: base.istantanee,
    get nome() {
      return base.nome;
    },
    leggiTutto: () => base.leggiTutto(),
    vuoto: () => base.vuoto(),
    scriviTutto: (dati, modalita) =>
      bloccato()
        ? Promise.reject(new ErroreSolaLettura("importare un backup"))
        : base.scriviTutto(dati, modalita),
    // Passa sempre: è la stessa scrittura, ma di dati che erano già in questo
    // archivio. Vedi `StorageAdapter.ripristina`.
    ripristina: (dati) => base.ripristina(dati),
    svuota: () =>
      bloccato() ? Promise.reject(new ErroreSolaLettura("svuotare l'archivio")) : base.svuota(),
  } as StorageAdapter;
}

/**
 * Le quattro scritture, elencate a mano.
 *
 * Un ciclo sui nomi dei metodi sembrerebbe più corto, ma perderebbe i tipi: e
 * un `Deposito` con le firme sfocate è esattamente il posto in cui, fra sei
 * mesi, un metodo nuovo passa il controllo senza che il compilatore fiati.
 * Così invece aggiungere un metodo di scrittura a `Deposito` rompe qui.
 */
function depositoProtetto<T, K extends string | number>(
  deposito: Deposito<T, K>,
  nome: string,
  bloccato: () => boolean,
): Deposito<T, K> {
  // La guardia *rifiuta* la promessa invece di lanciare in modo sincrono: chi
  // chiama scrive `void archivio().fatture.salva(x)` dentro un gestore di
  // eventi, e un'eccezione sincrona lì dentro fa esplodere il render invece di
  // arrivare a un messaggio. Rifiutare è anche il contratto giusto per
  // un'interfaccia che è già tutta asincrona.
  const rifiuto = <R,>(operazione: string): Promise<R> =>
    Promise.reject(new ErroreSolaLettura(`${operazione} in ${nome}`));

  return {
    tutti: () => deposito.tutti(),
    leggi: (chiave) => deposito.leggi(chiave),
    conta: () => deposito.conta(),
    salva: (valore) => (bloccato() ? rifiuto("salvare") : deposito.salva(valore)),
    salvaMolti: (valori) => (bloccato() ? rifiuto("salvare") : deposito.salvaMolti(valori)),
    elimina: (chiave) => (bloccato() ? rifiuto("eliminare") : deposito.elimina(chiave)),
    eliminaMolti: (chiavi) =>
      bloccato() ? rifiuto("eliminare") : deposito.eliminaMolti(chiavi),
  };
}
