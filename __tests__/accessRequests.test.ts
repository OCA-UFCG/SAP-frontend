import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDoc, fakeCollection, fakeQuery, fakeTransaction, fakeDb } = vi.hoisted(() => {
  const doc = {
    set: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const query = { get: vi.fn(), orderBy: vi.fn(() => query) };
  const transaction = { get: vi.fn(), update: vi.fn() };
  const collection = { doc: vi.fn(() => doc), where: vi.fn(() => query), orderBy: vi.fn(() => query) };

  return {
    fakeDoc: doc,
    fakeCollection: collection,
    fakeQuery: query,
    fakeTransaction: transaction,
    fakeDb: {
      collection: vi.fn(() => collection),
      runTransaction: vi.fn((work) => work(transaction)),
    },
  };
});

vi.mock("@/lib/firebase-admin", () => ({ adminDb: fakeDb }));

import {
  ACCESS_REQUESTS_COLLECTION,
  DEFAULT_ACCESS_REQUESTS_COLLECTION,
  INTENTION_MAX_LENGTH,
  claimPendingDecision,
  createAccessRequest,
  normalizeIntention,
  readAccessRequest,
  resolveAccessRequestsCollectionName,
  listPendingAccessRequests,
  claimTeamNotification,
  recordAccessDecision,
} from "@/lib/access-requests";

describe("access requests", () => {
  beforeEach(() => {
    fakeDb.collection.mockClear();
    fakeCollection.doc.mockClear();
    fakeDoc.set.mockReset().mockResolvedValue(undefined);
    fakeDoc.get.mockReset();
    fakeDoc.update.mockReset().mockResolvedValue(undefined);
    fakeDoc.delete.mockReset().mockResolvedValue(undefined);
    fakeCollection.where.mockClear();
    fakeCollection.orderBy.mockClear();
    fakeQuery.get.mockReset();
    fakeTransaction.get.mockReset();
    fakeTransaction.update.mockReset();
    fakeDb.runTransaction.mockClear();
  });

  // Com o nome fixo no código, cada teste local escrevia na mesma gaveta da
  // produção — e a tela de aprovação real passava a mostrar cadastros de teste
  // misturados com pedidos de verdade. A telemetria já separa por ambiente; isto
  // segue o mesmo padrão.
  it("separates the collection per environment, like telemetry already does", () => {
    expect(resolveAccessRequestsCollectionName(undefined)).toBe(
      DEFAULT_ACCESS_REQUESTS_COLLECTION,
    );
    expect(resolveAccessRequestsCollectionName("   ")).toBe(
      DEFAULT_ACCESS_REQUESTS_COLLECTION,
    );
    expect(resolveAccessRequestsCollectionName("access-requests-local")).toBe(
      "access-requests-local",
    );
  });

  it("trims and collapses the whitespace a textarea leaves behind", () => {
    expect(normalizeIntention("  Pesquisa   sobre\n\n seca  ")).toBe(
      "Pesquisa sobre seca",
    );
  });

  it("refuses an intention that is empty or only whitespace", () => {
    expect(normalizeIntention("")).toBe("");
    expect(normalizeIntention("   \n  ")).toBe("");
    expect(normalizeIntention(null)).toBe("");
    expect(normalizeIntention(42)).toBe("");
  });

  // O texto é livre e termina dentro de um e-mail. O corte no servidor é o que
  // vale — o `maxLength` do formulário é só cortesia.
  it("caps the intention at the documented limit", () => {
    const normalized = normalizeIntention("a".repeat(INTENTION_MAX_LENGTH + 500));

    expect(normalized).toHaveLength(INTENTION_MAX_LENGTH);
  });

  it("opens the request as pending, under the account uid", async () => {
    await createAccessRequest("user-123", {
      email: "fulano@gmail.com",
      tier: "common",
      intention: "Pesquisa sobre seca",
    });

    expect(fakeDb.collection).toHaveBeenCalledWith(ACCESS_REQUESTS_COLLECTION);
    expect(fakeCollection.doc).toHaveBeenCalledWith("user-123");
    expect(fakeDoc.set).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "fulano@gmail.com",
        tier: "common",
        intention: "Pesquisa sobre seca",
        status: "pending",
        decidedAt: null,
        decidedBy: null,
      }),
    );
  });

  // O registro é por pedido, não por trilho: quem entrou por domínio também
  // deixa rastro de quem pediu e quando.
  it("opens a request for the institutional trail too", async () => {
    await createAccessRequest("user-456", {
      email: "fulano@ufcg.edu.br",
      tier: "allowed",
      intention: "",
    });

    expect(fakeDoc.set).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "allowed", status: "pending" }),
    );
  });

  // O link de confirmação pode ser aberto várias vezes AO MESMO TEMPO: duplo
  // clique, o modo estrito do React, e sobretudo programas de e-mail que abrem
  // os links das mensagens sozinhos para checar segurança. Só uma transação
  // impede que duas dessas leiam "ninguém avisou ainda" antes de qualquer uma
  // gravar o contrário.
  it("lets only one caller win the right to tell the team", async () => {
    fakeTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({ notifiedAt: null }),
    });

    await expect(claimTeamNotification("user-123")).resolves.toBe(true);

    expect(fakeDb.runTransaction).toHaveBeenCalled();
    expect(fakeTransaction.update).toHaveBeenCalledWith(
      fakeDoc,
      expect.objectContaining({ notifiedAt: expect.any(String) }),
    );
  });

  it("refuses the caller that arrives after the team was told", async () => {
    fakeTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({ notifiedAt: "2026-09-25T10:00:00.000Z" }),
    });

    await expect(claimTeamNotification("user-123")).resolves.toBe(false);
    expect(fakeTransaction.update).not.toHaveBeenCalled();
  });

  it("opens a request with nobody notified yet", async () => {
    await createAccessRequest("user-123", {
      email: "fulano@gmail.com",
      tier: "common",
      intention: "Pesquisa",
    });

    expect(fakeDoc.set).toHaveBeenCalledWith(
      expect.objectContaining({ notifiedAt: null }),
    );
  });

  it("reads a request back", async () => {
    fakeDoc.get.mockResolvedValue({
      exists: true,
      data: () => ({
        email: "fulano@gmail.com",
        tier: "common",
        intention: "Pesquisa sobre seca",
        status: "pending",
        createdAt: "2026-09-24T00:00:00.000Z",
        decidedAt: null,
        decidedBy: null,
      }),
    });

    await expect(readAccessRequest("user-123")).resolves.toEqual(
      expect.objectContaining({ status: "pending", tier: "common" }),
    );
  });

  it("returns null when there is no request", async () => {
    fakeDoc.get.mockResolvedValue({ exists: false });

    await expect(readAccessRequest("user-123")).resolves.toBeNull();
  });

  // O que o documento pede da auditoria: quem pediu, o que escreveu, quem
  // decidiu e quando.
  // Dois operadores clicando ao mesmo tempo passavam os dois pela checagem de
  // "ainda está pendente", porque ler e escrever eram operações separadas. Se um
  // aprovasse e o outro recusasse, a pessoa ficava com acesso e a trilha dizia
  // que foi negada. Só uma transação do banco impede isso.
  it("decides inside a transaction, so two operators cannot both win", async () => {
    fakeTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({ status: "pending", tier: "common" }),
    });

    await expect(
      claimPendingDecision("user-123", {
        status: "approved",
        decidedBy: "operador@lsd.ufcg.edu.br",
      }),
    ).resolves.toEqual(expect.objectContaining({ claimed: true, tier: "common" }));

    expect(fakeDb.runTransaction).toHaveBeenCalled();
    expect(fakeTransaction.update).toHaveBeenCalledWith(
      fakeDoc,
      expect.objectContaining({ status: "approved" }),
    );
  });

  it("refuses the second operator when the request was already decided", async () => {
    fakeTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({ status: "approved", tier: "common" }),
    });

    await expect(
      claimPendingDecision("user-123", {
        status: "rejected",
        decidedBy: "outro@lsd.ufcg.edu.br",
      }),
    ).resolves.toEqual(expect.objectContaining({ claimed: false }));

    expect(fakeTransaction.update).not.toHaveBeenCalled();
  });

  it("records who decided and when, keeping the request", async () => {
    await recordAccessDecision("user-123", {
      status: "approved",
      decidedBy: "operador@lsd.ufcg.edu.br",
    });

    expect(fakeDoc.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "approved",
        decidedBy: "operador@lsd.ufcg.edu.br",
        decidedAt: expect.any(String),
      }),
    );
    expect(fakeDoc.delete).not.toHaveBeenCalled();
  });

  it("records a rejection the same way", async () => {
    await recordAccessDecision("user-123", {
      status: "rejected",
      decidedBy: "operador@lsd.ufcg.edu.br",
    });

    expect(fakeDoc.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "rejected" }),
    );
  });

  // A liberação por domínio não tem operador humano, mas continua sendo uma
  // decisão e precisa aparecer na trilha.
  it("marks an automatic approval as decided by the domain rule", async () => {
    await recordAccessDecision("user-456", {
      status: "approved",
      decidedBy: null,
    });

    expect(fakeDoc.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved", decidedBy: null }),
    );
  });

  // A tela de aprovação mostra só quem está esperando, mais antigo primeiro:
  // quem pediu há mais tempo é quem está esperando há mais tempo.
  it("lists only the requests still waiting, oldest first", async () => {
    fakeQuery.get.mockResolvedValue({
      docs: [
        {
          id: "user-1",
          data: () => ({ email: "a@gmail.com", status: "pending" }),
        },
        {
          id: "user-2",
          data: () => ({ email: "b@gmail.com", status: "pending" }),
        },
      ],
    });

    const pending = await listPendingAccessRequests();

    expect(fakeCollection.where).toHaveBeenCalledWith("status", "==", "pending");
    expect(fakeQuery.orderBy).toHaveBeenCalledWith("createdAt", "asc");
    expect(pending).toEqual([
      { uid: "user-1", email: "a@gmail.com", status: "pending" },
      { uid: "user-2", email: "b@gmail.com", status: "pending" },
    ]);
  });
});
