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
 * Opacidade — antes ela usava outra fonte, outro tamanho e um cabeçalho
 * próprio, e destoava das caixas vizinhas.
 *
 * Nasce aberta: quem liga um índice vê o mapa mudar de cor e precisa saber na
 * hora o que cada cor quer dizer. O mapa remonta a legenda a cada índice
 * ligado, então ela reabre mesmo que a pessoa a tenha fechado no anterior.
 */
export function PlatformMapCaption({ legend }: { legend: IImageParam[] }) {
  const t = useTranslations("PlatformMapCaption");
  const shouldScroll = legend.length > 6;

  return (
    <MapControlDisclosure label={t("title")} defaultOpen>
      {/* No celular, em duas colunas: numa coluna só, Legendas e Territórios
          cobriam a metade de baixo do mapa — justamente o Nordeste. */}
      {() => (
        <ul
          aria-label={t("title")}
          className={`legend-cascade flex flex-col gap-1.5 max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-1 ${shouldScroll ? "max-h-[168px] overflow-y-auto pr-2 max-md:max-h-[104px]" : ""}`}
        >
          {legend.map((item) => {
            const slug = toLabelSlug(item.label);
            const displayLabel = t.has(`labels.${slug}`)
              ? t(`labels.${slug}`)
              : item.label;

            return (
              <li
                key={item.label}
                className="flex items-center gap-3 max-md:gap-2"
              >
                <span
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 rounded-full border border-[#C4C4C4] max-md:h-3 max-md:w-3"
                  style={{ backgroundColor: item.color }}
                />
                <span className={MAP_CONTROL_LABEL_CLASS}>{displayLabel}</span>
              </li>
            );
          })}
        </ul>
      )}
    </MapControlDisclosure>
  );
}
