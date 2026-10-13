import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GIORNI_DI_GRAZIA,
  finestraDiRinnovo,
  raccontaFinestra,
  leggiRegistro,
  normalizzaEmail,
  piuGiorni,
  raccontaStorico,
  fondatori,
  piuMesi,
  posizioneFondatore,
  righeDeiFondatori,
  rimborsata,
  rimborsiDi,
  scadenzaDelRinnovo,
  storicoDi,
  trasferimenti,
} from "./storico.mjs";

const riga = (email, emessaIl, scadenza) =>
  JSON.stringify({ email, scadenza, emessaIl, chiave: "FLW1.x.y" });

const REGISTRO = [
  riga("mario@example.com", "2026-09-12", "2027-09-12"),
  riga("altro@example.com", "2026-10-01", "2027-10-01"),
  riga("Mario@Example.com", "2027-09-14", "2028-09-14"),
].join("\n");

describe("normalizzaEmail", () => {
  it("confronta senza guardare maiuscole e spazi", () => {
    expect(normalizzaEmail("  Mario@Example.COM ")).toBe("mario@example.com");
  });

  it("regge anche quello che non è una stringa", () => {
    expect(normalizzaEmail(undefined)).toBe("");
    expect(normalizzaEmail(null)).toBe("");
  });
});

describe("leggiRegistro", () => {
  it("legge le righe buone", () => {
    const { righe, illeggibili } = leggiRegistro(REGISTRO);
    expect(righe).toHaveLength(3);
    expect(illeggibili).toBe(0);
  });

  it("salta le righe vuote senza contarle fra le illeggibili", () => {
    const { righe, illeggibili } = leggiRegistro(`${REGISTRO}\n\n\n`);
    expect(righe).toHaveLength(3);
    expect(illeggibili).toBe(0);
  });

  /*
    Una riga troncata non deve far perdere tutte le altre: sarebbe un cliente
    che risulta nuovo per colpa di un disco pieno di due anni fa.
  */
  it("una riga troncata non manda in pezzi la lettura, e viene contata", () => {
    const { righe, illeggibili } = leggiRegistro(`${REGISTRO}\n{"email":"rotta@exa`);
    expect(righe).toHaveLength(3);
    expect(illeggibili).toBe(1);
  });

  it("una riga senza email non è una licenza", () => {
    const { righe, illeggibili } = leggiRegistro('{"scadenza":"2027-01-01"}');
    expect(righe).toHaveLength(0);
    expect(illeggibili).toBe(1);
  });

  it("un registro che non c'è è un registro vuoto", () => {
    expect(leggiRegistro("").righe).toHaveLength(0);
    expect(leggiRegistro(undefined).righe).toHaveLength(0);
  });
});

describe("storicoDi", () => {
  const { righe } = leggiRegistro(REGISTRO);

  /*
    Il caso che costa: lo stesso cliente scritto con la maiuscola. Senza
    questo confronto risulterebbe un primo acquisto, e pagherebbe il prezzo
    pieno un anno dopo averlo già pagato.
  */
  it("trova lo stesso cliente anche scritto con un'altra grafia", () => {
    expect(storicoDi(righe, "MARIO@example.com")).toHaveLength(2);
  });

  it("non confonde due clienti diversi", () => {
    expect(storicoDi(righe, "altro@example.com")).toHaveLength(1);
  });

  it("chi non c'è non ha storia", () => {
    expect(storicoDi(righe, "nessuno@example.com")).toHaveLength(0);
  });

  it("le restituisce dalla più vecchia alla più recente", () => {
    const s = storicoDi(righe, "mario@example.com");
    expect(s.map((x) => x.emessaIl)).toEqual(["2026-09-12", "2027-09-14"]);
  });

  it("l'ordine non dipende da come sono scritte nel file", () => {
    const alContrario = leggiRegistro(REGISTRO.split("\n").reverse().join("\n")).righe;
    const s = storicoDi(alContrario, "mario@example.com");
    expect(s.map((x) => x.emessaIl)).toEqual(["2026-09-12", "2027-09-14"]);
  });
});

describe("raccontaStorico", () => {
  const { righe } = leggiRegistro(REGISTRO);

  it("il primo acquisto si dice tale", () => {
    const r = raccontaStorico(storicoDi(righe, "nuovo@example.com"));
    expect(r.nuovo).toBe(true);
    expect(r.numeroLicenza).toBe(1);
    expect(r.rinnovi).toBe(0);
    expect(r.righe[0]).toContain("Primo acquisto");
  });

  /*
    I due numeri, e perché ci sono tutti e due.

    «Rinnovo n. 3» non vuol dire niente da solo: fra la terza licenza e il
    terzo rinnovo c'è una licenza di differenza, cioè il prezzo sbagliato.
    Questo test fissa che si dicano entrambi, non uno.
  */
  it("dice la licenza e i rinnovi, che non sono lo stesso numero", () => {
    const r = raccontaStorico(storicoDi(righe, "mario@example.com"));
    expect(r.numeroLicenza).toBe(3);
    expect(r.rinnovi).toBe(2);
    expect(r.righe[0]).toContain("3ª licenza");
    expect(r.righe[0]).toContain("2 rinnovi");
  });

  it("al primo rinnovo il singolare", () => {
    const r = raccontaStorico(storicoDi(righe, "altro@example.com"));
    expect(r.numeroLicenza).toBe(2);
    expect(r.righe[0]).toContain("1 rinnovo");
    expect(r.righe[0]).not.toContain("rinnovi");
  });

  it("elenca le precedenti con le loro date", () => {
    const r = raccontaStorico(storicoDi(righe, "mario@example.com"));
    expect(r.righe.join("\n")).toContain("emessa il 2026-09-12, valida fino al 2027-09-12");
  });

  it("segnala quando lo stesso indirizzo è scritto in più modi", () => {
    const r = raccontaStorico(storicoDi(righe, "mario@example.com"));
    expect(r.righe.join("\n")).toContain("2 modi diversi");
  });

  it("e non lo segnala quando la grafia è una sola", () => {
    const r = raccontaStorico(storicoDi(righe, "altro@example.com"));
    expect(r.righe.join("\n")).not.toContain("modi diversi");
  });

  /*
    La finestra si racconta a partire dalla **più recente** delle precedenti, e
    `storicoDi` le ordina dalla più vecchia: prendere la prima darebbe la
    scadenza di tre anni fa, cioè «fuori termine» a chiunque rinnovi da tempo.
    Qui l'ultima di mario scade il 2028-09-14.
  */
  it("racconta la finestra sull'ultima licenza, non sulla prima", () => {
    const r = raccontaStorico(storicoDi(righe, "mario@example.com"), "2028-09-20");
    expect(r.finestra.stato).toBe("grazia");
    expect(r.finestra.scadenza).toBe("2028-09-14");
    expect(r.righe.join("\n")).toContain("Ultimo giorno utile: 2028-10-14");
  });

  it("e non dice niente della finestra se non sa che giorno è", () => {
    const r = raccontaStorico(storicoDi(righe, "mario@example.com"));
    expect(r.finestra).toBeNull();
    expect(r.righe.join("\n")).not.toContain("Finestra del prezzo fondatori");
  });

  it("al primo acquisto non c'è nessuna finestra da raccontare", () => {
    const r = raccontaStorico(storicoDi(righe, "nessuno@example.com"), "2028-09-20");
    expect(r.nuovo).toBe(true);
    expect(r.finestra).toBeNull();
  });
});

/*
  ─────────────────────────────────────────────────────────────────────────
  La finestra dei 30 giorni del punto 6-bis
  ─────────────────────────────────────────────────────────────────────────

  Il valore di questi test sta quasi tutto in due casi: il trentesimo giorno e
  il trentunesimo. Nel mezzo non si sbaglia mai; sul bordo si sbaglia sempre, e
  si sbaglia di un giorno — che è l'errore che non si vede guardando lo schermo
  e si vede soltanto quando un cliente chiede perché ha pagato di più.
*/
describe("finestraDiRinnovo", () => {
  const SCADENZA = "2027-09-12";

  it("prima della scadenza la finestra è aperta", () => {
    expect(finestraDiRinnovo(SCADENZA, "2027-09-11").stato).toBe("prima");
  });

  it("il giorno della scadenza è ancora «prima»: la licenza vale tutto il giorno", () => {
    expect(finestraDiRinnovo(SCADENZA, SCADENZA).stato).toBe("prima");
  });

  it("il giorno dopo si entra nei 30, ed è il primo", () => {
    const f = finestraDiRinnovo(SCADENZA, "2027-09-13");
    expect(f.stato).toBe("grazia");
    expect(f.giorno).toBe(1);
    expect(f.ultimoGiorno).toBe("2027-10-12");
  });

  /*
    «Entro 30 giorni» comprende il trentesimo: è un diritto di chi compra, non
    un dovere di chi vende. In `calendario.ts` lo stesso numero gira
    nell'altro verso — `scaduto(d, 30, oggi)` è vero **al** trentesimo — e
    quella differenza è la ragione per cui questi due test esistono accanto.
  */
  it("il trentesimo giorno è dentro", () => {
    const f = finestraDiRinnovo(SCADENZA, "2027-10-12");
    expect(f.stato).toBe("grazia");
    expect(f.giorno).toBe(30);
  });

  it("il trentunesimo è fuori termine", () => {
    const f = finestraDiRinnovo(SCADENZA, "2027-10-13");
    expect(f.stato).toBe("oltre");
    expect(f.ultimoGiorno).toBe("2027-10-12");
  });

  /*
    E fuori termine **non** vuol dire fuori dai Fondatori. Il comma 4 riscritto
    manda a listino quel rinnovo e basta: chi legge queste righe sta per
    scrivere un prezzo in un'email, e «garanzia persa» gli farebbe trattare da
    ex cliente qualcuno che ha tardato di una settimana. Il testo deve dire
    tutte e due le cose, e questo test tiene la seconda.
  */
  it("e il testo dice che la qualità di Fondatore resta", () => {
    const righe = raccontaFinestra(SCADENZA, "2027-10-13").join(" ");
    expect(righe).toMatch(/prezzo di listino/i);
    expect(righe).toMatch(/Resta Fondatore/i);
    expect(righe).toMatch(/torna al prezzo garantito/i);
    expect(righe, "non deve più parlare di garanzia persa o cessata").not.toMatch(
      /pers[ao]|cessat|definitiv/i,
    );
  });

  it("senza una scadenza leggibile non si inventa nessun conto", () => {
    expect(finestraDiRinnovo(undefined, "2027-10-13").stato).toBe("ignota");
    expect(finestraDiRinnovo("settembre 2027", "2027-10-13").stato).toBe("ignota");
    expect(finestraDiRinnovo(SCADENZA, "ieri").stato).toBe("ignota");
  });

  it("attraversa il 29 febbraio senza perdere un giorno", () => {
    expect(piuGiorni("2028-02-10", 30)).toBe("2028-03-11");
    expect(piuGiorni("2027-02-10", 30)).toBe("2027-03-12");
  });
});

/*
  Le due aritmetiche delle date, pinzate insieme.

  `piuGiorni` esiste due volte: in `src/lib/sito/calendario.ts`, che serve alla
  pulizia dei contatti, e qui, perché questo strumento gira con `node` nudo e
  un `import` di un `.ts` da uno `.mjs` chiede a Node una funzione
  sperimentale che sulla versione 20 — dichiarata in `package.json` — non c'è.
  Una copia che nessuno confronta diverge: non subito, e non in modo visibile.
  Questo test le interroga tutte e due su quattro anni di date, bisestili
  compresi, e cade il giorno in cui una delle due cambia.
*/
describe("le due copie di piuGiorni dicono la stessa cosa", () => {
  it("su quattro anni di date e tre termini", async () => {
    const { piuGiorni: dalProdotto } = await import("@/lib/sito/calendario");
    const { piuMesi: mesiDalProdotto } = await import("@/lib/sito/calendario");
    const discordi = [];
    let provate = 0;
    for (let anno = 2026; anno <= 2029; anno += 1) {
      for (let mese = 1; mese <= 12; mese += 1) {
        for (const giorno of [1, 15, 28, 29, 30, 31]) {
          const data = `${anno}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;
          // Le date che non esistono (31 febbraio) non si provano: nessuno le passa.
          if (new Date(`${data}T00:00:00Z`).toISOString().slice(0, 10) !== data) continue;
          for (const giorni of [1, 30, 365]) {
            provate += 1;
            const qui = piuGiorni(data, giorni);
            const la = dalProdotto(data, giorni);
            if (qui !== la) discordi.push(`${data} + ${giorni}: qui ${qui}, nel prodotto ${la}`);
          }
          /*
            E i mesi, che servono alla decorrenza dei rinnovi: 12 è il caso
            normale, 6 e 1 sono quelli in cui il giorno si schiaccia a fine
            mese. È la stessa copia, con lo stesso patto.
          */
          for (const mesi of [1, 6, 12]) {
            provate += 1;
            const qui = piuMesi(data, mesi);
            const la = mesiDalProdotto(data, mesi);
            if (qui !== la) discordi.push(`${data} + ${mesi} mesi: qui ${qui}, nel prodotto ${la}`);
          }
        }
      }
    }
    expect(discordi, discordi.join("\n")).toEqual([]);
    expect(provate).toBeGreaterThan(400);
  });
});

/*
  E i 30 giorni sono quelli del contratto.

  È il terzo posto in cui quel numero vive — la clausola, la card dell'offerta,
  questo strumento — e l'unico in cui sbagliarlo non si vede: nessuna pagina
  cambia, nessun test di interfaccia cade, e chi emette la licenza legge una
  finestra che il contratto non dà.
*/
describe("i giorni di grazia", () => {
  it("sono quelli che il punto 6-bis, comma 3, scrive", () => {
    const contratto = readFileSync("contenuti/termini.md", "utf8");
    const dal = contratto.indexOf("## 6-bis.");
    expect(dal, "in contenuti/termini.md non c'è il punto 6-bis").toBeGreaterThan(-1);
    const al = contratto.indexOf("\n## ", dal + 1);
    const clausola = contratto.slice(dal, al < 0 ? undefined : al);
    const nel6bis = clausola.match(/entro\s+(\d+)\s+giorni dalla stessa/)?.[1];
    expect(nel6bis, "nel comma 3 non trovo «entro N giorni dalla stessa»").toBeDefined();
    expect(Number(nel6bis)).toBe(GIORNI_DI_GRAZIA);
  });
});

// ————————————————————————————————————————————————————————————
// I trasferimenti
// ————————————————————————————————————————————————————————————

/*
  Una licenza trasferita produce una riga sola, intestata al **nuovo**
  titolare. Per lui si vede nello storico; per il vecchio non ci sarebbe
  niente, e il suo storico resterebbe identico a prima.

  È il verso in cui si sbaglia un prezzo: il punto 6-bis comma 7 tiene il
  beneficio a chi ha ceduto e non lo dà a chi ha ricevuto, e senza queste
  righe le due situazioni si leggono uguali davanti a un'email di rinnovo.
*/
describe("i trasferimenti, nei due versi", () => {
  const conTrasferimento = [
    riga("primo@esempio.it", "2026-10-13", "2027-10-13"),
    JSON.stringify({
      email: "secondo@esempio.it",
      scadenza: "2027-10-13",
      emessaIl: "2026-11-02",
      chiave: "FLW1.z.z",
      trasferitaDa: "Primo@Esempio.it",
    }),
  ].join("\n");
  const righe = leggiRegistro(conTrasferimento).righe;

  it("chi ha ceduto le vede, anche se la riga non è intestata a lui", () => {
    const t = trasferimenti(righe, "primo@esempio.it");
    expect(t.cedute).toHaveLength(1);
    expect(t.cedute[0].email).toBe("secondo@esempio.it");
    expect(t.ricevute).toHaveLength(0);
  });

  it("e chi ha ricevuto le vede dall'altra parte", () => {
    const t = trasferimenti(righe, "secondo@esempio.it");
    expect(t.ricevute).toHaveLength(1);
    expect(t.ricevute[0].trasferitaDa).toBe("Primo@Esempio.it");
    expect(t.cedute).toHaveLength(0);
  });

  it("le maiuscole diverse non nascondono un trasferimento", () => {
    expect(trasferimenti(righe, "PRIMO@ESEMPIO.IT").cedute).toHaveLength(1);
  });

  it("un acquisto normale non è un trasferimento di nessuno", () => {
    const t = trasferimenti(leggiRegistro(REGISTRO).righe, "mario@example.com");
    expect(t.cedute).toEqual([]);
    expect(t.ricevute).toEqual([]);
  });

  /*
    Le due frasi che devono esserci sempre, perché sono quelle che decidono un
    prezzo. Si verificano sul **testo**, non sui dati: è il testo che finisce
    sotto gli occhi di chi sta scrivendo l'email.
  */
  it("a chi ha ceduto dice che il prezzo fondatori resta suo", () => {
    const testo = raccontaStorico(storicoDi(righe, "primo@esempio.it"), "2026-12-01", {
      scambi: trasferimenti(righe, "primo@esempio.it"),
    }).righe.join("\n");
    expect(testo).toContain("CEDUTA");
    expect(testo).toMatch(/prezzo fondatori resta a questo indirizzo/i);
    expect(testo).toContain("comma 7");
  });

  it("e a chi l'ha ricevuta che non è arrivato con la licenza", () => {
    const testo = raccontaStorico(storicoDi(righe, "secondo@esempio.it"), "2026-12-01", {
      scambi: trasferimenti(righe, "secondo@esempio.it"),
    }).righe.join("\n");
    expect(testo).toContain("RICEVUTA");
    expect(testo).toMatch(/NON è arrivato con la licenza/);
    expect(testo).toMatch(/vale il listino/);
  });

  /*
    Chi ha ceduto la sua **unica** licenza non ha più niente nel proprio
    storico: senza i trasferimenti risulterebbe un cliente nuovo, a cui si fa
    il prezzo pieno — che è esattamente il caso in cui il comma 7 dice il
    contrario.
  */
  it("chi ha ceduto tutto non risulta un cliente nuovo", () => {
    const solaCessione = leggiRegistro(
      JSON.stringify({
        email: "nuovo@esempio.it",
        scadenza: "2027-10-13",
        emessaIl: "2026-11-02",
        chiave: "FLW1.z.z",
        trasferitaDa: "vecchio@esempio.it",
      }),
    ).righe;
    const r = raccontaStorico([], "2026-12-01", {
      scambi: trasferimenti(solaCessione, "vecchio@esempio.it"),
    });
    expect(r.nuovo).toBe(false);
    expect(r.righe.join("\n")).toContain("CEDUTA");
  });

  it("ma chi non ha davvero niente resta un cliente nuovo", () => {
    expect(raccontaStorico([], "2026-12-01").nuovo).toBe(true);
  });
});

// ————————————————————————————————————————————————————————————
// La decorrenza del rinnovo (punto 3)
// ————————————————————————————————————————————————————————————

/*
  «Il rinnovo acquistato prima della scadenza della licenza in corso decorre
  dalla scadenza di quest'ultima, senza perdita dei giorni già pagati.»

  I tre casi sono il bordo: un mese prima, il giorno stesso, dieci giorni dopo.
  Nel mezzo non si sbaglia; sul bordo si sbaglia di mesi, e l'errore non si
  vede — una scadenza plausibile, calcolata sulla data sbagliata, che nessuno
  confronta con quella di prima.
*/
describe("da quando decorre un rinnovo", () => {
  const licenza = (scadenza, emessaIl = "2026-03-31") => [{ email: "x@y.it", emessaIl, scadenza }];

  it("un mese prima della scadenza: parte dalla scadenza, non da oggi", () => {
    const r = scadenzaDelRinnovo(licenza("2027-03-31"), "2027-02-28");
    expect(r.base).toBe("2027-03-31");
    expect(r.anticipato).toBe(true);
    expect(r.scadenza).toBe("2028-03-31");
  });

  it("il giorno stesso della scadenza: la licenza vale tutto il giorno, quindi ancora dalla scadenza", () => {
    const r = scadenzaDelRinnovo(licenza("2027-03-31"), "2027-03-31");
    expect(r.base).toBe("2027-03-31");
    expect(r.anticipato).toBe(false);
    expect(r.scadenza).toBe("2028-03-31");
  });

  it("dieci giorni dopo: non c'è più niente a cui attaccarsi, si parte da oggi", () => {
    const r = scadenzaDelRinnovo(licenza("2027-03-31"), "2027-04-10");
    expect(r.base).toBe("2027-04-10");
    // Non è un rinnovo anticipato: non c'è nessuna scadenza futura da cui far decorrere.
    expect(r.anticipato).toBe(false);
    expect(r.scadenza).toBe("2028-04-10");
  });

  it("al primo acquisto si parte da oggi", () => {
    expect(scadenzaDelRinnovo([], "2026-10-13").scadenza).toBe("2027-10-13");
  });

  it("e `--mesi` conta dalla stessa base, non da oggi", () => {
    expect(scadenzaDelRinnovo(licenza("2027-03-31"), "2027-02-28", { mesi: 6 }).scadenza).toBe(
      "2027-09-30",
    );
  });

  /*
    Il giorno che non esiste: 31 agosto più sei mesi. Schiacciare sul 28 (o 29)
    tiene la scadenza dentro il mese che l'acquirente si aspetta; scivolare al
    primo marzo regalerebbe un giorno e sposterebbe il rinnovo in un mese che
    sulla fattura non c'entra niente.
  */
  it("una scadenza che cadrebbe su un giorno inesistente si schiaccia a fine mese", () => {
    expect(piuMesi("2027-08-31", 6)).toBe("2028-02-29");
    expect(scadenzaDelRinnovo(licenza("2027-08-31"), "2027-08-01", { mesi: 6 }).scadenza).toBe(
      "2028-02-29",
    );
  });

  it("fra più licenze si guarda la scadenza più lontana ancora valida", () => {
    const due = [
      { email: "x@y.it", emessaIl: "2026-01-01", scadenza: "2027-01-01" },
      { email: "x@y.it", emessaIl: "2026-06-01", scadenza: "2027-06-01" },
    ];
    expect(scadenzaDelRinnovo(due, "2026-12-01").base).toBe("2027-06-01");
  });
});

// ————————————————————————————————————————————————————————————
// I rimborsi, e i cinquanta posti
// ————————————————————————————————————————————————————————————

describe("i rimborsi", () => {
  const licenza = (email, emessaIl, scadenza, chiave) =>
    JSON.stringify({ email, scadenza, emessaIl, chiave });
  const rimborso = (email, chiave, data, cessaIl) =>
    JSON.stringify({ tipo: "rimborso", email, chiave, data, cessaIl });

  const registro = leggiRegistro(
    [
      licenza("uno@esempio.it", "2026-01-10", "2027-01-10", "K1"),
      licenza("due@esempio.it", "2026-02-10", "2027-02-10", "K2"),
      licenza("tre@esempio.it", "2026-03-10", "2027-03-10", "K3"),
      rimborso("due@esempio.it", "K2", "2026-02-20", "2026-02-20"),
    ].join("\n"),
  ).righe;

  it("una riga di rimborso non è una licenza", () => {
    expect(storicoDi(registro, "due@esempio.it")).toHaveLength(1);
    expect(rimborsiDi(registro, "due@esempio.it")).toHaveLength(1);
  });

  it("la licenza rimborsata si riconosce dalla chiave", () => {
    const sua = storicoDi(registro, "due@esempio.it")[0];
    expect(rimborsata(sua, rimborsiDi(registro, "due@esempio.it"))).toBe(true);
    expect(rimborsata(storicoDi(registro, "uno@esempio.it")[0], rimborsiDi(registro, "uno@esempio.it"))).toBe(
      false,
    );
  });

  /*
    Due licenze dello stesso indirizzo con la stessa scadenza — un rinnovo
    anticipato emesso due volte — si distinguono **solo** per chiave. Senza
    questo confronto, rimborsare l'una marcherebbe anche l'altra.
  */
  it("e due licenze con le stesse date non si confondono", () => {
    const doppie = leggiRegistro(
      [
        licenza("tizio@esempio.it", "2026-05-01", "2027-05-01", "A"),
        licenza("tizio@esempio.it", "2026-05-01", "2027-05-01", "B"),
        rimborso("tizio@esempio.it", "B", "2026-05-02", "2026-05-02"),
      ].join("\n"),
    ).righe;
    const sue = storicoDi(doppie, "tizio@esempio.it");
    const r = rimborsiDi(doppie, "tizio@esempio.it");
    expect(rimborsata(sue[0], r)).toBe(false);
    expect(rimborsata(sue[1], r)).toBe(true);
  });

  it("nel racconto la licenza rimborsata è marcata, con la data da cui l'uso cessa", () => {
    const testo = raccontaStorico(storicoDi(registro, "due@esempio.it"), "2026-06-01", {
      rimborsi: rimborsiDi(registro, "due@esempio.it"),
    }).righe.join("\n");
    expect(testo).toContain("RIMBORSATA il 2026-02-20");
    expect(testo).toContain("uso cessato dal 2026-02-20");
  });

  describe("i cinquanta posti", () => {
    it("chi è stato rimborsato non occupa un posto, e l'ordine degli altri non cambia", () => {
      const stato = fondatori(registro);
      expect(stato.elenco.map((f) => f.email)).toEqual(["uno@esempio.it", "tre@esempio.it"]);
      expect(stato.elenco.map((f) => f.posizione)).toEqual([1, 2]);
      expect(stato.occupati).toBe(2);
      expect(stato.liberi).toBe(48);
    });

    it("senza il rimborso sarebbero tre, nello stesso ordine", () => {
      const senza = registro.filter((r) => r.tipo !== "rimborso");
      expect(fondatori(senza).elenco.map((f) => f.email)).toEqual([
        "uno@esempio.it",
        "due@esempio.it",
        "tre@esempio.it",
      ]);
    });

    it("chi riceve una licenza per trasferimento non prende un posto", () => {
      const conTrasferimento = [
        ...registro,
        {
          email: "quattro@esempio.it",
          emessaIl: "2026-04-10",
          scadenza: "2027-01-10",
          chiave: "K4",
          trasferitaDa: "uno@esempio.it",
        },
      ];
      const stato = fondatori(conTrasferimento);
      expect(stato.elenco.map((f) => f.email)).not.toContain("quattro@esempio.it");
      expect(stato.occupati).toBe(2);
    });

    it("i rinnovi non occupano un secondo posto: conta il primo acquisto", () => {
      const conRinnovo = [
        ...registro,
        { email: "Uno@Esempio.it", emessaIl: "2027-01-05", scadenza: "2028-01-10", chiave: "K5" },
      ];
      const stato = fondatori(conRinnovo);
      expect(stato.occupati).toBe(2);
      expect(stato.elenco[0]).toMatchObject({ posizione: 1, dal: "2026-01-10" });
    });

    it("oltre il cinquantesimo non si entra", () => {
      const tanti = Array.from({ length: 52 }, (_, i) =>
        JSON.parse(
          licenza(`c${i}@esempio.it`, `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, "2027-01-01", `C${i}`),
        ),
      );
      const stato = fondatori(tanti);
      expect(stato.occupati).toBe(50);
      expect(stato.liberi).toBe(0);
      expect(posizioneFondatore(tanti, "c0@esempio.it")).toBe(1);
    });

    it("e la posizione si legge anche con le maiuscole diverse", () => {
      expect(posizioneFondatore(registro, "UNO@ESEMPIO.IT")).toBe(1);
      expect(posizioneFondatore(registro, "due@esempio.it")).toBeNull();
    });
  });
});

// ————————————————————————————————————————————————————————————
// Il comma 8: la finestra di chi ha trasferito
// ————————————————————————————————————————————————————————————

/*
  «Per il suo successivo acquisto si considera la scadenza originaria della
  licenza trasferita: entro 30 giorni da tale scadenza si applica il prezzo
  garantito; oltre tale termine si applica il listino.»

  Il conto era già quello — la riga del cedente porta la scadenza originaria —
  ma fino a ieri lo strumento lo segnalava come una domanda aperta. Adesso la
  regola c'è, e il testo deve dirla: a chi legge serve sapere **perché** quel
  numero è giusto, se no lo ricontrolla a mano ogni volta.
*/
describe("la finestra di chi ha trasferito (comma 8)", () => {
  const righe = leggiRegistro(
    [
      JSON.stringify({ email: "fondatore@esempio.it", emessaIl: "2026-02-01", scadenza: "2027-02-01", chiave: "F1" }),
      JSON.stringify({
        email: "nuovo@esempio.it",
        emessaIl: "2026-09-01",
        scadenza: "2027-02-01",
        chiave: "N1",
        trasferitaDa: "fondatore@esempio.it",
      }),
    ].join("\n"),
  ).righe;

  const raccontoDi = (oggi) =>
    raccontaStorico(storicoDi(righe, "fondatore@esempio.it"), oggi, {
      scambi: trasferimenti(righe, "fondatore@esempio.it"),
    }).righe.join("\n");

  it("dice che la finestra si misura sulla scadenza originaria, e cita il comma 8", () => {
    const testo = raccontoDi("2027-02-20");
    expect(testo).toContain("è stata trasferita");
    expect(testo).toContain("comma 8");
    expect(testo).toContain("scadenza originaria");
  });

  it("entro i 30 giorni da quella scadenza il prezzo garantito vale ancora", () => {
    const f = raccontaStorico(storicoDi(righe, "fondatore@esempio.it"), "2027-03-03", {
      scambi: trasferimenti(righe, "fondatore@esempio.it"),
    }).finestra;
    expect(f.scadenza).toBe("2027-02-01");
    expect(f.ultimoGiorno).toBe("2027-03-03");
    expect(f.stato).toBe("grazia");
  });

  it("e il giorno dopo si va a listino", () => {
    const f = raccontaStorico(storicoDi(righe, "fondatore@esempio.it"), "2027-03-04", {
      scambi: trasferimenti(righe, "fondatore@esempio.it"),
    }).finestra;
    expect(f.stato).toBe("oltre");
  });

  it("chi non ha trasferito niente non si vede dire niente del comma 8", () => {
    const soloSua = leggiRegistro(
      JSON.stringify({ email: "solo@esempio.it", emessaIl: "2026-02-01", scadenza: "2027-02-01" }),
    ).righe;
    const testo = raccontaStorico(storicoDi(soloSua, "solo@esempio.it"), "2027-02-20", {
      scambi: trasferimenti(soloSua, "solo@esempio.it"),
    }).righe.join("\n");
    expect(testo).not.toContain("comma 8");
  });
});

/*
  Le righe dei posti si leggono in un'email a un cliente: «1 posti occupati» è
  il tipo di sciatteria che fa dubitare anche del numero.
*/
describe("come si scrivono i posti", () => {
  const unaSola = [{ email: "a@b.it", emessaIl: "2026-01-01", scadenza: "2027-01-01" }];

  it("al singolare dice «1 posto occupato»", () => {
    const testo = righeDeiFondatori(fondatori(unaSola), "a@b.it").join("\n");
    expect(testo).toContain("1 posto occupato");
    expect(testo).not.toContain("1 posti");
  });

  it("e «49 posti liberi» al plurale", () => {
    expect(righeDeiFondatori(fondatori(unaSola), "a@b.it").join("\n")).toContain("49 posti liberi");
  });

  it("con un posto solo libero, «1 posto libero»", () => {
    const quasi = Array.from({ length: 49 }, (_, i) => ({
      email: `c${i}@b.it`,
      emessaIl: "2026-01-01",
      scadenza: "2027-01-01",
    }));
    expect(righeDeiFondatori(fondatori(quasi)).join("\n")).toContain("1 posto libero");
  });

  it("e una licenza rimborsata «non occupa», due «non occupano»", () => {
    const con = (quanti) => ({
      posti: 50,
      elenco: [],
      occupati: 0,
      liberi: 50,
      rimborsiEsclusi: quanti,
    });
    expect(righeDeiFondatori(con(1)).join("\n")).toContain("1 licenza rimborsata non occupa");
    expect(righeDeiFondatori(con(2)).join("\n")).toContain("2 licenze rimborsate non occupano");
  });
});
