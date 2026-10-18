import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getBlurPreviews } from "@/services/blurPreviews";

const PHOTO = "//images.ctfassets.net/space/asset/hash/banner-1b.jpg";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getBlurPreviews", () => {
  it("pede a foto com 6 px em PNG de 256 cores e devolve como data URL", async () => {
    const fetchMock = vi.fn(async () => new Response(PNG));
    vi.stubGlobal("fetch", fetchMock);

    const previews = await getBlurPreviews([PHOTO, PHOTO]);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://images.ctfassets.net/space/asset/hash/banner-1b.jpg?w=6&fm=png&fl=png8",
      expect.objectContaining({ cache: "force-cache" }),
    );
    // A chave é o endereço como o componente o recebe.
    expect(previews[PHOTO]).toBe(
      `data:image/png;base64,${Buffer.from(PNG).toString("base64")}`,
    );
  });

  it("deixa sem prévia arquivo local, SVG e foto que falhou", async () => {
    const failing = "https://images.ctfassets.net/space/a/h/falha.jpg";
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("falha")
        ? new Response(null, { status: 404 })
        : Promise.reject(new Error("rede")),
    );
    vi.stubGlobal("fetch", fetchMock);

    const previews = await getBlurPreviews([
      "/home/modulo-monitoramento.jpg",
      "https://images.ctfassets.net/space/a/h/UFCG.svg",
      failing,
      "https://images.ctfassets.net/space/a/h/sem-rede.jpg",
      undefined,
    ]);

    expect(previews).toEqual({});
    // Local e SVG nem chegam a pedir nada.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
