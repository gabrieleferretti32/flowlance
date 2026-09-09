"use client";

/**
 * «Preferenze cookie» nel piede: riapre il banner.
 *
 * Un consenso che non si può togliere non è un consenso, e questo è il punto
 * da cui si toglie. Sta in un componente suo — e client — perché il piede è
 * statico e non deve diventare client per un pulsante.
 */
export function PreferenzeCookie() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("flowlance:preferenze-cookie"))}
      className="text-etichetta text-inchiostro-tenue underline underline-offset-2 hover:text-inchiostro"
    >
      Preferenze cookie
    </button>
  );
}
