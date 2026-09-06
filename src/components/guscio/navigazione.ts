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

export type Voce = Destinazione & { icona: LucideIcon };

/**
 * Le rotte vivono in `lib/comandi/vocabolario`, che è puro; qui si aggiungono
 * soltanto le icone. La barra laterale e la palette leggono così lo stesso
 * elenco: una schermata nuova compare in entrambe, o in nessuna delle due.
 */
const ICONE: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/fatture": FileText,
  "/note": FileMinus2,
  "/costi": Receipt,
  "/clienti": Users,
  "/fisco": Percent,
  "/iva": Coins,
  "/confronto": Scale,
  "/scadenzario": CalendarClock,
  "/chiusura": CalendarCheck,
  "/cashflow": BarChart3,
  "/patrimonio": PiggyBank,
  "/pianificazione": Target,
  "/avvio": Compass,
  "/parametri": Settings,
  "/dati": Database,
  "/importa": FileSpreadsheet,
  "/licenza": Key,
  "/scorciatoie": Keyboard,
};

/**
 * Rotte che senza una tastiera non hanno senso. Restano raggiungibili — la
 * palette le trova ancora, e l'indirizzo funziona — ma sotto i 768 non si
 * offrono nel menu: elencare ⌘K, N e ? a chi ha solo un vetro è rumore.
 */
export const SOLO_CON_TASTIERA = new Set(["/scorciatoie"]);

/** L'ordine dei gruppi nel menu, che non è quello alfabetico. */
const ORDINE = ["Ogni giorno", "Fisco", "Finanza", "Impostazioni"];

export const GRUPPI: { titolo: string; voci: Voce[] }[] = ORDINE.map((titolo) => ({
  titolo,
  voci: DESTINAZIONI.filter((d) => d.gruppo === titolo).map((d) => ({
    ...d,
    icona: ICONE[d.href] ?? FileText,
  })),
}));
