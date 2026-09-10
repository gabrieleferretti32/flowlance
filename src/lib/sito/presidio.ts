/**
 * Il presidio sulla vendita, in fase di build.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * La combinazione impossibile
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Due interruttori, ciascuno legittimo da solo:
 *
 * - `PAYMENT_LINK` vale ancora `"DA-CREARE"`, e la pagina d'acquisto mostra il
 *   riquadro «il pagamento non è ancora attivo, scrivi a info@flowlance.it».
 *   Giusto finché il sito è chiuso ai motori: si sta costruendo.
 * - `CHIUSO_AI_MOTORI` è `false`, e il sito entra negli indici. Giusto quando si
 *   apre bottega.
 *
 * **Insieme sono impossibili**: un sito che si fa trovare da chi cerca e poi
 * chiede di scrivere una mail per comprare. Non è un errore che qualcuno
 * decide, è quello in cui si inciampa il giorno del lancio togliendo il
 * noindex e dimenticando l'altra riga — e il sintomo lo vede solo chi arriva
 * fin lì e se ne va.
 *
 * Il controllo sta qui, e lo chiama `next.config.ts`, che ogni `next build`
 * legge comunque lo si invochi. In sviluppo non si applica: `next dev` non
 * passa di qui, e chi prova la pagina in locale deve poterla vedere in tutti e
 * due gli stati.
 *
 * Modulo puro, senza dipendenze da React: restituisce il messaggio invece di
 * lanciarlo, così un test può leggerlo.
 */

/** Il valore che `PAYMENT_LINK` ha finché il collegamento non esiste. */
export const SEGNAPOSTO_PAGAMENTO = "DA-CREARE";

/**
 * @returns `null` se si può procedere, altrimenti il messaggio con cui fermare
 * il build.
 */
export function controlloVendita(
  paymentLink: string,
  chiusoAiMotori: boolean,
  ambiente: string | undefined,
): string | null {
  if (ambiente !== "production") return null;
  if (chiusoAiMotori) return null;
  if (paymentLink !== SEGNAPOSTO_PAGAMENTO) return null;

  return [
    "",
    "  ┌─ Build fermato: sito aperto ai motori, ma senza modo di comprare",
    "  │  CHIUSO_AI_MOTORI è false e PAYMENT_LINK vale ancora «DA-CREARE».",
    "  │",
    "  │  Le due cose insieme fanno un sito che si fa trovare da chi cerca e poi",
    "  │  gli chiede di scrivere una mail per comprare. Ciascuna delle due, da",
    "  │  sola, va benissimo — è la combinazione che non ha senso, ed è quella in",
    "  │  cui si inciampa il giorno del lancio.",
    "  │",
    "  │  Una delle due va cambiata:",
    "  │",
    "  │    · crea il Payment Link su Stripe e incollalo in PAYMENT_LINK",
    "  │      (src/lib/sito/acquisto.ts), se stai aprendo davvero;",
    "  │",
    "  │    · rimetti CHIUSO_AI_MOTORI = true in src/lib/sito/impostazioni.ts,",
    "  │      se il noindex è caduto per sbaglio.",
    "  │",
    "  │  In sviluppo il controllo non si applica: `next dev` non passa di qui.",
    "  └─",
    "",
  ].join("\n");
}
