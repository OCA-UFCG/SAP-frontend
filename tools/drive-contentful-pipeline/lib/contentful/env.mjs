import { readFile } from "node:fs/promises";

const DEFAULT_LOCALE = "en-US";

export async function loadDotEnv(filePath = ".env") {
  let text = "";

  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }

  for (const line of text.split(/\n/u)) {
    const match = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u,
    );
    if (!match || process.env[match[1]]) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[match[1]] = value;
  }
}

export function getEnv(primaryKey, fallbackKey) {
  return (
    process.env[primaryKey] ?? (fallbackKey ? process.env[fallbackKey] : "")
  );
}

export function getRequiredEnv(primaryKey, fallbackKey) {
  const value = getEnv(primaryKey, fallbackKey);

  if (!value) {
    throw new Error(
      `Variável obrigatória ausente: ${primaryKey}${fallbackKey ? ` ou ${fallbackKey}` : ""}`,
    );
  }

  return value;
}

export function getContentfulConfig({ needsDeliveryToken = false } = {}) {
  const usePreview =
    getEnv("CONTENTFUL_PREVIEW", "NEXT_PUBLIC_CONTENTFUL_PREVIEW") === "true";
  const config = {
    spaceId: getRequiredEnv(
      "CONTENTFUL_SPACE_ID",
      "NEXT_PUBLIC_CONTENTFUL_SPACE_ID",
    ),
    environment:
      getEnv("CONTENTFUL_ENVIRONMENT", "NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT") ||
      "master",
    managementToken: getEnv("CONTENTFUL_MANAGEMENT_TOKEN"),
    usePreview,
  };

  if (!needsDeliveryToken) return config;

  return {
    ...config,
    deliveryToken: usePreview
      ? getRequiredEnv(
          "CONTENTFUL_PREVIEW_TOKEN",
          "NEXT_PUBLIC_CONTENTFUL_PREVIEW_TOKEN",
        )
      : getRequiredEnv(
          "CONTENTFUL_ACCESS_TOKEN",
          "NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN",
        ),
  };
}

export { DEFAULT_LOCALE };
