import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildMergedRowsExpression,
  inlineCloudApiExpression,
  isAssetRowsRead,
} from "@/repositories/platform/geeStatisticsRowsExpression";

// Saída real de `ee.Serializer.encodeCloudApi` (SDK 1.7) para
//   ee.FeatureCollection([sub2023, sub2024]).flatten()
// com cada sub-coleção montada como em `buildAssetRowsCollection`:
//   ee.FeatureCollection(id).filter(filtro).map(f =>
//     ee.Feature(null, ee.Feature(f).toDictionary(props).set("__pedido", tag)))
// O SDK compartilha nós repetidos por referência; o molde escreve tudo inline,
// então a comparação é feita depois de resolver as referências.
const SDK_TWO_ASSETS = {
  result: "0",
  values: {
    "0": { functionInvocationValue: { arguments: { collection: { functionInvocationValue: { arguments: { features: { arrayValue: { values: [
      { functionInvocationValue: { arguments: { collection: { functionInvocationValue: { arguments: { collection: { functionInvocationValue: { arguments: { tableId: { constantValue: "projects/x/assets/serie_2023" } }, functionName: "Collection.loadTable" } }, filter: { valueReference: "1" } }, functionName: "Collection.filter" } }, baseAlgorithm: { functionDefinitionValue: { argumentNames: ["_MAPPING_VAR_0_0"], body: "2" } } }, functionName: "Collection.map" } },
      { functionInvocationValue: { arguments: { collection: { functionInvocationValue: { arguments: { collection: { functionInvocationValue: { arguments: { tableId: { constantValue: "projects/x/assets/serie_2024" } }, functionName: "Collection.loadTable" } }, filter: { valueReference: "1" } }, functionName: "Collection.filter" } }, baseAlgorithm: { functionDefinitionValue: { argumentNames: ["_MAPPING_VAR_0_0"], body: "5" } } }, functionName: "Collection.map" } },
    ] } } }, functionName: "Collection" } } }, functionName: "Collection.flatten" } },
    "1": { functionInvocationValue: { arguments: { filters: { arrayValue: { values: [
      { functionInvocationValue: { arguments: { leftField: { constantValue: "nivel" }, rightValue: { constantValue: "7_Municipio" } }, functionName: "Filter.equals" } },
      { functionInvocationValue: { arguments: { leftField: { constantValue: "cd_mun" }, rightValue: { constantValue: "2504009" } }, functionName: "Filter.equals" } },
    ] } } }, functionName: "Filter.and" } },
    "2": { functionInvocationValue: { arguments: { geometry: { constantValue: null }, metadata: { functionInvocationValue: { arguments: { dictionary: { valueReference: "3" }, key: { valueReference: "4" }, value: { constantValue: 7 } }, functionName: "Dictionary.set" } } }, functionName: "Feature" } },
    "3": { functionInvocationValue: { arguments: { element: { argumentReference: "_MAPPING_VAR_0_0" }, properties: { constantValue: ["ano", "valor_medio", "classe"] } }, functionName: "Element.toDictionary" } },
    "4": { constantValue: "__pedido" },
    "5": { functionInvocationValue: { arguments: { geometry: { constantValue: null }, metadata: { functionInvocationValue: { arguments: { dictionary: { valueReference: "3" }, key: { valueReference: "4" }, value: { constantValue: 8 } }, functionName: "Dictionary.set" } } }, functionName: "Feature" } },
  },
};

const MUNICIPALITY_FILTER = inlineCloudApiExpression({
  result: "0",
  values: { "0": SDK_TWO_ASSETS.values["1"] },
});

const read = (assetId: string, ownerTag: number) => ({
  assetId,
  properties: ["ano", "valor_medio", "classe"],
  filter: MUNICIPALITY_FILTER,
  ownerTag,
});

describe("buildMergedRowsExpression", () => {
  it("describes the same computation the SDK serializes for the merged read", () => {
    const expression = buildMergedRowsExpression([
      read("projects/x/assets/serie_2023", 7),
      read("projects/x/assets/serie_2024", 8),
    ]);

    expect(inlineCloudApiExpression(expression)).toEqual(
      inlineCloudApiExpression(SDK_TWO_ASSETS),
    );
  });

  it("keeps each read's owner tag in its own mapping function", () => {
    const expression = buildMergedRowsExpression([
      read("projects/x/assets/a", 1),
      read("projects/x/assets/b", 2),
    ]);

    const tags = Object.values(expression.values)
      .map((node) => JSON.stringify(node).match(/"key":\{"constantValue":"__pedido"\},"value":\{"constantValue":(\d+)\}/)?.[1])
      .filter(Boolean);
    expect(tags).toEqual(["1", "2"]);
  });

  it("produces JSON-serializable references that all resolve", () => {
    const expression = buildMergedRowsExpression([read("projects/x/assets/a", 1)]);

    expect(() => inlineCloudApiExpression(JSON.parse(JSON.stringify(expression)))).not.toThrow();
  });
});

describe("isAssetRowsRead", () => {
  it("tells a template read apart from an SDK collection", () => {
    expect(isAssetRowsRead(read("projects/x/assets/a", 1))).toBe(true);
    expect(isAssetRowsRead({ func: {}, args: {} })).toBe(false);
    expect(isAssetRowsRead(null)).toBe(false);
  });
});

describe("inlineCloudApiExpression", () => {
  it("replaces value references with the referenced node", () => {
    expect(
      inlineCloudApiExpression({
        result: "0",
        values: {
          "0": { arrayValue: { values: [{ valueReference: "1" }, { valueReference: "1" }] } },
          "1": { constantValue: "x" },
        },
      }),
    ).toEqual({ arrayValue: { values: [{ constantValue: "x" }, { constantValue: "x" }] } });
  });

  it("fails loudly on a reference that does not exist", () => {
    expect(() =>
      inlineCloudApiExpression({ result: "0", values: { "0": { valueReference: "9" } } }),
    ).toThrow(/9/);
  });
});
