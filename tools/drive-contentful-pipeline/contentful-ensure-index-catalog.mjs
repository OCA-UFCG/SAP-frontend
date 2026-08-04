import { getContentfulConfig, loadDotEnv } from "./lib/contentful/env.mjs";
import { ensureIndexCatalogContentModel } from "./lib/contentful/content-types.mjs";

await loadDotEnv();
const config = getContentfulConfig();

if (!config.managementToken) {
  throw new Error("CONTENTFUL_MANAGEMENT_TOKEN é obrigatório.");
}

const result = await ensureIndexCatalogContentModel(config);
console.log(
  result.changed
    ? "Content model do catálogo atualizado e publicado."
    : "Content model do catálogo já estava atualizado.",
);
