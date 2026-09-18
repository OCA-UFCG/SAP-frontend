import "server-only";

import citiesIndex from "@/data/citiesIndex.json";
import type {
  MunicipalReportData,
  MunicipalReportDocsContent,
} from "@/contracts/municipalReport";
import { getGeeStatisticsYearPatch } from "@/repositories/platform/geeStatisticsRepository";
import { isMunicipalSpreadsheetSource } from "@/contracts/municipalSpreadsheet";
import { getSpreadsheetYearPatch } from "@/repositories/platform/municipalSpreadsheetRepository";
import { populateDocContent } from "@/services/buildDoc/buildDocContent";
import {
  getTemplateData,
  type TemplateData,
} from "@/services/buildDoc/buildTemplateData";
import { CATALOG_REPORT_VARIABLES } from "@/config/indexCatalogReportText";
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
  type IndexCatalogReportVariable,
  type ManagedIndexCatalogConfig,
} from "@/types/indexCatalog";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";
import { mergeCompactDatasetYear } from "@/utils/municipalAnalysisMerge";
import type { MunicipalReportSeriesConfig } from "@/utils/interfaces";
import type { MunicipalAvailabilityIndex } from "@/utils/municipalAvailability";
import { catalogLayerClassCount } from "@/utils/indexCatalog";
import {
  stableMunicipalReportAlias,
  toMunicipalReportPresentation,
} from "@/utils/municipalReport";
import { describeReportSeriesVariables } from "@/utils/reportSeriesVariables";
import {
  describeReportVariableProfile,
  resolveReportSeverity,
  type ReportSeveritySpec,
} from "@/utils/reportVariableProfile";

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
 * rascunho. Aqui a fonte é a que a validação aprovou.
 *
 * `periodKeys` são todos os períodos validados, e não o da prévia: com eles a
 * primeira leitura traz a série inteira do território e os demais períodos saem
 * do cache de linhas. É o que deixa o gráfico do relatório aparecer na prévia
 * sem custar uma ida ao Earth Engine por período.
 */
function createDraftImageDataLoader(
  config: IndexCatalogConfigV2,
  imageData: CompactTerritorialAnalysisDataset,
  periodKeys: readonly string[],
) {
  return async (
    _panelLayerId: string,
    yearKey?: string,
    locationKey?: string,
  ) => {
    if (!yearKey || !locationKey || !config.validatedStatisticsSource) {
      return { found: false, imageData: null, status: "miss" as const };
    }
    // Um índice de planilha lê o instantâneo gravado na validação, e não o
    // Earth Engine — é o mesmo desvio que `attachMunicipalAnalysisYearToPanelLayer`
    // faz em produção.
    if (isMunicipalSpreadsheetSource(config.validatedStatisticsSource)) {
      const spreadsheet = await getSpreadsheetYearPatch(
        config.validatedStatisticsSource,
        yearKey,
        locationKey,
      );
      return {
        found: true,
        imageData: mergeCompactDatasetYear(
          imageData,
          [spreadsheet.patch],
          yearKey,
        ),
        status: "miss" as const,
      };
    }

    const result = await getGeeStatisticsYearPatch(
      config.panelLayerId,
      yearKey,
      locationKey,
      catalogLayerClassCount(config.validatedStatisticsSource, config.classes),
      config.validatedStatisticsSource,
      periodKeys,
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
  periods: readonly string[],
): MunicipalReportLayerConfig {
  return {
    panelLayerId: config.panelLayerId,
    alias: stableMunicipalReportAlias(config.panelLayerId),
    title: config.name,
    order: 0,
    // Todos os períodos validados: é a série que o gráfico do relatório
    // desenha, e ela chega numa leitura só (ver `createDraftImageDataLoader`).
    periods: [...periods],
    reportPresentation: toMunicipalReportPresentation(config.report),
    reportSeverity: resolveReportSeverity(config.report?.severity),
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
  const periods = config.validation.inferred.periods;
  return {
    period,
    dependencies: {
      layers: [toPreviewLayerConfig(config, imageData, periods)],
      loadImageData: createDraftImageDataLoader(config, imageData, periods),
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
          reportSeverity: resolveReportSeverity(
            config.report?.severity,
            productionConfig?.presentation?.history?.classes ??
              productionConfig?.presentation?.classes,
          ),
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

  const templateData = await getTemplateData(
    municipality.code,
    period,
    undefined,
    report,
  );

  return {
    municipality: {
      code: municipality.code,
      name: municipality.name,
      uf: municipality.uf.toUpperCase(),
    },
    period,
    report,
    docsContent: resolveCatalogSections(config, templateData),
    variables: describeCatalogVariables(
      config,
      report,
      templateData,
      dependencies.layers[0]?.reportSeverity,
    ),
  };
}

/**
 * As variáveis que este índice comporta, cada uma com o valor que sairia no
 * relatório de Campina Grande.
 *
 * A lista de disponibilidade vem do perfil do índice — períodos, granularidade,
 * classes, ordem de gravidade —, e não dos dados deste município: fosse o
 * contrário, um texto escrito aqui poderia quebrar em outro município. O
 * município entra só no exemplo.
 *
 * A gravidade é a mesma que a camada da prévia usa, e não uma resolvida de
 * novo a partir do catálogo: num índice legado ela pode vir dos `rank`
 * estáticos de `MUNICIPAL_REPORT_LAYERS`, e resolvê-la sem esse recurso fazia a
 * tela esconder variáveis de tendência que o relatório sabe preencher.
 *
 * O exemplo passa pela mesma substituição do relatório (`populateDocContent`),
 * de modo que uma variável que não resolve aparece na tela com os colchetes,
 * exatamente como apareceria para o cidadão.
 */
function describeCatalogVariables(
  config: ManagedIndexCatalogConfig,
  report: MunicipalReportData,
  templateData: TemplateData,
  severity: ReportSeveritySpec | undefined,
): IndexCatalogReportVariable[] {
  const analysis = report.analyses[0];
  const profile = describeReportVariableProfile({
    periods: analysis?.timeSeries.map(({ period }) => period) ?? [],
    classCount: analysis?.classes.length ?? 0,
    severity,
  });
  const tokens = [
    ...CATALOG_REPORT_VARIABLES.map(({ token, description }) => ({
      token,
      description,
    })),
    ...describeReportSeriesVariables(profile).map(({ token, description }) => ({
      token,
      description,
    })),
  ];
  const resolved = populateDocContent(
    {
      [config.panelLayerId]: tokens.map(({ token }) => ({
        title: "",
        text: token,
      })),
    },
    templateData,
  );

  return tokens.map((entry, index) => ({
    ...entry,
    example: resolved[config.panelLayerId]?.[index]?.text ?? entry.token,
  }));
}

/**
 * As seções escritas no catálogo com as variáveis já trocadas.
 *
 * Usa a mesma substituição do relatório de produção (`populateDocContent`), e
 * não uma cópia simplificada, para que um `[percentual]` que não resolve
 * apareça errado aqui também — a prévia serve justamente para ver isso.
 */
function resolveCatalogSections(
  config: ManagedIndexCatalogConfig,
  templateData: TemplateData,
): MunicipalReportDocsContent {
  const sections = config.report?.sections ?? [];
  if (sections.length === 0) return {};

  return populateDocContent({ [config.panelLayerId]: sections }, templateData);
}
