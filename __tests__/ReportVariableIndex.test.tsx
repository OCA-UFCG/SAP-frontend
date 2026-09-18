import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { ReportVariableIndex } from "@/components/MunicipalReport/ReportVariableIndex";
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

function renderIndex(analyses: MunicipalReportAnalysis[]) {
  return render(
    <ReportVariableIndex
      analyses={analyses}
      translateTitle={(item) => item.title}
    />,
  );
}

describe("ReportVariableIndex", () => {
  it("monta uma coluna por categoria presente, e nenhuma vazia", () => {
    const { container } = renderIndex([
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
    const { container } = renderIndex([
      analysis("seca", "Monitor de seca | ANA", "Dados Climáticos"),
    ]);

    expect(
      within(container).getByRole("link").getAttribute("href"),
    ).toBe("#report-analysis-seca");
  });

  it("mostra o período efetivo na pílula, aceitando mensal e anual lado a lado", () => {
    const { container } = renderIndex([
      analysis("seca", "Monitor de seca | ANA", "Dados Climáticos"),
      analysis("aridez", "Índice de Aridez", "Dados Climáticos", "2020"),
    ]);
    const scope = within(container);

    expect(scope.getByText("05/2026")).toBeTruthy();
    expect(scope.getByText("2020")).toBeTruthy();
  });

  it("não renderiza nada sem análises", () => {
    const { container } = renderIndex([]);

    expect(container.querySelector(".report-variable-index")).toBeNull();
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
  Object.defineProperty(viewport, "scrollHeight", { value: 2000, configurable: true });
  Object.defineProperty(viewport, "clientHeight", { value: 600, configurable: true });
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
    <ReportVariableIndex
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

describe("ReportVariableIndex — rolagem até a seção", () => {
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
