"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { BasemapId } from "@/components/Map/Map";
import { BasemapControl } from "./BasemapControl";
import { LayerOpacityControl } from "./LayerOpacityControl";

interface MapSettingsControlProps {
  basemap: BasemapId;
  onBasemapChange: (basemap: BasemapId) => void;
  /** Ausente quando nenhuma camada está no mapa: sem camada não há o que clarear. */
  opacity?: number;
  onOpacityChange?: (opacity: number) => void;
}

/**
 * Mapa base e Transparência atrás de um botão do tamanho dos controles de zoom.
 * Antes eles ficavam abertos no canto do mapa e comiam ~100px de altura o tempo
 * todo, mesmo para quem nunca os ajusta.
 *
 * @example
 * <MapSettingsControl basemap={basemap} onBasemapChange={setBasemap} />
 */
export function MapSettingsControl({
  basemap,
  onBasemapChange,
  opacity,
  onOpacityChange,
}: MapSettingsControlProps) {
  const t = useTranslations("PlatformMap");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useOutsideClose(containerRef, isOpen, () => setIsOpen(false));

  return (
    // O `top` acompanha a pilha de controles do MapLibre no canto superior
    // direito (margem de 50px do globals.css + atribuição + zoom + bússola),
    // e o `right-2.5` empata com a margem de 10px que a folha deles usa.
    <div
      ref={containerRef}
      className="absolute right-2.5 top-[202px] z-[1000] flex flex-col items-end gap-2"
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={t("mapSettings")}
        title={t("mapSettings")}
        className={`flex h-[29px] w-[29px] items-center justify-center rounded border border-[#EFEFEF] shadow-[0_0_0_2px_rgba(0,0,0,0.1)] transition-colors ${
          isOpen
            ? "bg-[#989F43] text-white"
            : "bg-white text-[#292829] hover:bg-[#E4E5E2]"
        }`}
      >
        <MapSettingsIcon />
      </button>
      {isOpen && (
        <div className="flex flex-col items-end gap-2.5">
          <BasemapControl basemap={basemap} onChange={onBasemapChange} />
          {opacity !== undefined && onOpacityChange && (
            <LayerOpacityControl opacity={opacity} onChange={onOpacityChange} />
          )}
        </div>
      )}
    </div>
  );
}

/** Fecha o painel ao clicar no mapa, como os outros menus flutuantes da plataforma. */
function useOutsideClose(
  containerRef: React.RefObject<HTMLDivElement | null>,
  isOpen: boolean,
  close: () => void,
) {
  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && !containerRef.current?.contains(target)) close();
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [containerRef, isOpen, close]);
}

function MapSettingsIcon(): ReactNode {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M2.5 4.5H7M10.5 4.5H13.5M2.5 11.5H5.5M9 11.5H13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle
        cx="8.75"
        cy="4.5"
        r="1.75"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="7.25"
        cy="11.5"
        r="1.75"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
