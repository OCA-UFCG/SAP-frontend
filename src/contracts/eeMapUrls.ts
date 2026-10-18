/**
 * Contrato de `POST /api/ee/map-urls`: um pedido, várias camadas, uma URL de
 * tiles para cada — ou, com `thumbnail`, a URL de uma imagem só do recorte. O
 * relatório municipal precisa de todas as URLs antes de começar a desenhar os
 * mapas, e pedi-las uma a uma estourava o limite de requisições ao Earth Engine.
 */

/** Teto por requisição. O relatório mais largo hoje tem 20 camadas. */
export const EE_MAP_URLS_MAX_ITEMS = 40;

/**
 * Quanto tempo a rota segura a requisição esperando o Earth Engine. Quem não
 * ficar pronto volta como `pending`: a ida ao Earth Engine continua em voo e o
 * cliente pede de novo, sem gastar vaga nem repetir a chamada.
 *
 * O prazo é curto porque a resposta é tudo-ou-nada até ele vencer: com 5 s, as
 * camadas que ficavam prontas em 1 s esperavam a mais lenta, e no frio de um
 * deploy nenhum mapa do relatório começava a ser desenhado antes de 5 s. Com
 * 1 s o relatório recebe o que já está pronto e começa a desenhar enquanto o
 * resto chega.
 */
export const EE_MAP_URLS_DEADLINE_MS = 1000;

export interface EeMapUrlRequestItem {
  name: string;
  year: string;
}

/** Lado máximo de uma miniatura, em pixels. O relatório pede ~940 de largura. */
export const EE_MAP_THUMBNAIL_MAX_SIDE = 2048;

/**
 * O recorte de uma miniatura: o retângulo em graus (oeste, sul, leste, norte)
 * e o tamanho da imagem em pixels, na projeção do mapa (Web Mercator).
 *
 * Presente no pedido, cada camada volta com o endereço de **uma imagem** desse
 * recorte em vez do endereço de tiles. O mapa do relatório é uma foto, e os ~15
 * tiles que ele baixava por camada somavam ~300 pedidos ao Earth Engine por
 * relatório — o bastante para o Google recusar tiles com 20 pessoas usando.
 */
export interface EeMapThumbnailView {
  bbox: [west: number, south: number, east: number, north: number];
  width: number;
  height: number;
}

/**
 * Por que uma camada não trouxe URL. `year_not_found` é o caso que mais aparece
 * no relatório: o período veio dos dados da análise e o `imageData` daquele
 * `panelLayer` não tem imagem para ele.
 */
export type EeMapUrlFailure =
  "layer_not_found" | "year_not_found" | "rate_limited" | "error";

/** `pending` não é falha: é "a URL ainda vem, pergunte de novo". */
export type EeMapUrlStatus = EeMapUrlFailure | "pending";

export type EeMapUrlEntry = EeMapUrlRequestItem &
  ({ url: string; status?: never } | { url?: never; status: EeMapUrlStatus });

export interface EeMapUrlsResponse {
  maps: EeMapUrlEntry[];
}

export type EeMapUrlRequestParseResult =
  | { ok: true; items: EeMapUrlRequestItem[]; thumbnail?: EeMapThumbnailView }
  | { ok: false; error: string };

/** Chave que identifica uma camada + período nas duas pontas. */
export const buildEeMapUrlKey = (name: string, year: string) =>
  `${name}:${year}`;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isPixelSide = (value: unknown): value is number =>
  Number.isInteger(value) &&
  (value as number) > 0 &&
  (value as number) <= EE_MAP_THUMBNAIL_MAX_SIDE;

/** Web Mercator não chega aos polos: acima de ~85,05° a projeção diverge. */
const MERCATOR_MAX_LATITUDE = 85;

function readThumbnail(value: unknown): EeMapThumbnailView | null {
  if (typeof value !== "object" || value === null) return null;
  const { bbox, width, height } = value as Record<string, unknown>;
  if (!Array.isArray(bbox) || bbox.length !== 4) return null;
  if (!bbox.every(isFiniteNumber)) return null;
  if (!isPixelSide(width) || !isPixelSide(height)) return null;

  const [west, south, east, north] = bbox;
  if (west < -180 || east > 180 || west >= east) return null;
  if (south < -MERCATOR_MAX_LATITUDE || north > MERCATOR_MAX_LATITUDE) {
    return null;
  }
  if (south >= north) return null;

  return { bbox: [west, south, east, north], width, height };
}

function readItem(value: unknown): EeMapUrlRequestItem | null {
  if (typeof value !== "object" || value === null) return null;
  const { name, year } = value as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim()) return null;
  if (typeof year !== "string" || !year.trim()) return null;
  return { name: name.trim(), year: year.trim() };
}

/**
 * Valida o corpo da requisição rejeitando o que a rota não conseguiria
 * responder, em vez de deixar um item malformado virar erro lá na frente.
 *
 * @example
 * const parsed = parseEeMapUrlRequest({ maps: [{ name: "anaseca", year: "2024-12" }] });
 */
export function parseEeMapUrlRequest(
  body: unknown,
): EeMapUrlRequestParseResult {
  const { maps, thumbnail: rawThumbnail } =
    (body as { maps?: unknown; thumbnail?: unknown } | null) ?? {};

  if (!Array.isArray(maps) || maps.length === 0) {
    return {
      ok: false,
      error: `Missing required body field: maps (non-empty array of { name, year }). Received: ${JSON.stringify(maps)}`,
    };
  }

  if (maps.length > EE_MAP_URLS_MAX_ITEMS) {
    return {
      ok: false,
      error: `Too many maps requested: ${maps.length}. Maximum is ${EE_MAP_URLS_MAX_ITEMS}.`,
    };
  }

  const items = maps.map(readItem);
  const invalidIndex = items.indexOf(null);
  if (invalidIndex >= 0) {
    return {
      ok: false,
      error: `Invalid map entry at index ${invalidIndex}, expected { name: string, year: string }. Received: ${JSON.stringify(maps[invalidIndex])}`,
    };
  }

  const thumbnail =
    rawThumbnail === undefined ? undefined : readThumbnail(rawThumbnail);
  if (thumbnail === null) {
    return {
      ok: false,
      error: `Invalid thumbnail, expected { bbox: [west, south, east, north], width, height } with sides up to ${EE_MAP_THUMBNAIL_MAX_SIDE} px. Received: ${JSON.stringify(rawThumbnail)}`,
    };
  }

  return {
    ok: true,
    items: dedupeItems(items as EeMapUrlRequestItem[]),
    ...(thumbnail ? { thumbnail } : {}),
  };
}

// Duas camadas do relatório podem cair no mesmo par; resolver duas vezes
// gastaria duas vagas do limite por uma única ida ao Earth Engine.
function dedupeItems(items: EeMapUrlRequestItem[]): EeMapUrlRequestItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = buildEeMapUrlKey(item.name, item.year);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
