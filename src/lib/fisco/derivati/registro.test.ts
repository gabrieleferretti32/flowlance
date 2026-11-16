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
      Il caso in cui l'utente ha risposto: i contributi fissi dei commercianti,
      che è l'unico campo di `CAMPI_UTENTE` in cui una dichiarazione **scavalca
      un valore di legge** — il ramo che senza un caso dedicato non girerebbe
      mai.

      Fino a poco fa ce n'erano due, perché anche l'aliquota soggettiva della
      cassa si dichiarava da qui. Ora le aliquote della cassa stanno nel loro
      blocco e non hanno un valore di legge da scavalcare: il caso con la cassa
      resta qui sotto, per provare che la voce si calcola, ma non passa più dal
      meccanismo dei campi dichiarati.
    */
    let commerciante: Impostazioni = { ...base, gestione: "commercianti" };
    commerciante = conValoreDichiarato(commerciante, "contributiFissi", 2_940.88);
    commerciante = conValoreDichiarato(commerciante, "addizionaleRegionale", 0.0173);
    commerciante = conValoreDichiarato(commerciante, "addizionaleComunale", 0.008);
    commerciante = conValoreDichiarato(commerciante, "giorniLavorativi", 210);
    commerciante = conValoreDichiarato(commerciante, "oreFatturabiliGiorno", 6);
    casi.push({ nome: `${anno} · commerciante, tutto dichiarato`, imp: commerciante, par });

    const inCassa: Impostazioni = {
      ...base,
      gestione: "cassa",
      cassa: {
        nome: "Cassa Forense",
        aliquotaSoggettivo: 0.145,
        minimoSoggettivo: 3_355,
        aliquotaIntegrativo: 0.04,
        minimoIntegrativo: 850,
        contributiFissi: 0,
      },
    };
    casi.push({ nome: `${anno} · cassa, aliquote compilate`, imp: inCassa, par });
    /*
      E la cassa **scelta e non compilata**: è lo stato di chi ha appena
      cambiato gestione, e la voce deve dire «manca» invece di restituire un
      numero. Prima di questo caso il registro non lo provava mai, perché il
      ripiego del 15 % lo rendeva impossibile.
    */
    casi.push({ nome: `${anno} · cassa, da compilare`, imp: { ...base, gestione: "cassa" }, par });

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
    // 3 anni × 2 regimi × 4 gestioni × 2 × 3 aperture, più quattro casi a mano
    // per anno: il commerciante con tutto dichiarato, la cassa compilata, la
    // cassa scelta e da compilare, e il gruppo ATECO sconosciuto.
    expect(CASI.length).toBe(3 * (2 * 4 * 2 * 3 + 4));
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
            Dove non c'è un numero non c'è niente da citare, ma il motivo deve
            dire **perché**: un `null` senza spiegazione è un buco muto.

            Le ragioni ammesse sono due, e sono due cose diverse. «Non si
            applica» è la voce che per questa persona non esiste: il contributo
            soggettivo di chi versa all'INPS. «Manca» è la voce che esisterebbe
            e il cui dato non c'è ancora: l'aliquota di una cassa appena scelta.
            Accettare solo la prima spingerebbe a scrivere «non si applica» su
            un dato che si applica benissimo e che va soltanto compilato — cioè
            a dare la risposta sbagliata per far passare il test.
          */
          if (d.valore === null) {
            expect(d.motivo, `${nome} · ${c.nome}`).toMatch(/non si applica|^manca/i);
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
