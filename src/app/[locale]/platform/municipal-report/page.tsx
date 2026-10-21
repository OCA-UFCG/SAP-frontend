import { MunicipalReportPreview } from "@/components/MunicipalReport/MunicipalReportPreview";
import { pageTitleMetadata } from "@/lib/page-metadata";

export const generateMetadata = pageTitleMetadata("municipalReport");

interface MunicipalReportPageParams {
  locationKey?: string | string[];
  /** Forma antiga do parâmetro, mantida para os links já compartilhados. */
  municipalityCode?: string | string[];
  period?: string | string[];
  layers?: string | string[];
}

function single(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MunicipalReportPage({
  searchParams,
}: {
  searchParams: Promise<MunicipalReportPageParams>;
}) {
  const params = await searchParams;

  return (
    <MunicipalReportPreview
      locationKey={
        single(params.locationKey) ?? single(params.municipalityCode) ?? ""
      }
      period={single(params.period) ?? ""}
      layerIds={(single(params.layers) ?? "").split(",").filter(Boolean)}
    />
  );
}
