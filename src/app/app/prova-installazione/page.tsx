"use client";

/**
 * Prova di installazione: **gli stessi dati, o due archivi diversi?**
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché una pagina e non uno snippet da console
 * ─────────────────────────────────────────────────────────────────────────
 *
 * La domanda a cui questa pagina risponde si può fare solo **da dentro
 * l'app installata**, ed è esattamente il posto in cui una console non c'è:
 * su iPhone non esiste, su Android dentro una finestra installata nemmeno.
 * Uno snippet risponderebbe solo per i due percorsi facili — Chrome e Safari
 * sul Mac — cioè i due su cui non c'è niente da scoprire.
 *
 * Deve anche stare **sotto `/app/`**, che è lo `scope` del manifest: una
 * pagina fuori dallo scope, aperta dall'app installata, rimbalzerebbe nel
 * browser, e la prova misurerebbe il contesto sbagliato senza dirlo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché un segno, e non «guarda se l'archivio è vuoto»
 * ─────────────────────────────────────────────────────────────────────────
 *
 * «L'archivio è vuoto» non distingue due cose molto diverse: un archivio
 * separato, e un archivio che è vuoto perché su quel dispositivo non ci hai
 * mai lavorato. La prova quindi non guarda il vuoto: scrive **un segno** da
 * una parte e va a cercarlo dall'altra.
 *
 * Il segno ha una sua base dati, `flowlance-prova-installazione`, e non tocca
 * l'archivio vero nemmeno per leggerlo: una diagnosi che scrive dentro la cosa
 * che sta diagnosticando è una diagnosi che cambia il risultato.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Questa pagina è temporanea
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Serve a rispondere a una domanda sola, una volta, su quattro dispositivi.
 * Quando la risposta c'è, si cancella la cartella e finisce lì: non è una
 * schermata del prodotto, non sta in nessun menù, e lasciarla in giro
 * vorrebbe dire una pagina che nessuno mantiene dentro un'app che si vende.
 */
import * as React from "react";

/** Dove vive il segno: una base dati sua, che non è l'archivio. */
const BASE_SEGNO = "flowlance-prova-installazione";
const DEPOSITO = "segno";
/** L'archivio vero. Il nome è quello originale, e non si tocca. */
const BASE_ARCHIVIO = "freelance-finance-os";
/** Le chiavi che l'app tiene in localStorage. Si guarda se ci sono, mai cosa contengono. */
const CHIAVI = ["flowlance-licenza", "flowlance-backup", "ffos-preferenze", "flowlance:consenso-cookie"];

type Segno = { quando: string; dove: string; agente: string };

type Lettura = {
  dove: string;
  installata: boolean;
  segno: Segno | null;
  segnoLocale: Segno | null;
  archivio: { deposito: string; quanti: number }[] | null;
  chiavi: { nome: string; presente: boolean }[];
};

/** Apre una base dati senza crearla, e dice se non c'era. */
function apri(nome: string, crea?: (db: IDBDatabase) => void): Promise<IDBDatabase | null> {
  return new Promise((risolvi) => {
    let mancava = false;
    const richiesta = crea ? indexedDB.open(nome, 1) : indexedDB.open(nome);
    richiesta.onupgradeneeded = () => {
      mancava = true;
      if (crea) crea(richiesta.result);
    };
    richiesta.onsuccess = () => {
      if (mancava && !crea) {
        // Non c'era, e aprirla l'ha creata: la si rimette com'era.
        richiesta.result.close();
        indexedDB.deleteDatabase(nome);
        risolvi(null);
        return;
      }
      risolvi(richiesta.result);
    };
    richiesta.onerror = () => risolvi(null);
    richiesta.onblocked = () => risolvi(null);
  });
}

async function leggiSegno(): Promise<Segno | null> {
  const db = await apri(BASE_SEGNO);
  if (!db) return null;
  if (!db.objectStoreNames.contains(DEPOSITO)) {
    db.close();
    return null;
  }
  return new Promise((risolvi) => {
    const richiesta = db.transaction(DEPOSITO, "readonly").objectStore(DEPOSITO).get("unico");
    richiesta.onsuccess = () => {
      risolvi((richiesta.result as Segno | undefined) ?? null);
      db.close();
    };
    richiesta.onerror = () => {
      risolvi(null);
      db.close();
    };
  });
}

async function scriviSegno(segno: Segno): Promise<void> {
  const db = await apri(BASE_SEGNO, (d) => d.createObjectStore(DEPOSITO));
  if (!db) return;
  await new Promise((risolvi) => {
    const t = db.transaction(DEPOSITO, "readwrite");
    t.objectStore(DEPOSITO).put(segno, "unico");
    t.oncomplete = () => risolvi(null);
    t.onerror = () => risolvi(null);
  });
  db.close();
  try {
    localStorage.setItem(`${BASE_SEGNO}`, JSON.stringify(segno));
  } catch {
    // localStorage può essere negato: non è un motivo per fermare la prova.
  }
}

async function contaArchivio(): Promise<{ deposito: string; quanti: number }[] | null> {
  const db = await apri(BASE_ARCHIVIO);
  if (!db) return null;
  const depositi = [...db.objectStoreNames].filter((n) =>
    ["fatture", "costi", "versamenti", "pfMovimenti"].includes(n),
  );
  if (depositi.length === 0) {
    db.close();
    return [];
  }
  const conti = await Promise.all(
    depositi.map(
      (deposito) =>
        new Promise<{ deposito: string; quanti: number }>((risolvi) => {
          const r = db.transaction(deposito, "readonly").objectStore(deposito).count();
          r.onsuccess = () => risolvi({ deposito, quanti: r.result });
          r.onerror = () => risolvi({ deposito, quanti: -1 });
        }),
    ),
  );
  db.close();
  return conti;
}

/*
  «Finestra installata» si riconosce in due modi perché i due sistemi non
  usano lo stesso: `display-mode: standalone` è lo standard, `navigator
  .standalone` è quello che iOS ha sempre avuto e che ancora risponde.
*/
function dentroUnaFinestraInstallata(): boolean {
  const standard = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const iOS = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standard || iOS;
}

async function misura(): Promise<Lettura> {
  const installata = dentroUnaFinestraInstallata();
  let segnoLocale: Segno | null = null;
  try {
    const grezzo = localStorage.getItem(BASE_SEGNO);
    segnoLocale = grezzo ? (JSON.parse(grezzo) as Segno) : null;
  } catch {
    segnoLocale = null;
  }
  return {
    dove: installata ? "finestra installata" : "scheda del browser",
    installata,
    segno: await leggiSegno(),
    segnoLocale,
    archivio: await contaArchivio(),
    chiavi: CHIAVI.map((nome) => ({
      nome,
      presente: (() => {
        try {
          return localStorage.getItem(nome) !== null;
        } catch {
          return false;
        }
      })(),
    })),
  };
}

export default function ProvaInstallazione() {
  const [lettura, setLettura] = React.useState<Lettura | null>(null);
  const [inCorso, setInCorso] = React.useState(false);

  const aggiorna = React.useCallback(() => {
    void misura().then(setLettura);
  }, []);

  React.useEffect(() => aggiorna(), [aggiorna]);

  if (!lettura) {
    return (
      <main className="mx-auto max-w-[44rem] px-5 py-10">
        <p className="text-corpo">Sto guardando…</p>
      </main>
    );
  }

  const segno = lettura.segno ?? lettura.segnoLocale;
  const daAltrove = segno !== null && segno.dove !== lettura.dove;

  /*
    Il verdetto in chiaro, e con la sola cosa che lo rende non ambiguo: il
    segno scritto **dall'altra parte**. Un segno scritto qui non dice niente
    su dove stanno i dati — dice solo che questa pagina sa scrivere.
  */
  const verdetto = daAltrove
    ? {
        titolo: "STESSI DATI",
        testo:
          `Il segno era stato scritto dalla ${segno!.dove} e da qui si vede. `
          + "I due modi di aprire Flowlance usano lo stesso archivio: installare è sicuro.",
        colore: "bg-positivo-tenue text-inchiostro",
      }
    : segno !== null
      ? {
          titolo: "ANCORA NIENTE DA DIRE",
          testo:
            `Il segno che vedo l'ho scritto io stesso, dalla ${segno.dove}. `
            + "Per avere una risposta devi guardarlo dall'altra parte: se sei nel browser, installa l'app e riapri questa pagina da lì.",
          colore: "bg-superficie-alt text-inchiostro",
        }
      : {
          titolo: "NESSUN SEGNO QUI",
          testo:
            "Se l'hai scritto dall'altra parte e da qui non si vede, i due archivi sono SEPARATI: "
            + "installare creerebbe un secondo Flowlance che diverge da quello del browser. "
            + "Se invece non l'hai ancora scritto, premi il pulsante qui sotto e poi guarda dall'altra parte.",
          colore: "bg-attenzione-tenue text-inchiostro",
        };

  const righe: [string, string][] = [
    ["Sto girando in", lettura.dove],
    [
      "Il segno",
      segno
        ? `scritto il ${new Date(segno.quando).toLocaleString("it-IT")} dalla ${segno.dove}`
        : "non c'è",
    ],
    [
      "L'archivio di Flowlance",
      lettura.archivio === null
        ? "non esiste su questo dispositivo"
        : lettura.archivio.length === 0
          ? "esiste ma è appena stato creato, e non ha ancora niente dentro"
          : lettura.archivio.map((a) => `${a.deposito}: ${a.quanti}`).join(" · "),
    ],
    [
      "La chiave di licenza",
      lettura.chiavi.find((c) => c.nome === "flowlance-licenza")?.presente ? "c'è" : "non c'è",
    ],
  ];

  return (
    <main className="mx-auto max-w-[44rem] px-5 py-10">
      <h1 className="font-display text-kpi font-semibold tracking-tight">Prova di installazione</h1>
      <p className="mt-2 text-corpo text-inchiostro-tenue">
        Serve a sapere una cosa sola: se l&apos;app installata e il browser usano lo stesso
        archivio, o due archivi diversi.
      </p>

      <div className={`mt-6 rounded-campo px-5 py-4 ${verdetto.colore}`}>
        <p className="text-etichetta font-bold tracking-wide">{verdetto.titolo}</p>
        <p className="mt-1.5 text-corpo leading-relaxed">{verdetto.testo}</p>
      </div>

      <dl className="mt-6 divide-y divide-bordo border-y border-bordo">
        {righe.map(([che, cosa]) => (
          <div key={che} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
            <dt className="text-etichetta text-inchiostro-tenue">{che}</dt>
            <dd className="text-corpo">{cosa}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={inCorso}
          onClick={() => {
            setInCorso(true);
            void scriviSegno({
              quando: new Date().toISOString(),
              dove: lettura.dove,
              agente: navigator.userAgent.slice(0, 120),
            }).then(() => {
              setInCorso(false);
              aggiorna();
            });
          }}
          className="rounded-campo bg-accento px-4 py-2.5 text-corpo font-medium text-white disabled:opacity-60"
        >
          Scrivi il segno qui
        </button>
        <button
          type="button"
          onClick={() => {
            indexedDB.deleteDatabase(BASE_SEGNO);
            try {
              localStorage.removeItem(BASE_SEGNO);
            } catch {
              // niente da fare, e niente da dire
            }
            setTimeout(aggiorna, 300);
          }}
          className="rounded-campo border border-bordo px-4 py-2.5 text-corpo font-medium"
        >
          Cancella il segno
        </button>
      </div>

      <section className="mt-8 rounded-campo bg-superficie-alt px-5 py-4">
        <h2 className="text-etichetta font-semibold">L&apos;ordine giusto</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-corpo leading-relaxed">
          <li>Apri questa pagina <strong>nel browser</strong> e premi «Scrivi il segno qui».</li>
          <li>Installa Flowlance.</li>
          <li>Apri questa pagina <strong>dentro l&apos;app installata</strong> e leggi il verdetto.</li>
        </ol>
        <p className="mt-3 text-micro text-inchiostro-tenue">
          Il segno vive in una base dati sua e non tocca l&apos;archivio. «Cancella il segno» lo
          toglie da questo contesto soltanto: per rifare la prova va cancellato da tutti e due.
        </p>
      </section>
    </main>
  );
}
