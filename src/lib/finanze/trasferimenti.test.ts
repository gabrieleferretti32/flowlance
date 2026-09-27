import { describe, expect, it } from "vitest";
import {
  contoNominato,
  ordinanteUgualeBeneficiario,
  parolaCambioValuta,
  riconosciTrasferimento,
  rispostaSalvata,
} from "./trasferimenti";
import { testoConfrontabile } from "./parole";
import type { ContoPersonale } from "./tipi";

/*
  Le descrizioni sono quelle vere, copiate da un rendiconto: è l'unico modo di
  sapere che la regola prende la forma che le banche scrivono davvero, e non
  quella che avremmo scritto noi immaginandola.
*/
const FINECO: ContoPersonale = {
  id: "fineco", nome: "Fineco", tipo: "corrente",
  saldoRiferimento: 0, dataRiferimento: "2026-09-01", professionale: false,
  ultimeCifre: "6098032",
};
const SENZA_CIFRE: ContoPersonale = { ...FINECO, id: "altro", nome: "Revolut", ultimeCifre: undefined };

describe("il giroconto dichiarato dalla banca", () => {
  it("**si riconosce, e dice perché**", () => {
    const m = riconosciTrasferimento("Giroconto Giroconto dal cc n. 6098032 / 01", "entrata");
    expect(m?.id).toBe("giroconto");
    expect(m?.testo).toBe("la descrizione dice «giroconto»");
  });

  it("con le ultime cifre dichiarate, chiama il conto per nome", () => {
    const m = riconosciTrasferimento(
      "Giroconto Giroconto dal cc n. 6098032 / 01",
      "entrata",
      [FINECO, SENZA_CIFRE],
    );
    expect(m?.testo).toBe("la descrizione dice «giroconto» e nomina il tuo conto Fineco");
  });

  /*
    E senza non perde niente: le ultime cifre sono facoltative, e chi non le
    compila deve riconoscere il trasferimento lo stesso. Se questo test
    fallisse vorrebbe dire che abbiamo trasformato un campo comodo in un campo
    obbligatorio senza dirlo.
  */
  it("senza le ultime cifre riconosce lo stesso, con una frase più povera", () => {
    const m = riconosciTrasferimento("Giroconto dal cc n. 6098032", "entrata", [SENZA_CIFRE]);
    expect(m?.id).toBe("giroconto");
    expect(m?.testo).toBe("la descrizione dice «giroconto»");
  });

  it("parola intera: «giroconti» dentro un'altra parola non conta", () => {
    expect(riconosciTrasferimento("RIMBORSO GIROCONTISTICA SPA", "entrata")).toBeNull();
  });

  /*
    Le uscite no, ed è una scelta: un trasferimento in uscita verso un conto
    tuo non tracciato oggi finisce fra le spese e **abbassa** il limite, che è
    il verso prudente. Un accredito contato come reddito lo alza, e fa
    spendere soldi che non ci sono.
  */
  it("solo sugli accrediti", () => {
    expect(riconosciTrasferimento("Giroconto a favore di libretto", "uscita")).toBeNull();
  });
});

describe("ordinante e beneficiario", () => {
  it("**la stessa persona vuol dire che il denaro non ha cambiato padrone**", () => {
    expect(
      ordinanteUgualeBeneficiario(
        testoConfrontabile("Ordinante: Gabriele Ferretti Beneficiario: Gabriele Ferretti"),
      ),
    ).toBe(true);
  });

  it("due persone diverse no", () => {
    expect(
      ordinanteUgualeBeneficiario(
        testoConfrontabile("Ordinante: Studio Rossi Beneficiario: Gabriele Ferretti"),
      ),
    ).toBe(false);
  });

  /*
    Un nome di una parola sola non è un'identità: «mario» e «mario» possono
    essere due persone diverse, e qui sbagliare vuol dire nascondere un
    incasso vero.
  */
  it("un nome di una parola sola non basta", () => {
    expect(ordinanteUgualeBeneficiario(testoConfrontabile("Ordinante: Mario Beneficiario: Mario"))).toBe(false);
  });

  it("e se manca uno dei due capi non si inventa", () => {
    expect(ordinanteUgualeBeneficiario(testoConfrontabile("Beneficiario: Gabriele Ferretti"))).toBe(false);
  });
});

describe("il salvadanaio, che il dizionario sapeva già", () => {
  /*
    Le parole ci sono sempre state in `DIZIONARIO`, ma puntano a una categoria
    di tipo *risparmio*: a un accredito si possono attaccare solo categorie di
    entrata, quindi su una riga in entrata non venivano nemmeno guardate.
  */
  it("un prelievo dal proprio salvadanaio non è denaro nuovo", () => {
    const m = riconosciTrasferimento("Movimento Salvadanaio", "entrata");
    expect(m?.id).toBe("risparmio");
  });
});

describe("il cambio valuta", () => {
  it("si riconosce il motivo, e la parola che lo ha fatto scattare", () => {
    expect(parolaCambioValuta("Conversione in EUR")).toBe("conversione");
    expect(parolaCambioValuta("Currency exchange")).toBe("exchange");
  });

  /*
    **Ma non si marca da solo.** Se i dollari erano un cliente che ha pagato in
    un'altra moneta, quella conversione è l'unica traccia di quel reddito:
    marcarla lo cancellerebbe dal limite per sempre, e la riga non contiene
    niente che distingua i due casi.
  */
  it("e non viene marcato da solo", () => {
    expect(riconosciTrasferimento("Conversione in EUR", "entrata")).toBeNull();
  });
});

describe("la risposta già data", () => {
  const regole = [
    { testoDaCercare: "conversione", daUnAltroTuoConto: true },
    { testoDaCercare: "bonifico da", daUnAltroTuoConto: false },
    { testoDaCercare: "esselunga", categoriaId: "spesa-alimentare" },
  ];

  it("vale, e vale in tutti e due i versi", () => {
    expect(rispostaSalvata("Conversione in EUR", regole)).toBe(true);
    /*
      Il `false` conta quanto il `true`: senza, la domanda tornerebbe a ogni
      import su un movimento a cui si è già risposto — ed è il modo più sicuro
      di far smettere di rispondere.
    */
    expect(rispostaSalvata("BONIFICO DA STUDIO ROSSI", regole)).toBe(false);
  });

  it("e una regola che parla d'altro non risponde", () => {
    expect(rispostaSalvata("PAGAMENTO POS ESSELUNGA", regole)).toBeNull();
    expect(rispostaSalvata("ADDEBITO ENEL", regole)).toBeNull();
  });
});

describe("il conto nominato dalla descrizione", () => {
  it("si trova dalle ultime cifre, quando ci sono", () => {
    expect(contoNominato(testoConfrontabile("Giroconto dal cc n. 6098032"), [FINECO])?.nome).toBe("Fineco");
  });

  it("e non si inventa quando non ci sono", () => {
    expect(contoNominato(testoConfrontabile("Giroconto dal cc n. 6098032"), [SENZA_CIFRE])).toBeNull();
    expect(contoNominato(testoConfrontabile("Giroconto senza numero"), [FINECO])).toBeNull();
  });
});
