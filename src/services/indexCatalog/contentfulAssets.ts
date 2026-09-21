import "server-only";

import {
  contentfulManagementFetch,
  getContentfulManagementConfig,
} from "@/services/indexCatalog/contentfulManagement";

/**
 * O processamento de arquivo no Contentful é assíncrono: o PUT /process
 * responde 204 e a URL do arquivo só aparece depois. Esperamos por ela porque
 * é essa URL que o cartão do Monitoramento carrega — e, no índice vindo de
 * planilha, também a que a plataforma lê para ter os valores.
 */
const ASSET_PROCESSING_ATTEMPTS = 12;
const ASSET_PROCESSING_DELAY_MS = 500;

/** Uploads são por espaço, não por ambiente, e ficam em outro host. */
const CONTENTFUL_UPLOAD_HOST = "https://upload.contentful.com";

const ASSET_JSON_CONTENT_TYPE = "application/vnd.contentful.management.v1+json";

interface ContentfulAssetFile {
  url?: string;
  fileName?: string;
  contentType?: string;
}

export interface ContentfulAsset {
  sys: { id: string; version: number; publishedVersion?: number };
  fields: {
    title?: Record<string, string | undefined>;
    file?: Record<string, ContentfulAssetFile | undefined>;
  };
}

export interface ContentfulAssetUploadInput {
  /** Reaproveita o asset já ligado ao índice, para não acumular órfãos. */
  assetId?: string;
  bytes: Uint8Array<ArrayBuffer>;
  contentType: string;
  fileName: string;
  title: string;
  locale: string;
}

export interface SavedContentfulAsset {
  assetId: string;
  url: string;
}

function absoluteAssetUrl(url: string) {
  return url.startsWith("//") ? `https:${url}` : url;
}

async function uploadAssetBytes(
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
) {
  const config = getContentfulManagementConfig();
  const response = await fetch(
    `${CONTENTFUL_UPLOAD_HOST}/spaces/${config.spaceId}/uploads`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
        "Content-Type": "application/octet-stream",
        "X-Contentful-Upload-Content-Type": contentType,
      },
      body: bytes,
      cache: "no-store",
    },
  );
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Upload do arquivo para o Contentful falhou com status ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  const uploadId = (JSON.parse(text) as { sys?: { id?: string } }).sys?.id;

  if (!uploadId) {
    throw new Error(
      `Upload do arquivo para o Contentful não retornou sys.id: ${text.slice(0, 200)}`,
    );
  }

  return uploadId;
}

function buildAssetFileField(
  input: ContentfulAssetUploadInput,
  uploadId: string,
) {
  return {
    [input.locale]: {
      contentType: input.contentType,
      fileName: input.fileName,
      uploadFrom: { sys: { type: "Link", linkType: "Upload", id: uploadId } },
    },
  };
}

function buildAssetFields(input: ContentfulAssetUploadInput, uploadId: string) {
  return {
    title: { [input.locale]: input.title },
    file: buildAssetFileField(input, uploadId),
  };
}

async function createContentfulAsset(
  input: ContentfulAssetUploadInput,
  uploadId: string,
) {
  return contentfulManagementFetch<ContentfulAsset>(
    "/assets",
    {
      method: "POST",
      headers: { "Content-Type": ASSET_JSON_CONTENT_TYPE },
      body: JSON.stringify({ fields: buildAssetFields(input, uploadId) }),
    },
    "Criação do asset no Contentful",
  );
}

async function replaceContentfulAssetFile(
  asset: ContentfulAsset,
  input: ContentfulAssetUploadInput,
  uploadId: string,
) {
  return contentfulManagementFetch<ContentfulAsset>(
    `/assets/${encodeURIComponent(asset.sys.id)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": ASSET_JSON_CONTENT_TYPE,
        "X-Contentful-Version": String(asset.sys.version),
      },
      body: JSON.stringify({
        fields: { ...asset.fields, ...buildAssetFields(input, uploadId) },
      }),
    },
    `Atualização do asset ${asset.sys.id}`,
  );
}

async function processAssetFile(asset: ContentfulAsset, locale: string) {
  await contentfulManagementFetch<null>(
    `/assets/${encodeURIComponent(asset.sys.id)}/files/${encodeURIComponent(locale)}/process`,
    {
      method: "PUT",
      headers: { "X-Contentful-Version": String(asset.sys.version) },
    },
    `Processamento do asset ${asset.sys.id}`,
  );
}

export async function getContentfulAsset(assetId: string) {
  return contentfulManagementFetch<ContentfulAsset>(
    `/assets/${encodeURIComponent(assetId)}`,
    { method: "GET" },
    `Consulta do asset ${assetId}`,
  );
}

/** Um asset removido à mão no Contentful não pode travar uma nova captura. */
async function findAssetOrNull(assetId: string) {
  try {
    return await getContentfulAsset(assetId);
  } catch (error) {
    if (error instanceof Error && /status 404/.test(error.message)) {
      return null;
    }
    throw error;
  }
}

export function getAssetFileUrl(asset: ContentfulAsset, locale: string) {
  const url = asset.fields.file?.[locale]?.url;
  return url ? absoluteAssetUrl(url) : null;
}

async function waitForProcessedAsset(assetId: string, locale: string) {
  for (let attempt = 1; attempt <= ASSET_PROCESSING_ATTEMPTS; attempt += 1) {
    const asset = await getContentfulAsset(assetId);
    const url = getAssetFileUrl(asset, locale);
    if (url) return { asset, url };
    await new Promise((resolve) =>
      setTimeout(resolve, ASSET_PROCESSING_DELAY_MS),
    );
  }

  throw new Error(
    `O Contentful não terminou de processar o asset ${assetId} em ${ASSET_PROCESSING_ATTEMPTS} tentativas. Tente gerar o arquivo novamente.`,
  );
}

async function publishAsset(asset: ContentfulAsset) {
  return contentfulManagementFetch<ContentfulAsset>(
    `/assets/${encodeURIComponent(asset.sys.id)}/published`,
    {
      method: "PUT",
      headers: { "X-Contentful-Version": String(asset.sys.version) },
    },
    `Publicação do asset ${asset.sys.id}`,
  );
}

/**
 * Sobe o arquivo, espera o processamento e publica o asset. O asset é publicado
 * na hora porque a URL só existe publicada; o índice em si continua invisível
 * no Monitoramento até a entry do panelLayer ser publicada.
 *
 * @example
 * const saved = await saveContentfulAsset({
 *   assetId: config.previewMap?.assetId,
 *   bytes, contentType: "image/png",
 *   fileName: "indice-aridez-previa-mapa.png",
 *   title: "Prévia do mapa — Índice de Aridez",
 *   locale: "en-US",
 * });
 */
export async function saveContentfulAsset(
  input: ContentfulAssetUploadInput,
): Promise<SavedContentfulAsset> {
  const uploadId = await uploadAssetBytes(input.bytes, input.contentType);
  const existing = input.assetId ? await findAssetOrNull(input.assetId) : null;
  const draft = existing
    ? await replaceContentfulAssetFile(existing, input, uploadId)
    : await createContentfulAsset(input, uploadId);

  await processAssetFile(draft, input.locale);
  const processed = await waitForProcessedAsset(draft.sys.id, input.locale);
  await publishAsset(processed.asset);

  return { assetId: processed.asset.sys.id, url: processed.url };
}
