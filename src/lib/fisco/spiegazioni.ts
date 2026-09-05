/**
 * Il prospetto fiscale riga per riga, con la spiegazione di come ogni numero
 * è stato ottenuto.
 *
 * La spiegazione non è una nota d'aiuto generica: è la formula applicata ai
 * numeri di questa persona, in italiano. «5.850,00 € × 26,07%, fino al
 * massimale di 122.295,00 €» dice tutto quello che serve per fidarsi del
 * totale o per accorgersi che un'impostazione è sbagliata.
 *
 * Vive qui, fuori dalla schermata, perché serve anche all'esportazione da
 * mandare al commercialista.
 */
import { euro, interoIt, percentuale } from "@/lib/format";
import { rapporto, round2 } from "./aritmetica";
import {
  addizionaleComunaleDi,
  addizionaleRegionaleDi,
  descriviAddizionale,
} from "./addizionali";
import { detrazioneLavoroAutonomo } from "./detrazioni";
import { noteDelValore } from "./parametri-utente";
import type { Prospetto } from "./motore";
import type { Impostazioni, ParametriAnno } from "./tipi";

export type FormatoValore = "euro" | "percentuale" | "testo";

export type RigaProspetto = {
  id: string;
  etichetta: string;
  valore: number | string;
  formato: FormatoValore;
  /** Come si ottiene il numero, con i valori reali dentro. */
  formula?: string;
  /** Contesto che non è una formula: una regola, un'avvertenza. */
  nota?: string;
  /** Riga di totale: si stacca dalle altre. */
  totale?: boolean;
};

export type SezioneProspetto = {
  id: string;
  lettera: string;
  titolo: string;
  sottotitolo: string;
  righe: RigaProspetto[];
};

export function prospettoDettagliato(
  p: Prospetto,
  imp: Impostazioni,
  par: ParametriAnno,
): SezioneProspetto[] {
  const forfettario = imp.regime === "forfettario";
  const sezioni: SezioneProspetto[] = [];

  // — A · Base di calcolo ————————————————————————————
  const base: RigaProspetto[] = [];
  // Le note di credito sono una voce a sé, in mezzo a due totali che tornano:
  // lordo, storno, netto. Prima erano un «di cui» sotto un compenso già netto,
  // e su carta la colonna non sommava — 39.950, −400, 39.950 letti di fila
  // sembrano uno storno da sottrarre una seconda volta. Su un documento che
  // finisce dal commercialista una colonna che non torna è un errore, anche
  // quando ogni singolo numero è giusto.
  if (p.note.stornoIncassato > 0) {
    base.push({
      id: "fatture-incassate",
      etichetta: "Fatture incassate nell'anno",
      valore: round2(p.compensiIncassati + p.note.stornoIncassato),
      formato: "euro",
      formula: `Somma degli imponibili delle fatture con data di incasso nel ${p.anno}, al lordo degli storni. Conta quando il denaro è arrivato, non quando hai emesso la fattura.`,
    });
    base.push({
      id: "storno-note",
      etichetta: `Note di credito rimborsate nell'anno${p.note.numero > 1 ? ` (${interoIt.format(p.note.numero)})` : ""}`,
      valore: -p.note.stornoIncassato,
      formato: "euro",
      formula: `${p.note.numero === 1 ? "Una nota di credito rimborsata" : "Note di credito rimborsate"} nel ${p.anno}: il denaro è tornato al cliente, quindi non è ricavo.`,
      nota:
        p.note.nonRiconciliato > 0
          ? `${euro(p.note.nonRiconciliato)} non sono riconciliati a nessuna fattura: riducono comunque i ricavi.`
          : undefined,
    });
    base.push({
      id: "compensi",
      etichetta: "Compensi incassati, al netto degli storni",
      valore: p.compensiIncassati,
      formato: "euro",
      formula: `${euro(p.compensiIncassati + p.note.stornoIncassato)} di fatture incassate meno ${euro(p.note.stornoIncassato)} di note di credito.`,
    });
  } else {
    base.push({
      id: "compensi",
      etichetta: "Compensi incassati nell'anno",
      valore: p.compensiIncassati,
      formato: "euro",
      formula: `Somma degli imponibili delle fatture con data di incasso nel ${p.anno}. Conta quando il denaro è arrivato, non quando hai emesso la fattura.`,
    });
  }
  if (p.note.stornoDaRimborsare > 0) {
    base.push({
      id: "storno-da-rimborsare",
      etichetta: "Note di credito emesse e non ancora rimborsate",
      valore: p.note.stornoDaRimborsare,
      formato: "euro",
      formula:
        "Hanno già ridotto l'IVA a debito alla data del documento, ma i ricavi caleranno solo quando il denaro tornerà indietro.",
    });
  }
  if (p.rivalsaIncassata > 0) {
    base.push({
      id: "rivalsa",
      etichetta: "Rivalsa INPS incassata",
      valore: p.rivalsaIncassata,
      formato: "euro",
      formula: `${percentuale(imp.aliquotaRivalsa, 0)} sui compensi incassati.`,
      nota: "La rivalsa concorre a formare il reddito professionale: non è un rimborso.",
    });
  }
  base.push({
    id: "ricavi-rilevanti",
    etichetta: "Ricavi rilevanti ai fini fiscali",
    valore: p.ricaviRilevanti,
    formato: "euro",
    formula:
      p.rivalsaIncassata > 0
        ? `${euro(p.compensiIncassati)} di compensi più ${euro(p.rivalsaIncassata)} di rivalsa.`
        : "Coincidono con i compensi incassati: non applichi la rivalsa in fattura.",
    totale: true,
  });

  // I documenti a cavallo d'anno vanno detti, non lasciati dentro un totale:
  // sono la differenza fra «quest'anno ho fatturato» e «quest'anno ho incassato»,
  // ed è lì che il principio di cassa sorprende chi legge.
  if (p.aCavallo.ricaviDaAnniPrecedenti > 0) {
    base.push({
      id: "ricavi-da-anni-precedenti",
      etichetta: "di cui incassati su fatture di anni precedenti",
      valore: p.aCavallo.ricaviDaAnniPrecedenti,
      formato: "euro",
      formula: `Fatture emesse prima del ${p.anno} e incassate quest'anno: per le imposte sono ricavo del ${p.anno}, perché conta la data dell'incasso. La loro IVA è già stata liquidata nell'anno di emissione.`,
    });
  }
  if (p.aCavallo.ricaviVersoAnniSuccessivi > 0) {
    base.push({
      id: "ricavi-verso-anni-successivi",
      etichetta: `Emesso nel ${p.anno} e incassato dopo`,
      valore: p.aCavallo.ricaviVersoAnniSuccessivi,
      formato: "euro",
      formula: `Non entra in questo prospetto: diventerà ricavo dell'anno in cui è stato incassato.${
        p.aCavallo.ivaSuIncassiFuturi > 0
          ? ` L'IVA, invece, è di competenza del ${p.anno}: ${euro(p.aCavallo.ivaSuIncassiFuturi)}, dovuti comunque.`
          : ""
      }`,
    });
  }
  base.push({
    id: "costi-pagati",
    etichetta: "Costi pagati nell'anno, IVA compresa",
    valore: p.costiPagatiTotale,
    formato: "euro",
    formula: `Totale dei documenti con data di pagamento nel ${p.anno}, IVA compresa.`,
  });
  // Lo stesso discorso, dall'altro lato: il costo di dicembre pagato a gennaio
  // si deduce nell'anno nuovo, ma la sua IVA è detraibile in quello vecchio.
  if (!forfettario && p.aCavallo.costiDaAnniPrecedenti > 0) {
    base.push({
      id: "costi-da-anni-precedenti",
      etichetta: "di cui pagati su documenti di anni precedenti, IVA compresa",
      valore: p.aCavallo.costiDaAnniPrecedenti,
      formato: "euro",
      formula: `Documenti datati prima del ${p.anno} e pagati quest'anno: si deducono nel ${p.anno}, perché conta la data del pagamento. La loro IVA era già detraibile nell'anno del documento.`,
    });
  }
  if (!forfettario && p.aCavallo.costiVersoAnniSuccessivi + p.aCavallo.costiSospesi > 0) {
    base.push({
      id: "costi-verso-anni-successivi",
      etichetta: `Registrato nel ${p.anno} e non ancora pagato, IVA compresa`,
      valore: p.aCavallo.costiVersoAnniSuccessivi + p.aCavallo.costiSospesi,
      formato: "euro",
      formula: `Non è deducibile qui: lo sarà nell'anno in cui lo paghi.${
        p.aCavallo.ivaDetraibileSuPagamentiFuturi > 0
          ? ` L'IVA, invece, è detraibile già nel ${p.anno}: ${euro(p.aCavallo.ivaDetraibileSuPagamentiFuturi)}.`
          : ""
      }`,
    });
  }
  if (!forfettario) {
    base.push({
      id: "costi-deducibili",
      etichetta: "Quota fiscalmente deducibile",
      valore: p.costiDeducibiliPagati,
      formato: "euro",
      formula:
        "Imponibile di ogni costo pagato, moltiplicato per la sua percentuale di deducibilità.",
      nota: "Auto al 20%, ristoranti al 75%, telefonia al 50% dell'IVA: la percentuale è per documento.",
    });
    base.push({
      id: "iva-detraibile",
      etichetta: "IVA sugli acquisti detraibile",
      valore: p.ivaDetraibilePagata,
      formato: "euro",
      formula: "IVA di ogni costo pagato, per la sua percentuale di detraibilità.",
    });
  } else {
    base.push({
      id: "costi-indeducibili",
      etichetta: "Quota fiscalmente deducibile",
      valore: 0,
      formato: "euro",
      formula: "Zero: nel forfettario i costi non si deducono analiticamente.",
      nota: "Il forfait li considera già, nella parte di ricavi che il coefficiente ATECO lascia fuori dal reddito.",
    });
  }
  if (p.bolloACarico > 0) {
    base.push({
      id: "bollo",
      etichetta: "Imposta di bollo a tuo carico",
      valore: p.bolloACarico,
      formato: "euro",
      formula: `${euro(imp.importoBollo)} su ogni fattura senza IVA sopra ${euro(imp.sogliaBollo)}, non addebitata al cliente.`,
    });
  }

  sezioni.push({
    id: "base",
    lettera: "A",
    titolo: "Base di calcolo",
    sottotitolo: "Principio di cassa: contano gli incassi e i pagamenti effettivi",
    righe: base,
  });

  // — B · Reddito imponibile ————————————————————————
  const reddito: RigaProspetto[] = [
    {
      id: "reddito-lordo",
      etichetta: "Reddito lordo ante contributi",
      valore: p.redditoLordo,
      formato: "euro",
      formula: forfettario
        ? `${euro(p.ricaviRilevanti)} × ${percentuale(imp.coefficienteRedditivita, 0)}, il coefficiente di redditività del tuo gruppo ATECO.`
        : `${euro(p.ricaviRilevanti)} di ricavi meno ${euro(p.costiDeducibiliPagati)} di costi deducibili.`,
    },
    {
      id: "contributi-dedotti",
      etichetta: "Contributi dedotti",
      valore: p.contributiDedotti,
      formato: "euro",
      formula:
        p.fonteContributiDedotti === "versamenti"
          ? `Somma dei versamenti F24 di tipo contributi registrati nel ${p.anno}: si deducono per cassa, nell'anno in cui li paghi.`
          : `Non hai registrato versamenti F24 nell'anno, quindi si usano i contributi di competenza (${euro(p.contributiCompetenza)}). Registra gli F24 per avere il dato reale.`,
    },
  ];
  if (!forfettario) {
    reddito.push({
      id: "oneri",
      etichetta: "Oneri deducibili (fondo pensione)",
      valore: p.oneriDeducibili,
      formato: "euro",
      formula: `Versamenti a fondo pensione, deducibili fino a ${euro(par.tettoFondoPensione)} l'anno.`,
    });
  } else {
    reddito.push({
      id: "oneri-zero",
      etichetta: "Oneri deducibili",
      valore: 0,
      formato: "euro",
      formula: "Zero: nel forfettario gli oneri deducibili non abbattono la base imponibile.",
      nota: "È uno degli svantaggi del regime: il fondo pensione resta un costo senza risparmio fiscale.",
    });
  }
  reddito.push({
    id: "imponibile",
    etichetta: "Reddito imponibile",
    valore: p.imponibile,
    formato: "euro",
    formula: `${euro(p.redditoLordo)} − ${euro(p.contributiDedotti)} di contributi${p.oneriDeducibili > 0 ? ` − ${euro(p.oneriDeducibili)} di oneri` : ""}, mai sotto zero.`,
    totale: true,
  });

  sezioni.push({
    id: "reddito",
    lettera: "B",
    titolo: "Reddito imponibile",
    sottotitolo: "Dal fatturato alla base su cui si pagano le imposte",
    righe: reddito,
  });

  // — C · Imposte ————————————————————————————————
  const imposte: RigaProspetto[] = [];
  if (forfettario) {
    imposte.push({
      id: "sostitutiva",
      etichetta: "Imposta sostitutiva",
      valore: p.impostaSostitutiva,
      formato: "euro",
      formula: `${euro(p.imponibile)} × ${percentuale(imp.aliquotaSostitutiva, 0)}.`,
      nota: "Sostituisce IRPEF, addizionali regionali e comunali e IRAP.",
    });
  } else {
    imposte.push({
      id: "irpef-lorda",
      etichetta: "IRPEF lorda",
      valore: p.irpefLorda,
      formato: "euro",
      formula: descriviScaglioni(p.imponibile, imp),
    });
    // Spetta d'ufficio: si scrive sempre, anche quando è zero, perché il
    // motivo per cui non spetta è un'informazione quanto l'importo.
    const art13 = detrazioneLavoroAutonomo(p.redditoLordo, par.detrazioneLavoroAutonomo);
    imposte.push({
      id: "detrazione-autonomo",
      etichetta: "Detrazione per redditi di lavoro autonomo",
      valore: p.detrazioneAutonomo,
      formato: "euro",
      formula: `${art13.descrizione} Art. 13 comma 5 TUIR: spetta d'ufficio, senza doverla chiedere.`,
      nota: `Si calcola sul reddito complessivo — ${euro(p.redditoLordo)}, il reddito lordo prima della deduzione dei contributi — non sull'imponibile. Se hai altri redditi oltre a quelli dell'attività il tuo reddito complessivo è più alto, e la detrazione più bassa di così.`,
    });
    if (p.detrazioni > 0) {
      imposte.push({
        id: "detrazioni",
        etichetta: "Altre detrazioni d'imposta",
        valore: p.detrazioni,
        formato: "euro",
        formula:
          "Importo indicato nelle impostazioni: familiari a carico, spese sanitarie, altre detrazioni. Il lavoro autonomo è già contato nella riga sopra.",
      });
    }
    if (p.detrazioniTotali > 0) {
      const incapiente = p.detrazioniTotali > p.irpefLorda;
      imposte.push({
        id: "irpef-netta",
        etichetta: "IRPEF netta",
        valore: p.irpefNetta,
        formato: "euro",
        formula: `${euro(p.irpefLorda)} − ${euro(p.detrazioniTotali)} di detrazioni, mai sotto zero.`,
        nota: incapiente
          ? `L'imposta lorda è più bassa delle detrazioni: ${euro(round2(p.detrazioniTotali - p.detrazioniApplicate))} restano inutilizzati. Le detrazioni non si rimborsano e non si riportano all'anno dopo.`
          : undefined,
      });
    }
    // Le addizionali seguono l'IRPEF: quando è zero non sono dovute, e uno zero
    // senza spiegazione in un prospetto sembra un dato mancante.
    const senzaIrpef = p.irpefNetta === 0;
    const perche = senzaIrpef
      ? "Non dovuta: le addizionali si pagano solo se l'IRPEF, al netto delle detrazioni, risulta dovuta. Quest'anno l'IRPEF netta è zero."
      : undefined;
    imposte.push({
      id: "add-regionale",
      etichetta: "Addizionale regionale",
      valore: p.addizionaleRegionale,
      formato: "euro",
      // «L'aliquota della tua regione» si può dire solo a chi l'ha dichiarata.
      // Finché è la media dell'app va scritto, altrimenti nessuno riaprirebbe
      // la domanda: le aliquote vere vanno dall'1,23 % a oltre il 3 %, e in
      // molte regioni sono scaglioni, non un'aliquota sola.
      formula: `${descriviAddizionale(p.imponibile, addizionaleRegionaleDi(imp))}, ${noteDelValore(imp, "addizionaleRegionale")}.`,
      nota: perche,
    });
    imposte.push({
      id: "add-comunale",
      etichetta: "Addizionale comunale",
      valore: p.addizionaleComunale,
      formato: "euro",
      formula: `${descriviAddizionale(p.imponibile, addizionaleComunaleDi(imp))}, ${noteDelValore(imp, "addizionaleComunale")}.`,
      nota: perche,
    });
  }
  imposte.push({
    id: "totale-imposte",
    etichetta: "Totale imposte",
    valore: p.totaleImposte,
    formato: "euro",
    totale: true,
  });
  if (p.ritenuteSubite > 0) {
    imposte.push({
      id: "ritenute",
      etichetta: "Ritenute d'acconto già subite",
      valore: p.ritenuteSubite,
      formato: "euro",
      // La base va detta, non lasciata indovinare: su carta è l'unico modo di
      // verificare che la ritenuta corrisponda alle certificazioni ricevute.
      formula:
        p.stornoDedottoDalleRitenute > 0
          ? `${percentuale(imp.aliquotaRitenuta, 0)} su ${euro(p.baseRitenute)}: ${euro(round2(p.baseRitenute + p.stornoDedottoDalleRitenute))} di imponibile incassato meno ${euro(p.stornoDedottoDalleRitenute)} di note di credito riconciliate a quelle fatture. È un anticipo, si scomputa dal saldo.`
          : `${percentuale(imp.aliquotaRitenuta, 0)} su ${euro(p.baseRitenute)} di imponibile incassato, trattenuto dai committenti: è un anticipo, si scomputa dal saldo.`,
      nota:
        p.note.nonRiconciliato > 0
          ? `${euro(p.note.nonRiconciliato)} di note di credito non sono riconciliati a nessuna fattura: riducono i ricavi ma non questa base, perché non si sa a quale committente attribuirli. Riconciliali dalla scheda della nota.`
          : undefined,
    });
    if (p.creditoImposta > 0) {
      imposte.push({
        id: "credito",
        etichetta: "Credito d'imposta",
        valore: p.creditoImposta,
        formato: "euro",
        formula: `Le ritenute (${euro(p.ritenuteSubite)}) superano le imposte dovute (${euro(p.totaleImposte)}): la differenza è un credito da recuperare, non un saldo negativo.`,
        totale: true,
      });
    } else {
      imposte.push({
        id: "imposte-a-saldo",
        etichetta: "Imposte nette a saldo",
        valore: p.imposteNetteASaldo,
        formato: "euro",
        formula: `${euro(p.totaleImposte)} − ${euro(p.ritenuteSubite)} di ritenute già subite.`,
        totale: true,
      });
    }
  } else if (imp.ritenutaAttiva && !forfettario) {
    // Zero dichiarato, non zero taciuto. Chi applica la ritenuta in fattura e
    // non ne vede traccia nel prospetto non sa se non gliene hanno trattenute
    // o se il documento se n'è dimenticato: sulla carta la differenza non si
    // può verificare, e questa riga la dice.
    imposte.push({
      id: "ritenute",
      etichetta: "Ritenute d'acconto già subite",
      valore: 0,
      formato: "euro",
      formula: `Nessun committente ha trattenuto la ritenuta del ${percentuale(imp.aliquotaRitenuta, 0)} sulle fatture incassate nel ${p.anno}: non c'è nulla da scomputare dal saldo.`,
    });
  }

  sezioni.push({
    id: "imposte",
    lettera: "C",
    titolo: "Imposte",
    sottotitolo: forfettario ? "Imposta sostitutiva del regime forfettario" : "IRPEF a scaglioni e addizionali",
    righe: imposte,
  });

  // — D · Contributi ————————————————————————————————
  const contributi: RigaProspetto[] = [
    {
      id: "base-contributiva",
      etichetta: "Base imponibile contributiva",
      valore: p.baseContributiva,
      formato: "euro",
      formula: "Il reddito lordo prima della deduzione dei contributi stessi.",
    },
  ];
  if (imp.gestione === "separata") {
    contributi.push({
      id: "gestione-separata",
      etichetta: "Gestione Separata INPS",
      valore: p.contributiGestioneSeparata,
      formato: "euro",
      formula: `${euro(Math.min(p.baseContributiva, imp.massimaleGs))} × ${percentuale(imp.aliquotaGestioneSeparata, 2)}, fino al massimale di ${euro(imp.massimaleGs)}.`,
      nota: "Per i professionisti senza cassa non esiste un contributo minimo obbligatorio.",
    });
    contributi.push({
      id: "accredito",
      etichetta: "Accredito contributivo dell'anno",
      valore: p.accreditoIntero ? "Anno intero accreditato" : "Accredito parziale",
      formato: "testo",
      formula: `Il minimale di reddito per l'accredito intero è ${euro(imp.minimaleGs)}; il tuo reddito lordo è ${euro(p.redditoLordo)}.`,
      nota: p.accreditoIntero
        ? undefined
        : "Sotto il minimale l'anno non viene accreditato per intero ai fini pensionistici. È un'informazione che quasi nessuno dà.",
    });
  } else if (imp.gestione === "artigiani") {
    contributi.push({
      id: "artigiani",
      etichetta: "Artigiani e commercianti",
      valore: p.contributiArtigiani,
      formato: "euro",
      // I contributi fissi cambiano ogni anno e per gestione: finché non sono
      // stati confermati, quello scritto qui è la media dell'app.
      formula: `${euro(imp.contributiFissi)} di contributi fissi (${noteDelValore(imp, "contributiFissi")}) più ${percentuale(imp.aliquotaEccedenza, 2)} sulla parte di reddito oltre il minimale di ${euro(imp.minimaleArtigiani)}.`,
      nota: "I contributi fissi si versano in quattro rate, a febbraio, maggio, agosto e novembre.",
    });
  } else {
    contributi.push({
      id: "cassa",
      etichetta: "Contributo soggettivo di cassa",
      valore: p.contributiCassa,
      formato: "euro",
      // Ogni cassa professionale ha le sue aliquote: Forense, Inarcassa e le
      // altre non si somigliano. Il 15 % è un punto di partenza, non la tua.
      formula: `${euro(p.baseContributiva)} × ${percentuale(imp.aliquotaSoggettivaCassa, 0)}, ${noteDelValore(imp, "aliquotaSoggettivaCassa")}.`,
      nota: `Il contributo integrativo del ${percentuale(imp.aliquotaIntegrativaCassa, 0)} si addebita in fattura al cliente e non concorre al tuo reddito.`,
    });
  }
  contributi.push({
    id: "totale-contributi",
    etichetta: "Totale contributi",
    valore: p.totaleContributi,
    formato: "euro",
    totale: true,
  });

  sezioni.push({
    id: "contributi",
    lettera: "D",
    titolo: "Contributi previdenziali",
    sottotitolo: nomeGestione(imp.gestione),
    righe: contributi,
  });

  // — E · Sintesi ————————————————————————————————
  sezioni.push({
    id: "sintesi",
    lettera: "E",
    titolo: "Sintesi e accantonamento",
    sottotitolo: "Quanto pesa davvero, e quanto mettere da parte ogni mese",
    righe: [
      {
        id: "carico",
        etichetta: "Carico totale annuo",
        valore: p.caricoTotale,
        formato: "euro",
        formula: `${euro(p.totaleImposte)} di imposte più ${euro(p.totaleContributi)} di contributi.`,
        totale: true,
      },
      {
        id: "pressione",
        etichetta: "Pressione effettiva sui ricavi",
        valore: p.pressione,
        formato: "percentuale",
        formula: `${euro(p.caricoTotale)} ÷ ${euro(p.ricaviRilevanti)}: quanto di ogni euro incassato se ne va fra imposte e contributi.`,
      },
      {
        id: "costi-netti",
        etichetta: "Costi netti a carico dell'attività",
        valore: p.costiNettiACarico,
        formato: "euro",
        formula: forfettario
          ? `${euro(p.costiPagatiTotale)} di uscite${p.bolloACarico > 0 ? ` più ${euro(p.bolloACarico)} di bollo` : ""}: in forfettario l'IVA sugli acquisti è indetraibile e diventa costo pieno.`
          : `${euro(p.costiPagatiTotale)} di uscite meno ${euro(p.ivaDetraibilePagata)} di IVA recuperabile${p.bolloACarico > 0 ? `, più ${euro(p.bolloACarico)} di bollo` : ""}.`,
      },
      {
        id: "netto",
        etichetta: "Reddito netto disponibile",
        valore: p.nettoDisponibile,
        formato: "euro",
        formula: `${euro(p.ricaviRilevanti)} − ${euro(p.costiNettiACarico)} di costi − ${euro(p.caricoTotale)} di carico fiscale.`,
        nota: "Quello che ti resta davvero, prima delle spese personali.",
        totale: true,
      },
      {
        id: "accantonamento-mensile",
        etichetta: "Da accantonare al mese",
        valore: p.accantonamentoMensile,
        formato: "euro",
        formula: `${euro(p.fabbisognoDaAccantonare)} ÷ 12, da spostare su un conto separato dedicato alle imposte.`,
        nota: notaFabbisogno(p),
      },
      {
        id: "scostamento",
        etichetta: "Scostamento sull'accantonamento impostato",
        valore: p.scostamentoAccantonamento,
        formato: "euro",
        formula: `Accantoni il ${percentuale(p.percentualeImpostata, 0)} dei ricavi, cioè ${euro(p.accantonamentoAnnuo)}; da mettere da parte ce ne sono ${euro(p.fabbisognoDaAccantonare)}.`,
        nota:
          p.scostamentoAccantonamento >= 0
            ? "Copri il fabbisogno stimato con un margine."
            : p.accantonamentoSufficiente
              ? `Mancano ${euro(-p.scostamentoAccantonamento)}, dentro la tolleranza di ${euro(p.tolleranzaAccantonamento)}: la percentuale va bene com'è.`
              : `Non basta: porta la percentuale almeno al ${Math.ceil(p.percentualeTeoricaAccantonamento * 100)}%.`,
      },
    ],
  });

  // — F · Saldo e acconti ————————————————————————
  // Il saldo di un anno e gli acconti per il successivo si versano tutti
  // nell'anno dopo: l'anno d'imposta e l'anno di cassa non coincidono mai, e
  // su un documento che gira senza l'app intorno va scritto quale dei due è.
  const prossimo = p.anno + 1;
  const acconti: RigaProspetto[] = [
    {
      id: "dovuto",
      etichetta: "Totale dovuto per l'anno",
      valore: p.totaleDovuto,
      formato: "euro",
      formula: `${euro(p.imposteNetteASaldo)} di imposte nette più ${euro(p.totaleContributi)} di contributi.`,
      totale: true,
    },
    {
      id: "gia-versato",
      etichetta: `Già versato per l'anno d'imposta ${p.anno}`,
      valore: p.giaVersato,
      formato: "euro",
      formula: `Versamenti F24 riferiti al ${p.anno}, esclusa l'IVA. Conta l'anno d'imposta, non la data: il saldo di un anno si versa a giugno di quello dopo, insieme al primo acconto dell'anno in corso.`,
      nota:
        p.versamentiSenzaAnno > 0
          ? `${euro(p.versamentiSenzaAnno)} non hanno un anno d'imposta dichiarato: sono contati qui per la data di pagamento. Se qualcuno di questi era il saldo del ${p.anno - 1}, questo numero è più alto del vero — assegnali dal Cashflow.`
          : undefined,
    },
  ];

  if (p.versamentiAltriAnni > 0) {
    acconti.push({
      id: "versamenti-altri-anni",
      etichetta: `Versato nel ${p.anno} per altri anni d'imposta`,
      valore: p.versamentiAltriAnni,
      formato: "euro",
      formula: `Uscito dal conto quest'anno — tipicamente il saldo del ${p.anno - 1}, versato a giugno — ma riferito a un altro anno: non scomputa il dovuto del ${p.anno}. Nel cashflow c'è, qui no.`,
    });
  }

  // Il credito che arriva dalla chiusura dell'anno prima compare solo quando
  // c'è: una riga da zero euro in un prospetto è rumore.
  if (p.creditoAnnoPrecedente > 0) {
    acconti.push({
      id: "credito-anno-precedente",
      etichetta: "Credito dall'anno precedente",
      valore: p.creditoAnnoPrecedente,
      formato: "euro",
      formula: `Ritenute eccedenti e versamenti in eccesso riportati dalla chiusura del ${p.anno - 1}. Si scomputa prima dal saldo, poi dagli acconti: ${euro(p.creditoUtilizzatoSuSaldo)} sono già serviti a coprire il saldo.`,
    });
  }

  acconti.push({
    id: "saldo",
    etichetta: "Saldo residuo da versare",
    valore: p.saldoResiduo,
    formato: "euro",
    // L'anno va scritto. «A giugno» in un documento del 2026 si legge come
    // giugno 2026, e il saldo del 2026 si versa a giugno 2027.
    formula:
      (p.creditoAnnoPrecedente > 0
        ? `${euro(p.totaleDovuto)} − ${euro(p.giaVersato)} già versati − ${euro(p.creditoUtilizzatoSuSaldo)} di credito, mai sotto zero.`
        : `${euro(p.totaleDovuto)} − ${euro(p.giaVersato)} già versati, mai sotto zero.`) +
      ` Si versa entro il 30 giugno ${prossimo}.`,
  });

  /*
    Stessa sparizione dell'altro lato: chi ha versato più del dovuto vedeva un
    saldo a zero e nessuna traccia della differenza. È lo stesso credito, per
    una strada diversa — e prende la stessa strada nel riporto.
  */
  const eccedenzaVersamenti = round2(Math.max(0, p.giaVersato - p.totaleDovuto));
  if (eccedenzaVersamenti > 0) {
    acconti.push({
      id: "eccedenza-versamenti",
      etichetta: "Versato in più del dovuto",
      valore: eccedenzaVersamenti,
      formato: "euro",
      formula: `${euro(p.giaVersato)} versati con F24 contro ${euro(p.totaleDovuto)} dovuti. La differenza non si perde: entra nel riporto al ${prossimo} insieme all'eventuale credito d'imposta.`,
      nota:
        p.versamentiSenzaAnno > 0
          ? `Da verificare prima di contarci: ${euro(p.versamentiSenzaAnno)} dei versamenti non hanno un anno d'imposta dichiarato.`
          : undefined,
    });
  }

  /*
    Il credito calcolato in C spariva qui: un numero che compare a metà
    documento e non ricompare più sembra un errore di somma, e chi legge non
    sa che cosa deve farne. Dove finisce va scritto dove si guarda che cosa
    esce dal conto.
  */
  if (p.creditoImposta > 0) {
    acconti.push({
      id: "credito-a-nuovo",
      etichetta: "Credito d'imposta da utilizzare",
      valore: p.creditoImposta,
      formato: "euro",
      formula: `Le ritenute subite (${euro(p.ritenuteSubite)}) superano le imposte dell'anno (${euro(p.totaleImposte)}): la differenza non si versa, si recupera. Si compensa in F24 con altre imposte e contributi a partire dalla presentazione della dichiarazione dei redditi ${prossimo}, oppure si chiede a rimborso nella dichiarazione stessa.`,
      nota: `Fino a ${euro(par.sogliaVistoCompensazione)} l'anno la compensazione è libera; oltre serve il visto di conformità. Quello che non usi non si perde: entra nel riporto al ${prossimo}, dove copre prima il saldo e poi gli acconti.`,
    });
  }

  if (!p.acconti.dovuti) {
    acconti.push({
      id: "acconti-non-dovuti",
      etichetta: `Acconti per il ${prossimo}`,
      valore: "Non dovuti",
      formato: "testo",
      formula: `Le imposte dell'anno (${euro(p.imposteNetteASaldo)}) restano sotto la soglia di ${euro(par.sogliaAcconti)}, e non ci sono contributi da anticipare: nessun acconto.`,
    });
  } else if (p.acconti.accontoUnico) {
    acconti.push({
      id: "acconto-unico",
      etichetta: `Acconto unico per il ${prossimo}`,
      valore: p.acconti.secondo,
      formato: "euro",
      formula: `Sotto ${euro(par.sogliaAccontoUnico)} l'acconto delle imposte non si divide: si versa tutto in una volta, entro il 30 novembre ${prossimo}.`,
    });
  } else {
    acconti.push({
      id: "primo-acconto",
      etichetta: `Primo acconto per il ${prossimo}`,
      valore: p.acconti.primo,
      formato: "euro",
      formula: `Si versa entro il 30 giugno ${prossimo}, insieme al saldo. Metodo storico: si calcola sui numeri del ${p.anno}.`,
      nota: composizioneRata(p, imp, par, "primo"),
    });
    acconti.push({
      id: "secondo-acconto",
      etichetta: `Secondo acconto per il ${prossimo}`,
      valore: p.acconti.secondo,
      formato: "euro",
      formula: `Si versa entro il 30 novembre ${prossimo}.`,
      nota: composizioneRata(p, imp, par, "secondo"),
    });
    acconti.push({
      id: "rata",
      etichetta: `Rata mensile, rateizzando in ${par.rateRateizzazione} rate`,
      valore: p.rataRateizzazioneConInteressi,
      formato: "euro",
      formula: `${euro(p.saldoResiduo + p.acconti.primo)} fra saldo e primo acconto, in ${par.rateRateizzazione} rate da giugno a novembre ${prossimo}, con interessi dello ${percentuale(par.interesseRateizzazioneMensile, 2)} al mese.`,
      nota: `Senza interessi la rata sarebbe ${euro(p.rataRateizzazione)}.`,
    });
  }

  sezioni.push({
    id: "acconti",
    lettera: "F",
    titolo: "Saldo, acconti e rateizzazione",
    sottotitolo: "Che cosa esce dal conto, e quando",
    righe: acconti,
  });

  return sezioni;
}

/**
 * Di che cosa è fatta una rata di acconto.
 *
 * Imposte e contributi hanno regole diverse — 40/60 sul dovuto le prime, la
 * quota della propria gestione i secondi — e la rata è la somma delle due.
 * Senza questa frase le percentuali non tornano su nessuno dei due totali, e
 * chi prova a rifare il conto trova un numero che non esiste.
 */
function composizioneRata(
  p: Prospetto,
  imp: Impostazioni,
  par: ParametriAnno,
  quale: "primo" | "secondo",
): string | undefined {
  const a = p.acconti;
  const pezzi: string[] = [];
  const quotaImposte = quale === "primo" ? par.quotaPrimoAcconto : par.quotaSecondoAcconto;
  const forfettario = imp.regime === "forfettario";
  if (a.imposte[quale] > 0) {
    const nome = forfettario ? "imposta sostitutiva" : "IRPEF";
    const base = round2((forfettario ? p.impostaSostitutiva : p.irpefNetta) - p.ritenuteSubite);
    pezzi.push(
      `${euro(a.imposte[quale])} di ${nome}, il ${percentuale(quotaImposte, 0)} di ${euro(base)}`,
    );
  }
  if (a.addizionali[quale] > 0) {
    pezzi.push(
      `${euro(a.addizionali[quale])} di addizionale comunale, il ${percentuale(a.addizionali.quota, 0)} di ${euro(a.addizionali.base)}, tutto a giugno`,
    );
  }
  if (a.contributi[quale] > 0) {
    const regola = par.accontoContributi[imp.gestione];
    const quotaRata = regola ? regola.quota / regola.rate : 0;
    const dove =
      imp.gestione === "artigiani"
        ? `${euro(a.contributi.base)} di contributi sul reddito eccedente il minimale`
        : euro(a.contributi.base);
    pezzi.push(
      `${euro(a.contributi[quale])} di contributi, il ${percentuale(quotaRata, 0)} di ${dove}` +
        ` — l'acconto è ${conArticolo(a.contributi.quota)} del dovuto, in ${interoIt.format(regola?.rate ?? 0)} rate uguali`,
    );
  }
  if (pezzi.length === 0) return undefined;
  const code: string[] = [];
  if (!forfettario && p.addizionaleRegionale > 0) {
    code.push("L'addizionale regionale non ha acconto: si versa tutta a saldo.");
  }
  if (imp.gestione === "artigiani") {
    code.push("I contributi sul minimale non entrano qui: si versano in quattro rate fisse.");
  }
  if (imp.gestione === "cassa" && p.contributiCassa > 0) {
    code.push("I contributi di cassa non entrano qui: la tua cassa ha scadenze e regole proprie.");
  }
  return [`${elenco(pezzi)}.`, ...code].join(" ");
}

/**
 * Perché il fabbisogno è più basso del carico.
 *
 * Va detto ogni volta che i due numeri divergono, e nella riga in cui si chiede
 * di mettere da parte del denaro: chi legge «carico 13.431 €» due righe sopra e
 * «da accantonare 1.119 €» qui, senza una frase in mezzo, pensa a un errore.
 */
function notaFabbisogno(p: Prospetto): string {
  const scomputi: string[] = [];
  if (p.ritenuteSubite > 0) {
    scomputi.push(`${euro(p.ritenuteSubite)} di ritenute già trattenute dai committenti`);
  }
  if (p.creditoAnnoPrecedente > 0) {
    scomputi.push(`${euro(p.creditoAnnoPrecedente)} di credito riportato dal ${p.anno - 1}`);
  }
  if (scomputi.length === 0) {
    return "Non hai ritenute né crediti a copertura: da mettere da parte c'è tutto il carico dell'anno.";
  }
  return `Il carico dell'anno è ${euro(p.caricoTotale)}, ma ${elenco(scomputi)} sono imposta già pagata: non vanno accantonati una seconda volta.`;
}

/**
 * «l'80 %», «il 50 %»: l'articolo giusto davanti a una percentuale.
 *
 * In italiano si elide davanti ai numeri che si leggono con una vocale
 * iniziale — uno, otto, undici, ottanta e i suoi. «Il 80 %» in un documento
 * che va dal commercialista si nota, e fa sembrare tutto il resto scritto da
 * una macchina.
 */
function conArticolo(frazione: number): string {
  const n = Math.round(frazione * 100);
  const vocale = n === 1 || n === 8 || n === 11 || (n >= 80 && n <= 89);
  return `${vocale ? "l'" : "il "}${percentuale(frazione, 0)}`;
}

/** «a, b e c»: l'elenco come lo si scrive in italiano. */
function elenco(voci: string[]): string {
  if (voci.length === 1) return voci[0];
  return `${voci.slice(0, -1).join(", ")} e ${voci[voci.length - 1]}`;
}

/** «28.000 € al 23%, poi 22.000 € al 33%»: gli scaglioni davvero applicati. */
export function descriviScaglioni(imponibile: number, imp: Impostazioni): string {
  if (imponibile <= 0) return "Nessuna imposta: il reddito imponibile è zero.";
  const pezzi: string[] = [];
  let precedente = 0;
  for (const s of imp.scaglioniIrpef) {
    const tetto = s.limite ?? Number.POSITIVE_INFINITY;
    const quota = Math.min(imponibile, tetto) - precedente;
    if (quota <= 0) break;
    pezzi.push(`${euro(quota)} al ${percentuale(s.aliquota, 0)}`);
    precedente = tetto;
    if (imponibile <= tetto) break;
  }
  return `Scaglioni progressivi: ${pezzi.join(", poi ")}.`;
}

/** Il messaggio sulla soglia, con il numero che serve per decidere. */
export function dettaglioSoglia(p: Prospetto, imp: Impostazioni): string | null {
  if (imp.regime !== "forfettario") return null;
  const residuo = imp.limiteForfettario - p.soglia.baseCassa;
  if (residuo <= 0) return p.soglia.messaggio;
  return `${p.soglia.messaggio} Hai usato ${percentuale(p.soglia.utilizzoLimite, 0)} del limite di ${interoIt.format(imp.limiteForfettario)} €: puoi ancora incassare ${euro(residuo)}.`;
}

/**
 * La quota di limite forfettario usata, in forma breve, per il cruscotto.
 *
 * Il limite si misura sui compensi **percepiti**, non sull'emesso: è la legge
 * che dice così, e l'app lo calcola così da sempre. Chi guarda solo l'emesso
 * si spaventa a vuoto, e chi crede che il limite sia sull'emesso può stare
 * tranquillo mentre incassa oltre soglia. Per questo la riga dice due cose:
 * dove sei davvero, e dove arriveresti se l'emesso rientrasse tutto entro
 * dicembre — che è il vero preavviso, e l'unico modo in cui l'emesso serve a
 * questa domanda.
 *
 * `null` fuori dal forfettario: lì un limite non c'è.
 */
export function quotaLimite(
  p: Prospetto,
  imp: Impostazioni,
): { usato: number; proiettato: number; oltreProiettando: boolean; testo: string } | null {
  if (imp.regime !== "forfettario" || imp.limiteForfettario <= 0) return null;
  const usato = p.soglia.utilizzoLimite;
  const proiettato = rapporto(p.soglia.baseCassa + p.soglia.inSospeso, imp.limiteForfettario);
  const oltreProiettando = proiettato > 1 && usato <= 1;

  const base = `${percentuale(usato, 0)} del limite di ${interoIt.format(imp.limiteForfettario)} €, sull'incassato`;
  if (p.soglia.inSospeso <= 0) return { usato, proiettato, oltreProiettando, testo: base };
  return {
    usato,
    proiettato,
    oltreProiettando,
    testo: oltreProiettando
      ? `${base}. Incassando tutto l'emesso arriveresti al ${percentuale(proiettato, 0)}: oltre il limite.`
      : `${base}. Incassando tutto l'emesso arriveresti al ${percentuale(proiettato, 0)}.`,
  };
}

function nomeGestione(gestione: Impostazioni["gestione"]): string {
  return gestione === "separata"
    ? "Gestione Separata INPS"
    : gestione === "artigiani"
      ? "Artigiani e commercianti"
      : "Cassa professionale";
}
