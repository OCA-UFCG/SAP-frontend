"use client";

import { useTranslations } from "next-intl";
import {
  MAP_CONTROL_LABEL_CLASS,
  MapControlDisclosure,
} from "@/components/MapControls/MapControlCard";
import { IImageParam } from "@/utils/interfaces";

/** A chave de tradução do rótulo vem do próprio texto do Contentful. */
const toLabelSlug = (label: string) =>
  label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/</g, "menor-que")
    .replace(/>/g, "maior-que")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

/**
 * A legenda do índice ativo, no mesmo cartão de Territórios, Mapa base e
 * Transparência — antes ela usava outra fonte, outro tamanho e um cabeçalho
 * próprio, e destoava das caixas vizinhas.
 */
export function PlatformMapCaption({ legend }: { legend: IImageParam[] }) {
  const t = useTranslations("PlatformMapCaption");
  const shouldScroll = legend.length > 6;

  return (
    <MapControlDisclosure label={t("title")}>
      {() => (
        <div
          className={`flex flex-col gap-1.5 ${shouldScroll ? "max-h-[168px] overflow-y-auto pr-2" : ""}`}
        >
          {legend.map((item) => {
            const slug = toLabelSlug(item.label);
            const displayLabel = t.has(`labels.${slug}`)
              ? t(`labels.${slug}`)
              : item.label;

            return (
              <div key={item.label} className="flex items-center gap-3">
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-[#C4C4C4]"
                  style={{ backgroundColor: item.color }}
                />
                <span className={MAP_CONTROL_LABEL_CLASS}>{displayLabel}</span>
              </div>
            );
          })}
        </div>
      )}
    </MapControlDisclosure>
  );
}
