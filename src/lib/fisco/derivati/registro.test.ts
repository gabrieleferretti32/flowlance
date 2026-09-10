import { describe, expect, it } from "vitest";
import { DERIVATI, NOMI_DERIVATI, derivato, type NomeDerivato } from "./registro";
import { difendibile, origineInParole } from "./tipi";
import { impostazioniPredefinite } from "../impostazioni";
import { conValoreDichiarato } from "../parametri-utente";
import { parametriDi } from "../parametri";
import { GESTIONI, type Impostazioni, type ParametriAnno } from "../tipi";
import { aliquota, euro, num } from "@/lib/format";

/**
 * Un test solo, per tutto il registro.
 *
 * È la ragione per cui il registro esiste. Finché ogni valore derivato aveva la
 * sua funzione e la sua forma, ogni difetto della famiglia andava trovato a
 * mano — e in due settimane se ne sono trovati cinque, tutti aprendo il
 * browser, nessuno da un test. Con una forma sola, le proprietà si affermano
 * una volta e valgono per ogni voce che verrà aggiunta domani.
 *
 * La matrice non è decorativa: i difetti veri sono usciti tutti da una
 * combinazione — un commerciante invece di un artigiano, il sesto anno invece
 * del terzo, il 2025 invece del 2026. Un solo caso per voce non li avrebbe
 * visti.
 */

const ANNI = [2025, 2026, 2027];

/** Ogni configurazione plausibile, e qualcuna scomoda. */
function matrice(): { nome: string; imp: Impostazioni; par: ParametriAnno }[] {
  const casi: { nome: string; imp: Impostazioni; par: ParametriAnno }[] = [];
  for (const anno of ANNI) {
    const par = parametriDi(anno);
    const base = { ...impostazioniPredefinite(par), anno };

    for (const regime of ["forfettario", "ordinario"] as const) {
      for (const gestione of GESTIONI) {
        for (const nuova of [false, true]) {
          for (const apertura of [null, `${anno - 1}-03-15`, `${anno - 10}-03-15`]) {
            casi.push({
              nome: `${anno} · ${regime} · ${gestione} · ${nuova ? "nuova" : "non nuova"} · apertura ${apertura ?? "assente"}`,
              imp: { ...base, regime, gestione, nuovaAttivita: nuova, dataAperturaPiva: apertura },
              par,
            });
          }
        }
      }
    }

    /*
      I casi in cui l'utente ha risposto, uno per gestione che ha qualcosa da
      dichiarare. Due e non uno: `aliquotaSoggettivaCassa` si dichiara solo in
      cassa e `contributiFissi` solo fra i commercianti, e un caso solo avrebbe
      lasciato metà delle voci a non provare mai il ramo «dichiarato» — che è
      esattamente il ramo dove si scavalca un valore di legge.
    */
    let commerciante: Impostazioni = { ...base, gestione: "commercianti" };
    commerciante = conValoreDichiarato(commerciante, "contributiFissi", 2_940.88);
    commerciante = conValoreDichiarato(commerciante, "addizionaleRegionale", 0.0173);
    commerciante = conValoreDichiarato(commerciante, "addizionaleComunale", 0.008);
    commerciante = conValoreDichiarato(commerciante, "giorniLavorativi", 210);
    commerciante = conValoreDichiarato(commerciante, "oreFatturabiliGiorno", 6);
    casi.push({ nome: `${anno} · commerciante, tutto dichiarato`, imp: commerciante, par });

    let inCassa: Impostazioni = { ...base, gestione: "cassa" };
    inCassa = conValoreDichiarato(inCassa, "aliquotaSoggettivaCassa", 0.145);
    casi.push({ nome: `${anno} · cassa, aliquota dichiarata`, imp: inCassa, par });

    /*
      Un gruppo ATECO che l'elenco dell'anno non conosce: è la riga arrivata da
      un backup vecchio, e il coefficiente deve restare quello salvato invece
      di scivolare sul primo gruppo dell'elenco.
    */
    casi.push({
      nome: `${anno} · gruppo ATECO sconosciuto`,
      imp: { ...base, gruppoAteco: "gruppo-che-non-esiste", coefficienteRedditivita: 0.62 },
      par,
    });
  }
  return casi;
}

const CASI = matrice();

describe("il registro dei valori derivati", () => {
  it("copre una matrice larga, altrimenti non sta verificando granché", () => {
    // 3 anni × 2 regimi × 4 gestioni × 2 × 3 aperture, più tre casi a mano per anno.
    expect(CASI.length).toBe(3 * (2 * 4 * 2 * 3 + 3));
    expect(NOMI_DERIVATI.length).toBeGreaterThan(0);
  });

  for (const nome of NOMI_DERIVATI) {
    describe(nome, () => {
      it("ha un'etichetta con cui comparire a schermo", () => {
        expect(DERIVATI[nome].etichetta.trim().length).toBeGreaterThan(2);
      });

      it("in ogni configurazione produce un numero utilizzabile, o dichiara che non si applica", () => {
        for (const c of CASI) {
          const d = derivato(nome as NomeDerivato, c.imp, c.par);
          if (d.valore === null) continue;
          expect(Number.isFinite(d.valore), `${nome} · ${c.nome}`).toBe(true);
          expect(d.valore, `${nome} · ${c.nome}`).toBeGreaterThanOrEqual(0);
        }
      });

      /**
       * La proprietà che chiude la famiglia di difetti.
       *
       * Il motivo deve **contenere il valore, formattato come si mostra**. Un
       * motivo che descrive il numero senza contenerlo può restare indietro
       * quando il numero cambia — ed è il difetto di partenza, in piccolo:
       * una frase e un numero che non si parlano.
       */
      it("il motivo contiene il valore che spiega", () => {
        for (const c of CASI) {
          const d = derivato(nome as NomeDerivato, c.imp, c.par);
          /*
            Dove la voce non si applica non c'è un numero da citare, ma il
            motivo deve dirlo: un `null` senza spiegazione è un buco muto.
          */
          if (d.valore === null) {
            expect(d.motivo, `${nome} · ${c.nome}`).toMatch(/non si applica/i);
            continue;
          }
          /*
            I tre formatter, non uno: un conteggio di giorni non si scrive in
            euro né in percentuale, e accettare solo quei due avrebbe spinto a
            infilare «220 giorni» a mano nella frase — cioè a saltare
            `src/lib/format.ts`, che è l'altra regola della casa.
          */
          const scritto =
            d.motivo.includes(euro(d.valore))
            || d.motivo.includes(aliquota(d.valore))
            || d.motivo.includes(num(d.valore));
          expect(scritto, `${nome} · ${c.nome}\n  valore: ${d.valore}\n  motivo: ${d.motivo}`).toBe(true);
        }
      });

      it("il motivo è una frase, non un'etichetta", () => {
        for (const c of CASI) {
          const d = derivato(nome as NomeDerivato, c.imp, c.par);
          expect(d.motivo.length, `${nome} · ${c.nome}`).toBeGreaterThan(30);
          expect(d.motivo.trim().endsWith("."), `${nome} · ${c.nome}: «${d.motivo}»`).toBe(true);
        }
      });

      /**
       * Si scavalca solo ciò che l'app conosceva.
       *
       * Un'addizionale comunale dichiarata non scavalca niente: riempie un
       * buco. I contributi fissi dichiarati sì: prendono il posto di un
       * importo che l'INPS pubblica. La differenza decide cosa la schermata
       * può dire, e confonderle è come dire a qualcuno che sta correggendo
       * l'INPS quando sta solo rispondendo a una domanda.
       */
      it("scavalcato solo dove un valore di legge esisteva", () => {
        for (const c of CASI) {
          const d = derivato(nome as NomeDerivato, c.imp, c.par);
          if (d.scavalcato) {
            expect(d.origine.tipo, `${nome} · ${c.nome}`).toBe("dichiarato");
          }
        }
      });

      it("l'origine si sa dire in italiano", () => {
        for (const c of CASI) {
          const d = derivato(nome as NomeDerivato, c.imp, c.par);
          expect(origineInParole(d.origine).length).toBeGreaterThan(3);
          expect(typeof difendibile(d.origine)).toBe("boolean");
        }
      });

      /** Stessi ingressi, stesso valore: nessun `new Date()` nascosto dentro. */
      it("è deterministico", () => {
        for (const c of CASI.slice(0, 12)) {
          const a = derivato(nome as NomeDerivato, c.imp, c.par);
          const b = derivato(nome as NomeDerivato, c.imp, c.par);
          expect(a).toEqual(b);
        }
      });
    });
  }
});
