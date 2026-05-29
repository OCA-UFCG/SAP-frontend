import { cookies } from "next/headers";
import { resolveLogsViewerAccess } from "@/lib/logs-access";
import { SESSION_COOKIE_NAME } from "@/lib/server-session";
import { MapLayerProvider } from "@/components/MapLayerContext/MapLayerContext";
import { PlatformMap } from "@/components/PlatformMap/PlatformMap";
import { PlatformSidebar } from "@/components/PlatformSidebar/PlatformSidebar";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";

export async function PlatformLayout() {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const [panelLayers, logsViewerAccess] = await Promise.all([
    getPanelLayers(),
    sessionCookie
      ? resolveLogsViewerAccess(sessionCookie)
      : Promise.resolve("unauthenticated" as const),
  ]);
  const showAuditLink = logsViewerAccess === "allowed";

  return (
    <MapLayerProvider>
      <div className="relative w-full min-h-[calc(100vh-64px)] bg-neutral-50">
        <PlatformMap />
        <PlatformSidebar
          panelLayers={panelLayers}
          showAuditLink={showAuditLink}
        />
      </div>
    </MapLayerProvider>
  );
}
