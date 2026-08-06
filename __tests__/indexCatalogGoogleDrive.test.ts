import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { searchDriveFilesByTag } from "@/services/indexCatalog/googleDrive";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

describe("index catalog Google Drive access", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_DRIVE_ACCESS_TOKEN", "test-token");
    vi.stubEnv("GOOGLE_DRIVE_FOLDER_ID", "configured-folder");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects an empty-looking search when the configured folder is inaccessible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        jsonResponse({ error: { message: "File not found" } }, 404),
      ),
    );

    await expect(searchDriveFilesByTag("pob_total")).rejects.toThrow(
      "A conta de serviço não consegue acessar a pasta configurada do Drive.",
    );
  });

  it("returns an empty result only after confirming that the folder is accessible", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        jsonResponse({
          id: "configured-folder",
          name: "SAP_Exportacoes_CSV",
          mimeType: "application/vnd.google-apps.folder",
          trashed: false,
        }),
      )
      .mockImplementationOnce(() => jsonResponse({ files: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchDriveFilesByTag("inexistente")).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not reuse a cached token after the service account changes", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    vi.stubEnv("GOOGLE_DRIVE_ACCESS_TOKEN", "");
    vi.stubEnv("GOOGLE_DRIVE_CLIENT_EMAIL", "old@example.test");
    vi.stubEnv("GOOGLE_DRIVE_PRIVATE_KEY", privateKey);

    const folder = {
      id: "configured-folder",
      name: "SAP_Exportacoes_CSV",
      mimeType: "application/vnd.google-apps.folder",
      trashed: false,
    };
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() =>
        jsonResponse({ access_token: "old-token", expires_in: 3600 }),
      )
      .mockImplementationOnce(() => jsonResponse(folder))
      .mockImplementationOnce(() => jsonResponse({ files: [] }))
      .mockImplementationOnce(() =>
        jsonResponse({ access_token: "team-token", expires_in: 3600 }),
      )
      .mockImplementationOnce(() => jsonResponse(folder))
      .mockImplementationOnce(() => jsonResponse({ files: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await searchDriveFilesByTag("primeira-busca");
    vi.stubEnv("GOOGLE_DRIVE_CLIENT_EMAIL", "team@example.test");
    await searchDriveFilesByTag("segunda-busca");

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        headers: { Authorization: "Bearer old-token" },
      }),
    );
    expect(fetchMock.mock.calls[4]?.[1]).toEqual(
      expect.objectContaining({
        headers: { Authorization: "Bearer team-token" },
      }),
    );
  });
});
