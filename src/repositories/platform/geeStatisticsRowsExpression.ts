/**
 * A expressão da leitura em lote das tabelas estatísticas, escrita direto no
 * formato da API do Earth Engine, sem passar pelo serializador do SDK.
 *
 * A leitura é sempre a mesma árvore: cada asset vira
 * `loadTable → filter(território) → map(Feature(null, toDictionary(props).set("__pedido", tag)))`
 * e os pedaços são juntados com `Collection.flatten`. Montar essa árvore com os
 * objetos do SDK e serializá-la custava ~11 ms por lote de 15 assets e chegou a
 * ocupar ~25% da thread do servidor sob carga: o serializador percorre cada nó
 * e calcula um MD5 dele. Aqui só os quatro valores que mudam (asset,
 * propriedades, filtro e marcação) são encaixados num molde fixo.
 *
 * O filtro do território continua vindo do SDK, serializado uma vez por
 * leitura, e o repositório compara este molde com a saída do SDK antes de usá-lo
 * (`geeStatisticsRepository`), então uma mudança de formato do SDK é detectada
 * em vez de virar resposta errada.
 */

import { STATISTICS_OWNER_PROPERTY } from "@/repositories/platform/geeStatisticsSeriesBatcher";

/** Um nó da expressão da API do Earth Engine. */
export type CloudApiNode = Record<string, unknown>;

/** A expressão completa, no formato de `ee.Serializer.encodeCloudApi`. */
export interface CloudApiExpression {
  result: string;
  values: Record<string, CloudApiNode>;
}

export interface AssetRowsRead {
  assetId: string;
  properties: readonly string[];
  /** O filtro do território, sem referências (`inlineCloudApiExpression`). */
  filter: CloudApiNode;
  ownerTag: number;
}

/** O nome que o SDK dá ao argumento da função de um `.map` de primeiro nível. */
const MAPPING_ARGUMENT = "_MAPPING_VAR_0_0";

const invoke = (functionName: string, args: CloudApiNode): CloudApiNode => ({
  functionInvocationValue: { functionName, arguments: args },
});
const constant = (value: unknown): CloudApiNode => ({ constantValue: value });

function featureBody(read: AssetRowsRead): CloudApiNode {
  return invoke("Feature", {
    geometry: constant(null),
    metadata: invoke("Dictionary.set", {
      dictionary: invoke("Element.toDictionary", {
        element: { argumentReference: MAPPING_ARGUMENT },
        properties: constant([...read.properties]),
      }),
      key: constant(STATISTICS_OWNER_PROPERTY),
      value: constant(read.ownerTag),
    }),
  });
}

/**
 * A mesma computação de
 * `ee.FeatureCollection(reads.map(buildAssetRowsCollection)).flatten()`.
 *
 * @example
 * evaluateGeeExpression(buildMergedRowsExpression([
 *   { assetId: "projects/x/aridez_2024", properties: ["ano"], filter, ownerTag: 3 },
 * ]));
 */
export function buildMergedRowsExpression(
  reads: readonly AssetRowsRead[],
): CloudApiExpression {
  const values: Record<string, CloudApiNode> = {};

  const collections = reads.map((read, index) => {
    // O corpo de uma função é uma referência a outro valor, nunca inline.
    const bodyKey = String(index + 1);
    values[bodyKey] = featureBody(read);

    return invoke("Collection.map", {
      collection: invoke("Collection.filter", {
        collection: invoke("Collection.loadTable", {
          tableId: constant(read.assetId),
        }),
        filter: read.filter,
      }),
      baseAlgorithm: {
        functionDefinitionValue: {
          argumentNames: [MAPPING_ARGUMENT],
          body: bodyKey,
        },
      },
    });
  });

  values["0"] = invoke("Collection.flatten", {
    collection: invoke("Collection", {
      features: { arrayValue: { values: collections } },
    }),
  });

  return { result: "0", values };
}

/** Se o valor é uma leitura do molde (e não uma coleção montada pelo SDK). */
export function isAssetRowsRead(value: unknown): value is AssetRowsRead {
  return (
    isNode(value) &&
    typeof value.assetId === "string" &&
    Array.isArray(value.properties) &&
    isNode(value.filter) &&
    typeof value.ownerTag === "number"
  );
}

function isNode(value: unknown): value is CloudApiNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A expressão como uma árvore só, com cada referência trocada pelo nó a que ela
 * aponta (inclusive o corpo das funções).
 *
 * Serve para duas coisas: embutir no molde o filtro serializado pelo SDK, e
 * comparar o molde com a saída do SDK, que compartilha nós repetidos por
 * referência e numera os valores na ordem em que os encontra.
 */
export function inlineCloudApiExpression(
  expression: CloudApiExpression,
): CloudApiNode {
  const resolve = (key: string): CloudApiNode => {
    const node = expression.values[key];
    if (!node) {
      throw new Error(`Referência ${key} ausente na expressão do Earth Engine.`);
    }
    return walk(node) as CloudApiNode;
  };

  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!isNode(value)) return value;
    if (typeof value.valueReference === "string") {
      return resolve(value.valueReference);
    }

    const result: CloudApiNode = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "functionDefinitionValue" && isNode(child)) {
        result[key] = {
          ...child,
          body:
            typeof child.body === "string" ? resolve(child.body) : child.body,
        };
      } else if (key === "constantValue") {
        result[key] = child;
      } else {
        result[key] = walk(child);
      }
    }
    return result;
  };

  return resolve(expression.result);
}
