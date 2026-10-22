"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** Quanto o aviso fica na tela depois que a camada chega. */
const DONE_MS = 1100;
/**
 * Abaixo disso o aviso nem aparece: a camada que já está em cache chega em
 * ~200 ms, e piscar o mapa de cinza por esse tempo chama mais atenção do que a
 * própria troca.
 */
const SHOW_AFTER_MS = 250;

type Phase = "idle" | "waiting" | "shown" | "done";

interface LoadingState {
  phase: Phase;
  dimMap: boolean;
  layerName?: string;
}

interface MapLayerLoadingProps {
  /** Alguma camada, do índice ou dos territórios, ainda está chegando. */
  isLoading: boolean;
  /** É o índice que está chegando: o mapa espera sem cor até o último bloco. */
  dimMap: boolean;
  /** Nome do índice ligado. Some quando a pessoa desliga o índice. */
  layerName?: string;
  /** O pedido do índice falhou, então o aviso sai sem dizer que ele chegou. */
  failed: boolean;
}

/**
 * O aviso de camada carregando. O mapa fica sem cor, com um fio oliva correndo
 * na borda de cima, e os blocos do Earth Engine chegam por baixo do cinza.
 * Quando chega o último, a cor volta de uma vez e a moldura solta o mesmo anel
 * do "Gerar relatório". Assim a pessoa não vê o Brasil se montar em pedaços.
 *
 * Ocupa só o mapa visível, à direita do painel lateral, pela mesma variável
 * que posiciona a escala. Fica abaixo dos controles do MapLibre (z-index 2), que
 * continuam com cor e clicáveis.
 */
export function MapLayerLoading({
  isLoading,
  dimMap,
  layerName,
  failed,
}: MapLayerLoadingProps) {
  const t = useTranslations("PlatformMap");
  const [state, setState] = useState<LoadingState>({
    phase: isLoading ? "waiting" : "idle",
    dimMap,
    layerName,
  });

  // A fase muda durante a renderização, e não num efeito, para o aviso sair no
  // mesmo quadro em que a camada fica pronta.
  if (isLoading && (state.phase === "idle" || state.phase === "done")) {
    setState({ phase: "waiting", dimMap, layerName });
  } else if (
    isLoading &&
    (state.dimMap !== dimMap || state.layerName !== layerName)
  ) {
    setState({ ...state, dimMap, layerName });
  } else if (
    !isLoading &&
    (state.phase === "waiting" || state.phase === "shown")
  ) {
    const arrived =
      state.phase === "shown" &&
      state.dimMap &&
      !failed &&
      Boolean(layerName) &&
      layerName === state.layerName;
    setState({ ...state, phase: arrived ? "done" : "idle" });
  }

  useEffect(() => {
    if (state.phase !== "waiting" && state.phase !== "done") return;
    const timer = setTimeout(
      () =>
        setState((current) =>
          current.phase === "waiting"
            ? { ...current, phase: "shown" }
            : current.phase === "done"
              ? { ...current, phase: "idle" }
              : current,
        ),
      state.phase === "waiting" ? SHOW_AFTER_MS : DONE_MS,
    );
    return () => clearTimeout(timer);
  }, [state.phase]);

  if (state.phase === "idle") return null;

  const isDone = state.phase === "done";

  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-0 z-[1] overflow-hidden transition-[left] duration-300 ease-in-out"
      style={{ left: "var(--platform-map-scale-offset, 0px)" }}
    >
      {state.dimMap && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 bg-[rgba(245,243,239,0.32)] [backdrop-filter:grayscale(0.75)_brightness(1.03)] ${
            isDone
              ? "animate-[map-loading-out_520ms_ease-out_forwards]"
              : "animate-[map-loading-in_380ms_ease-out_250ms_backwards]"
          }`}
        />
      )}

      <div
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-[3px] overflow-hidden bg-[#E1E2B4]/70 ${
          isDone
            ? "animate-[map-loading-out_300ms_ease-out_260ms_forwards]"
            : "animate-[map-loading-in_200ms_ease-out_250ms_backwards]"
        }`}
      >
        <span
          className={`absolute inset-y-0 left-0 bg-[#646B2D] shadow-[0_0_10px_rgba(152,159,67,0.8)] ${
            isDone
              ? "w-full"
              : "w-2/5 motion-safe:animate-[map-loading-bar_1.25s_cubic-bezier(0.45,0,0.55,1)_infinite]"
          }`}
        />
      </div>

      {isDone && (
        <div
          aria-hidden="true"
          className="absolute inset-0 motion-safe:animate-[map-ready-ring_800ms_ease-out_forwards]"
        />
      )}

      <div
        role="status"
        aria-live="polite"
        aria-label={isDone ? undefined : t("loadingGeeLayer")}
        className={`absolute left-4 top-3.5 flex max-w-[calc(100%-120px)] items-center gap-2 rounded-full border border-[#EFEFEF] bg-white py-1.5 pl-2.5 pr-3 font-open-sans text-xs text-[#292829] shadow-[0_6px_18px_rgba(41,40,41,0.12)] ${
          isDone
            ? "animate-[map-loading-out_260ms_ease-in_700ms_forwards]"
            : "animate-[map-loading-in_300ms_ease-out_250ms_backwards]"
        }`}
      >
        {isDone ? (
          <span
            aria-hidden="true"
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#646B2D] text-white motion-safe:animate-[pop-in_380ms_cubic-bezier(0.2,0.7,0.2,1)]"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full bg-[#646B2D] motion-safe:animate-[map-loading-dot_1s_ease-in-out_infinite]"
          />
        )}
        <span className="truncate">
          {isDone ? (
            <>
              <b className="font-semibold">{state.layerName}</b>{" "}
              {t("layerReady")}
            </>
          ) : state.dimMap && state.layerName ? (
            <>
              {t("loadingLayer")}{" "}
              <b className="font-semibold">{state.layerName}</b>
            </>
          ) : (
            t("loadingMapLayer")
          )}
        </span>
      </div>
    </div>
  );
}
