const USE_PREVIEW = process.env.NEXT_PUBLIC_CONTENTFUL_PREVIEW === 'true';
const CONTENTFUL_SPACE_ID = process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID;
const CONTENTFUL_ENVIRONMENT = process.env.NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT || 'master';

const CONTENTFUL_ENDPOINT = `https://graphql.contentful.com/content/v1/spaces/${CONTENTFUL_SPACE_ID}/environments/${CONTENTFUL_ENVIRONMENT}`;

export async function getContent<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const accessToken = USE_PREVIEW
    ? process.env.NEXT_PUBLIC_CONTENTFUL_PREVIEW_TOKEN
    : process.env.NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN;

  const response = await fetch(CONTENTFUL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
    next: { revalidate: 3600 }, // cache por 1 hora (opcional)
  });

  const json = await response.json();
  
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors, null, 2));
  }
  
  return json.data;
}