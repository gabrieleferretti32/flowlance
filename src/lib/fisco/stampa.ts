/**
 * Il prospetto fiscale nella forma in cui esce dall'app.
 *
 * Questo documento è quello che l'utente allega a un'email al commercialista:
 * deve reggere da solo, senza l'app intorno che lo spieghi. Perciò porta con sé
 * chi è, che anno è, con quali parametri di legge è stato calcolato e da dove
 * vengono quei parametri — e dichiara in chiaro di essere una stima gestionale,
 * non una dichiarazione.
 *
 * Modulo puro: il modello del documento si costruisce e si verifica qui, la
 * pagina lo impagina soltanto. Un prospetto che finisce dal commercialista con
 * un numero sbagliato non lo corregge nessuno.
 */
import { dataEstesa, euro, interoIt, percentuale } from "@/lib/format";
import { esportazioneProspettoConsentita, type EsitoEsportazione } from "./chiusura";
import { prospettoDettagliato, type SezioneProspetto } from "./spiegazioni";
import { nomeRegione } from "./regioni";
import type { Prospetto } from "./motore";
import type { Impostazioni, ParametriAnno } from "./tipi";

export type VoceIntestazione = { etichetta: string; valore: string };

export type BloccoSintesi = {
  etichetta: string;
  valore: string;
  nota?: string;
};

export type DocumentoProspetto = {
  titolo: string;
  /** Nome di chi lo emette, o un segnaposto onesto se non è stato impostato. */
  intestatario: string;
  anno: number;
  /** Data di emissione del documento, in ISO. Iniettata: il modulo resta puro. */
  emessoIl: string;
  /** Dati identificativi e periodo. */
  identificazione: VoceIntestazione[];
  /** Regime e parametri di legge applicati, con le fonti. */
  parametri: VoceIntestazione[];
  fonti: string[];
  /** I quattro numeri che si leggono per primi. */
  sintesi: BloccoSintesi[];
  /** La catena di calcolo, sezione per sezione e riga per riga. */
  sezioni: SezioneProspetto[];
  nota: string;
};

export const NOTA_GESTIONALE =
  "Prospetto gestionale di stima, prodotto da Flowlance a partire dai documenti registrati dall'utente. " +
  "Non è una dichiarazione dei redditi né un documento fiscale: non considera redditi diversi da quelli " +
  "dell'attività, che in regime ordinario concorrono a formare il reddito complessivo e possono spostare " +
  "lo scaglione IRPEF. Gli importi seguono il principio di cassa per le imposte e la data del documento " +
  "per l'IVA. I numeri definitivi restano quelli del commercialista.";

function nomeGestione(g: Impostazioni["gestione"]): string {
  if (g === "separata") return "Gestione Separata INPS";
  if (g === "artigiani") return "Artigiani e commercianti";
  return "Cassa professionale";
}

/**
 * Costruisce il documento.
 *
 * @param emessoIl data di emissione, iniettata perché il documento sia
 * riproducibile: due stampe degli stessi dati devono differire solo per questa.
 */
export function documentoProspetto(
  p: Prospetto,
  imp: Impostazioni,
  par: ParametriAnno,
  emessoIl: string,
): DocumentoProspetto {
  const forfettario = imp.regime === "forfettario";

  const identificazione: VoceIntestazione[] = [
    { etichetta: "Intestatario", valore: imp.nome?.trim() || "Non impostato" },
    { etichetta: "Anno d'imposta", valore: String(p.anno) },
    {
      etichetta: "Apertura partita IVA",
      valore: imp.dataAperturaPiva ? dataEstesa(imp.dataAperturaPiva) : "Non impostata",
    },
    { etichetta: "Documento emesso il", valore: dataEstesa(emessoIl) },
  ];

  const parametri: VoceIntestazione[] = [
    { etichetta: "Regime fiscale", valore: forfettario ? "Forfettario" : "Ordinario" },
  ];
  if (forfettario) {
    parametri.push(
      {
        etichetta: "Coefficiente di redditività",
        valore: percentuale(imp.coefficienteRedditivita),
      },
      {
        etichetta: "Imposta sostitutiva",
        valore: `${percentuale(imp.aliquotaSostitutiva)}${imp.nuovaAttivita ? " (nuova attività)" : ""}`,
      },
      {
        etichetta: "Limite di ricavi del regime",
        valore: `${interoIt.format(imp.limiteForfettario)} €`,
      },
    );
  } else {
    parametri.push(
      voceAddizionale("regionale", imp),
      voceAddizionale("comunale", imp),
      {
        etichetta: "Scaglioni IRPEF",
        valore: imp.scaglioniIrpef
          .map(
            (s) =>
              `${percentuale(s.aliquota, 0)} fino a ${s.limite === null ? "oltre" : `${interoIt.format(s.limite)} €`}`,
          )
          .join(" · "),
      },
    );
  }
  parametri.push({ etichetta: "Previdenza", valore: nomeGestione(imp.gestione) });
  if (imp.gestione === "separata") {
    parametri.push(
      {
        etichetta: "Aliquota Gestione Separata",
        valore: percentuale(imp.aliquotaGestioneSeparata),
      },
      { etichetta: "Massimale contributivo", valore: `${interoIt.format(imp.massimaleGs)} €` },
    );
  }
  parametri.push({
    etichetta: "Rivalsa e ritenuta",
    valore: `${imp.rivalsaAttiva ? `rivalsa ${percentuale(imp.aliquotaRivalsa, 0)}` : "senza rivalsa"} · ${
      imp.ritenutaAttiva && !forfettario
        ? `ritenuta ${percentuale(imp.aliquotaRitenuta, 0)}`
        : "senza ritenuta"
    }`,
  });

  const sintesi: BloccoSintesi[] = [
    { etichetta: "Ricavi rilevanti", valore: euro(p.ricaviRilevanti), nota: "principio di cassa" },
    { etichetta: "Reddito imponibile", valore: euro(p.imponibile) },
    {
      etichetta: "Imposte e contributi",
      valore: euro(p.caricoTotale),
      nota: `pressione ${percentuale(p.pressione)}`,
    },
    {
      etichetta: "Netto disponibile",
      valore: euro(p.nettoDisponibile),
      nota: "al netto dei costi dell'attività",
    },
  ];

  return {
    titolo: `Prospetto fiscale ${p.anno}`,
    intestatario: imp.nome?.trim() || "Non impostato",
    anno: p.anno,
    emessoIl,
    identificazione,
    parametri,
    fonti: par.fonti,
    sintesi,
    sezioni: prospettoDettagliato(p, imp, par),
    nota: NOTA_GESTIONALE,
  };
}

/**
 * Il prospetto si può stampare?
 *
 * Stessa guardia dell'export: con parametri provvisori — o con addizionali che
 * l'utente non ha mai confermato — il documento avrebbe l'aria di essere
 * definitivo e poggerebbe su aliquote che non sono le sue.
 */
export function stampaConsentita(par: ParametriAnno, imp?: Impostazioni): EsitoEsportazione {
  return esportazioneProspettoConsentita(par, imp);
}

/**
 * Un'addizionale col suo territorio: «1,62 % · Emilia-Romagna».
 *
 * Un'aliquota da sola, su un foglio che finisce in mano al commercialista, non
 * è verificabile: per sapere se l'1,62 % è giusto bisogna sapere di quale
 * regione è. Era l'unica riga dei parametri che arrivava senza il suo contesto.
 *
 * Dove il territorio manca la riga lo dice, e l'aliquota non compare: mostrarla
 * nuda darebbe l'aria di un dato completo a un dato che non lo è. Dove ci sono
 * gli scaglioni non compare comunque, perché quella singola aliquota non è
 * quella applicata — la scomposizione sta più avanti, nella sezione delle
 * imposte, con la sua formula.
 */
function voceAddizionale(
  quale: "regionale" | "comunale",
  imp: Impostazioni,
): VoceIntestazione {
  const regionale = quale === "regionale";
  const etichetta = regionale ? "Addizionale regionale" : "Addizionale comunale";
  const territorio = regionale ? nomeRegione(imp.regione) : imp.comune?.trim() || null;
  if (!territorio) {
    return {
      etichetta,
      valore: regionale ? "Regione non dichiarata" : "Comune non dichiarato",
    };
  }
  const scaglioni = regionale
    ? imp.scaglioniAddizionaleRegionale
    : imp.scaglioniAddizionaleComunale;
  const aliquota = scaglioni?.length
    ? "a scaglioni"
    : percentuale(regionale ? imp.addizionaleRegionale : imp.addizionaleComunale);
  return { etichetta, valore: `${aliquota} · ${territorio}` };
}

/** `prospetto-2026-studio-di-consulenza.pdf`, per chi lo salva e lo allega. */
export function nomeFileProspetto(doc: DocumentoProspetto): string {
  const chi = doc.intestatario
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return chi ? `prospetto-${doc.anno}-${chi}` : `prospetto-${doc.anno}`;
}
