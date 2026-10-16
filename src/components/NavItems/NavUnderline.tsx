/**
 * Traço verde que cresce do centro sob um item do menu do topo quando o mouse
 * passa por ele. Precisa de um pai `group relative`.
 */
export const NavUnderline = () => (
  <span
    aria-hidden
    className="pointer-events-none absolute inset-x-4 bottom-0 h-[3px] origin-center scale-x-0 rounded-full bg-[#777E32] transition-[scale] duration-300 ease-out group-hover:scale-x-100"
  />
);
