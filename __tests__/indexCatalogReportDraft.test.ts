import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createDefaultReportDraft,
  isStoredReportText,
  toReportDraft,
  toReportTextPayload,
} from "@/utils/indexCatalogReportDraft";

describe("toReportTextPayload", () => {
  it("apara os espaços e descarta a seção sem texto", () => {
    const payload = toReportTextPayload({
      sections: [
        { title: "  Situação atual  ", text: "  O município está em X.  " },
        { title: "Vazia", text: "   " },
      ],
      sectionColor: "",
      methodology: "  Nota  ",
    });

    expect(payload.sections).toEqual([
      { title: "Situação atual", text: "O município está em X." },
    ]);
    expect(payload.methodology).toBe("Nota");
    expect(payload.sectionColor).toBeUndefined();
  });
});

describe("isStoredReportText", () => {
  it("reconhece o texto padrão de um índice novo como ainda não gravado", () => {
    const payload = toReportTextPayload(createDefaultReportDraft());

    expect(isStoredReportText(payload, undefined)).toBe(false);
  });

  it("trata um rascunho vazio como igual a não ter texto gravado", () => {
    const payload = toReportTextPayload({
      sections: [{ title: "Situação atual", text: "" }],
      sectionColor: "",
      methodology: "",
    });

    expect(isStoredReportText(payload, undefined)).toBe(true);
  });

  it("não grava de novo quando nada mudou", () => {
    const draft = createDefaultReportDraft();
    const stored = toReportTextPayload(draft);

    expect(isStoredReportText(toReportTextPayload(draft), stored)).toBe(true);
  });

  it("percebe a mudança de uma única frase", () => {
    const draft = createDefaultReportDraft();
    const stored = toReportTextPayload(draft);
    draft.sections[1].text = "TESTE";

    expect(isStoredReportText(toReportTextPayload(draft), stored)).toBe(false);
  });

  it("percebe a mudança só da cor ou só da nota", () => {
    const draft = createDefaultReportDraft();
    const stored = toReportTextPayload(draft);

    expect(
      isStoredReportText(
        toReportTextPayload({ ...draft, sectionColor: "#795548" }),
        stored,
      ),
    ).toBe(false);
    expect(
      isStoredReportText(
        toReportTextPayload({ ...draft, methodology: "Outra nota" }),
        stored,
      ),
    ).toBe(false);
  });
});

describe("toReportDraft", () => {
  it("volta ao texto padrão quando o índice ainda não tem texto gravado", () => {
    expect(toReportDraft(undefined)).toEqual(createDefaultReportDraft());
  });

  it("reexibe o texto gravado, e não o padrão", () => {
    const draft = toReportDraft({
      schemaVersion: 1,
      sections: [{ title: "Situação atual", text: "TESTE" }],
      methodology: "Nota do índice",
    });

    expect(draft.sections).toEqual([
      { title: "Situação atual", text: "TESTE" },
    ]);
    expect(draft.methodology).toBe("Nota do índice");
    expect(draft.sectionColor).toBe("");
  });
});
