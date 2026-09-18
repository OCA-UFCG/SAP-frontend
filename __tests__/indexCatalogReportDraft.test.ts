import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createDefaultReportDraft,
  describeSeverityChoice,
  isStoredReportText,
  toReportDraft,
  toReportTextPayload,
  toSeverityOrder,
} from "@/utils/indexCatalogReportDraft";

describe("toReportTextPayload", () => {
  it("apara os espaços e descarta a seção sem texto", () => {
    const payload = toReportTextPayload({
      sections: [
        { title: "  Situação atual  ", text: "  O município está em X.  " },
        { title: "Vazia", text: "   " },
      ],
      sectionColor: "",
      severityOrder: [],
      neutralClassId: "",
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
      includeInReport: true,
      sections: [{ title: "Situação atual", text: "" }],
      sectionColor: "",
      severityOrder: [],
      neutralClassId: "",
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

describe("describeSeverityChoice", () => {
  const classIds = ["umido", "subumido", "semiarido"];

  it("reconhece a ordem gravada nos dois sentidos", () => {
    expect(describeSeverityChoice(classIds, classIds)).toBe("best-first");
    expect(describeSeverityChoice([...classIds].reverse(), classIds)).toBe(
      "worst-first",
    );
  });

  it("trata a ausência de ordem como resposta válida", () => {
    expect(describeSeverityChoice([], classIds)).toBe("none");
  });

  it("marca como vencida a ordem que já não descreve as classes do índice", () => {
    expect(describeSeverityChoice(["umido", "arido"], classIds)).toBe("stale");
    expect(describeSeverityChoice(["umido", "subumido"], classIds)).toBe(
      "stale",
    );
  });
});

describe("toSeverityOrder", () => {
  it("grava a ordem das classes no sentido que o operador respondeu", () => {
    expect(toSeverityOrder("best-first", ["a", "b"])).toEqual(["a", "b"]);
    expect(toSeverityOrder("worst-first", ["a", "b"])).toEqual(["b", "a"]);
    expect(toSeverityOrder("none", ["a", "b"])).toEqual([]);
  });
});

describe("a ordem de gravidade no rascunho", () => {
  const draft = {
    sections: [{ title: "Situação atual", text: "Texto." }],
    sectionColor: "",
    methodology: "",
    severityOrder: ["sem-seca", "seca-fraca"],
    neutralClassId: "sem-seca",
  };

  it("atravessa a gravação e a leitura sem perder a classe neutra", () => {
    expect(toReportDraft(toReportTextPayload(draft))).toMatchObject({
      severityOrder: ["sem-seca", "seca-fraca"],
      neutralClassId: "sem-seca",
    });
  });

  it("não publica uma ordem com menos de duas classes", () => {
    expect(
      toReportTextPayload({ ...draft, severityOrder: ["sem-seca"] }).severity,
    ).toBeUndefined();
  });

  it("conta como alteração a ser gravada", () => {
    const stored = toReportTextPayload({ ...draft, severityOrder: [] });

    expect(isStoredReportText(toReportTextPayload(draft), stored)).toBe(false);
    expect(
      isStoredReportText(
        toReportTextPayload(draft),
        toReportTextPayload(draft),
      ),
    ).toBe(true);
  });
});
