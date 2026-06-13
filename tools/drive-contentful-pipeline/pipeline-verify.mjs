#!/usr/bin/env node

import {
  runIfMain,
  runPipelineVerifyCli,
} from "./lib/cli/pipeline-verify-cli.mjs";

export { runPipelineVerifyCli };

runIfMain(import.meta.url);
