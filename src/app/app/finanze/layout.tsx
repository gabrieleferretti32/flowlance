import { CategoriePronte } from "./categorie-pronte";

/**
 * Il contorno comune delle finanze personali.
 *
 * Serve a una cosa sola: garantire che, aprendo una qualunque schermata del
 * modulo, le categorie ci siano. Vedi `CategoriePronte`.
 */
export default function LayoutFinanze({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CategoriePronte />
      {children}
    </>
  );
}
