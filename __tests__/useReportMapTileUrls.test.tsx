import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/municipalReportMetrics", () => ({
  startMunicipalReportStage: vi.fn(() => vi.fn()),
}));

vi.mock("@/services/mapServices", () => ({
  fetchReportMapURLs: vi.fn(),
}));

import { useReportMapTileUrls } from "@/components/MunicipalReport/useReportMapTileUrls";
import { fetchReportMapURLs } from "@/services/mapServices";

const mockedFetchReportMapURLs = vi.mocked(fetchReportMapURLs);

const MAP_KEYS = ["anaseca:2024-12", "prev_precipitacao:2026-05", "deg:2021"];

describe("useReportMapTileUrls", () => {
  beforeEach(() => {
    mockedFetchReportMapURLs.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Regressão: uma requisição por camada estourava o limite do /api/ee e as
  // últimas camadas do relatório saíam sem imagem do mapa.
  it("asks for every layer of the report in a single request", async () => {
    mockedFetchReportMapURLs.mockResolvedValue([]);

    renderHook(() => useReportMapTileUrls(MAP_KEYS));

    await waitFor(() =>
      expect(mockedFetchReportMapURLs).toHaveBeenCalledTimes(1),
    );
    expect(mockedFetchReportMapURLs.mock.calls[0][0]).toEqual([
      { name: "anaseca", year: "2024-12" },
      { name: "prev_precipitacao", year: "2026-05" },
      { name: "deg", year: "2021" },
    ]);
  });

  it("separates resolved URLs from the layers without an image", async () => {
    mockedFetchReportMapURLs.mockResolvedValue([
      { name: "anaseca", year: "2024-12", url: "https://tiles.example/a" },
      {
        name: "prev_precipitacao",
        year: "2026-05",
        status: "year_not_found",
      },
      { name: "deg", year: "2021", status: "rate_limited" },
    ]);

    const { result } = renderHook(() => useReportMapTileUrls(MAP_KEYS));

    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.tileUrlFor("anaseca:2024-12")).toBe(
      "https://tiles.example/a",
    );
    expect(result.current.failureFor("prev_precipitacao:2026-05")).toBe(
      "year_not_found",
    );
    expect(result.current.failureFor("deg:2021")).toBe("rate_limited");
    expect([...result.current.unavailableKeys]).toEqual([
      "prev_precipitacao:2026-05",
      "deg:2021",
    ]);
  });

  it("is not resolved before the request answers", () => {
    mockedFetchReportMapURLs.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useReportMapTileUrls(MAP_KEYS));

    expect(result.current.resolved).toBe(false);
    expect(result.current.tileUrlFor("anaseca:2024-12")).toBeUndefined();
  });

  // Sem isso, uma falha de rede travaria o botão de exportar para sempre.
  it("marks every layer as unavailable when the request fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockedFetchReportMapURLs.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useReportMapTileUrls(MAP_KEYS));

    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect([...result.current.unavailableKeys]).toEqual(MAP_KEYS);
    expect(result.current.failureFor("anaseca:2024-12")).toBe("error");
  });

  // O servidor devolve `pending` quando o Earth Engine não respondeu dentro do
  // prazo da requisição. Insistir só nas pendentes é o que deixa o relatório
  // desenhar os primeiros mapas sem esperar os vinte.
  it("asks again only for the layers still pending", async () => {
    mockedFetchReportMapURLs
      .mockResolvedValueOnce([
        { name: "anaseca", year: "2024-12", url: "https://tiles.example/a" },
        { name: "prev_precipitacao", year: "2026-05", status: "pending" },
        { name: "deg", year: "2021", status: "pending" },
      ])
      .mockResolvedValueOnce([
        {
          name: "prev_precipitacao",
          year: "2026-05",
          url: "https://tiles.example/p",
        },
        { name: "deg", year: "2021", status: "year_not_found" },
      ]);

    const { result } = renderHook(() => useReportMapTileUrls(MAP_KEYS));

    await waitFor(() =>
      expect(result.current.tileUrlFor("anaseca:2024-12")).toBe(
        "https://tiles.example/a",
      ),
    );
    // A primeira URL já está disponível enquanto as outras ainda não voltaram.
    expect(result.current.resolved).toBe(false);

    await waitFor(() => expect(result.current.resolved).toBe(true), {
      timeout: 5000,
    });
    expect(mockedFetchReportMapURLs).toHaveBeenCalledTimes(2);
    expect(mockedFetchReportMapURLs.mock.calls[1][0]).toEqual([
      { name: "prev_precipitacao", year: "2026-05" },
      { name: "deg", year: "2021" },
    ]);
    expect(result.current.failureFor("deg:2021")).toBe("year_not_found");
  });

  it("keeps a period that contains a dash intact", async () => {
    mockedFetchReportMapURLs.mockResolvedValue([]);

    renderHook(() => useReportMapTileUrls(["cobertura-da-terra-ibge-s:2020"]));

    await waitFor(() =>
      expect(mockedFetchReportMapURLs).toHaveBeenCalledTimes(1),
    );
    expect(mockedFetchReportMapURLs.mock.calls[0][0]).toEqual([
      { name: "cobertura-da-terra-ibge-s", year: "2020" },
    ]);
  });
});
