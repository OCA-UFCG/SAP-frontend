"use client";

import type { PanelLayerSourceGroup } from "@/contracts/panelLayerSourceGroup";
import {
  isFullyManagedCatalogConfig,
  type IndexCatalogItem,
} from "@/types/indexCatalog";
import { isSameSourceGroup } from "@/utils/sourceGroup";

const EMPTY_SOURCE_GROUP: PanelLayerSourceGroup = { group: "", source: "" };

interface CatalogSourceGroup extends PanelLayerSourceGroup {
  entryId: string;
  name: string;
}

/** Os outros índices do catálogo que estão em algum grupo. */
function otherGroupedItems(
  items: IndexCatalogItem[],
  entryId: string | null,
): CatalogSourceGroup[] {
  return items.flatMap((item) => {
    const config = item.catalogConfig;
    if (item.entryId === entryId || !isFullyManagedCatalogConfig(config)) {
      return [];
    }
    const sourceGroup = config.sourceGroup;
    return sourceGroup
      ? [{ ...sourceGroup, entryId: item.entryId, name: item.name }]
      : [];
  });
}

function distinct(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right, "pt-BR"),
  );
}

/**
 * Junta este índice a outros que são o mesmo índice com outra base de dados,
 * como o Índice de Aridez com BR-DWGD e com ERA5 Land.
 *
 * Mostra quem já está no grupo digitado, porque é pelo nome que os índices se
 * juntam: quem escreve "Índice de Aridez" precisa ver que vai cair ao lado do
 * ERA5 Land, e quem repete uma fonte já usada precisa saber que o seletor vai
 * mostrar duas opções com o mesmo nome.
 */
export function SourceGroupFields({
  value,
  onChange,
  items,
  entryId,
  inputClass,
}: {
  value?: PanelLayerSourceGroup;
  onChange: (value: PanelLayerSourceGroup) => void;
  items: IndexCatalogItem[];
  /** `null` num índice que ainda não foi salvo. */
  entryId: string | null;
  inputClass: string;
}) {
  const sourceGroup = value ?? EMPTY_SOURCE_GROUP;
  const others = otherGroupedItems(items, entryId);
  const groupName = sourceGroup.group.trim();
  const sameGroup = groupName
    ? others.filter((other) => isSameSourceGroup(other.group, groupName))
    : [];
  const repeatedSource = sameGroup.find((other) =>
    isSameSourceGroup(other.source, sourceGroup.source),
  );

  return (
    <fieldset className="mt-7 rounded-lg border border-stone-200 p-4">
      <legend className="px-2 font-bold">Mesmo índice, outras fontes</legend>
      <p className="text-xs text-stone-500">
        Use quando o mesmo índice é calculado com bases de dados diferentes,
        como o Índice de Aridez com BR-DWGD e com ERA5 Land. Os índices com o
        mesmo nome aqui aparecem no Monitoramento como um cartão só, e no
        Detalhamento quem consulta escolhe a fonte dos dados. Deixe os dois
        campos vazios para o índice aparecer como um cartão comum.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">
          Nome do índice no Monitoramento
          <input
            className={inputClass}
            list="source-group-names"
            placeholder="Índice de Aridez"
            value={sourceGroup.group}
            onChange={(event) =>
              onChange({ ...sourceGroup, group: event.target.value })
            }
          />
          <datalist id="source-group-names">
            {distinct(others.map((other) => other.group)).map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
        <label className="text-sm font-medium">
          Fonte dos dados
          <input
            className={inputClass}
            list="source-group-sources"
            placeholder="BR-DWGD"
            value={sourceGroup.source}
            onChange={(event) =>
              onChange({ ...sourceGroup, source: event.target.value })
            }
          />
          <datalist id="source-group-sources">
            {distinct(others.map((other) => other.source)).map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
      </div>
      {groupName &&
        (sameGroup.length > 0 ? (
          <p className="mt-3 text-xs text-stone-600">
            No cartão “{groupName}”, este índice fica ao lado de:{" "}
            {sameGroup
              .map((other) => `${other.name} (fonte ${other.source})`)
              .join(", ")}
            .
          </p>
        ) : (
          <p className="mt-3 text-xs text-stone-600">
            Ainda não há outro índice em “{groupName}”. Enquanto ele for o
            único, aparece no Monitoramento como um cartão comum, com o nome
            dele.
          </p>
        ))}
      {repeatedSource && (
        <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
          “{repeatedSource.name}” já usa a fonte “{repeatedSource.source}” neste
          grupo. Se você publicar assim, o seletor do Detalhamento mostra duas
          opções com o mesmo nome.
        </p>
      )}
    </fieldset>
  );
}
