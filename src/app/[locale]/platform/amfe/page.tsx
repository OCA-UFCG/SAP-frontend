import { cookies } from "next/headers";
import { PlatformLayout } from "@/components/PlatformLayout/PlatformLayout";
import { resolveLogsViewerAccess } from "@/lib/logs-access";
import { SESSION_COOKIE_NAME } from "@/lib/server-session";

export default async function AmfePage() {
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const logsViewerAccess = await resolveLogsViewerAccess(sessionCookie);

  return (
    <PlatformLayout
      viewMode="amfe"
      initialSection="analysis"
      showAuditLink={logsViewerAccess === "allowed"}
    />
  );
}
