import { describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import PlatformLogsLayout from "@/app/[locale]/platform/logs/layout";
import PlatformLogsPage from "@/app/[locale]/platform/logs/page";
import PlatformTelemetryPage from "@/app/[locale]/platform/telemetry/page";

describe("legacy platform logs routes", () => {
  it("redirects /platform/logs to the canonical logs view", async () => {
    redirectMock.mockClear();

    await expect(
      PlatformLogsLayout({ children: <div>Logs</div> }),
    ).rejects.toThrow("redirect:/platform?view=logs");
    expect(redirectMock).toHaveBeenCalledWith("/platform?view=logs");
  });

  it("redirects /platform/logs/page to the canonical logs view", () => {
    redirectMock.mockClear();

    expect(() => PlatformLogsPage()).toThrow("redirect:/platform?view=logs");
    expect(redirectMock).toHaveBeenCalledWith("/platform?view=logs");
  });

  it("redirects /platform/telemetry to the canonical logs view", () => {
    redirectMock.mockClear();

    expect(() => PlatformTelemetryPage()).toThrow(
      "redirect:/platform?view=logs",
    );
    expect(redirectMock).toHaveBeenCalledWith("/platform?view=logs");
  });
});
