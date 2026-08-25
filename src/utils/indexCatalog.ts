import { parseGeeFeatureCollectionStatisticsSource } from "@/contracts/geeStatistics";
import {
  INDEX_CATEGORIES,
  type ClassMapping,
  type EarthEngineAssetMapping,
  type IndexCatalogConfigV2,
  type IndexCatalogDraftInput,
  type IndexCategory,
} from "@/types/indexCatalog";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;
const ASSET_ID_PATTERN = /^[A-Za-z0-9_./{}-]{3,300}$/u;
const PERIOD_PATTERN = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/u;
const ASSET_YEAR_PATTERN = /(?<![0-9])(?:19|20|21)\d{2}(?![0-9])/gu;
const ASSET_MONTH_SUFFIX_PATTERN = /^([_\-./])(0[1-9]|1[0-2])(?![0-9])/u;
const GEE_PROPERTY_PATTERN = /^[A-Za-z_][A-Za-z0-9_:.-]{0,119}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} é obrigatório.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`${label} deve ter no máximo ${maxLength} caracteres.`);
  }
  return normalized;
}

export function normalizeCatalogText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

export function createCatalogPanelLayerId(name: string) {
  const normalized = normalizeCatalogText(name)
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 72);
  return normalized || "indice";
}

export function makeUniqueCatalogPanelLayerId(
  name: string,
  existingIds: Iterable<string>,
) {
  const base = createCatalogPanelLayerId(name);
  const used = new Set(
    Array.from(existingIds, (id) => id.toLocaleLowerCase("pt-BR")),
  );
  if (!used.has(base)) return base;

  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const candidate = `${base.slice(0, 76 - String(suffix).length)}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("Não foi possível gerar um identificador único.");
}

/**
 * Reconcilia o `status` guardado no `catalogConfig` com o estado real de
 * publicação da entry no Contentful, que é a autoridade: `sys.publishedAt`.
 *
 * Os dois divergem quando a entry deixa de estar publicada por fora do
 * catálogo — despublicada no app do Contentful, ou um "Excluir" que
 * despublicou e falhou ao remover. Sem reconciliar, um índice com
 * `status: "published"` numa entry em rascunho fica impossível de publicar:
 * `assertPublishable` só aceita `ready`, e o operador recebe "Revalide os
 * assets e gere a prévia antes de publicar" mesmo com a prévia validada.
 *
 * @example
 * reconcileCatalogPublicationStatus({ status: "published", validation }, false);
 * // => "ready"  (a prévia validada continua valendo; basta publicar de novo)
 */
export function reconcileCatalogPublicationStatus(
  config: Pick<IndexCatalogConfigV2, "status" | "validation">,
  published: boolean,
): IndexCatalogConfigV2["status"] {
  if (published || config.status !== "published") {
    return config.status;
  }
  return config.validation?.valid ? "ready" : "draft";
}

function parseClasses(value: unknown): ClassMapping[] {
  if (!Array.isArray(value) || value.length > 100) {
    throw new Error("Configuração de classes inválida.");
  }

  const classes = value.map((entry, position) => {
    if (!isRecord(entry)) throw new Error(`Classe ${position + 1} inválida.`);
    const classIndex = Number(entry.classIndex);
    if (!Number.isInteger(classIndex) || classIndex < 0) {
      throw new Error(`Índice da classe ${position + 1} inválido.`);
    }
    const label = requiredString(
      entry.label,
      `Rótulo da classe ${classIndex}`,
      120,
    );
    const color = requiredString(entry.color, `Cor da classe ${classIndex}`, 7);
    if (!HEX_COLOR_PATTERN.test(color)) {
      throw new Error(`Cor da classe ${classIndex} deve usar #RRGGBB.`);
    }
    return {
      classIndex,
      id:
        typeof entry.id === "string" && entry.id.trim()
          ? createCatalogPanelLayerId(entry.id)
          : createCatalogPanelLayerId(label),
      label,
      color: color.toUpperCase(),
      ...(typeof entry.pixelValue === "number" &&
      Number.isFinite(entry.pixelValue)
        ? { pixelValue: entry.pixelValue }
        : { pixelValue: classIndex }),
    };
  });

  const indexes = new Set(classes.map((entry) => entry.classIndex));
  const ids = new Set(classes.map((entry) => entry.id));
  if (indexes.size !== classes.length || ids.size !== classes.length) {
    throw new Error("As classes não podem ter índices ou IDs duplicados.");
  }
  return classes.sort((left, right) => left.classIndex - right.classIndex);
}

function parseEarthEngineMapping(value: unknown): EarthEngineAssetMapping {
  if (!isRecord(value)) {
    throw new Error("O asset de visualização do mapa é obrigatório.");
  }
  const strategy = value.strategy;
  const sourceType = value.sourceType;
  if (strategy !== "single" && strategy !== "perPeriod") {
    throw new Error("Estratégia do asset de mapa inválida.");
  }
  if (
    sourceType !== "image" &&
    sourceType !== "imageCollection" &&
    sourceType !== "featureCollection"
  ) {
    throw new Error("Tipo do asset de mapa inválido.");
  }

  const singleAssetId =
    typeof value.singleAssetId === "string" ? value.singleAssetId.trim() : "";
  const assetPattern =
    typeof value.assetPattern === "string" ? value.assetPattern.trim() : "";
  const assetsByPeriod = isRecord(value.assetsByPeriod)
    ? Object.fromEntries(
        Object.entries(value.assetsByPeriod).flatMap(([period, asset]) =>
          PERIOD_PATTERN.test(period) &&
          typeof asset === "string" &&
          asset.trim()
            ? [[period, asset.trim()]]
            : [],
        ),
      )
    : undefined;

  if (strategy === "single" && !singleAssetId) {
    throw new Error("Informe o asset único de visualização.");
  }
  if (
    strategy === "perPeriod" &&
    !assetPattern &&
    Object.keys(assetsByPeriod ?? {}).length === 0
  ) {
    throw new Error("Informe o template ou os assets de mapa por período.");
  }
  for (const asset of [
    singleAssetId,
    assetPattern,
    ...Object.values(assetsByPeriod ?? {}),
  ]) {
    if (asset && !ASSET_ID_PATTERN.test(asset)) {
      throw new Error(`Asset de visualização inválido: ${asset}.`);
    }
  }

  const thresholds = Array.isArray(value.thresholds)
    ? value.thresholds.map(Number)
    : undefined;
  if (
    thresholds?.some((threshold) => !Number.isFinite(threshold)) ||
    thresholds?.some(
      (threshold, index) => index > 0 && threshold <= thresholds[index - 1],
    )
  ) {
    throw new Error("Os limites do mapa devem ser números crescentes.");
  }

  let collectionSelection: EarthEngineAssetMapping["collectionSelection"];
  if (value.collectionSelection != null) {
    if (sourceType !== "imageCollection") {
      throw new Error(
        "A seleção por emissão e horizonte exige uma ImageCollection.",
      );
    }
    if (strategy !== "single") {
      throw new Error(
        "A previsão por emissão e horizonte exige um asset único.",
      );
    }
    if (!isRecord(value.collectionSelection)) {
      throw new Error("Configuração da coleção de previsão inválida.");
    }
    if (value.collectionSelection.type !== "latest-emission-leads") {
      throw new Error("Tratamento da ImageCollection inválido.");
    }
    const emissionProperty = requiredString(
      value.collectionSelection.emissionProperty,
      "Propriedade da emissão",
      120,
    );
    const leadProperty = requiredString(
      value.collectionSelection.leadProperty,
      "Propriedade do horizonte",
      120,
    );
    const targetDateProperty = requiredString(
      value.collectionSelection.targetDateProperty,
      "Propriedade do mês previsto",
      120,
    );
    for (const [label, property] of [
      ["emissão", emissionProperty],
      ["horizonte", leadProperty],
      ["mês previsto", targetDateProperty],
    ] as const) {
      if (!GEE_PROPERTY_PATTERN.test(property)) {
        throw new Error(`Propriedade de ${label} inválida: ${property}.`);
      }
    }
    if (
      !Array.isArray(value.collectionSelection.leadValues) ||
      value.collectionSelection.leadValues.length === 0 ||
      value.collectionSelection.leadValues.length > 24
    ) {
      throw new Error("Informe de 1 a 24 horizontes da previsão.");
    }
    const leadValues = value.collectionSelection.leadValues.map(Number);
    if (
      leadValues.some((lead) => !Number.isInteger(lead) || lead < 1) ||
      new Set(leadValues).size !== leadValues.length
    ) {
      throw new Error(
        "Os horizontes devem ser números inteiros positivos e sem repetição.",
      );
    }
    collectionSelection = {
      type: "latest-emission-leads",
      emissionProperty,
      leadProperty,
      targetDateProperty,
      leadValues: [...leadValues].sort((left, right) => left - right),
    };
  }

  return {
    strategy,
    sourceType,
    ...(singleAssetId ? { singleAssetId } : {}),
    ...(assetPattern ? { assetPattern } : {}),
    ...(assetsByPeriod ? { assetsByPeriod } : {}),
    ...(typeof value.band === "string" && value.band.trim()
      ? { band: value.band.trim() }
      : {}),
    ...(typeof value.property === "string" && value.property.trim()
      ? { property: value.property.trim() }
      : {}),
    ...(thresholds?.length ? { thresholds } : {}),
    ...(collectionSelection ? { collectionSelection } : {}),
  };
}

export function parseIndexCatalogDraftInput(
  value: unknown,
): IndexCatalogDraftInput {
  if (!isRecord(value)) throw new Error("Cadastro inválido.");
  if (
    typeof value.category !== "string" ||
    !(INDEX_CATEGORIES as readonly string[]).includes(value.category)
  ) {
    throw new Error("Categoria inválida.");
  }

  const statisticsSource = parseGeeFeatureCollectionStatisticsSource(
    value.statisticsSource,
  );
  if (statisticsSource.properties.scalarMetrics) {
    throw new Error(
      "O catálogo v2 aceita apenas estatísticas classificatórias nesta versão.",
    );
  }

  return {
    name: requiredString(value.name, "Nome", 120),
    description: requiredString(value.description, "Descrição", 500),
    category: value.category as IndexCategory,
    statisticsSource,
    classes: parseClasses(value.classes),
    earthEngine: parseEarthEngineMapping(value.earthEngine),
  };
}

export interface DetectedPeriodTemplate {
  /** Endereço com `{year}` — e `{month}`, quando houver — no lugar do período. */
  assetIdTemplate: string;
  year: string;
  month?: string;
  /**
   * Uma tabela por mês só pode ser lida como mensal. Uma tabela por ano não diz
   * nada sobre as linhas: a tabela anual do Monitor da ANA guarda os doze meses
   * em `data_img`, então ali a granularidade continua sendo uma escolha.
   */
  granularity?: "month";
}

/**
 * Descobre o template de partição por período a partir do endereço de UM asset.
 *
 * O operador cola `.../Estatistica_Multinivel_MonitorANA_2026` e o catálogo
 * passa a procurar `.../Estatistica_Multinivel_MonitorANA_{year}` no
 * diretório-pai, reunindo os períodos irmãos. Ninguém precisa conhecer a
 * sintaxe `{year}`/`{month}` para cadastrar um índice — quem usa o catálogo
 * conhece o produto e o GEE, não as convenções internas da plataforma.
 *
 * Usa a ÚLTIMA ocorrência de um ano no endereço, porque o caminho até o asset
 * pode conter outros números (`.../Estatisticas_2020/MonitorANA_2026`).
 *
 * O mês só é reconhecido imediatamente depois do ano e separado dele
 * (`..._2026_09`, `..._2026-09`), o que evita confundir sufixos de versão com
 * período.
 */
export function detectPeriodTemplate(
  assetId: string,
): DetectedPeriodTemplate | null {
  const normalized = assetId.trim();
  if (!normalized || /[{}]/u.test(normalized)) return null;

  const lastYear = [...normalized.matchAll(ASSET_YEAR_PATTERN)].at(-1);
  if (!lastYear || lastYear.index === undefined) return null;

  const prefix = normalized.slice(0, lastYear.index);
  const suffix = normalized.slice(lastYear.index + 4);
  const month = ASSET_MONTH_SUFFIX_PATTERN.exec(suffix);

  if (!month) {
    return { assetIdTemplate: `${prefix}{year}${suffix}`, year: lastYear[0] };
  }

  return {
    assetIdTemplate: `${prefix}{year}${month[1]}{month}${suffix.slice(month[0].length)}`,
    year: lastYear[0],
    month: month[2],
    granularity: "month",
  };
}

/** Reexibe um template como o endereço concreto de um período conhecido. */
export function fillPeriodTemplate(template: string, period?: string) {
  const match = period ? PERIOD_PATTERN.exec(period) : null;
  if (!match || !period) return template;

  const [, year, month] = match;
  // Sem o mês não há endereço concreto a mostrar: melhor o template cru do que
  // um endereço truncado que o catálogo nunca vai procurar.
  if (!month && template.includes("{month}")) return template;

  return template
    .replaceAll("{period}", period)
    .replaceAll("{year}", year)
    .replaceAll("{month}", month ?? "");
}

/**
 * Endereço concreto que o formulário pode reexibir sem mentir para o operador.
 *
 * Só devolve um endereço quando a detecção o traduz de volta para exatamente o
 * mesmo template. Em qualquer outro caso — `{period}`, um sufixo fixo que
 * parece mês — a tela mostra o template cru, porque reexibir um endereço que a
 * detecção reinterpretaria de outro jeito faria o operador salvar um template
 * diferente do que já estava publicado.
 */
export function toConcreteAssetSample(template: string, period?: string) {
  const sample = fillPeriodTemplate(template, period);
  if (sample === template) return null;

  return detectPeriodTemplate(sample)?.assetIdTemplate === template
    ? sample
    : null;
}

export function inferTimeScale(periods: readonly string[]) {
  return periods.some((period) => /^\d{4}-\d{2}$/u.test(period))
    ? ("Mensal" as const)
    : periods.some((period) => /^\d{4}$/u.test(period))
      ? ("Anual" as const)
      : undefined;
}

export function expandAssetForPeriod(
  mapping: EarthEngineAssetMapping,
  period: string,
) {
  if (mapping.strategy === "single") return mapping.singleAssetId ?? "";
  return (
    mapping.assetsByPeriod?.[period] ??
    mapping.assetPattern
      ?.replaceAll("{period}", period)
      .replaceAll("{year}", period.slice(0, 4))
      .replaceAll("{month}", period.slice(5, 7)) ??
    ""
  );
}

interface CategoryPositionEntry {
  entryId: string;
  category?: string;
  panelPosition?: number;
}

/**
 * Posição do índice na categoria dele no Monitoramento. Um índice novo entra
 * depois do último — a lista é ordenada por essa posição, então repetir um
 * número já usado deixa a ordem por conta da ordem de chegada do Contentful, e
 * foi assim que um índice recém-publicado apareceu como primeiro em Dados
 * Climáticos em vez de último. Por isso uma posição já ocupada por outra camada
 * da mesma categoria é recalculada, em vez de mantida.
 *
 * @example
 * // anaseca 0, cemadenseca 1, prev_anomalia_precipitacao 10
 * resolvePanelPositionInCategory(entries, "Dados Climáticos", "novo") // 11
 */
export function resolvePanelPositionInCategory(
  entries: readonly CategoryPositionEntry[],
  category: string,
  entryId: string,
) {
  const sameCategory = entries.filter(
    (entry) => entry.entryId !== entryId && entry.category === category,
  );
  const takenPositions = sameCategory.flatMap((entry) =>
    typeof entry.panelPosition === "number" ? [entry.panelPosition] : [],
  );
  const currentPosition = entries.find(
    (entry) => entry.entryId === entryId,
  )?.panelPosition;

  if (
    typeof currentPosition === "number" &&
    !takenPositions.includes(currentPosition)
  ) {
    return currentPosition;
  }

  return takenPositions.length > 0
    ? Math.max(...takenPositions) + 1
    : sameCategory.length;
}
