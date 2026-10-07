import { cookies } from "next/headers";
import { PlatformLayout } from "@/components/PlatformLayout/PlatformLayout";
import { SESSION_COOKIE_NAME } from "@/lib/server-session";
import { loadPlatformShellData } from "../platformShellData";

/**
 * URL própria da análise multicritério, mantida porque é linkável e está em uso.
 * Renderiza a mesma casca de `/platform`, já aberta em Análise: as duas seções
 * dividem o mesmo mapa, e trocar entre elas não navega.
 */
export default async function AmfePage() {
  const sessionCookie =
    (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
  const { panelLayers, showAuditLink } =
    await loadPlatformShellData(sessionCookie);

  return (
    <PlatformLayout
      panelLayers={panelLayers}
      showAuditLink={showAuditLink}
      initialSection="analysis"
    />
  );
}
