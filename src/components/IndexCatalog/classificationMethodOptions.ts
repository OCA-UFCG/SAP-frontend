import type { ClassificationMethodId } from "@/utils/classificationBreaks";

/**
 * Como cada método de classificação é apresentado no catálogo.
 *
 * O texto é escrito para quem conhece o produto e o Earth Engine, não para quem
 * conhece cartografia: "mesma quantidade de municípios em cada cor" diz o que
 * muda no mapa, "quantil" não. Os nomes entre parênteses são os do ArcGIS, para
 * quem chega vindo de lá reconhecer o método.
 */
export interface ClassificationMethodOption {
  id: ClassificationMethodId;
  label: string;
  description: string;
  /** Campo extra que o método exige, além da quantidade de faixas. */
  parameter?: "intervalSize" | "deviationInterval";
  /** O método decide sozinho quantas faixas existem. */
  derivesClassCount?: boolean;
}

export const CLASSIFICATION_METHOD_OPTIONS: ClassificationMethodOption[] = [
  {
    id: "manual",
    label: "Escrever os limites à mão",
    description:
      "Você digita os limites no campo abaixo. É o que o catálogo sempre fez, e continua sendo a saída quando nenhum método automático dá o corte que o índice precisa.",
  },
  {
    id: "equalInterval",
    label: "Faixas de mesma largura (Equal Interval)",
    description:
      "Divide a distância entre o menor e o maior valor em pedaços iguais. É o corte mais fácil de explicar na legenda — 0 a 25, 25 a 50 — e o indicado quando a unidade já é familiar, como porcentagem ou temperatura.",
  },
  {
    id: "quantile",
    label: "Mesma quantidade de municípios por cor (Quantile)",
    description:
      "Cada cor recebe mais ou menos o mesmo número de territórios, então o mapa nunca sai quase todo de uma cor só. Em troca, dois municípios com valores parecidos podem cair em cores diferentes.",
  },
  {
    id: "naturalBreaks",
    label: "Quebras naturais (Natural Breaks / Jenks)",
    description:
      "Procura os degraus que já existem nos dados e corta ali, juntando o que é parecido. É o melhor retrato de um índice sozinho, mas os limites saem do próprio período: dois índices classificados assim não podem ser comparados lado a lado.",
  },
  {
    id: "geometricalInterval",
    label: "Faixas que crescem (Geometrical Interval)",
    description:
      "As primeiras faixas são estreitas e as últimas, largas. Serve para o dado amontoado perto de zero com poucos valores altos — chuva acumulada, área queimada —, em que faixas iguais pintariam o país inteiro da primeira cor.",
  },
  {
    id: "definedInterval",
    label: "Largura escolhida por você (Defined Interval)",
    description:
      "Você diz de quanto em quanto a faixa muda (a cada 50 mm, a cada 5 °C) e a quantidade de faixas sai do dado. Precisa de pelo menos três faixas.",
    parameter: "intervalSize",
    derivesClassCount: true,
  },
  {
    id: "standardDeviation",
    label: "Distância da média (Standard Deviation)",
    description:
      "Corta na média e depois a cada fração do desvio padrão, para os dois lados. A legenda passa a ler “acima” e “abaixo da média”, o que só faz sentido quando os valores se distribuem em torno dela.",
    parameter: "deviationInterval",
    derivesClassCount: true,
  },
];

export const DEVIATION_INTERVAL_OPTIONS = [
  { value: 1, label: "1 desvio padrão" },
  { value: 0.5, label: "1/2 desvio padrão" },
  { value: 1 / 3, label: "1/3 do desvio padrão" },
  { value: 0.25, label: "1/4 do desvio padrão" },
];

export function findClassificationMethodOption(id: ClassificationMethodId) {
  const option = CLASSIFICATION_METHOD_OPTIONS.find(
    (candidate) => candidate.id === id,
  );
  if (!option) {
    throw new Error(
      `Método de classificação desconhecido: ${id}. Use um de ${CLASSIFICATION_METHOD_OPTIONS.map((entry) => entry.id).join(", ")}.`,
    );
  }
  return option;
}
