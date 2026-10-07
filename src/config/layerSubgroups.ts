/**
 * Subgrupos dentro de uma categoria da listagem de índices.
 *
 * Uma categoria (o acordeão "Dados Climáticos", por exemplo) mostra primeiro os
 * índices soltos, na ordem de sempre, e depois um subacordeão por subgrupo. Um
 * índice entra no subgrupo quando pertence à categoria-mãe e o nome começa com
 * um dos prefixos — comparados sem acento e sem caixa, para que "Previsão" e
 * "previsao" caiam no mesmo lugar.
 *
 * A mesma lista vale para Monitoramento e para o formulário do Relatório: quem
 * reconhece um subgrupo numa tela reconhece na outra. Um subgrupo novo é uma
 * entrada aqui mais o título em `ModulesContext.subgroups.<key>` nas traduções.
 *
 * @example
 * { key: "forecast", parentCategory: "Dados Climáticos", namePrefixes: ["Previsão"] }
 */
export interface LayerSubgroupDefinition {
  /** Chave estável: nomeia a tradução do título e o estado aberto/fechado. */
  key: string;
  /** Rótulo da categoria no Contentful (`panelLayer.category`). */
  parentCategory: string;
  namePrefixes: readonly string[];
}

export const LAYER_SUBGROUPS: readonly LayerSubgroupDefinition[] = [
  {
    key: "forecast",
    parentCategory: "Dados Climáticos",
    namePrefixes: ["Previsão"],
  },
];
