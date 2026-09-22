import "server-only";

import {
  isGeeStatisticsRecord,
  type GeeStatisticsAssetSource,
} from "@/contracts/geeStatisticsAsset";
import { getCatalogEntry } from "@/services/indexCatalog/contentfulManagement";
import { requireFullyManagedConfig } from "@/services/indexCatalog/catalogConfigAudit";
import {
  getStatisticsAssetIds,
  periodFromAssetId,
  type StatisticsAssetCandidate,
} from "@/services/indexCatalog/statisticsAssetDiscovery";
import type { CatalogNewDataCheck } from "@/types/indexCatalog";

/**
 * Quando o asset foi revisado, em milissegundos.
 *
 * O `updateTime` é a resposta natural, mas ele não vem nos assets lidos por
 * `getAsset` (ver `EarthEngineAssetInspection.version`): nesses o carimbo chega
 * como microssegundos em `revision`, e é o mesmo instante.
 */
function assetRevisionTime(candidate: StatisticsAssetCandidate) {
  const parsed = Date.parse(candidate.updateTime ?? "");
  if (Number.isFinite(parsed)) return parsed;
  const microseconds = Number(candidate.revision);
  return Number.isFinite(microseconds) && microseconds > 0
    ? Math.round(microseconds / 1000)
    : null;
}

/**
 * O asset do Earth Engine da fonte, quando ela tem um.
 *
 * Nem toda fonte tem: `municipal-spreadsheet` e `amfe-sheet-column` leem uma
 * planilha do Google, e ler `source.asset` nelas quebrava a verificação com um
 * 502 de `Cannot read properties of undefined`.
 */
function geeAssetOf(source: unknown): GeeStatisticsAssetSource | null {
  if (!isGeeStatisticsRecord(source) || !isGeeStatisticsRecord(source.asset)) {
    return null;
  }
  const asset = source.asset;
  if (asset.type === "fixed" && typeof asset.assetId === "string") {
    return { type: "fixed", assetId: asset.assetId };
  }
  if (
    asset.type === "period-template" &&
    typeof asset.assetIdTemplate === "string"
  ) {
    return { type: "period-template", assetIdTemplate: asset.assetIdTemplate };
  }
  return null;
}

function unchecked(
  status: CatalogNewDataCheck["status"],
  message: string,
): CatalogNewDataCheck {
  return {
    checkedAt: new Date().toISOString(),
    status,
    message,
    knownPeriods: [],
    newPeriods: [],
    updatedAssets: [],
  };
}

/** Os períodos que a pasta oferece hoje, lidos só do nome de cada asset. */
function foundPeriods(
  asset: GeeStatisticsAssetSource,
  candidates: StatisticsAssetCandidate[],
) {
  if (asset.type !== "period-template") return [];
  return candidates.flatMap(
    (candidate) => periodFromAssetId(asset.assetIdTemplate, candidate.id) ?? [],
  );
}

/**
 * Se o período lido do nome do asset já está coberto pelo que o índice validou.
 *
 * O nome do asset e a validação nem sempre falam na mesma granularidade: o
 * Monitor de Secas da ANA guarda um arquivo por ano
 * (`..._MonitorANA_{year}`) mas é mensal, então a validação inferiu
 * `2026-01`…`2026-08` e a pasta oferece `2026`. Comparar os dois como texto
 * marcava todo ano como novo para sempre, mesmo logo depois de validar e
 * republicar. Um ano só é novo quando nenhum período conhecido cai dentro dele.
 *
 * covers("2026", ["2026-01"]); // true
 * covers("2027", ["2026-01"]); // false
 */
function covers(period: string, knownPeriods: string[]) {
  if (knownPeriods.includes(period)) return true;
  if (!/^\d{4}$/u.test(period)) return false;
  return knownPeriods.some((known) => known.startsWith(`${period}-`));
}

function describe(
  newPeriods: string[],
  updatedAssets: CatalogNewDataCheck["updatedAssets"],
  validatedAt: string,
) {
  const parts: string[] = [];
  if (newPeriods.length > 0) {
    parts.push(
      `${newPeriods.length} período(s) novo(s) na pasta do Earth Engine: ${newPeriods.join(", ")}.`,
    );
  }
  if (updatedAssets.length > 0) {
    parts.push(
      `${updatedAssets.length} asset(s) foram reescritos no Earth Engine depois desta validação: ${updatedAssets
        .map((asset) => asset.assetId)
        .join(", ")}.`,
    );
  }
  if (parts.length === 0) {
    return `Nenhum dado novo desde a validação de ${new Date(validatedAt).toLocaleString("pt-BR")}.`;
  }
  parts.push("Abra o índice, valide de novo e republique para incorporar.");
  return parts.join(" ");
}

/**
 * Compara a pasta do Earth Engine com o que o índice já validou, sem ler
 * nenhuma tabela.
 *
 * Responde às duas formas de "dado novo" que existem hoje: um período que a
 * pasta passou a ter (asset novo, reconhecido pelo template do nome) e um
 * período que continua o mesmo mas foi reescrito no Earth Engine depois da
 * última validação. Ver a listagem custa uma chamada ao Earth Engine, contra
 * as dezenas de leituras de tabela de "Validar assets e gerar prévia".
 *
 * @example
 * const check = await checkCatalogNewData("5xAbC");
 * check.status; // "new-data"
 */
export async function checkCatalogNewData(
  entryId: string,
): Promise<CatalogNewDataCheck> {
  const current = await getCatalogEntry(entryId);
  const config = requireFullyManagedConfig(current);
  const asset = geeAssetOf(config.statisticsSource);

  if (!asset) {
    return unchecked(
      "not-applicable",
      "Os dados deste índice não vêm de uma pasta do Earth Engine, e sim de uma planilha do Google ou de uma coluna da análise multicritério.",
    );
  }

  const validation = config.validation;
  if (!validation?.validatedAt || !validation.valid) {
    return unchecked(
      "never-validated",
      "Este índice ainda não tem uma validação bem-sucedida para comparar. Valide-o primeiro.",
    );
  }

  const validatedAt = Date.parse(validation.validatedAt);
  const candidates = await getStatisticsAssetIds(asset);
  const knownPeriods = validation.inferred.periods;
  const newPeriods = foundPeriods(asset, candidates)
    .filter((period) => !covers(period, knownPeriods))
    .sort();
  const updatedAssets = candidates.flatMap((candidate) => {
    const revisedAt = assetRevisionTime(candidate);
    if (revisedAt === null || revisedAt <= validatedAt) return [];
    return [
      { assetId: candidate.id, updateTime: new Date(revisedAt).toISOString() },
    ];
  });

  return {
    checkedAt: new Date().toISOString(),
    status:
      newPeriods.length > 0 || updatedAssets.length > 0
        ? "new-data"
        : "up-to-date",
    message: describe(newPeriods, updatedAssets, validation.validatedAt),
    knownPeriods,
    newPeriods,
    updatedAssets,
  };
}
