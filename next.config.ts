import type { NextConfig } from "next";

import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/translations/request.ts");

// Cabeçalhos de segurança aplicados a todas as respostas. Eles não mudam o que
// a plataforma faz — só instruem o navegador a se proteger de ataques comuns.
const securityHeaders = [
  {
    // Depois da primeira visita, o navegador só fala com o site por HTTPS pelos
    // próximos dois anos. Fecha a brecha de alguém interceptar aquela primeira
    // batida em texto puro antes do redirecionamento para HTTPS.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    // Ninguém pode colocar a plataforma dentro de um <iframe>. Impede o golpe de
    // sobrepor a nossa tela numa página falsa para roubar cliques (clickjacking).
    // O app não usa iframe de si mesmo, então bloquear tudo é seguro.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // O navegador respeita o tipo de arquivo que o servidor declara, em vez de
    // "adivinhar" e, por exemplo, rodar como script algo que era só texto.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Ao sair para outro site, manda só a origem (o domínio), nunca o endereço
    // completo com os parâmetros da página.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Desliga recursos do navegador que a plataforma não usa, para que nenhum
    // script consiga pedi-los em nome do usuário.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    // Versão moderna da trava de clickjacking, mais um par de proteções sem
    // risco de quebrar nada: object-src bloqueia plugins antigos e base-uri
    // impede que injetem uma <base> que sequestre os links da página. Ainda não
    // restringimos de onde vêm scripts/estilos/conexões porque isso precisa ser
    // testado contra o Firebase, o Earth Engine e o Contentful para não derrubar
    // o mapa — fica como próximo passo.
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'",
  },
];

const nextConfig: NextConfig = {
  // Remove o cabeçalho "X-Powered-By: Next.js", que só entrega para um atacante
  // qual tecnologia mirar.
  poweredByHeader: false,
  experimental: {
    // Keep Docker/WSL production builds below the native-memory peak that can
    // otherwise crash Node while Next.js is collecting output-file traces.
    webpackMemoryOptimizations: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.ctfassets.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
