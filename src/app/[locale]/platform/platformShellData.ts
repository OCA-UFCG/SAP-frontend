import { resolveLogsViewerAccess } from "@/lib/logs-access";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";

/**
 * Dados que a casca da plataforma precisa em qualquer seção: as camadas do
 * painel e se a pessoa vê as entradas de auditoria e catálogo na trilha.
 *
 * `/platform` e `/platform/amfe` carregam os dois porque as seções passaram a
 * conviver na mesma tela — entrar por uma URL não pode deixar a outra sem dados.
 *
 * const { panelLayers, showAuditLink } = await loadPlatformShellData(cookie);
 */
export async function loadPlatformShellData(sessionCookie: string | null) {
  const [panelLayers, logsViewerAccess] = await Promise.all([
    getPanelLayers(),
    sessionCookie
      ? resolveLogsViewerAccess(sessionCookie)
      : Promise.resolve("unauthenticated" as const),
  ]);

  return { panelLayers, showAuditLink: logsViewerAccess === "allowed" };
}
