/**
 * Onde cada atalho de acessibilidade leva e qual tecla o aciona, no padrão do
 * eMAG 3.1 (1 conteúdo, 2 menu, 3 busca, 4 rodapé). Ficam num lugar só porque
 * a barra de atalhos, os alvos e a página de acessibilidade precisam concordar.
 *
 * @example
 * <main id={SKIP_TARGETS.content.id} tabIndex={-1}>...</main>
 */
export const SKIP_TARGETS = {
  content: { id: "conteudo", accessKey: "1" },
  menu: { id: "menu", accessKey: "2" },
  footer: { id: "rodape", accessKey: "4" },
} as const;

/** A busca não tem link na barra: nem toda página tem uma. */
export const SEARCH_ACCESS_KEY = "3";

export type SkipTargetName = keyof typeof SKIP_TARGETS;
