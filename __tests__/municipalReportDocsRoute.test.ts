import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-session", () => ({
  requireAuthenticatedRequest: vi.fn(),
}));
vi.mock("@/services/municipalReportCache", () => ({
  buildCachedMunicipalReport: vi.fn(),
}));
vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: vi.fn(async () => []),
}));
vi.mock("@/services/buildDoc/buildDocContent", () => ({
  buildDocContent: vi.fn(async () => ({})),
}));

import { GET } from "@/app/api/municipal-report/[locationKey]/docs/route";
import { requireAuthenticatedRequest } from "@/lib/server-session";
import { buildCachedMunicipalReport } from "@/services/municipalReportCache";
import { buildDocContent } from "@/services/buildDoc/buildDocContent";

const auth = vi.mocked(requireAuthenticatedRequest);
const build = vi.mocked(buildCachedMunicipalReport);
const buildDocs = vi.mocked(buildDocContent);

const context = (code: string) => ({
  params: Promise.resolve({ locationKey: code }),
});

function analysis(id: string, status: "available" | "unavailable") {
  return { id, status } as unknown as Awaited<
    ReturnType<typeof buildCachedMunicipalReport>
  >["analyses"][number];
}

function reportWith(
  analyses: ReturnType<typeof analysis>[],
): Awaited<ReturnType<typeof buildCachedMunicipalReport>> {
  return { analyses } as unknown as Awaited<
    ReturnType<typeof buildCachedMunicipalReport>
  >;
}

function request(query: string) {
  return new Request(`https://test/api/municipal-report/5200050/docs?${query}`);
}

describe("GET /api/municipal-report/[locationKey]/docs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    auth.mockResolvedValue(null);
    buildDocs.mockResolvedValue({});
    build.mockResolvedValue(
      reportWith([
        analysis("aridez", "available"),
        analysis("seca", "unavailable"),
      ]),
    );
  });

  it("requires authentication", async () => {
    auth.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }));

    const response = await GET(request("period=2024"), context("5200050"));

    expect(response.status).toBe(401);
    expect(build).not.toHaveBeenCalled();
  });

  // Regressão de desempenho: a tela pedia o relatório-base com a sua seleção de
  // camadas e os textos só com as disponíveis. Como a lista pedida entra na
  // chave do cache do relatório, a segunda chamada errava o cache e remontava o
  // relatório inteiro.
  it("pede ao cache exatamente as camadas recebidas, sem filtrar por disponibilidade", async () => {
    await GET(request("period=2024&layers=aridez,seca"), context("5200050"));

    expect(build).toHaveBeenCalledWith(
      "5200050",
      "2024",
      expect.objectContaining({ analysisIds: ["aridez", "seca"] }),
    );
  });

  it("monta o documento só com as camadas que o relatório conseguiu montar", async () => {
    await GET(request("period=2024&layers=aridez,seca"), context("5200050"));

    expect(buildDocs).toHaveBeenCalledWith(
      expect.objectContaining({ themes: ["aridez"] }),
    );
  });

  it("aceita a ausência de `layers` como o relatório de todas as camadas", async () => {
    const response = await GET(request("period=2024"), context("5200050"));

    expect(response.status).toBe(200);
    expect(build).toHaveBeenCalledWith(
      "5200050",
      "2024",
      expect.not.objectContaining({ analysisIds: expect.anything() }),
    );
  });

  it("responde 404 quando nenhuma camada do relatório ficou disponível", async () => {
    build.mockResolvedValue(reportWith([analysis("seca", "unavailable")]));

    const response = await GET(request("period=2024"), context("5200050"));

    expect(response.status).toBe(404);
    expect(buildDocs).not.toHaveBeenCalled();
  });
});
