#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { getDefaultLocale } from "./lib/contentful/client.mjs";
import { getContentfulConfig, loadDotEnv } from "./lib/contentful/env.mjs";
import { syncMunicipalReportSeries } from "./lib/contentful/municipal-report-series-sync.mjs";

export function parseArgs(argv) {
  const options = { jsonDir: "data/contentful-pipeline/json", dryRun: false, publish: false, activate: false, activateOnly: false, pruneOld: false, panelLayerId: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json-dir") options.jsonDir = argv[++index];
    else if (argument === "--panel-layer-id") options.panelLayerId = argv[++index];
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--publish") options.publish = true;
    else if (argument === "--activate") options.activate = true;
    else if (argument === "--activate-only") options.activateOnly = true;
    else if (argument === "--prune-old") options.pruneOld = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Argumento desconhecido: ${argument}`);
  }
  return options;
}

export async function runMunicipalReportSeriesCli(argv = process.argv.slice(2)) {
  await loadDotEnv();
  const options = parseArgs(argv);
  if (options.help) {
    console.log("Uso: node tools/drive-contentful-pipeline/contentful-update-municipal-report-series.mjs [--json-dir <path>] [--panel-layer-id <id>] [--dry-run] [--publish] [--activate] [--activate-only] [--prune-old]");
    return;
  }
  if (options.activateOnly && (!options.activate || !options.publish || options.dryRun)) {
    throw new Error("--activate-only exige --publish e --activate.");
  }
  const config = getContentfulConfig();
  if (!options.dryRun && !config.managementToken) throw new Error("CONTENTFUL_MANAGEMENT_TOKEN é obrigatório para publicação.");
  const { locale } = await getDefaultLocale(config, !options.dryRun);
  console.log(JSON.stringify(await syncMunicipalReportSeries(config, options, locale), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMunicipalReportSeriesCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
