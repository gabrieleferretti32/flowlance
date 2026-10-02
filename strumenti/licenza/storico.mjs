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
export function raccontaStorico(precedenti) {
  if (precedenti.length === 0) {
    return { nuovo: true, numeroLicenza: 1, rinnovi: 0, righe: ["Primo acquisto: nessuna licenza precedente per questo indirizzo."] };
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
  return { nuovo: false, numeroLicenza, rinnovi, righe };
}
