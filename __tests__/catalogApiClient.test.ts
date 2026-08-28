import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestCatalogPreview } from "@/components/IndexCatalog/catalogApiClient";

const ENTRY_ID = "3krF2PQrHucOIks4RQFDQd";
const PREVIEW_PATH = `/api/index-catalog/drafts/${ENTRY_ID}/preview`;
const STARTED_AT = Date.parse("2026-08-27T21:50:00.000Z");

function previewBody(validatedAt: string) {
  return {
    entryId: ENTRY_ID,
    validation: { validatedAt, valid: true, errors: [], warnings: [] },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** Uma rejeição de fetch é o que o navegador entrega quando o proxy corta. */
function connectionCut() {
  return new TypeError("Failed to fetch");
}

describe("requestCatalogPreview", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("devolve a prévia do POST quando a conexão aguenta", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(previewBody("2026-08-27T21:52:00.000Z")),
    );

    const preview = await requestCatalogPreview(
      ENTRY_ID,
      "k".repeat(10),
      STARTED_AT,
    );

    expect(preview.validation.validatedAt).toBe("2026-08-27T21:52:00.000Z");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [path, options] = fetchMock.mock.calls[0];
    expect(path).toBe(PREVIEW_PATH);
    expect(options.method).toBe("POST");
    expect(options.headers["Idempotency-Key"]).toBe("k".repeat(10));
  });

  // O servidor não para quando o proxy desiste: ele termina a validação e a
  // grava. O GET recupera esse resultado sem tocar no Earth Engine.
  it("recupera pelo GET a validação que terminou depois do corte da conexão", async () => {
    fetchMock
      .mockRejectedValueOnce(connectionCut())
      .mockResolvedValueOnce(
        jsonResponse(previewBody("2026-08-27T21:54:16.219Z")),
      );

    const preview = await requestCatalogPreview(
      ENTRY_ID,
      "k".repeat(10),
      STARTED_AT,
    );

    expect(preview.validation.validatedAt).toBe("2026-08-27T21:54:16.219Z");
    const [, options] = fetchMock.mock.calls[1];
    expect(options.method).toBeUndefined();
  });

  // Sem essa comparação, uma prévia de ontem passaria por resposta de hoje e o
  // operador publicaria uma validação que não é a que ele acabou de pedir.
  it("ignora uma prévia anterior ao início desta tentativa", async () => {
    fetchMock
      .mockRejectedValueOnce(connectionCut())
      .mockResolvedValueOnce(
        jsonResponse(previewBody("2026-08-26T10:00:00.000Z")),
      );

    await expect(
      requestCatalogPreview(ENTRY_ID, "k".repeat(10), STARTED_AT),
    ).rejects.toThrow(/Failed to fetch/u);
  });

  it("mantém o erro original quando não há prévia para recuperar", async () => {
    fetchMock
      .mockRejectedValueOnce(connectionCut())
      .mockResolvedValueOnce(
        jsonResponse(
          { error: "O rascunho ainda não possui uma prévia válida." },
          400,
        ),
      );

    await expect(
      requestCatalogPreview(ENTRY_ID, "k".repeat(10), STARTED_AT),
    ).rejects.toThrow(/Failed to fetch/u);
  });

  it("mantém o erro de validação do servidor em vez de tentar recuperar", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error:
              "Asset estatístico projects/x/assets/t_2024 não possui linhas.",
          },
          400,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          { error: "O rascunho ainda não possui uma prévia válida." },
          400,
        ),
      );

    await expect(
      requestCatalogPreview(ENTRY_ID, "k".repeat(10), STARTED_AT),
    ).rejects.toThrow(/não possui linhas/u);
  });

  it("aceita a prévia concluída no mesmo instante em que a tentativa começou", async () => {
    fetchMock
      .mockRejectedValueOnce(connectionCut())
      .mockResolvedValueOnce(
        jsonResponse(previewBody(new Date(STARTED_AT).toISOString())),
      );

    await expect(
      requestCatalogPreview(ENTRY_ID, "k".repeat(10), STARTED_AT),
    ).resolves.toMatchObject({ entryId: ENTRY_ID });
  });
});
