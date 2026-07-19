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
