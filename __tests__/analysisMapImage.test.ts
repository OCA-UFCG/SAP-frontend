import { describe, expect, it, vi } from "vitest";
import { CLASSIFICATION_COLORS } from "@/components/Map/classificationLayers";
import {
  buildAnalysisImageOverlay,
  buildLegendEntries,
  composeAnalysisMapImage,
  paintAnalysisImageOverlay,
  type CanvasLike,
  type Context2DLike,
  type DrawImageCapable,
} from "@/components/Amfe/analysisMapImage";

const LABELS = ["Muito baixa", "Baixa", "Média", "Alta", "Muito alta"];
const ENTRIES = buildLegendEntries(LABELS);
const ATTRIBUTION = "© OpenStreetMap contributors";

const overlayFor = (width: number, height: number, scale = 1) =>
  buildAnalysisImageOverlay({
    width,
    height,
    title: "Nível de prioridade",
    entries: ENTRIES,
    attribution: ATTRIBUTION,
    scale,
  });

class FakeContext implements Context2DLike, DrawImageCapable {
  fillStyle = "";
  strokeStyle = "";
  lineWidth = 0;
  font = "";
  textBaseline = "";

  readonly calls: string[] = [];
  readonly filledRects: Array<{ style: string; rect: number[] }> = [];
  readonly texts: Array<{ text: string; x: number; y: number }> = [];
  readonly drawnImages: Array<{ x: number; y: number }> = [];

  fillRect(x: number, y: number, width: number, height: number) {
    this.calls.push("fillRect");
    this.filledRects.push({ style: this.fillStyle, rect: [x, y, width, height] });
  }

  strokeRect() {
    this.calls.push("strokeRect");
  }

  fillText(text: string, x: number, y: number) {
    this.calls.push("fillText");
    this.texts.push({ text, x, y });
  }

  drawImage(_image: unknown, x: number, y: number) {
    this.calls.push("drawImage");
    this.drawnImages.push({ x, y });
  }
}

describe("buildLegendEntries", () => {
  it("reads from the highest priority down, like the on-screen legend", () => {
    expect(ENTRIES.map((entry) => entry.label)).toEqual([
      "Muito alta",
      "Alta",
      "Média",
      "Baixa",
      "Muito baixa",
    ]);
    expect(ENTRIES[0].color).toBe(CLASSIFICATION_COLORS[4]);
    expect(ENTRIES.at(-1)?.color).toBe(CLASSIFICATION_COLORS[0]);
  });
});

describe("buildAnalysisImageOverlay", () => {
  it("keeps the legend inside the image", () => {
    const legend = overlayFor(1200, 900).legend;
    if (!legend) throw new Error("expected a legend");
    const { panel, entries, title } = legend;

    expect(panel.x).toBeGreaterThan(0);
    expect(panel.y).toBeGreaterThan(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(1200);
    expect(panel.y + panel.height).toBeLessThanOrEqual(900);

    for (const entry of entries) {
      expect(entry.swatch.x).toBeGreaterThanOrEqual(panel.x);
      expect(entry.swatch.y).toBeGreaterThanOrEqual(panel.y);
      expect(entry.label.x + entry.label.fontSize).toBeLessThanOrEqual(
        panel.x + panel.width,
      );
      expect(
        entry.swatch.y + entry.swatch.height,
      ).toBeLessThanOrEqual(panel.y + panel.height);
    }

    expect(title.y).toBeGreaterThanOrEqual(panel.y);
    expect(entries[0].swatch.y).toBeGreaterThan(title.y);
  });

  it("stacks the rows without overlap", () => {
    const entries = overlayFor(1200, 900).legend?.entries ?? [];

    for (let index = 1; index < entries.length; index += 1) {
      const previous = entries[index - 1].swatch;
      expect(entries[index].swatch.y).toBeGreaterThanOrEqual(
        previous.y + previous.height,
      );
    }
  });

  it("grows with the capture scale so the legend stays legible", () => {
    const single = overlayFor(1200, 900, 1).legend;
    const double = overlayFor(2400, 1800, 2).legend;
    if (!single || !double) throw new Error("expected a legend");

    expect(double.panel.width).toBeCloseTo(single.panel.width * 2, 5);
    expect(double.panel.height).toBeCloseTo(single.panel.height * 2, 5);
    expect(double.title.fontSize).toBe(single.title.fontSize * 2);
  });

  it("anchors the attribution to the opposite corner of the legend", () => {
    const { legend, attribution } = overlayFor(1200, 900);

    expect(attribution.x).toBeLessThan(legend!.panel.x);
    expect(attribution.backdrop.y + attribution.backdrop.height).toBeLessThanOrEqual(
      900,
    );
  });

  it("drops the legend when there is no analysis in the image", () => {
    const overlay = buildAnalysisImageOverlay({
      width: 1200,
      height: 900,
      title: "Nível de prioridade",
      entries: [],
      attribution: ATTRIBUTION,
    });

    expect(overlay.legend).toBeNull();
    expect(overlay.attribution.text).toBe(ATTRIBUTION);
  });
});

describe("paintAnalysisImageOverlay", () => {
  it("paints the panel before the swatches and labels", () => {
    const context = new FakeContext();

    paintAnalysisImageOverlay(context, overlayFor(1200, 900));

    expect(context.calls[0]).toBe("fillRect");
    expect(context.calls).toContain("strokeRect");
    expect(context.texts.map((entry) => entry.text)).toEqual([
      "Nível de prioridade",
      "Muito alta",
      "Alta",
      "Média",
      "Baixa",
      "Muito baixa",
      ATTRIBUTION,
    ]);
  });

  it("uses each priority colour for its swatch", () => {
    const context = new FakeContext();

    paintAnalysisImageOverlay(context, overlayFor(1200, 900));

    const swatchStyles = context.filledRects
      .map((entry) => entry.style)
      .filter((style) => style.startsWith("#"));

    expect(swatchStyles).toEqual([...CLASSIFICATION_COLORS].reverse());
  });

  it("paints only the attribution when there is no legend", () => {
    const context = new FakeContext();

    paintAnalysisImageOverlay(context, {
      legend: null,
      attribution: overlayFor(1200, 900).attribution,
    });

    expect(context.texts.map((entry) => entry.text)).toEqual([ATTRIBUTION]);
    expect(context.calls).not.toContain("strokeRect");
  });
});

describe("composeAnalysisMapImage", () => {
  const buildCanvas = (context: FakeContext | null) =>
    ({
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toDataURL: vi.fn(() => "data:image/png;base64,composed"),
    }) as unknown as CanvasLike & { toDataURL: ReturnType<typeof vi.fn> };

  it("draws the captured map and returns the composed png", () => {
    const context = new FakeContext();
    const canvas = buildCanvas(context);

    const dataUrl = composeAnalysisMapImage(
      canvas,
      { width: 2400, height: 1800 },
      { title: "Nível de prioridade", entries: ENTRIES, attribution: ATTRIBUTION, scale: 2 },
    );

    expect(canvas.width).toBe(2400);
    expect(canvas.height).toBe(1800);
    expect(context.calls[0]).toBe("drawImage");
    expect(context.drawnImages).toEqual([{ x: 0, y: 0 }]);
    expect(dataUrl).toBe("data:image/png;base64,composed");
  });

  it("gives up when the browser denies a 2d context", () => {
    const canvas = buildCanvas(null);

    const dataUrl = composeAnalysisMapImage(
      canvas,
      { width: 100, height: 100 },
      { title: "t", entries: ENTRIES, attribution: ATTRIBUTION },
    );

    expect(dataUrl).toBeNull();
    expect(canvas.toDataURL).not.toHaveBeenCalled();
  });
});
