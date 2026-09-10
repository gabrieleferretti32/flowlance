import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    /*
      Anche gli strumenti, dove hanno una logica che vale la pena verificare
      senza aprire un browser: la guardia sull'artefatto decide se una verifica
      può partire, e se sbagliasse a decidere lo farebbe in silenzio.
    */
    include: ["src/**/*.test.ts", "strumenti/**/*.test.mjs"],
  },
});
