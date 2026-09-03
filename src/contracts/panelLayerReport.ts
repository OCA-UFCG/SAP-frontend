import type { MunicipalReportDocsSection } from "@/contracts/municipalReport";

export const PANEL_LAYER_REPORT_SCHEMA_VERSION = 1;

const MAX_SECTIONS = 12;
const MAX_TITLE_LENGTH = 160;
const MAX_TEXT_LENGTH = 4000;
const MAX_METHODOLOGY_LENGTH = 2000;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;

/**
 * O texto do Relatório Automático que o catálogo publica junto com o índice.
 *
 * A forma de `sections` é deliberadamente a mesma que o Google Docs entrega
 * (`MunicipalReportDocsSection`): assim o texto escrito no catálogo entra no
 * lugar do bloco `[layer: <id>]` sem que a montagem do relatório precise saber
 * de onde ele veio. Uma seção chamada "Situação atual" continua substituindo a
 * frase gerada automaticamente, como já acontece com o documento.
 *
 * @example
 * const config: PublishedPanelLayerReportConfig = {
 *   schemaVersion: 1,
 *   sectionColor: "#795548",
 *   methodology: "Calculado pela razão entre precipitação e evapotranspiração.",
 *   sections: [
 *     { title: "Situação atual", text: "O município está em [classe_aridez]." },
 *   ],
 * };
 */
export interface PublishedPanelLayerReportConfig {
  schemaVersion: typeof PANEL_LAYER_REPORT_SCHEMA_VERSION;
  /** Cor do cabeçalho da seção. Sem ela o relatório deriva da paleta de classes. */
  sectionColor?: string;
  /** Parágrafo das "Notas" ao pé do relatório. */
  methodology?: string;
  sections: MunicipalReportDocsSection[];
}

function parseOptionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new Error(
      `Campo ${field} do relatório deve ser texto, recebido: ${typeof value}`,
    );
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(
      `Campo ${field} do relatório excede ${maxLength} caracteres: ${trimmed.length}`,
    );
  }
  return trimmed || undefined;
}

function parseSection(value: unknown, index: number): MunicipalReportDocsSection {
  if (!value || typeof value !== "object") {
    throw new Error(
      `Seção ${index} do relatório deve ser um objeto { title, text }, recebido: ${JSON.stringify(value)}`,
    );
  }
  const { title, text } = value as Record<string, unknown>;
  if (typeof title !== "string" || !title.trim()) {
    throw new Error(
      `Seção ${index} do relatório precisa de um título, recebido: ${JSON.stringify(title)}`,
    );
  }
  if (typeof text !== "string") {
    throw new Error(
      `Seção ${index} do relatório precisa de um texto, recebido: ${typeof text}`,
    );
  }
  if (title.trim().length > MAX_TITLE_LENGTH) {
    throw new Error(
      `Título da seção ${index} excede ${MAX_TITLE_LENGTH} caracteres: ${title.trim().length}`,
    );
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(
      `Texto da seção ${index} excede ${MAX_TEXT_LENGTH} caracteres: ${text.length}`,
    );
  }

  return { title: title.trim(), text: text.trim() };
}

export function parsePublishedPanelLayerReportConfig(
  value: unknown,
): PublishedPanelLayerReportConfig {
  if (!value || typeof value !== "object") {
    throw new Error(
      `reportConfig deve ser um objeto, recebido: ${JSON.stringify(value)}`,
    );
  }
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== PANEL_LAYER_REPORT_SCHEMA_VERSION) {
    throw new Error(
      `reportConfig com schemaVersion não suportada: ${JSON.stringify(raw.schemaVersion)}; esperado ${PANEL_LAYER_REPORT_SCHEMA_VERSION}`,
    );
  }

  const sectionColor = parseOptionalText(raw.sectionColor, "sectionColor", 7);
  if (sectionColor && !HEX_COLOR_PATTERN.test(sectionColor)) {
    throw new Error(
      `reportConfig.sectionColor deve ser um hexadecimal #RRGGBB, recebido: ${sectionColor}`,
    );
  }

  const rawSections = raw.sections ?? [];
  if (!Array.isArray(rawSections)) {
    throw new Error(
      `reportConfig.sections deve ser uma lista, recebido: ${typeof rawSections}`,
    );
  }
  if (rawSections.length > MAX_SECTIONS) {
    throw new Error(
      `reportConfig.sections excede ${MAX_SECTIONS} seções: ${rawSections.length}`,
    );
  }

  const methodology = parseOptionalText(
    raw.methodology,
    "methodology",
    MAX_METHODOLOGY_LENGTH,
  );

  return {
    schemaVersion: PANEL_LAYER_REPORT_SCHEMA_VERSION,
    ...(sectionColor ? { sectionColor } : {}),
    ...(methodology ? { methodology } : {}),
    // Uma seção sem texto não vira seção vazia no relatório: ela some, como já
    // acontece com um bloco em branco no Google Docs.
    sections: rawSections
      .map(parseSection)
      .filter((section) => section.text.length > 0),
  };
}

/**
 * Igual a `parsePublishedPanelLayerReportConfig`, mas devolve `null` em vez de
 * lançar. É a forma usada na leitura do Contentful: um `reportConfig` malformado
 * derruba o texto daquele índice, nunca o relatório inteiro.
 */
export function tryParsePublishedPanelLayerReportConfig(
  value: unknown,
): PublishedPanelLayerReportConfig | null {
  if (value == null) return null;
  try {
    return parsePublishedPanelLayerReportConfig(value);
  } catch {
    return null;
  }
}
