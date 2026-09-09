import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

/**
 * Un percorso interno scritto a mano.
 *
 * Da quando l'app vive sotto `/app`, un `href="/fatture"` compila, passa i
 * test e in produzione porta su una pagina che non esiste: è la rottura
 * silenziosa che lo spostamento delle rotte poteva lasciare in giro. Le rotte
 * stanno in `src/lib/rotte.ts` e si nominano da lì.
 *
 * Il controllo guarda le stringhe che **iniziano con uno slash e proseguono**:
 * `"/"` da solo resta ammesso (radice del sito, separatori, espressioni
 * regolari), e così i percorsi dei file pubblici — `/icon.svg` — che non sono
 * rotte. Quello che resta sono gli indirizzi delle schermate.
 *
 * La coda è volutamente libera. La prima stesura si fermava ai caratteri di un
 * percorso pulito, e `href="/avvio?passo=regime"` le passò davanti senza un
 * fiato: il link è finito nel sito costruito, dove l'ha trovato
 * `verifica-link.mjs` aprendo le pagine. Un percorso con una query in coda è
 * un percorso.
 */
const NIENTE_ROTTE_A_MANO = {
  selector:
    'Literal[value=/^\\u002F(?!\\u002F)[a-z]/]:not([value=/\\.(svg|ico|png|jpg|webp|json|webmanifest|css|js|txt|xml)($|\\?)/])',
  message:
    "Percorso scritto a mano. Le rotte dell'app stanno in `src/lib/rotte.ts` (ROTTE, SITO): importale da lì, così spostare l'app non lascia link rotti.",
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    /*
      `rotte.ts` è dove i percorsi si scrivono, e i test sono dove si
      verificano: un test che asserisce `/app/fatture` sta fissando
      l'indirizzo pubblico, non costruendo un link. Se l'indirizzo cambia,
      quel test cade — che è esattamente quello che deve fare.
    */
    ignores: ["src/lib/rotte.ts", "src/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": ["error", NIENTE_ROTTE_A_MANO],
    },
  },
];

export default eslintConfig;
