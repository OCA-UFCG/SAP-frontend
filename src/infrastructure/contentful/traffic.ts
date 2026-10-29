import "server-only";

import { subscribe } from "node:diagnostics_channel";

/**
 * Para qual parte do Contentful vai cada endereço. As APIs contam na cota de
 * chamadas; imagens e arquivos contam na de banda.
 */
const CONTENTFUL_HOSTS: Record<string, string> = {
  "graphql.contentful.com": "graphql",
  "cdn.contentful.com": "cda",
  "preview.contentful.com": "cpa",
  "api.contentful.com": "cma",
  "images.ctfassets.net": "imagens",
  "assets.ctfassets.net": "arquivos",
  "downloads.ctfassets.net": "arquivos",
  "videos.ctfassets.net": "arquivos",
};

export interface ContentfulTraffic {
  requests: number;
  /** Só o que o Contentful declarou em Content-Length. */
  bytes: number;
}

/**
 * Guardado no `globalThis` porque o Next empacota o `instrumentation` e cada
 * rota à parte: com uma variável de módulo, quem conta e quem publica no
 * `/api/metrics` enxergariam cópias diferentes.
 */
const state = ((globalThis as { __sedesContentfulTraffic?: TrafficState })
  .__sedesContentfulTraffic ??= {
  traffic: new Map<string, ContentfulTraffic>(),
  started: false,
});

interface TrafficState {
  traffic: Map<string, ContentfulTraffic>;
  started: boolean;
}

interface UndiciRequest {
  origin?: string | URL;
}

function contentfulApi(request: UndiciRequest) {
  try {
    return CONTENTFUL_HOSTS[new URL(String(request.origin)).hostname];
  } catch {
    return undefined;
  }
}

function entry(api: string) {
  let current = state.traffic.get(api);
  if (!current) {
    current = { requests: 0, bytes: 0 };
    state.traffic.set(api, current);
  }
  return current;
}

/**
 * Passa a contar os pedidos deste servidor ao Contentful que de fato saem pela
 * rede. Escuta o `fetch` do Node por baixo, e não o `getContent`: assim o que o
 * Data Cache do Next responde sozinho não conta, e o que a CMA e o
 * `/_next/image` buscam conta junto.
 */
export function startContentfulTrafficCount() {
  if (state.started) return;
  state.started = true;

  subscribe("undici:request:create", (message) => {
    const api = contentfulApi((message as { request: UndiciRequest }).request);
    if (api) entry(api).requests += 1;
  });

  subscribe("undici:request:headers", (message) => {
    const { request, response } = message as {
      request: UndiciRequest;
      response: { headers: Array<Buffer | string> };
    };
    const api = contentfulApi(request);
    if (!api) return;
    // Os cabeçalhos chegam como uma lista plana: nome, valor, nome, valor...
    for (let i = 0; i < response.headers.length; i += 2) {
      if (String(response.headers[i]).toLowerCase() === "content-length") {
        const length = Number(String(response.headers[i + 1]));
        if (Number.isFinite(length)) entry(api).bytes += length;
        return;
      }
    }
  });
}

/** O que este processo pediu ao Contentful desde que subiu, por API. */
export function getContentfulTraffic(): ReadonlyMap<string, ContentfulTraffic> {
  return state.traffic;
}
