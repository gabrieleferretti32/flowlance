import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GIORNI_DI_GRAZIA,
  finestraDiRinnovo,
  leggiRegistro,
  normalizzaEmail,
  piuGiorni,
  raccontaStorico,
  storicoDi,
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
    scadenza di tre anni fa, cioè «garanzia persa» a chiunque rinnovi da
    tempo. Qui l'ultima di mario scade il 2028-09-14.
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

  it("il trentunesimo è fuori, e la garanzia è cessata", () => {
    const f = finestraDiRinnovo(SCADENZA, "2027-10-13");
    expect(f.stato).toBe("oltre");
    expect(f.ultimoGiorno).toBe("2027-10-12");
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
