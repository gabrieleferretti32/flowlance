/**
 * Scambio di file con il disco dell'utente. Tutto nel browser: nessun upload,
 * nessun server che veda il contenuto.
 */

/** Propone il salvataggio di un file di testo. */
export function scaricaTesto(nomeFile: string, contenuto: string, tipo = "application/json"): void {
  const blob = new Blob([contenuto], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Rilasciare subito l'URL interromperebbe il download su alcuni browser.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Apre il selettore di file e restituisce il contenuto testuale scelto. */
/**
 * Come `scegliFileTesto`, ma tiene anche il nome del file.
 *
 * Serve a poterlo dire: «importare *flowlance-2026-03-02.json* sostituisce
 * l'archivio». Una domanda che non nomina il file a cui si riferisce è una
 * domanda a cui si risponde di sì senza guardare.
 */
export function scegliFile(
  accetta = "application/json,.json",
): Promise<{ nome: string; testo: string } | null> {
  return new Promise((risolvi) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accetta;
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      risolvi(file ? { nome: file.name, testo: await file.text() } : null);
    });
    window.addEventListener(
      "focus",
      () => setTimeout(() => { if (!input.files?.length) risolvi(null); }, 400),
      { once: true },
    );
    input.click();
  });
}

export function scegliFileTesto(accetta = "application/json,.json"): Promise<string | null> {
  return new Promise((risolvi) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accetta;
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      risolvi(file ? await file.text() : null);
    });
    // Se l'utente annulla il dialogo, `change` non scatta mai: il focus che
    // torna alla finestra è l'unico segnale disponibile.
    window.addEventListener(
      "focus",
      () => setTimeout(() => { if (!input.files?.length) risolvi(null); }, 400),
      { once: true },
    );
    input.click();
  });
}
