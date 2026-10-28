const TRUSTED_SEC_FETCH_SITES = new Set(["same-origin", "none"]);

function parseOrigin(value?: string | null) {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getForwardedHeaderValue(value?: string | null) {
  return value?.split(",")[0]?.trim().replace(/\/$/, "");
}

function buildOrigin(protocol: string, host?: string | null) {
  return host ? parseOrigin(`${protocol}://${host}`) : null;
}

/**
 * Se uma requisição que muda estado veio de uma página do próprio SAP. Barra
 * outro site pelo `sec-fetch-site` e confere `origin` e `referer` contra as
 * origens confiáveis; sem nenhum dos três cabeçalhos, recusa.
 *
 * Além da origem do `request.url` e da `NEXT_PUBLIC_HOST_URL`, confia nos
 * cabeçalhos `host` e `x-forwarded-host`, com qualquer esquema. Atrás do proxy
 * o `request.url` chega como `http://localhost:3000`, e a produção deixa a
 * `NEXT_PUBLIC_HOST_URL` vazia para servir vários domínios; sem os cabeçalhos,
 * nenhuma origem real passava e o cadastro devolvia 403 para todo mundo. Um
 * `NEXT_PUBLIC_HOST_URL` inválido é ignorado.
 *
 * if (!hasTrustedMutationOrigin(request)) return 403;
 */
export function hasTrustedMutationOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  const origin = request.headers.get("origin")?.trim();
  const referer = request.headers.get("referer")?.trim();
  const configuredOrigin = parseOrigin(process.env.NEXT_PUBLIC_HOST_URL);

  const trustedOrigins = new Set([requestUrl.origin]);
  const trustedHosts = new Set<string>();

  if (configuredOrigin) trustedOrigins.add(configuredOrigin);

  const forwardedHost = getForwardedHeaderValue(
    request.headers.get("x-forwarded-host"),
  );
  const host = getForwardedHeaderValue(request.headers.get("host"));
  const protocol =
    getForwardedHeaderValue(request.headers.get("x-forwarded-proto")) ||
    requestUrl.protocol.replace(/:$/, "");

  for (const candidate of [forwardedHost, host]) {
    const candidateOrigin = buildOrigin(protocol, candidate);
    if (candidateOrigin) trustedOrigins.add(candidateOrigin);
  }

  trustedHosts.add(requestUrl.host);
  if (configuredOrigin) trustedHosts.add(new URL(configuredOrigin).host);
  if (forwardedHost) trustedHosts.add(forwardedHost);
  if (host) trustedHosts.add(host);

  function isTrusted(value: string) {
    const parsedOrigin = parseOrigin(value);

    if (!parsedOrigin) return false;
    if (trustedOrigins.has(parsedOrigin)) return true;

    const protocol = new URL(parsedOrigin).protocol.replace(/:$/, "");

    for (const trustedHost of trustedHosts) {
      if (buildOrigin(protocol, trustedHost) === parsedOrigin) return true;
    }

    return false;
  }

  if (fetchSite && !TRUSTED_SEC_FETCH_SITES.has(fetchSite)) return false;
  if (origin && !isTrusted(origin)) return false;
  if (referer && !isTrusted(referer)) return false;

  return Boolean(fetchSite || origin || referer);
}
