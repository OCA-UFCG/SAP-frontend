import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PLATFORM_INTRO_COOKIE,
  afterPlatformIntro,
  finishPlatformIntro,
  hasSeenPlatformIntro,
  startPlatformIntro,
} from "@/components/PlatformIntro/platformIntroState";

afterEach(() => {
  finishPlatformIntro();
  document.cookie = `${PLATFORM_INTRO_COOKIE}=; path=/; max-age=0`;
});

describe("abertura da plataforma", () => {
  it("marca o cookie de sessão ao começar", () => {
    expect(hasSeenPlatformIntro()).toBe(false);
    startPlatformIntro();
    expect(hasSeenPlatformIntro()).toBe(true);
  });

  it("libera o tutorial na hora quando não há abertura tocando", () => {
    const startTour = vi.fn();
    afterPlatformIntro(startTour);
    expect(startTour).toHaveBeenCalledTimes(1);
  });

  it("segura o tutorial até a abertura terminar", () => {
    const startTour = vi.fn();
    startPlatformIntro();
    afterPlatformIntro(startTour);
    expect(startTour).not.toHaveBeenCalled();

    finishPlatformIntro();
    expect(startTour).toHaveBeenCalledTimes(1);

    // Terminar de novo (o componente saindo da tela) não repete o tutorial.
    finishPlatformIntro();
    expect(startTour).toHaveBeenCalledTimes(1);
  });

  it("não abre o tutorial de quem saiu da seção durante a abertura", () => {
    const startTour = vi.fn();
    startPlatformIntro();
    const stopWaiting = afterPlatformIntro(startTour);
    stopWaiting();
    finishPlatformIntro();
    expect(startTour).not.toHaveBeenCalled();
  });
});
