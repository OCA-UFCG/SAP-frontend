/**
 * Script de teste para gerar gráficos PNG localmente.
 *
 * Uso:
 *   npx tsx scripts/test-chart.ts <baseUrl> <codigoIBGE> <period> <analysis>
 *
 * Exemplo:
 *   npx tsx scripts/test-chart.ts http://localhost:3000 2504009 2024-01 seca
 *
 * O cookie de sessão deve estar na variável de ambiente SESSION_COOKIE.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const [baseUrl, code, period, analysis] = process.argv.slice(2);

if (!baseUrl || !code || !period || !analysis) {
  console.error(
    "Uso: npx tsx scripts/test-chart.ts <baseUrl> <codigoIBGE> <period> <analysis>",
  );
  console.error(
    "Exemplo: SESSION_COOKIE=abc123 npx tsx scripts/test-chart.ts http://localhost:3000 2504009 2024-01 seca",
  );
  process.exit(1);
}

const sessionCookie = process.env.SESSION_COOKIE;
if (!sessionCookie) {
  console.error("❌  Defina a variável SESSION_COOKIE com o valor do cookie de sessão.");
  console.error("   export SESSION_COOKIE=$(copie do browser DevTools → Application → Cookies → session)");
  process.exit(1);
}

async function main() {
  const url = `${baseUrl}/api/municipal-report/${code}/chart?period=${period}&analysis=${analysis}`;
  console.log(`🔗  ${url}\n`);

  const response = await fetch(url, {
    headers: { Cookie: `session=${sessionCookie}` },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`❌  HTTP ${response.status}: ${body}`);
    process.exit(1);
  }

  const outputDir = resolve(__dirname, "..", "tmp", "charts");
  mkdirSync(outputDir, { recursive: true });

  const data = await response.json();
  for (const chart of data.charts ?? []) {
    const buffer = Buffer.from(chart.base64, "base64");
    const filename = `chart-${code}-${chart.alias}-${period}.png`;
    const filepath = resolve(outputDir, filename);
    writeFileSync(filepath, buffer);
    console.log(`✅  ${chart.title} → ${filepath} (${(buffer.length / 1024).toFixed(1)} KB)`);
  }
}

main().catch((err) => {
  console.error("❌  Erro inesperado:", err);
  process.exit(1);
});
