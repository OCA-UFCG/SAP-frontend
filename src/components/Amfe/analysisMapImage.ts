import { CLASSIFICATION_COLORS } from "@/components/Map/classificationLayers";

export interface LegendEntry {
  color: string;
  label: string;
}

export interface OverlayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverlayText {
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

export interface AnalysisImageLegend {
  panel: OverlayRect;
  title: OverlayText;
  entries: { swatch: OverlayRect; label: OverlayText; color: string }[];
}

export interface AnalysisImageOverlay {
  legend: AnalysisImageLegend | null;
  attribution: OverlayText & { padding: number; backdrop: OverlayRect };
}

export interface BuildOverlayOptions {
  width: number;
  height: number;
  title: string;
  entries: readonly LegendEntry[];
  attribution: string;
  scale?: number;
}

const BASE_MARGIN = 16;
const BASE_PADDING = 12;
const BASE_SWATCH = 16;
const BASE_GAP = 6;
const BASE_TITLE_SIZE = 13;
const BASE_LABEL_SIZE = 12;
const BASE_ATTRIBUTION_SIZE = 11;
const LABEL_WIDTH_RATIO = 0.62;

export const buildLegendEntries = (
  labels: readonly string[],
): LegendEntry[] =>
  CLASSIFICATION_COLORS.map((color, level) => ({
    color,
    label: labels[level] ?? "",
  })).reverse();

export const buildAnalysisImageOverlay = ({
  width,
  height,
  title,
  entries,
  attribution,
  scale = 1,
}: BuildOverlayOptions): AnalysisImageOverlay => {
  const margin = BASE_MARGIN * scale;
  const padding = BASE_PADDING * scale;
  const swatch = BASE_SWATCH * scale;
  const gap = BASE_GAP * scale;
  const titleSize = BASE_TITLE_SIZE * scale;
  const labelSize = BASE_LABEL_SIZE * scale;
  const attributionSize = BASE_ATTRIBUTION_SIZE * scale;

  const buildLegend = (): AnalysisImageLegend | null => {
    if (entries.length === 0) return null;

    const rowHeight = Math.max(swatch, labelSize);
    const longestLabel = entries.reduce(
      (longest, entry) => Math.max(longest, entry.label.length),
      0,
    );
    const panelWidth =
      padding * 2 +
      Math.max(
        title.length * titleSize * LABEL_WIDTH_RATIO,
        swatch + gap + longestLabel * labelSize * LABEL_WIDTH_RATIO,
      );
    const panelHeight =
      padding * 2 +
      titleSize +
      gap +
      entries.length * rowHeight +
      Math.max(0, entries.length - 1) * gap;

    const panel: OverlayRect = {
      x: width - margin - panelWidth,
      y: height - margin - panelHeight,
      width: panelWidth,
      height: panelHeight,
    };

    const firstRowY = panel.y + padding + titleSize + gap;

    return {
      panel,
      title: {
        text: title,
        x: panel.x + padding,
        y: panel.y + padding,
        fontSize: titleSize,
      },
      entries: entries.map((entry, index) => {
        const rowY = firstRowY + index * (rowHeight + gap);

        return {
          color: entry.color,
          swatch: {
            x: panel.x + padding,
            y: rowY + (rowHeight - swatch) / 2,
            width: swatch,
            height: swatch,
          },
          label: {
            text: entry.label,
            x: panel.x + padding + swatch + gap,
            y: rowY + (rowHeight - labelSize) / 2,
            fontSize: labelSize,
          },
        };
      }),
    };
  };

  return {
    legend: buildLegend(),
    attribution: {
      text: attribution,
      x: margin + padding / 2,
      y: height - margin - attributionSize,
      fontSize: attributionSize,
      padding: padding / 2,
      backdrop: {
        x: margin,
        y: height - margin - attributionSize - padding / 2,
        width: attribution.length * attributionSize * LABEL_WIDTH_RATIO + padding,
        height: attributionSize + padding,
      },
    },
  };
};

export interface Context2DLike {
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textBaseline: string;
  fillRect(x: number, y: number, width: number, height: number): void;
  strokeRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
}

const PANEL_BACKGROUND = "rgba(255, 255, 255, 0.9)";
const PANEL_BORDER = "#99a1af";
const TEXT_COLOR = "#364153";
const FONT_FAMILY = "sans-serif";

const roundedFont = (size: number, weight = "normal") =>
  `${weight} ${Math.round(size)}px ${FONT_FAMILY}`;

const paintLegend = (context: Context2DLike, legend: AnalysisImageLegend) => {
  const { panel, title, entries } = legend;

  context.fillStyle = PANEL_BACKGROUND;
  context.fillRect(panel.x, panel.y, panel.width, panel.height);

  context.fillStyle = TEXT_COLOR;
  context.font = roundedFont(title.fontSize, "bold");
  context.fillText(title.text, title.x, title.y);

  for (const entry of entries) {
    context.fillStyle = entry.color;
    context.fillRect(
      entry.swatch.x,
      entry.swatch.y,
      entry.swatch.width,
      entry.swatch.height,
    );

    context.strokeStyle = PANEL_BORDER;
    context.lineWidth = Math.max(1, entry.swatch.width / 16);
    context.strokeRect(
      entry.swatch.x,
      entry.swatch.y,
      entry.swatch.width,
      entry.swatch.height,
    );

    context.fillStyle = TEXT_COLOR;
    context.font = roundedFont(entry.label.fontSize);
    context.fillText(entry.label.text, entry.label.x, entry.label.y);
  }
};

export const paintAnalysisImageOverlay = (
  context: Context2DLike,
  overlay: AnalysisImageOverlay,
) => {
  const { legend, attribution } = overlay;

  context.textBaseline = "top";

  if (legend) {
    paintLegend(context, legend);
  }

  context.fillStyle = PANEL_BACKGROUND;
  context.fillRect(
    attribution.backdrop.x,
    attribution.backdrop.y,
    attribution.backdrop.width,
    attribution.backdrop.height,
  );
  context.fillStyle = TEXT_COLOR;
  context.font = roundedFont(attribution.fontSize);
  context.fillText(attribution.text, attribution.x, attribution.y);
};

export interface ImageLike {
  width: number;
  height: number;
}

export interface CanvasLike {
  width: number;
  height: number;
  getContext(contextId: "2d"): (Context2DLike & DrawImageCapable) | null;
  toDataURL(type: string): string;
}

export interface DrawImageCapable {
  drawImage(image: ImageLike, x: number, y: number): void;
}

export const composeAnalysisMapImage = (
  canvas: CanvasLike,
  image: ImageLike,
  {
    title,
    entries,
    attribution,
    scale = 1,
  }: Omit<BuildOverlayOptions, "width" | "height">,
): string | null => {
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext("2d");
  if (!context) return null;

  context.drawImage(image, 0, 0);

  paintAnalysisImageOverlay(
    context,
    buildAnalysisImageOverlay({
      width: image.width,
      height: image.height,
      title,
      entries,
      attribution,
      scale,
    }),
  );

  return canvas.toDataURL("image/png");
};
