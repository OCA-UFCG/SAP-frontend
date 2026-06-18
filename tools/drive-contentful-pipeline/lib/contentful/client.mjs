import { DEFAULT_LOCALE } from "./env.mjs";

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
export const CONTENTFUL_WRITE_DELAY_MS = 150;

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function contentfulFetch(url, init, context, attempt = 1) {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < 5) {
      const retryAfter = Number(
        response.headers.get("x-contentful-ratelimit-reset"),
      );
      const delayMs = Number.isFinite(retryAfter)
        ? Math.max(retryAfter * 1000, 1000)
        : 1000 * attempt;

      await sleep(delayMs);
      return contentfulFetch(url, init, context, attempt + 1);
    }

    throw new Error(
      `${context} falhou com status ${response.status}: ${text.slice(0, 2000)}`,
    );
  }

  return text ? JSON.parse(text) : null;
}

export function managementBaseUrl(config) {
  return `https://api.contentful.com/spaces/${config.spaceId}/environments/${config.environment}`;
}

export function graphQlUrl(config) {
  return `https://graphql.contentful.com/content/v1/spaces/${config.spaceId}/environments/${config.environment}`;
}

export async function getDefaultLocale(config, required = true) {
  if (!config.managementToken) {
    return { locale: DEFAULT_LOCALE, warning: null };
  }

  try {
    const data = await contentfulFetch(
      `${managementBaseUrl(config)}/locales`,
      { headers: { Authorization: `Bearer ${config.managementToken}` } },
      "Consulta de locales do Contentful",
    );
    const defaultLocale = data.items?.find((locale) => locale.default);

    return { locale: defaultLocale?.code ?? DEFAULT_LOCALE, warning: null };
  } catch (error) {
    if (required) throw error;

    return {
      locale: DEFAULT_LOCALE,
      warning: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getLocalizedField(entry, fieldId, locale) {
  return entry.fields?.[fieldId]?.[locale];
}
