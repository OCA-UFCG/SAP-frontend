import { describe, expect, it } from "vitest";

import {
  appendCatalogAuditEvent,
  buildAdoptedPresentationConfig,
  buildPublishedPresentationConfig,
  resolveAdoptedCategory,
} from "@/contracts/indexCatalogAdoption.mjs";

const actor = { uid: "admin-1", email: "oca-dev@gmail.com" };
const at = "2026-09-04T12:00:00.000Z";

function buildConfig(
  item: Partial<
    Parameters<typeof buildAdoptedPresentationConfig>[0]["item"]
  > = {},
  reportConfig?: Parameters<
    typeof buildAdoptedPresentationConfig
  >[0]["reportConfig"],
) {
  return buildAdoptedPresentationConfig({
    item: {
      panelLayerId: "s2id_secas_estiagens",
      name: "Registros de Secas e Estiagens",
      description: "Ocorrências registradas no S2iD.",
      category: "Dados Socioeconômicos",
      measurementUnit: "registros",
      panelPosition: 3,
      published: true,
      ...item,
    },
    reportConfig,
    actor,
    at,
  });
}

describe("buildAdoptedPresentationConfig", () => {
  it("adota um legado publicado no escopo de apresentação", () => {
    expect(buildConfig()).toMatchObject({
      schemaVersion: 2,
      managedScope: "presentation",
      panelLayerId: "s2id_secas_estiagens",
      status: "published",
      category: "Dados Socioeconômicos",
      measurementUnit: "registros",
      panelPosition: 3,
      adoptedFrom: { at },
    });
  });

  it("nunca escreve a origem dos números de um legado", () => {
    const config = buildConfig() as Record<string, unknown>;

    expect(config).not.toHaveProperty("statisticsSource");
    expect(config).not.toHaveProperty("classes");
    expect(config).not.toHaveProperty("earthEngine");
  });

  it("adota um legado despublicado como rascunho", () => {
    expect(buildConfig({ published: false }).status).toBe("draft");
  });

  it("omite a posição quando a entry não tem uma", () => {
    expect(buildConfig({ panelPosition: undefined })).not.toHaveProperty(
      "panelPosition",
    );
  });

  it("preserva a unidade do legado em vez de normalizar para %", () => {
    expect(buildConfig({ measurementUnit: "%" }).measurementUnit).toBe("%");
    expect(buildConfig({ measurementUnit: undefined }).measurementUnit).toBe(
      "",
    );
  });

  it("herda o texto de relatório que já estava na entry", () => {
    const report = {
      schemaVersion: 1 as const,
      sections: [{ title: "Situação atual", text: "Em [municipio]." }],
    };

    expect(buildConfig({}, report).report).toEqual(report);
  });

  it("registra na auditoria da adoção que a entry vinha de um catalogConfig v1", () => {
    const config = buildConfig({ catalogConfig: { schemaVersion: 1 } });

    expect(config.adoptedFrom.previousSchemaVersion).toBe(1);
    expect(buildConfig().adoptedFrom).not.toHaveProperty(
      "previousSchemaVersion",
    );
  });

  it("deixa rastro de quem adotou", () => {
    expect(buildConfig().auditLog).toEqual([
      {
        action: "adopt",
        outcome: "success",
        uid: actor.uid,
        email: actor.email,
        at,
      },
    ]);
  });
});

describe("resolveAdoptedCategory", () => {
  it("mantém uma categoria conhecida do catálogo", () => {
    expect(resolveAdoptedCategory("Dados Ambientais")).toBe("Dados Ambientais");
  });

  it("cai na primeira categoria quando a entry não tem uma válida", () => {
    expect(resolveAdoptedCategory(undefined)).toBe("Dados Climáticos");
    expect(resolveAdoptedCategory("Outra coisa")).toBe("Dados Climáticos");
  });
});

describe("appendCatalogAuditEvent", () => {
  const event = {
    action: "adopt" as const,
    outcome: "success" as const,
    uid: actor.uid,
    email: actor.email,
    at,
  };

  it("corta o histórico para a entry não crescer sem limite", () => {
    const config = {
      auditLog: Array.from({ length: 50 }, (_, index) => ({
        ...event,
        message: `evento-${index}`,
      })),
    } as never;
    const { auditLog } = appendCatalogAuditEvent(config, event);

    expect(auditLog).toHaveLength(50);
    expect(auditLog?.[0]).toMatchObject({ message: "evento-1" });
    expect(auditLog?.at(-1)).toEqual(event);
  });
});

describe("buildPublishedPresentationConfig", () => {
  const publishedAt = "2026-09-05T09:00:00.000Z";

  it("não reescreve nada do conteúdo ao publicar", () => {
    const adopted = buildConfig({ name: "Índice de Degradação" });
    const published = buildPublishedPresentationConfig({
      config: adopted,
      actor,
      at: publishedAt,
    });

    expect(published.name).toBe(adopted.name);
    expect(published.description).toBe(adopted.description);
    expect(published.category).toBe(adopted.category);
    expect(published.measurementUnit).toBe(adopted.measurementUnit);
    expect(published.panelLayerId).toBe(adopted.panelLayerId);
    expect(published.managedScope).toBe("presentation");
  });

  it("registra quem publicou e quando, sem apagar o histórico anterior", () => {
    const adopted = buildConfig();
    const published = buildPublishedPresentationConfig({
      config: adopted,
      actor,
      at: publishedAt,
    });

    expect(published.status).toBe("published");
    expect(published.updatedBy).toEqual({
      uid: actor.uid,
      email: actor.email,
      at: publishedAt,
    });
    // O evento de adoção continua lá: o rastro é acumulativo.
    expect(published.auditLog?.map((event) => event.action)).toEqual([
      "adopt",
      "publish",
    ]);
    expect(published.auditLog?.at(-1)).toEqual({
      action: "publish",
      outcome: "success",
      uid: actor.uid,
      email: actor.email,
      at: publishedAt,
    });
  });

  it("marca como publicado um legado que fora adotado como rascunho", () => {
    // Um legado despublicado é adotado com status "draft"; publicar é
    // justamente o que o promove, e a tela decide o botão por esse campo.
    const adopted = buildConfig({ published: false });
    expect(adopted.status).toBe("draft");

    expect(
      buildPublishedPresentationConfig({
        config: adopted,
        actor,
        at: publishedAt,
      }).status,
    ).toBe("published");
  });

  it("preserva o e-mail nulo de um ator sem e-mail", () => {
    const published = buildPublishedPresentationConfig({
      config: buildConfig(),
      actor: { uid: "tool:publish-adopted-legacy", email: null },
      at: publishedAt,
    });

    expect(published.updatedBy).toEqual({
      uid: "tool:publish-adopted-legacy",
      email: null,
      at: publishedAt,
    });
  });
});
