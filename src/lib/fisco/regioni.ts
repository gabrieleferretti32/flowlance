/**
 * Le venti regioni, e l'aliquota base dell'addizionale regionale.
 *
 * Qui non c'è una tabella delle aliquote regione per regione, ed è una scelta.
 * Ogni regione delibera la sua ogni anno: chi resta all'aliquota base, chi la
 * maggiora, chi la applica a scaglioni, chi esenta i redditi bassi. Una tabella
 * di venti numeri scritta oggi dentro un'app local-first invecchia
 * nell'installazione dell'utente — nessuno la aggiorna, e continuerebbe a
 * mostrare come «l'aliquota della tua regione» un numero di due anni fa. È
 * esattamente il modo in cui nasce un numero plausibile e sbagliato.
 *
 * Quello che l'app può dire con certezza è l'aliquota **base di legge**, che è
 * una sola per tutti e sta scritta in una norma, non in venti delibere. È da lì
 * che parte il campo, marcato «predefinito» finché l'utente non ci mette la sua.
 *
 * La regione serve lo stesso: dice a quale delibera ci si riferisce, e senza
 * di lei un'aliquota dichiarata è un numero che nessuno può ricontrollare.
 */

/**
 * L'aliquota base dell'addizionale regionale all'IRPEF: 1,23 %.
 *
 * Art. 6 comma 1 del D.Lgs. 68/2011. È il livello da cui ogni regione parte e
 * che può aumentare entro i limiti fissati dalla legge; le regioni in piano di
 * rientro sanitario applicano maggiorazioni che portano il totale ben più in
 * alto. Il valore base non le copre, e la schermata lo dice.
 */
export const ALIQUOTA_BASE_REGIONALE = 0.0123;

export type Regione = {
  /** Il codice che finisce nell'archivio: stabile, non cambia col nome esteso. */
  codice: string;
  nome: string;
  /** Vero dove non è la regione a deliberare l'addizionale. */
  nota?: string;
};

/**
 * Le venti regioni in ordine alfabetico.
 *
 * Il Trentino-Alto Adige è una regione sola ma due addizionali: Trento e
 * Bolzano deliberano ciascuna la propria. L'elenco resta a venti — è la
 * ripartizione che l'utente riconosce — e la nota dice dove guardare.
 */
export const REGIONI: Regione[] = [
  { codice: "abruzzo", nome: "Abruzzo" },
  { codice: "basilicata", nome: "Basilicata" },
  { codice: "calabria", nome: "Calabria" },
  { codice: "campania", nome: "Campania" },
  { codice: "emilia-romagna", nome: "Emilia-Romagna" },
  { codice: "friuli-venezia-giulia", nome: "Friuli-Venezia Giulia" },
  { codice: "lazio", nome: "Lazio" },
  { codice: "liguria", nome: "Liguria" },
  { codice: "lombardia", nome: "Lombardia" },
  { codice: "marche", nome: "Marche" },
  { codice: "molise", nome: "Molise" },
  { codice: "piemonte", nome: "Piemonte" },
  { codice: "puglia", nome: "Puglia" },
  { codice: "sardegna", nome: "Sardegna" },
  { codice: "sicilia", nome: "Sicilia" },
  { codice: "toscana", nome: "Toscana" },
  {
    codice: "trentino-alto-adige",
    nome: "Trentino-Alto Adige",
    nota: "Trento e Bolzano deliberano ciascuna la propria: guarda quella della tua provincia autonoma.",
  },
  { codice: "umbria", nome: "Umbria" },
  { codice: "valle-daosta", nome: "Valle d'Aosta" },
  { codice: "veneto", nome: "Veneto" },
];

export function regioneDi(codice: string | null | undefined): Regione | null {
  if (!codice) return null;
  return REGIONI.find((r) => r.codice === codice) ?? null;
}

/** Il nome della regione, o null se non è stata scelta. */
export function nomeRegione(codice: string | null | undefined): string | null {
  return regioneDi(codice)?.nome ?? null;
}
