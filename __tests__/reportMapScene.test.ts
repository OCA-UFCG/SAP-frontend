import { afterEach, describe, expect, it, vi } from "vitest";

const { acquireReportMapMock, releaseReportMapMock } = vi.hoisted(() => ({
  acquireReportMapMock: vi.fn(),
  releaseReportMapMock: vi.fn(),
}));

vi.mock("@/components/MunicipalReport/reportMapPool", () => ({
  acquireReportMap: acquireReportMapMock,
  markReportMapUnusable: vi.fn(),
  releaseReportMap: releaseReportMapMock,
}));

import {
  clearReportMapScenes,
  loadReportMapScene,
  projectBoundsToCanvas,
} from "@/components/MunicipalReport/reportMapScene";

describe("projectBoundsToCanvas", () => {
  // O MapLibre mede em pixels CSS; numa tela com densidade 2, o canvas tem o
  // dobro, e a miniatura colada na medida CSS ocuparia só um quarto do quadro.
  it("leva o retângulo da miniatura para pixels do canvas", () => {
    const map = {
      project: ([longitude, latitude]: [number, number]) => ({
        x: (longitude + 48) * 100,
        y: (-15 - latitude) * 100,
      }),
      getCanvas: () => ({ width: 1392 }),
      getContainer: () => ({ clientWidth: 696 }),
    };

    expect(
      projectBoundsToCanvas(
        map as unknown as Parameters<typeof projectBoundsToCanvas>[0],
        [-47.5, -18.0, -44.0, -15.5],
      ),
    ).toEqual({ x: 100, y: 100, width: 700, height: 500 });
  });
});

describe("loadReportMapScene", () => {
  afterEach(() => {
    clearReportMapScenes();
    acquireReportMapMock.mockReset();
    releaseReportMapMock.mockReset();
    document.body.innerHTML = "";
  });

  const request = {
    key: "5200050|inteiro",
    width: 696,
    height: 322,
    thumbnailBbox: [-47.3, -16.2, -46.7, -15.8] as [
      number,
      number,
      number,
      number,
    ],
    prepare: vi.fn(),
  };

  it("desenha o cenário uma vez para todos os mapas que pedem juntos", async () => {
    acquireReportMapMock.mockResolvedValue({ map: {}, prepared: false });

    const first = loadReportMapScene(request);
    const second = loadReportMapScene(request);

    expect(second).toBe(first);
    await first;
    expect(acquireReportMapMock).toHaveBeenCalledTimes(1);
  });

  // Uma falha guardada prenderia todos os mapas do relatório: a nova tentativa
  // da fila precisa desenhar o cenário de novo.
  it("esquece o cenário que falhou e devolve o mapa e o contêiner", async () => {
    acquireReportMapMock.mockResolvedValue({ map: {}, prepared: false });

    await expect(loadReportMapScene(request)).resolves.toBeNull();
    expect(releaseReportMapMock).toHaveBeenCalledTimes(1);
    expect(document.body.children).toHaveLength(0);

    await loadReportMapScene(request);
    expect(acquireReportMapMock).toHaveBeenCalledTimes(2);
  });
});
