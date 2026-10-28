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

const LINK =
  "https://sap-project-123.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=SEGREDO&apiKey=chave&lang=en";

function sentLink() {
  const { text } = sendMailMock.mock.calls[0][0] as { text: string };
  return text.match(/https:\/\/\S+/)![0];
}

describe("sendVerificationEmail", () => {
  beforeEach(() => {
    generateLinkMock.mockReset().mockResolvedValue(LINK);
    sendMailMock.mockReset().mockResolvedValue({ delivered: true });
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_HOST_URL", "https://sap.example");
    vi.restoreAllMocks();
  });

  it("reports success when the message actually went out", async () => {
    await expect(sendVerificationEmail("fulano@ufcg.edu.br")).resolves.toBe("sent");
  });

  // Antes devolvia `true` mesmo sem credencial configurada, e quem chamava
  // descartava o resultado: o cadastro respondia sucesso e o e-mail nunca saía,
  // sem nenhum sinal em lugar nenhum.
  // O link do Firebase mostrava o nome interno do projeto e abria uma tela em
  // inglês. Do link dele só sai o código; quem recebe o e-mail vê a nossa
  // página, no idioma em que se cadastrou.
  it("sends the person to our own confirmation page, in their language", async () => {
    await sendVerificationEmail("fulano@ufcg.edu.br", "en");

    const link = new URL(sentLink());
    expect(link.origin + link.pathname).toBe(
      "https://sap.example/en/cadastro/confirmacao",
    );
    expect(link.searchParams.get("code")).toBe("SEGREDO");
    expect(link.searchParams.has("email")).toBe(false);
    expect(JSON.stringify(sendMailMock.mock.calls)).not.toContain(
      "firebaseapp",
    );
  });

  // A produção atende por vários domínios e deixa `NEXT_PUBLIC_HOST_URL` vazia;
  // o e-mail usa o domínio que a equipe divulga.
  it("uses the dedicated e-mail domain when one is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_HOST_URL", "");
    vi.stubEnv("EMAIL_LINKS_BASE_URL", "https://sedes.example/");

    await sendVerificationEmail("fulano@ufcg.edu.br", "pt");

    expect(sentLink()).toMatch(
      /^https:\/\/sedes\.example\/pt\/cadastro\/confirmacao\?/,
    );
  });

  // Sem `actionCodeSettings` o Firebase não exige que o nosso domínio esteja na
  // lista de domínios autorizados dele.
  it("asks Firebase for the code without a return address", async () => {
    await sendVerificationEmail("fulano@ufcg.edu.br");

    expect(generateLinkMock).toHaveBeenCalledWith("fulano@ufcg.edu.br");
  });

  it("reports failure when Firebase returns a link without a code", async () => {
    generateLinkMock.mockResolvedValue("https://sap-project-123.firebaseapp.com/");
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(sendVerificationEmail("fulano@ufcg.edu.br")).resolves.toBe(
      "failed",
    );
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("reports failure when nothing was delivered", async () => {
    sendMailMock.mockResolvedValue({ delivered: false });

    await expect(sendVerificationEmail("fulano@ufcg.edu.br")).resolves.toBe(
      "failed",
    );
  });

  it("reports failure when the link could not be generated", async () => {
    generateLinkMock.mockRejectedValue(new Error("credencial inválida"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(sendVerificationEmail("fulano@ufcg.edu.br")).resolves.toBe(
      "failed",
    );
  });

  // O Firebase recusa um link novo para a mesma conta antes de cerca de um
  // minuto. Separar o caso deixa o reenvio pedir para esperar em vez de dizer
  // "enviado".
  it("tells a Firebase throttle apart from other failures", async () => {
    generateLinkMock.mockRejectedValue(
      new Error(
        'An internal error has occurred. Raw server response: "{"error":{"code":400,"message":"TOO_MANY_ATTEMPTS_TRY_LATER"}}"',
      ),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(sendVerificationEmail("fulano@ufcg.edu.br")).resolves.toBe(
      "throttled",
    );
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  // O link é credencial: não pode aparecer em log, telemetria nem mensagem de
  // erro.
  it("never lets the link reach the log when something fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // No corpo em HTML o link aparece com `&amp;`, e é assim que a biblioteca
    // de envio pode ecoá-lo.
    sendMailMock.mockRejectedValue(
      new Error(
        "falha ao enviar https://sap.example/cadastro/confirmacao?code=SEGREDO&amp;email=x",
      ),
    );

    await sendVerificationEmail("fulano@ufcg.edu.br");

    expect(error.mock.calls.flat().join(" ")).not.toContain("SEGREDO");
  });
});
