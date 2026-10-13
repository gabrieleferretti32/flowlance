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
 * Le righe del registro non sono più tutte licenze.
 *
 * Da quando esiste `--rimborso`, in `emesse.jsonl` ci sono due specie di riga:
 * le licenze, come sempre, e i rimborsi, che portano `tipo: "rimborso"`. Le
 * righe vecchie non hanno nessun `tipo` e sono licenze: trattarle diversamente
 * vorrebbe dire che il registro di ieri non si legge più.
 *
 * Perché un rimborso è una **riga nuova** e non un campo sulla licenza: il
 * registro è un giornale, non uno stato. Tornare indietro a modificare la riga
 * di un'emissione vorrebbe dire riscrivere un documento già scritto, e perdere
 * la data in cui la cosa è successa — che è l'unica informazione per cui un
 * giornale esiste.
 */
export const eLicenza = (r) => r?.tipo === undefined || r.tipo === "licenza";
export const eRimborso = (r) => r?.tipo === "rimborso";

/**
 * Le licenze già emesse a quell'indirizzo, dalla più vecchia alla più recente.
 */
export function storicoDi(righe, email) {
  const cercata = normalizzaEmail(email);
  return righe
    .filter((r) => eLicenza(r) && normalizzaEmail(r.email) === cercata)
    .sort((a, b) => String(a.emessaIl ?? "").localeCompare(String(b.emessaIl ?? "")));
}

/** I rimborsi annotati per quell'indirizzo, dal più vecchio al più recente. */
export function rimborsiDi(righe, email) {
  const cercata = normalizzaEmail(email);
  return righe
    .filter((r) => eRimborso(r) && normalizzaEmail(r.email) === cercata)
    .sort((a, b) => String(a.data ?? "").localeCompare(String(b.data ?? "")));
}

/**
 * Questa licenza è stata rimborsata?
 *
 * Si confronta la **chiave** quando c'è: è l'unica cosa che identifica una
 * licenza senza ambiguità. Due licenze dello stesso indirizzo possono avere la
 * stessa scadenza — un rinnovo anticipato emesso due volte per sbaglio — e
 * confrontare solo le date rimborserebbe quella sbagliata. Senza chiave si
 * ripiega su emissione più scadenza, e lo si fa sapendo che è un ripiego.
 */
export function rimborsata(licenza, rimborsi) {
  return rimborsi.some((r) =>
    r.chiave && licenza.chiave
      ? r.chiave === licenza.chiave
      : r.licenzaEmessaIl === licenza.emessaIl && r.licenzaScadenza === licenza.scadenza,
  );
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
export function raccontaStorico(precedenti, oggi = null, contorno = {}) {
  const scambi = contorno.scambi ?? { cedute: [], ricevute: [] };
  const rimborsi = contorno.rimborsi ?? [];
  const fondatore = contorno.fondatore ?? null;
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
  /*
    Le licenze rimborsate restano nell'elenco, **marcate**. Toglierle farebbe
    sparire dal racconto un contratto che è esistito e di cui resta la nota di
    credito; marcarle dice tutte e due le cose — c'è stata, e non c'è più.
  */
  const righe = [
    `È la ${numeroLicenza}ª licenza per questo indirizzo — ${rinnovi} ${rinnovi === 1 ? "rinnovo" : "rinnovi"} dopo il primo acquisto.`,
    "Precedenti:",
    ...precedenti.map((p, i) => {
      const r = rimborsi.find((x) =>
        x.chiave && p.chiave
          ? x.chiave === p.chiave
          : x.licenzaEmessaIl === p.emessaIl && x.licenzaScadenza === p.scadenza,
      );
      const coda = r ? ` — RIMBORSATA il ${r.data ?? "?"}, uso cessato dal ${r.cessaIl ?? "?"}` : "";
      return `  ${i + 1}. emessa il ${p.emessaIl ?? "?"}, valida fino al ${p.scadenza ?? "?"}${coda}`;
    }),
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
  /*
    La scadenza su cui si misura la finestra, e il comma 8.

    Per chi ha ceduto la licenza, la scadenza dell'ultima riga del suo storico
    **è** la scadenza originaria della licenza trasferita: la riga resta la
    sua, il trasferimento ne ha creata una nuova intestata ad altri. Il comma 8
    dice esattamente questo — «per il suo successivo acquisto si considera la
    scadenza originaria della licenza trasferita» — e quindi il conto non
    cambia. Cambia che adesso si sa perché è giusto, e si dice.
  */
  const ultima = precedenti[precedenti.length - 1];
  const ceduta = scambi.cedute.some((c) => c.scadenza === ultima?.scadenza);
  const finestra = oggi === null ? null : finestraDiRinnovo(ultima?.scadenza, oggi);
  if (oggi !== null) {
    if (ceduta) {
      righe.push(
        "La licenza con questa scadenza è stata trasferita: per il comma 8 la finestra si misura",
        "sulla sua scadenza originaria, che è quella qui sotto.",
      );
    }
    righe.push(...raccontaFinestra(ultima?.scadenza, oggi));
  }
  righe.push(...suiTrasferimenti);
  if (fondatore !== null) righe.push(...righeDeiFondatori(fondatore, precedenti[0]?.email));
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
        Qui, fino al 13 ottobre, c'era una domanda aperta: dopo una cessione la
        finestra si misura su una scadenza che non è più di chi ha ceduto, e su
        quale acquisto si applicasse il beneficio non lo diceva nessun comma.
        Il comma 8 l'ha chiusa, e adesso la riga racconta la regola invece di
        segnalare il buco.
      */
      "  Per il comma 8 il suo prossimo acquisto si misura su questa scadenza: entro 30 giorni",
      "  da lì vale il prezzo garantito, oltre vale il listino.",
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

/**
 * `data` più `mesi` mesi, col giorno schiacciato sulla fine del mese.
 *
 * Il 31 agosto più sei mesi è il 28 febbraio (o il 29): non esiste un 31
 * febbraio, e la scelta è fra schiacciare e scivolare al primo marzo.
 * Schiacciare tiene la scadenza **dentro** il mese che l'acquirente si
 * aspetta; scivolare regalerebbe un giorno e sposterebbe il rinnovo in un
 * mese che sulla fattura non c'entra niente.
 *
 * Anche questa è la gemella di quella in `src/lib/sito/calendario.ts`, e lo
 * stesso test le interroga tutte e due: vedi `piuGiorni` qui sopra per il
 * perché la copia esiste.
 */
export function piuMesi(data, mesi) {
  const anno = Number(String(data).slice(0, 4));
  const mese = Number(String(data).slice(5, 7));
  const giorno = Number(String(data).slice(8, 10));
  const totale = anno * 12 + (mese - 1) + Number(mesi);
  const annoNuovo = Math.floor(totale / 12);
  const meseNuovo = (totale % 12) + 1;
  const ultimo = giorniDelMese(annoNuovo, meseNuovo);
  return `${annoNuovo}-${String(meseNuovo).padStart(2, "0")}-${String(Math.min(giorno, ultimo)).padStart(2, "0")}`;
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

/*
  ─────────────────────────────────────────────────────────────────────────
  Da quando decorre un rinnovo
  ─────────────────────────────────────────────────────────────────────────

  Il punto 3: «Il rinnovo acquistato prima della scadenza della licenza in
  corso decorre dalla scadenza di quest'ultima, senza perdita dei giorni già
  pagati.»

  È la clausola che costa soldi a chi la sbaglia, e la sbaglia **in silenzio**:
  una licenza emessa oggi, a chi ne ha una valida fino a marzo, gli toglie
  cinque mesi che aveva pagato. Nessun errore, nessuna riga storta — una
  scadenza plausibile, calcolata sulla data sbagliata, che nessuno confronta
  con quella di prima.

  Chi rinnova **dopo** la scadenza riparte dal giorno dell'emissione: non c'è
  niente da attaccare, e far decorrere dalla scadenza vecchia gli venderebbe
  dei giorni già passati.
*/

/** La data da cui far partire i 12 mesi: la scadenza in corso, se c'è ancora. */
export function baseDelRinnovo(precedenti, oggi) {
  const valide = precedenti
    .map((p) => p.scadenza)
    .filter((s) => ISO.test(String(s ?? "")) && s >= oggi)
    .sort();
  return valide.length > 0 ? valide[valide.length - 1] : oggi;
}

/**
 * La scadenza della licenza nuova.
 *
 * `durata` è `{ mesi }` o `{ anni }`; senza, un anno. Si contano **dalla
 * base**, che è la scadenza in corso quando ce n'è una: è la differenza fra
 * rinnovare e ricominciare.
 */
export function scadenzaDelRinnovo(precedenti, oggi, durata = {}) {
  const base = baseDelRinnovo(precedenti, oggi);
  const mesi = durata.mesi !== undefined && durata.mesi !== null
    ? Number(durata.mesi)
    : Number(durata.anni ?? 1) * 12;
  return { base, anticipato: base !== oggi, scadenza: piuMesi(base, mesi) };
}

/*
  ─────────────────────────────────────────────────────────────────────────
  I primi 50: chi sono, e che cosa libera un posto
  ─────────────────────────────────────────────────────────────────────────

  Il punto 6-bis conta i «primi 50 acquirenti», ordinati per data di
  conclusione del contratto, e il comma 2 toglie dal conto le licenze
  rimborsate. Due cose non entrano nel conteggio, e per due ragioni diverse:

  - **i trasferimenti**, perché chi riceve una licenza non l'ha acquistata: il
    posto resta di chi ha comprato, e il comma 7 tiene a lui anche il
    beneficio;
  - **le licenze rimborsate**, perché il comma 2 lo dice. Il posto si libera —
    non si tiene occupato da un contratto che è stato sciolto — e l'ordine
    degli altri non cambia, perché è un ordine per data: togliere una riga non
    sposta nessuna delle altre, e chi era Fondatore resta Fondatore.

  Il conto si fa sul **primo acquisto** di ogni indirizzo: i rinnovi non
  occupano un secondo posto.
*/
export function fondatori(righe, posti = 50, rimborsiTutti = null) {
  const rimborsi = rimborsiTutti ?? righe.filter(eRimborso);
  const primi = new Map();
  righe.forEach((r, indice) => {
    if (!eLicenza(r) || r.trasferitaDa) return;
    if (rimborsata(r, rimborsi.filter((x) => normalizzaEmail(x.email) === normalizzaEmail(r.email)))) return;
    const chiave = normalizzaEmail(r.email);
    const data = String(r.emessaIl ?? "");
    const gia = primi.get(chiave);
    if (!gia || data < gia.dal) primi.set(chiave, { email: r.email, dal: data, indice });
  });
  const elenco = [...primi.values()]
    .sort((a, b) => a.dal.localeCompare(b.dal) || a.indice - b.indice)
    .map((v, i) => ({ email: v.email, dal: v.dal, posizione: i + 1 }))
    .filter((v) => v.posizione <= posti);
  return {
    posti,
    elenco,
    occupati: elenco.length,
    liberi: Math.max(0, posti - elenco.length),
    rimborsiEsclusi: rimborsi.length,
  };
}

/** La posizione di un indirizzo fra i Fondatori, o `null` se non ci sta dentro. */
export function posizioneFondatore(righe, email, posti = 50) {
  const cercata = normalizzaEmail(email);
  return (
    fondatori(righe, posti).elenco.find((f) => normalizzaEmail(f.email) === cercata)?.posizione
    ?? null
  );
}

/**
 * Lo stato dei cinquanta posti, e dove sta questo indirizzo.
 *
 * Serve mentre si scrive un'email, cioè nel momento in cui si decide un
 * prezzo: «è il Fondatore numero 12» e «restano 7 posti» sono due fatti che
 * altrimenti si contano a mano sul registro, e a mano si contano male.
 */
export function righeDeiFondatori(stato, email) {
  const mio = email
    ? stato.elenco.find((f) => normalizzaEmail(f.email) === normalizzaEmail(email))
    : null;
  /*
    Singolare e plurale scritti, non lasciati al caso: «1 posti occupati» su una
    riga che qualcuno incolla in un'email al cliente è il tipo di sciatteria che
    fa dubitare anche del numero.
  */
  const posti = (n) => (n === 1 ? "1 posto" : `${n} posti`);
  const righe = [
    `Fondatori: ${posti(stato.occupati)} occupat${stato.occupati === 1 ? "o" : "i"}`
      + ` su ${stato.posti}, ${posti(stato.liberi)} liber${stato.liberi === 1 ? "o" : "i"}.`,
  ];
  if (mio) {
    righe.push(`  Questo indirizzo è il Fondatore n. ${mio.posizione}, dal ${mio.dal}.`);
  } else if (email) {
    righe.push("  Questo indirizzo NON è fra i Fondatori: vale il prezzo di listino.");
  }
  if (stato.rimborsiEsclusi > 0) {
    const n = stato.rimborsiEsclusi;
    righe.push(
      n === 1
        ? "  1 licenza rimborsata non occupa un posto (comma 2): il posto si libera e l'ordine"
          + " degli altri non cambia."
        : `  ${n} licenze rimborsate non occupano un posto (comma 2): i posti si liberano e`
          + " l'ordine degli altri non cambia.",
    );
  }
  return righe;
}
