import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LogsViewerAccess } from "@/lib/logs-access";

/** Sessões conhecidas pelo teste, no lugar do Firebase. */
class FakeLogsAccessResolver {
  accessByCookie = new Map<string, LogsViewerAccess>();

  resolve = async (cookie?: string | null) =>
    (cookie && this.accessByCookie.get(cookie)) || "unauthenticated";
}

/** Contentful de mentira: conta as leituras para provar quem chegou nele. */
class FakePanelLayerRepository {
  reads = 0;

  getPanelLayers = async () => {
    this.reads += 1;
    return [{ id: "CDI_Test", name: "CDI" }];
  };
}

const { redirectMock, access, repository } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  access: { current: null as FakeLogsAccessResolver | null },
  repository: { current: null as FakePanelLayerRepository | null },
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/logs-access", () => ({
  resolveLogsViewerAccess: (cookie?: string | null) =>
    access.current!.resolve(cookie),
}));
vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: () => repository.current!.getPanelLayers(),
}));

import { loadPlatformShellData } from "@/app/[locale]/platform/platformShellData";

describe("loadPlatformShellData", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    access.current = new FakeLogsAccessResolver();
    repository.current = new FakePanelLayerRepository();
  });

  it("redirects anonymous visitors without reading the layers", async () => {
    await expect(loadPlatformShellData(null)).rejects.toThrow(
      "redirect:/login",
    );
    expect(repository.current!.reads).toBe(0);
  });

  it("does not hand the layers to a rejected session (regression: panelLayers in the /pt/platform 307 body)", async () => {
    await expect(loadPlatformShellData("cookie-revogado")).rejects.toThrow(
      "redirect:/login",
    );
  });

  it("returns the layers and hides the audit entry for a regular session", async () => {
    access.current!.accessByCookie.set("cookie-comum", "forbidden");

    await expect(loadPlatformShellData("cookie-comum")).resolves.toEqual({
      panelLayers: [{ id: "CDI_Test", name: "CDI" }],
      showAuditLink: false,
    });
  });

  it("shows the audit entry to allowlisted viewers", async () => {
    access.current!.accessByCookie.set("cookie-auditoria", "allowed");

    const shellData = await loadPlatformShellData("cookie-auditoria");

    expect(shellData.showAuditLink).toBe(true);
  });
});
