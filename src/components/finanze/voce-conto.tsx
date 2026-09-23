/**
 * Il nome di un conto in un menu, con quello che lo distingue dai suoi simili.
 *
 * Esiste come componente e non come stringa perché il distintivo è **più
 * silenzioso del nome** — grigio, piccolo, dopo un punto — e perché sei menu
 * che lo scrivono ognuno a modo suo sono sei posti in cui un giorno uno di
 * loro smetterà di scriverlo. Chi decide *se* serve è `distintiviDeiConti`:
 * qui si mostra quello che quella funzione ha deciso.
 */
export function VoceConto({ nome, distintivo }: { nome: string; distintivo?: string | null }) {
  return (
    <>
      {nome}
      {distintivo && <span className="text-micro text-inchiostro-tenue"> · {distintivo}</span>}
    </>
  );
}
