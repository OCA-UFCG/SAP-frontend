import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateLinkMock, sendMailMock } = vi.hoisted(() => ({
  generateLinkMock: vi.fn(),
  sendMailMock: vi.fn(),
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: { generateEmailVerificationLink: generateLinkMock },
  adminDb: {},
}));

vi.mock("@/lib/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mailer")>();
  return { ...actual, sendMail: sendMailMock };
});

import { sendVerificationEmail } from "@/lib/signup-verification";

const LINK = "https://sap.example/verificar?oobCode=SEGREDO";

describe("sendVerificationEmail", () => {
  beforeEach(() => {
    generateLinkMock.mockReset().mockResolvedValue(LINK);
    sendMailMock.mockReset().mockResolvedValue({ delivered: true });
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_HOST_URL", "https://sap.example");
    vi.restoreAllMocks();
  });

  it("reports success when the message actually went out", async () => {
    await expect(sendVerificationEmail("fulano@ufcg.edu.br")).resolves.toBe(true);
  });

  // Antes devolvia `true` mesmo sem credencial configurada, e quem chamava
  // descartava o resultado: o cadastro respondia sucesso e o e-mail nunca saía,
  // sem nenhum sinal em lugar nenhum.
  it("reports failure when nothing was delivered", async () => {
    sendMailMock.mockResolvedValue({ delivered: false });

    await expect(sendVerificationEmail("fulano@ufcg.edu.br")).resolves.toBe(
      false,
    );
  });

  it("reports failure when the link could not be generated", async () => {
    generateLinkMock.mockRejectedValue(new Error("credencial inválida"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(sendVerificationEmail("fulano@ufcg.edu.br")).resolves.toBe(
      false,
    );
  });

  // O link é credencial: não pode aparecer em log, telemetria nem mensagem de
  // erro.
  it("never lets the link reach the log when something fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    sendMailMock.mockRejectedValue(new Error(`falha ao enviar para ${LINK}`));

    await sendVerificationEmail("fulano@ufcg.edu.br");

    expect(error.mock.calls.flat().join(" ")).not.toContain("SEGREDO");
  });
});
