import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ptModules from "@/translations/pt/ModulesContext.json";
import {
  clearMunicipalLayerSummaryCache,
  MunicipalLayerSummary,
} from "@/components/MunicipalLayerSummary/MunicipalLayerSummary";
import type { PanelLayerI } from "@/utils/interfaces";

type Messages = Record<string, unknown>;

function lookup(messages: Messages, path: string): string | undefined {
  const value = path
    .split(".")
    .reduce<unknown>(
      (current, part) => (current as Messages | undefined)?.[part],
      messages,
    );
  return typeof value === "string" ? value : undefined;
}

/** O mock global de `next-intl` não tem `rich`; este troca `<b>` pelo elemento. */
function fakeTranslations(namespace: string) {
  const messages = (namespace === "ModulesContext"
    ? ptModules
    : {}) as unknown as Messages;
  const fill = (text: string, values?: Record<string, unknown>) =>
    text.replace(/\{(\w+)\}/g, (_, name) => String(values?.[name]));
  const t = (key: string, values?: Record<string, unknown>) =>
    fill(lookup(messages, `${namespace}.${key}`) ?? key, values);
  t.has = (key: string) => lookup(messages, `${namespace}.${key}`) !== undefined;
  t.rich = (
    key: string,
    values: Record<string, string | ((chunks: ReactNode) => ReactNode)>,
  ) =>
    (lookup(messages, `${namespace}.${key}`) ?? key)
      .split(/(<\w+>.*?<\/\w+>)/)
      .map((part, index) => {
        const tag = part.match(/^<(\w+)>(.*)<\/\w+>$/);
        if (!tag) return fill(part, values);
        const render = values[tag[1]] as (chunks: ReactNode) => ReactNode;
        return <span key={index}>{render(fill(tag[2], values))}</span>;
      });
  return t;
}

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => fakeTranslations(namespace),
  useLocale: () => "pt",
}));

const CDI_CLASSES = [
  { id: "classe-0", color: "#FFFFFF", label: "Sem seca", pixelLimit: 0 },
  { id: "classe-1", color: "#FFFF00", label: "Estágio 1", pixelLimit: 1 },
  { id: "classe-2", color: "#FFA500", label: "Estágio 2", pixelLimit: 2 },
  { id: "classe-3", color: "#FF0000", label: "Estágio 3", pixelLimit: 3 },
];

function compact(values: Record<string, number[]>, extra: object = {}) {
  return {
    type: "territorial-compact",
    schemaVersion: 1,
    defaultYear: "2026-09-21",
    mapVisualization: {
      min: 0,
      max: 3,
      band: "CDI",
      sourceBand: "CDI",
      sourceType: "imageCollection",
      legend: CDI_CLASSES,
      palette: CDI_CLASSES.map((item) => item.color),
    },
    classes: CDI_CLASSES,
    valueConfig: { type: "percentage", unit: "%" },
    locations: { "2504009": "Campina Grande - PB" },
    years: {
      "2026-09-21": { imageId: "cdi", valuesScale: 1, values },
    },
    ...extra,
  };
}

// Um produto que não está no índice de disponibilidade: sempre pergunta à rota.
const cdiLayer = {
  id: "teste-cdi",
  name: "CDI de teste",
  imageData: compact({}),
} as unknown as PanelLayerI;

const fetchMock = vi.fn();

function respondWith(imageData: unknown) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ imageData }),
  });
}

function renderSummary(
  props: Partial<Parameters<typeof MunicipalLayerSummary>[0]> = {},
) {
  const onOpenDetails = vi.fn();
  render(
    <MunicipalLayerSummary
      layer={cdiLayer}
      municipalityCode="2504009"
      activeYear=""
      expanded={false}
      enabled
      onOpenDetails={onOpenDetails}
      {...props}
    />,
  );
  return { onOpenDetails };
}

beforeEach(() => {
  clearMunicipalLayerSummaryCache();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MunicipalLayerSummary", () => {
  it("says which class predominates in the municipality", async () => {
    respondWith(compact({ "2504009": [13.93, 69.886, 0, 16.19] }));

    renderSummary();

    expect(await screen.findByText("Estágio 1")).toBeVisible();
    expect(screen.getByText(/Predomina/).parentElement).toHaveTextContent(
      "Predomina Estágio 1 (69,89%)",
    );
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe("/api/municipal-analysis/teste-cdi");
    expect(url.searchParams.get("year")).toBe("2026-09-21");
    expect(url.searchParams.get("locationKey")).toBe("2504009");
  });

  it("opened, shows the period, every class and the way to the Detalhamento", async () => {
    const user = userEvent.setup();
    respondWith(compact({ "2504009": [13.93, 69.886, 0, 16.19] }));

    const { onOpenDetails } = renderSummary({ expanded: true });

    expect(
      await screen.findByText("21 a 30 de setembro de 2026"),
    ).toBeVisible();
    expect(screen.getByText(/^Sem seca:/)).toHaveTextContent("Sem seca: 13,93%");
    // Classe com 0% não entra na lista.
    expect(screen.queryByText(/^Estágio 2:/)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Ver gráficos e histórico no Detalhamento",
      }),
    );
    expect(onOpenDetails).toHaveBeenCalled();
  });

  it("shows the number itself when the product has a single value", async () => {
    // O formato da rota para a pobreza do CadÚnico: um valor por município.
    const poverty = (values: Record<string, number[]>) => ({
      type: "territorial-compact",
      schemaVersion: 1,
      defaultYear: "2025",
      classes: [{ id: "pobreza", color: "#BD0026", label: "Famílias em pobreza" }],
      valueConfig: { type: "percentage", unit: "%" },
      locations: { "2504009": "Campina Grande - PB" },
      years: { "2025": { valuesScale: 1, values } },
      mapVisualization: {
        min: 0,
        max: 1,
        sourceType: "municipalChoropleth",
        thresholds: [50],
        palette: ["#AFE4B5", "#AD0011"],
        legend: [
          { id: "faixa-1", color: "#AFE4B5", label: "< 50%", pixelLimit: 0 },
          { id: "faixa-2", color: "#AD0011", label: "> 50%", pixelLimit: 1 },
        ],
      },
    });
    respondWith(poverty({ "2504009": [36.8704] }));

    renderSummary({
      layer: { ...cdiLayer, id: "teste-pobreza", imageData: poverty({}) } as unknown as PanelLayerI,
    });

    await waitFor(() =>
      expect(screen.getByText(/No município/)).toHaveTextContent(
        "No município: 36,87%",
      ),
    );
  });

  it("does not ask the server while the category is closed", () => {
    respondWith(compact({ "2504009": [100, 0, 0, 0] }));

    renderSummary({ enabled: false });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Carregando a situação do município")).toBeInTheDocument();
  });

  it("says there is no data when the request fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 });

    renderSummary();

    expect(
      await screen.findByText("Sem dado deste produto para o município."),
    ).toBeVisible();
  });
});
