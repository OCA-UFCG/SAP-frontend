#!/usr/bin/env node

import {
  runContentfulPanelLayerCli,
  runIfMain,
} from "./lib/cli/contentful-panel-layer-cli.mjs";
import { validatePanelLayerImageData } from "./lib/validation/panel-layer.mjs";

export { runContentfulPanelLayerCli, validatePanelLayerImageData };

runIfMain(import.meta.url);
