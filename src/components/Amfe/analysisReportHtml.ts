import { htmlLang } from "@/translations/htmlLang";
import type {
  AnalysisReportModel,
  ReportTranslator,
} from "./analysisReportModel";

/**
 * Nomes de município vêm do backend e entram no meio de
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
  h1 { margin: 0 0 2px; font-size: 26px; }
  header { border-bottom: 1px solid #d9d9d9; padding-bottom: 10px; }
  h2 {
    margin: 18px 0 6px;
    padding-top: 8px;
    border-top: 3px solid #2E6B4F;
    font-size: 13px;
    text-transform: uppercase;
    break-after: avoid;
  }
  .meta { color: #6b6b6b; margin: 0; }
  .meta.scope { font-size: 13px; }
  p { margin: 0 0 8px; text-align: justify; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td {
    text-align: left;
    padding: 6px 10px;
    vertical-align: top;
    border: 1px solid #d9d9d9;
  }
  thead th { background: #E8F0EA; font-weight: 600; }
  tbody th { font-weight: 400; }
  tbody tr:nth-child(even) { background: #F4F4F4; }
  td.classCell { color: #000; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  sup { line-height: 0; }
  .footnote { margin: 2px 0 0; color: #6b6b6b; font-size: 9px; }
  .scenario { margin: 10px 0 0; }
  .map { width: 100%; height: auto; border: 1px solid #d9d9d9; }
  .mapSection { break-inside: avoid; }
  .classList { margin-top: 14px; }
  .classList h3 {
    margin: 0;
    padding: 8px 10px;
    color: #000;
    font-size: 12px;
    text-transform: uppercase;
    break-after: avoid;
  }
  .classList ul {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .classList li {
    padding: 4px 10px;
    border-bottom: 1px solid #d9d9d9;
    break-inside: avoid;
  }
  .classList li:nth-child(6n + 4),
  .classList li:nth-child(6n + 5),
  .classList li:nth-child(6n + 6) { background: #F4F4F4; }
  .classList .empty { padding: 4px 10px; color: #6b6b6b; }
  footer {
    margin-top: 18px;
    padding-top: 8px;
    border-top: 1px solid #d9d9d9;
    color: #6b6b6b;
    font-size: 10px;
    text-align: center;
    break-before: avoid;
  }
`;

const renderCityList = (cities: string[], emptyText: string): string =>
  cities.length === 0
    ? `<p class="empty">${escapeHtml(emptyText)}</p>`
    : `<ul>${cities.map((city) => `<li>${escapeHtml(city)}</li>`).join("")}</ul>`;

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
        <th scope="row">${escapeHtml(criterion.label)}</th>
        <td>${decimal.format(criterion.weight)}</td>
        <td>${escapeHtml(criterion.direction)}</td>
      </tr>`,
    )
    .join("");

  const thresholds = model.thresholds
    .map(
      (threshold) => `<tr>
        <th scope="row">${escapeHtml(threshold.label)}</th>
        <td>${decimal.format(threshold.value)}</td>
        <td>${escapeHtml(threshold.description)}</td>
      </tr>`,
    )
    .join("");

  const distribution = model.distribution
    .map(
      (item) => `<tr>
        <td class="classCell" style="background:${escapeHtml(item.color)}">${escapeHtml(item.label)}</td>
        <td>${number.format(item.count)}</td>
        <td>${share.format(item.share)}%</td>
      </tr>`,
    )
    .join("");

  const classLists = model.classLists
    .map(
      (item) => `<section class="classList">
        <h3 style="background:${escapeHtml(item.color)}">${escapeHtml(
          t("reportClassList", { label: item.label }),
        )} (${number.format(item.cities.length)})</h3>
        ${renderCityList(item.cities, t("reportClassListEmpty"))}
      </section>`,
    )
    .join("");

  const scope = t("reportScope", {
    place: model.scope.place,
    level: model.scope.level,
  });

  // O alt diz o recorte, e não só "Resultado no mapa": as cores de cada
  // município estão na tabela de distribuição logo abaixo.
  const mapAlt = `${t("reportMap")}. ${scope}`;

  const coverage = model.coverage
    ? `<p>${escapeHtml(
        t("reportCoverage", {
          analyzed: model.coverage.analyzed,
          total: model.coverage.total,
          excluded: model.coverage.excluded,
        }),
      )}</p>`
    : "";

  const excluded =
    model.excluded.length === 0
      ? `<p>${escapeHtml(t("reportNoExcluded"))}</p>`
      : `<section class="classList">${renderCityList(model.excluded, "")}</section>`;

  return `<!doctype html>
<html lang="${escapeHtml(htmlLang(locale))}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(t("reportTitle"))}</title>
  <style>${DOCUMENT_CSS}</style>
</head>
<body>
  <header>
    <h1>${escapeHtml(t("reportTitle"))}</h1>
    <p class="meta scope">${escapeHtml(scope)}</p>
    <p class="meta">${escapeHtml(
      t("reportGeneratedAt", { date: date.format(model.generatedAt) }),
    )} · ${escapeHtml(t("modelo"))} ${escapeHtml(
      t("reportModelVersion", { version: model.modelVersion }),
    )}</p>
  </header>

  <section>
    <h2>${escapeHtml(t("reportMethodTitle"))}</h2>
    <p>${escapeHtml(t("reportMethodIntro"))}</p>

    <table>
      <caption class="sr-only">${escapeHtml(t("criterios"))}</caption>
      <thead><tr>
        <th scope="col">${escapeHtml(t("reportCriterionColumn"))}</th>
        <th scope="col">${escapeHtml(t("reportWeightColumn"))}</th>
        <th scope="col">${escapeHtml(t("reportDirectionColumn"))} <sup>*</sup></th>
      </tr></thead>
      <tbody>${criteria}</tbody>
    </table>
    <p class="footnote"><sup>*</sup> ${escapeHtml(t("reportDirectionNote"))}</p>

    <table>
      <caption class="sr-only">${escapeHtml(t("limiares"))}</caption>
      <thead><tr>
        <th scope="col">${escapeHtml(t("reportThresholdColumn"))}</th>
        <th scope="col">${escapeHtml(t("reportValueColumn"))}</th>
        <th scope="col">${escapeHtml(t("reportDescriptionColumn"))}</th>
      </tr></thead>
      <tbody>
        ${thresholds}
        <tr>
          <th scope="row">${escapeHtml(t("reportClassCount"))}</th>
          <td>${number.format(model.classCount)}</td>
          <td>${escapeHtml(model.classRange)}</td>
        </tr>
      </tbody>
    </table>

    <p class="scenario">${escapeHtml(t("cenario"))}: <strong>${escapeHtml(
      model.scenario.label,
    )}</strong> <sup>**</sup></p>
    <p class="footnote"><sup>**</sup> ${escapeHtml(model.scenario.note)}</p>
  </section>

  <section class="mapSection">
    <h2>${escapeHtml(t("reportMap"))}</h2>
    <img class="map" src="${escapeHtml(mapPng)}" alt="${escapeHtml(mapAlt)}">
  </section>

  <section>
    <h2>${escapeHtml(t("reportDistribution"))}</h2>
    ${coverage}
    <table>
      <caption class="sr-only">${escapeHtml(t("reportDistribution"))}</caption>
      <thead><tr>
        <th scope="col">${escapeHtml(t("reportClassColumn"))}</th>
        <th scope="col">${escapeHtml(t("reportCountColumn"))}</th>
        <th scope="col">${escapeHtml(t("reportShareColumn"))}</th>
      </tr></thead>
      <tbody>${distribution}</tbody>
    </table>
  </section>

  ${classLists}

  <section>
    <h2>${escapeHtml(t("reportExcluded"))} (${number.format(
      model.excluded.length,
    )})</h2>
    ${excluded}
  </section>

  <footer>${escapeHtml(
    t("reportAttribution", { year: model.generatedAt.getFullYear() }),
  )}</footer>
</body>
</html>`;
};
