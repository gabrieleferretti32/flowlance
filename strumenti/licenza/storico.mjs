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
 * I trasferimenti che riguardano un indirizzo, nei due versi.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché non bastava `storicoDi`
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Una licenza trasferita produce **una riga sola**, intestata al nuovo
 * titolare, che porta scritto da chi arriva (`trasferitaDa`). Per il nuovo
 * intestatario quella riga è nel suo storico e si vede; per il **vecchio** non
 * c'è niente da nessuna parte — il suo storico resta identico a prima, come se
 * la licenza fosse ancora sua.
 *
 * È il verso che conta di più, perché è quello in cui si sbaglia un prezzo:
 * chi ha ceduto la licenza mantiene il beneficio del punto 6-bis (comma 7), e
 * chi l'ha ricevuta no. Senza questa funzione, davanti a un'email di rinnovo,
 * le due situazioni si leggono uguali.
 */
export function trasferimenti(righe, email) {
  const cercata = normalizzaEmail(email);
  const perData = (a, b) => String(a.emessaIl ?? "").localeCompare(String(b.emessaIl ?? ""));
  return {
    /** Licenze che questo indirizzo ha **ceduto**: la riga è intestata ad altri. */
    cedute: righe.filter((r) => normalizzaEmail(r.trasferitaDa ?? "") === cercata).sort(perData),
    /** Licenze che questo indirizzo ha **ricevuto** da qualcun altro. */
    ricevute: righe
      .filter((r) => normalizzaEmail(r.email) === cercata && r.trasferitaDa)
      .sort(perData),
  };
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
export function raccontaStorico(precedenti, oggi = null, scambi = { cedute: [], ricevute: [] }) {
  /*
    Le righe sui trasferimenti si compongono **prima** del ramo «primo
    acquisto»: chi ha ceduto la sua unica licenza non ha più niente nel
    proprio storico, e senza questo finirebbe fra i clienti nuovi — a cui si
    fa il prezzo pieno, e che è esattamente il caso in cui il 6-bis comma 7
    dice il contrario.
  */
  const suiTrasferimenti = righeDeiTrasferimenti(scambi);
  if (precedenti.length === 0) {
    return {
      nuovo: suiTrasferimenti.length === 0,
      numeroLicenza: 1,
      rinnovi: 0,
      righe: [
        suiTrasferimenti.length === 0
          ? "Primo acquisto: nessuna licenza precedente per questo indirizzo."
          : "Nessuna licenza attiva a questo indirizzo, ma dei trasferimenti sì:",
        ...suiTrasferimenti,
      ],
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
  righe.push(...suiTrasferimenti);
  return { nuovo: false, numeroLicenza, rinnovi, righe, finestra };
}

/**
 * Le righe che raccontano i trasferimenti, e dove **non** va il prezzo.
 *
 * Il comma 7 del 6-bis, nella stesura del legale, è esplicito: il beneficio
 * del prezzo garantito è personale e non cedibile «anche in caso di
 * trasferimento della licenza ai sensi del punto 3». Sono due frasi da dire
 * ogni volta, perché la domanda arriva sempre dall'altra parte — è il nuovo
 * intestatario a scrivere, ed è a lui che verrebbe naturale fare il prezzo che
 * trova nel registro.
 */
export function righeDeiTrasferimenti({ cedute = [], ricevute = [] } = {}) {
  const righe = [];
  for (const r of cedute) {
    righe.push(
      `Licenza CEDUTA il ${r.emessaIl ?? "?"} a ${r.email} (scadenza ${r.scadenza ?? "?"}).`,
      "  Il prezzo fondatori resta a questo indirizzo: il punto 6-bis, comma 7, lo dice personale",
      "  e non cedibile anche in caso di trasferimento.",
      /*
        E una cosa che il contratto non dice, detta come non detta.

        La finestra del comma 3 si misura sulla scadenza della «licenza in
        corso». Dopo una cessione, a quella scadenza non c'è più niente da
        rinnovare per chi ha ceduto: il beneficio resta suo (comma 7), ma su
        quale acquisto si applichi non lo scrive nessun comma. Tacere qui
        vorrebbe dire far credere che il riquadro della finestra parli di una
        licenza che questo indirizzo non ha più.
      */
      "  Attenzione: la finestra qui sopra è calcolata su quella scadenza. Dopo la cessione, a",
      "  quel termine non c'è più niente da rinnovare per questo indirizzo — il beneficio resta",
      "  suo, ma su quale acquisto si applichi il contratto non lo dice. Da chiedere al legale.",
    );
  }
  for (const r of ricevute) {
    righe.push(
      `Licenza RICEVUTA il ${r.emessaIl ?? "?"} da ${r.trasferitaDa} (scadenza ${r.scadenza ?? "?"}).`,
      "  Il prezzo fondatori NON è arrivato con la licenza (6-bis, comma 7): per questo indirizzo",
      "  vale il listino, a meno che sia Fondatore per un acquisto suo.",
    );
  }
  return righe;
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
