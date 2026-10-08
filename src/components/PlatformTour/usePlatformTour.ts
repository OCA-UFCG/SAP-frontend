"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./platformTour.css";

/**
 * Guardado no navegador, não na conta: é o bastante para o tutorial não voltar
 * a cada visita, sem criar uma preferência por usuário no servidor. Trocar o
 * sufixo faz todo mundo ver de novo — útil se o tutorial mudar bastante.
 */
export const PLATFORM_TOUR_SEEN_KEY = "sedes.platformTour.v1.seen";

/** Espera a página assentar antes de escurecer a tela de quem acabou de chegar. */
const AUTO_START_DELAY_MS = 800;
/** O painel lateral e os acordeões da listagem animam em 300 ms. */
const LAYOUT_TRANSITION_MS = 350;
/** Os controles do mapa montam depois do mapa; o passo espera por eles. */
const WAIT_FOR_ELEMENT_MS = 3000;

export function hasSeenPlatformTour() {
  try {
    return window.localStorage.getItem(PLATFORM_TOUR_SEEN_KEY) === "1";
  } catch {
    // Sem acesso ao armazenamento não há como lembrar que já viu: melhor não
    // abrir sozinho do que abrir em toda visita. O botão continua funcionando.
    return true;
  }
}

function markPlatformTourSeen() {
  try {
    window.localStorage.setItem(PLATFORM_TOUR_SEEN_KEY, "1");
  } catch {
    // Ver de novo na próxima visita é o pior que acontece.
  }
}

/**
 * As categorias da listagem começam fechadas, e o cartão que o tutorial aponta
 * fica escondido dentro delas. Abre, de fora para dentro, cada acordeão fechado
 * (o conteúdo fechado é `inert`) que está no caminho do primeiro cartão.
 *
 * @returns se algum acordeão precisou abrir, para quem chama esperar a animação.
 */
export function revealFirstLayerCard() {
  const card = document.querySelector('[data-tour="layer-card"]');
  const closedTogglers: HTMLElement[] = [];
  let region = card?.closest<HTMLElement>("[inert]");

  while (region) {
    const regionId = region.id;
    const toggler = Array.from(
      document.querySelectorAll<HTMLElement>("[aria-controls]"),
    ).find((element) => element.getAttribute("aria-controls") === regionId);
    if (toggler) closedTogglers.unshift(toggler);
    region = region.parentElement?.closest<HTMLElement>("[inert]");
  }

  closedTogglers.forEach((toggler) => toggler.click());
  return closedTogglers.length > 0;
}

type Translate = ReturnType<typeof useTranslations<"PlatformTour">>;

function buildSteps(t: Translate): DriveStep[] {
  const popover = (key: string) => ({
    title: t(`steps.${key}.title`),
    description: t(`steps.${key}.description`),
  });

  return [
    {
      popover: {
        ...popover("welcome"),
        nextBtnText: t("start"),
        showButtons: ["next", "close"],
        onPopoverRender: (dom, { driver: tour }) => {
          const skipButton = document.createElement("button");
          skipButton.type = "button";
          skipButton.className = "driver-popover-footer-btn sedes-tour-skip-btn";
          skipButton.textContent = t("skip");
          skipButton.addEventListener("click", () => tour.destroy());
          dom.footerButtons.prepend(skipButton);
        },
      },
    },
    {
      element: '[data-tour="platform-sections"]',
      popover: { ...popover("sections"), side: "right", align: "start" },
    },
    {
      element: '[data-tour="spatial-scope"]',
      popover: {
        ...popover("spatialScope"),
        side: "right",
        align: "start",
        onNextClick: (_element, _step, { driver: tour }) => {
          const opened = revealFirstLayerCard();
          window.setTimeout(
            () => tour.moveNext(),
            opened ? LAYOUT_TRANSITION_MS : 0,
          );
        },
      },
    },
    {
      element: '[data-tour="layer-card"]',
      popover: { ...popover("layerCard"), side: "right", align: "start" },
    },
    {
      element: '[data-tour="map-settings"]',
      popover: { ...popover("mapSettings"), side: "left", align: "start" },
    },
    {
      element: '[data-tour="reference-overlays"]',
      popover: { ...popover("territories"), side: "left", align: "end" },
    },
    {
      element: '[data-tour="platform-tour-replay"]',
      popover: { ...popover("replay"), side: "right", align: "end" },
    },
  ];
}

interface UsePlatformTourOptions {
  /** Abre sozinho na primeira visita. */
  autoStart: boolean;
  /**
   * Leva a tela para a listagem de Monitoramento com o painel aberto, de onde o
   * tutorial parte quando a pessoa pede para rever.
   */
  showMonitoringList: () => void;
}

/**
 * O passo a passo da plataforma: abre sozinho na primeira visita à listagem de
 * Monitoramento e pode ser revisto pelo botão "Tutorial" da trilha lateral.
 *
 * @example
 * const replayTour = usePlatformTour({ autoStart, showMonitoringList });
 * <PlatformSideRail onReplayTour={replayTour} />
 */
export function usePlatformTour({
  autoStart,
  showMonitoringList,
}: UsePlatformTourOptions) {
  const t = useTranslations("PlatformTour");
  const tourRef = useRef<Driver | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  const startTour = useCallback(
    (delayMs: number) => {
      window.clearTimeout(timerRef.current);
      tourRef.current?.destroy();

      timerRef.current = window.setTimeout(() => {
        // Marca ao abrir, não ao concluir: quem recarrega no meio do tutorial
        // não é surpreendido por ele de novo, e o botão continua lá.
        markPlatformTourSeen();

        const tour = driver({
          steps: buildSteps(t),
          showProgress: true,
          progressText: "{{current}}/{{total}}",
          nextBtnText: t("next"),
          prevBtnText: t("previous"),
          doneBtnText: t("done"),
          closeBtnLabel: t("close"),
          popoverClass: "sedes-tour",
          // Um clique sem querer fora do balão não deve encerrar o tutorial;
          // para sair há o "×", o Esc e o "Pular".
          overlayClickBehavior: "none",
          // Ligar uma camada no meio do tutorial dispararia o carregamento do
          // Earth Engine por trás do balão.
          disableActiveInteraction: true,
          waitForElement: WAIT_FOR_ELEMENT_MS,
          stagePadding: 6,
          stageRadius: 8,
        });
        tourRef.current = tour;
        tour.drive();
      }, delayMs);
    },
    [t],
  );

  const startTourRef = useRef(startTour);
  useEffect(() => {
    startTourRef.current = startTour;
  }, [startTour]);

  useEffect(() => {
    if (!autoStart || hasSeenPlatformTour()) return;

    startTourRef.current(AUTO_START_DELAY_MS);
  }, [autoStart]);

  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      tourRef.current?.destroy();
    },
    [],
  );

  return useCallback(() => {
    showMonitoringList();
    startTour(LAYOUT_TRANSITION_MS);
  }, [showMonitoringList, startTour]);
}
