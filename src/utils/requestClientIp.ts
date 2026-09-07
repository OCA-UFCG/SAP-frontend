// Quantos proxies nossos ficam na frente do Next. Com o nginx do beta/produção
// é um só: ele acrescenta o endereço de quem conectou no fim do
// `X-Forwarded-For`. Um valor maior descreve uma cadeia com CDN na frente.
const DEFAULT_TRUSTED_PROXY_COUNT = 1;

const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

function looksLikeIpAddress(value: string) {
  return IPV4_PATTERN.test(value) || value.includes(":");
}

export function readTrustedProxyCount(
  value = process.env.TRUSTED_PROXY_COUNT,
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_TRUSTED_PROXY_COUNT;
  }

  return Math.floor(parsed);
}

/**
 * Endereço do cliente segundo os proxies em que confiamos, e não segundo o que
 * o cliente diz de si.
 *
 * O `X-Forwarded-For` é uma lista em que qualquer um pode escrever: o cliente
 * manda `X-Forwarded-For: 1.2.3.4` e o nginx apenas acrescenta o endereço real
 * no fim. Ler o primeiro item dessa lista é ler o que o atacante escreveu — e
 * era assim que a guarda de taxa de `/api/logs` chaveava, o que permitia trocar
 * de identidade a cada requisição e nunca bater no limite. Contar da direita
 * para a esquerda descarta o trecho falsificável e chega ao salto que o nosso
 * proxy escreveu.
 *
 * resolveTrustedClientIp(request); // "203.0.113.7"
 */
export function resolveTrustedClientIp(
  request: Request,
  trustedProxyCount = readTrustedProxyCount(),
): string | null {
  const forwardedChain = (request.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (forwardedChain.length > 0) {
    const clientIndex = Math.max(0, forwardedChain.length - trustedProxyCount);
    const clientIp = forwardedChain[clientIndex];

    if (clientIp && looksLikeIpAddress(clientIp)) {
      return clientIp;
    }
  }

  // Só vale quando o proxy o escreve por cima; sem `X-Forwarded-For` nenhum é o
  // que resta antes de cair no user agent.
  const realIp = request.headers.get("x-real-ip")?.trim();

  return realIp && looksLikeIpAddress(realIp) ? realIp : null;
}
