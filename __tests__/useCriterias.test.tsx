import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import useCriterias, {
  resetCriteriasCache,
} from "@/components/Amfe/useCriterias";
import { CriterionMetadata } from "@/utils/amfeInterfaces";

const CATALOG: CriterionMetadata[] = [
  {
    name: "precipitation",
    label: "Precipitação",
    is_benefit: true,
    unit: "mm",
    description: null,
    default: true,
  },
];

/** Fake do endpoint de catálogo, contando quantas cargas chegam à rede. */
class CriteriasEndpointFake {
  calls = 0;

  constructor(private readonly failWith?: string) {}

  fetch = async () => {
    this.calls += 1;

    if (this.failWith) {
      return new Response(JSON.stringify({ error: this.failWith }), {
        status: 500,
      });
    }

    return new Response(JSON.stringify(CATALOG), { status: 200 });
  };
}

const CriteriasConsumer = ({ testId }: { testId: string }) => {
  const { criterias, error } = useCriterias();

  return (
    <span data-testid={testId}>
      {error ?? criterias.map((criterion) => criterion.name).join(",")}
    </span>
  );
};

beforeEach(() => {
  // Este projeto não liga o cleanup automático do Testing Library; sem isto os
  // renders de um teste vazam para o seguinte.
  cleanup();
  resetCriteriasCache();
  vi.unstubAllGlobals();
});

describe("useCriterias", () => {
  it("loads the catalog once for every consumer on the screen", async () => {
    const endpoint = new CriteriasEndpointFake();
    vi.stubGlobal("fetch", endpoint.fetch);

    render(
      <>
        <CriteriasConsumer testId="form" />
        <CriteriasConsumer testId="slider" />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("form")).toHaveTextContent("precipitation");
      expect(screen.getByTestId("slider")).toHaveTextContent("precipitation");
    });
    expect(endpoint.calls).toBe(1);
  });

  it("serves a later mount from the cache instead of hitting the network again", async () => {
    const endpoint = new CriteriasEndpointFake();
    vi.stubGlobal("fetch", endpoint.fetch);

    const first = render(<CriteriasConsumer testId="first" />);
    await waitFor(() =>
      expect(screen.getByTestId("first")).toHaveTextContent("precipitation"),
    );
    first.unmount();

    render(<CriteriasConsumer testId="second" />);
    await waitFor(() =>
      expect(screen.getByTestId("second")).toHaveTextContent("precipitation"),
    );
    expect(endpoint.calls).toBe(1);
  });

  it("retries after a failure instead of caching the error for the session", async () => {
    const failing = new CriteriasEndpointFake("backend indisponível");
    vi.stubGlobal("fetch", failing.fetch);

    const first = render(<CriteriasConsumer testId="first" />);
    await waitFor(() =>
      expect(screen.getByTestId("first")).toHaveTextContent(
        "backend indisponível",
      ),
    );
    first.unmount();

    const recovered = new CriteriasEndpointFake();
    vi.stubGlobal("fetch", recovered.fetch);

    render(<CriteriasConsumer testId="second" />);
    await waitFor(() =>
      expect(screen.getByTestId("second")).toHaveTextContent("precipitation"),
    );
    expect(recovered.calls).toBe(1);
  });
});
