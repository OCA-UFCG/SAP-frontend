#!/usr/bin/env node

import {
  runContentfulMunicipalAnalysisCli,
  runIfMain,
} from "./lib/cli/contentful-municipal-analysis-cli.mjs";
import {
  validateMunicipalAnalysisImageData,
  validateMunicipalAnalysisManifest,
} from "./lib/validation/municipal-analysis.mjs";

export {
  runContentfulMunicipalAnalysisCli,
  validateMunicipalAnalysisImageData,
  validateMunicipalAnalysisManifest,
};

runIfMain(import.meta.url);
