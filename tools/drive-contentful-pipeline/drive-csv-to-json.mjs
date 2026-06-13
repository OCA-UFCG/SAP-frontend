#!/usr/bin/env node

import {
  runDriveCsvJsonCli,
  runIfMain,
} from "./lib/cli/drive-csv-json-cli.mjs";

export { runDriveCsvJsonCli };

runIfMain(import.meta.url);
