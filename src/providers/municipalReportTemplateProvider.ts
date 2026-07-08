import "server-only";

import type { MunicipalReportData, MunicipalReportTemplateDocument } from "@/contracts/municipalReport";

export interface MunicipalReportTemplateProvider {
  getTemplate(report: MunicipalReportData): Promise<MunicipalReportTemplateDocument>;
}

function analysisSections(report: MunicipalReportData) {
  return report.analyses.flatMap((analysis) => {
    const alias = analysis.alias;
    const sections = [
      `[[analysis:${alias}:situation]]\nNo município de $municipio — $uf, predomina a classe $classe_${alias}, com $percentual_${alias}% da área analisada $contexto_cobertura_${alias}, conforme os dados de $titulo_${alias} para o período de $periodo_${alias}.`,
      `[[analysis:${alias}:methodology]]\n$metodologia_${alias}`,
    ];
    if (`quantidade_periodos_recentes_${alias}` in report.templateVariables) {
      sections.push(
        `[[analysis:${alias}:recent-history]]\nA série histórica de $titulo_${alias} registra que $municipio apresentou a condição analisada em $quantidade_periodos_com_fenomeno_${alias} dos últimos $quantidade_periodos_recentes_${alias} períodos ($inicio_periodo_recente_${alias} a $fim_periodo_recente_${alias}). No período de referência, predomina $classe_${alias}. A mudança em relação ao período anterior foi classificada como $mudanca_${alias}.`,
        `[[analysis:${alias}:historical-context]]\nNo período $inicio_historico_${alias}–$fim_historico_${alias}, a classe predominante mais frequente foi $classe_mais_frequente_${alias}, em $frequencia_classe_mais_frequente_${alias}% dos períodos. A condição neutra predominou em $frequencia_condicao_neutra_${alias}% do período. A maior severidade observada foi $classe_maior_severidade_${alias}, registrada em $periodo_maior_severidade_${alias}.`,
      );
    }
    return sections;
  });
}

export class LocalMunicipalReportTemplateProvider implements MunicipalReportTemplateProvider {
  async getTemplate(report: MunicipalReportData): Promise<MunicipalReportTemplateDocument> {
    return {
      id: "municipal-report-default-pt-BR",
      version: "1.0.0",
      origin: "local",
      updatedAt: "2026-07-07T00:00:00.000Z",
      text: [
        "[[report:introduction]]\nEste relatório foi gerado automaticamente pelo Sistema de Alerta Precoce de Seca e Desertificação (SAP). Os valores apresentados são produzidos a partir dos dados disponíveis na plataforma.",
        ...analysisSections(report),
        "[[report:legal-reference]]\nLei nº 13.153/2015 — Política Nacional de Combate à Desertificação e Mitigação dos Efeitos da Seca.",
      ].join("\n\n"),
    };
  }
}

export function getMunicipalReportTemplateProvider(): MunicipalReportTemplateProvider {
  // Future providers (for example Google Docs) are selected here, never in UI code.
  return new LocalMunicipalReportTemplateProvider();
}
