#!/usr/bin/env node
/**
 * Il registro delle prove non si raggiunge da chi manda email.
 *
 *   node strumenti/verifica-registro.mjs
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Che cosa separa, e perché la separazione è il punto
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Il registro contiene indirizzi email, e li contiene **per una finalità
 * sola**: dimostrare che un consenso c'è stato. L'informativa lo dice —
 * «conservati separatamente e non utilizzati per alcuna comunicazione».
 *
 * Una frase del genere la tiene la struttura o non la tiene niente. Basta un
 * import comodo — «mi serve l'elenco degli iscritti, il registro ce l'ha» —
 * perché un elenco raccolto come prova diventi una lista di invio: nessun
 * errore, nessuna riga storta, e un'informativa che dice il falso.
 *
 * Quindi si legge il grafo degli import a partire da **chi manda** e da **chi
 * sta in pagina**, e si fallisce se si arriva al registro.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Prima di misurare, si misura la misura
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Un risolutore che sbaglia un'estensione visita zero file e dichiara tutto
 * pulito, con la stessa faccia. Perciò si parte anche da `api/pulizia.ts`,
 * che al registro ci arriva davvero, e si pretende di trovarcelo: se non lo
 * trova lì, non ha senso credergli altrove.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const RADICE = resolve(".");
const SORGENTE = join(RADICE, "src");

/**
 * Da dove il registro non si deve vedere **affatto**: il browser.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché la funzione d'iscrizione è uscita da questo elenco
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Fino a oggi ci stava anche `api/promemoria.ts`, e la regola era «chi manda
 * email non vede il registro». Poi il registro ha cominciato a registrare
 * **la richiesta** — l'atto con cui la persona chiede il servizio — e quella
 * la può scrivere solo chi la riceve, cioè la funzione d'iscrizione.
 *
 * La separazione però non è saltata: è cambiato dove passa. Quello che non
 * deve succedere non è che chi manda *scriva* una prova — è che chi manda
 * **legga** gli indirizzi dal registro, trasformando un archivio probatorio in
 * una lista d'invio. E quella strada è chiusa in un modo più forte di un
 * controllo sugli import: `RegistroProve` **non ha nessun metodo che legga**.
 * Dal registro, dal codice dell'applicazione, non esce niente.
 *
 * I due controlli nuovi in fondo al file tengono proprio quella porta: che
 * l'interfaccia resti di sola scrittura, e che il magazzino non importi da
 * `@vercel/blob` niente che sappia elencare.
 */
const ORIGINI = [
  { file: "src/app/(sito)/simulatore/page.tsx", cosa: "la pagina pubblica" },
  { file: "src/app/(sito)/acquista/page.tsx", cosa: "la pagina d'acquisto" },
];

const VIETATI = [
  { frammento: "src/lib/sito/registro-prove", perche: "è il registro delle prove" },
  { frammento: "src/lib/sito/registro-blob", perche: "è il magazzino delle prove" },
];

/** Chi al registro ci arriva per mestiere: serve a provare che la misura vede. */
const CONTROPROVA = { file: "api/pulizia.ts", frammento: "src/lib/sito/registro-prove" };

/**
 * L'interfaccia del registro è di sola scrittura, e il magazzino non sa elencare.
 *
 * Sono le due porte da cui un archivio di prove diventa una lista d'invio, e
 * nessuna delle due si chiude con una buona intenzione: la prima con un
 * metodo che non esiste, la seconda con un import che non c'è.
 */
const SOLA_SCRITTURA = {
  file: "src/lib/sito/registro-prove.ts",
  /* Un metodo dell'interfaccia che somigli a una lettura. */
  lettura: /\b(legg\w*|elenc\w*|cerc\w*|list\w*|read\w*|trova\w*|tutti\w*)\s*\(/i,
};
const MAGAZZINO = {
  file: "src/lib/sito/registro-blob.ts",
  ammessi: ["put"],
};

const ESTENSIONI = [".ts", ".tsx", ".js", ".jsx", ".mjs"];

function candidati(base) {
  const prove = [base, ...ESTENSIONI.map((e) => `${base}${e}`), ...ESTENSIONI.map((e) => join(base, `index${e}`))];
  for (const p of prove) {
    try {
      if (statSync(p).isFile()) return p;
    } catch {
      // il candidato successivo
    }
  }
  return null;
}

function risolvi(specificatore, daFile) {
  if (specificatore.startsWith("@/")) return candidati(join(SORGENTE, specificatore.slice(2)));
  if (specificatore.startsWith(".")) return candidati(resolve(dirname(daFile), specificatore));
  return null; // un pacchetto: non si segue
}

/**
 * Tutti i file raggiungibili da un punto di partenza.
 *
 * Gli import di solo tipo si saltano: `import type { X } from "..."` sparisce
 * in compilazione e non porta dentro niente. Gli altri si seguono tutti,
 * compreso `import { type X }` — che la parola `type` dentro le graffe non
 * basta a cancellare la riga.
 */
function chiusura(partenza) {
  const visti = new Set();
  const coda = [resolve(RADICE, partenza)];
  while (coda.length > 0) {
    const file = coda.pop();
    if (!file || visti.has(file) || !existsSync(file)) continue;
    visti.add(file);
    const testo = readFileSync(file, "utf8");
    const righe = [
      ...testo.matchAll(/^\s*import\s+(?!type\s)[^;]*?from\s+["']([^"']+)["']/gm),
      ...testo.matchAll(/^\s*export\s+(?!type\s)[^;]*?from\s+["']([^"']+)["']/gm),
      ...testo.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g),
    ];
    for (const m of righe) {
      const risolto = risolvi(m[1], file);
      if (risolto) coda.push(risolto);
    }
  }
  return visti;
}

const problemi = [];
const fatti = [];

// La controprova, prima di tutto.
{
  const raggiunti = [...chiusura(CONTROPROVA.file)].map((f) => relative(RADICE, f));
  const trovato = raggiunti.some((f) => f.replace(/\\/g, "/").includes(CONTROPROVA.frammento));
  if (trovato) {
    fatti.push(`la misura vede il registro dove c'è: da ${CONTROPROVA.file} ci arriva (${raggiunti.length} file letti)`);
  } else {
    problemi.push(
      `la misura NON vede il registro da ${CONTROPROVA.file}, dove ci arriva per mestiere: `
        + "il risolutore è rotto e ogni altro «ok» di questo strumento non vuol dire niente",
    );
  }
}

for (const origine of ORIGINI) {
  const raggiunti = [...chiusura(origine.file)].map((f) => relative(RADICE, f).replace(/\\/g, "/"));
  fatti.push(`da ${origine.file} (${origine.cosa}) si raggiungono ${raggiunti.length} file`);
  for (const { frammento, perche } of VIETATI) {
    const trovati = raggiunti.filter((f) => f.includes(frammento));
    if (trovati.length > 0) {
      problemi.push(`${origine.file} arriva a ${frammento} (${perche}): ${trovati.join(", ")}`);
    } else {
      fatti.push(`  non arriva a ${frammento}, che ${perche}`);
    }
  }
}

/*
  ─────────────────────────────────────────────────────────────────────────
  E le parole dei tre archivi non si scambiano
  ─────────────────────────────────────────────────────────────────────────

  Gli eventi del servizio promemoria stanno sull'art. 6.1.b — un servizio
  chiesto — e si chiamano richiesta, attivazione, disattivazione. Quelli del
  marketing stanno sul consenso, art. 6.1.a, e si chiamano consenso e revoca.

  Chiamare «revoca del consenso» la fine di un servizio è una riga che nessuno
  rileggerebbe due volte, e che in una contestazione dice il contrario
  dell'informativa: che quel trattamento si fondava su un consenso, quindi che
  senza consenso non si poteva fare, quindi che tutti i promemoria mandati a
  chi non aveva spuntato nessuna casella erano senza base. Il registro è un
  documento, e un documento che contraddice l'informativa vince sull'intenzione
  di chi l'ha scritto.

  Qui si legge l'elenco dei tipi del servizio dal sorgente e si pretende che
  nessuno dei due termini del consenso compaia.
*/
{
  const file = "src/lib/sito/registro-prove.ts";
  const testo = readFileSync(resolve(RADICE, file), "utf8");
  const elenco = testo.match(/export type TipoServizio\s*=\s*([^;]+);/);
  if (!elenco) {
    problemi.push(
      `in ${file} non trovo l'elenco dei tipi del servizio (TipoServizio): `
        + "senza, questo controllo non misura niente",
    );
  } else {
    const tipi = [...elenco[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    if (tipi.length === 0) {
      problemi.push(`in ${file} l'elenco TipoServizio è vuoto`);
    }
    const sbagliati = tipi.filter((t) => /consens|revoc/i.test(t));
    if (sbagliati.length > 0) {
      problemi.push(
        `i tipi del servizio promemoria usano le parole del consenso: ${sbagliati.join(", ")}. `
          + "Il servizio sta sull'art. 6.1.b, non sul consenso: si chiede, si attiva, si disattiva",
      );
    } else {
      fatti.push(`i ${tipi.length} tipi del servizio non si chiamano consenso né revoca: ${tipi.join(", ")}`);
    }

    /* E la controprova: nell'archivio del marketing quelle parole ci devono essere. */
    const marketing = testo.match(/export type TipoConsenso\s*=\s*([^;]+);/);
    const tipiM = marketing ? [...marketing[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
    if (!tipiM.some((t) => /consens/i.test(t)) || !tipiM.some((t) => /revoc/i.test(t))) {
      problemi.push(
        "l'archivio probatorio dei consensi marketing non nomina consenso e revoca: "
          + "o è stato rinominato, o questo controllo sta guardando il tipo sbagliato",
      );
    } else {
      fatti.push(`e quelli del marketing sì, come devono: ${tipiM.join(", ")}`);
    }
  }
}

/*
  ─────────────────────────────────────────────────────────────────────────
  E dal registro non si legge: né dall'interfaccia, né dal magazzino
  ─────────────────────────────────────────────────────────────────────────

  Un archivio raccolto come prova diventa una lista d'invio nel momento in cui
  qualcuno può chiedergli «dammi gli indirizzi». Non serve cattiva fede: serve
  un pomeriggio in cui l'elenco degli iscritti serve davvero e il registro ce
  l'ha già.

  La porta si chiude in due punti. `RegistroProve` dichiara solo metodi che
  **scrivono**: non c'è niente da chiamare per avere indietro qualcosa. E
  `registro-blob.ts` importa da `@vercel/blob` il solo `put`: `list` e `head`
  esistono nel pacchetto, e basterebbe aggiungerli a quella riga perché la
  prima porta diventi aggirabile.
*/
{
  const testo = readFileSync(resolve(RADICE, SOLA_SCRITTURA.file), "utf8");
  const corpo = testo.match(/export interface RegistroProve\s*\{([\s\S]*?)\n\}/);
  if (!corpo) {
    problemi.push(
      `in ${SOLA_SCRITTURA.file} non trovo l'interfaccia RegistroProve: `
        + "senza, questo controllo non misura niente",
    );
  } else {
    const senzaCommenti = corpo[1].replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    const metodi = [...senzaCommenti.matchAll(/^\s*(\w+)\s*\(/gm)].map((m) => m[1]);
    if (metodi.length === 0) {
      problemi.push(`l'interfaccia RegistroProve non dichiara nessun metodo: controllo cieco`);
    } else if (SOLA_SCRITTURA.lettura.test(senzaCommenti)) {
      problemi.push(
        `RegistroProve ha un metodo che legge (${metodi.join(", ")}): un archivio probatorio `
          + "da cui si possono tirare fuori gli indirizzi è una lista d'invio con un altro nome",
      );
    } else {
      fatti.push(`RegistroProve è di sola scrittura: ${metodi.join(", ")}`);
    }
  }
}

{
  const testo = readFileSync(resolve(RADICE, MAGAZZINO.file), "utf8");
  const riga = testo.match(/import\s*\{([^}]*)\}\s*from\s*["']@vercel\/blob["']/);
  if (!riga) {
    problemi.push(`in ${MAGAZZINO.file} non trovo l'import da @vercel/blob: controllo cieco`);
  } else {
    const nomi = riga[1].split(",").map((n) => n.trim()).filter(Boolean);
    const inPiu = nomi.filter((n) => !MAGAZZINO.ammessi.includes(n));
    if (inPiu.length > 0) {
      problemi.push(
        `${MAGAZZINO.file} importa da @vercel/blob anche ${inPiu.join(", ")}: `
          + `dal magazzino delle prove si deve poter solo scrivere (${MAGAZZINO.ammessi.join(", ")})`,
      );
    } else {
      fatti.push(`il magazzino importa solo ${nomi.join(", ")}: non sa elencare niente`);
    }
  }
}

/*
  ─────────────────────────────────────────────────────────────────────────
  E l'archivio delle accettazioni non incontra gli indirizzi
  ─────────────────────────────────────────────────────────────────────────

  Il quarto archivio — `accettazioni-termini` — è l'unico che **non contiene
  nessuno**: un identificativo casuale, l'ora del server, due impronte. Non
  perché i dati non servissero, ma perché il collegamento fra quell'evento e
  una persona deve esistere in un posto solo, il cruscotto di Stripe, dove il
  pagamento c'è già col suo nome.

  Quella promessa si tiene in due versi, e nessuno dei due è un'intenzione:

  - chi **manda** non arriva al codice delle accettazioni. Non perché
    scriverci sarebbe grave in sé, ma perché il giorno in cui la funzione che
    ha in mano un indirizzo può anche registrare o toccare un'accettazione, il
    passo che manca per annotare l'email accanto all'identificativo è un
    parametro in più;
  - chi **registra l'accettazione** non arriva a Brevo, né al codice
    dell'iscrizione e della pulizia, che gli indirizzi li maneggiano per
    mestiere. È il verso che si rompe per comodità, e si è già rotto una volta:
    `api/accettazione.ts` importava `originiAmmesse` da `promemoria-server.ts`
    — due righe su `Origin`, nessun comportamento sbagliato — e si portava
    dietro per intero il meccanismo d'invio. Da lì nasce `origini.ts`.

  Restano in comune `registro-prove.ts` e `registro-blob.ts`: l'interfaccia e
  il magazzino sono **uno** di proposito, ed è quell'interfaccia di sola
  scrittura, controllata qui sopra, a dire che dal registro non esce niente.
  Per questo si guarda anche chi chiama `accetta(`: il metodo esiste per tutti,
  e il controllo è che lo usi uno solo.
*/
const ACCETTAZIONI = {
  nome: "accettazioni-termini",
  /* Chi ha in mano gli indirizzi. */
  invio: [
    { file: "api/promemoria.ts", cosa: "la funzione che iscrive" },
    { file: "api/pulizia.ts", cosa: "la pulizia notturna" },
  ],
  vietatiAllInvio: [
    { frammento: "src/lib/sito/accettazione-server", perche: "registra le accettazioni" },
    { frammento: "src/lib/sito/dichiarazioni", perche: "è il testo delle due dichiarazioni" },
  ],
  /* Chi registra l'accettazione, e non deve vedere né Brevo né gli indirizzi. */
  acquisto: { file: "api/accettazione.ts", cosa: "la funzione che registra l'accettazione" },
  vietatiAllAcquisto: [
    { frammento: "src/lib/sito/brevo", perche: "è il codice che parla con Brevo" },
    { frammento: "src/lib/sito/promemoria", perche: "è l'iscrizione, che ha dentro l'indirizzo" },
    { frammento: "src/lib/sito/pulizia", perche: "cancella i contatti e li elenca" },
  ],
  /* L'unico che può chiamare `accetta(`. Gli altri due sono l'interfaccia e il magazzino. */
  soloLui: "src/lib/sito/accettazione-server.ts",
  condivisi: ["src/lib/sito/registro-prove.ts", "src/lib/sito/registro-blob.ts"],
};

{
  /*
    La controprova prima dei divieti: se dalla funzione delle accettazioni non
    si arrivasse al codice che le registra, o se il nome dell'archivio non
    comparisse da nessuna parte lì dentro, i due «non ci arriva» qui sotto
    sarebbero veri per il motivo sbagliato — e lo resterebbero anche dopo aver
    cancellato tutto.
  */
  const suoi = [...chiusura(ACCETTAZIONI.acquisto.file)].map((f) => relative(RADICE, f).replace(/\\/g, "/"));
  const arriva = suoi.some((f) => f.includes("src/lib/sito/accettazione-server"));
  const nomina = suoi.some((f) => readFileSync(resolve(RADICE, f), "utf8").includes(`"${ACCETTAZIONI.nome}"`));
  if (arriva && nomina) {
    fatti.push(
      `da ${ACCETTAZIONI.acquisto.file} si arriva a chi registra le accettazioni, `
        + `e «${ACCETTAZIONI.nome}» lì dentro c'è: i divieti che seguono guardano qualcosa`,
    );
  } else {
    problemi.push(
      `da ${ACCETTAZIONI.acquisto.file} ${arriva ? `nessun file nomina «${ACCETTAZIONI.nome}»` : "non si arriva a accettazione-server"}: `
        + "questo controllo sta misurando il vuoto, e ogni «non ci arriva» qui sotto non vuol dire niente",
    );
  }

  for (const o of [...ACCETTAZIONI.invio, ACCETTAZIONI.acquisto]) {
    const vietati = ACCETTAZIONI.invio.includes(o)
      ? ACCETTAZIONI.vietatiAllInvio
      : ACCETTAZIONI.vietatiAllAcquisto;
    const raggiunti = [...chiusura(o.file)].map((f) => relative(RADICE, f).replace(/\\/g, "/"));
    fatti.push(`da ${o.file} (${o.cosa}) si raggiungono ${raggiunti.length} file`);
    for (const { frammento, perche } of vietati) {
      const trovati = raggiunti.filter((f) => f.includes(frammento));
      if (trovati.length > 0) {
        problemi.push(
          `${o.file} arriva a ${frammento} (${perche}): ${trovati.join(", ")}. `
            + "L'archivio delle accettazioni non contiene nessuno, e resta così solo se il codice "
            + "che ha in mano gli indirizzi e quello che registra l'accettazione non si incontrano",
        );
      } else {
        fatti.push(`  non arriva a ${frammento}, che ${perche}`);
      }
    }
  }

  /* E `accetta(` lo chiama uno solo. */
  const chiamanti = [];
  for (const partenza of [...ACCETTAZIONI.invio, ACCETTAZIONI.acquisto]) {
    for (const file of chiusura(partenza.file)) {
      const nome = relative(RADICE, file).replace(/\\/g, "/");
      if (chiamanti.includes(nome) || ACCETTAZIONI.condivisi.includes(nome)) continue;
      if (/\.accetta\s*\(/.test(readFileSync(file, "utf8"))) chiamanti.push(nome);
    }
  }
  if (chiamanti.length === 1 && chiamanti[0] === ACCETTAZIONI.soloLui) {
    fatti.push(`e «accetta(» lo chiama solo ${ACCETTAZIONI.soloLui}`);
  } else {
    problemi.push(
      `«accetta(» lo chiamano ${chiamanti.length === 0 ? "zero file" : chiamanti.join(", ")}, `
        + `e deve chiamarlo solo ${ACCETTAZIONI.soloLui}: `
        + (chiamanti.length === 0
          ? "se nessuno lo chiama, o il metodo è morto o questo controllo guarda il posto sbagliato"
          : "il metodo è sull'interfaccia di tutti, e il presidio è che lo usi uno"),
    );
  }
}

for (const f of fatti) console.log(`  ok   ${f}`);
for (const p of problemi) console.log(`  NO   ${p}`);

if (problemi.length > 0) {
  console.log(
    `\n${problemi.length} fuori posto: l'informativa dice che le prove non si usano `
      + "per comunicare, e quella frase la tiene questa separazione.",
  );
  process.exit(1);
}
console.log(`\n${fatti.length} verificate, 0 fuori posto. Le prove restano prove.`);
