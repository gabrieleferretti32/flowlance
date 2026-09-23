import { describe, expect, it } from "vitest";
import { ICONA_DEL_TIPO, ICONE_PER_PAROLA, ICONE_SCELTA, iconaDalNome } from "./icone";

/**
 * L'emoji proposta, e le due volte in cui non si propone niente di furbo.
 *
 * La segnalazione era «ne ho creata una a mano ("Palestra") e resta senza
 * emoji, mentre quelle seminate ce l'hanno». Il rischio, correggendola, è
 * l'opposto: mettere l'emoji sbagliata con sicurezza. Quindi si misurano tutte
 * e due le direzioni — i nomi che si riconoscono e quelli che non si devono
 * indovinare.
 */
describe("l'emoji che viene dal nome", () => {
  it("**riconosce le parole della segnalazione**", () => {
    expect(iconaDalNome("Palestra", "spesa")).toBe("🏋️");
    expect(iconaDalNome("Veterinario", "spesa")).toBe("🐾");
    expect(iconaDalNome("Scuola", "spesa")).toBe("🎓");
    expect(iconaDalNome("Benzina", "spesa")).toBe("⛽");
  });

  it("non si ferma alla forma esatta: plurali e nomi composti passano", () => {
    expect(iconaDalNome("Palestre", "spesa")).toBe("🏋️");
    expect(iconaDalNome("Spese veterinarie", "spesa")).toBe("🐾");
    expect(iconaDalNome("Scuola dei bambini", "spesa")).toBe("🎓");
  });

  it("**una parola dentro un'altra non conta**: «Trasporti» non contiene «sport»", () => {
    /*
      È il difetto che cercando la sottostringa c'era davvero: «trasporti»
      contiene «sport», e la categoria più comune di tutte prendeva il
      pallone.
    */
    expect(iconaDalNome("Trasporti", "spesa")).toBe("🚌");
    expect(iconaDalNome("Casa", "spesa")).toBe("🏠");
    expect(iconaDalNome("Cassa", "spesa")).toBe(ICONA_DEL_TIPO.spesa);
  });

  it("**quando il nome non dice niente, l'emoji è quella del tipo**", () => {
    expect(iconaDalNome("Varie", "spesa")).toBe("💳");
    expect(iconaDalNome("Extra", "entrata")).toBe("💰");
    expect(iconaDalNome("Mario", "risparmio")).toBe("🐖");
    expect(iconaDalNome("Zzz", "rata")).toBe("🏦");
  });

  it("e un nome vuoto non è un caso da trattare a parte", () => {
    expect(iconaDalNome("", "spesa")).toBe("💳");
    expect(iconaDalNome("   ", "entrata")).toBe("💰");
  });

  it("le voci di due parole si cercano per intero", () => {
    expect(iconaDalNome("Altre entrate", "entrata")).toBe("➕");
    expect(iconaDalNome("Tempo libero", "spesa")).toBe("🎬");
  });

  it("non torna mai vuoto: è la condizione perché la riga sia uguale alle altre", () => {
    for (const nome of ["", "Palestra", "qwerty", "123", "Affitto", "🙂"]) {
      expect(iconaDalNome(nome, "spesa"), nome).not.toBe("");
    }
  });

  it("l'elenco fra cui si sceglie contiene tutte quelle che l'app propone", () => {
    for (const voce of ICONE_PER_PAROLA) {
      expect(ICONE_SCELTA, voce.emoji).toContain(voce.emoji);
    }
    for (const emoji of Object.values(ICONA_DEL_TIPO)) {
      expect(ICONE_SCELTA).toContain(emoji);
    }
    expect(new Set(ICONE_SCELTA).size).toBe(ICONE_SCELTA.length);
  });
});
