import maplibregl from "maplibre-gl";
import {
  fillTileTemplate,
  loadReferenceTile,
  peekReferenceTile,
  tileIntersectsBounds,
  type LngLatBounds,
  type TileCoordinate,
} from "./referenceTileStore";

/**
 * A máscara do destaque de território: escura onde não há território do grupo
 * e transparente onde há.
 *
 * Ela não vem do servidor. O navegador já baixou o interior do grupo (opaco
 * dentro do território, transparente fora) e só inverte a transparência de
 * cada pixel — nenhum pedido novo ao Earth Engine. Fora do retângulo do Brasil
 * não há território nenhum, e o tile escuro sai direto, sem baixar nada: é isso
 * que faz o oceano e os países vizinhos escurecerem sem um corte reto na borda.
 *
 * O MapLibre pede os tiles da máscara por um protocolo próprio
 * (`sap-highlight-mask://`), e recebe a imagem já desenhada (`ImageBitmap`):
 * gerar um PNG por tile levava segundos no total.
 */
export const HIGHLIGHT_MASK_PROTOCOL = "sap-highlight-mask";

const TILE_SIZE = 256;

// Quanto a máscara espera o interior do tile antes de devolver o tile escuro.
// O interior que o MapLibre já desenhou sai do cache do navegador em poucos
// milissegundos; o que ainda está vindo do Earth Engine leva segundos, e aí o
// tile escuro entra na hora e o território acende quando o interior chega.
const FILL_WAIT_MS = 80;

// O tile escuro "provisório" vence em 1 s: se o aviso de que o interior chegou
// se perder (tile fora da tela naquele momento), o MapLibre pede de novo
// sozinho, e o tile guardado fora da tela é descartado em vez de voltar escuro.
const PROVISIONAL_CACHE_CONTROL = "max-age=1";
// O definitivo precisa de uma validade também: sem ela o MapLibre reaproveitaria
// a validade vencida do provisório e pediria o tile de novo sem parar.
const SETTLED_CACHE_CONTROL = "max-age=86400";

/**
 * Inverte a cobertura do interior: o pixel fica preto, e tão opaco quanto o
 * interior era transparente. A borda suavizada do território vira uma borda
 * suavizada da máscara.
 *
 * invertCoverageToMask(imageData.data);
 */
export function invertCoverageToMask(pixels: Uint8ClampedArray) {
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    pixels[i] = 0;
    pixels[i + 1] = 0;
    pixels[i + 2] = 0;
    pixels[i + 3] = 255 - alpha;
  }
  return pixels;
}

export interface HighlightMaskTileRequest {
  targetId: string;
  generation: number;
  tile: TileCoordinate;
}

export function buildHighlightMaskTiles(targetId: string, generation: number) {
  return `${HIGHLIGHT_MASK_PROTOCOL}://${targetId}/${generation}/{z}/{x}/{y}`;
}

export function parseHighlightMaskUrl(
  url: string,
): HighlightMaskTileRequest | null {
  const match = new RegExp(
    `^${HIGHLIGHT_MASK_PROTOCOL}://([^/]+)/(\\d+)/(\\d+)/(\\d+)/(\\d+)$`,
  ).exec(url);
  if (!match) return null;

  const [, targetId, generation, z, x, y] = match;
  return {
    targetId,
    generation: Number(generation),
    tile: { z: Number(z), x: Number(x), y: Number(y) },
  };
}

interface MaskTarget {
  generation: number;
  fillTemplate: string | undefined;
  limit: LngLatBounds;
  onTileReady: (tile: TileCoordinate) => void;
}

const targets = new Map<string, MaskTarget>();
const targetIdsByMap = new WeakMap<maplibregl.Map, string>();
let nextTargetId = 1;
let protocolRegistered = false;

type Canvas = OffscreenCanvas | HTMLCanvasElement;

function createCanvas(): Canvas {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(TILE_SIZE, TILE_SIZE);
  }
  const canvas = document.createElement("canvas");
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  return canvas;
}

function getContext(canvas: Canvas) {
  return canvas.getContext("2d", { willReadFrequently: true }) as
    OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
}

function toImageBitmap(canvas: Canvas): Promise<ImageBitmap> {
  return "transferToImageBitmap" in canvas
    ? Promise.resolve(canvas.transferToImageBitmap())
    : createImageBitmap(canvas);
}

// O mesmo tile escuro serve para todos: o MapLibre só copia a imagem para a
// placa de vídeo e não a descarta.
let darkTile: Promise<ImageBitmap> | null = null;

function getDarkTile() {
  if (!darkTile) {
    const canvas = createCanvas();
    const context = getContext(canvas);
    context.fillStyle = "#000000";
    context.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    darkTile = toImageBitmap(canvas);
  }
  return darkTile;
}

async function maskFromFill(fill: Blob): Promise<ImageBitmap> {
  const fillImage = await createImageBitmap(fill);
  const canvas = createCanvas();
  const context = getContext(canvas);
  context.drawImage(fillImage, 0, 0, TILE_SIZE, TILE_SIZE);
  fillImage.close();

  const pixels = context.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
  invertCoverageToMask(pixels.data);
  context.putImageData(pixels, 0, 0);
  return toImageBitmap(canvas);
}

const settled = async (data: Promise<ImageBitmap>) => ({
  data: await data,
  cacheControl: SETTLED_CACHE_CONTROL,
});

const wait = (ms: number) =>
  new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));

async function loadMaskTile(params: maplibregl.RequestParameters) {
  const request = parseHighlightMaskUrl(params.url);
  const target = request && targets.get(request.targetId);

  // Pedido de uma geração que já foi trocada (outro grupo, outro endereço): a
  // fonte já está pedindo os tiles novos, este vai ser descartado.
  if (!request || !target || request.generation !== target.generation) {
    return settled(getDarkTile());
  }
  if (!tileIntersectsBounds(request.tile, target.limit)) {
    return settled(getDarkTile());
  }
  // O endereço do interior ainda não chegou do servidor: escuro por enquanto. A
  // geração muda quando ele chegar, e todos os tiles são pedidos de novo.
  if (!target.fillTemplate) return settled(getDarkTile());

  const fillUrl = fillTileTemplate(target.fillTemplate, request.tile);
  const stored = peekReferenceTile(fillUrl);
  if (stored) return settled(maskFromFill(stored));

  const fill = loadReferenceTile(fillUrl);
  const arrived = await Promise.race([fill, wait(FILL_WAIT_MS)]).catch(
    () => undefined,
  );
  // O interior falhou: o tile fica escuro, como o resto de fora do território.
  if (arrived === undefined) return settled(getDarkTile());
  if (arrived) return settled(maskFromFill(arrived));

  fill.then(
    () => {
      if (target.generation === request.generation) {
        target.onTileReady(request.tile);
      }
    },
    () => {},
  );
  return { data: await getDarkTile(), cacheControl: PROVISIONAL_CACHE_CONTROL };
}

function ensureProtocol() {
  if (protocolRegistered) return;
  maplibregl.addProtocol(HIGHLIGHT_MASK_PROTOCOL, loadMaskTile);
  protocolRegistered = true;
}

/**
 * Aponta a máscara deste mapa para o interior do grupo em destaque e devolve o
 * endereço de tiles que a fonte da máscara deve usar. O endereço muda sempre
 * que o interior muda — troca de grupo, ou o endereço do Earth Engine que
 * chegou ou foi renovado —, e a fonte pede todos os tiles de novo.
 *
 * const tiles = syncHighlightMask(map, sourceId, fillUrl, BRAZIL_RASTER_BOUNDS);
 */
export function syncHighlightMask(
  map: maplibregl.Map,
  sourceId: string,
  fillTemplate: string | undefined,
  limit: LngLatBounds,
): string {
  ensureProtocol();

  let targetId = targetIdsByMap.get(map);
  let target = targetId ? targets.get(targetId) : undefined;
  if (!targetId || !target) {
    targetId = String(nextTargetId++);
    target = createTarget(map, sourceId, limit);
    targets.set(targetId, target);
    targetIdsByMap.set(map, targetId);
  }

  if (target.fillTemplate !== fillTemplate) {
    target.fillTemplate = fillTemplate;
    target.generation += 1;
  }
  return buildHighlightMaskTiles(targetId, target.generation);
}

// Os tiles cujo interior chegou acendem juntos no próximo quadro, em vez de um
// recarregamento por tile.
function createTarget(
  map: maplibregl.Map,
  sourceId: string,
  limit: LngLatBounds,
): MaskTarget {
  let readyTiles: TileCoordinate[] = [];
  let frame: number | null = null;

  const flush = () => {
    frame = null;
    const tiles = readyTiles;
    readyTiles = [];
    if (!map.getSource(sourceId)) return;
    try {
      map.refreshTiles(sourceId, tiles);
    } catch {
      // A fonte saiu entre o aviso e o quadro: nada a acender.
    }
  };

  return {
    generation: 0,
    fillTemplate: undefined,
    limit,
    onTileReady: (tile) => {
      readyTiles.push(tile);
      frame ??= requestAnimationFrame(flush);
    },
  };
}
