/**
 * Campi derivati di fatture e costi. Non si salvano mai: si ricalcolano da qui.
 * Se trovi un valore calcolato dentro il database, è un bug.
 */
import { round2 } from "./aritmetica";
import type {
  Costo,
  CostoCalcolato,
  Fattura,
  FatturaCalcolata,
  Impostazioni,
} from "./tipi";

const GIORNO_MS = 86_400_000;

/** Data ISO (yyyy-mm-dd) → mezzanotte UTC, così le differenze in giorni sono esatte. */
export function giorno(iso: string): number {
  const [a, m, g] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(a, (m ?? 1) - 1, g ?? 1);
}

export function giorniTra(daIso: string, aIso: string): number {
  return Math.round((giorno(aIso) - giorno(daIso)) / GIORNO_MS);
}

export function aggiungiGiorni(iso: string, giorni: number): string {
  return new Date(giorno(iso) + giorni * GIORNO_MS).toISOString().slice(0, 10);
}

export function annoDi(iso: string): number {
  return Number(iso.slice(0, 4));
}

export function meseDi(iso: string): number {
  return Number(iso.slice(5, 7));
}

/**
 * Calcola i derivati di una fattura.
 *
 * Due scostamenti dichiarati rispetto all'Excel di partenza:
 * — il bollo segue l'esenzione IVA della singola operazione, non il regime, così
 *   copre anche l'ordinario che emette fuori campo IVA o in reverse charge;
 * — chi è iscritto a una cassa professionale addebita il contributo integrativo
 *   invece della rivalsa INPS. L'integrativa, a differenza della rivalsa, non
 *   concorre a formare il reddito.
 */
export function calcolaFattura(
  fattura: Fattura,
  imp: Impostazioni,
  oggiIso: string,
  /**
   * Quanto le note di credito tolgono all'imponibile di questa fattura.
   *
   * Serve a una cosa sola ma importante: sapere **quanto il cliente deve
   * ancora**. Senza, una fattura da 4.870 stornata per 340 e pagata per il suo
   * netto risultava «incassata in parte, restano 346,80» — un residuo che non
   * esiste, perché quei 340 non li deve più nessuno. Zero è il valore giusto
   * per chi chiama senza sapere delle note: è il caso «nessuno storno».
   */
  stornato = 0,
): FatturaCalcolata {
  const forfettario = imp.regime === "forfettario";
  const aliquotaIvaApplicata = forfettario ? 0 : (fattura.aliquotaIva ?? imp.aliquotaIva);
  const iva = round2(fattura.imponibile * aliquotaIvaApplicata);

  const inCassa = imp.gestione === "cassa";
  const rivalsa =
    imp.rivalsaAttiva && !inCassa ? round2(fattura.imponibile * imp.aliquotaRivalsa) : 0;
  const integrativaCassa =
    imp.rivalsaAttiva && inCassa
      ? round2(fattura.imponibile * imp.aliquotaIntegrativaCassa)
      : 0;

  const imponibileConMaggiorazioni = fattura.imponibile + rivalsa + integrativaCassa;
  const bollo =
    aliquotaIvaApplicata === 0 && imponibileConMaggiorazioni > imp.sogliaBollo
      ? imp.importoBollo
      : 0;
  const bolloACarico = imp.bolloAddebitato ? 0 : bollo;

  // La ritenuta d'acconto non si applica ai forfettari e non colpisce
  // il contributo integrativo della cassa.
  const ritenuta =
    imp.ritenutaAttiva && !forfettario
      ? round2((fattura.imponibile + rivalsa) * imp.aliquotaRitenuta)
      : 0;

  const totale = round2(
    fattura.imponibile + rivalsa + integrativaCassa + iva + (imp.bolloAddebitato ? bollo : 0),
  );
  const nettoIncasso = round2(totale - ritenuta);
  const scadenza = aggiungiGiorni(fattura.dataEmissione, imp.terminiPagamento);
  const incassata = Boolean(fattura.dataIncasso);

  /*
    Quanto è entrato davvero, e in che proporzione.

    `importoIncassato` assente vuol dire «tutto»: è la semantica che l'app ha
    sempre avuto, e tenerla fa sì che nessun archivio scritto prima di questo
    campo cambi un numero. Quando c'è, è la cifra letta sull'estratto conto —
    IVA compresa, ritenuta già trattenuta — e la quota che ne esce divide allo
    stesso modo imponibile, IVA e ritenuta.

    Su un pagamento al netto di una nota di credito la proporzione è esatta. Su
    un acconto qualunque è un'approssimazione, ed è il prezzo di non chiedere a
    chi usa l'app di scomporre un bonifico a mano.
  */
  const incassato = incassata ? round2(fattura.importoIncassato ?? nettoIncasso) : 0;
  const quotaIncassata = nettoIncasso > 0 ? incassato / nettoIncasso : incassata ? 1 : 0;
  /*
    Quanto resta da incassare si misura sul **dovuto**, non sul totale: le note
    di credito abbassano quello che il cliente deve, nella stessa proporzione in
    cui abbassano l'imponibile.
  */
  const quotaDovuta =
    fattura.imponibile > 0
      ? Math.max(0, fattura.imponibile - stornato) / fattura.imponibile
      : 1;
  const nettoDovuto = round2(nettoIncasso * quotaDovuta);
  const daIncassare = round2(Math.max(0, nettoDovuto - incassato));
  /*
    L'eccesso invece si misura sul totale della fattura, note escluse: incassare
    più del dovuto-dopo-le-note è il caso legittimo del rimborso da fare, e lo
    dice l'avviso sulla nota. Incassare più della fattura intera è una cifra
    digitata male. Mezzo centesimo di tolleranza: un arrotondamento non è un
    errore di battitura.
  */
  const incassoEccessivo = incassato > round2(nettoIncasso) + 0.005;
  const parziale = incassata && daIncassare > 0;
  /*
    Il rovescio del residuo: è arrivato **più** del dovuto dopo le note, quindi
    c'è un rimborso da fare, e l'importo è questo. Si calcola qui e non dove si
    mostra perché qui si sa che `importoIncassato` e `nettoIncasso` stanno sulla
    stessa base — IVA compresa, ritenuta già tolta. La prima stesura lo
    ricavava dentro `controlliNote` da imponibile e aliquota, cioè su una base
    che con una ritenuta attiva è più alta di 974 €: non scattava mai, e i test
    non se ne accorgevano perché il loro scenario non aveva ritenute.

    Zero quando l'importo non è dichiarato: lì «incassata» vuol dire «tutta», e
    dedurne un rimborso sarebbe di nuovo indovinare — è la domanda che il campo
    esiste per chiudere, non per riaprire dall'altra parte.
  */
  const rimborsoDovuto =
    fattura.importoIncassato === undefined ? 0 : round2(Math.max(0, incassato - nettoDovuto));

  const giorniRitardo = incassata
    ? Math.max(0, giorniTra(scadenza, fattura.dataIncasso as string))
    : Math.max(0, giorniTra(scadenza, oggiIso));

  return {
    ...fattura,
    aliquotaIvaApplicata,
    iva,
    rivalsa,
    integrativaCassa,
    bollo,
    bolloACarico,
    ritenuta,
    totale,
    nettoIncasso,
    ricavoRilevante: round2(fattura.imponibile + rivalsa),
    incassato,
    quotaIncassata,
    ricavoIncassato: round2((fattura.imponibile + rivalsa) * quotaIncassata),
    daIncassare,
    incassoEccessivo,
    rimborsoDovuto,
    scadenza,
    stato: parziale
      ? "parziale"
      : incassata
        ? "incassato"
        : giorniRitardo > 0
          ? "scaduto"
          : "daIncassare",
    giorniIncasso: incassata
      ? giorniTra(fattura.dataEmissione, fattura.dataIncasso as string)
      : null,
    giorniRitardo,
  };
}

/**
 * Calcola i derivati di un costo.
 * In forfettario deducibilità e IVA detraibile si azzerano, ma il costo resta
 * tracciato: serve a leggere il margine reale dell'attività.
 */
export function calcolaCosto(costo: Costo, imp: Impostazioni): CostoCalcolato {
  const forfettario = imp.regime === "forfettario";
  const iva = round2(costo.imponibile * costo.aliquotaIva);
  const totale = round2(costo.imponibile + iva);

  const costoDeducibile = forfettario
    ? 0
    : round2(costo.imponibile * (costo.percentualeDeducibilita ?? 1));

  // L'Excel forzava il 100% di detraibilità in ordinario: sbagliato per auto,
  // telefonia e ristoranti. Qui la percentuale è del singolo documento.
  const percentualeDetraibile = forfettario ? 0 : (costo.percentualeDetraibilitaIva ?? 1);
  const ivaDetraibile = round2(iva * percentualeDetraibile);

  return {
    ...costo,
    iva,
    totale,
    costoDeducibile,
    ivaDetraibile,
    costoNetto: round2(totale - ivaDetraibile),
    stato: costo.dataPagamento ? "pagato" : "daPagare",
  };
}

/**
 * Riporta una fattura calcolata alla sua forma grezza, elencando i campi uno a
 * uno. È il punto in cui si applica la regola: nel database non entra nulla che
 * si possa ricalcolare. Aggiungere un derivato senza toccare questa funzione
 * non lo fa finire per sbaglio nell'archivio.
 */
export function fatturaGrezza(f: Fattura | FatturaCalcolata): Fattura {
  return {
    id: f.id,
    dataEmissione: f.dataEmissione,
    numero: f.numero,
    clienteId: f.clienteId,
    descrizione: f.descrizione,
    tipoRicavo: f.tipoRicavo,
    imponibile: f.imponibile,
    ...(f.aliquotaIva === undefined ? {} : { aliquotaIva: f.aliquotaIva }),
    dataIncasso: f.dataIncasso ?? null,
    // Assente resta assente: `undefined` qui significa «è arrivato tutto», e
    // scriverci un numero d'ufficio cambierebbe il senso di ogni riga vecchia.
    ...(f.importoIncassato === undefined ? {} : { importoIncassato: f.importoIncassato }),
  };
}

export function costoGrezzo(c: Costo | CostoCalcolato): Costo {
  return {
    id: c.id,
    dataDocumento: c.dataDocumento,
    fornitore: c.fornitore,
    categoria: c.categoria,
    descrizione: c.descrizione,
    natura: c.natura,
    imponibile: c.imponibile,
    aliquotaIva: c.aliquotaIva,
    percentualeDeducibilita: c.percentualeDeducibilita,
    ...(c.percentualeDetraibilitaIva === undefined
      ? {}
      : { percentualeDetraibilitaIva: c.percentualeDetraibilitaIva }),
    dataPagamento: c.dataPagamento ?? null,
  };
}
