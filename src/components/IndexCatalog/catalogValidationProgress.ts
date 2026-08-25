export interface ValidationProgress {
  message: string;
  percent: number;
}

/**
 * Progresso estimado da validação. O GEE não reporta andamento, então a barra
 * avança sozinha e para em 94%: prometer 100% antes da resposta faria a tela
 * parecer travada justamente no passo mais longo.
 */
export function advanceValidationProgress(current: ValidationProgress | null) {
  if (!current || current.percent >= 94) return current;
  const increment =
    current.percent < 40
      ? 5
      : current.percent < 70
        ? 3
        : current.percent < 88
          ? 2
          : 1;
  const percent = Math.min(94, current.percent + increment);
  const message =
    percent < 35
      ? "Conectando ao Google Earth Engine…"
      : percent < 65
        ? "Lendo períodos, classes e colunas da tabela…"
        : percent < 82
          ? "Conferindo se os dados territoriais estão completos…"
          : percent < 92
            ? "Conferindo os mapas de cada período…"
            : "Preparando a prévia para você conferir…";
  return { message, percent };
}
