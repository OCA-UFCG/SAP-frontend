import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { LegacyMapAssetFields } from "@/components/IndexCatalog/LegacyMapAssetFields";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

/** Um asset por período, como `deg` está gravado. */
const perPeriodAssets = {
  panelLayerId: "deg",
  assets: {
    rows: [
      { period: "2001", imageId: "projects/ee-oca/assets/deg_2001" },
      { period: "2020", imageId: "projects/ee-oca/assets/deg_2020" },
    ],
  },
};

/** Catorze períodos na mesma FeatureCollection, como os índices de pobreza. */
const sharedAssets = {
  panelLayerId: "pob_total",
  assets: {
    rows: Array.from({ length: 14 }, (_, index) => ({
      period: String(2010 + index),
      imageId: "projects/ee-oca/assets/pob_total",
    })),
    sharedImageId: "projects/ee-oca/assets/pob_total",
  },
};

function renderFields() {
  const onSaved = vi.fn();
  render(
    <LegacyMapAssetFields
      entryId="entry-legacy"
      inputClass="input"
      buttonClass="button"
      disabled={false}
      onSaved={onSaved}
    />,
  );
  return { onSaved };
}

function requestBody(call: number) {
  const [, init] = vi.mocked(fetch).mock.calls[call] as [string, RequestInit];
  return JSON.parse(String(init.body)) as {
    assets: Array<{ period: string; imageId: string }>;
  };
}

describe("LegacyMapAssetFields", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse(perPeriodAssets)),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mostra uma linha por período e envia a troca de um só", async () => {
    renderFields();

    const field = await screen.findByLabelText("2001");
    expect(field).toHaveValue("projects/ee-oca/assets/deg_2001");
    expect(screen.getByLabelText("2020")).toHaveValue(
      "projects/ee-oca/assets/deg_2020",
    );

    fireEvent.change(field, {
      target: { value: "projects/ee-oca/assets/deg_2001_v5" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar assets do mapa" }),
    );

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2));
    expect(requestBody(1).assets).toEqual([
      { period: "2001", imageId: "projects/ee-oca/assets/deg_2001_v5" },
      { period: "2020", imageId: "projects/ee-oca/assets/deg_2020" },
    ]);
  });

  it("mostra um campo só quando todos os períodos usam o mesmo asset, e troca todos de uma vez", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => jsonResponse(sharedAssets)),
    );
    renderFields();

    const field = await screen.findByLabelText(
      /Asset usado pelos 14 períodos/u,
    );
    fireEvent.change(field, {
      target: { value: "projects/ee-oca/assets/pob_total_v2" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar assets do mapa" }),
    );

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2));
    const sent = requestBody(1).assets;
    expect(sent).toHaveLength(14);
    expect(
      sent.every(
        (asset) => asset.imageId === "projects/ee-oca/assets/pob_total_v2",
      ),
    ).toBe(true);
  });

  it("diz que a troca só entra no ar na publicação", async () => {
    renderFields();
    const field = await screen.findByLabelText("2001");

    vi.mocked(fetch).mockImplementationOnce(() =>
      jsonResponse({ ...perPeriodAssets, changed: "o asset do período 2001" }),
    );
    fireEvent.change(field, {
      target: { value: "projects/ee-oca/assets/deg_2001_v5" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar assets do mapa" }),
    );

    expect(
      await screen.findByText(
        /publique o índice para que a troca entre no ar/u,
      ),
    ).toBeInTheDocument();
  });

  it("mostra o motivo quando o servidor recusa a troca", async () => {
    renderFields();
    const field = await screen.findByLabelText("2001");

    vi.mocked(fetch).mockImplementationOnce(() =>
      jsonResponse(
        {
          error:
            "O período 2001 tira o tempo de previsão do fim do nome do asset.",
        },
        400,
      ),
    );
    fireEvent.change(field, {
      target: { value: "projects/ee-oca/assets/deg_2001_03" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar assets do mapa" }),
    );

    expect(
      await screen.findByText(/tira o tempo de previsão/u),
    ).toBeInTheDocument();
  });
});
