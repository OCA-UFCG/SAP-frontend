import { useEffect } from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  MapLayerProvider,
  useMapLayer,
} from "@/components/MapLayerContext/MapLayerContext";

describe("MapLayerContext", () => {
  it("keeps action identities stable across provider re-renders", async () => {
    const seenReferences: Array<{
      setActiveLegend: ReturnType<typeof useMapLayer>["setActiveLegend"];
      setSelectedState: ReturnType<typeof useMapLayer>["setSelectedState"];
      setActiveYear: ReturnType<typeof useMapLayer>["setActiveYear"];
    }> = [];

    function Probe() {
      const {
        setActiveLegend,
        setSelectedState,
        setActiveYear,
        selectedState,
      } = useMapLayer();

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
});
