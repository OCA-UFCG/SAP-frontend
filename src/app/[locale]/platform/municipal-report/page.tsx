import { MunicipalReportPreview } from "@/components/MunicipalReport/MunicipalReportPreview";

interface MunicipalReportPageParams {
  municipalityCode?: string | string[];
  period?: string | string[];
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
      municipalityCode={single(params.municipalityCode) ?? ""}
      period={single(params.period) ?? ""}
    />
  );
}
