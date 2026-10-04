import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Lo strumento che emette le licenze, provato dall'esterno.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché si lancia il processo invece di importare una funzione
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Quello che si verifica qui è il comportamento di un **comando**: quali
 * opzioni legge, dove scrive, quando si rifiuta di scrivere. Sono cose che
 * vivono nei rami di primo livello del file e in `process.exit`, non in una
 * funzione esportabile — e riscriverlo per renderlo importabile vorrebbe dire
 * provare una seconda copia di quello che poi si lancia davvero.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Niente chiavi nel repository, mai
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Ogni prova lavora in una cartella temporanea del sistema, creata e
 * distrutta dal test. La cartella `chiavi/` del progetto non viene toccata, e
 * un test che fallisse a metà non lascia una chiave privata in giro: la
 * pulizia sta in `afterEach`, che gira comunque.
 *
 * Il percorso predefinito resta sacro per un'altra ragione ancora: se un
 * giorno qualcuno rompesse la lettura di `--privata`, questi test
 * scriverebbero in `strumenti/licenza/chiavi/privata.pem` — che è gitignorato,
 * quindi nessuno lo vedrebbe. Perciò non si verifica solo che il file chiesto
 * esista: si verifica anche che quello predefinito **non** sia nato.
 */

const QUI = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(QUI, "genera-licenza.mjs");
const PREDEFINITO = resolve(QUI, "chiavi", "privata.pem");

let temporanea = null;

function cartella() {
  temporanea = mkdtempSync(join(tmpdir(), "flowlance-licenze-"));
  return temporanea;
}

afterEach(() => {
  if (temporanea) rmSync(temporanea, { recursive: true, force: true });
  temporanea = null;
});

/** Lancia il comando. Restituisce uscita, testo e se è andato a buon fine. */
function lancia(argomenti) {
  try {
    const testo = execFileSync("node", [SCRIPT, ...argomenti], { encoding: "utf8" });
    return { ok: true, codice: 0, testo };
  } catch (e) {
    return {
      ok: false,
      codice: e.status ?? -1,
      testo: `${e.stdout ?? ""}${e.stderr ?? ""}`,
    };
  }
}

describe("--nuove-chiavi legge --privata", () => {
  it("scrive la coppia dove le si chiede, e non nel percorso predefinito", () => {
    const dove = join(cartella(), "mia", "privata.pem");
    const esito = lancia(["--nuove-chiavi", "--privata", dove]);

    expect(esito.ok).toBe(true);
    expect(existsSync(dove)).toBe(true);
    expect(readFileSync(dove, "utf8")).toContain("BEGIN PRIVATE KEY");
    /*
      Il verso che conta: il percorso predefinito è gitignorato, quindi una
      chiave nata lì per sbaglio non la vedrebbe nessuno guardando `git status`.
    */
    expect(existsSync(PREDEFINITO)).toBe(false);
  });

  it("crea le cartelle che mancano lungo il percorso", () => {
    const dove = join(cartella(), "una", "due", "tre", "privata.pem");
    expect(lancia(["--nuove-chiavi", "--privata", dove]).ok).toBe(true);
    expect(existsSync(dove)).toBe(true);
  });

  it("stampa il percorso vero, non quello predefinito", () => {
    const dove = join(cartella(), "privata.pem");
    const esito = lancia(["--nuove-chiavi", "--privata", dove]);
    expect(esito.testo).toContain(dove);
    expect(esito.testo).not.toContain(PREDEFINITO);
  });

  it("stampa una chiave pubblica da incollare", () => {
    const dove = join(cartella(), "privata.pem");
    const esito = lancia(["--nuove-chiavi", "--privata", dove]);
    const trovata = esito.testo.match(/CHIAVE_PUBBLICA = "([A-Za-z0-9\-_]+)"/);
    expect(trovata).not.toBeNull();
    // Trentadue byte in base64url, senza riempimento.
    expect(trovata[1]).toHaveLength(43);
  });
});

describe("--nuove-chiavi non sovrascrive", () => {
  /*
    Il caso per cui questo rifiuto esiste: sovrascrivere una chiave privata
    invalida ogni licenza emessa finora, e non ci si accorge subito —
    ci si accorge dai clienti che scrivono che la chiave non funziona più.
  */
  it("si rifiuta se il file di destinazione esiste già", () => {
    const dove = join(cartella(), "privata.pem");
    writeFileSync(dove, "non toccarmi");

    const esito = lancia(["--nuove-chiavi", "--privata", dove]);
    expect(esito.ok).toBe(false);
    expect(esito.codice).toBe(1);
    expect(esito.testo).toContain("Esiste già una chiave privata");
    expect(esito.testo).toContain(dove);
  });

  it("e il file di prima resta intatto, byte per byte", () => {
    const dove = join(cartella(), "privata.pem");
    writeFileSync(dove, "non toccarmi");
    lancia(["--nuove-chiavi", "--privata", dove]);
    expect(readFileSync(dove, "utf8")).toBe("non toccarmi");
  });

  it("il rifiuto dice come procedere, e non offre una scorciatoia", () => {
    const dove = join(cartella(), "privata.pem");
    writeFileSync(dove, "x");
    const esito = lancia(["--nuove-chiavi", "--privata", dove]);
    expect(esito.testo).toContain("spostala altrove a mano");
  });

  /*
    Non esiste nessun `--force`, e questo test lo fissa: un flag che permette
    di sovrascrivere in un colpo solo prima o poi viene usato per sbaglio.
    Se qualcuno lo aggiungesse, questo test glielo direbbe — perché il comando
    deve continuare a rifiutare **qualunque** cosa gli si metta accanto.
  */
  for (const scorciatoia of ["--force", "-f", "--sovrascrivi", "--yes"]) {
    it(`«${scorciatoia}» non apre nessuna porta`, () => {
      const dove = join(cartella(), "privata.pem");
      writeFileSync(dove, "non toccarmi");
      const esito = lancia(["--nuove-chiavi", "--privata", dove, scorciatoia]);
      expect(esito.ok).toBe(false);
      expect(readFileSync(dove, "utf8")).toBe("non toccarmi");
    });
  }
});

describe("l'emissione usa lo stesso percorso", () => {
  it("firma con la chiave chiesta, e annota nel registro chiesto", () => {
    const base = cartella();
    const privata = join(base, "privata.pem");
    const registro = join(base, "emesse.jsonl");
    expect(lancia(["--nuove-chiavi", "--privata", privata]).ok).toBe(true);

    const esito = lancia([
      "cliente@example.com", "2027-09-30",
      "--privata", privata, "--registro", registro,
    ]);
    expect(esito.ok).toBe(true);
    expect(esito.testo).toContain("FLW1.");

    const riga = JSON.parse(readFileSync(registro, "utf8").trim());
    expect(riga.email).toBe("cliente@example.com");
    expect(riga.scadenza).toBe("2027-09-30");
    expect(riga.chiave.startsWith("FLW1.")).toBe(true);
    expect(existsSync(PREDEFINITO)).toBe(false);
  });

  it("senza la chiave chiesta non emette niente e lo dice", () => {
    const base = cartella();
    const esito = lancia([
      "cliente@example.com", "2027-09-30",
      "--privata", join(base, "mai-creata.pem"),
      "--registro", join(base, "emesse.jsonl"),
    ]);
    expect(esito.ok).toBe(false);
    expect(esito.testo).toContain("Nessuna chiave privata");
    expect(existsSync(join(base, "emesse.jsonl"))).toBe(false);
  });

  it("lo storico compare sopra l'emissione, e --storico non tocca il registro", () => {
    const base = cartella();
    const registro = join(base, "emesse.jsonl");
    writeFileSync(
      registro,
      `${JSON.stringify({ email: "Cliente@Example.com", scadenza: "2027-01-01", emessaIl: "2026-01-01" })}\n`,
    );
    const prima = readFileSync(registro, "utf8");

    const esito = lancia(["cliente@example.com", "--storico", "--registro", registro]);
    expect(esito.ok).toBe(true);
    expect(esito.testo).toContain("2ª licenza");
    expect(readFileSync(registro, "utf8")).toBe(prima);
  });
});
