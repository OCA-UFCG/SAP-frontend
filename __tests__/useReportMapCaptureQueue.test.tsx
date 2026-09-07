import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  REPORT_MAP_CAPTURE_CONCURRENCY,
  selectActiveReportMapKeys,
  useReportMapCaptureQueue,
} from "@/components/MunicipalReport/useReportMapCaptureQueue";

describe("selectActiveReportMapKeys", () => {
  it.each([1, 2, 3, 4, 12])(
    "limits %i queued maps to the configured concurrency",
    (count) => {
      const keys = Array.from({ length: count }, (_, index) => `map-${index}`);
      expect(selectActiveReportMapKeys(keys, new Set(), null)).toEqual(
        keys.slice(0, REPORT_MAP_CAPTURE_CONCURRENCY),
      );
    },
  );

  it("fills a free slot when maps complete out of order", () => {
    expect(
      selectActiveReportMapKeys(
        ["map-0", "map-1", "map-2", "map-3", "map-4", "map-5"],
        new Set(["map-1"]),
        null,
      ),
    ).toEqual(["map-0", "map-2", "map-3", "map-4", "map-5"]);
  });

  // O relatório tem 20 mapas e 5 vagas: preencher na ordem do documento fazia
  // quem estava lendo a última seção esperar todas as anteriores. Medido em
  // Juazeiro - BA, a espera na fila foi de 8450 ms de mediana e 15 202 ms no
  // pior mapa.
  it("dá as vagas primeiro aos mapas que estão na tela", () => {
    const keys = ["map-0", "map-1", "map-2", "map-3", "map-4", "map-5"];

    expect(
      selectActiveReportMapKeys(keys, new Set(), null, 3, {
        visibleKeys: new Set(["map-4", "map-5"]),
      }),
    ).toEqual(["map-4", "map-5", "map-0"]);
  });

  it("mantém a ordem do documento entre os mapas visíveis", () => {
    const keys = ["map-0", "map-1", "map-2", "map-3"];

    expect(
      selectActiveReportMapKeys(keys, new Set(), null, 4, {
        visibleKeys: new Set(["map-3", "map-1"]),
      }),
    ).toEqual(["map-1", "map-3", "map-0", "map-2"]);
  });

  it("não repete um mapa já capturado que continua na tela", () => {
    const keys = ["map-0", "map-1", "map-2"];

    expect(
      selectActiveReportMapKeys(keys, new Set(["map-1"]), null, 2, {
        visibleKeys: new Set(["map-1", "map-2"]),
      }),
    ).toEqual(["map-2", "map-0"]);
  });

  it("volta à ordem do documento quando nada foi reportado como visível", () => {
    const keys = ["map-0", "map-1", "map-2", "map-3"];

    expect(
      selectActiveReportMapKeys(keys, new Set(), null, 2, {
        visibleKeys: new Set(),
      }),
    ).toEqual(["map-0", "map-1"]);
  });

  it("reduces concurrency to one while retrying a failed capture", () => {
    expect(
      selectActiveReportMapKeys(
        ["map-0", "map-1", "map-2"],
        new Set(),
        "map-1",
      ),
    ).toEqual(["map-1"]);
  });
});

describe("useReportMapCaptureQueue", () => {
  it("retries a failed capture once in serial mode before completing it", () => {
    const { result } = renderHook(() =>
      useReportMapCaptureQueue(["map-0", "map-1", "map-2"]),
    );

    expect([...result.current.activeMapKeys]).toEqual([
      "map-0",
      "map-1",
      "map-2",
    ]);

    act(() => result.current.handleMapCapture("map-1", null));

    expect([...result.current.activeMapKeys]).toEqual(["map-1"]);
    expect(result.current.retryAttemptFor("map-1")).toBe(1);
    expect(result.current.mapsReady).toBe(false);

    act(() => result.current.handleMapCapture("map-1", null));

    expect(result.current.mapImages.get("map-1")).toBeNull();
    expect([...result.current.activeMapKeys]).toEqual(["map-0", "map-2"]);
  });

  it("accepts out-of-order successes without exceeding concurrency", () => {
    const { result } = renderHook(() =>
      useReportMapCaptureQueue(["map-0", "map-1", "map-2"]),
    );

    act(() => result.current.handleMapCapture("map-1", "image-1"));
    expect([...result.current.activeMapKeys]).toEqual(["map-0", "map-2"]);

    act(() => {
      result.current.handleMapCapture("map-2", "image-2");
      result.current.handleMapCapture("map-0", "image-0");
    });

    expect(result.current.mapsReady).toBe(true);
    expect(result.current.mapImages).toEqual(
      new Map([
        ["map-1", "image-1"],
        ["map-2", "image-2"],
        ["map-0", "image-0"],
      ]),
    );
  });

  it("passa a priorizar o mapa avisado como visível", () => {
    const { result } = renderHook(() =>
      useReportMapCaptureQueue([
        "map-0",
        "map-1",
        "map-2",
        "map-3",
        "map-4",
        "map-5",
      ]),
    );

    expect(result.current.activeMapKeys.has("map-5")).toBe(false);

    act(() => result.current.handleMapVisibility("map-5", true));

    expect([...result.current.activeMapKeys]).toEqual([
      "map-5",
      "map-0",
      "map-1",
      "map-2",
      "map-3",
    ]);

    act(() => result.current.handleMapVisibility("map-5", false));

    expect(result.current.activeMapKeys.has("map-5")).toBe(false);
  });

  it("conta quantos mapas ainda faltam", () => {
    const { result } = renderHook(() =>
      useReportMapCaptureQueue(["map-0", "map-1", "map-2"]),
    );

    expect(result.current.pendingMapCount).toBe(3);

    act(() => result.current.handleMapCapture("map-1", "image-1"));

    expect(result.current.pendingMapCount).toBe(2);
  });

  it("cancels queue state before a different report starts", () => {
    const { result } = renderHook(() =>
      useReportMapCaptureQueue(["map-0", "map-1", "map-2"]),
    );

    act(() => result.current.handleMapCapture("map-0", "image-0"));
    expect(result.current.mapImages.size).toBe(1);

    act(() => result.current.resetMapCaptureQueue());

    expect(result.current.mapImages.size).toBe(0);
    expect(result.current.retryAttemptFor("map-0")).toBe(0);
    expect([...result.current.activeMapKeys]).toEqual([
      "map-0",
      "map-1",
      "map-2",
    ]);
  });
});
