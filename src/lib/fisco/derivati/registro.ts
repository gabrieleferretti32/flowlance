/**
 * Il registro dei valori derivati: uno per riga, con la sua storia.
 *
 * Motore e schermate chiedono **da qui**. Non è un posto in più da consultare:
 * è l'unico, e la sua ragione è che un valore con due strade per essere
 * ottenuto prima o poi ne prende una diversa in due punti diversi. Cinque volte
 * in due settimane, in questo progetto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Cosa entra qui dentro
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un valore entra nel registro quando **ha più di una fonte possibile**:
 *
 * - la legge lo pubblica e l'utente può scavalcarlo (i contributi fissi);
 * - il sistema lo deduce da un altro dato (l'aliquota sostitutiva, dalla data);
 * - l'app ne tiene una media finché l'utente non risponde (l'addizionale
 *   comunale);
 * - sta nei parametri dell'anno **e** in una copia dentro le impostazioni
 *   (il limite del forfettario, il massimale della Gestione Separata).
 *
 * Un valore che ha una fonte sola — l'imponibile di una fattura — non entra:
 * non può divergere da sé stesso, e metterlo qui aggiungerebbe cerimonia senza
 * togliere rischio.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché copre anche le schermate dimostrative
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le due formule del semaforo erano già divergenti fra il cruscotto e la
 * pagina del sistema visivo, e nessuno se n'era accorto perché una delle due
 * stava in una schermata che «non conta». Le schermate che non contano sono
 * quelle che nessuno controlla: è lì che i valori invecchiano. Chi disegna una
 * vetrina chiede al registro come tutti gli altri.
 */
import { aliquota, euro } from "@/lib/format";
import { eGestioneCommerciale, type Impostazioni, type ParametriAnno } from "../tipi";
import { dichiarato } from "../parametri-utente";
import type { Derivato } from "./tipi";

/**
 * Ogni voce sa **calcolarsi** e sa **dirsi**.
 *
 * `etichetta` non è un commento: è il nome con cui la voce compare a schermo,
 * e sta qui perché due schermate che chiamano la stessa cosa con due nomi
 * diversi sono il primo passo verso due valori diversi.
 */
export type VoceRegistro<T> = {
  etichetta: string;
  calcola: (imp: Impostazioni, par: ParametriAnno) => Derivato<T>;
  /**
   * I campi grezzi di cui questa voce è **padrona**.
   *
   * Un campo elencato qui non si legge da nessun'altra parte: `struttura.test.ts`
   * lo verifica sul sorgente, e la sola eccezione ammessa è chi lo *scrive*.
   * È il pezzo che rende il registro l'unica fonte per costruzione invece che
   * per buona volontà — senza, sarebbe un posto in più dove chiedere, non
   * l'unico.
   *
   * Vuoto per le voci che non decidono niente e stanno qui solo per avere la
   * loro frase: il limite del forfettario è quello e basta, e vietarne la
   * lettura sarebbe cerimonia in dieci file senza togliere un rischio.
   */
  possiede: readonly string[];
};

// ————————————————————————————————————————————————————————————
// Le voci
// ————————————————————————————————————————————————————————————

/**
 * L'aliquota sostitutiva del forfettario: **derivata, non dichiarata**.
 *
 * L'app la data di apertura ce l'ha e l'anno d'imposta pure: contare cinque
 * anni è un conto che sa fare. Chiederlo all'utente significava chiedergli di
 * dichiarare una cosa deducibile — e infatti il campo c'era, lo scriveva un
 * interruttore, e nessuno lo faceva scadere: **dieci punti di aliquota
 * sbagliati su un documento che va dal commercialista**.
 *
 * Quello che l'utente dichiara resta l'unica cosa che una data non dice: se
 * l'attività ha i requisiti di novità. È un fatto, non un'aliquota.
 *
 * Senza data l'agevolazione non si applica: è la direzione giusta in cui
 * sbagliare, perché pagare meno e scoprirlo dopo è il modo peggiore.
 */
const aliquotaSostitutiva: VoceRegistro<number> = {
  etichetta: "Imposta sostitutiva",
  /*
    Il difetto peggiore che il progetto abbia avuto: il motore moltiplicava
    l'imponibile per un campo scritto da un interruttore, e chi l'aveva acceso
    restava al 5 % al sesto anno. Nessuno deve poter moltiplicare per queste
    due aliquote fuori da qui.
  */
  possiede: ["aliquotaSostitutiva", "aliquotaSostitutivaNuovaAttivita"],
  calcola: (imp, par) => {
    const ordinaria = par.aliquotaSostitutiva;
    const agevolata = par.aliquotaSostitutivaNuovaAttivita;
    const diLegge = (v: number, motivo: string): Derivato<number> => ({
      valore: v,
      origine: { tipo: "legge", anno: par.anno },
      motivo,
      scavalcato: false,
    });

    if (!imp.nuovaAttivita) {
      return diLegge(
        ordinaria,
        `${aliquota(ordinaria)}: l'attività non è dichiarata nuova ai fini dell'agevolazione.`,
      );
    }
    if (!imp.dataAperturaPiva) {
      return diLegge(
        ordinaria,
        `${aliquota(ordinaria)}: manca la data di apertura della partita IVA, e senza quella i cinque anni non si contano. Scrivila nel profilo e l'aliquota si aggiorna da sola.`,
      );
    }

    const annoApertura = Number(imp.dataAperturaPiva.slice(0, 4));
    const trascorsi = imp.anno - annoApertura;
    // Il primo anno è quello dell'apertura: chi apre nel 2021 è agevolato dal
    // 2021 al 2025, e il 2026 è il sesto.
    const quale = trascorsi + 1;

    if (trascorsi < par.anniNuovaAttivita) {
      return {
        valore: agevolata,
        origine: { tipo: "dedotto", da: "la data di apertura della partita IVA" },
        agevolata: true,
        motivo: `${aliquota(agevolata)}: hai aperto nel ${annoApertura}, quindi il ${imp.anno} è il ${quale}° dei ${par.anniNuovaAttivita} anni agevolati.`,
        scavalcato: false,
      };
    }
    return {
      valore: ordinaria,
      origine: { tipo: "dedotto", da: "la data di apertura della partita IVA" },
      motivo: `${aliquota(ordinaria)}: hai aperto nel ${annoApertura}, quindi il ${imp.anno} è il ${quale}° anno e i ${par.anniNuovaAttivita} agevolati sono passati.`,
      scavalcato: false,
    };
  },
};

/**
 * I contributi fissi di artigiani e commercianti.
 *
 * L'importo di legge della **sua** gestione, salvo che l'utente ne abbia
 * dichiarato uno suo. Le due gestioni versano cifre diverse — i commercianti
 * lo 0,48 % in più per l'indennizzo di cessazione — e per un periodo la
 * schermata mostrava quella degli artigiani a un commerciante mentre il motore
 * usava l'altra.
 *
 * Si scavalca nei casi agevolati, che l'app non può indovinare: la riduzione
 * del 35 % dei forfettari, il 50 % di chi ha più di 65 anni ed è già
 * pensionato, il 50 % dei nuovi iscritti.
 */
const contributiFissi: VoceRegistro<number | null> = {
  etichetta: "Contributi fissi",
  possiede: ["contributiFissi"],
  calcola: (imp, par) => {
    /*
      `null` e non `0`: sono due cose diverse, e in un'app fiscale la
      differenza è tutta. Zero euro è un importo — «quest'anno non ne devi» —
      mentre qui la voce non esiste proprio: chi versa alla Gestione Separata
      non ha contributi fissi da nessuna parte, e una riga «0,00 €» in un
      prospetto sarebbe una risposta a una domanda che non è stata fatta. È la
      stessa scelta di `tariffaOraria`, che resta `null` finché non si dichiara
      invece di partire da un numero inventato.
    */
    if (!eGestioneCommerciale(imp.gestione)) {
      return {
        valore: null,
        origine: { tipo: "dedotto", da: "la gestione previdenziale scelta" },
        motivo:
          "Non si applica: i contributi fissi si versano solo in gestione artigiani o commercianti.",
        scavalcato: false,
      };
    }
    const nome = imp.gestione === "artigiani" ? "gli artigiani" : "i commercianti";
    if (dichiarato(imp, "contributiFissi")) {
      return {
        valore: imp.contributiFissi,
        origine: { tipo: "dichiarato", campo: "contributiFissi" },
        motivo: `${euro(imp.contributiFissi)}: il valore che hai dichiarato, al posto di ${euro(par.artigianiCommercianti[imp.gestione].fissi)} che l'INPS pubblica per ${nome}.`,
        scavalcato: true,
      };
    }
    const diLegge = par.artigianiCommercianti[imp.gestione].fissi;
    return {
      valore: diLegge,
      origine: { tipo: "legge", anno: par.anno },
      motivo: `${euro(diLegge)}: l'importo che l'INPS pubblica per ${nome} nel ${par.anno}. Si scavalca dai Parametri se hai diritto a una riduzione.`,
      scavalcato: false,
    };
  },
};

/**
 * Il limite di ricavi del forfettario, e la soglia di uscita immediata.
 *
 * Stanno nei parametri dell'anno **e** in una copia dentro le impostazioni,
 * scritta alla creazione dell'anno. Finché nessuno tocca quella copia i due
 * numeri coincidono — ma `messaggioSoglia` citava l'una mentre la decisione era
 * presa sull'altra, e per undici mesi l'app avrebbe potuto spiegare una scelta
 * con un numero che non l'aveva presa.
 */
const limiteForfettario: VoceRegistro<number> = {
  etichetta: "Limite di ricavi del regime",
  // Non possiede niente: il valore è uno solo, e sta qui per la sua frase.
  possiede: [],
  calcola: (imp, par) => ({
    valore: imp.limiteForfettario,
    origine: { tipo: "legge", anno: par.anno },
    motivo: `${euro(imp.limiteForfettario)}: il limite di ricavi del forfettario per il ${imp.anno}.`,
    scavalcato: false,
  }),
};

const sogliaUscita: VoceRegistro<number> = {
  etichetta: "Soglia di uscita immediata",
  possiede: [],
  calcola: (imp) => ({
    valore: imp.sogliaUscita,
    origine: { tipo: "legge", anno: imp.anno },
    motivo: `${euro(imp.sogliaUscita)}: superata questa soglia si esce dal forfettario nello stesso anno, non dal 1° gennaio successivo.`,
    scavalcato: false,
  }),
};

/**
 * Le due addizionali: dichiarate dall'utente, o una media dell'app.
 *
 * L'app non può conoscerle — sono ottomila comuni che cambiano ogni anno — e
 * un valore predefinito presentato come «la tua aliquota» è la bugia da cui
 * nasce tutto il modulo dei parametri utente. Qui la differenza è
 * nell'`origine`: `media` non è difendibile, e blocca l'export del prospetto.
 */
function addizionale(
  campo: "addizionaleRegionale" | "addizionaleComunale",
  /*
    La lettura è esplicita, non `imp[campo]`, e non è pignoleria.

    Le tagliole di `struttura.test.ts` leggono il **sorgente**: cercano
    `imp.addizionaleRegionale` come testo. Un accesso calcolato è invisibile a
    quel controllo — la prima tagliola dichiarava questi due campi morti, e la
    terza non avrebbe visto una lettura scritta così in un file qualunque.
    Scrivendola per esteso, quello che il codice fa e quello che i test vedono
    tornano a essere la stessa cosa.
  */
  leggi: (imp: Impostazioni) => number,
  etichetta: string,
  dove: string,
): VoceRegistro<number> {
  return {
    etichetta,
    /*
      L'aliquota grezza non si legge fuori di qui: la differenza fra un valore
      dichiarato e una media dell'app decide se il prospetto si può esportare,
      e chi legge il campo e basta non la vede.
    */
    possiede: [campo],
    calcola: (imp) => {
      const valore = leggi(imp);
      if (dichiarato(imp, campo)) {
        const luogo = campo === "addizionaleRegionale" ? imp.regione : imp.comune;
        return {
          valore,
          origine: { tipo: "dichiarato", campo },
          motivo: `${aliquota(valore)}: l'aliquota che hai dichiarato${luogo ? ` per ${luogo}` : ""}.`,
          scavalcato: false,
        };
      }
      return {
        valore,
        origine: { tipo: "media" },
        motivo: `${aliquota(valore)}: una media dell'app, non la tua. ${dove}`,
        scavalcato: false,
      };
    },
  };
}

// ————————————————————————————————————————————————————————————
// Il registro
// ————————————————————————————————————————————————————————————

export const DERIVATI = {
  aliquotaSostitutiva,
  contributiFissi,
  limiteForfettario,
  sogliaUscita,
  addizionaleRegionale: addizionale(
    "addizionaleRegionale",
    (imp) => imp.addizionaleRegionale,
    "Addizionale regionale IRPEF",
    "La tua sta nella delibera della regione, o sul cedolino se hai anche un lavoro dipendente.",
  ),
  addizionaleComunale: addizionale(
    "addizionaleComunale",
    (imp) => imp.addizionaleComunale,
    "Addizionale comunale IRPEF",
    "La tua sta sul sito del comune, alla voce «addizionale IRPEF».",
  ),
} as const;

export type NomeDerivato = keyof typeof DERIVATI;

/**
 * L'agevolazione dei primi cinque anni è in corso?
 *
 * Si legge dall'origine invece di essere un campo del tipo generale:
 * `Derivato<T>` descrive **da dove viene** un valore, e «è agevolato» è una
 * proprietà di questa voce sola. Un campo booleano per ogni particolarità di
 * ogni voce avrebbe fatto del tipo comune un sacco.
 */
export function sostitutivaAgevolata(imp: Impostazioni, par: ParametriAnno): boolean {
  return derivato("aliquotaSostitutiva", imp, par).valore === par.aliquotaSostitutivaNuovaAttivita
    && par.aliquotaSostitutivaNuovaAttivita !== par.aliquotaSostitutiva;
}

/**
 * Il valore, con la sua storia. **L'unico modo di ottenerlo.**
 *
 * Motore e schermate passano da qui, e per questo non esiste più un «valore
 * mostrato» separato da un «valore usato»: sono lo stesso.
 */
export function derivato<N extends NomeDerivato>(
  nome: N,
  imp: Impostazioni,
  par: ParametriAnno,
): ReturnType<(typeof DERIVATI)[N]["calcola"]> {
  return DERIVATI[nome].calcola(imp, par) as ReturnType<(typeof DERIVATI)[N]["calcola"]>;
}

export const NOMI_DERIVATI = Object.keys(DERIVATI) as NomeDerivato[];
