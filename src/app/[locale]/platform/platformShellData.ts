import { redirect } from "next/navigation";
import { resolveLogsViewerAccess } from "@/lib/logs-access";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";

/**
 * Dados que a casca da plataforma precisa em qualquer seção: as camadas do
 * painel e se a pessoa vê as entradas de auditoria e catálogo na trilha.
 *
 * `/platform` e `/platform/amfe` carregam os dois porque as seções passaram a
 * conviver na mesma tela — entrar por uma URL não pode deixar a outra sem dados.
 *
 * Confere a sessão por conta própria em vez de confiar no layout: o Next monta
 * layout e página ao mesmo tempo, então o redirecionamento do layout não impede
 * a página de rodar, e as camadas iam no corpo do 307 para quem não estava
 * logado — um `curl` em `/pt/platform` lia os 447 KB de `panelLayers`.
 *
 * const { panelLayers, showAuditLink } = await loadPlatformShellData(cookie);
 */
export async function loadPlatformShellData(sessionCookie: string | null) {
  if (!sessionCookie) {
    redirect("/login");
  }

  // As duas em paralelo para não somar a verificação ao tempo de quem está
  // logado; as camadas só saem daqui depois que a sessão foi aceita.
  const [panelLayers, logsViewerAccess] = await Promise.all([
    getPanelLayers(),
    resolveLogsViewerAccess(sessionCookie),
  ]);

  if (logsViewerAccess === "unauthenticated") {
    redirect("/login");
  }

  return { panelLayers, showAuditLink: logsViewerAccess === "allowed" };
}
