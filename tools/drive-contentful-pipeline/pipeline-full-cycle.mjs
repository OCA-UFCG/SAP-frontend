import {
  runIfMain,
  runPipelineFullCycleCli,
} from "./lib/cli/pipeline-full-cycle-cli.mjs";

export { runPipelineFullCycleCli };

runIfMain(import.meta.url);
