import { contentfulFetch, managementBaseUrl } from "./client.mjs";

const MUNICIPAL_ANALYSIS_PARTITION_FIELDS = [
  { id: "partitionKey", name: "Partition Key", type: "Symbol" },
  { id: "calendarYear", name: "Calendar Year", type: "Symbol" },
  { id: "territory", name: "Territory", type: "Symbol" },
];

const MUNICIPAL_REPORT_SERIES_FIELDS = [
  { id: "title", name: "Title", type: "Symbol", required: true },
  { id: "panelLayerId", name: "Panel Layer ID", type: "Symbol", required: true },
  { id: "shardKey", name: "Shard Key", type: "Symbol", required: true },
  { id: "datasetVersion", name: "Dataset Version", type: "Symbol", required: true },
  { id: "imageData", name: "Image Data", type: "Object", required: true },
];

function normalizeField(field) {
  return {
    ...field,
    localized: false,
    required: Boolean(field.required),
    validations: [],
    disabled: false,
    omitted: false,
  };
}

async function publishContentType(config, contentTypeId, version, context) {
  return contentfulFetch(
    `${managementBaseUrl(config)}/content_types/${contentTypeId}/published`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
        "X-Contentful-Version": String(version),
      },
    },
    context,
  );
}

async function getContentTypeOrNull(config, contentTypeId) {
  try {
    return await contentfulFetch(
      `${managementBaseUrl(config)}/content_types/${contentTypeId}`,
      { headers: { Authorization: `Bearer ${config.managementToken}` } },
      `Busca do content type ${contentTypeId}`,
    );
  } catch (error) {
    if (String(error).includes("status 404")) return null;
    throw error;
  }
}

export async function ensureMunicipalReportSeriesContentModel(config) {
  const contentTypeId = "municipalReportSeries";
  const contentTypeUrl = `${managementBaseUrl(config)}/content_types/${contentTypeId}`;
  let contentType = await getContentTypeOrNull(config, contentTypeId);
  let changed = false;

  if (!contentType) {
    contentType = await contentfulFetch(
      contentTypeUrl,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${config.managementToken}`,
          "Content-Type": "application/vnd.contentful.management.v1+json",
        },
        body: JSON.stringify({
          name: "Municipal Report Series",
          displayField: "title",
          fields: MUNICIPAL_REPORT_SERIES_FIELDS.map(normalizeField),
        }),
      },
      "Criação do content type municipalReportSeries",
    );
    changed = true;
  } else {
    const existing = new Set((contentType.fields ?? []).map((field) => field.id));
    const missing = MUNICIPAL_REPORT_SERIES_FIELDS.filter((field) => !existing.has(field.id));
    if (missing.length) {
      contentType = await contentfulFetch(
        contentTypeUrl,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${config.managementToken}`,
            "Content-Type": "application/vnd.contentful.management.v1+json",
            "X-Contentful-Version": String(contentType.sys.version),
          },
          body: JSON.stringify({
            name: contentType.name,
            displayField: contentType.displayField ?? "title",
            description: contentType.description,
            fields: [...(contentType.fields ?? []), ...missing.map(normalizeField)],
          }),
        },
        "Atualização do content type municipalReportSeries",
      );
      changed = true;
    }
  }

  if (changed) {
    await publishContentType(
      config,
      contentTypeId,
      contentType.sys.version,
      "Publicação do content type municipalReportSeries",
    );
  }

  const panelLayer = await getContentTypeOrNull(config, "panelLayer");
  if (!panelLayer) throw new Error("Content type panelLayer não encontrado.");
  const hasConfig = (panelLayer.fields ?? []).some((field) => field.id === "reportSeriesConfig");
  if (!hasConfig) {
    const updated = await contentfulFetch(
      `${managementBaseUrl(config)}/content_types/panelLayer`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${config.managementToken}`,
          "Content-Type": "application/vnd.contentful.management.v1+json",
          "X-Contentful-Version": String(panelLayer.sys.version),
        },
        body: JSON.stringify({
          name: panelLayer.name,
          displayField: panelLayer.displayField,
          description: panelLayer.description,
          fields: [
            ...(panelLayer.fields ?? []),
            normalizeField({ id: "reportSeriesConfig", name: "Report Series Config", type: "Object", required: false }),
          ],
        }),
      },
      "Adição de reportSeriesConfig ao panelLayer",
    );
    await publishContentType(config, "panelLayer", updated.sys.version, "Publicação do content type panelLayer");
    changed = true;
  }

  return { changed };
}

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
