import { contentfulFetch, managementBaseUrl } from "./client.mjs";

const MUNICIPAL_ANALYSIS_PARTITION_FIELDS = [
  { id: "partitionKey", name: "Partition Key", type: "Symbol" },
  { id: "calendarYear", name: "Calendar Year", type: "Symbol" },
  { id: "territory", name: "Territory", type: "Symbol" },
];

export async function ensureMunicipalAnalysisPartitionFields(
  config,
  contentTypeId,
) {
  const contentTypeUrl = `${managementBaseUrl(config)}/content_types/${contentTypeId}`;
  const contentType = await contentfulFetch(
    contentTypeUrl,
    { headers: { Authorization: `Bearer ${config.managementToken}` } },
    "Busca do content type municipalAnalysis via Management API",
  );
  const existingFieldIds = new Set(
    (contentType.fields ?? []).map((field) => field.id),
  );
  const missingFields = MUNICIPAL_ANALYSIS_PARTITION_FIELDS.filter(
    (field) => !existingFieldIds.has(field.id),
  );

  if (missingFields.length === 0) {
    return {
      changed: false,
      fields: MUNICIPAL_ANALYSIS_PARTITION_FIELDS.map((field) => field.id),
    };
  }

  const updatedContentType = await contentfulFetch(
    contentTypeUrl,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
        "Content-Type": "application/vnd.contentful.management.v1+json",
        "X-Contentful-Version": String(contentType.sys.version),
      },
      body: JSON.stringify({
        ...contentType,
        fields: [
          ...(contentType.fields ?? []),
          ...missingFields.map((field) => ({
            ...field,
            localized: false,
            required: false,
            validations: [],
            disabled: false,
            omitted: false,
          })),
        ],
      }),
    },
    "Atualização do content type municipalAnalysis via Management API",
  );

  await contentfulFetch(
    `${contentTypeUrl}/published`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
        "X-Contentful-Version": String(updatedContentType.sys.version),
      },
    },
    "Publicação do content type municipalAnalysis via Management API",
  );

  return { changed: true, fields: missingFields.map((field) => field.id) };
}

export function dryRunMunicipalAnalysisPartitionFields() {
  return {
    changed: false,
    fields: MUNICIPAL_ANALYSIS_PARTITION_FIELDS.map((field) => field.id),
    dryRun: true,
  };
}
