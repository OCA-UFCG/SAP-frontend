/**
 * Publica em lote os índices legados já adotados no escopo de apresentação.
 *
 * É o mesmo efeito de abrir cada legado em "Abrir e editar" e clicar
 * "Republicar", e grava o mesmo rastro, porque os dois montam o `catalogConfig`
 * com `buildPublishedPresentationConfig`.
 *
 * A adoção em lote grava só na versão de rascunho da entry, de propósito, para
 * não mexer no que está no ar. O efeito colateral é que os catorze legados
 * ficam marcados como "alterações não publicadas" no catálogo, e esse aviso
 * passa a esconder uma pendência de verdade quando ela aparecer. Esta
 * ferramenta fecha essa pendência.
 *
 * A guarda que importa: antes de publicar, cada entry é comparada campo a campo
 * contra a própria versão publicada, ignorando a ordem das chaves do JSON (o
 * Contentful reordena `reportSeriesConfig` sozinho e isso não é alteração).
 * Uma entry cujo rascunho difere em qualquer campo além de `catalogConfig` é
 * recusada, porque publicar levaria ao ar uma alteração de conteúdo que
 * ninguém revisou. Para aceitar uma dessas diferenças conscientemente, nomeie o
 * campo em `--allow-field=`.
 *
 * Uso:
 *   node tools/drive-contentful-pipeline/contentful-publish-adopted-legacy.mjs \
 *     --actor-email=pessoa@exemplo.org              # dry-run, não grava nada
 *   ... --actor-email=pessoa@exemplo.org --apply    # publica
 *   ... --only=deg,ods                              # restringe a alguns índices
 *   ... --allow-field=previewMap                    # aceita também esse campo
 */

import { buildPublishedPresentationConfig } from "../../src/contracts/indexCatalogAdoption.mjs";
import {
  CONTENTFUL_WRITE_DELAY_MS,
  getDefaultLocale,
  getLocalizedField,
  sleep,
} from "./lib/contentful/client.mjs";
import {
  listManagementEntries,
  patchEntryFields,
} from "./lib/contentful/entries.mjs";
import {
  getContentfulConfig,
  getEnv,
  loadDotEnv,
} from "./lib/contentful/env.mjs";

const PANEL_LAYER_CONTENT_TYPE = "panelLayer";

function parseArgs(argv) {
  const args = { apply: false, actorEmail: "", only: null, allowed: new Set() };

  for (const arg of argv) {
    if (arg === "--apply") args.apply = true;
    else if (arg === "--dry-run") args.apply = false;
    else if (arg.startsWith("--actor-email="))
      args.actorEmail = arg.slice(14).trim();
    else if (arg.startsWith("--allow-field=")) {
      for (const field of arg.slice(14).split(",")) {
        if (field.trim()) args.allowed.add(field.trim());
      }
    } else if (arg.startsWith("--only=")) {
      args.only = new Set(
        arg
          .slice(7)
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      );
    } else throw new Error(`Argumento desconhecido: ${arg}`);
  }

  return args;
}

/**
 * O e-mail vai para o `auditLog` da entry, então precisa ser de alguém que
 * poderia ter clicado o botão: a mesma allowlist que a rota do catálogo exige.
 */
function resolveActor(actorEmail) {
  const allowed = new Set(
    getEnv("LOGS_ALLOWED_EMAILS")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  const email = actorEmail.toLowerCase();

  if (!email) {
    throw new Error(
      "Informe --actor-email=<e-mail>: ele identifica quem publicou no auditLog da entry.",
    );
  }
  if (!allowed.has(email)) {
    throw new Error(
      `O e-mail ${email} não está em LOGS_ALLOWED_EMAILS, e só quem tem acesso ao catálogo pode publicar um índice.`,
    );
  }

  return { uid: "tool:publish-adopted-legacy", email };
}

/**
 * Compara conteúdo, não serialização. O Contentful devolve as chaves de um
 * campo Object em ordens diferentes no rascunho e na versão publicada, e uma
 * comparação ingênua acusaria `reportSeriesConfig` como alterado em onze dos
 * catorze legados quando os dois lados são idênticos.
 */
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalize(value[key])]),
    );
  }
  return value;
}

function fieldsThatDiffer(draftFields, publishedFields) {
  const names = new Set([
    ...Object.keys(draftFields ?? {}),
    ...Object.keys(publishedFields ?? {}),
  ]);

  return [...names].filter(
    (name) =>
      JSON.stringify(normalize(draftFields?.[name] ?? null)) !==
      JSON.stringify(normalize(publishedFields?.[name] ?? null)),
  );
}

async function fetchPublishedFields(config, entryId) {
  const response = await fetch(
    `https://api.contentful.com/spaces/${config.spaceId}/environments/${config.environment}/entries/${entryId}/published`,
    { headers: { Authorization: `Bearer ${config.managementToken}` } },
  );

  if (!response.ok) {
    throw new Error(
      `Leitura da versão publicada da entry ${entryId} falhou: HTTP ${response.status}. Esperado 200 com o corpo da entry publicada.`,
    );
  }

  return (await response.json()).fields ?? {};
}

/**
 * Repete as recusas do botão do editor e acrescenta a comparação com a versão
 * publicada, que a tela não precisa fazer porque quem clica acabou de editar.
 */
async function describePublication(config, entry, locale, allowed) {
  const catalogConfig = getLocalizedField(entry, "catalogConfig", locale);

  if (catalogConfig?.managedScope !== "presentation") {
    return { skip: "não é um legado adotado no escopo de apresentação" };
  }
  if (!entry.sys.publishedAt) {
    return {
      skip: "nunca foi publicado; publicá-lo o colocaria no Monitoramento, e isso é decisão de quem opera",
    };
  }

  const changed = fieldsThatDiffer(
    entry.fields,
    await fetchPublishedFields(config, entry.sys.id),
  );
  const unexpected = changed.filter(
    (name) => name !== "catalogConfig" && !allowed.has(name),
  );

  if (unexpected.length) {
    return {
      skip: `o rascunho também altera ${unexpected.join(", ")}; revise e use --allow-field= para aceitar`,
    };
  }

  return { catalogConfig, changed };
}

async function publishEntryWithAudit(config, entry, catalogConfig, locale) {
  const published = await patchEntryFields(
    config,
    entry,
    { catalogConfig },
    locale,
    true,
    `publicação de ${catalogConfig.panelLayerId}`,
  );

  if (!published.sys.publishedAt) {
    throw new Error(
      `O Contentful não confirmou a publicação da entry ${entry.sys.id} (${catalogConfig.panelLayerId}): sys.publishedAt ausente. O índice continuaria com a versão anterior no Monitoramento.`,
    );
  }

  await sleep(CONTENTFUL_WRITE_DELAY_MS);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await loadDotEnv();

  const config = getContentfulConfig();
  if (!config.managementToken) {
    throw new Error(
      "CONTENTFUL_MANAGEMENT_TOKEN é obrigatório para publicar índices.",
    );
  }

  const actor = resolveActor(args.actorEmail);
  const { locale } = await getDefaultLocale(config);
  const entries = await listManagementEntries(
    config,
    PANEL_LAYER_CONTENT_TYPE,
    locale,
    {},
    "sys,fields",
  );

  const planned = [];
  const skipped = [];

  for (const entry of entries) {
    const panelLayerId = getLocalizedField(entry, "id", locale) ?? entry.sys.id;
    if (args.only && !args.only.has(panelLayerId)) continue;

    const decision = await describePublication(
      config,
      entry,
      locale,
      args.allowed,
    );
    if (decision.skip) {
      skipped.push({ panelLayerId, reason: decision.skip });
      continue;
    }

    planned.push({
      entry,
      panelLayerId,
      changed: decision.changed,
      catalogConfig: buildPublishedPresentationConfig({
        config: decision.catalogConfig,
        actor,
        at: new Date().toISOString(),
      }),
    });
  }

  console.log(
    `Espaço ${config.spaceId}, ambiente ${config.environment}, locale ${locale}.`,
  );
  console.log(`Publicador: ${actor.email}`);
  if (args.allowed.size) {
    console.log(
      `Campos aceitos além de catalogConfig: ${[...args.allowed].join(", ")}`,
    );
  }

  console.log(`\n${planned.length} índice(s) a publicar:`);
  for (const { panelLayerId, changed } of planned) {
    const diff = changed.length ? changed.join(", ") : "nenhuma diferença";
    console.log(`  ${panelLayerId.padEnd(28)} rascunho difere em: ${diff}`);
  }

  console.log(`\n${skipped.length} entry(s) fora do lote:`);
  for (const { panelLayerId, reason } of skipped) {
    console.log(`  ${panelLayerId.padEnd(28)} ${reason}`);
  }

  if (!args.apply) {
    console.log(
      "\nDry-run: nada foi publicado. Repita com --apply para publicar.",
    );
    return;
  }
  if (!planned.length) {
    console.log("\nNada a fazer.");
    return;
  }

  for (const { entry, panelLayerId, catalogConfig } of planned) {
    await publishEntryWithAudit(config, entry, catalogConfig, locale);
    console.log(`  publicado: ${panelLayerId}`);
  }
  console.log(`\n${planned.length} índice(s) publicado(s).`);
}

await main();
