/**
 * Contrato de `POST /api/ee/map-urls`: um pedido, várias camadas, uma URL de
 * tiles para cada. O relatório municipal precisa de todas as URLs antes de
 * começar a desenhar os mapas, e pedi-las uma a uma estourava o limite de
 * requisições ao Earth Engine.
 */

/** Teto por requisição. O relatório mais largo hoje tem 20 camadas. */
export const EE_MAP_URLS_MAX_ITEMS = 40;

/**
 * Quanto tempo a rota segura a requisição esperando o Earth Engine. Vinte
 * camadas frias custam cerca de 13 s — o SDK do Earth Engine despacha uma
 * requisição a cada 350 ms de uma fila global — e segurar tudo isso numa
 * requisição só a deixaria à mercê do timeout do proxy, derrubando os vinte
 * mapas de uma vez. Quem não ficar pronto volta como `pending`: a ida ao Earth
 * Engine continua em voo e o cliente pede de novo, sem gastar vaga nem repetir
 * a chamada.
 */
export const EE_MAP_URLS_DEADLINE_MS = 5000;

export interface EeMapUrlRequestItem {
  name: string;
  year: string;
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
  { ok: true; items: EeMapUrlRequestItem[] } | { ok: false; error: string };

/** Chave que identifica uma camada + período nas duas pontas. */
export const buildEeMapUrlKey = (name: string, year: string) =>
  `${name}:${year}`;

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
  const maps = (body as { maps?: unknown } | null)?.maps;

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

  return { ok: true, items: dedupeItems(items as EeMapUrlRequestItem[]) };
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
