/** Fontes declaradas em `src/app/[locale]/layout.tsx` e usadas pelo documento. */
const FONT_VARIABLE_NAMES = ["--font-open-sans", "--font-inter"];

/**
 * A área útil de uma página do PDF: A4 (210 × 297 mm) menos as margens do
 * `@page`. A medição das páginas do sumário diagrama o documento em caixas
 * deste tamanho, então as duas coisas precisam andar juntas.
 */
const PAGE_MARGIN_MM = { vertical: 12, horizontal: 14 };
const PAGE_CONTENT_WIDTH = `${210 - 2 * PAGE_MARGIN_MM.horizontal}mm`;
const PAGE_CONTENT_HEIGHT = `${297 - 2 * PAGE_MARGIN_MM.vertical}mm`;

const PRINT_OVERRIDES = `
      <style>
        @page{size:A4;margin:${PAGE_MARGIN_MM.vertical}mm ${PAGE_MARGIN_MM.horizontal}mm}
        html,body{width:auto;margin:0;background:#fff}
        body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .report-paper{box-sizing:border-box;width:auto!important;min-height:auto!important;margin:0!important;padding:0!important;overflow:visible;box-shadow:none!important}
        .report-paper>div{padding:0!important}
        .report-hero>div{padding-left:0!important;padding-right:0!important}
        .report-back-to-top{display:none!important}
        @media print{
          .report-chart-screen{display:none!important}
          .report-chart-print{display:block!important}
          .report-print-chart-svg{display:block;width:100%!important;height:auto!important;overflow:visible!important}
          .report-map-frame{aspect-ratio:auto!important;height:70mm!important}
          .report-map-frame img{width:100%;height:100%;object-fit:contain!important;object-position:center!important}
          .report-sections{margin-top:8mm!important}
          .report-section+.report-section{margin-top:10mm!important}
          .report-section{break-inside:auto;page-break-inside:auto}
          .report-analysis-header{break-after:avoid;page-break-after:avoid}
          .report-heading{break-after:avoid;page-break-after:avoid}
          .report-block{break-inside:avoid;page-break-inside:avoid}
          .report-class-bar-row{break-inside:avoid;page-break-inside:avoid}
          /* O sumário fecha a primeira página: as seções começam numa folha
             nova, e uma entrada nunca fica com o número na página seguinte. */
          .report-summary{break-after:page;page-break-after:always}
          .report-summary-entry{break-inside:avoid;page-break-inside:avoid}
          /* Mapa, gráfico e barras de classe medem 435, 506 e até 530px numa
             página A4 de 1032px úteis: dois cabem, três nunca. Enquanto o cartão
             inteiro era indivisível, o terceiro pulava de página e deixava um
             vão de 300 a 500px no pé da anterior, seção após seção. O que de
             fato não pode ser cortado ao meio é a imagem do mapa e o SVG do
             gráfico; o cabeçalho, a legenda e a tabela de classes podem fluir. */
          .report-time-series,.report-spatial,.report-class-coverage{break-inside:auto;page-break-inside:auto}
          .report-time-series>.report-block,.report-spatial>.report-block,.report-class-coverage>.report-block{break-inside:auto;page-break-inside:auto}
          .report-map-frame,.report-chart-print{break-inside:avoid;page-break-inside:avoid}
          .report-narrative{break-inside:auto;page-break-inside:auto}
          .report-notes{break-inside:auto;page-break-inside:auto;margin-top:8mm!important;padding-top:5mm!important}
          .report-document-footer{break-inside:avoid;page-break-inside:avoid}
          .report-paper p,.report-notes p{orphans:3;widows:3}
        }
      </style>`;

/**
 * O HTML completo que vai para a janela de impressão: as folhas de estilo do
 * app, os ajustes de impressão e o documento do relatório.
 */
export function buildReportPrintHtml(paper: HTMLElement, locale: string) {
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')]
    .map((element) => element.outerHTML)
    .join("\n");
  const baseUrl = `${window.location.origin}/`;
  // As variáveis de fonte do next/font vivem na className do <body> do app
  // (src/app/[locale]/layout.tsx). A janela de impressão monta um <body> novo,
  // sem essa classe, e o PDF saía numa fonte de sistema em vez de Open Sans —
  // o que muda a largura do texto e a quebra de página junto. Vão como regra
  // CSS, e não como atributo style: o valor resolvido traz aspas duplas
  // (`"Open Sans", "Open Sans Fallback"`) que truncariam o atributo.
  const appBodyStyle = getComputedStyle(document.body);
  const printFontVariables = FONT_VARIABLE_NAMES.map(
    (name) => `${name}:${appBodyStyle.getPropertyValue(name)}`,
  ).join(";");

  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><base href="${baseUrl}"><title></title>${styles}<style>body{${printFontVariables}}</style>${PRINT_OVERRIDES}</head><body>${paper.outerHTML}</body></html>`;
}

/**
 * Faz as regras `@media print` valerem na tela, e as `@media screen` deixarem
 * de valer — o documento passa a ter, fora da impressão, a mesma cara que tem
 * no PDF. Regras por largura ficam como estão: o iframe da medição tem a
 * largura de uma folha A4, que é contra o que o Chrome as avalia ao imprimir.
 */
function emulatePrintMedia(doc: Document) {
  const view = doc.defaultView;
  if (!view) return;

  const visit = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (rule instanceof view.CSSMediaRule) {
        rule.media.mediaText = [...rule.media]
          .map((query) =>
            /^(only\s+)?screen\b/iu.test(query)
              ? "not all"
              : query.replace(/^(only\s+)?print\b/iu, "all"),
          )
          .join(", ");
      }
      // Camadas (`@layer`), `@supports` e regras aninhadas do Tailwind 4.
      if ("cssRules" in rule) visit(rule.cssRules as CSSRuleList);
    }
  };

  for (const sheet of doc.styleSheets) {
    try {
      visit(sheet.cssRules);
    } catch {
      // Folha de outra origem: não dá para ler, e o relatório não depende dela.
    }
  }
}

/**
 * Espera as folhas de estilo do documento carregarem. O `readyState` de um
 * documento montado com `document.write` já diz "complete" antes disso, e
 * medir nesse intervalo diagrama o relatório sem as regras de impressão.
 */
function stylesheetsLoaded(doc: Document) {
  const links = doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]');

  return Promise.all(
    [...links].map(
      (link) =>
        link.sheet ??
        new Promise<void>((resolve) => {
          link.addEventListener("load", () => resolve(), { once: true });
          link.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
}

/**
 * Em que página do PDF começa cada seção do relatório.
 *
 * O navegador não informa onde a impressão vai quebrar as páginas, e o CSS que
 * escreveria esse número sozinho (`target-counter`) não existe no Chrome. Então
 * o mesmo HTML da impressão é diagramado num iframe escondido, com as regras
 * de impressão ligadas e o corpo transformado em colunas do tamanho exato da
 * área útil de uma folha. Colunas e páginas passam pelo mesmo motor de
 * fragmentação do Chrome — `break-inside: avoid`, órfãs e viúvas valem igual —,
 * então a coluna em que uma seção cai é a página em que ela sai no PDF.
 *
 * @returns página (contada a partir de 1) por id de âncora da seção.
 */
export async function measureReportPages(paper: HTMLElement, locale: string) {
  // O quadro do mapa vai vazio: no PDF ele tem altura fixa, e o que há dentro
  // muda com o tempo — o canvas de 806 × 373 px do MapLibre enquanto a captura
  // não termina, a imagem depois —, além de pesar megabytes em data URLs. Com
  // o `clip` abaixo, o canvas mais alto que o quadro empurrava a quebra.
  const measured = paper.cloneNode(true) as HTMLElement;
  for (const frame of measured.querySelectorAll(".report-map-frame")) {
    frame.replaceChildren();
  }

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  // Fora da tela, mas com tamanho de verdade: `display: none` não diagrama.
  frame.style.cssText =
    "position:fixed;top:0;left:-10000px;width:210mm;height:297mm;border:0;visibility:hidden;pointer-events:none";
  document.body.append(frame);

  try {
    const doc = frame.contentDocument;
    if (!doc) return new Map<string, number>();
    doc.open();
    doc.write(buildReportPrintHtml(measured, locale));
    doc.close();
    await stylesheetsLoaded(doc);

    emulatePrintMedia(doc);
    // Duas diferenças entre colunas e páginas que precisam ser desfeitas: a
    // quebra forçada do sumário é de página, e numa coluna ela precisa ser de
    // coluna; e um cartão com `overflow: hidden` é indivisível numa coluna, mas
    // se parte entre páginas na impressão. Sem o `clip`, que recorta igual mas
    // não trava a quebra, cada mapa empurrava o cartão inteiro para a coluna
    // seguinte e o sumário chegava a errar cinco páginas no fim do documento.
    // Os cartões são flex, então trocar o `overflow` não muda a diagramação.
    const paged = doc.createElement("style");
    paged.textContent = `
      html{width:auto!important;height:auto!important}
      body{box-sizing:content-box!important;width:${PAGE_CONTENT_WIDTH}!important;height:${PAGE_CONTENT_HEIGHT}!important;margin:0!important;padding:0!important;column-width:${PAGE_CONTENT_WIDTH};column-gap:0;column-fill:auto}
      .report-summary{break-after:column}
      .report-paper .overflow-hidden{overflow:clip!important}`;
    doc.head.append(paged);
    // A diagramação é o que dispara o download das fontes usadas; só depois
    // dela o `fonts.ready` espera pelas fontes certas.
    doc.body.getBoundingClientRect();
    await doc.fonts.ready;

    const origin = doc.body.getBoundingClientRect();
    const pages = new Map<string, number>();
    for (const section of doc.querySelectorAll<HTMLElement>(
      'section[id^="report-analysis-"]',
    )) {
      // O cabeçalho não se parte entre páginas; a seção, sim.
      const anchor =
        section.querySelector<HTMLElement>(".report-analysis-header") ??
        section;
      const left = anchor.getBoundingClientRect().left - origin.left;
      pages.set(section.id, Math.floor((left + 1) / origin.width) + 1);
    }

    return pages;
  } finally {
    frame.remove();
  }
}
