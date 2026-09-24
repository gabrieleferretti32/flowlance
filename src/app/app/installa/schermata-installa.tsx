"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardCorpo, CardIntestazione, CardSottotitolo, CardTitolo } from "@/components/ui/card";
import { Guscio } from "@/components/guscio/guscio";
import { ROTTE } from "@/lib/rotte";

/**
 * Come tenere Flowlance come applicazione — e, per ora, **solo su Chrome per
 * Mac**.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché un sistema solo
 * ─────────────────────────────────────────────────────────────────────────
 *
 * La domanda che conta non è «come si installa»: è **dove finiscono i dati**.
 * Se la finestra installata usasse un archivio suo, installare vorrebbe dire
 * far nascere un secondo Flowlance che da domani diverge da questo — e due
 * archivi che si allontanano sono peggio di nessuna applicazione installata,
 * perché il danno si scopre mesi dopo, guardando due numeri diversi per la
 * stessa cosa.
 *
 * Su Chrome per Mac la risposta c'è, ed è misurata: un segno scritto dalla
 * scheda del browser si legge da dentro la finestra installata, e da lì si
 * vede l'archivio vero con i conteggi giusti. Sugli altri tre percorsi —
 * Safari, iPhone, Android — la risposta non c'è ancora, e finché non c'è
 * questa pagina **non dà istruzioni**. Non sono istruzioni che mancano per
 * pigrizia: sono istruzioni che, se l'archivio fosse separato, farebbero il
 * danno che questa pagina esiste per evitare.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Perché niente rilevamento del sistema
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Verrebbe voglia di mostrare i passaggi giusti per il browser di chi legge.
 * È esattamente il genere di misura che ha già sbagliato una volta in questo
 * prodotto — la prova d'installazione si credeva in una scheda mentre girava
 * dentro la finestra installata — e qui sbagliare vorrebbe dire dare
 * istruzioni per un sistema su cui non abbiamo verificato niente. Il testo è
 * fermo e dice di quale sistema parla: chi legge sa qual è il suo.
 */
export function SchermataInstalla() {
  return (
    <Guscio
      titolo="Installare Flowlance"
      descrizione="Il sito tenuto come applicazione, in una finestra sua. I dati restano dove sono."
    >
      <div className="mx-auto max-w-3xl space-y-4">
        <Card>
          <CardIntestazione>
            <CardTitolo>Cosa non è</CardTitolo>
            <CardSottotitolo>Non c&apos;è niente da scaricare</CardSottotitolo>
          </CardIntestazione>
          <CardCorpo className="pt-0">
            <div className="max-w-prose space-y-3 text-corpo text-inchiostro-tenue">
              <p>
                Non è un&apos;applicazione presa da uno store, non è un programma da installare
                sul Mac, e non è un secondo Flowlance da tenere aggiornato. È{" "}
                <span className="text-inchiostro">questo sito</span>, che il browser mette da
                parte come applicazione e apre in una finestra sua.
              </p>
              <p>
                Il codice è lo stesso, servito dallo stesso indirizzo: quando esce una versione
                nuova ce l&apos;hai già, senza aggiornare niente. E per lo stesso motivo la
                finestra installata ha bisogno della rete come una scheda qualsiasi: i tuoi dati
                sono sul tuo computer, il programma che li legge arriva da internet.
              </p>
            </div>
          </CardCorpo>
        </Card>

        <Card>
          <CardIntestazione>
            <CardTitolo>Cosa cambia davvero</CardTitolo>
            <CardSottotitolo>Tre cose, e nessuna riguarda i tuoi dati</CardSottotitolo>
          </CardIntestazione>
          <CardCorpo className="pt-0">
            <ul className="max-w-prose list-disc space-y-1.5 pl-5 text-corpo text-inchiostro-tenue">
              <li>Una finestra sua, senza barra degli indirizzi e senza le altre schede intorno.</li>
              <li>Un&apos;icona nel Dock, da cui si apre come qualunque altra applicazione.</li>
              <li>Compare in ⌘-Tab, quindi si torna a Flowlance senza cercarlo fra venti schede.</li>
            </ul>
            <div className="mt-4 max-w-prose space-y-3 text-corpo text-inchiostro-tenue">
              <p>
                <span className="text-inchiostro">Quello che non cambia è tutto il resto</span>:
                dove stanno i dati, come funziona, cosa sa fare. Non c&apos;è una funzione in più
                nella finestra installata e non ce n&apos;è una in meno nella scheda.
              </p>
              {/*
                La riga che regge tutta la pagina, ed è misurata e non dedotta:
                se un giorno non fosse più vera, è questa la frase da togliere
                per prima.
              */}
              <p>
                Su Chrome per Mac l&apos;archivio è{" "}
                <span className="text-inchiostro">lo stesso</span>, e non è una deduzione: un
                segno scritto dalla scheda del browser si legge da dentro la finestra installata,
                e da lì si vede l&apos;archivio vero, con i conteggi giusti. Stessi dati, non una
                copia: quello che scrivi in una finestra c&apos;è anche nell&apos;altra.
              </p>
            </div>
          </CardCorpo>
        </Card>

        <Card>
          <CardIntestazione>
            <CardTitolo>Prima di installare, il backup</CardTitolo>
            <CardSottotitolo>È un passo, non un consiglio</CardSottotitolo>
          </CardIntestazione>
          <CardCorpo className="pt-0">
            <div className="max-w-prose space-y-3 text-corpo text-inchiostro-tenue">
              <p>
                L&apos;installazione non tocca l&apos;archivio, e su Chrome per Mac lo abbiamo
                verificato. Ma un archivio che vive dentro un browser si cancella in modi che non
                decidi tu — uno «svuota i dati dei siti», un profilo nuovo, una spunta sbagliata
                dentro una finestra di disinstallazione. Il momento in cui si mette mano a come
                il sito è tenuto è il momento in cui un backup costa dieci secondi e vale un anno
                di lavoro.
              </p>
              <p className="text-inchiostro">
                Scarica il backup adesso, poi torna qui.
              </p>
            </div>
            <div className="mt-4">
              <Button asChild>
                <Link href={ROTTE.dati}>Vai a Dati e backup</Link>
              </Button>
            </div>
          </CardCorpo>
        </Card>

        <Card>
          <CardIntestazione>
            <CardTitolo>Come si fa, su Chrome per Mac</CardTitolo>
            <CardSottotitolo>Cinque passaggi, l&apos;ultimo serve a tornare indietro</CardSottotitolo>
          </CardIntestazione>
          <CardCorpo className="pt-0">
            <ol className="max-w-prose list-decimal space-y-2.5 pl-5 text-corpo text-inchiostro-tenue">
              <li>Apri Flowlance in Chrome, in una scheda normale.</li>
              <li>
                In fondo alla barra degli indirizzi, a destra, cerca l&apos;icona per installare:
                uno schermo con una freccia verso il basso. Se non c&apos;è, aprila dal menu{" "}
                <span className="text-inchiostro">⋮</span> in alto a destra e cerca la voce che
                dice «Installa»: a seconda della versione di Chrome sta da sola o dentro
                «Trasmetti, salva e condividi».
              </li>
              <li>Chrome chiede conferma. Conferma.</li>
              <li>
                Si apre una finestra senza barra degli indirizzi, e nel Dock compare
                l&apos;icona di Flowlance. Per tenerla lì anche dopo aver chiuso: clic destro
                sull&apos;icona, Opzioni, «Mantieni nel Dock».
              </li>
              <li>
                Per tornare indietro: dal menu <span className="text-inchiostro">⋮</span> dentro
                la finestra dell&apos;app, «Disinstalla». Se ti viene proposto di{" "}
                <span className="text-inchiostro">eliminare anche i dati</span>, non accettare:
                quelli sono il tuo archivio, ed è lo stesso che usa il browser.
              </li>
            </ol>
          </CardCorpo>
        </Card>

        <Card>
          <CardIntestazione>
            <CardTitolo>Gli altri sistemi</CardTitolo>
            <CardSottotitolo>Safari su Mac, iPhone, Android: non ancora verificati</CardSottotitolo>
          </CardIntestazione>
          <CardCorpo className="pt-0">
            <div className="max-w-prose space-y-3 text-corpo text-inchiostro-tenue">
              <p>
                Qui non ci sono istruzioni per quei tre, ed è voluto. Non sappiamo ancora se su
                ognuno di essi la finestra installata usa questo archivio o uno suo. Se ne usasse
                uno suo, installare farebbe nascere un secondo Flowlance che da domani si
                allontana da questo — e due archivi che divergono sono peggio di nessuna
                applicazione installata: il danno si scopre mesi dopo, davanti a due numeri
                diversi per la stessa cosa.
              </p>
              <p>
                Quando la prova sarà fatta, questa pagina lo dirà: con i passaggi, dove
                l&apos;archivio risulta lo stesso, e con un «qui non installare», dove risulta
                separato.
              </p>
            </div>
          </CardCorpo>
        </Card>
      </div>
    </Guscio>
  );
}
