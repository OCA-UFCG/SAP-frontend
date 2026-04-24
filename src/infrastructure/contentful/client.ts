import "server-only";

interface ContentfulGraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

function getEnvValue(
  primaryKey: string,
  fallbackKey?: string,
): string | undefined {
  return (
    process.env[primaryKey] ??
    (fallbackKey ? process.env[fallbackKey] : undefined)
  );
}

function getRequiredEnvValue(primaryKey: string, fallbackKey?: string): string {
  const value = getEnvValue(primaryKey, fallbackKey);

  if (!value) {
    throw new Error(
      `Missing required Contentful environment variable: ${primaryKey}${fallbackKey ? ` (fallback: ${fallbackKey})` : ""}`,
    );
  }

  return value;
}

function getContentfulConfig() {
  const usePreview =
    getEnvValue("CONTENTFUL_PREVIEW", "NEXT_PUBLIC_CONTENTFUL_PREVIEW") ===
    "true";
  const spaceId = getRequiredEnvValue(
    "CONTENTFUL_SPACE_ID",
    "NEXT_PUBLIC_CONTENTFUL_SPACE_ID",
  );
  const environment =
    getEnvValue(
      "CONTENTFUL_ENVIRONMENT",
      "NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT",
    ) ?? "master";
  const accessToken = usePreview
    ? getRequiredEnvValue(
        "CONTENTFUL_PREVIEW_TOKEN",
        "NEXT_PUBLIC_CONTENTFUL_PREVIEW_TOKEN",
      )
    : getRequiredEnvValue(
        "CONTENTFUL_ACCESS_TOKEN",
        "NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN",
      );

  return {
    accessToken,
    endpoint: `https://graphql.contentful.com/content/v1/spaces/${spaceId}/environments/${environment}`,
  };
}

export async function getContent<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const { endpoint, accessToken } = getContentfulConfig();

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Contentful request failed with status ${response.status}`);
  }

  const json = (await response.json()) as ContentfulGraphQLResponse<T>;

  if (json.errors?.length) {
    throw new Error(JSON.stringify(json.errors, null, 2));
  }

  if (!json.data) {
    throw new Error("Contentful response missing data.");
  }

  return json.data;
}
