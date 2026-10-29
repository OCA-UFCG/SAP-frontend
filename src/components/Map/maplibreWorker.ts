import { setWorkerUrl } from "maplibre-gl";

// A partir da versão 6 o MapLibre carrega o worker (que processa os tiles) de
// um arquivo separado, achado ao lado do próprio módulo. Depois que o webpack
// empacota a biblioteca esse "ao lado" deixa de existir, e sem o worker nenhum
// tile é desenhado. Este `new URL(...)` faz o bundler copiar o arquivo do
// worker para os estáticos do Next e nos dá o endereço final dele.
//
// Importe este módulo em todo arquivo que cria um `maplibregl.Map`.
setWorkerUrl(
  new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
);
