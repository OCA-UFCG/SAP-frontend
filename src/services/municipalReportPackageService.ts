import "server-only";

import type { MunicipalReportPackage } from "@/contracts/municipalReport";
import { getMunicipalReportTemplateProvider, type MunicipalReportTemplateProvider } from "@/providers/municipalReportTemplateProvider";
import { buildMunicipalReport, type MunicipalReportServiceDependencies } from "@/services/municipalReportService";
import { resolveMunicipalReportTemplate } from "@/utils/municipalReportTemplate";

export async function buildMunicipalReportPackage(
  municipalityCode: string,
  requestedPeriod: string,
  selectedLayerIds: string[] = [],
  dependencies: MunicipalReportServiceDependencies & { templateProvider?: MunicipalReportTemplateProvider } = {},
): Promise<MunicipalReportPackage> {
  const report = await buildMunicipalReport(municipalityCode, requestedPeriod, dependencies);
  const selected = selectedLayerIds.length
    ? report.analyses.filter((analysis) => selectedLayerIds.includes(analysis.id))
    : report.analyses;
  const provider = dependencies.templateProvider ?? getMunicipalReportTemplateProvider();
  const template = await provider.getTemplate(report);
  const content = resolveMunicipalReportTemplate(template, report, selected.map((analysis) => analysis.alias));
  return { report, content };
}
