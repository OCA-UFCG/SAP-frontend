import "server-only";

import type { AuthenticatedUserSession } from "@/lib/server-session";
import { withAuditEvent } from "@/services/indexCatalog/catalogConfigAudit";
import {
  getCatalogEntry,
  getLocalizedEntryField,
  listCatalogEntries,
  patchManagementEntry,
  publishManagementEntry,
  type ContentfulManagementEntry,
} from "@/services/indexCatalog/contentfulManagement";
import { isManagedCatalogConfig } from "@/types/indexCatalog";
import { resolvePanelPositionPlan } from "@/utils/indexCatalog";

interface PanelPositionPublicationRequest {
  entryId: string;
  entry: ContentfulManagementEntry;
  locale: string;
  category: string;
  requestedPosition?: number;
  user: AuthenticatedUserSession;
}

export interface PanelPositionPublication {
  /** O número que vai para o campo `panelPosition` desta entry. */
  position: number;
  /**
   * Aplica a troca no índice que ocupava a posição pedida, se houver um, e
   * devolve o que dizer ao operador. Roda depois da publicação desta entry:
   * mover o outro índice antes disso deixaria a lista errada se a publicação
   * falhasse no meio.
   */
  applySwap: () => Promise<string | null>;
}

/**
 * Decide a posição desta entry na lista do Monitoramento e prepara a troca com
 * quem já estava nela.
 *
 * A posição pedida no formulário mora no `catalogConfig`, e é aqui — na
 * publicação — que ela chega ao campo `panelPosition` da entry. Escrever o
 * campo antes disso tiraria da publicação a única informação de que ela precisa
 * para trocar as duas de lugar: a posição que este índice está deixando vazia.
 *
 * @example
 * const position = await preparePanelPositionForPublish({ ... });
 * // ...publica a entry com position.position...
 * const note = await position.applySwap();
 */
export async function preparePanelPositionForPublish(
  request: PanelPositionPublicationRequest,
): Promise<PanelPositionPublication> {
  const entries = await listCatalogEntries();
  const plan = resolvePanelPositionPlan(entries, {
    entryId: request.entryId,
    category: request.category,
    requestedPosition: request.requestedPosition,
    currentPosition: getLocalizedEntryField<number>(
      request.entry,
      "panelPosition",
      request.locale,
    ),
  });
  const swap = plan.swap;

  return {
    position: plan.position,
    applySwap: () =>
      swap
        ? movePanelPosition(swap.entryId, swap.position, request.user).catch(
            // A entry que pediu a posição já está publicada quando isto roda:
            // transformar a falha da troca em erro diria que a publicação não
            // aconteceu. O índice foi ao ar, e o que falta é mover o outro.
            (error: unknown) => {
              console.error(
                `[indexCatalog] falha ao mover o índice da entry ${swap.entryId} para a posição ${swap.position}:`,
                error,
              );
              return `A posição pedida está publicada, mas mover o índice que estava nela falhou: ele continua na posição ${plan.position}. Ajuste a posição dele no catálogo.`;
            },
          )
        : Promise.resolve(null),
  };
}

/**
 * Leva o índice que perdeu a posição para o número que sobrou.
 *
 * Grava também a posição pedida no `catalogConfig` dele: sem isso o formulário
 * do índice movido reabriria pedindo a posição antiga e o próximo salvamento
 * desfaria a troca.
 */
async function movePanelPosition(
  entryId: string,
  position: number,
  user: AuthenticatedUserSession,
) {
  const current = await getCatalogEntry(entryId);
  const config = current.item.catalogConfig;
  const patched = await patchManagementEntry(current.entry, {
    panelPosition: position,
    ...(isManagedCatalogConfig(config)
      ? {
          catalogConfig: withAuditEvent(
            { ...config, panelPosition: position },
            user,
            {
              action: "update",
              outcome: "success",
              message: `posição na categoria trocada para ${position}`,
            },
          ),
        }
      : {}),
  });

  // Sem republicar o ocupante a lista publicada continuaria com os dois índices
  // no mesmo número, e o desempate por nome decidiria a ordem. Um rascunho com
  // outras alterações não pode ir ao ar por causa de uma troca de posição, então
  // nesse caso a troca fica gravada e quem opera é avisado.
  if (current.item.published && !current.item.hasUnpublishedChanges) {
    await publishManagementEntry(patched);
    return `“${current.item.name}” foi para a posição ${position}.`;
  }

  return `“${current.item.name}” foi para a posição ${position}, mas essa entry tem alterações não publicadas: republique-a para a nova ordem valer no Monitoramento.`;
}
