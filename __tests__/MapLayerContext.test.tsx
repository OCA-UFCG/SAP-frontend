import { useEffect } from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  MapLayerProvider,
  useMapLayerActions,
  useMapLayerActiveState,
  useMapLayerViewState,
} from "@/components/MapLayerContext/MapLayerContext";

describe("MapLayerContext", () => {
  it("keeps action identities stable across provider re-renders", async () => {
    const seenReferences: Array<{
      setActiveLegend: ReturnType<typeof useMapLayerActions>["setActiveLegend"];
      setSelectedState: ReturnType<
        typeof useMapLayerActions
      >["setSelectedState"];
      setActiveYear: ReturnType<typeof useMapLayerActions>["setActiveYear"];
    }> = [];

    function Probe() {
      const { setActiveLegend, setSelectedState, setActiveYear } =
        useMapLayerActions();
      const { selectedState } = useMapLayerViewState();

      seenReferences.push({
        setActiveLegend,
        setSelectedState,
        setActiveYear,
      });

      useEffect(() => {
        if (selectedState === "br") {
          setSelectedState("ce");
        }
      }, [selectedState, setSelectedState]);

      return null;
    }

    render(
      <MapLayerProvider>
        <Probe />
      </MapLayerProvider>,
    );

    await waitFor(() => {
      expect(seenReferences.length).toBeGreaterThan(1);
    });

    const [firstRender, secondRender] = seenReferences;

    expect(secondRender.setActiveLegend).toBe(firstRender.setActiveLegend);
    expect(secondRender.setSelectedState).toBe(firstRender.setSelectedState);
    expect(secondRender.setActiveYear).toBe(firstRender.setActiveYear);
  });

  it("does not rerender active-layer consumers when only selected state changes", async () => {
    const onActiveStateCommit = vi.fn();
    const seenSelectedStates: string[] = [];

    function ActivityProbe() {
      useMapLayerActiveState();

      useEffect(() => {
        onActiveStateCommit();
      });

      return null;
    }

    function SelectionProbe() {
      const { selectedState } = useMapLayerViewState();

      useEffect(() => {
        seenSelectedStates.push(selectedState);
      }, [selectedState]);

      return null;
    }

    function Driver() {
      const { setSelectedState } = useMapLayerActions();

      useEffect(() => {
        setSelectedState("ce");
      }, [setSelectedState]);

      return null;
    }

    render(
      <MapLayerProvider>
        <ActivityProbe />
        <SelectionProbe />
        <Driver />
      </MapLayerProvider>,
    );

    await waitFor(() => {
      expect(seenSelectedStates).toContain("ce");
    });

    expect(onActiveStateCommit).toHaveBeenCalledTimes(1);
  });
});
