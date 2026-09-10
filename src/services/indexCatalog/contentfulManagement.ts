import "server-only";

import type {
  IndexCatalogConfig,
  IndexCatalogItem,
} from "@/types/indexCatalog";
import {
  isManagedCatalogConfig,
  isPresentationManagedCatalogConfig,
} from "@/types/indexCatalog";
import { reconcileCatalogPublicationStatus } from "@/utils/indexCatalog";
import { isCompactImageData } from "@/utils/imageData";
import type { ImageDataConfig } from "@/utils/interfaces";

const CONTENTFUL_RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const DEFAULT_LOCALE = "en-US";

/**
 * Campos `Object` que o catálogo escreve no `panelLayer` e que o content type
 * precisa ter antes da primeira escrita — o Contentful rejeita uma entry com
 * campo desconhecido, e sem `reportConfig` o índice publicado seguiria
 * dependendo de uma seção no Google Docs para ter texto no relatório.
 */
const CATALOG_PANEL_LAYER_FIELDS = [
  { id: "catalogConfig", name: "Configuração do catálogo" },
  { id: "statisticsSource", name: "Fonte estatística GEE" },
  { id: "reportConfig", name: "Texto do Relatório Automático" },
] as const;

export interface ContentfulManagementConfig {
  spaceId: string;
  environment: string;
  managementToken: string;
}

interface ContentfulSys {
  id: string;
  version: number;
  publishedAt?: string;
  firstPublishedAt?: string;
  publishedVersion?: number;
  contentType?: {
    sys?: {
      id?: string;
    };
  };
}

export interface ContentfulManagementEntry {
  sys: ContentfulSys;
  fields: Record<string, Record<string, unknown> | undefined>;
}

interface ContentfulContentType {
  sys: {
    id: string;
    version: number;
  };
  name: string;
  description?: string;
  displayField?: string;
  fields: Array<
    Record<string, unknown> & {
      id: string;
      required?: boolean;
    }
  >;
}

function requiredEnv(primary: string, fallback?: string) {
  const value = process.env[primary] ?? (fallback ? process.env[fallback] : "");

  if (!value) {
    throw new Error(
      `Variável obrigatória ausente: ${primary}${fallback ? ` ou ${fallback}` : ""}.`,
    );
  }

  return value;
}

export function getContentfulManagementConfig(): ContentfulManagementConfig {
  return {
    spaceId: requiredEnv(
      "CONTENTFUL_SPACE_ID",
      "NEXT_PUBLIC_CONTENTFUL_SPACE_ID",
    ),
    environment:
      process.env.CONTENTFUL_ENVIRONMENT ??
      process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT ??
      "master",
    managementToken: requiredEnv("CONTENTFUL_MANAGEMENT_TOKEN"),
  };
}

function managementBaseUrl(config: ContentfulManagementConfig) {
  return `https://api.contentful.com/spaces/${config.spaceId}/environments/${config.environment}`;
}

export async function contentfulManagementFetch<T>(
  path: string,
  init: RequestInit,
  context: string,
  attempt = 1,
): Promise<T> {
  const config = getContentfulManagementConfig();
  const response = await fetch(`${managementBaseUrl(config)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.managementToken}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await response.text();

  if (!response.ok) {
    if (CONTENTFUL_RETRYABLE_STATUS.has(response.status) && attempt < 5) {
      const retrySeconds = Number(
        response.headers.get("x-contentful-ratelimit-reset"),
      );
      const delayMs = Number.isFinite(retrySeconds)
        ? Math.max(retrySeconds * 1000, 1_000)
        : attempt * 1_000;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return contentfulManagementFetch<T>(path, init, context, attempt + 1);
    }

    throw new Error(
      `${context} falhou com status ${response.status}: ${text.slice(0, 1_000)}`,
    );
  }

  return (text ? JSON.parse(text) : null) as T;
}

let defaultLocalePromise: Promise<string> | null = null;

export function getContentfulDefaultLocale() {
  defaultLocalePromise ??= contentfulManagementFetch<{
    items?: Array<{ code?: string; default?: boolean }>;
  }>("/locales", { method: "GET" }, "Consulta de locales do Contentful")
    .then(
      (response) =>
        response.items?.find((locale) => locale.default)?.code ??
        DEFAULT_LOCALE,
    )
    .catch((error) => {
      defaultLocalePromise = null;
      throw error;
    });

  return defaultLocalePromise;
}

function localized(value: unknown, locale: string) {
  return { [locale]: value };
}

export function getLocalizedEntryField<T>(
  entry: ContentfulManagementEntry,
  fieldId: string,
  locale: string,
): T | undefined {
  return entry.fields[fieldId]?.[locale] as T | undefined;
}

/**
 * Contentful manda: uma entry sem `publishedAt` não está no Monitoramento,
 * mesmo que o catálogo tenha guardado `status: "published"`. Devolver o config
 * reconciliado é o que deixa o resto do serviço (inclusive `assertPublishable`)
 * enxergar o estado real em vez da memória do catálogo.
 */
function toReconciledCatalogConfig(
  config: IndexCatalogConfig | undefined,
  published: boolean,
) {
  if (!isManagedCatalogConfig(config)) {
    return null;
  }

  return {
    ...config,
    status: reconcileCatalogPublicationStatus(config, published),
  };
}

/**
 * O catálogo só adota um legado cujo `imageData` já está no formato
 * `territorial-compact`: a captura da imagem de prévia e a prévia do relatório
 * leem `classes`, `years` e `defaultYear` de lá. No formato pré-compacto
 * (`imageParams` por ano) nada disso existe, e adotar entregaria uma tela que
 * quebra em vez de um índice editável.
 */
function describeAdoptability(
  entry: ContentfulManagementEntry,
  locale: string,
) {
  const imageData = getLocalizedEntryField<ImageDataConfig>(
    entry,
    "imageData",
    locale,
  );
  if (!imageData) {
    return {
      adoptable: false,
      adoptionBlockedReason:
        "A entry não tem imageData: não há mapa nem períodos para o catálogo mostrar.",
    };
  }
  if (!isCompactImageData(imageData)) {
    return {
      adoptable: false,
      adoptionBlockedReason:
        "O imageData desta entry ainda está no formato pré-compacto (imageParams por ano). Converta para territorial-compact antes de adotar.",
    };
  }
  return { adoptable: true };
}

function toCatalogItem(
  entry: ContentfulManagementEntry,
  locale: string,
): IndexCatalogItem {
  const config = getLocalizedEntryField<IndexCatalogConfig>(
    entry,
    "catalogConfig",
    locale,
  );
  const published = Boolean(entry.sys.publishedAt);
  const hasUnpublishedChanges = Boolean(
    published &&
    typeof entry.sys.publishedVersion === "number" &&
    entry.sys.version > entry.sys.publishedVersion + 1,
  );

  const managedConfig = toReconciledCatalogConfig(config, published);
  const effectiveConfig = managedConfig ?? config;
  const adoptability = managedConfig
    ? { adoptable: false }
    : describeAdoptability(entry, locale);

  return {
    entryId: entry.sys.id,
    panelLayerId:
      getLocalizedEntryField<string>(entry, "id", locale) ??
      config?.panelLayerId ??
      "",
    name:
      getLocalizedEntryField<string>(entry, "name", locale) ??
      (typeof config?.name === "string" ? config.name : undefined) ??
      "Índice sem nome",
    description:
      getLocalizedEntryField<string>(entry, "description", locale) ??
      (typeof config?.description === "string"
        ? config.description
        : undefined) ??
      "",
    category:
      getLocalizedEntryField<string>(entry, "category", locale) ??
      (typeof config?.category === "string" ? config.category : undefined),
    // A posição pedida no catálogo vem antes da que está publicada: ela é o que
    // o formulário tem de reabrir mostrando, e é sobre ela que o aviso de
    // posição ocupada precisa avisar. O número em vigor continua no campo da
    // entry, e é ele que a publicação troca (`resolvePanelPositionPlan`).
    panelPosition:
      (typeof effectiveConfig?.panelPosition === "number"
        ? effectiveConfig.panelPosition
        : undefined) ??
      getLocalizedEntryField<number>(entry, "panelPosition", locale),
    published,
    everPublished: Boolean(entry.sys.firstPublishedAt ?? entry.sys.publishedAt),
    hasUnpublishedChanges,
    measurementUnit: getLocalizedEntryField<string>(
      entry,
      "measurementUnit",
      locale,
    ),
    catalogManaged: Boolean(managedConfig),
    managedScope: managedConfig
      ? isPresentationManagedCatalogConfig(managedConfig)
        ? "presentation"
        : "full"
      : null,
    ...adoptability,
    status: managedConfig
      ? published && !hasUnpublishedChanges
        ? "published"
        : managedConfig.status
      : "legacy",
    ...(effectiveConfig ? { catalogConfig: effectiveConfig } : {}),
  };
}

export async function listCatalogEntries() {
  const locale = await getContentfulDefaultLocale();
  const entries: ContentfulManagementEntry[] = [];
  const limit = 100;

  for (let skip = 0; ; skip += limit) {
    const params = new URLSearchParams({
      content_type: "panelLayer",
      limit: String(limit),
      skip: String(skip),
      order: "fields.name",
    });
    const response = await contentfulManagementFetch<{
      total?: number;
      items?: ContentfulManagementEntry[];
    }>(
      `/entries?${params.toString()}`,
      { method: "GET" },
      "Listagem do catálogo",
    );
    const page = response.items ?? [];
    entries.push(...page);

    if (page.length === 0 || entries.length >= (response.total ?? 0)) {
      break;
    }
  }

  return entries.map((entry) => toCatalogItem(entry, locale));
}

export async function getManagementEntry(entryId: string) {
  return contentfulManagementFetch<ContentfulManagementEntry>(
    `/entries/${encodeURIComponent(entryId)}`,
    { method: "GET" },
    `Leitura da entry ${entryId}`,
  );
}

export async function getCatalogEntry(entryId: string) {
  const [entry, locale] = await Promise.all([
    getManagementEntry(entryId),
    getContentfulDefaultLocale(),
  ]);
  return {
    entry,
    locale,
    item: toCatalogItem(entry, locale),
  };
}

export async function createPanelLayerDraft(fields: Record<string, unknown>) {
  const locale = await getContentfulDefaultLocale();
  return contentfulManagementFetch<ContentfulManagementEntry>(
    "/entries",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.contentful.management.v1+json",
        "X-Contentful-Content-Type": "panelLayer",
      },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(fields).flatMap(([key, value]) =>
            value === undefined ? [] : [[key, localized(value, locale)]],
          ),
        ),
      }),
    },
    "Criação do rascunho de índice",
  );
}

export async function patchManagementEntry(
  entry: ContentfulManagementEntry,
  fields: Record<string, unknown>,
) {
  const locale = await getContentfulDefaultLocale();
  const nextFields = { ...entry.fields };

  for (const [fieldId, value] of Object.entries(fields)) {
    if (value === undefined) {
      delete nextFields[fieldId];
      continue;
    }

    nextFields[fieldId] = localized(value, locale);
  }

  return contentfulManagementFetch<ContentfulManagementEntry>(
    `/entries/${encodeURIComponent(entry.sys.id)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/vnd.contentful.management.v1+json",
        "X-Contentful-Version": String(entry.sys.version),
      },
      body: JSON.stringify({ fields: nextFields }),
    },
    `Atualização da entry ${entry.sys.id}`,
  );
}

export async function publishManagementEntry(entry: ContentfulManagementEntry) {
  return contentfulManagementFetch<ContentfulManagementEntry>(
    `/entries/${encodeURIComponent(entry.sys.id)}/published`,
    {
      method: "PUT",
      headers: {
        "X-Contentful-Version": String(entry.sys.version),
      },
    },
    `Publicação da entry ${entry.sys.id}`,
  );
}

export async function unpublishManagementEntry(
  entry: ContentfulManagementEntry,
) {
  if (!entry.sys.publishedAt) {
    return entry;
  }

  return contentfulManagementFetch<ContentfulManagementEntry>(
    `/entries/${encodeURIComponent(entry.sys.id)}/published`,
    {
      method: "DELETE",
      headers: {
        "X-Contentful-Version": String(entry.sys.version),
      },
    },
    `Despublicação da entry ${entry.sys.id}`,
  );
}

export async function deleteManagementEntry(entry: ContentfulManagementEntry) {
  await contentfulManagementFetch<null>(
    `/entries/${encodeURIComponent(entry.sys.id)}`,
    {
      method: "DELETE",
      headers: {
        "X-Contentful-Version": String(entry.sys.version),
      },
    },
    `Exclusão da entry ${entry.sys.id}`,
  );
}

export async function ensureIndexCatalogContentModel() {
  const contentType = await contentfulManagementFetch<ContentfulContentType>(
    "/content_types/panelLayer",
    { method: "GET" },
    "Leitura do content type panelLayer",
  );
  const existing = new Set(contentType.fields.map((field) => field.id));
  const missing = CATALOG_PANEL_LAYER_FIELDS.filter(
    (field) => !existing.has(field.id),
  );
  const previewMap = contentType.fields.find(
    (field) => field.id === "previewMap",
  );
  const needsOptionalPreview = Boolean(previewMap?.required);

  if (missing.length === 0 && !needsOptionalPreview) {
    return { changed: false };
  }

  const fields = contentType.fields.map((field) =>
    field.id === "previewMap" ? { ...field, required: false } : field,
  );
  for (const field of missing) {
    fields.push({
      ...field,
      type: "Object",
      localized: false,
      required: false,
      validations: [],
      disabled: false,
      omitted: false,
    });
  }

  const updated = await contentfulManagementFetch<ContentfulContentType>(
    "/content_types/panelLayer",
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/vnd.contentful.management.v1+json",
        "X-Contentful-Version": String(contentType.sys.version),
      },
      body: JSON.stringify({
        name: contentType.name,
        description: contentType.description,
        displayField: contentType.displayField ?? "id",
        fields,
      }),
    },
    "Atualização do content type panelLayer para o catálogo",
  );

  await contentfulManagementFetch(
    "/content_types/panelLayer/published",
    {
      method: "PUT",
      headers: {
        "X-Contentful-Version": String(updated.sys.version),
      },
    },
    "Publicação do content type panelLayer",
  );

  return { changed: true };
}
