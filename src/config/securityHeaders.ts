// Origens externas que o navegador realmente busca: imagens do Contentful, os
// dois mapas-base, os ladrilhos do Earth Engine e o login do Firebase. Tudo o
// mais que o produto usa (Contentful GraphQL, Google Docs, Drive) é falado pelo
// servidor, e por isso não entra na política do navegador.
const CONTENTFUL_IMAGES = "https://images.ctfassets.net";
const BASE_MAP_TILES = [
  "https://*.tile.openstreetmap.org",
  "https://server.arcgisonline.com",
];
const GOOGLE_APIS = "https://*.googleapis.com";

/**
 * Política de conteúdo do navegador, em modo de observação.
 *
 * Vai como `Content-Security-Policy-Report-Only` de propósito: em modo relatório
 * o navegador só registra o que teria bloqueado, sem quebrar nada. É o passo
 * anterior a ligar a política de verdade — primeiro se olha o console de uma
 * navegação completa (mapa, painel, relatório, catálogo), ajusta-se a lista, e
 * só depois o cabeçalho passa a ser `Content-Security-Policy`.
 *
 * `'unsafe-inline'` em script está aí porque o Next injeta os dados de
 * hidratação em tags inline sem nonce; sair disso exige middleware de nonce e é
 * trabalho de outra iteração.
 */
export function buildContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${CONTENTFUL_IMAGES} ${BASE_MAP_TILES.join(" ")} ${GOOGLE_APIS}`,
    "font-src 'self' data:",
    `connect-src 'self' ${GOOGLE_APIS} https://securetoken.googleapis.com ${CONTENTFUL_IMAGES}`,
    // O MapLibre desenha o mapa num web worker criado a partir de um blob.
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/**
 * Cabeçalhos de segurança de toda resposta do app.
 *
 * A plataforma é uma tela autenticada com dados territoriais e um catálogo que
 * escreve no Contentful; sem estes cabeçalhos ela podia ser embutida em um
 * iframe de qualquer site (o golpe do botão invisível sobreposto) e a primeira
 * visita em http seguia em claro antes do redirecionamento do nginx.
 *
 * buildSecurityHeaders(); // [{ key: "X-Frame-Options", value: "DENY" }, ...]
 */
export function buildSecurityHeaders(): { key: string; value: string }[] {
  return [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
    {
      // Dois anos é o valor que os navegadores esperam para considerar o
      // domínio seguro por padrão. Só vale sobre https, então não atrapalha o
      // `npm run dev` em http://localhost.
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    },
    {
      key: "Content-Security-Policy-Report-Only",
      value: buildContentSecurityPolicy(),
    },
  ];
}
