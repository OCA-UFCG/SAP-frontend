import "server-only";

import type {
  IndexCatalogConfig,
  IndexCatalogItem,
} from "@/types/indexCatalog";
import { isIndexCatalogConfigV2 } from "@/types/indexCatalog";
import { reconcileCatalogPublicationStatus } from "@/utils/indexCatalog";

const CONTENTFUL_RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const DEFAULT_LOCALE = "en-US";

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
  if (!isIndexCatalogConfigV2(config)) {
    return null;
  }

  return {
    ...config,
    status: reconcileCatalogPublicationStatus(config, published),
  };
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
    panelPosition: getLocalizedEntryField<number>(
      entry,
      "panelPosition",
      locale,
    ),
    published,
    everPublished: Boolean(entry.sys.firstPublishedAt ?? entry.sys.publishedAt),
    hasUnpublishedChanges,
    catalogManaged: Boolean(managedConfig),
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
  const catalogField = contentType.fields.find(
    (field) => field.id === "catalogConfig",
  );
  const statisticsSourceField = contentType.fields.find(
    (field) => field.id === "statisticsSource",
  );
  const previewMap = contentType.fields.find(
    (field) => field.id === "previewMap",
  );
  const needsCatalogField = !catalogField;
  const needsStatisticsSourceField = !statisticsSourceField;
  const needsOptionalPreview = Boolean(previewMap?.required);

  if (
    !needsCatalogField &&
    !needsStatisticsSourceField &&
    !needsOptionalPreview
  ) {
    return { changed: false };
  }

  const fields = contentType.fields.map((field) =>
    field.id === "previewMap" ? { ...field, required: false } : field,
  );
  if (needsCatalogField) {
    fields.push({
      id: "catalogConfig",
      name: "Configuração do catálogo",
      type: "Object",
      localized: false,
      required: false,
      validations: [],
      disabled: false,
      omitted: false,
    });
  }
  if (needsStatisticsSourceField) {
    fields.push({
      id: "statisticsSource",
      name: "Fonte estatística GEE",
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
