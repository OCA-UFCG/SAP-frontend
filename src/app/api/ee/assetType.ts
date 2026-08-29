import "server-only";

import ee from "@google/earthengine";
import type { CompactMapVisualizationConfig } from "@/utils/analysis";

/**
 * Tipo de asset já normalizado: a API do Earth Engine responde
 * `ImageCollection`, `IMAGE_COLLECTION` ou `image-collection` conforme a versão
 * do endpoint, e `TABLE` para FeatureCollection.
 */
export type NormalizedGeeAssetType = string;

// O tipo e as bandas de um asset do Earth Engine são fixos: mudam só quando
// alguém reexporta o asset com outra estrutura. O TTL existe para esse caso
// raro se curar sozinho; a publicação do catálogo limpa o cache na hora.
const ASSET_TYPE_TTL_MS = 1000 * 60 * 60 * 6;

interface AssetTypeEntry {
  assetType: NormalizedGeeAssetType;
  timestamp: number;
}

// Sem teto de entradas de propósito: a chave é um `imageId` publicado no
// Contentful, então o espaço é o dos assets do catálogo (~450 hoje) e não
// cresce com o tráfego.
const assetTypes = new Map<string, AssetTypeEntry>();
// Uma promessa por assetId em voo, pelo mesmo motivo de `getOrCreateCachedUrl`:
// os N usuários que caem no mesmo miss compartilham uma ida ao Earth Engine.
const pendingAssetTypes = new Map<string, Promise<NormalizedGeeAssetType>>();

export function normalizeGeeAssetType(type?: unknown) {
  return type
    ? String(type)
        .toUpperCase()
        .replace(/[_\s-]/g, "")
    : "";
}

/**
 * O `sourceType` publicado pelo catálogo v2 já diz se o asset é imagem, coleção
 * de imagens ou FeatureCollection. Quando ele está presente não há nada a
 * perguntar ao Earth Engine, e cada pergunta custa cerca de um segundo.
 *
 * mapVisualizationAssetType({ sourceType: "featureCollection" }); // "TABLE"
 */
export function mapVisualizationAssetType(
  mapVisualization?: CompactMapVisualizationConfig,
): NormalizedGeeAssetType | null {
  switch (mapVisualization?.sourceType) {
    case "featureCollection":
      return "TABLE";
    case "imageCollection":
      return "IMAGECOLLECTION";
    case "image":
      return "IMAGE";
    default:
      return null;
  }
}

function requestAssetType(
  assetId: string,
): Promise<NormalizedGeeAssetType> {
  return new Promise((resolve) => {
    ee.data.getAsset(
      assetId,
      (asset: { type?: unknown } | undefined) =>
        resolve(normalizeGeeAssetType(asset?.type)),
      // Fallback seguro: sem tipo, `getEarthEngineUrl` cai no ramo de
      // `ee.Image`, que é o comportamento histórico das camadas legadas.
      () => resolve(""),
    );
  });
}

function getFreshAssetType(assetId: string) {
  const entry = assetTypes.get(assetId);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > ASSET_TYPE_TTL_MS) {
    assetTypes.delete(assetId);
    return null;
  }

  return entry.assetType;
}

/**
 * Tipo do asset do Earth Engine, sem ida à rede quando o `mapVisualization` já
 * o declara ou quando outro período do mesmo asset já perguntou.
 *
 * await resolveGeeAssetType(imageId, mapVisualization); // "IMAGE"
 */
export async function resolveGeeAssetType(
  assetId: string,
  mapVisualization?: CompactMapVisualizationConfig,
): Promise<NormalizedGeeAssetType> {
  const declaredType = mapVisualizationAssetType(mapVisualization);
  if (declaredType) {
    return declaredType;
  }

  const cachedType = getFreshAssetType(assetId);
  if (cachedType !== null) {
    return cachedType;
  }

  const pending = pendingAssetTypes.get(assetId);
  if (pending) {
    return pending;
  }

  const request = requestAssetType(assetId)
    .then((assetType) => {
      // Tipo vazio é a resposta de falha, e falha não entra em cache: guardá-la
      // por 6 h faria uma indisponibilidade momentânea do Earth Engine fixar o
      // ramo `ee.Image` numa camada que é FeatureCollection.
      if (assetType) {
        assetTypes.set(assetId, { assetType, timestamp: Date.now() });
      }
      return assetType;
    })
    .finally(() => {
      pendingAssetTypes.delete(assetId);
    });

  pendingAssetTypes.set(assetId, request);
  return request;
}

export function clearGeeAssetTypeCache() {
  assetTypes.clear();
  pendingAssetTypes.clear();
}

export { ASSET_TYPE_TTL_MS };
