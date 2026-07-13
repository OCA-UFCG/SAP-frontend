import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { clearDocTemplateCache, getDocTemplate } from "@/services/buildDoc/buildDocTemplate";

const DROUGHT_THEME = "anaseca";
const ARIDITY_THEME = "indicearidez";

describe("Google Docs template loading", () => {
  beforeEach(() => {
    clearDocTemplateCache();
    process.env.DOCS_DEFAULT = "https://docs.google.test/report.txt";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.DOCS_DEFAULT;
  });

  it("parses single, double and known plain section headings", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response([
      "[layer: anaseca]",
      "*Situação atual:* Primeiro texto.",
      "**Tendência recente:** Segundo texto.",
      "Contexto histórico: Terceiro texto.",
    ].join("\n"))));

    await expect(getDocTemplate({ themes: [DROUGHT_THEME] })).resolves.toEqual({
      [DROUGHT_THEME]: [
        { title: "Situação atual", text: "Primeiro texto." },
        { title: "Tendência recente", text: "Segundo texto." },
        { title: "Contexto histórico", text: "Terceiro texto." },
      ],
    });
  });

  it("reuses fresh text for ten minutes and serves stale text when refresh fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("[layer: anaseca]\nSituação atual: versão inicial"))
      .mockRejectedValueOnce(new Error("Google Docs unavailable"));
    vi.stubGlobal("fetch", fetchMock);

    const first = await getDocTemplate({ themes: [DROUGHT_THEME] });
    vi.advanceTimersByTime(9 * 60 * 1000);
    const cached = await getDocTemplate({ themes: [DROUGHT_THEME] });
    vi.advanceTimersByTime(61 * 1000);
    const stale = await getDocTemplate({ themes: [DROUGHT_THEME] });

    expect(first).toEqual(cached);
    expect(stale).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fetches one document and separates its sections by layer heading", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response([
      "◉ 1. Monitor de Secas",
      "[layer: anaseca]",
      "Situação atual: Texto de seca.",
      "◈ 2. Índice de Aridez",
      "[layer: indicearidez]",
      "Situação atual: Texto de aridez.",
    ].join("\n")));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getDocTemplate({ themes: [DROUGHT_THEME, ARIDITY_THEME] })).resolves.toEqual({
      [DROUGHT_THEME]: [{ title: "Situação atual", text: "Texto de seca." }],
      [ARIDITY_THEME]: [{ title: "Situação atual", text: "Texto de aridez." }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the text export endpoint when DOCS_DEFAULT is a Google Docs edit URL", async () => {
    process.env.DOCS_DEFAULT = "https://docs.google.com/document/d/document-id/edit?tab=t.0";
    const fetchMock = vi.fn().mockResolvedValue(new Response("[layer: anaseca]\nSituação atual: Texto."));
    vi.stubGlobal("fetch", fetchMock);

    await getDocTemplate({ themes: [DROUGHT_THEME] });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://docs.google.com/document/d/document-id/export?format=txt",
      { cache: "no-store" },
    );
  });
});
