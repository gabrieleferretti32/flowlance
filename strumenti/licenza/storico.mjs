/**
 * Chi è già cliente, e da quando: il registro delle licenze letto all'indietro.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * A che cosa serve
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Prima di emettere una chiave, sapere se quell'indirizzo ne ha già ricevute.
 * È l'informazione che serve ad applicare un prezzo di rinnovo, e oggi
 * l'unico modo di averla è ricordarsela — che per i primi dieci clienti
 * funziona e all'undicesimo no.
 *
 * Non c'è nessun archivio nuovo da costruire: `emesse.jsonl` esiste già, una
 * riga per licenza, scritta da `genera-licenza.mjs` a ogni emissione. Qui si
 * legge soltanto.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Il modulo è separato dallo script perché si possa provare
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Uno strumento che si prova solo emettendo una licenza vera non si prova:
 * ogni verifica lascerebbe una riga nel registro e una chiave firmata in giro.
 * Qui dentro non c'è nessun accesso al disco — si passa il testo del registro
 * — e `storico.test.mjs` lo esercita sui casi che contano, quello della
 * maiuscola compresa.
 */

/**
 * L'indirizzo in forma confrontabile.
 *
 * Serve **solo a confrontare**, mai a scrivere: nel registro e dentro la
 * chiave firmata l'indirizzo resta quello digitato. `Mario@Example.com` e
 * `mario@example.com` sono la stessa casella per qualunque server di posta, e
 * trattarli come due clienti vorrebbe dire far pagare il prezzo pieno a chi ha
 * diritto al rinnovo — senza che niente lo segnali, perché nel registro le due
 * righe ci sono entrambe.
 *
 * La parte locale di un indirizzo sarebbe sensibile alle maiuscole secondo la
 * RFC 5321, e nella pratica nessun fornitore si comporta così. Qui vince la
 * pratica: il danno di sbagliare in questo verso è un prezzo sbagliato, quello
 * di sbagliare nell'altro è un cliente trattato da sconosciuto.
 */
export function normalizzaEmail(grezza) {
  return String(grezza ?? "").trim().toLowerCase();
}

/**
 * Le righe del registro, saltando quelle illeggibili.
 *
 * Un file di righe JSON accumulato per anni può avere una riga troncata — un
 * disco pieno, un processo ucciso a metà scrittura. Fermarsi lì vorrebbe dire
 * non sapere più niente di nessuno per colpa di una riga: si salta, e si dice
 * quante se ne sono saltate, perché una riga persa in silenzio è un cliente
 * che risulta nuovo senza esserlo.
 */
export function leggiRegistro(testo) {
  const righe = [];
  let illeggibili = 0;
  for (const riga of String(testo ?? "").split("\n")) {
    const pulita = riga.trim();
    if (!pulita) continue;
    try {
      const voce = JSON.parse(pulita);
      if (voce && typeof voce === "object" && typeof voce.email === "string") righe.push(voce);
      else illeggibili += 1;
    } catch {
      illeggibili += 1;
    }
  }
  return { righe, illeggibili };
}

/**
 * Le licenze già emesse a quell'indirizzo, dalla più vecchia alla più recente.
 */
export function storicoDi(righe, email) {
  const cercata = normalizzaEmail(email);
  return righe
    .filter((r) => normalizzaEmail(r.email) === cercata)
    .sort((a, b) => String(a.emessaIl ?? "").localeCompare(String(b.emessaIl ?? "")));
}

/**
 * Come si racconta, senza lasciare spazio all'ambiguità.
 *
 * «Rinnovo n. 3» non vuol dire niente da solo: può essere la terza licenza o
 * il terzo rinnovo dopo il primo acquisto, e fra le due c'è una licenza di
 * differenza — cioè il prezzo sbagliato, nel verso che costa. Perciò si
 * stampano tutti e due i numeri, con le date, e chi legge non deve contare
 * niente.
 */
export function raccontaStorico(precedenti, oggi = null) {
  if (precedenti.length === 0) {
    return {
      nuovo: true,
      numeroLicenza: 1,
      rinnovi: 0,
      righe: ["Primo acquisto: nessuna licenza precedente per questo indirizzo."],
      finestra: null,
    };
  }
  const numeroLicenza = precedenti.length + 1;
  const rinnovi = precedenti.length;
  const righe = [
    `È la ${numeroLicenza}ª licenza per questo indirizzo — ${rinnovi} ${rinnovi === 1 ? "rinnovo" : "rinnovi"} dopo il primo acquisto.`,
    "Precedenti:",
    ...precedenti.map(
      (p, i) => `  ${i + 1}. emessa il ${p.emessaIl ?? "?"}, valida fino al ${p.scadenza ?? "?"}`,
    ),
  ];
  /*
    Gli indirizzi scritti con maiuscole diverse nel registro: si nominano,
    perché sono la ragione per cui questo conto è giusto e non si vede.
  */
  const grafie = [...new Set(precedenti.map((p) => p.email))];
  if (grafie.length > 1) {
    righe.push(`Scritto in ${grafie.length} modi diversi nel registro: ${grafie.join(", ")}`);
  }
  /*
    E da che parte della finestra dei 30 giorni siamo, se chi chiama sa che
    giorno è. Senza `oggi` non si dice niente: una finestra calcolata
    sull'orologio di dentro non si potrebbe provare, e questo modulo non legge
    nessuno stato del mondo di proposito.
  */
  const ultima = precedenti[precedenti.length - 1];
  const finestra = oggi === null ? null : finestraDiRinnovo(ultima?.scadenza, oggi);
  if (oggi !== null) righe.push(...raccontaFinestra(ultima?.scadenza, oggi));
  return { nuovo: false, numeroLicenza, rinnovi, righe, finestra };
}

/*
  ─────────────────────────────────────────────────────────────────────────
  La finestra dei 30 giorni del punto 6-bis
  ─────────────────────────────────────────────────────────────────────────

  Il comma 3 garantisce il prezzo dei Fondatori «a ciascun rinnovo acquistato
  prima della scadenza della licenza in corso o entro 30 giorni dalla stessa»,
  e il comma 4 dice che al rinnovo acquistato oltre quel termine si applica il
  prezzo di listino, **senza** che il ritardo faccia perdere la qualità di
  Fondatore: il rinnovo successivo fatto nel termine torna al prezzo garantito.

  Quindi quello che si decide qui è il prezzo di **questo** rinnovo, non lo
  stato permanente di un cliente. È una cosa da sapere prima di scrivere una
  cifra in una email, e oggi non c'è nessun posto dove leggerla: il registro ha
  la data di scadenza dell'ultima licenza, e il conto si fa a mente. A mente, il
  trentunesimo giorno somiglia molto al trentesimo.

  Qui si dice soltanto da che parte della finestra siamo. Non si decide nessun
  prezzo, non si blocca nessuna emissione: la clausola ha commi che un conto
  non copre — il comma 5 (se il listino è più basso vince il listino) e il
  comma 2 (le licenze rimborsate non contano) — e uno strumento che decidesse
  al posto di chi legge sbaglierebbe proprio nei casi in cui serve pensare.

  E soprattutto non dice mai «garanzia persa». Il comma 4 riscritto non toglie
  niente a nessuno in modo definitivo: toglie il prezzo garantito a **quel**
  rinnovo. Scriverlo come una perdita definitiva — che è come era scritto
  prima — avrebbe fatto trattare da ex cliente chi ha solo tardato di una
  settimana.

  ─────────────────────────────────────────────────────────────────────────
  «Entro 30 giorni» qui vuol dire che il trentesimo va bene
  ─────────────────────────────────────────────────────────────────────────

  È il verso opposto a quello di `src/lib/sito/calendario.ts`, dove
  `scaduto(d, 30, oggi)` diventa vero **al** trentesimo giorno: là il termine
  è il tempo che si ha per *compiere un dovere* — cancellare dei dati — e al
  trentesimo il dovere è esigibile. Qui il termine è un *diritto* di chi
  compra, e un diritto «entro 30 giorni» comprende il trentesimo. Lo stesso
  numero, letto nei due versi, dà due giorni diversi: scriverlo è meno
  rischioso che ricordarselo.
*/

/** I giorni di grazia del comma 3. Un test lo confronta col contratto. */
export const GIORNI_DI_GRAZIA = 30;

const GIORNI_PER_MESE = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const bisestile = (anno) => (anno % 4 === 0 && anno % 100 !== 0) || anno % 400 === 0;
const giorniDelMese = (anno, mese) => (mese === 2 && bisestile(anno) ? 29 : GIORNI_PER_MESE[mese - 1]);

/**
 * `data` più `giorni` giorni, sulle cifre della stringa e senza nessun `Date`.
 *
 * È la stessa funzione di `src/lib/sito/calendario.ts`, riscritta qui perché
 * questo strumento gira con `node` nudo — e un `import` di un file `.ts` da
 * uno `.mjs` chiede a Node una funzione sperimentale che sulla versione 20,
 * che `package.json` dichiara di sostenere, non c'è.
 *
 * La copia non si regge sulla buona volontà: `storico.test.mjs` importa tutte
 * e due le implementazioni e pretende che diano la stessa risposta su un anno
 * intero di date, passaggi di mese e di anno e 29 febbraio compresi. Il giorno
 * in cui una delle due cambia, il test cade.
 *
 * `new Date("2027-09-12")` nasce a mezzanotte UTC: letto da un fuso a est è
 * già il tredici, e la finestra dei trenta giorni si chiuderebbe un giorno
 * prima del dovuto per chi la guarda da Tokyo.
 */
export function piuGiorni(data, giorni) {
  let anno = Number(String(data).slice(0, 4));
  let mese = Number(String(data).slice(5, 7));
  let giorno = Number(String(data).slice(8, 10));
  let resto = giorni;
  while (resto > 0) {
    const disponibili = giorniDelMese(anno, mese) - giorno;
    if (resto <= disponibili) {
      giorno += resto;
      resto = 0;
    } else {
      resto -= disponibili + 1;
      giorno = 1;
      mese += 1;
      if (mese > 12) {
        mese = 1;
        anno += 1;
      }
    }
  }
  return `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Da che parte della finestra siamo, rispetto alla scadenza dell'ultima licenza.
 *
 * - `prima`: la licenza è ancora valida, il rinnovo è nei termini.
 * - `grazia`: scaduta, ma dentro i 30 giorni. `giorno` dice quale.
 * - `oltre`: fuori termine. **Questo** rinnovo si paga a listino; chi lo
 *   compra resta Fondatore, e il prossimo fatto nel termine torna al prezzo
 *   garantito.
 * - `ignota`: nel registro non c'è una scadenza leggibile, e un conto su una
 *   data inventata direbbe «prezzo garantito» con la stessa sicurezza.
 */
export function finestraDiRinnovo(scadenza, oggi, giorni = GIORNI_DI_GRAZIA) {
  if (!ISO.test(String(scadenza ?? "")) || !ISO.test(String(oggi ?? ""))) {
    return { stato: "ignota", scadenza: scadenza ?? null, ultimoGiorno: null, giorno: null };
  }
  const ultimoGiorno = piuGiorni(scadenza, giorni);
  if (oggi <= scadenza) return { stato: "prima", scadenza, ultimoGiorno, giorno: null };
  if (oggi <= ultimoGiorno) {
    let giorno = null;
    for (let n = 1; n <= giorni; n += 1) {
      if (piuGiorni(scadenza, n) === oggi) {
        giorno = n;
        break;
      }
    }
    return { stato: "grazia", scadenza, ultimoGiorno, giorno };
  }
  return { stato: "oltre", scadenza, ultimoGiorno, giorno: null };
}

/**
 * Le righe che raccontano la finestra. Informazione, non una decisione.
 *
 * Il prezzo non lo scrive questo strumento: lo scrive chi manda l'email, e lo
 * scrive guardando anche i commi che un conto non sa leggere.
 */
export function raccontaFinestra(scadenza, oggi, giorni = GIORNI_DI_GRAZIA) {
  const f = finestraDiRinnovo(scadenza, oggi, giorni);
  if (f.stato === "ignota") {
    return [
      `Finestra del prezzo fondatori: non la so dire — nell'ultima licenza la scadenza è «${f.scadenza ?? "assente"}».`,
      `  Il punto 6-bis la lega alla scadenza, e su una data illeggibile ogni conto sarebbe inventato.`,
    ];
  }
  if (f.stato === "prima") {
    return [
      `Finestra del prezzo fondatori: aperta. La licenza in corso scade il ${f.scadenza}, oggi è ${oggi}.`,
      `  Rinnovando entro il ${f.ultimoGiorno} vale il prezzo garantito dal punto 6-bis, comma 3.`,
    ];
  }
  if (f.stato === "grazia") {
    return [
      `Finestra del prezzo fondatori: aperta, ma siamo oltre la scadenza (${f.scadenza})`
        + `${f.giorno === null ? "" : ` — giorno ${f.giorno} di ${giorni}`}.`,
      `  Ultimo giorno utile: ${f.ultimoGiorno}. Dopo, per il comma 4, questo rinnovo va a listino.`,
    ];
  }
  return [
    `Finestra del prezzo fondatori: questo rinnovo è FUORI TERMINE. La licenza è scaduta il`
      + ` ${f.scadenza} e i ${giorni} giorni del comma 3 sono finiti il ${f.ultimoGiorno}.`,
    `  Per il comma 4 si applica il prezzo di listino di oggi. **Resta Fondatore**: il prossimo`,
    `  rinnovo acquistato nel termine torna al prezzo garantito.`,
  ];
}
