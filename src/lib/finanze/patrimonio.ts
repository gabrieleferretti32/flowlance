/**
 * Quanto vale tutto quello che hai, e quanto ne è davvero tuo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché il patrimonio netto non è una somma
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Le classi non si sommano tutte con lo stesso segno: i debiti si scrivono
 * **positivi** — «mutuo residuo: 84.000 €», come lo dice la banca — e si
 * sottraggono. Tenere il segno nel dato vorrebbe dire chiedere a chi scrive un
 * mutuo di ricordarsi il meno, e sbagliarlo una volta sola manda il patrimonio
 * netto nella direzione sbagliata di due volte il debito. Il segno lo mette
 * questa funzione, in un posto solo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Una sola riga per la liquidità
 * ─────────────────────────────────────────────────────────────────────────
 *
 * I conti non sono una classe di beni: sono il saldo, e il saldo lo calcola
 * `saldoConto` dai movimenti. Qui entra come una riga sola, «Contanti e
 * risparmi», perché il patrimonio netto è una somma di cose diverse e la prima
 * arriva da un altro conto — letteralmente.
 */
import { round2, somma } from "@/lib/fisco/aritmetica";
import { saldoTotale } from "./saldo";
import type { BenePf, ClasseBene, ContoPersonale, MovimentoPf } from "./tipi";

/**
 * Le classi, in ordine di lettura, con il nome che si mostra.
 *
 * L'ordine è quello del prototipo e non è alfabetico: prima quello che
 * possiedi, in fondo quello che devi. `debiti` chiude la fila perché è l'unica
 * che si sottrae, e vederla ultima rende leggibile il totale.
 */
export const CLASSI: readonly { classe: ClasseBene; etichetta: string }[] = [
  { classe: "investimenti", etichetta: "Investimenti" },
  { classe: "beni", etichetta: "Beni fisici" },
  { classe: "crediti", etichetta: "Crediti" },
  { classe: "pensione", etichetta: "Pensione" },
  { classe: "altro", etichetta: "Altro" },
  { classe: "debiti", etichetta: "Debiti e prestiti" },
];

export function etichettaClasse(classe: ClasseBene): string {
  return CLASSI.find((c) => c.classe === classe)?.etichetta ?? "Altro";
}

export type RigaPatrimonio = {
  classe: ClasseBene;
  etichetta: string;
  /** Quanto pesa sul netto: **già col segno**, quindi negativo per i debiti. */
  valore: number;
  /** Il valore scritto dall'utente, sempre positivo. */
  valoreScritto: number;
  voci: BenePf[];
};

export type Patrimonio = {
  /** La somma dei conti: la riga «Contanti e risparmi». */
  liquidita: number;
  righe: RigaPatrimonio[];
  /** Liquidità più tutto quello che possiedi, meno quello che devi. */
  netto: number;
  /** Solo il dovuto, positivo: comodo per dirlo a parte. */
  debiti: number;
};

/**
 * Il patrimonio a una data, o a oggi se non la si dice.
 *
 * `al` esiste perché la liquidità ha una storia — i movimenti la muovono — e
 * i beni no: un valore scritto a mano vale finché non lo si riscrive. Quindi
 * la data filtra i movimenti e **non** i beni, ed è una semplificazione
 * dichiarata: il patrimonio di sei mesi fa mostra i beni di oggi.
 */
export function patrimonio(
  conti: ContoPersonale[],
  movimenti: MovimentoPf[],
  beni: BenePf[],
  al?: string,
): Patrimonio {
  const liquidita = saldoTotale(conti, movimenti, al);
  const righe = CLASSI.map(({ classe, etichetta }) => {
    const voci = beni.filter((b) => b.classe === classe);
    const valoreScritto = round2(somma(...voci.map((b) => b.valore)));
    return {
      classe,
      etichetta,
      valore: classe === "debiti" ? round2(-valoreScritto) : valoreScritto,
      valoreScritto,
      voci,
    };
  });
  return {
    liquidita,
    righe,
    netto: round2(liquidita + somma(...righe.map((r) => r.valore))),
    debiti: righe.find((r) => r.classe === "debiti")?.valoreScritto ?? 0,
  };
}
