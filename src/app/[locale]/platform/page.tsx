import { Suspense } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PlatformLayout } from "@/components/PlatformLayout/PlatformLayout";
import { TelemetryDashboardLoading } from "@/components/TelemetryDashboard/TelemetryDashboardLoading";
import { TelemetryDashboardServer } from "@/components/TelemetryDashboard/TelemetryDashboardServer";
import { IndexCatalogScreen } from "@/components/IndexCatalog/IndexCatalogScreen";
import type { PlatformSidebarInitialSection } from "@/components/PlatformSidebar/PlatformSidebar";
import { resolveLogsViewerAccess } from "@/lib/logs-access";
import { SESSION_COOKIE_NAME } from "@/lib/server-session";
import { loadPlatformShellData } from "./platformShellData";

interface PlatformPageSearchParams {
  view?: string | string[];
  section?: string | string[];
  municipalityCode?: string | string[];
  period?: string | string[];
  layers?: string | string[];
  layer?: string | string[];
}

function getSingleSearchParamValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizePlatformView(value?: string | string[]) {
  const normalized = getSingleSearchParamValue(value);
  return normalized === "logs" || normalized === "catalog"
    ? normalized
    : "default";
}

function normalizePlatformSection(
  value?: string | string[],
): PlatformSidebarInitialSection {
  const normalizedValue = getSingleSearchParamValue(value);

  if (normalizedValue === "communication" || normalizedValue === "analysis") {
    return normalizedValue;
  }

  return "monitoring";
}

export default async function PlatformPage({
  searchParams,
}: {
  searchParams?: Promise<PlatformPageSearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const viewMode = normalizePlatformView(resolvedSearchParams.view);
  const initialSection = normalizePlatformSection(resolvedSearchParams.section);
  const municipalityCode =
    getSingleSearchParamValue(resolvedSearchParams.municipalityCode) ?? "";
  const period = getSingleSearchParamValue(resolvedSearchParams.period) ?? "";
  const detailLayerId =
    getSingleSearchParamValue(resolvedSearchParams.layer)?.trim() || undefined;
  const layerIds = (
    getSingleSearchParamValue(resolvedSearchParams.layers) ?? ""
  )
    .split(",")
    .filter(Boolean);
  const sessionCookie =
    (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;

  if ((viewMode === "logs" || viewMode === "catalog") && !sessionCookie) {
    redirect("/login");
  }

  if (viewMode === "logs" || viewMode === "catalog") {
    const logsViewerAccess = await resolveLogsViewerAccess(sessionCookie);

    if (logsViewerAccess === "unauthenticated") {
      redirect("/login");
    }

    if (logsViewerAccess === "forbidden") {
      notFound();
    }

    if (viewMode === "catalog") {
      return (
        <PlatformLayout
          showAuditLink
          viewMode="catalog"
          initialSection={initialSection}
          catalogDashboard={<IndexCatalogScreen />}
        />
      );
    }

    return (
      <PlatformLayout
        showAuditLink
        viewMode="logs"
        initialSection={initialSection}
        telemetryDashboard={
          <Suspense fallback={<TelemetryDashboardLoading />}>
            <TelemetryDashboardServer />
          </Suspense>
        }
      />
    );
  }

  const { panelLayers, showAuditLink } =
    await loadPlatformShellData(sessionCookie);

  return (
    <PlatformLayout
      panelLayers={panelLayers}
      showAuditLink={showAuditLink}
      initialSection={initialSection}
      detailLayerId={detailLayerId}
      reportRequest={
        municipalityCode && period
          ? { municipalityCode, period, layerIds }
          : undefined
      }
    />
  );
}
