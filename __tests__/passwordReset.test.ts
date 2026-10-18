import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateLinkMock, getUserByEmailMock, sendMailMock } = vi.hoisted(() => ({
  generateLinkMock: vi.fn(),
  getUserByEmailMock: vi.fn(),
  sendMailMock: vi.fn(),
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    generatePasswordResetLink: generateLinkMock,
    getUserByEmail: getUserByEmailMock,
  },
  adminDb: {},
}));

vi.mock("@/lib/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mailer")>();
  return { ...actual, sendMail: sendMailMock };
});

import { sendPasswordResetEmail } from "@/lib/password-reset";

const LINK =
  "https://sap-project-123.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=SEGREDO&apiKey=chave&lang=en";

function sentLink() {
  const { text } = sendMailMock.mock.calls[0][0] as { text: string };
  return text.match(/https:\/\/\S+/)![0];
}

describe("sendPasswordResetEmail", () => {
  beforeEach(() => {
    generateLinkMock.mockReset().mockResolvedValue(LINK);
    getUserByEmailMock.mockReset().mockResolvedValue({ uid: "user-123" });
    sendMailMock.mockReset().mockResolvedValue({ delivered: true });
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_HOST_URL", "https://sap.example");
    vi.restoreAllMocks();
  });

  it("reports success when the message actually went out", async () => {
    await expect(sendPasswordResetEmail("fulano@ufcg.edu.br")).resolves.toBe(true);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "fulano@ufcg.edu.br" }),
    );
  });

  // Do link do Firebase só sai o código: a pessoa troca a senha na nossa
  // página, no idioma em que pediu, e nunca vê o nome interno do projeto.
  it("sends the person to our own reset page, in their language", async () => {
    await sendPasswordResetEmail("fulano@ufcg.edu.br", "en");

    const link = new URL(sentLink());
    expect(link.origin + link.pathname).toBe(
      "https://sap.example/en/redefinir-senha",
    );
    expect(link.searchParams.get("code")).toBe("SEGREDO");
    // Ao contrário da confirmação, o endereço não viaja no link: a página o
    // descobre pelo código.
    expect(link.searchParams.get("email")).toBeNull();
    expect(JSON.stringify(sendMailMock.mock.calls)).not.toContain("firebaseapp");
  });

  it("uses the dedicated e-mail domain when one is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_HOST_URL", "");
    vi.stubEnv("EMAIL_LINKS_BASE_URL", "https://sedes.example/");

    await sendPasswordResetEmail("fulano@ufcg.edu.br", "pt");

    expect(sentLink()).toMatch(/^https:\/\/sedes\.example\/pt\/redefinir-senha\?/);
  });

  // Quem digita um endereço sem conta não é problema de infraestrutura; não
  // pode encher o log nem sair um e-mail.
  it("sends nothing and logs nothing for an address without an account", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    getUserByEmailMock.mockRejectedValue(
      Object.assign(new Error("not found"), { code: "auth/user-not-found" }),
    );

    await expect(sendPasswordResetEmail("ninguem@gmail.com")).resolves.toBe(false);
    expect(generateLinkMock).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  // Com a proteção contra enumeração ligada no projeto, gerar o link para uma
  // conta que não existe falha com `auth/internal-error`, igual a uma pane de
  // verdade. A conta é procurada antes para esse caso não virar erro no log.
  it("looks the account up before asking Firebase for the link", async () => {
    await sendPasswordResetEmail("fulano@ufcg.edu.br");

    expect(getUserByEmailMock).toHaveBeenCalledWith("fulano@ufcg.edu.br");
    expect(getUserByEmailMock.mock.invocationCallOrder[0]).toBeLessThan(
      generateLinkMock.mock.invocationCallOrder[0],
    );
  });

  it("never lets the code reach the log when sending fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    sendMailMock.mockRejectedValue(
      new Error("SMTP recusou a mensagem com code=SEGREDO"),
    );

    await expect(sendPasswordResetEmail("fulano@ufcg.edu.br")).resolves.toBe(false);
    expect(error).toHaveBeenCalled();
    expect(error.mock.calls.flat().join(" ")).not.toContain("SEGREDO");
  });

  it("reports failure when the mailer has no credentials", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    sendMailMock.mockResolvedValue({ delivered: false });

    await expect(sendPasswordResetEmail("fulano@ufcg.edu.br")).resolves.toBe(false);
  });
});
