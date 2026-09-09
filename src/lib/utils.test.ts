import { describe, expect, it } from "vitest";
import { cn } from "./utils";
import { ROTTE, rottaAttiva } from "@/lib/rotte";

describe("cn", () => {
  it("tiene insieme dimensione e colore del testo", () => {
    // Il caso che rompeva i numeri grandi sulle card scure e sui gradienti.
    expect(cn("text-kpi", "text-white")).toBe("text-kpi text-white");
    expect(cn("text-etichetta", "text-inchiostro-tenue")).toBe(
      "text-etichetta text-inchiostro-tenue",
    );
    expect(cn("text-semaforo", "text-accento")).toBe("text-semaforo text-accento");
  });

  it("continua a risolvere i conflitti veri", () => {
    expect(cn("text-kpi", "text-corpo")).toBe("text-corpo");
    expect(cn("text-inchiostro", "text-accento")).toBe("text-accento");
    expect(cn("rounded-card", "rounded-campo")).toBe("rounded-campo");
    expect(cn("shadow-riposo", "shadow-sollevato")).toBe("shadow-sollevato");
    expect(cn("bg-superficie", "bg-inchiostro")).toBe("bg-inchiostro");
  });

  /**
   * Ogni scala dichiarata in `globals.css` va dichiarata anche in `utils.ts`.
   * Dimenticarne una non rompe niente in modo visibile: la classe finisce nel
   * gruppo dei colori, il colore che segue la cancella, e la dimensione torna
   * a quella del testo corrente. È successo con `text-campo`, e i campi sono
   * rimasti a 15 px — sotto la soglia oltre cui Safari su iOS ingrandisce la
   * pagina al fuoco.
   */
  it.each(["semaforo", "kpi", "kpi-sm", "corpo", "campo", "etichetta", "micro"])(
    "text-%s è una dimensione, non un colore",
    (nome) => {
      expect(cn(`text-${nome}`, "text-inchiostro")).toBe(`text-${nome} text-inchiostro`);
    },
  );

  it("non confonde raggio e colore del bordo", () => {
    expect(cn("rounded-interna", "border-bordo")).toBe("rounded-interna border-bordo");
  });
});

describe("rottaAttiva", () => {
  /*
    Con `trailingSlash: true` l'indirizzo corrente arriva con lo slash in coda e
    le rotte non ce l'hanno: il confronto secco non era mai vero, e nella barra
    laterale non si illuminava nessuna voce, su nessuna schermata.
  */
  it("riconosce la rotta anche con lo slash in coda", () => {
    expect(rottaAttiva("/app/fatture/", ROTTE.fatture)).toBe(true);
    expect(rottaAttiva("/app/fatture", ROTTE.fatture)).toBe(true);
  });

  it("il cruscotto è la radice dell'app, non la radice del sito", () => {
    expect(rottaAttiva("/app/", ROTTE.cruscotto)).toBe(true);
    expect(rottaAttiva("/", ROTTE.cruscotto)).toBe(false);
  });

  it("non confonde due schermate diverse", () => {
    expect(rottaAttiva("/app/note/", ROTTE.fatture)).toBe(false);
    expect(rottaAttiva(null, ROTTE.fatture)).toBe(false);
  });
});
