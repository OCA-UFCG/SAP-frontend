import type {
  AnalysisReportModel,
  CappedList,
  ReportTranslator,
} from "./analysisReportModel";

/**
 * Nomes de município e campos faltantes vêm do backend e entram no meio de
 * HTML. Sem isto, um nome com `<` quebra o documento.
 */
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const DOCUMENT_CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: #292829;
    font: 11px/1.5 "Open Sans", "Helvetica Neue", Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1 { margin: 0 0 4px; font-size: 20px; }
  h2 {
    margin: 18px 0 6px;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 2px solid #989F43;
    padding-bottom: 4px;
  }
  h3 { margin: 10px 0 4px; font-size: 11px; font-weight: 600; }
  .meta { color: #6b6b6b; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; }
  table.thresholds { width: 60mm; }
  th, td { text-align: left; padding: 3px 6px 3px 0; vertical-align: top; }
  thead th { border-bottom: 1px solid #d9d9d9; font-weight: 600; }
  .numeric { text-align: right; }
  .paramLine { margin: 4px 0; }
  .map { width: 100%; height: auto; border: 1px solid #d9d9d9; }
  .swatch {
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 6px;
    border: 1px solid rgba(0, 0, 0, 0.25);
    vertical-align: middle;
  }
  .columns { column-count: 3; column-gap: 16px; margin: 0; padding: 0; list-style: none; }
  .columns li { break-inside: avoid; }
  .note { color: #6b6b6b; margin: 6px 0 0; }
  footer { margin-top: 18px; color: #6b6b6b; font-size: 10px; }
  section { break-inside: avoid; }
`;

const renderCapNote = <T>(list: CappedList<T>, t: ReportTranslator): string =>
  list.remaining === 0
    ? ""
    : `<p class="note">${escapeHtml(
        t("reportAndMore", { count: list.remaining }),
      )} ${escapeHtml(t("reportSeeWorkbook"))}</p>`;

/**
 * O documento inteiro como string. Nada de Tailwind: a janela de impressão não
 * carrega as folhas de estilo da aplicação, então o CSS vai embutido.
 *
 * @example renderAnalysisReportHtml(model, mapPng, t, "pt")
 */
export const renderAnalysisReportHtml = (
  model: AnalysisReportModel,
  mapPng: string,
  t: ReportTranslator,
  locale: string,
): string => {
  const number = new Intl.NumberFormat(locale);
  const share = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const decimal = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
  });

  const criteria = model.criteria
    .map(
      (criterion) => `<tr>
        <td>${escapeHtml(criterion.label)}</td>
        <td class="numeric">${decimal.format(criterion.weight)}</td>
        <td>${escapeHtml(criterion.direction)}</td>
      </tr>`,
    )
    .join("");

  const thresholds = model.thresholds
    .map(
      (threshold) => `<tr>
        <td>${escapeHtml(threshold.label)}</td>
        <td class="numeric">${decimal.format(threshold.value)}</td>
      </tr>`,
    )
    .join("");

  const distribution = model.distribution
    .map(
      (item) => `<tr>
        <td><span class="swatch" style="background:${escapeHtml(
          item.color,
        )}"></span>${escapeHtml(item.label)}</td>
        <td class="numeric">${number.format(item.count)}</td>
        <td class="numeric">${share.format(item.share)}%</td>
      </tr>`,
    )
    .join("");

  const topPriority = model.topPriority.shown
    .map(
      (city) =>
        `<li>${escapeHtml(city.name)}${
          city.uf ? ` &ndash; ${escapeHtml(city.uf)}` : ""
        }</li>`,
    )
    .join("");

  const excluded = model.excluded.shown
    .map(
      (city) =>
        `<li>${escapeHtml(city.name)} &mdash; ${escapeHtml(
          t("reportMissingFields"),
        )}: <em>${escapeHtml(city.missingFields.join(", "))}</em></li>`,
    )
    .join("");

  const coverage = model.coverage
    ? `<p>${escapeHtml(
        t("reportCoverage", {
          analyzed: model.coverage.analyzed,
          total: model.coverage.total,
          excluded: model.coverage.excluded,
        }),
      )}</p>`
    : "";

  return `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(t("reportTitle"))}</title>
  <style>${DOCUMENT_CSS}</style>
</head>
<body>
  <h1>${escapeHtml(t("reportTitle"))}</h1>
  <p class="meta">${escapeHtml(
    t("reportScope", {
      area: model.scope.area,
      value: model.scope.value,
      level: model.scope.level,
    }),
  )}</p>
  <p class="meta">${escapeHtml(
    t("reportGeneratedAt", { date: date.format(model.generatedAt) }),
  )}</p>

  <section>
    <h2>${escapeHtml(t("reportParameters"))}</h2>

    <table>
      <thead><tr>
        <th>${escapeHtml(t("reportCriterionColumn"))}</th>
        <th class="numeric">${escapeHtml(t("reportWeightColumn"))}</th>
        <th>${escapeHtml(t("reportDirectionColumn"))}</th>
      </tr></thead>
      <tbody>${criteria}</tbody>
    </table>

    <table class="thresholds">
      <thead><tr>
        <th>${escapeHtml(t("reportThresholdColumn"))}</th>
        <th class="numeric">${escapeHtml(t("reportValueColumn"))}</th>
      </tr></thead>
      <tbody>${thresholds}</tbody>
    </table>

    <p class="paramLine">${escapeHtml(t("cenario"))}: ${escapeHtml(model.scenario)}</p>
    <p class="paramLine">${escapeHtml(t("modelo"))}: ${escapeHtml(
      t("reportModelVersion", { version: model.modelVersion }),
    )}</p>
  </section>

  <section>
    <h2>${escapeHtml(t("reportMap"))}</h2>
    <img class="map" src="${escapeHtml(mapPng)}" alt="${escapeHtml(t("reportMap"))}">
  </section>

  <section>
    <h2>${escapeHtml(t("reportDistribution"))}</h2>
    ${coverage}
    <table>
      <thead><tr>
        <th>${escapeHtml(t("reportClassColumn"))}</th>
        <th class="numeric">${escapeHtml(t("reportCountColumn"))}</th>
        <th class="numeric">${escapeHtml(t("reportShareColumn"))}</th>
      </tr></thead>
      <tbody>${distribution}</tbody>
    </table>
  </section>

  <section>
    <h2>${escapeHtml(t("reportTopPriority"))} (${number.format(
      model.topPriority.total,
    )})</h2>
    <ul class="columns">${topPriority}</ul>
    ${renderCapNote(model.topPriority, t)}
  </section>

  <section>
    <h2>${escapeHtml(t("reportExcluded"))} (${number.format(
      model.excluded.total,
    )})</h2>
    <ul class="columns">${excluded}</ul>
    ${renderCapNote(model.excluded, t)}
  </section>

  <footer>${escapeHtml(t("reportAttribution"))}</footer>
</body>
</html>`;
};
