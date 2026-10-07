"use client";

import dynamic from "next/dynamic";
import type { MapProps } from "./Map";

import { useTranslations } from "next-intl";

/**
 * O mapa é um pedaço grande de JavaScript e chega depois do resto da página.
 * Este é o primeiro estado visível da plataforma, então precisa ocupar a área
 * inteira e dizer o que está acontecendo — antes era um parágrafo solto no canto
 * da tela.
 */
const MapLoading = () => {
  const t = useTranslations("MapComponent");

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#E4E5E2]"
    >
      <div
        aria-hidden="true"
        className="h-10 w-10 animate-spin rounded-full border-2 border-[#E1E2B4] border-t-[#777E32]"
      />
      <p className="text-[15px] text-neutral-600">{t("loading")}</p>
    </div>
  );
};

const MapComponent = dynamic<MapProps>(
  () => import("./Map").then((mod) => mod.default),
  {
    loading: MapLoading,
    ssr: false,
  },
);

export default MapComponent;
