import path from "node:path";
import { slugifyFileName } from "../shared/paths.mjs";

export function inferPanelLayerMapping(fileName, layerRules) {
  const baseName = path.basename(fileName);
  const matchedRule = layerRules.find((rule) =>
    rule.patterns.some((pattern) => pattern.test(baseName)),
  );

  if (!matchedRule) {
    return {
      layerKey: null,
      layerLabel: null,
      panelLayerId: null,
      mappingStatus: "unmapped",
      mappingRule: null,
    };
  }

  return {
    layerKey: matchedRule.key,
    layerLabel: matchedRule.label,
    panelLayerId: matchedRule.panelLayerId,
    mappingStatus: "mapped",
    mappingRule: matchedRule.patternSources.join("|"),
  };
}

export function groupCsvPaths(csvPaths, layerRules) {
  const groups = new Map();

  for (const csvPath of csvPaths) {
    const mapping = inferPanelLayerMapping(csvPath, layerRules);
    const groupKey = mapping.panelLayerId
      ? mapping.panelLayerId
      : `unmapped::${slugifyFileName(csvPath)}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { ...mapping, sourceCsvPaths: [] });
    }

    groups.get(groupKey).sourceCsvPaths.push(csvPath);
  }

  return Array.from(groups.values()).sort((left, right) => {
    const leftKey = left.panelLayerId ?? left.sourceCsvPaths[0];
    const rightKey = right.panelLayerId ?? right.sourceCsvPaths[0];

    return leftKey.localeCompare(rightKey);
  });
}

export function isPanelLayerCsv(rows) {
  const columns = Object.keys(rows[0] ?? {});

  return (
    columns.includes("location_key") &&
    columns.includes("location_name") &&
    columns.some((column) => /^valor_classe_\d+$/iu.test(column))
  );
}
