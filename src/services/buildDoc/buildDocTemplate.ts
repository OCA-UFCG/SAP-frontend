import "server-only";

import {
  MUNICIPAL_REPORT_DOCS_REPORT_KEY,
  type MunicipalReportDocsContent,
  type MunicipalReportDocsSection,
} from "@/contracts/municipalReport";

export type ThemeSection = MunicipalReportDocsSection;
export type DocsContent = MunicipalReportDocsContent;

type GetDocTemplateInput = {
  themes: string[];
  city?: string;
  state?: string;
  month?: string | number;
  year?: string | number;
};

type ContentVariables = {
  city?: string;
  state?: string;
  month?: string;
  year?: string;
};

function normalizeLabel(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const IGNORED_GROUP_HEADINGS = new Set([
  "analise da serie historica",
  "notas metodologicas e fontes",
]);

const PLAIN_SECTION_HEADINGS = [
  "situacao atual",
  "tendencia recente",
  "contexto historico",
  "classificacao climatica",
  "evolucao decenal",
  "leitura integrada dos indicadores",
];

const DOCS_CACHE_TTL_MS = 10 * 60 * 1000;

type DocsCacheEntry = {
  url: string;
  text?: string;
  expiresAt: number;
  refresh?: Promise<string>;
};

const docsTextCache = new Map<string, DocsCacheEntry>();

function parseSectionHeader(line: string) {
  const trimmed = line.trim();
  const markedHeaderMatch = trimmed.match(/^(?:\*\*(.+?)\*\*|\*([^*]+)\*)\s*:?\s*(.*)$/);

  if (markedHeaderMatch) {
    return {
      title: (markedHeaderMatch[1] ?? markedHeaderMatch[2]).trim().replace(/:\s*$/u, ""),
      text: markedHeaderMatch[3].trim(),
    };
  }

  const separatorIndex = trimmed.indexOf(":");
  if (separatorIndex < 0) return null;

  const title = trimmed.slice(0, separatorIndex).trim();
  const normalizedTitle = normalizeLabel(title);
  const isKnownPlainHeading = PLAIN_SECTION_HEADINGS.includes(normalizedTitle)
    || normalizedTitle.startsWith("variacao ");

  if (!isKnownPlainHeading) return null;

  return {
    title,
    text: trimmed.slice(separatorIndex + 1).trim(),
  };
}

function parseThemeSections(text: string): ThemeSection[] {
  const sections: Array<{ title: string; lines: string[] }> = [];
  let currentSection: { title: string; lines: string[] } | null = null;

  for (const line of text.split(/\r?\n/)) {
    if (/^\s*\[(?:grupo|ajuda):[^\]]+\]\s*$/iu.test(line)) {
      currentSection = null;
      continue;
    }

    const sectionHeader = parseSectionHeader(line);

    if (sectionHeader) {
      currentSection = {
        title: sectionHeader.title,
        lines: [],
      };
      sections.push(currentSection);

      if (sectionHeader.text) {
        currentSection.lines.push(sectionHeader.text);
      }

      continue;
    }

    if (IGNORED_GROUP_HEADINGS.has(normalizeLabel(line))) {
      currentSection = null;
      continue;
    }

    if (!currentSection) {
      continue;
    }

    currentSection.lines.push(line);
  }

  return sections.map((section) => ({
    title: section.title,
    text: section.lines.join("\n").trim(),
  }));
}

function getDocumentTitle(text: string) {
  for (const line of text.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      continue;
    }

    if (parseSectionHeader(trimmedLine)) {
      return null;
    }

    return trimmedLine.replace(/^◉\s*\d+\.\s*/, "");
  }

  return null;
}

function getVariableValue(label: string, variables: ContentVariables) {
  const normalizedLabel = normalizeLabel(label);
  const replacements: Record<string, string | undefined> = {
    city: variables.city,
    municipio: variables.city,
    state: variables.state,
    uf: variables.state,
    month: variables.month,
    mes: variables.month,
    year: variables.year,
    ano: variables.year,
  };

  return replacements[normalizedLabel];
}

function interpolateVariables(text: string, variables: ContentVariables) {
  return text
    .replace(/\[([^\]]+)\]/g, (match, label) => {
      return getVariableValue(label, variables) ?? match;
    })
    .replace(
      /\{\{\s*([^}]+?)\s*\}\}|\{\s*([^}]+?)\s*\}|\$([a-zA-Z_][\w-]*)\b/g,
      (match, doubleBraceKey, braceKey, dollarKey) => {
        const label = doubleBraceKey ?? braceKey ?? dollarKey;

        return getVariableValue(label, variables) ?? match;
      },
    );
}

function interpolateThemeSections(
  sections: ThemeSection[],
  variables: ContentVariables,
): ThemeSection[] {
  return sections.map((section) => ({
    title: interpolateVariables(section.title, variables),
    text: interpolateVariables(section.text, variables),
  }));
}

function getThemeTitle(theme: string, sections: ThemeSection[]) {
  const normalizedTheme = normalizeLabel(theme);
  const matchingSection = sections.find((section) => {
    const normalizedTitle = normalizeLabel(section.title);

    return (
      normalizedTitle === normalizedTheme ||
      normalizedTitle.endsWith(` ${normalizedTheme}`)
    );
  });

  return matchingSection?.title ?? theme;
}

function getDisplaySections(theme: string, sections: ThemeSection[]) {
  const normalizedTheme = normalizeLabel(theme);

  return sections.filter((section) => {
    const normalizedTitle = normalizeLabel(section.title);

    return (
      normalizedTitle !== normalizedTheme &&
      !normalizedTitle.endsWith(` ${normalizedTheme}`)
    );
  });
}

function parseAndInterpolateSections(
  theme: string,
  text: string,
  variables: ContentVariables,
) {
  const sections = interpolateThemeSections(parseThemeSections(text), variables);
  const documentTitle = getDocumentTitle(text);

  return {
    title: documentTitle
      ? interpolateVariables(documentTitle, variables)
      : getThemeTitle(theme, sections),
    sections: getDisplaySections(theme, sections),
  };
}

function getSelectedThemes({ themes }: GetDocTemplateInput) {
  return themes ?? [];
}

function getDefaultDocsUrl() {
  const configuredUrl = process.env.DOCS_DEFAULT;

  if (!configuredUrl) {
    throw new Error("Invalid DOCS_DEFAULT URL");
  }

  const googleDocumentMatch = /^https:\/\/docs\.google\.com\/document\/d\/([^/?#]+)/u.exec(configuredUrl);
  if (googleDocumentMatch) {
    return `https://docs.google.com/document/d/${googleDocumentMatch[1]}/export?format=txt`;
  }

  return configuredUrl;
}

async function fetchDefaultDocsText() {
  const docsUrl = getDefaultDocsUrl();
  const now = Date.now();
  const cached = docsTextCache.get("DOCS_DEFAULT");

  if (cached?.url === docsUrl && cached.text !== undefined && cached.expiresAt > now) {
    return cached.text;
  }

  if (cached?.url === docsUrl && cached.refresh) return cached.refresh;

  const staleText = cached?.url === docsUrl ? cached.text : undefined;
  const refresh = (async () => {
    try {
      const response = await fetch(docsUrl, { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Não foi possível carregar DOCS_DEFAULT");
      }

      const text = await response.text();
      docsTextCache.set("DOCS_DEFAULT", {
        url: docsUrl,
        text,
        expiresAt: Date.now() + DOCS_CACHE_TTL_MS,
      });
      return text;
    } catch (error) {
      if (staleText !== undefined) {
        docsTextCache.set("DOCS_DEFAULT", { url: docsUrl, text: staleText, expiresAt: 0 });
        console.warn("[municipalReportDocs] Falha ao atualizar DOCS_DEFAULT; usando versão em cache.", error);
        return staleText;
      }
      docsTextCache.delete("DOCS_DEFAULT");
      throw error;
    }
  })();

  docsTextCache.set("DOCS_DEFAULT", {
    url: docsUrl,
    text: staleText,
    expiresAt: cached?.expiresAt ?? 0,
    refresh,
  });

  return refresh;
}

function extractTemplateBlock(text: string, block: string) {
  const lines: string[] = [];
  let activeBlock: string | null = null;

  const documentLines = text.split(/\r?\n/);

  for (const [index, line] of documentLines.entries()) {
    if (/^\s*(?:\[report\]|\[layer:\s*[^\]]+\])\s*$/iu.test(documentLines[index + 1] ?? "")) {
      continue;
    }

    const layerBlock = /^\s*\[layer:\s*([^\]]+)\]\s*$/iu.exec(line)?.[1].trim();
    const headingBlock = /^\s*\[report\]\s*$/iu.test(line)
      ? MUNICIPAL_REPORT_DOCS_REPORT_KEY
      : layerBlock;

    if (headingBlock) {
      activeBlock = headingBlock;
      continue;
    }

    if (activeBlock === block) lines.push(line);
  }

  return lines.join("\n").trim();
}

export function clearDocTemplateCache() {
  docsTextCache.clear();
}

export async function getDocTemplate(
  props: GetDocTemplateInput,
): Promise<DocsContent> {
  const selectedThemes = getSelectedThemes(props);

  if (selectedThemes.length === 0) {
    throw new Error("Nenhum tema foi informado");
  }

  const variables = {
    city: props.city,
    state: props.state,
    month: props.month === undefined ? undefined : String(props.month),
    year: props.year === undefined ? undefined : String(props.year),
  };

  const documentText = await fetchDefaultDocsText();
  const reportText = extractTemplateBlock(documentText, MUNICIPAL_REPORT_DOCS_REPORT_KEY);
  const reportEntry = reportText
    ? [[MUNICIPAL_REPORT_DOCS_REPORT_KEY, parseAndInterpolateSections(MUNICIPAL_REPORT_DOCS_REPORT_KEY, reportText, variables).sections] as const]
    : [];
  const entries = selectedThemes.flatMap((theme) => {
    const themeText = extractTemplateBlock(documentText, theme);
    if (!themeText) {
      console.warn(`[municipalReportDocs] Seção ${theme} não encontrada em DOCS_DEFAULT.`);
      return [];
    }

    const parsedTheme = parseAndInterpolateSections(theme, themeText, variables);
    return [[theme, parsedTheme.sections] as const];
  });

  if (entries.length === 0) {
    throw new Error("Nenhum template do Google Docs pôde ser carregado");
  }

  return Object.fromEntries([...reportEntry, ...entries]);
}
