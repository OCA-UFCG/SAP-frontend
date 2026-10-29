import "server-only";

/**
 * Chamadas por mês que o plano do Contentful aceita, somando GraphQL, CDA, CPA
 * e CMA. Passando disso, o espaço fica bloqueado até o fim do mês e o site
 * perde todo o conteúdo que vem de lá.
 */
export const CONTENTFUL_MONTHLY_API_LIMIT = 100_000;

/**
 * O Contentful só fecha o número de um dia depois que ele acaba, então ler mais
 * de uma vez por hora não traz nada novo. E a leitura é uma chamada à CMA, que
 * conta na mesma cota: assim são ~50 por dia nos dois ambientes.
 */
export const CONTENTFUL_USAGE_TTL_MS = 60 * 60_000;
/**
 * Depois de uma falha, espera isso para tentar de novo: tentar a cada coleta
 * do monitor seriam 1.440 chamadas por dia à mesma cota.
 */
const USAGE_RETRY_MS = 15 * 60_000;
/** Depois disso sem conseguir ler, o número guardado deixa de ser publicado. */
const STALE_USAGE_MAX_AGE_MS = 6 * 60 * 60_000;
const USAGE_TIMEOUT_MS = 8_000;
/** Quantos dias fechados entram no ritmo usado para projetar o mês. */
const PROJECTION_DAYS = 7;
const DAY_MS = 24 * 60 * 60_000;

export const CONTENTFUL_USAGE_APIS = ["gql", "cda", "cpa", "cma"] as const;
export type ContentfulUsageApi = (typeof CONTENTFUL_USAGE_APIS)[number];

export interface ContentfulUsage {
  /** Chamadas no mês corrente (UTC) por API, até onde o Contentful já contou. */
  monthToDate: Record<ContentfulUsageApi, number>;
  /** Como o mês fecha se o ritmo dos últimos 7 dias fechados continuar. */
  projectedMonthTotal: number;
  limit: number;
}

interface PeriodicUsageResponse {
  items?: Array<{ metric: string; usagePerDay?: Record<string, number> }>;
}

let cached: { usage: ContentfulUsage; fetchedAt: number } | null = null;
let pending: Promise<ContentfulUsage | null> | null = null;
let organizationId: Promise<string> | null = null;
let lastFailed = false;
let retryAt = 0;

async function managementGet<T>(path: string): Promise<T> {
  const token = process.env.CONTENTFUL_MANAGEMENT_TOKEN?.trim();
  if (!token) throw new Error("Falta CONTENTFUL_MANAGEMENT_TOKEN");

  const response = await fetch(`https://api.contentful.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(USAGE_TIMEOUT_MS),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Contentful respondeu ${response.status} em ${path}`);
  }
  return (await response.json()) as T;
}

/** O uso é contado por organização; o espaço diz qual é a dele. */
function getOrganizationId() {
  organizationId ??= (async () => {
    const spaceId =
      process.env.CONTENTFUL_SPACE_ID ??
      process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID;
    if (!spaceId) throw new Error("Falta NEXT_PUBLIC_CONTENTFUL_SPACE_ID");
    const space = await managementGet<{
      sys: { organization: { sys: { id: string } } };
    }>(`/spaces/${spaceId}`);
    return space.sys.organization.sys.id;
  })().catch((error: unknown) => {
    organizationId = null;
    throw error;
  });
  return organizationId;
}

function isoDay(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

export function summarizeUsage(
  response: PeriodicUsageResponse,
  now: number,
): ContentfulUsage {
  const today = isoDay(now);
  const monthStart = `${today.slice(0, 7)}-01`;
  const windowStart = isoDay(now - PROJECTION_DAYS * DAY_MS);
  const monthToDate = Object.fromEntries(
    CONTENTFUL_USAGE_APIS.map((api) => [api, 0]),
  ) as Record<ContentfulUsageApi, number>;
  let windowTotal = 0;

  for (const item of response.items ?? []) {
    const api = item.metric as ContentfulUsageApi;
    for (const [day, count] of Object.entries(item.usagePerDay ?? {})) {
      if (day >= monthStart && day <= today && api in monthToDate) {
        monthToDate[api] += count;
      }
      if (day >= windowStart && day < today) windowTotal += count;
    }
  }

  const date = new Date(now);
  const daysInMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  // Hoje conta como dia que falta: o Contentful ainda não fechou o número dele.
  const daysLeft = daysInMonth - date.getUTCDate() + 1;
  const used = Object.values(monthToDate).reduce((sum, n) => sum + n, 0);

  return {
    monthToDate,
    projectedMonthTotal: Math.round(
      used + (windowTotal / PROJECTION_DAYS) * daysLeft,
    ),
    limit: CONTENTFUL_MONTHLY_API_LIMIT,
  };
}

async function fetchUsage(): Promise<ContentfulUsage> {
  const now = Date.now();
  const today = isoDay(now);
  const monthStart = `${today.slice(0, 7)}-01`;
  const windowStart = isoDay(now - PROJECTION_DAYS * DAY_MS);
  const startAt = windowStart < monthStart ? windowStart : monthStart;
  const org = await getOrganizationId();
  const query = new URLSearchParams({
    "metric[in]": CONTENTFUL_USAGE_APIS.join(","),
    "dateRange.startAt": startAt,
    "dateRange.endAt": today,
  });
  const response = await managementGet<PeriodicUsageResponse>(
    `/organizations/${org}/organization_periodic_usages?${query}`,
  );
  return summarizeUsage(response, now);
}

/**
 * O uso da cota de API do Contentful no mês, lido da Usage API no máximo uma
 * vez por hora. Se a leitura falhar, segue valendo a última por algumas horas;
 * sem nenhuma, devolve `null` e o `/api/metrics` só deixa de publicar o uso.
 */
export function getContentfulUsage(): Promise<ContentfulUsage | null> {
  if (cached && Date.now() - cached.fetchedAt < CONTENTFUL_USAGE_TTL_MS) {
    return Promise.resolve(cached.usage);
  }
  if (Date.now() < retryAt) return Promise.resolve(staleUsage());

  pending ??= fetchUsage()
    .then((usage) => {
      if (lastFailed) console.info("[contentful-usage] voltou a ler o uso");
      lastFailed = false;
      cached = { usage, fetchedAt: Date.now() };
      return usage;
    })
    .catch((error: unknown) => {
      // Uma linha por queda, como no health check.
      if (!lastFailed) {
        console.error("[contentful-usage] não consegui ler o uso:", error);
      }
      lastFailed = true;
      retryAt = Date.now() + USAGE_RETRY_MS;
      return staleUsage();
    })
    .finally(() => {
      pending = null;
    });

  return pending;
}

function staleUsage() {
  return cached && Date.now() - cached.fetchedAt < STALE_USAGE_MAX_AGE_MS
    ? cached.usage
    : null;
}

/** Existe para o teste começar cada caso sem leitura guardada. */
export function resetContentfulUsage() {
  cached = null;
  pending = null;
  organizationId = null;
  lastFailed = false;
  retryAt = 0;
}
