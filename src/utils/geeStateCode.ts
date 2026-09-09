import { statesObj } from "@/utils/constants";

const STATE_KEY_PATTERN = /^[a-z]{2}$/u;

function normalizeComparableText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const stateCodeByName = new Map(
  Object.entries(statesObj).map(([stateCode, stateName]) => [
    normalizeComparableText(stateName),
    stateCode,
  ]),
);

/**
 * A chave territorial de duas letras de uma UF vinda do Earth Engine.
 *
 * As tabelas reais não concordam sobre a coluna de UF: umas guardam a sigla
 * (`PB`, em `SIGLA_UF`) e outras o nome por extenso (`Paraíba`, em `NM_UF`).
 * Aceitar as duas grafias aqui evita que a escolha da coluna no catálogo mude o
 * ranking nacional em silêncio.
 *
 * @example
 * resolveGeeStateCode("PB");            // "pb"
 * resolveGeeStateCode("Paraíba");       // "pb"
 * resolveGeeStateCode("", "Paraíba");   // "pb"
 */
export function resolveGeeStateCode(
  rawStateCode: unknown,
  fallbackName?: unknown,
): string | null {
  const normalized = String(rawStateCode ?? "")
    .trim()
    .toLowerCase();

  if (STATE_KEY_PATTERN.test(normalized) && normalized in statesObj) {
    return normalized;
  }

  return (
    stateCodeByName.get(normalizeComparableText(rawStateCode)) ??
    stateCodeByName.get(normalizeComparableText(fallbackName)) ??
    null
  );
}

export function getStateLabel(stateCode: string, fallbackLabel: string) {
  return statesObj[stateCode as keyof typeof statesObj] ?? fallbackLabel;
}

export { STATE_KEY_PATTERN };
