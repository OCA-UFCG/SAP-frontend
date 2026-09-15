import { describe, expect, it } from "vitest";

import {
  appendCatalogAuditEvent,
  buildPublishedPresentationConfig,
} from "@/contracts/indexCatalogAdoption.mjs";

const actor = { uid: "admin-1", email: "oca-dev@gmail.com" };
const at = "2026-09-04T12:00:00.000Z";

/**
 * Um legado já adotado, como o `catalogConfig` dele está gravado na entry. A
 * adoção em si saiu do repositório; o que o contrato ainda faz é registrar a
 * publicação por cima dessa configuração.
 */
function buildAdoptedConfig({ published = true } = {}) {
  const author = { uid: actor.uid, email: actor.email, at };
  return appendCatalogAuditEvent(
    {
      schemaVersion: 2,
      managedScope: "presentation",
      panelLayerId: "s2id_secas_estiagens",
      status: published ? "published" : "draft",
      name: "Registros de Secas e Estiagens",
      description: "Ocorrências registradas no S2iD.",
      category: "Dados Socioeconômicos",
      measurementUnit: "registros",
      panelPosition: 3,
      createdBy: author,
      updatedBy: author,
      adoptedFrom: { at },
    } as never,
    { action: "adopt", outcome: "success", ...author },
  );
}

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
    const adopted = { ...buildAdoptedConfig(), name: "Índice de Degradação" };
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
    const adopted = buildAdoptedConfig();
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
    const adopted = buildAdoptedConfig({ published: false });
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
      config: buildAdoptedConfig(),
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
