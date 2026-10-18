import {
  CONTENTFUL_COLLECTION_LIMIT,
  getContent,
} from "@/infrastructure/contentful/client";
import {
  attachMunicipalAnalysisToPanelLayer,
  attachMunicipalAnalysisToPanelLayers,
  attachMunicipalAnalysisYearToPanelLayer,
} from "@/repositories/platform/municipalAnalysisRepository";
import { validateImageDataContract } from "@/contracts/imageDataContract.mjs";
import { PanelLayerI } from "@/utils/interfaces";
import {
  keepOnlyCurrentSeasonPeriod,
  keepOnlyFutureForecastPeriods,
} from "@/utils/imageData";
import { hasSeasonalPeriods } from "@/utils/seasonalPeriod";
import { tryParsePublishedGeeStatisticsSource } from "@/contracts/geeStatistics";
import { tryParsePublishedPanelLayerReportConfig } from "@/contracts/panelLayerReport";
import { tryParsePanelLayerForecastFacets } from "@/contracts/panelLayerForecast";

// O Contentful devolve no máximo 100 itens quando a query não pede `limit`, e
// os que passarem disso somem sem erro nenhum. `CONTENTFUL_COLLECTION_LIMIT` é o
// teto explícito para a lista continuar completa quando o catálogo crescer.
const GET_PANEL_LAYER = `
  query GetPanelLayer {
    panelLayerCollection(limit: ${CONTENTFUL_COLLECTION_LIMIT}) {
      items {
        sys {
          id
        }
        name
        id
        description
        panelPosition
        previewMap {
          url
          title
          width
          height
        }
        imageData
        minScale
        maxScale
        category
        timeScale
        reportSeriesConfig
        statisticsSource
        reportConfig
        forecastFacets
      }
    }
  }
`;

/**
 * Tag do Data Cache do Next para as queries de `panelLayer`.
 * `clearPanelLayersCache` só limpa a memoização deste processo; a resposta do
 * Contentful continua no Data Cache por até `revalidate` segundos e é
 * compartilhada por todas as rotas. Uma entrada criada por `/api/ee` não é
 * invalidada por `revalidatePath("/[locale]/platform")`, então sem a tag um
 * índice recém-publicado podia ficar até uma hora fora da lista que o mapa usa.
 */
export const PANEL_LAYERS_CACHE_TAG = "panel-layers";

const PANEL_LAYERS_FETCH_OPTIONS = {
  next: { revalidate: 3600, tags: [PANEL_LAYERS_CACHE_TAG] },
};

const OPTIONAL_PANEL_LAYER_FIELDS = [
  "reportSeriesConfig",
  "statisticsSource",
  "reportConfig",
  "forecastFacets",
] as const;

/**
 * A mesma query com cada combinação de campos opcionais removida, da mais
 * completa para a mais enxuta.
 *
 * Um ambiente cujo content type ainda não recebeu
 * `npm run contentful:ensure-index-catalog` rejeita a query inteira por causa
 * de um único campo desconhecido, então a leitura degrada em vez de falhar.
 * Enumerar as combinações à mão deixou de caber quando os campos opcionais
 * passaram de dois para três.
 */
function queryVariants(query: string) {
  const removals = OPTIONAL_PANEL_LAYER_FIELDS.reduce<string[][]>(
    (combinations, field) => [
      ...combinations,
      ...combinations.map((removed) => [...removed, field]),
    ],
    [[]],
  );

  return removals
    .sort((left, right) => left.length - right.length)
    .map((removed) =>
      removed.reduce(
        (text, field) => text.replace(`\n        ${field}`, ""),
        query,
      ),
    );
}

interface PanelLayerResponse {
  panelLayerCollection: { items: Array<PanelLayerI | null> };
}

interface GetPanelLayersOptions {
  includeMunicipalAnalysis?: boolean;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

function compareByName(left: PanelLayerI, right: PanelLayerI): number {
  return (left.name ?? "").localeCompare(right.name ?? "", "pt-BR");
}

function comparePanelLayers(left: PanelLayerI, right: PanelLayerI): number {
  const leftPosition = left.panelPosition;
  const rightPosition = right.panelPosition;
  const leftMissing = leftPosition == null;
  const rightMissing = rightPosition == null;

  if (leftMissing && rightMissing) {
    return compareByName(left, right);
  }

  if (leftMissing) {
    return -1;
  }

  if (rightMissing) {
    return 1;
  }

  // Empate de posição deixaria a ordem por conta da ordem de chegada do
  // Contentful, que muda a cada publicação. O nome mantém a lista estável.
  return leftPosition - rightPosition || compareByName(left, right);
}

function logInvalidPanelLayerImageData(layer: PanelLayerI) {
  const validation = validateImageDataContract(layer.imageData, {
    context: "runtimeRead",
  });

  if (validation.ok) {
    return;
  }

  console.warn(
    `[panelLayerRepository] imageData inválido vindo do Contentful para panelLayer ${layer.id}: ${validation.errors.join("; ")}`,
  );
}

function normalizePanelLayer(layer: PanelLayerI) {
  logInvalidPanelLayerImageData(layer);

  const statisticsSource = tryParsePublishedGeeStatisticsSource(
    layer.statisticsSource,
  );
  if (layer.statisticsSource && !statisticsSource) {
    console.warn(
      `[panelLayerRepository] statisticsSource inválido para panelLayer ${layer.id}; a fonte dinâmica foi ignorada.`,
    );
  }

  const reportConfig = tryParsePublishedPanelLayerReportConfig(
    layer.reportConfig,
  );
  if (layer.reportConfig && !reportConfig) {
    console.warn(
      `[panelLayerRepository] reportConfig inválido para panelLayer ${layer.id}; o texto do relatório caiu para o Google Docs.`,
    );
  }

  const forecastFacets = tryParsePanelLayerForecastFacets(layer.forecastFacets);
  if (layer.forecastFacets && !forecastFacets) {
    console.warn(
      `[panelLayerRepository] forecastFacets inválido para panelLayer ${layer.id}; o índice ficou fora dos filtros da previsão.`,
    );
  }

  return {
    ...layer,
    imageData: keepOnlyCurrentSeasonPeriod(
      keepOnlyFutureForecastPeriods(layer.id, layer.imageData),
      Boolean(statisticsSource && hasSeasonalPeriods({ statisticsSource })),
    ),
    ...(statisticsSource ? { statisticsSource } : { statisticsSource: null }),
    ...(reportConfig ? { reportConfig } : { reportConfig: null }),
    forecastFacets,
  };
}

function normalizePanelLayers(items: Array<PanelLayerI | null> = []) {
  return items.filter(isDefined).map(normalizePanelLayer);
}

/**
 * Campo desconhecido volta do Contentful como HTTP 400, e só isso justifica
 * tentar a variante seguinte da query. Um 5xx é o Contentful fora do ar: as
 * variantes mais enxutas falhariam igual e só multiplicariam as chamadas
 * enquanto ele se recupera.
 */
function isContentfulUnavailable(error: unknown) {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" && status >= 500;
}

async function loadPanelLayersFromContentful(): Promise<PanelLayerI[]> {
  let firstError: unknown;
  for (const query of queryVariants(GET_PANEL_LAYER)) {
    try {
      const data = await getContent<PanelLayerResponse>(
        query,
        undefined,
        PANEL_LAYERS_FETCH_OPTIONS,
      );
      return normalizePanelLayers(data.panelLayerCollection?.items).sort(
        comparePanelLayers,
      );
    } catch (error) {
      firstError ??= error;
      if (isContentfulUnavailable(error)) break;
    }
  }
  console.error(
    "Erro ao buscar camadas da plataforma no Contentful:",
    firstError,
  );
  return [];
}

/**
 * Camadas do painel memoizadas no processo, com deduplicação do carregamento em
 * voo. O Data Cache do Next já evita a ida à rede, mas não o custo de reparsear
 * e revalidar as ~500 KB de `panelLayer` a cada request: medimos ~6,5 ms de CPU
 * bloqueante por chamada, que virava o teto de throughput de /api/ee mesmo em
 * cache hit. O TTL é menor que o `revalidate: 3600` do fetch, então isso não
 * deixa uma edição do Contentful mais velha do que já era.
 */
const PANEL_LAYERS_CACHE_TTL_MS = 60_000;

interface PanelLayersCacheEntry {
  expiresAt: number;
  panelLayers: PanelLayerI[];
}

let panelLayersCache: PanelLayersCacheEntry | null = null;
let panelLayersInFlight: Promise<PanelLayerI[]> | null = null;

async function getCachedPanelLayers(): Promise<PanelLayerI[]> {
  if (panelLayersCache && panelLayersCache.expiresAt > Date.now()) {
    return panelLayersCache.panelLayers;
  }

  panelLayersInFlight ??= loadPanelLayersFromContentful()
    .then((panelLayers) => {
      // Uma falha de Contentful devolve [] e não pode ficar memoizada por um
      // minuto, senão um blip apaga o mapa inteiro para todos os usuários.
      if (panelLayers.length > 0) {
        panelLayersCache = {
          expiresAt: Date.now() + PANEL_LAYERS_CACHE_TTL_MS,
          panelLayers,
        };
      }

      return panelLayers;
    })
    .finally(() => {
      panelLayersInFlight = null;
    });

  return panelLayersInFlight;
}

/**
 * Invalida as camadas memoizadas. O catálogo chama isso ao publicar ou editar
 * um índice, junto com os caches de EE e de municipalAnalysis, para a mudança
 * aparecer sem esperar o TTL.
 */
export function clearPanelLayersCache() {
  panelLayersCache = null;
  panelLayersInFlight = null;
}

export async function getPanelLayers(
  options: GetPanelLayersOptions = {},
): Promise<PanelLayerI[]> {
  const panelLayers = await getCachedPanelLayers();

  return options.includeMunicipalAnalysis
    ? attachMunicipalAnalysisToPanelLayers(panelLayers)
    : panelLayers;
}

export async function getPanelLayerWithMunicipalAnalysis(
  panelLayerId: string,
): Promise<PanelLayerI | null> {
  const panelLayer = await getPanelLayerById(panelLayerId);

  if (!panelLayer) {
    return null;
  }

  return attachMunicipalAnalysisToPanelLayer(panelLayer);
}

export async function getPanelLayerWithMunicipalAnalysisYear(
  panelLayerId: string,
  yearKey: string,
  locationKey?: string,
): Promise<PanelLayerI | null> {
  const panelLayer = await getPanelLayerById(panelLayerId);

  if (!panelLayer) {
    return null;
  }

  return attachMunicipalAnalysisYearToPanelLayer(
    panelLayer,
    yearKey,
    locationKey,
  );
}

/**
 * Procura na mesma lista memoizada de `getPanelLayers`, em vez de uma query
 * própria por id: os chamadores em paralelo dividem um único carregamento, e um
 * id ainda não publicado não fica guardado como "não encontrado" — aparece
 * assim que a lista é recarregada.
 */
export async function getPanelLayerById(
  panelLayerId: string,
): Promise<PanelLayerI | null> {
  const panelLayers = await getCachedPanelLayers();
  return panelLayers.find((layer) => layer.id === panelLayerId) ?? null;
}
