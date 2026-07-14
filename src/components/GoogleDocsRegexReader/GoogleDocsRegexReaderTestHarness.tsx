import { buildDocContent } from "@/services/buildDoc/buildDocContent";
import type { DocsContent } from "@/services/buildDoc/buildDocTemplate";

const TEST_THEMES = ["DROUGHT_MONITOR"];

export async function GoogleDocsRegexReaderTestHarness() {
  let content: DocsContent;

  try {
    content = await buildDocContent({
      themes: TEST_THEMES,
      city: "Campina Grande",
      state: "Paraíba",
      month: "01",
      year: 2024,
      ibgeId: "2504009",
      period: "2024-01",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao montar documento";

    return <p>{message}</p>;
  }

  return <DocContentPreview content={content} />;
}

function DocContentPreview({ content }: { content: DocsContent }) {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      {Object.entries(content).map(([theme, sections]) => (
        <section key={theme} className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{theme}</h1>

          {sections.map((section) => (
            <article key={`${theme}-${section.title}`}>
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="whitespace-pre-line">{section.text}</p>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
