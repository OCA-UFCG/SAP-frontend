import { createRateLimiter } from "@/app/api/rateLimit";

const MUNICIPAL_ANALYSIS_RATE_LIMIT_WINDOW_MS = 1000 * 60;
// Teto alto de propósito. Este é o caminho que mais gera carga no Earth Engine,
// mas o uso legítimo é volumoso: abrir uma camada migrada custa uma requisição
// por período (45 no índice de aridez do ERA5-Land) e trocar de território
// repete a série inteira, então um teto baixo quebraria a navegação normal.
//
// O que ele impede é o descontrole. Um laço no cliente chegou a disparar 869
// requisições ao abrir uma camada de 45 períodos, e um usuário autenticado
// martelando a rota ocupa a mesma fila do Earth Engine que atende todo mundo
// naquele processo.
const DEFAULT_MAX_REQUESTS = 300;

function getMaxRequests() {
  const configured = Number(
    process.env.MUNICIPAL_ANALYSIS_RATE_LIMIT_MAX_REQUESTS,
  );

  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_MAX_REQUESTS;
  }

  return Math.floor(configured);
}

const municipalAnalysisRateLimiter = createRateLimiter({
  windowMs: MUNICIPAL_ANALYSIS_RATE_LIMIT_WINDOW_MS,
  getMaxRequests,
});

export function consumeMunicipalAnalysisRateLimit(clientKey: string) {
  return municipalAnalysisRateLimiter.consume(clientKey);
}

export function clearMunicipalAnalysisRateLimit() {
  municipalAnalysisRateLimiter.clear();
}

export {
  DEFAULT_MAX_REQUESTS as MUNICIPAL_ANALYSIS_RATE_LIMIT_MAX_REQUESTS,
  MUNICIPAL_ANALYSIS_RATE_LIMIT_WINDOW_MS,
};
