import {
  BarChart3,
  CalendarClock,
  Coins,
  CalendarCheck,
  Database,
  FileText,
  Key,
  Keyboard,
  FileSpreadsheet,
  FileMinus2,
  LayoutDashboard,
  Percent,
  PiggyBank,
  Receipt,
  Scale,
  Settings,
  Compass,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import { DESTINAZIONI, type Destinazione } from "@/lib/comandi/vocabolario";
import { ROTTE } from "@/lib/rotte";

export type Voce = Destinazione & { icona: LucideIcon };

/**
 * Le rotte vivono in `lib/comandi/vocabolario`, che è puro; qui si aggiungono
 * soltanto le icone. La barra laterale e la palette leggono così lo stesso
 * elenco: una schermata nuova compare in entrambe, o in nessuna delle due.
 */
const ICONE: Record<string, LucideIcon> = {
  [ROTTE.cruscotto]: LayoutDashboard,
  [ROTTE.fatture]: FileText,
  [ROTTE.note]: FileMinus2,
  [ROTTE.costi]: Receipt,
  [ROTTE.clienti]: Users,
  [ROTTE.fisco]: Percent,
  [ROTTE.iva]: Coins,
  [ROTTE.confronto]: Scale,
  [ROTTE.scadenzario]: CalendarClock,
  [ROTTE.chiusura]: CalendarCheck,
  [ROTTE.cashflow]: BarChart3,
  [ROTTE.patrimonio]: PiggyBank,
  [ROTTE.pianificazione]: Target,
  [ROTTE.avvio]: Compass,
  [ROTTE.parametri]: Settings,
  [ROTTE.dati]: Database,
  [ROTTE.importa]: FileSpreadsheet,
  [ROTTE.licenza]: Key,
  [ROTTE.scorciatoie]: Keyboard,
};

/**
 * Rotte che senza una tastiera non hanno senso. Restano raggiungibili — la
 * palette le trova ancora, e l'indirizzo funziona — ma sotto i 768 non si
 * offrono nel menu: elencare ⌘K, N e ? a chi ha solo un vetro è rumore.
 */
export const SOLO_CON_TASTIERA = new Set<string>([ROTTE.scorciatoie]);

/** L'ordine dei gruppi nel menu, che non è quello alfabetico. */
const ORDINE = ["Ogni giorno", "Fisco", "Finanza", "Impostazioni"];

export const GRUPPI: { titolo: string; voci: Voce[] }[] = ORDINE.map((titolo) => ({
  titolo,
  voci: DESTINAZIONI.filter((d) => d.gruppo === titolo).map((d) => ({
    ...d,
    icona: ICONE[d.href] ?? FileText,
  })),
}));
