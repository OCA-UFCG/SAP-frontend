"use client";

import clsx from "clsx";
import Image from "next/image";
import { normalizeContentfulImage } from "@/utils/functions";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { InfoModal } from "../InfoModal/InfoModal";
import type { ImageDataConfig } from "@/utils/interfaces";
import { slugifyTranslationKey } from "@/utils/translations";

export interface IDroughtDataset {
  id: number;
  title: string;
  description: string;
  image?: string;
  fileRef?: string;
  imageData?: ImageDataConfig | null;
  timeScale?: string;
}

function InfoIcon() {
  return (
    <svg width="16" height="16" aria-hidden className="text-[#2C1E1C]">
      <use href="/sprite.svg#info" />
    </svg>
  );
}

export function DroughtDataset({
  card,
  imageData,
  active = false,
  disabled = false,
  onToggle,
  onDetails,
}: {
  card: IDroughtDataset;
  imageData?: ImageDataConfig | null;
  active?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
  onDetails?: () => void;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const t = useTranslations("DroughtDataset");
  const tModules = useTranslations("ModulesContext.Layers");

  const slug = slugifyTranslationKey(card.title);

  const displayTitle = tModules.has(`${slug}.title`) ? tModules(`${slug}.title`, { title: card.title }) : card.title;

  return (
    <>
      {/* No hover o cartão sobe e a miniatura aproxima; ligado no mapa, ganha a
          borda verde e solta um anel uma vez, para a pessoa ver que pegou. */}
      <div
        data-tour="layer-card"
        className={clsx(
          "group/card flex flex-row items-center gap-3 w-full p-3 bg-white border shadow-sm rounded-lg shrink-0 transition-[translate,box-shadow,border-color] duration-300 ease-out",
          // No celular os botões descem para uma linha só deles, com a largura
          // do cartão: ao lado da imagem, em 360 px, sobravam 64 px para o
          // "Detalhamento", que saía "Detalha...".
          "max-sm:grid max-sm:grid-cols-[auto_minmax(0,1fr)]",
          !disabled &&
            "motion-safe:hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(33,36,15,0.10)]",
          active
            ? "border-[#646B2D] motion-safe:animate-[ready-ring_700ms_ease-out]"
            : "border-[#EFEFEF] hover:border-[#CCCF87]",
        )}
      >
        {/* 80px, e não 96: no Windows a barra de rolagem do painel come 17px e,
            com a imagem maior, o "Detalhamento" saía cortado. */}
        <div className="relative shrink-0 size-20 overflow-hidden rounded-md max-sm:size-16">
          {card.image ? (
            <Image
              src={normalizeContentfulImage(card.image)}
              alt={displayTitle}
              fill
              sizes="80px"
              className="object-cover transition-[scale] duration-500 ease-out motion-safe:group-hover/card:scale-110"
            />
          ) : (
            <div className="absolute inset-0 bg-[#E4E5E2]" />
          )}
        </div>

        {/* Título inteiro e, embaixo, os botões; a descrição fica no "i" */}
        <div className="flex flex-col gap-3 flex-1 min-w-0 max-sm:contents">
          <span className="font-inter font-semibold text-[1rem] leading-[22px] tracking-[-0.015em] text-[#292829] break-words">
            {displayTitle}
          </span>

          <div className="flex flex-row items-center gap-1.5 max-sm:col-span-2">
            {/* Toggle (apply/unapply layer) */}
            <button
              type="button"
              role="switch"
              aria-checked={active}
              aria-label={
                active
                  ? t("deactivateLayer", { title: displayTitle })
                  : t("activateLayer", { title: displayTitle })
              }
              onClick={onToggle}
              disabled={disabled}
              className={clsx(
                "relative w-11 h-6 shrink-0 rounded-full transition-colors",
                active ? "bg-[#646B2D]" : "bg-[#E4E5E2]",
                disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#646B2D] focus-visible:ring-offset-2",
              )}
            >
              {/* Bolinha com mola: passa um pouco do ponto e volta. */}
              <span
                className={clsx(
                  "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                  active ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>

            {/* Detalhamento (open analysis context) */}
            <button
              type="button"
              onClick={onDetails}
              disabled={disabled}
              // Com o nome do produto: numa lista de "Detalhamento" iguais, o
              // leitor de tela não dizia de qual produto era cada um.
              aria-label={t("detailsFor", { title: displayTitle })}
              className={clsx(
                "flex flex-row justify-center items-center gap-1 px-2 h-10 min-w-0 flex-1 bg-[#646B2D] rounded-[6px]",
                disabled
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer transition-[background-color,scale] duration-200 hover:bg-[#4F5424] active:scale-[0.97]",
              )}
            >
              <span className="font-open-sans text-[0.875rem] leading-[24px] font-normal text-white truncate">
                {t("details")}
              </span>
            </button>

            {/* Botão de informações — abre o InfoModal */}
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              disabled={disabled}
              aria-label={t("moreInformation", { title: displayTitle })}
              className={clsx(
                "group/info box-border flex flex-row justify-center items-center p-2 w-10 h-10 bg-white border border-[#E4E5E2] rounded-[6px] shrink-0",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-[#F5F6EE] transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#646B2D] focus-visible:ring-offset-2",
              )}
            >
              <span className="flex transition-[scale] duration-200 motion-safe:group-hover/info:scale-125">
                <InfoIcon />
              </span>
            </button>
          </div>
        </div>
      </div>
      <InfoModal
        card={card}
        imageData={imageData}
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        onLearnMore={disabled ? undefined : onDetails}
      />
    </>
  );
}
