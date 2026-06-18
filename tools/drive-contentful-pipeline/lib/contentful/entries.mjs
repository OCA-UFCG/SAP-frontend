import { contentfulFetch, managementBaseUrl } from "./client.mjs";

function localizedFields(fields, locale) {
  return Object.fromEntries(
    Object.entries(fields).map(([fieldId, value]) => [
      fieldId,
      { [locale]: value },
    ]),
  );
}

function patchOperations(currentEntry, fields, locale) {
  return Object.entries(fields).map(([fieldId, value]) => {
    if (currentEntry.fields?.[fieldId] === undefined) {
      return {
        op: "add",
        path: `/fields/${fieldId}`,
        value: { [locale]: value },
      };
    }

    return {
      op:
        currentEntry.fields[fieldId]?.[locale] === undefined
          ? "add"
          : "replace",
      path: `/fields/${fieldId}/${locale}`,
      value,
    };
  });
}

export async function patchEntryFields(
  config,
  entry,
  fields,
  locale,
  publish,
  context = entry.sys.id,
) {
  const entryUrl = `${managementBaseUrl(config)}/entries/${entry.sys.id}`;
  const currentEntry = await contentfulFetch(
    entryUrl,
    { headers: { Authorization: `Bearer ${config.managementToken}` } },
    `Busca da entry ${entry.sys.id} (${context}) via Management API`,
  );
  const updatedEntry = await contentfulFetch(
    entryUrl,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
        "Content-Type": "application/json-patch+json",
        "X-Contentful-Version": String(currentEntry.sys.version),
      },
      body: JSON.stringify(patchOperations(currentEntry, fields, locale)),
    },
    `Atualização da entry ${entry.sys.id} (${context}) via Management API JSON Patch`,
  );

  return publishEntry(config, updatedEntry, publish, context);
}

export async function createEntry(
  config,
  contentTypeId,
  fields,
  locale,
  publish,
  context = "",
) {
  const url = `${managementBaseUrl(config)}/entries`;
  const createdEntry = await contentfulFetch(
    url,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
        "Content-Type": "application/vnd.contentful.management.v1+json",
        "X-Contentful-Content-Type": contentTypeId,
      },
      body: JSON.stringify({ fields: localizedFields(fields, locale) }),
    },
    `Criação de entry (${context}) via Management API`,
  );

  return publishEntry(config, createdEntry, publish, context);
}

export async function publishEntry(config, entry, publish, context) {
  if (!publish) return entry;

  return contentfulFetch(
    `${managementBaseUrl(config)}/entries/${entry.sys.id}/published`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${config.managementToken}`,
        "X-Contentful-Version": String(entry.sys.version),
      },
    },
    `Publicação da entry ${entry.sys.id} (${context}) via Management API`,
  );
}

export async function listManagementEntries(
  config,
  contentTypeId,
  locale,
  fieldFilters = {},
  select = "sys",
) {
  const entries = [];
  const limit = 100;

  for (let skip = 0; ; skip += limit) {
    const url = new URL(`${managementBaseUrl(config)}/entries`);
    url.searchParams.set("content_type", contentTypeId);
    url.searchParams.set("select", select);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("skip", String(skip));

    for (const [fieldId, value] of Object.entries(fieldFilters)) {
      url.searchParams.set(`fields.${fieldId}.${locale}`, value);
    }

    const data = await contentfulFetch(
      url,
      { headers: { Authorization: `Bearer ${config.managementToken}` } },
      "Listagem de entries via Management API",
    );

    entries.push(...(data.items ?? []));

    if (
      entries.length >= (data.total ?? entries.length) ||
      (data.items ?? []).length === 0
    ) {
      return entries;
    }
  }
}
