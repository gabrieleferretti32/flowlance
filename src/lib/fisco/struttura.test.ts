/**
 * Due test che leggono il codice invece dei numeri.
 *
 * Il difetto che questo progetto ha incontrato tre volte in due giorni ha
 * sempre la stessa forma: **un valore mostrato e uno calcolato che non si
 * parlano, con nessuno dei due che segnala l'altro.** L'aliquota sostitutiva
 * scritta da un interruttore e mai fatta scadere, i contributi fissi degli
 * artigiani mostrati a un commerciante, il netto del semaforo calcolato due
 * volte. Nessun test sui numeri li ha visti, perché ciascuno dei due valori,
 * preso da solo, era plausibile.
 *
 * Qui non si verifica un importo: si verifica la **forma** del codice, che è
 * l'unica cosa che quei tre difetti avevano in comune prima di diventare
 * numeri sbagliati. Sono due tagliole, non una dimostrazione: non provano che
 * i valori siano giusti, impediscono al codice di tornare nella condizione in
 * cui possono divergere senza che nessuno lo noti.
 *
 * Il rimedio vero è un registro dei valori derivati — `Derivato<T>`, con
 * origine e motivo accanto al numero — e queste due tagliole non lo
 * sostituiscono: tengono il campo pulito finché non arriva.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RADICE = "src";

/** Tutti i sorgenti dell'app, esclusi i test: un test non è un lettore. */
function sorgenti(): { percorso: string; testo: string }[] {
  const trovati: string[] = [];
  const scendi = (cartella: string) => {
    for (const voce of readdirSync(cartella, { withFileTypes: true })) {
      const p = join(cartella, voce.name);
      if (voce.isDirectory()) scendi(p);
      else if (/\.tsx?$/.test(voce.name) && !/\.test\.tsx?$/.test(voce.name)) trovati.push(p);
    }
  };
  scendi(RADICE);
  return trovati
    .sort()
    .map((p) => ({ percorso: p.replaceAll("\\", "/"), testo: senzaCommenti(readFileSync(p, "utf8")) }));
}

/**
 * Via i commenti prima di cercare.
 *
 * Questi file spiegano molto, e le spiegazioni nominano i campi di cui
 * parlano: senza toglierle, ogni campo citato in un commento risulterebbe
 * «letto» e le due tagliole non scatterebbero mai.
 */
function senzaCommenti(testo: string): string {
  return testo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/**
 * I campi di primo livello di un tipo dichiarato in `tipi.ts`.
 *
 * Lettura a occhio del sorgente, senza compilatore: basta contare le graffe
 * per non scambiare i campi di un oggetto annidato per campi del tipo.
 */
function campiDelTipo(testo: string, nome: string): string[] {
  const inizio = testo.indexOf(`export type ${nome} = {`);
  expect(inizio, `tipo ${nome} non trovato in tipi.ts`).toBeGreaterThanOrEqual(0);
  const apertura = testo.indexOf("{", inizio);
  let profondita = 0;
  let chiusura = apertura;
  for (let i = apertura; i < testo.length; i++) {
    if (testo[i] === "{") profondita++;
    else if (testo[i] === "}") {
      profondita--;
      if (profondita === 0) {
        chiusura = i;
        break;
      }
    }
  }
  const corpo = testo.slice(apertura + 1, chiusura);
  const campi: string[] = [];
  profondita = 0;
  for (const riga of corpo.split("\n")) {
    const m = profondita === 0 ? riga.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\??\s*:/) : null;
    if (m) campi.push(m[1]);
    for (const c of riga) {
      if (c === "{") profondita++;
      else if (c === "}") profondita--;
    }
  }
  return campi;
}

/**
 * Con quali nomi un file chiama le impostazioni o i parametri.
 *
 * Le convenzioni del repository sono due — `imp` e `par` nel motore,
 * `impostazioni` e `parametri` dentro `calcolo` nelle schermate — e valgono
 * dappertutto; le annotazioni esplicite si leggono comunque, così un nome
 * nuovo non fa passare inosservata una lettura.
 */
function nomiUsatiPer(testo: string, tipo: string, convenzionali: string[]): string[] {
  const nomi = new Set(convenzionali);
  const annotazione = new RegExp(`([A-Za-z_][A-Za-z0-9_]*)\\s*:\\s*${tipo}\\b`, "g");
  for (const m of testo.matchAll(annotazione)) nomi.add(m[1]);
  return [...nomi];
}

function legge(testo: string, nomi: string[], campo: string): boolean {
  return nomi.some((n) => new RegExp(`\\b${n}\\.${campo}\\b`).test(testo));
}

const TIPI = senzaCommenti(readFileSync(join(RADICE, "lib/fisco/tipi.ts"), "utf8"));
const CAMPI_IMPOSTAZIONI = campiDelTipo(TIPI, "Impostazioni");
const CAMPI_PARAMETRI = campiDelTipo(TIPI, "ParametriAnno");
const SORGENTI = sorgenti();

const nomiImpostazioni = (t: string) => nomiUsatiPer(t, "Impostazioni", ["imp", "impostazioni"]);
const nomiParametri = (t: string) => nomiUsatiPer(t, "ParametriAnno", ["par", "parametri"]);

// ————————————————————————————————————————————————————————————
// 1 · Nessun campo morto in `Impostazioni`
// ————————————————————————————————————————————————————————————

/**
 * Dove le impostazioni si **scrivono**, non si leggono.
 *
 * Dichiararle, costruirle con i valori di legge, ereditarle dall'anno prima,
 * rileggerle da un backup e riempirle in un dataset dimostrativo: cinque
 * modi di mettere un valore dentro. Un campo che compare solo qui è un campo
 * che l'app trasporta e non usa mai.
 */
const SCRITTURA = [
  "src/lib/fisco/tipi.ts",
  "src/lib/fisco/impostazioni.ts",
  "src/lib/fisco/fixture.ts",
  "src/lib/dati/backup.ts",
  "src/lib/dati/demo.ts",
  "src/lib/dati/vetrina.ts",
];

/**
 * I campi che possono legittimamente non essere letti da nessuno.
 *
 * Vuoto, e va tenuto vuoto: ogni voce qui dentro deve portare il motivo per
 * cui un campo esiste senza servire a niente. `minimaleArtigiani`,
 * `aliquotaEccedenza` e `mesiFondoEmergenza` sono finiti tolti, non esentati.
 */
const ESENTI: Record<string, string> = {};

describe("nessun campo morto in Impostazioni", () => {
  it("ogni campo è letto da almeno un modulo che non si limita a scriverlo", () => {
    const morti = CAMPI_IMPOSTAZIONI.filter((campo) => {
      if (campo in ESENTI) return false;
      return !SORGENTI.some(
        ({ percorso, testo }) =>
          !SCRITTURA.includes(percorso) && legge(testo, nomiImpostazioni(testo), campo),
      );
    });

    expect(
      morti,
      `Campi di Impostazioni che nessuno legge: ${morti.join(", ")}.\n` +
        "Un campo dichiarato, salvato nel backup e mai usato è un valore che l'utente\n" +
        "può vedersi chiedere o importare senza che cambi niente. Toglilo — oppure\n" +
        "collegalo a chi lo deve usare. Esentarlo in ESENTI è l'ultima scelta, e vuole\n" +
        "un motivo scritto.",
    ).toEqual([]);
  });
});

// ————————————————————————————————————————————————————————————
// 2 · Nessuna costante di legge letta da due fonti
// ————————————————————————————————————————————————————————————

/**
 * Le costanti di legge che vivono anche in `Impostazioni`.
 *
 * Un parametro dell'anno che ha un gemello nelle impostazioni ha **due case**,
 * e la sua copia parte da lì: chi calcola legge una casa, chi mostra legge
 * l'altra, e finché i due valori coincidono nessuno se ne accorge. Le coppie
 * con lo stesso nome si trovano da sole — così una aggiunta domani entra nel
 * test senza che nessuno se ne ricordi — e le poche che il nome non lega
 * stanno in `PARENTELE`.
 *
 * La regola è una sola: **la casa dei parametri si apre dove le impostazioni
 * si costruiscono.** Ovunque altro si legge il gemello, che è il valore su cui
 * il calcolo poi lavora.
 */
const PARENTELE: Record<string, string> = {
  sogliaUscita: "sogliaUscitaImmediata",
  aliquotaIva: "aliquotaIvaOrdinaria",
  minimaleGs: "minimaleAnnuo",
  massimaleGs: "massimaleGestioneSeparata",
  aliquotaRivalsa: "aliquotaRivalsaInps",
  // I contributi fissi stanno annidati per gestione: il gemello è la foglia.
  contributiFissi: "fissi",
};

/** I file che costruiscono impostazioni a partire dai parametri di legge. */
const COSTRUTTORI = ["src/lib/fisco/impostazioni.ts", "src/lib/dati/backup.ts"];

/**
 * Le letture del lato parametri fuori dai costruttori, con il perché.
 *
 * Sono i casi in cui il gemello non esiste ancora o non c'entra: la legge
 * detta a chi non l'ha scelta. Ogni voce va motivata; una voce nuova senza
 * motivo è il difetto che rientra dalla finestra.
 */
const LETTURE_AMMESSE: { campo: string; file: string; motivo: string }[] = [
  {
    campo: "anno",
    file: "src/lib/fisco/chiusura.ts",
    motivo:
      "È l'anno della raccolta di parametri, non quello delle impostazioni: la frase dice di quale anno le aliquote sono provvisorie.",
  },
  {
    campo: "anno",
    file: "src/components/fisco/avviso-parametri.tsx",
    motivo: "Stesso caso: l'avviso nomina l'anno dei parametri ereditati.",
  },
  {
    campo: "anno",
    file: "src/lib/fisco/stampa.ts",
    motivo:
      "Qui il confronto fra le due fonti è il punto: se l'anno dei parametri non è quello del prospetto, i numeri vengono da un altro anno e l'intestazione del documento stampato lo dice. È l'unico posto dove leggerne una sola sarebbe il difetto.",
  },
  {
    campo: "limiteForfettario",
    file: "src/lib/fisco/regime.ts",
    motivo:
      "Descrive il regime in cui l'utente non è: le sue impostazioni non contengono le soglie dell'altro regime, e leggerle da lì direbbe una cosa falsa.",
  },
  {
    campo: "aliquotaIvaOrdinaria",
    file: "src/lib/fisco/regime.ts",
    motivo: "Stesso caso del limite: è l'IVA che si troverebbe cambiando regime, non quella che applica oggi.",
  },
  {
    campo: "aliquotaRitenuta",
    file: "src/lib/fisco/regime.ts",
    motivo: "La ritenuta che comparirebbe passando all'ordinario: nel forfettario il gemello non è in uso.",
  },
  {
    campo: "importoBollo",
    file: "src/lib/fisco/regime.ts",
    motivo: "Il bollo che sparisce o torna col cambio di regime: è un fatto di legge, non un valore dell'utente.",
  },
  {
    campo: "sogliaBollo",
    file: "src/lib/fisco/regime.ts",
    motivo: "Va con l'importo del bollo, e per la stessa ragione.",
  },
  {
    campo: "aliquotaGestioneSeparata",
    file: "src/app/app/avvio/passi.tsx",
    motivo:
      "L'avvio mostra l'aliquota di ogni gestione **prima** che una gestione sia scelta: il gemello nelle impostazioni non è ancora stato deciso.",
  },
];

describe("nessuna costante di legge letta da due fonti", () => {
  const coppie = [
    ...CAMPI_IMPOSTAZIONI.filter((c) => CAMPI_PARAMETRI.includes(c)).map((c) => [c, c] as const),
    ...Object.entries(PARENTELE).map(([i, p]) => [i, p] as const),
  ];

  it("le coppie note sono tutte campi che esistono davvero", () => {
    for (const [nelleImpostazioni] of coppie) {
      expect(CAMPI_IMPOSTAZIONI, nelleImpostazioni).toContain(nelleImpostazioni);
    }
  });

  it("il lato parametri si legge solo dove le impostazioni si costruiscono", () => {
    const fuoriPosto: string[] = [];
    for (const [nelleImpostazioni, neiParametri] of coppie) {
      for (const { percorso, testo } of SORGENTI) {
        if (COSTRUTTORI.includes(percorso)) continue;
        if (!legge(testo, nomiParametri(testo), neiParametri)) continue;
        const ammessa = LETTURE_AMMESSE.some(
          (a) => a.campo === neiParametri && a.file === percorso,
        );
        if (!ammessa) fuoriPosto.push(`${percorso} legge par.${neiParametri} (gemello: imp.${nelleImpostazioni})`);
      }
    }

    expect(
      fuoriPosto,
      `Costanti di legge lette dai parametri fuori dai costruttori:\n${fuoriPosto.join("\n")}\n\n` +
        "Il calcolo lavora sul gemello in Impostazioni. Un modulo che legge il\n" +
        "parametro sta usando una seconda fonte per lo stesso numero: finché le due\n" +
        "coincidono non si vede niente, e quando divergono nessuna delle due lo dice.\n" +
        "Leggi il gemello, oppure motiva la lettura in LETTURE_AMMESSE.",
    ).toEqual([]);
  });

  it("i contributi fissi si scelgono in un posto solo", () => {
    const dove = SORGENTI.filter(({ testo }) => /\.fissi\b/.test(testo)).map((s) => s.percorso);
    expect(
      dove,
      "La scelta fra l'importo di legge e quello dichiarato sta in `contributiFissiApplicati`.\n" +
        "Era ricopiata in motore.ts, scadenze.ts e spiegazioni.ts: tre ternari identici che\n" +
        "nessuno teneva insieme.",
    ).toEqual(["src/lib/fisco/impostazioni.ts"]);
  });

  it("le letture ammesse portano tutte un motivo, e nessuna è rimasta senza uso", () => {
    for (const a of LETTURE_AMMESSE) {
      expect(a.motivo.length, `${a.file} / ${a.campo}`).toBeGreaterThan(20);
      const file = SORGENTI.find((s) => s.percorso === a.file);
      expect(file, `${a.file} non esiste più: togli la voce da LETTURE_AMMESSE`).toBeDefined();
      expect(
        legge(file!.testo, nomiParametri(file!.testo), a.campo),
        `${a.file} non legge più par.${a.campo}: togli la voce da LETTURE_AMMESSE`,
      ).toBe(true);
    }
  });
});
