import "server-only";

import citiesIndex from "@/data/citiesIndex.json";
import type {
  MunicipalReportData,
  MunicipalReportDocsContent,
} from "@/contracts/municipalReport";
import { getGeeStatisticsYearPatch } from "@/repositories/platform/geeStatisticsRepository";
import { populateDocContent } from "@/services/buildDoc/buildDocContent";
import { getTemplateData } from "@/services/buildDoc/buildTemplateData";
import { requireManagedConfig } from "@/services/indexCatalog/catalogConfigAudit";
import { MUNICIPAL_REPORT_LAYERS } from "@/config/municipalReport";
import {
  getCatalogEntry,
  getLocalizedEntryField,
} from "@/services/indexCatalog/contentfulManagement";
import { buildMunicipalReport } from "@/services/municipalReportService";
import type { MunicipalReportLayerConfig } from "@/config/municipalReport";
import {
  isPresentationManagedCatalogConfig,
  type IndexCatalogConfigV2,
  type IndexCatalogPresentationConfigV2,
  type IndexCatalogReportPreview,
  type ManagedIndexCatalogConfig,
} from "@/types/indexCatalog";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";
import { mergeCompactDatasetYear } from "@/utils/municipalAnalysisMerge";
import type { MunicipalReportSeriesConfig } from "@/utils/interfaces";
import type { MunicipalAvailabilityIndex } from "@/utils/municipalAvailability";
import {
  stableMunicipalReportAlias,
  toMunicipalReportPresentation,
} from "@/utils/municipalReport";

/**
 * O município da prévia. É fixo de propósito: a prévia serve para conferir a
 * aparência do texto e dos valores, não para consultar um município. Campina
 * Grande está em todos os recortes do semiárido, então um índice válido sempre
 * tem linha para ela — um município de borda transformaria "sem dados" em
 * dúvida sobre a prévia.
 */
const PREVIEW_MUNICIPALITY_CODE = "2504009";

/**
 * Um rascunho não está no índice de disponibilidade gerado no build, e não deve
 * estar: o período da prévia é o que a validação inferiu, não o que a versão
 * publicada de alguma camada declarou.
 */
const EMPTY_AVAILABILITY_INDEX: MunicipalAvailabilityIndex = {
  schemaVersion: 1,
  generatedAt: new Date(0).toISOString(),
  layers: [],
  byMunicipality: {},
};

function getPreviewMunicipality() {
  const municipality = citiesIndex.find(
    (city) => city.code === PREVIEW_MUNICIPALITY_CODE,
  );
  if (!municipality) {
    throw new Error(
      `Município da prévia ausente do índice de cidades: ${PREVIEW_MUNICIPALITY_CODE}`,
    );
  }
  return municipality;
}

/**
 * O período que a prévia monta: o padrão que a validação inferiu, com o mais
 * recente como reserva para as validações gravadas antes de ele existir. Não é
 * sempre o último da lista porque num índice de previsão o padrão é o primeiro
 * — o mês mais próximo —, e prever o horizonte mais distante não é o que a
 * pessoa vê ao abrir o relatório.
 */
function getPreviewPeriod(config: IndexCatalogConfigV2) {
  const inferred = config.validation?.inferred;
  const period = inferred?.defaultPeriod ?? inferred?.periods.at(-1);
  if (!period) {
    throw new Error(
      "O rascunho não tem nenhum período validado para montar a prévia do relatório.",
    );
  }
  return period;
}

/**
 * Lê os valores do rascunho direto do Earth Engine.
 *
 * O caminho normal (`getCachedMunicipalAnalysisImageData`) resolve a fonte
 * estatística pelo `panelLayer` **publicado**, que ainda não existe para um
 * rascunho. Aqui a fonte é a que a validação aprovou, e a leitura cobre só o
 * período da prévia — um pedido ao Earth Engine, não um por período da série.
 */
function createDraftImageDataLoader(
  config: IndexCatalogConfigV2,
  imageData: CompactTerritorialAnalysisDataset,
) {
  return async (
    _panelLayerId: string,
    yearKey?: string,
    locationKey?: string,
  ) => {
    if (!yearKey || !locationKey || !config.validatedStatisticsSource) {
      return { found: false, imageData: null, status: "miss" as const };
    }
    const result = await getGeeStatisticsYearPatch(
      config.panelLayerId,
      yearKey,
      locationKey,
      config.classes.length,
      config.validatedStatisticsSource,
    );
    if (!result) {
      return { found: false, imageData: null, status: "miss" as const };
    }
    return {
      found: true,
      imageData: mergeCompactDatasetYear(imageData, [result.patch], yearKey),
      status: "miss" as const,
    };
  };
}

function toPreviewLayerConfig(
  config: IndexCatalogConfigV2,
  imageData: CompactTerritorialAnalysisDataset,
  period: string,
): MunicipalReportLayerConfig {
  return {
    panelLayerId: config.panelLayerId,
    alias: stableMunicipalReportAlias(config.panelLayerId),
    title: config.name,
    order: 0,
    // Só o período da prévia: a série inteira custaria uma leitura por período
    // no Earth Engine para desenhar um gráfico que a prévia não mostra.
    periods: [period],
    reportPresentation: toMunicipalReportPresentation(config.report),
    statisticsSource: config.validatedStatisticsSource,
    baseImageData: imageData,
  };
}

function toDraftPreviewInput(
  config: IndexCatalogConfigV2,
  imageData: CompactTerritorialAnalysisDataset,
) {
  if (!config.validation?.valid || !config.validatedStatisticsSource) {
    throw new Error("Valide os assets e gere a prévia antes do relatório.");
  }
  const period = getPreviewPeriod(config);
  return {
    period,
    dependencies: {
      layers: [toPreviewLayerConfig(config, imageData, period)],
      loadImageData: createDraftImageDataLoader(config, imageData),
      availabilityIndex: EMPTY_AVAILABILITY_INDEX,
    },
  };
}

/**
 * A prévia de um índice legado adotado roda pelo caminho de produção.
 *
 * Nada de `loadImageData` nem de `availabilityIndex` próprios: os valores dele
 * continuam nas partições `municipalAnalysis` (ou no registro estático de
 * `geeStatisticsLayers`), e é o índice de disponibilidade gerado no build que
 * decide qual período o município tem. Trocar qualquer um dos dois faria a
 * prévia mostrar um relatório que não é o que o usuário recebe — e a prévia
 * existe justamente para conferir o texto contra os valores reais.
 *
 * A configuração estática da camada (`MUNICIPAL_REPORT_LAYERS`) é reaproveitada
 * quando existe, porque é dela que vêm o alias, a ordem e a narrativa de
 * severidade que o relatório de produção usa neste índice.
 */
function toLegacyPreviewInput(
  config: IndexCatalogPresentationConfigV2,
  imageData: CompactTerritorialAnalysisDataset,
  current: Awaited<ReturnType<typeof getCatalogEntry>>,
) {
  const productionConfig = MUNICIPAL_REPORT_LAYERS.find(
    (layer) => layer.panelLayerId === config.panelLayerId,
  );
  const periods = Object.keys(imageData.years);
  const period = imageData.defaultYear ?? periods.at(-1);
  if (!period) {
    throw new Error(
      `O imageData de ${config.panelLayerId} não tem nenhum período para montar a prévia do relatório.`,
    );
  }

  return {
    period,
    dependencies: {
      layers: [
        {
          ...productionConfig,
          panelLayerId: config.panelLayerId,
          alias:
            productionConfig?.alias ??
            stableMunicipalReportAlias(config.panelLayerId),
          title: config.name,
          order: productionConfig?.order ?? 0,
          periods,
          reportPresentation: toMunicipalReportPresentation(config.report),
          reportSeriesConfig:
            getLocalizedEntryField<MunicipalReportSeriesConfig>(
              current.entry,
              "reportSeriesConfig",
              current.locale,
            ),
          baseImageData: imageData,
        } satisfies MunicipalReportLayerConfig,
      ],
    },
  };
}

/**
 * Como este índice apareceria no Relatório Automático de Campina Grande - PB,
 * no período mais recente que a validação encontrou.
 *
 * Roda sobre o rascunho, antes de publicar: é a única forma de ver o texto do
 * catálogo já cruzado com os valores reais do município, porque o relatório de
 * produção só conhece camadas publicadas.
 *
 * @example
 * const preview = await buildIndexCatalogReportPreview("6Qk1...");
 * preview.report.analyses[0]?.snapshot?.dominantClass?.label; // "Semiárido"
 */
export async function buildIndexCatalogReportPreview(
  entryId: string,
): Promise<IndexCatalogReportPreview> {
  const current = await getCatalogEntry(entryId);
  const config = requireManagedConfig(current);
  const imageData = getLocalizedEntryField(
    current.entry,
    "imageData",
    current.locale,
  ) as CompactTerritorialAnalysisDataset | undefined;
  if (!imageData) {
    throw new Error("O rascunho não tem imageData para montar a prévia.");
  }

  const municipality = getPreviewMunicipality();
  const { period, dependencies } = isPresentationManagedCatalogConfig(config)
    ? toLegacyPreviewInput(config, imageData, current)
    : toDraftPreviewInput(config, imageData);
  const report = await buildMunicipalReport(
    municipality.code,
    period,
    dependencies,
  );

  return {
    municipality: {
      code: municipality.code,
      name: municipality.name,
      uf: municipality.uf.toUpperCase(),
    },
    period,
    report,
    docsContent: await resolveCatalogSections(config, report, period),
  };
}

/**
 * As seções escritas no catálogo com as variáveis já trocadas.
 *
 * Usa a mesma substituição do relatório de produção (`populateDocContent`), e
 * não uma cópia simplificada, para que um `[percentual]` que não resolve
 * apareça errado aqui também — a prévia serve justamente para ver isso.
 */
async function resolveCatalogSections(
  config: ManagedIndexCatalogConfig,
  report: MunicipalReportData,
  period: string,
): Promise<MunicipalReportDocsContent> {
  const sections = config.report?.sections ?? [];
  if (sections.length === 0) return {};

  const templateData = await getTemplateData(
    report.municipality.code,
    period,
    undefined,
    report,
  );
  return populateDocContent({ [config.panelLayerId]: sections }, templateData);
}
