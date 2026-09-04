/**
 * Adota em lote os índices legados no escopo de apresentação do catálogo.
 *
 * É o mesmo efeito de clicar "Adotar no catálogo" no cartão de cada índice, e
 * grava exatamente o mesmo `catalogConfig`, porque as duas coisas montam a
 * configuração com `buildAdoptedPresentationConfig`. A escrita é inerte: só o
 * campo `catalogConfig` muda, a versão publicada da entry continua a mesma e
 * nada muda no Monitoramento até alguém publicar.
 *
 * Uso:
 *   node tools/drive-contentful-pipeline/contentful-adopt-legacy-indices.mjs \
 *     --actor-email=pessoa@exemplo.org            # dry-run, não escreve nada
 *   ... --actor-email=pessoa@exemplo.org --apply  # grava no Contentful
 *   ... --only=deg,ods                            # restringe a alguns índices
 */

import { isCompactTerritorialImageData } from "../../src/contracts/imageDataContract.mjs";
import { buildAdoptedPresentationConfig } from "../../src/contracts/indexCatalogAdoption.mjs";
import {
  CONTENTFUL_WRITE_DELAY_MS,
  getDefaultLocale,
  getLocalizedField,
  sleep,
} from "./lib/contentful/client.mjs";
import { ensureIndexCatalogContentModel } from "./lib/contentful/content-types.mjs";
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
  const args = { apply: false, actorEmail: "", only: null };

  for (const arg of argv) {
    if (arg === "--apply") args.apply = true;
    else if (arg === "--dry-run") args.apply = false;
    else if (arg.startsWith("--actor-email="))
      args.actorEmail = arg.slice(14).trim();
    else if (arg.startsWith("--only=")) {
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
      "Informe --actor-email=<e-mail>: ele identifica quem executou a adoção no auditLog da entry.",
    );
  }
  if (!allowed.has(email)) {
    throw new Error(
      `O e-mail ${email} não está em LOGS_ALLOWED_EMAILS, e só quem tem acesso ao catálogo pode adotar um índice.`,
    );
  }

  return { uid: "tool:adopt-legacy-indices", email };
}

/**
 * Repete as recusas da rota de adoção, para o lote nunca gravar o que a tela
 * não gravaria. O `reportConfig` fica de fora porque validá-lo exige o parser
 * do contrato do relatório, que é TypeScript: uma entry com texto de relatório
 * é adotada pelo botão, que sabe herdá-lo.
 */
function describeAdoption(entry, locale) {
  const field = (fieldId) => getLocalizedField(entry, fieldId, locale);
  const catalogConfig = field("catalogConfig");
  const imageData = field("imageData");
  const panelLayerId = field("id");

  if (catalogConfig?.schemaVersion === 2)
    return { skip: "já é gerenciado pelo catálogo" };
  if (!panelLayerId?.trim())
    return { skip: "a entry não tem o campo id preenchido" };
  if (!imageData) return { skip: "a entry não tem imageData" };
  if (!isCompactTerritorialImageData(imageData)) {
    return {
      skip: "o imageData ainda está no formato pré-compacto (imageParams por ano)",
    };
  }
  if (field("reportConfig")) {
    return {
      skip: "tem texto de relatório na entry; adote pelo botão do catálogo, que o herda",
    };
  }

  return {
    item: {
      panelLayerId,
      name: field("name") ?? "Índice sem nome",
      description: field("description") ?? "",
      category: field("category"),
      measurementUnit: field("measurementUnit"),
      panelPosition: field("panelPosition"),
      published: Boolean(entry.sys.publishedAt),
      catalogConfig,
    },
  };
}

function describePlanned(item, config) {
  return [
    `  ${item.panelLayerId.padEnd(28)}`,
    `${config.status.padEnd(10)}`,
    `${config.category.padEnd(24)}`,
    `unidade=${JSON.stringify(config.measurementUnit).padEnd(12)}`,
    `posição=${config.panelPosition ?? "—"}`,
  ].join(" ");
}

async function adoptEntry(config, entry, catalogConfig, locale) {
  await patchEntryFields(
    config,
    entry,
    { catalogConfig },
    locale,
    false,
    `adoção de ${catalogConfig.panelLayerId}`,
  );
  await sleep(CONTENTFUL_WRITE_DELAY_MS);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await loadDotEnv();

  const config = getContentfulConfig();
  if (!config.managementToken) {
    throw new Error(
      "CONTENTFUL_MANAGEMENT_TOKEN é obrigatório para adotar índices.",
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

    const decision = describeAdoption(entry, locale);
    if (decision.skip) {
      skipped.push({ panelLayerId, reason: decision.skip });
      continue;
    }

    planned.push({
      entry,
      item: decision.item,
      catalogConfig: buildAdoptedPresentationConfig({
        item: decision.item,
        actor,
        at: new Date().toISOString(),
      }),
    });
  }

  console.log(
    `Espaço ${config.spaceId}, ambiente ${config.environment}, locale ${locale}.`,
  );
  console.log(`Adotante: ${actor.email}`);
  console.log(`\n${planned.length} índice(s) a adotar:`);
  for (const { item, catalogConfig } of planned) {
    console.log(describePlanned(item, catalogConfig));
  }

  console.log(`\n${skipped.length} entry(s) fora do lote:`);
  for (const { panelLayerId, reason } of skipped) {
    console.log(`  ${panelLayerId.padEnd(28)} ${reason}`);
  }

  if (!args.apply) {
    console.log("\nDry-run: nada foi gravado. Repita com --apply para adotar.");
    return;
  }
  if (!planned.length) {
    console.log("\nNada a fazer.");
    return;
  }

  await ensureIndexCatalogContentModel(config);
  for (const { entry, item, catalogConfig } of planned) {
    await adoptEntry(config, entry, catalogConfig, locale);
    console.log(`  adotado: ${item.panelLayerId}`);
  }
  console.log(
    `\n${planned.length} índice(s) adotado(s) no escopo de apresentação.`,
  );
}

await main();
