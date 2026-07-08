"use client";

import { useState } from "react";

type ThemeSection = {
  title: string;
  text: string;
};

type DocsContent = Record<string, ThemeSection[]>;

type GoogleDocsRegexReaderProps = {
  themes?: string[];
  thems?: string[];
  city?: string;
  state?: string;
  month?: string | number;
  year?: string | number;
};

type DocsThemeResponse = {
  text?: string;
  error?: string;
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

const IGNORED_GROUP_HEADINGS = new Set(["analise da serie historica"]);

function parseSectionHeader(line: string) {
  const headerMatch = line.trim().match(/^\*(.+?)\*\s*:?\s*(.*)$/);

  if (!headerMatch) {
    return null;
  }

  return {
    title: headerMatch[1].trim(),
    text: headerMatch[2].trim(),
  };
}

function parseThemeSections(text: string): ThemeSection[] {
  const sections: Array<{ title: string; lines: string[] }> = [];
  let currentSection: { title: string; lines: string[] } | null = null;

  for (const line of text.split(/\r?\n/)) {
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

    if (!currentSection || IGNORED_GROUP_HEADINGS.has(normalizeLabel(line))) {
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

function getMonthYear(variables: ContentVariables) {
  if (variables.month && variables.year) {
    return `${variables.month}/${variables.year}`;
  }

  return variables.month ?? variables.year;
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
    "month year": getMonthYear(variables),
    "mes ano": getMonthYear(variables),
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

function getSelectedThemes({ themes, thems }: GoogleDocsRegexReaderProps) {
  return themes ?? thems ?? [];
}

function buildThemeRequestUrl(theme: string) {
  return `/api/docs/${theme}`;
}

export function GoogleDocsRegexReader(props: GoogleDocsRegexReaderProps) {
  const [content, setContent] = useState<DocsContent>({});
  const [themeTitles, setThemeTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    const selectedThemes = getSelectedThemes(props);

    setLoading(true);
    setError(null);
    setContent({});
    setThemeTitles({});

    try {
      if (selectedThemes.length === 0) {
        setError("Nenhum tema foi informado");
        return;
      }

      const variables = {
        city: props.city,
        state: props.state,
        month: props.month === undefined ? undefined : String(props.month),
        year: props.year === undefined ? undefined : String(props.year),
      };
      const entries = await Promise.all(
        selectedThemes.map(async (theme) => {
          const response = await fetch(buildThemeRequestUrl(theme));
          const contentType = response.headers.get("content-type");
          const data: DocsThemeResponse | null = contentType?.includes(
            "application/json",
          )
            ? await response.json()
            : null;

          if (!response.ok || !data?.text) {
            const message =
              data?.error ?? `Não foi possível buscar o documento: ${theme}`;
            throw new Error(message);
          }

          const parsedTheme = parseAndInterpolateSections(
            theme,
            data.text,
            variables,
          );

          return [theme, parsedTheme] as const;
        }),
      );

      setContent(
        Object.fromEntries(
          entries.map(([theme, parsedTheme]) => [theme, parsedTheme.sections]),
        ),
      );
      setThemeTitles(
        Object.fromEntries(
          entries.map(([theme, parsedTheme]) => [theme, parsedTheme.title]),
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro inesperado na busca";

      setError(message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handleSearch} disabled={loading}>
        {loading ? "Buscando..." : "Buscar textos"}
      </button>

      {error && <p>{error}</p>}

      {Object.entries(content).map(([theme, sections]) => (
        <section key={theme}>
          <h2>{themeTitles[theme] ?? theme}</h2>

          {sections.map((section) => (
            <article key={`${theme}-${section.title}`}>
              <h3>{section.title}</h3>
              <p>{section.text}</p>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
