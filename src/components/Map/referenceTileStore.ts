/**
 * Os tiles dos territórios baixados pelo navegador, num lugar só.
 *
 * Quem pede aqui é o pré-carregamento (ao abrir o cartão de Territórios) e a
 * máscara do destaque. As camadas de interior e contorno continuam sendo
 * baixadas pelo próprio MapLibre: o pedido daqui usa o mesmo endereço e o mesmo
 * cabeçalho `Accept` que ele, então quando o MapLibre pede o tile o navegador já
 * o tem guardado (o Earth Engine responde com `max-age=3600`).
 *
 * Cada tile do Earth Engine leva de 1,4 s a 2,6 s, e pedir de novo não deixa
 * mais rápido. Por isso um endereço nunca é pedido duas vezes ao mesmo tempo, e
 * os últimos tiles ficam em memória para a máscara não depender nem do cache
 * do navegador.
 */

export type LngLatBounds = [number, number, number, number];

export interface TileCoordinate {
  z: number;
  x: number;
  y: number;
}

// O mesmo `Accept` que o MapLibre manda ao pedir imagens (`ImageRequest.getImage`).
// Se o servidor variar a resposta por esse cabeçalho, um valor diferente faria
// o navegador guardar duas cópias e o MapLibre baixaria o tile de novo.
const IMAGE_ACCEPT_HEADER = "image/webp,*/*";

// Um tile do território tem de 1 a 30 KB; 600 cobrem os quatro grupos, interior
// e contorno, numa tela inteira com folga, e ficam abaixo de ~10 MB.
const MAX_STORED_TILES = 600;

// Quantos tiles o pré-carregamento baixa ao mesmo tempo. O índice que está na
// tela também vem do Earth Engine, e o teto impede que uma tela grande, com
// centenas de tiles, ocupe o Earth Engine inteiro. Medido no Brasil inteiro (72
// tiles): com 36 os quatro grupos chegam em ~2 s, e o índice ligado no mesmo
// instante não ficou mais lento do que sozinho; com 8 levavam ~9 s.
export const PREFETCH_CONCURRENCY = 36;

const storedTiles = new Map<string, Blob>();
const pendingTiles = new Map<string, Promise<Blob>>();

function remember(url: string, blob: Blob) {
  storedTiles.delete(url);
  storedTiles.set(url, blob);
  while (storedTiles.size > MAX_STORED_TILES) {
    const { value: oldest } = storedTiles.keys().next();
    if (oldest === undefined) return;
    storedTiles.delete(oldest);
  }
}

/** O tile já baixado, sem ir à rede. */
export function peekReferenceTile(url: string): Blob | undefined {
  const blob = storedTiles.get(url);
  if (blob) remember(url, blob);
  return blob;
}

/**
 * Baixa o tile, ou devolve o que já está em memória ou em voo.
 *
 * const blob = await loadReferenceTile("https://.../tiles/5/11/16");
 */
export function loadReferenceTile(url: string): Promise<Blob> {
  const stored = peekReferenceTile(url);
  if (stored) return Promise.resolve(stored);

  const pending = pendingTiles.get(url);
  if (pending) return pending;

  const request = fetch(url, { headers: { Accept: IMAGE_ACCEPT_HEADER } })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Tile do território: HTTP ${response.status}`);
      }
      return response.blob();
    })
    .then((blob) => {
      remember(url, blob);
      return blob;
    })
    .finally(() => {
      pendingTiles.delete(url);
    });

  pendingTiles.set(url, request);
  return request;
}

const prefetchQueue: string[] = [];
const queuedForPrefetch = new Set<string>();
let runningPrefetches = 0;

function pumpPrefetchQueue() {
  while (runningPrefetches < PREFETCH_CONCURRENCY && prefetchQueue.length) {
    const url = prefetchQueue.shift()!;
    queuedForPrefetch.delete(url);
    if (storedTiles.has(url)) continue;

    runningPrefetches += 1;
    loadReferenceTile(url)
      .catch(() => {
        // Pré-carregar é só adiantar: se falhar, a camada pede de novo ao ligar.
      })
      .finally(() => {
        runningPrefetches -= 1;
        pumpPrefetchQueue();
      });
  }
}

/**
 * Põe os tiles na fila de pré-carregamento, na ordem dada, sem passar de
 * `PREFETCH_CONCURRENCY` downloads ao mesmo tempo. Tiles já baixados, em voo ou
 * na fila são ignorados.
 */
export function prefetchReferenceTiles(urls: readonly string[]) {
  for (const url of urls) {
    if (storedTiles.has(url) || pendingTiles.has(url)) continue;
    if (queuedForPrefetch.has(url)) continue;
    queuedForPrefetch.add(url);
    prefetchQueue.push(url);
  }
  pumpPrefetchQueue();
}

/** Somente para testes: o armazém vive no módulo. */
export function clearReferenceTileStore() {
  storedTiles.clear();
  pendingTiles.clear();
  prefetchQueue.length = 0;
  queuedForPrefetch.clear();
  runningPrefetches = 0;
}

export function fillTileTemplate(template: string, tile: TileCoordinate) {
  return template
    .replace("{z}", String(tile.z))
    .replace("{x}", String(tile.x))
    .replace("{y}", String(tile.y));
}

const tileLng = (x: number, z: number) => (x / 2 ** z) * 360 - 180;

const tileLat = (y: number, z: number) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
};

const clampTile = (value: number, z: number) =>
  Math.min(2 ** z - 1, Math.max(0, value));

const lngToTileX = (lng: number, z: number) =>
  clampTile(Math.floor(((lng + 180) / 360) * 2 ** z), z);

const latToTileY = (lat: number, z: number) => {
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat));
  const rad = (clamped * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z;
  return clampTile(Math.floor(y), z);
};

/** Se o tile tem alguma área dentro do retângulo `[oeste, sul, leste, norte]`. */
export function tileIntersectsBounds(
  tile: TileCoordinate,
  [west, south, east, north]: LngLatBounds,
): boolean {
  return (
    tileLng(tile.x, tile.z) < east &&
    tileLng(tile.x + 1, tile.z) > west &&
    tileLat(tile.y + 1, tile.z) < north &&
    tileLat(tile.y, tile.z) > south
  );
}

/**
 * O zoom de tile que o MapLibre usa numa fonte raster de 256 px: ele arredonda
 * (`roundZoom`) e soma 1, porque o zoom do mapa é medido em tiles de 512 px.
 */
export function rasterTileZoom(mapZoom: number, maxZoom = 22): number {
  return Math.min(maxZoom, Math.max(0, Math.round(mapZoom + 1)));
}

/**
 * Os tiles que cobrem a parte da tela que cai dentro de `limit`, do centro da
 * tela para as bordas — se a pessoa clicar antes de tudo chegar, o que ela está
 * olhando chega primeiro.
 *
 * tilesCoveringBounds([-60, -20, -40, -5], 5, BRAZIL_RASTER_BOUNDS);
 */
export function tilesCoveringBounds(
  view: LngLatBounds,
  z: number,
  limit: LngLatBounds,
): TileCoordinate[] {
  const west = Math.max(view[0], limit[0], -180);
  const south = Math.max(view[1], limit[1]);
  const east = Math.min(view[2], limit[2], 180);
  const north = Math.min(view[3], limit[3]);
  if (west >= east || south >= north) return [];

  const minX = lngToTileX(west, z);
  const maxX = lngToTileX(east, z);
  const minY = latToTileY(north, z);
  const maxY = latToTileY(south, z);
  const centerX = lngToTileX((view[0] + view[2]) / 2, z) + 0.5;
  const centerY = latToTileY((view[1] + view[3]) / 2, z) + 0.5;

  const tiles: TileCoordinate[] = [];
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) tiles.push({ z, x, y });
  }

  const distance = (tile: TileCoordinate) =>
    (tile.x + 0.5 - centerX) ** 2 + (tile.y + 0.5 - centerY) ** 2;
  return tiles.sort((a, b) => distance(a) - distance(b));
}

interface ReferenceOverlayTemplates {
  outline: string;
  fill?: string;
}

/**
 * Pré-carrega os grupos de território para a parte da tela que está à vista.
 * Os interiores vêm antes dos contornos: é do interior que sai a máscara do
 * destaque, e é ele que mostra a mancha do território de longe.
 *
 * prefetchReferenceOverlayViewport(urls.values(), [-75, -35, -30, 6], 3.6, BRAZIL_RASTER_BOUNDS);
 */
export function prefetchReferenceOverlayViewport(
  overlays: Iterable<ReferenceOverlayTemplates | undefined>,
  view: LngLatBounds,
  mapZoom: number,
  limit: LngLatBounds,
) {
  const tiles = tilesCoveringBounds(view, rasterTileZoom(mapZoom), limit);
  const templates = Array.from(overlays).filter(
    (overlay): overlay is ReferenceOverlayTemplates => Boolean(overlay),
  );
  const fillTemplates = templates.flatMap((overlay) =>
    overlay.fill ? [overlay.fill] : [],
  );
  const outlineTemplates = templates.map((overlay) => overlay.outline);

  const urlsFor = (group: string[]) =>
    tiles.flatMap((tile) =>
      group.map((template) => fillTileTemplate(template, tile)),
    );
  prefetchReferenceTiles([
    ...urlsFor(fillTemplates),
    ...urlsFor(outlineTemplates),
  ]);
}
