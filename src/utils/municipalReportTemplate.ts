import type {
  MunicipalReportContent,
  MunicipalReportContentSection,
  MunicipalReportData,
  MunicipalReportTemplateDocument,
  MunicipalReportTemplateValue,
  MunicipalReportTemplateVariableDefinition,
  MunicipalReportTemplateVariableType,
} from "@/contracts/municipalReport";

const MARKER = /^\[\[(report):([a-z][a-z0-9-]*)\]\]$|^\[\[(analysis):([a-z0-9_]+):([a-z][a-z0-9-]*)\]\]$/u;
const VARIABLE = /\$\$|\$([A-Za-z_][A-Za-z0-9_]*)/gu;

function variableType(name: string): MunicipalReportTemplateVariableType {
  if (name.startsWith("percentual_") || name.startsWith("frequencia_")) return "percentage";
  if (name.startsWith("periodo") || name.startsWith("inicio_") || name.startsWith("fim_")) return "period";
  if (name.startsWith("quantidade_") || name.startsWith("total_")) return "number";
  return "string";
}

export function formatMunicipalReportTemplateValue(
  value: Exclude<MunicipalReportTemplateValue, null>,
  type: MunicipalReportTemplateVariableType,
  locale: string,
) {
  if (type === "percentage" && typeof value === "number") {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  }
  if (type === "number" && typeof value === "number") return new Intl.NumberFormat(locale).format(value);
  if (type === "period" && typeof value === "string") {
    const match = /^(\d{4})-(\d{2})$/u.exec(value);
    if (match) {
      return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })
        .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
    }
  }
  return String(value);
}

export function buildMunicipalReportVariableCatalog(
  variables: MunicipalReportData["templateVariables"],
): MunicipalReportTemplateVariableDefinition[] {
  return Object.entries(variables).map(([name, value]) => ({
    name,
    type: variableType(name),
    description: `Variável do relatório municipal: ${name}.`,
    example: value ?? "indisponível",
  }));
}

export function parseMunicipalReportTemplate(document: MunicipalReportTemplateDocument) {
  const sections: Omit<MunicipalReportContentSection, "resolvedText" | "errors">[] = [];
  const errors: string[] = [];
  let current: Omit<MunicipalReportContentSection, "resolvedText" | "errors"> | null = null;

  for (const line of document.text.replace(/\r\n?/gu, "\n").split("\n")) {
    if (line.startsWith("[[") && line.endsWith("]]")) {
      const match = MARKER.exec(line.trim());
      if (!match) {
        errors.push(`Marcador inválido: ${line.trim()}`);
        current = null;
        continue;
      }
      current = match[1]
        ? { key: `report:${match[2]}`, scope: "report", slot: match[2], originalText: "" }
        : { key: `analysis:${match[4]}:${match[5]}`, scope: "analysis", analysisAlias: match[4], slot: match[5], originalText: "" };
      sections.push(current);
      continue;
    }
    if (current) current.originalText += `${current.originalText ? "\n" : ""}${line}`;
    else if (line.trim()) errors.push(`Texto fora de uma seção: ${line.trim()}`);
  }
  return { sections, errors };
}

export function resolveMunicipalReportTemplate(
  document: MunicipalReportTemplateDocument,
  report: MunicipalReportData,
  selectedAliases: string[],
  locale = "pt-BR",
): MunicipalReportContent {
  const parsed = parseMunicipalReportTemplate(document);
  const selected = new Set(selectedAliases);
  const sections = parsed.sections
    .filter((section) => section.scope === "report" || selected.has(section.analysisAlias!))
    .map((section): MunicipalReportContentSection => {
      const errors: string[] = [];
      const resolvedText = section.originalText.replace(VARIABLE, (token, name: string | undefined) => {
        if (token === "$$") return "$";
        if (!(name! in report.templateVariables)) {
          errors.push(`Variável desconhecida: $${name}`);
          return token;
        }
        const value = report.templateVariables[name!];
        if (value == null) {
          errors.push(`Variável sem valor: $${name}`);
          return token;
        }
        return formatMunicipalReportTemplateValue(value, variableType(name!), locale);
      });
      return { ...section, resolvedText: errors.length ? null : resolvedText.trim(), errors };
    });
  return {
    template: { id: document.id, version: document.version, origin: document.origin, updatedAt: document.updatedAt },
    sections,
    errors: [...parsed.errors, ...sections.flatMap((section) => section.errors)],
  };
}

export function getMunicipalReportContentSection(
  content: MunicipalReportContent,
  key: string,
) {
  return content.sections.find((section) => section.key === key);
}
