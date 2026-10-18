import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { ReportSummary } from "@/components/MunicipalReport/ReportSummary";
import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";

function analysis(
  alias: string,
  title: string,
  category?: string,
  effectivePeriod: string | null = "2026-05",
): MunicipalReportAnalysis {
  return {
    id: alias,
    alias,
    title,
    unit: "%",
    valueType: "percentage",
    status: "available",
    requestedPeriod: "2026",
    effectivePeriod,
    classes: [],
    snapshot: null,
    timeSeries: [],
    ...(category ? { category } : {}),
  };
}

function renderSummary(
  analyses: MunicipalReportAnalysis[],
  pages?: ReadonlyMap<string, number> | null,
) {
  return render(
    <ReportSummary
      analyses={analyses}
      translateTitle={(item) => item.title}
      pages={pages}
    />,
  );
}

describe("ReportSummary", () => {
  it("monta um bloco por categoria presente, e nenhum vazio", () => {
    const { container } = renderSummary([
      analysis("seca", "Monitor de seca | ANA", "Dados Climáticos"),
      analysis("pobreza", "Percentual de pobreza", "Dados Socioeconômicos"),
    ]);
    const scope = within(container);

    expect(
      scope.getByRole("heading", { name: "Dados Climáticos" }),
    ).toBeTruthy();
    expect(
      scope.getByRole("heading", { name: "Dados Socioeconômicos" }),
    ).toBeTruthy();
    expect(
      scope.queryByRole("heading", { name: "Dados Ambientais" }),
    ).toBeNull();
  });

  it("aponta cada item para a âncora da seção", () => {
    const { container } = renderSummary([
      analysis("seca", "Monitor de seca | ANA", "Dados Climáticos"),
    ]);

    expect(within(container).getByRole("link").getAttribute("href")).toBe(
      "#report-analysis-seca",
    );
  });

  it("mostra a página de cada seção quando a medição chega", () => {
    const analyses = [
      analysis("seca", "Monitor de seca | ANA", "Dados Climáticos"),
      analysis("aridez", "Índice de Aridez", "Dados Climáticos"),
    ];
    const { container, rerender } = renderSummary(analyses, null);
    const links = within(container).getAllByRole("link");

    expect(links.map((link) => link.lastElementChild?.textContent)).toEqual([
      "",
      "",
    ]);

    rerender(
      <ReportSummary
        analyses={analyses}
        translateTitle={(item) => item.title}
        pages={
          new Map([
            ["report-analysis-seca", 3],
            ["report-analysis-aridez", 5],
          ])
        }
      />,
    );

    expect(links.map((link) => link.lastElementChild?.textContent)).toEqual([
      "3",
      "5",
    ]);
  });

  it("deixa os climáticos à esquerda e empilha as outras categorias à direita", () => {
    const { container } = renderSummary([
      analysis("seca", "Monitor de seca | ANA", "Dados Climáticos"),
      analysis("cdi", "Índice Composto de Seca", "Dados Climáticos"),
      analysis("solo", "Carbono Orgânico do Solo", "Dados Ambientais"),
      analysis("pib", "Produto Interno Bruto", "Dados Socioeconômicos"),
    ]);
    const columns = [
      ...(container.querySelector(".report-summary > div")?.children ?? []),
    ];

    expect(
      columns.map((column) =>
        [...column.querySelectorAll("h3")].map(
          (heading) => heading.textContent,
        ),
      ),
    ).toEqual([
      ["Dados Climáticos"],
      ["Dados Ambientais", "Dados Socioeconômicos"],
    ]);
  });

  it("fica sempre aberto, com o título Sumário", () => {
    const { container } = renderSummary([
      analysis("seca", "Monitor de seca | ANA", "Dados Climáticos"),
    ]);

    expect(
      within(container).getByRole("heading", { name: "Sumário" }),
    ).toBeTruthy();
    expect(within(container).queryByRole("button")).toBeNull();
  });

  it("não renderiza nada sem análises", () => {
    const { container } = renderSummary([]);

    expect(container.querySelector(".report-summary")).toBeNull();
  });
});

function stubRect(element: HTMLElement, top: number, height: number) {
  element.getBoundingClientRect = () =>
    ({
      top,
      bottom: top + height,
      height,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: top,
      toJSON: () => ({}),
    }) as DOMRect;
}

/**
 * Reproduz a prévia embutida: um `article` rolável dentro da aba Comunicação,
 * com a barra "voltar ao topo" grudada no alto e as seções logo abaixo.
 */
function renderEmbeddedReport({
  scrollable = true,
  stickyHeight = 0,
}: { scrollable?: boolean; stickyHeight?: number } = {}) {
  const viewport = document.createElement("div");
  viewport.style.overflowY = scrollable ? "auto" : "visible";
  Object.defineProperty(viewport, "scrollHeight", {
    value: 2000,
    configurable: true,
  });
  Object.defineProperty(viewport, "clientHeight", {
    value: 600,
    configurable: true,
  });
  viewport.scrollTop = 0;
  stubRect(viewport, 100, 600);
  document.body.appendChild(viewport);

  if (stickyHeight > 0) {
    const sticky = document.createElement("div");
    sticky.className = "report-back-to-top";
    stubRect(sticky, 100, stickyHeight);
    viewport.appendChild(sticky);
  }

  const mount = document.createElement("div");
  viewport.appendChild(mount);

  const section = document.createElement("section");
  section.id = "report-analysis-seca";
  stubRect(section, 900, 400);
  viewport.appendChild(section);

  const view = render(
    <ReportSummary
      analyses={[analysis("seca", "Monitor de seca | ANA", "Dados Climáticos")]}
      translateTitle={(item) => item.title}
    />,
    { container: mount },
  );

  return { link: within(mount).getByRole("link"), viewport, view };
}

const pendingFrames: FrameRequestCallback[] = [];

function stubAnimationFrames() {
  pendingFrames.length = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    pendingFrames.push(callback);
    return pendingFrames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    pendingFrames.length = 0;
  });
}

function runFrame(timestamp: number) {
  const frame = pendingFrames.shift();
  frame?.(timestamp);
}

describe("ReportSummary — rolagem até a seção", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("rola só o documento do relatório, sem deixar a página levar o rodapé junto", () => {
    stubAnimationFrames();
    const { link, viewport } = renderEmbeddedReport();

    const clicked = fireEvent.click(link);

    // `false` significa que o `preventDefault` correu: a navegação nativa por
    // âncora arrastaria também a janela, mostrando o rodapé da plataforma.
    expect(clicked).toBe(false);

    runFrame(0);
    runFrame(5000);

    expect(viewport.scrollTop).toBe(800);
  });

  it("anima a rolagem em vez de saltar até a seção", () => {
    stubAnimationFrames();
    const { link, viewport } = renderEmbeddedReport();

    fireEvent.click(link);

    runFrame(0);
    expect(viewport.scrollTop).toBe(0);

    runFrame(250);
    const halfway = viewport.scrollTop;
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(800);

    runFrame(400);
    expect(viewport.scrollTop).toBeGreaterThan(halfway);
    expect(viewport.scrollTop).toBeLessThan(800);
  });

  it("solta a rolagem assim que a pessoa usa a roda do mouse", () => {
    stubAnimationFrames();
    const { link, viewport } = renderEmbeddedReport();

    fireEvent.click(link);
    runFrame(0);
    runFrame(250);
    const interrupted = viewport.scrollTop;

    fireEvent.wheel(viewport);
    runFrame(5000);

    expect(viewport.scrollTop).toBe(interrupted);
  });

  it("desconta a barra grudada de voltar ao topo", () => {
    stubAnimationFrames();
    const { link, viewport } = renderEmbeddedReport({ stickyHeight: 44 });

    fireEvent.click(link);
    runFrame(0);
    runFrame(5000);

    expect(viewport.scrollTop).toBe(756);
  });

  it("deixa a âncora nativa agir na página autônoma, que rola na janela", () => {
    stubAnimationFrames();
    const { link, viewport } = renderEmbeddedReport({ scrollable: false });

    const clicked = fireEvent.click(link);

    expect(clicked).toBe(true);
    expect(pendingFrames).toHaveLength(0);
    expect(viewport.scrollTop).toBe(0);
  });
});
