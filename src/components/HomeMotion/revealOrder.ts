import type { CSSProperties } from "react";

/**
 * Atraso da cascata do `reveal-item` (globals.css). Fica fora do HomeMotion,
 * que é client, para as seções renderizadas no servidor poderem chamar.
 */
export const revealOrder = (index: number) =>
  ({ "--i": index }) as CSSProperties;
